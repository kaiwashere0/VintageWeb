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

      const deleteWarningContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle: 'Confirm Deletion of Dedicated Channels',
        trTitle: 'Özel Kanalların Silinmesini Onaylayın',
        enDesc: 'Are you sure you want to delete all 14 `vweb-*` channels and their category? This action is irreversible.',
        trDesc: 'Tüm 14 adet `vweb-*` kanalını ve kategorisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        emojiKey: 'no',
        accentColor: VINTAGE_COLORS.ERROR
      });

      await interaction.reply({
        components: [deleteWarningContainer, confirmRow],
        ephemeral: true
      });
    } else if (id === 'btn_delete_confirm_final') {
      await interaction.deferUpdate();
      const result = await ChannelManager.deleteAllChannels(interaction.guild);

      const deletedContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle: 'System Channels Purged Successfully',
        trTitle: 'Sistem Kanalları Başarıyla Silindi',
        enDesc: `Deleted ${result.deletedCount} dedicated \`vweb-*\` channels and cleared database mappings.`,
        trDesc: `${result.deletedCount} adet özel \`vweb-*\` kanalı silindi ve veritabanı temizlendi.`,
        emojiKey: 'yes',
        accentColor: VINTAGE_COLORS.SUCCESS,
        meta: { user: interaction.user.tag, time: new Date() }
      });

      await interaction.editReply({
        components: [deletedContainer]
      });
    } else if (id === 'btn_delete_cancel') {
      const cancelContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle: 'Operation Cancelled',
        trTitle: 'İşlem İptal Edildi',
        enDesc: 'Channel deletion was cancelled.',
        trDesc: 'Kanal silme işlemi iptal edildi.',
        emojiKey: 'yes',
        accentColor: VINTAGE_COLORS.INFO
      });

      await interaction.update({
        components: [cancelContainer]
      });
    }
  }

  /**
   * Process Setup Action Requests
   */
  static async processSetupAction(interaction, action) {
    await interaction.deferReply().catch(() => null);

    if (action === 'action_create_all') {
      const res = await ChannelManager.createAllChannels(interaction.guild);
      const createdCount = res.channels.filter(c => c.status === 'CREATED').length;
      const existingCount = res.channels.filter(c => c.status === 'EXISTING').length;

      const installContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle: 'Automated Channel Installation Complete',
        trTitle: 'Otomatik Kanal Kurulumu Tamamlandı',
        enDesc: `Category: \`${res.categoryName}\``,
        trDesc: `Kategori: \`${res.categoryName}\``,
        emojiKey: 'yes',
        accentColor: VINTAGE_COLORS.SUCCESS,
        ansiLines: [
          `\u001b[1;32m[SETUP RESULT]\u001b[0m SUCCESS • ${CHANNEL_DEFINITIONS.length} Channels Verified`,
          `\u001b[0;36m[CREATED]\u001b[0m ${createdCount} New vweb-* Channels`,
          `\u001b[0;37m[EXISTING / SYNCED]\u001b[0m ${existingCount} Channels`,
          `\u001b[0;35m[DATABASE]\u001b[0m MongoDB Mappings Synchronized`
        ],
        treeItems: res.channels.map(c => ({
          enKey: `#${c.name}`,
          trKey: c.status,
          val: c.id
        })),
        meta: { user: interaction.user.tag, time: new Date() }
      });

      await interaction.editReply({ components: [installContainer] });

    } else if (action === 'action_repair') {
      const res = await ChannelManager.repairChannels(interaction.guild);
      const repairedCount = res.repairedCount;

      const repairContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle: 'Channel Self-Repair & Sync Complete',
        trTitle: 'Kanal Otomatik Tamir ve Senkronizasyonu Tamamlandı',
        enDesc: 'Verified all 14 `vweb-*` channels against database state.',
        trDesc: 'Veritabanı durumuna göre tüm 14 adet `vweb-*` kanalı doğrulandı.',
        emojiKey: 'yes',
        accentColor: repairedCount > 0 ? VINTAGE_COLORS.WARNING : VINTAGE_COLORS.SUCCESS,
        ansiLines: [
          `\u001b[1;${repairedCount > 0 ? '33' : '32'}m[REPAIR RESULT]\u001b[0m ${repairedCount > 0 ? `Restored ${repairedCount} Missing Channels` : 'All 14 Channels Healthy & Intact'}`,
          `\u001b[0;36m[CATEGORY]\u001b[0m Active Category ID: ${res.categoryId}`,
          `\u001b[0;35m[SYNC]\u001b[0m MongoDB Channel Pointers Updated`
        ],
        treeItems: res.channels.map(c => ({
          enKey: `#${c.name}`,
          trKey: 'Durum',
          val: c.status
        })),
        meta: { user: interaction.user.tag, time: new Date() }
      });

      await interaction.editReply({ components: [repairContainer] });

    } else if (action === 'action_recreate') {
      const res = await ChannelManager.recreateAllChannels(interaction.guild);

      const recreateContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle: 'Channels Recreated & Re-initialized',
        trTitle: 'Kanallar Sıfırdan Baştan Kuruldu',
        enDesc: 'Clean slate setup complete. 14 fresh dedicated streams created.',
        trDesc: 'Sıfırdan kurulum tamamlandı. 14 adet temiz özel kanal oluşturuldu.',
        emojiKey: 'yes',
        accentColor: VINTAGE_COLORS.GOLD,
        treeItems: res.channels.map(c => ({
          enKey: `#${c.name}`,
          trKey: 'Kanal ID',
          val: c.id
        })),
        meta: { user: interaction.user.tag, time: new Date() }
      });

      await interaction.editReply({ components: [recreateContainer] });

    } else if (action === 'action_view_map') {
      const botSettings = await DatabaseService.getBotSettings();
      const currentChannels = botSettings.channels || {};

      const mapContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle: 'Vintage Web — Active Channel Map',
        trTitle: 'Vintage Web — Aktif Kanal Haritası',
        enDesc: 'Dedicated `vweb-*` Telemetry Mapping.',
        trDesc: 'Ayrılmış `vweb-*` Telemetri Eşleşmesi.',
        emojiKey: 'stats',
        accentColor: VINTAGE_COLORS.INFO,
        ansiLines: [
          `\u001b[1;36m[CATEGORY ID]\u001b[0m ${botSettings.logCategoryId || 'NOT CONFIGURED'}`,
          `\u001b[0;32m[TOTAL STREAMS]\u001b[0m ${CHANNEL_DEFINITIONS.length} Dedicated Endpoints`
        ],
        treeItems: CHANNEL_DEFINITIONS.map(def => {
          const chId = currentChannels[def.key];
          const exists = chId && interaction.guild.channels.cache.has(chId);
          return {
            enKey: `#${def.name}`,
            trKey: def.key,
            val: exists ? `${chId} (LINKED)` : 'NOT LINKED'
          };
        }),
        meta: { user: interaction.user.tag, time: new Date() }
      });

      await interaction.editReply({ components: [mapContainer] });

    } else if (action === 'action_delete_all') {
      const res = await ChannelManager.deleteAllChannels(interaction.guild);

      const deleteResContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle: 'Channels Deleted Successfully',
        trTitle: 'Kanallar Başarıyla Silindi',
        enDesc: `Removed ${res.deletedCount} channels and reset MongoDB pointers.`,
        trDesc: `${res.deletedCount} adet kanal kaldırıldı ve veritabanı sıfırlandı.`,
        emojiKey: 'yes',
        accentColor: VINTAGE_COLORS.ERROR,
        meta: { user: interaction.user.tag, time: new Date() }
      });

      await interaction.editReply({ components: [deleteResContainer] });
    }
  }

  /**
   * Central Logging Dispatcher
   * Routes log events to specific dedicated vweb-* channels as Discord Containers V2
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
      const accentColor = payload.accentColor || (emojiKey === 'no' ? VINTAGE_COLORS.ERROR : VINTAGE_COLORS.GOLD);

      // Build Discord Components V2 Container
      const logContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle,
        trTitle,
        enDesc,
        trDesc,
        emojiKey,
        accentColor,
        ansiLines,
        treeItems,
        meta
      });

      await targetChannel.send({ components: [logContainer] });
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
