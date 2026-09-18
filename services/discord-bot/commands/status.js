import { SlashCommandBuilder } from 'discord.js';
import DatabaseService from '../../database/index.js';
import TelemetryService from '../../telemetry/index.js';
import MarkdownBuilder from '../markdownBuilder.js';
import EmojiResolver from '../emojiResolver.js';

export const statusCommand = {
  data: new SlashCommandBuilder()
    .setName('durum')
    .setDescription('Displays live Vintage Web platform telemetry, microservices and voice status')
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply();

    const [microservices, telemetryData, botSettings] = await Promise.all([
      TelemetryService.getMicroservicesStatus(),
      TelemetryService.getTelemetryData({ timeRange: '1h' }),
      DatabaseService.getBotSettings()
    ]);

    const uptimeMinutes = Math.floor(process.uptime() / 60);
    const dbStatus = microservices.database?.status === 'healthy' ? 'ONLINE' : 'DEGRADED';
    const tmpLatency = microservices.truckersmp?.latencyMs >= 0 ? `${microservices.truckersmp.latencyMs}ms` : 'TIMEOUT';

    const lines = [
      MarkdownBuilder.header('Vintage Platform — Live Telemetry & System Status', 'Vintage Platformu — Canlı Telemetri ve Sistem Durumu', 'stats'),
      '',
      `>>> **Autonomous Health Monitoring & Performance Stream**`,
      `*Otonom Sistem Sağlığı ve Performans Akışı*`,
      '',
      MarkdownBuilder.ansiBlock([
        MarkdownBuilder.ansi(`[SYSTEM] Node.js ${process.version} • Uptime: ${uptimeMinutes} mins`, '36', true),
        MarkdownBuilder.ansi(`[DATABASE] MongoDB: ${dbStatus} • Ping: ${microservices.database?.latencyMs || 0}ms`, dbStatus === 'ONLINE' ? '32' : '31'),
        MarkdownBuilder.ansi(`[TRUCKERSMP API] Status: ${microservices.truckersmp?.status?.toUpperCase()} • Latency: ${tmpLatency}`, microservices.truckersmp?.status === 'healthy' ? '32' : '33'),
        MarkdownBuilder.ansi(`[DISCORD BOT] Ping: ${interaction.client.ws.ping}ms • Presence: ${botSettings.statusType} (${botSettings.statusMode})`, '35'),
        MarkdownBuilder.ansi(`[HTTP TELEMETRY] 1h Requests: ${telemetryData.overview.totalRequests} • Avg Latency: ${telemetryData.overview.avgLatencyMs}ms`, '37')
      ]),
      '',
      `### Microservices Breakdown / Mikroservis Dağılımı`,
      `*-# Real-time state of internal API gateways and database connectors.*`,
      '',
      MarkdownBuilder.tree([
        { enKey: 'MongoDB Core', trKey: 'Veritabanı', val: `${dbStatus} (${microservices.database?.collectionsCount || 0} Collections)` },
        { enKey: 'TruckersMP REST v2', trKey: 'TMP Servisi', val: `${microservices.truckersmp?.status?.toUpperCase()} (${tmpLatency})` },
        { enKey: 'Voice 24/7 Gateway', trKey: 'Ses Modülü', val: botSettings.voiceChannel?.enabled ? `Connected (${botSettings.voiceChannel.channelId})` : 'Disabled' },
        { enKey: 'HTTP Error Buffer', trKey: 'Hata Sayacı', val: `${telemetryData.overview.totalErrors} Errors (1h)` }
      ]),
      '',
      MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
    ];

    await interaction.editReply({ content: lines.join('\n') });
  }
};

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName('istatistik')
    .setDescription('Displays Vintage Club VTC roster, convoys and fleet statistics')
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply();

    const settings = await DatabaseService.getSettings();
    const members = await DatabaseService.getMembers();
    const events = await DatabaseService.getEvents();

    const totalMembers = members.length || settings.stats?.totalMembers || 48;
    const totalConvoys = settings.stats?.totalConvoys || 135;
    const totalKm = settings.stats?.totalKilometers || '1,240,500+';

    const lines = [
      MarkdownBuilder.header(`${settings.vtcName} — Official Fleet Statistics`, `${settings.vtcName} — Resmi Filo İstatistikleri`, 'stats'),
      '',
      `>>> **${settings.motto || 'Nobility on the Roads, Power in the Convoy'}**`,
      `*Yollarda Asalet, Konvoyda Güç*`,
      '',
      MarkdownBuilder.ansiBlock([
        MarkdownBuilder.ansi(`[VTC] ${settings.vtcName} (TMP ID: #${settings.truckersMpVtcId || '80136'})`, '36', true),
        MarkdownBuilder.ansi(`[FOUNDER] ${settings.founder || 'nasriemir.'} • Est. ${settings.establishedYear || 2024}`, '33'),
        MarkdownBuilder.ansi(`[MEMBERS] Active Drivers: ${totalMembers} Verified Drivers`, '32'),
        MarkdownBuilder.ansi(`[CONVOYS] Total Driven: ${totalConvoys} • Total Mileage: ${totalKm}`, '35'),
        MarkdownBuilder.ansi(`[EVENTS] Upcoming Convoys: ${events.length} Scheduled`, '37')
      ]),
      '',
      `### Community Links / Topluluk Bağlantıları`,
      `*-# Official channels and simulation profiles.*`,
      '',
      MarkdownBuilder.tree([
        { enKey: 'TruckersMP VTC Profile', trKey: 'TMP Sayfası', val: settings.truckersMpUrl || 'https://truckersmp.com/vtc/80136' },
        { enKey: 'Official Discord', trKey: 'Discord Sunucusu', val: settings.discordInviteUrl || 'https://discord.gg/vintageclub' },
        { enKey: 'Web Portal', trKey: 'Web Sitesi', val: 'https://vintageclub.com' }
      ]),
      '',
      MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
    ];

    await interaction.editReply({ content: lines.join('\n') });
  }
};

export default { statusCommand, statsCommand };
