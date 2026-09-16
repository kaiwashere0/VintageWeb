import { Client, GatewayIntentBits } from 'discord.js';

export class DiscordBotService {
  static isInitialized = false;
  static client = null;

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

      this.client.once('ready', (c) => {
        console.log(`\x1b[32m✔\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Bot başarıyla bağlandı: \x1b[36m${c.user.tag}\x1b[0m (Bekleme Modunda)`);
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

  // Webhook ve aktif işlemler şu anlık devre dışı bırakıldı
  static async notifyNewApplication(application) {
    // Webhook bağlantısı şu anlık kapalıdır.
    return true;
  }

  static async broadcastConvoy(convoyId) {
    // İşlev şu anlık kapalıdır.
    return true;
  }
}

// Otomatik başlat
DiscordBotService.init().catch(console.error);

export default DiscordBotService;

