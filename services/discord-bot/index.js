import {
  Client,
  GatewayIntentBits,
  ActivityType,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import DatabaseService from '../database/index.js';
import EmojiResolver from './emojiResolver.js';
import MarkdownBuilder from './markdownBuilder.js';
import ChannelManager, { CHANNEL_DEFINITIONS } from './channelManager.js';
import setupCommand from './commands/setup.js';
import { statusCommand, statsCommand } from './commands/status.js';
import driverCommand from './commands/driver.js';
import announceCommand from './commands/announce.js';

export class DiscordBotService {
  static isInitialized = false;
  static client = null;
  static botSettings = null;
  static currentStatusIndex = 0;
  static presenceTimer = null;
  static voiceConnection = null;
  static voiceReconnectTimer = null;

  static commands = [
    setupCommand,
    statusCommand,
    statsCommand,
    driverCommand,
    announceCommand
  ];

  static async init() {
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!token) {
      console.log(`\x1b[33mℹ\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Token tanımlanmadı, bot bekleme modunda.`);
      this.isInitialized = true;
      return;
    }

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.GuildExpressions
        ]
      });

      EmojiResolver.setClient(this.client);

      this.client.once('clientReady', async (c) => {
        console.log(`\x1b[32m✔\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Bot başarıyla bağlandı: \x1b[36m${c.user.tag}\x1b[0m`);
        
        // 1. Register Application Slash Commands
        await this.registerSlashCommands();

        // 2. Start Presence & Streaming Loop from Database
        await this.startPresenceLoop();

        // 3. Connect to Voice Channel if enabled in Database
        await this.connectToVoiceChannel();
      });

      // Handle Slash Commands and Component Interactions
      this.client.on('interactionCreate', async (interaction) => {
        try {
          if (interaction.isChatInputCommand()) {
            await this.handleSlashCommand(interaction);
          } else if (interaction.isStringSelectMenu()) {
            await this.handleSelectMenu(interaction);
          } else if (interaction.isButton()) {
            await this.handleButton(interaction);
          }
        } catch (err) {
          console.error('[DiscordBot] Interaction error:', err);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: `${EmojiResolver.NO} **An error occurred / Bir hata oluştu:** \`${err.message}\``
            }).catch(() => null);
          } else {
            await interaction.reply({
              content: `${EmojiResolver.NO} **An error occurred / Bir hata oluştu:** \`${err.message}\``
            }).catch(() => null);
          }
        }
      });

      this.client.on('error', (err) => {
        console.error(`\x1b[31m✖\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Bağlantı uyarısı: ${err.message}`);
      });

      await this.client.login(token);
      this.isInitialized = true;
    } catch (err) {
      console.error(`\x1b[31m✖\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Giriş yapılamadı: ${err.message}`);
    }
  }

  /**
   * Register Slash Commands with Discord REST API
   */
  static async registerSlashCommands() {
    if (!this.client || !this.client.user) return;

    try {
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
      const commandData = this.commands.map(cmd => cmd.data.toJSON());

      console.log(`\x1b[34mℹ\x1b[0m \x1b[1m[Discord Bot]\x1b[0m ${commandData.length} adet Slash Komutu kaydediliyor...`);

      // If GUILD_ID specified in .env, register immediately to guild (fast propagation)
      const guildId = process.env.DISCORD_GUILD_ID;
      if (guildId) {
        await rest.put(
          Routes.applicationGuildCommands(this.client.user.id, guildId),
          { body: commandData }
        );
        console.log(`\x1b[32m✔\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Komutlar sunucuya (${guildId}) başarıyla yüklendi.`);
      } else {
        await rest.put(
          Routes.applicationCommands(this.client.user.id),
          { body: commandData }
        );
        console.log(`\x1b[32m✔\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Global Slash Komutları başarıyla yüklendi.`);
      }
    } catch (err) {
      console.error('[DiscordBot] Slash command registration error:', err.message);
    }
  }

  /**
   * Handle Chat Input Commands
   */
  static async handleSlashCommand(interaction) {
    const cmd = this.commands.find(c => c.data.name === interaction.commandName);
    if (cmd) {
      await cmd.execute(interaction);
    }
  }

  /**
   * Handle Select Menu Interactions (/kurulum menu)
   */
  static async handleSelectMenu(interaction) {
    if (interaction.customId === 'setup_select_action') {
      const selectedValue = interaction.values[0];
      await this.processSetupAction(interaction, selectedValue);
    }
  }

  /**
   * Handle Button Interactions
   */
  static async handleButton(interaction) {
    const id = interaction.customId;

    if (id === 'btn_setup_quick_create') {
      await this.processSetupAction(interaction, 'action_create_all');
    } else if (id === 'btn_setup_repair') {
      await this.processSetupAction(interaction, 'action_repair');
    } else if (id === 'btn_setup_view_map') {
      await this.processSetupAction(interaction, 'action_view_map');
    } else if (id === 'btn_setup_delete') {
      // Show confirmation prompt
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_delete_confirm_final')
          .setLabel('Confirm Delete / Silmeyi Onayla')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('btn_delete_cancel')
          .setLabel('Cancel / İptal')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: [
          MarkdownBuilder.header('Confirm Deletion of Dedicated Channels', 'Özel Kanalların Silinmesini Onaylayın', 'no'),
          MarkdownBuilder.bilingual(
            'Are you sure you want to delete all 14 `vweb-*` channels and their category? This action is irreversible.',
            'Tüm 14 adet `vweb-*` kanalını ve kategorisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.'
          )
        ].join('\n'),
        components: [confirmRow],
        ephemeral: true
      });
    } else if (id === 'btn_delete_confirm_final') {
      await interaction.deferUpdate();
      const result = await ChannelManager.deleteAllChannels(interaction.guild);
      await interaction.editReply({
        content: [
          MarkdownBuilder.header('System Channels Purged Successfully', 'Sistem Kanalları Başarıyla Silindi', 'yes'),
          MarkdownBuilder.bilingual(
            `Deleted ${result.deletedCount} dedicated \`vweb-*\` channels and cleared database mappings.`,
            `${result.deletedCount} adet özel \`vweb-*\` kanalı silindi ve veritabanı temizlendi.`
          ),
          MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
        ].join('\n'),
        components: []
      });
    } else if (id === 'btn_delete_cancel') {
      await interaction.update({
        content: [
          MarkdownBuilder.header('Operation Cancelled', 'İşlem İptal Edildi', 'yes'),
          MarkdownBuilder.bilingual('Channel deletion was cancelled.', 'Kanal silme işlemi iptal edildi.')
        ].join('\n'),
        components: []
      });
    }
  }

  /**
   * Process Setup Action Requests
   */
  static async processSetupAction(interaction, action) {
    await interaction.deferReply({ ephemeral: false });

    if (action === 'action_create_all') {
      const res = await ChannelManager.createAllChannels(interaction.guild);
      const createdCount = res.channels.filter(c => c.status === 'CREATED').length;
      const existingCount = res.channels.filter(c => c.status === 'EXISTING').length;

      const lines = [
        MarkdownBuilder.header('Automated Channel Installation Complete', 'Otomatik Kanal Kurulumu Tamamlandı', 'yes'),
        '',
        `>>> **Category: \`${res.categoryName}\`**`,
        `*Kategori: \`${res.categoryName}\`*`,
        '',
        MarkdownBuilder.ansiBlock([
          MarkdownBuilder.ansi(`[SETUP RESULT] SUCCESS • ${CHANNEL_DEFINITIONS.length} Channels Verified`, '32', true),
          MarkdownBuilder.ansi(`[CREATED] ${createdCount} New vweb-* Channels`, '36'),
          MarkdownBuilder.ansi(`[EXISTING / SYNCED] ${existingCount} Channels`, '37'),
          MarkdownBuilder.ansi(`[DATABASE] MongoDB Mappings Synchronized`, '35')
        ]),
        '',
        `### Configured Channels / Yapılandırılan Kanallar`,
        `*-# Dedicated independent log streams for every website event.*`,
        '',
        res.channels.map(c => `• **#${c.name}** — \`${c.id}\` [${c.status}]`).join('\n'),
        '',
        MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
      ];

      await interaction.editReply({ content: lines.join('\n') });

    } else if (action === 'action_repair') {
      const res = await ChannelManager.repairChannels(interaction.guild);
      const repairedCount = res.repairedCount;

      const lines = [
        MarkdownBuilder.header('Channel Self-Repair & Sync Complete', 'Kanal Otomatik Tamir ve Senkronizasyonu Tamamlandı', 'yes'),
        '',
        `>>> **Verified all 14 \`vweb-*\` channels against database state.**`,
        `*Veritabanı durumuna göre tüm 14 adet \`vweb-*\` kanalı doğrulandı.*`,
        '',
        MarkdownBuilder.ansiBlock([
          MarkdownBuilder.ansi(`[REPAIR RESULT] ${repairedCount > 0 ? `Restored ${repairedCount} Missing Channels` : 'All 14 Channels Healthy & Intact'}`, repairedCount > 0 ? '33' : '32', true),
          MarkdownBuilder.ansi(`[CATEGORY] Active Category ID: ${res.categoryId}`, '36'),
          MarkdownBuilder.ansi(`[SYNC] MongoDB Channel Pointers Updated`, '35')
        ]),
        '',
        `### Channel Verification List / Kanal Doğrulama Listesi`,
        res.channels.map(c => `• **#${c.name}** — Status: \`${c.status}\``).join('\n'),
        '',
        MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
      ];

      await interaction.editReply({ content: lines.join('\n') });

    } else if (action === 'action_recreate') {
      const res = await ChannelManager.recreateAllChannels(interaction.guild);
      const lines = [
        MarkdownBuilder.header('Channels Recreated & Re-initialized', 'Kanallar Sıfırdan Baştan Kuruldu', 'yes'),
        '',
        MarkdownBuilder.ansiBlock([
          MarkdownBuilder.ansi(`[REBUILD] Clean Slate Setup Complete`, '32', true),
          MarkdownBuilder.ansi(`[CHANNELS] 14 Fresh Dedicated Streams Created`, '36')
        ]),
        '',
        res.channels.map(c => `• **#${c.name}** — \`${c.id}\``).join('\n'),
        '',
        MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
      ];

      await interaction.editReply({ content: lines.join('\n') });

    } else if (action === 'action_view_map') {
      const botSettings = await DatabaseService.getBotSettings();
      const currentChannels = botSettings.channels || {};

      const lines = [
        MarkdownBuilder.header('Vintage Web — Active Channel Map', 'Vintage Web — Aktif Kanal Haritası', 'stats'),
        '',
        `>>> **Dedicated \`vweb-*\` Telemetry Mapping**`,
        `*Ayrılmış \`vweb-*\` Telemetri Eşleşmesi*`,
        '',
        MarkdownBuilder.ansiBlock([
          MarkdownBuilder.ansi(`[CATEGORY ID] ${botSettings.logCategoryId || 'NOT CONFIGURED'}`, '36'),
          MarkdownBuilder.ansi(`[TOTAL STREAMS] ${CHANNEL_DEFINITIONS.length} Dedicated Endpoints`, '32')
        ]),
        '',
        CHANNEL_DEFINITIONS.map(def => {
          const chId = currentChannels[def.key];
          const exists = chId && interaction.guild.channels.cache.has(chId);
          return `\`${def.key.padEnd(12)}\` ➔ **#${def.name}** (${exists ? `\`${chId}\` ${EmojiResolver.YES}` : `*Not Linked* ${EmojiResolver.NO}`})\n*-# ${def.enDesc} • ${def.trDesc}*`;
        }).join('\n\n'),
        '',
        MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
      ];

      await interaction.editReply({ content: lines.join('\n') });

    } else if (action === 'action_delete_all') {
      const res = await ChannelManager.deleteAllChannels(interaction.guild);
      const lines = [
        MarkdownBuilder.header('Channels Deleted Successfully', 'Kanallar Başarıyla Silindi', 'yes'),
        MarkdownBuilder.bilingual(
          `Removed ${res.deletedCount} channels and reset MongoDB pointers.`,
          `${res.deletedCount} adet kanal kaldırıldı ve veritabanı sıfırlandı.`
        ),
        MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
      ];

      await interaction.editReply({ content: lines.join('\n') });
    }
  }

  /**
   * Central Logging Dispatcher
   * Routes log events to specific dedicated vweb-* channels
   * 
   * @param {'auth' | 'lookup' | 'applications' | 'appStatus' | 'appDelete' | 'settings' | 'members' | 'events' | 'gallery' | 'newsletter' | 'botPresence' | 'botVoice' | 'cache' | 'systemErrors'} logType
   * @param {Object} payload 
   * @param {Object} [req] Express request object for IP and metadata extraction
   */
  static async sendLog(logType, payload = {}, req = null) {
    if (!this.client || !this.client.isReady || !this.client.isReady()) return false;

    try {
      const botSettings = await DatabaseService.getBotSettings();
      const toggles = botSettings.logToggles || {};

      // If this specific log type is toggled off, skip
      if (toggles[logType] === false) return false;

      const targetChannel = await ChannelManager.getChannelForLog(this.client, logType);
      if (!targetChannel) return false;

      // Extract metadata from Express Request
      const meta = {
        ip: payload.ip || (req ? (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '').split(',')[0].trim() : '127.0.0.1'),
        country: payload.country || (req?.currentLang ? req.currentLang.toUpperCase() : 'Global'),
        user: payload.actor || (req?.session?.user ? `${req.session.user.globalName || req.session.user.username} (@${req.session.user.username})` : 'System / Guest'),
        time: payload.time || new Date(),
        reqId: payload.reqId || (req ? req.id || 'web_req_' + Math.random().toString(36).substring(2, 7) : 'internal')
      };

      const enTitle = payload.enTitle || `System Event: ${logType.toUpperCase()}`;
      const trTitle = payload.trTitle || `Sistem Olayı: ${logType.toUpperCase()}`;
      const enDesc = payload.enDesc || 'A web platform action occurred.';
      const trDesc = payload.trDesc || 'Bir web platformu işlemi gerçekleşti.';
      const emojiKey = payload.emojiKey || 'yes';
      const ansiLines = payload.ansiLines || [];
      const treeItems = payload.treeItems || [];

      const messageParts = [
        MarkdownBuilder.header(enTitle, trTitle, emojiKey),
        '',
        `>>> **${enDesc}**`,
        `*${trDesc}*`
      ];

      if (ansiLines.length > 0) {
        messageParts.push('', MarkdownBuilder.ansiBlock(ansiLines));
      }

      if (treeItems.length > 0) {
        messageParts.push('', `### Event Details / İşlem Ayrıntıları`, `*-# Specific payload and state variables.*`, '', MarkdownBuilder.tree(treeItems));
      }

      messageParts.push('', MarkdownBuilder.metaFooter(meta));

      await targetChannel.send({ content: messageParts.join('\n') });
      return true;
    } catch (err) {
      console.error(`[DiscordBot sendLog:${logType}] Error:`, err.message);
      return false;
    }
  }

  /**
   * Map String Activity Type to discord.js ActivityType Enum
   */
  static mapActivityType(typeStr) {
    const type = (typeStr || 'STREAMING').toUpperCase();
    switch (type) {
      case 'STREAMING':
        return ActivityType.Streaming;
      case 'PLAYING':
        return ActivityType.Playing;
      case 'LISTENING':
        return ActivityType.Listening;
      case 'WATCHING':
        return ActivityType.Watching;
      case 'COMPETING':
        return ActivityType.Competing;
      case 'CUSTOM':
        return ActivityType.Custom;
      default:
        return ActivityType.Streaming;
    }
  }

  /**
   * Apply current single presence step to bot client
   */
  static async applyPresence() {
    if (!this.client || !this.client.user) return;

    try {
      if (!this.botSettings) {
        this.botSettings = await DatabaseService.getBotSettings();
      }

      const statuses = (this.botSettings.statuses && this.botSettings.statuses.length > 0)
        ? this.botSettings.statuses
        : ['👑 Vintage Club | 2026', '🚛 Nobility on the Roads'];

      const isRotating = this.botSettings.statusMode === 'ROTATING' && statuses.length > 1;
      const statusText = isRotating
        ? statuses[this.currentStatusIndex % statuses.length]
        : (statuses[0] || '👑 Vintage Club');

      const actType = this.mapActivityType(this.botSettings.statusType);
      const activityConfig = {
        name: statusText,
        type: actType
      };

      if (actType === ActivityType.Streaming) {
        activityConfig.url = this.botSettings.streamingUrl || 'https://twitch.tv/vintageclub';
      }

      this.client.user.setPresence({
        activities: [activityConfig],
        status: this.botSettings.onlineStatus || 'online'
      });
    } catch (err) {
      console.error('[DiscordBot] applyPresence error:', err.message);
    }
  }

  /**
   * Start or restart presence rotation loop based on database settings
   */
  static async startPresenceLoop() {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }

    try {
      this.botSettings = await DatabaseService.getBotSettings();
      this.currentStatusIndex = 0;

      // Apply immediately
      await this.applyPresence();

      const statuses = this.botSettings.statuses || [];
      if (this.botSettings.statusMode === 'ROTATING' && statuses.length > 1) {
        const intervalSec = Math.max(5, parseInt(this.botSettings.rotationIntervalSeconds, 10) || 15);
        this.presenceTimer = setInterval(async () => {
          this.currentStatusIndex = (this.currentStatusIndex + 1) % statuses.length;
          await this.applyPresence();
        }, intervalSec * 1000);
      }
    } catch (err) {
      console.error('[DiscordBot] startPresenceLoop error:', err.message);
    }
  }

  /**
   * Reload presence immediately upon developer panel update
   */
  static async reloadPresence() {
    this.botSettings = null;
    await this.startPresenceLoop();
    return { success: true, settings: this.botSettings };
  }

  /**
   * Connect and stay 24/7 in specified voice channel
   */
  static async connectToVoiceChannel() {
    if (!this.client || !this.client.isReady || !this.client.isReady()) return { success: false, message: 'Bot client is not ready' };

    try {
      const settings = await DatabaseService.getBotSettings();
      const voiceConfig = settings.voiceChannel || {};

      // If voice is disabled, disconnect if currently connected
      if (!voiceConfig.enabled || !voiceConfig.guildId || !voiceConfig.channelId) {
        this.disconnectVoiceChannel();
        return { success: true, connected: false, message: 'Voice channel is disabled' };
      }

      const guild = await this.client.guilds.fetch(voiceConfig.guildId).catch(() => null);
      if (!guild) {
        console.warn(`\x1b[33m⚠\x1b[0m \x1b[1m[Discord Voice]\x1b[0m Sunucu bulunamadı (Guild ID: ${voiceConfig.guildId})`);
        return { success: false, message: 'Guild not found' };
      }

      const channel = await guild.channels.fetch(voiceConfig.channelId).catch(() => null);
      if (!channel || channel.type !== 2 && channel.type !== 13) { // 2: GUILD_VOICE, 13: GUILD_STAGE_VOICE
        console.warn(`\x1b[33m⚠\x1b[0m \x1b[1m[Discord Voice]\x1b[0m Ses kanalı bulunamadı (Channel ID: ${voiceConfig.channelId})`);
        return { success: false, message: 'Voice channel not found or invalid type' };
      }

      // Check existing connection
      const existingConn = getVoiceConnection(guild.id);
      if (existingConn && existingConn.joinConfig.channelId === channel.id) {
        this.voiceConnection = existingConn;
        return { success: true, connected: true, channelName: channel.name, guildName: guild.name };
      }

      if (existingConn) {
        existingConn.destroy();
      }

      // Join Voice Channel
      this.voiceConnection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: voiceConfig.selfDeaf ?? true,
        selfMute: voiceConfig.selfMute ?? true
      });

      console.log(`\x1b[32m✔\x1b[0m \x1b[1m[Discord Voice]\x1b[0m Bot ses kanalına bağlandı: \x1b[36m#${channel.name}\x1b[0m (${guild.name})`);

      // Auto-Reconnect Watcher
      this.voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(this.voiceConnection, VoiceConnectionStatus.Signalling, 5000),
            entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5000)
          ]);
        } catch (error) {
          console.warn(`\x1b[33m⚠\x1b[0m \x1b[1m[Discord Voice]\x1b[0m Ses bağlantısı koptu, 5s sonra yeniden bağlanılacak...`);
          if (this.voiceConnection) {
            this.voiceConnection.destroy();
            this.voiceConnection = null;
          }
          if (this.voiceReconnectTimer) clearTimeout(this.voiceReconnectTimer);
          this.voiceReconnectTimer = setTimeout(() => {
            this.connectToVoiceChannel();
          }, 5000);
        }
      });

      return {
        success: true,
        connected: true,
        channelName: channel.name,
        guildName: guild.name,
        channelId: channel.id,
        guildId: guild.id
      };
    } catch (err) {
      console.error('\x1b[31m✖\x1b[0m \x1b[1m[Discord Voice]\x1b[0m Ses bağlantı hatası:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Disconnect from voice channel
   */
  static disconnectVoiceChannel() {
    if (this.voiceReconnectTimer) {
      clearTimeout(this.voiceReconnectTimer);
      this.voiceReconnectTimer = null;
    }
    if (this.voiceConnection) {
      this.voiceConnection.destroy();
      this.voiceConnection = null;
      console.log(`\x1b[33mℹ\x1b[0m \x1b[1m[Discord Voice]\x1b[0m Bot ses kanalından ayrıldı.`);
      return { success: true, connected: false };
    }
    return { success: true, connected: false };
  }

  /**
   * Get Current Live Voice Status
   */
  static getVoiceStatus() {
    if (this.voiceConnection && this.voiceConnection.state.status === VoiceConnectionStatus.Ready) {
      const channelId = this.voiceConnection.joinConfig.channelId;
      const guildId = this.voiceConnection.joinConfig.guildId;
      const guild = this.client?.guilds?.cache?.get(guildId);
      const channel = guild?.channels?.cache?.get(channelId);

      return {
        connected: true,
        status: 'CONNECTED',
        channelId,
        guildId,
        channelName: channel?.name || 'Voice Channel',
        guildName: guild?.name || 'Discord Server'
      };
    }

    return {
      connected: false,
      status: 'DISCONNECTED',
      channelId: null,
      guildId: null,
      channelName: null,
      guildName: null
    };
  }

  // Compatibility helpers
  static async notifyNewApplication(application, req = null) {
    return this.sendLog('applications', {
      enTitle: `New Driver Application Received: ${application.fullName}`,
      trTitle: `Yeni Sürücü Başvurusu Alındı: ${application.fullName}`,
      enDesc: `A candidate submitted an official recruitment application.`,
      trDesc: `Bir aday resmi sürücü katılım başvurusu gönderdi.`,
      emojiKey: 'yes',
      ansiLines: [
        MarkdownBuilder.ansi(`[APPLICATION] #${application.id}`, '36', true),
        MarkdownBuilder.ansi(`[CANDIDATE] ${application.fullName} (Age: ${application.age || 'N/A'})`, '32'),
        MarkdownBuilder.ansi(`[DISCORD] @${application.discordTag}`, '35'),
        MarkdownBuilder.ansi(`[STATUS] PENDING REVIEW`, '33')
      ],
      treeItems: [
        { enKey: 'Full Name', trKey: 'Ad Soyad', val: application.fullName },
        { enKey: 'Discord Username', trKey: 'Discord Adı', val: application.discordTag },
        { enKey: 'TruckersMP Profile', trKey: 'TMP Profili', val: application.truckersMpProfile || 'N/A' },
        { enKey: 'Experience Hours', trKey: 'Deneyim Saati', val: `${application.experienceHours || 0} Hours` },
        { enKey: 'Steam Profile', trKey: 'Steam Profili', val: application.steamProfile || 'N/A' }
      ]
    }, req);
  }

  static async broadcastConvoy(convoyId) {
    return true;
  }
}

// Auto-initialize
DiscordBotService.init().catch(console.error);

export default DiscordBotService;
