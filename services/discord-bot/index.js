import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import DatabaseService from '../database/index.js';

export class DiscordBotService {
  static isInitialized = false;
  static client = null;
  static botSettings = null;
  static currentStatusIndex = 0;
  static presenceTimer = null;

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
          GatewayIntentBits.GuildMessages
        ]
      });

      this.client.once('ready', async (c) => {
        console.log(`\x1b[32m✔\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Bot başarıyla bağlandı: \x1b[36m${c.user.tag}\x1b[0m`);
        // Start Presence & Streaming Loop from Database
        await this.startPresenceLoop();
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

