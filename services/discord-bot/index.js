import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import DatabaseService from '../database/index.js';

export class DiscordBotService {
  static isInitialized = false;
  static client = null;
  static botSettings = null;
  static currentStatusIndex = 0;
  static presenceTimer = null;
  static voiceConnection = null;
  static voiceReconnectTimer = null;

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
          GatewayIntentBits.GuildVoiceStates
        ]
      });

      this.client.once('ready', async (c) => {
        console.log(`\x1b[32m✔\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Bot başarıyla bağlandı: \x1b[36m${c.user.tag}\x1b[0m`);
        // 1. Start Presence & Streaming Loop from Database
        await this.startPresenceLoop();
        // 2. Connect to Voice Channel if enabled in Database
        await this.connectToVoiceChannel();
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
          // Seems to be reconnecting to a new channel
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

  // Webhook ve aktif işlemler
  static async notifyNewApplication(application) {
    return true;
  }

  static async broadcastConvoy(convoyId) {
    return true;
  }
}

// Otomatik başlat
DiscordBotService.init().catch(console.error);

export default DiscordBotService;

