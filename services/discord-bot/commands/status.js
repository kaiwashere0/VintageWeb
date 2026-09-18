import { SlashCommandBuilder } from 'discord.js';
import DatabaseService from '../../database/index.js';
import TelemetryService from '../../telemetry/index.js';
import EmojiResolver from '../emojiResolver.js';

export const statusCommand = {
  data: new SlashCommandBuilder()
    .setName('durum')
    .setDescription('Displays live Vintage Web platform telemetry, microservices and voice status')
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply().catch(() => null);

    const [microservices, telemetryData, botSettings] = await Promise.all([
      TelemetryService.getMicroservicesStatus(),
      TelemetryService.getTelemetryData({ timeRange: '1h' }),
      DatabaseService.getBotSettings()
    ]);

    const uptimeMinutes = Math.floor(process.uptime() / 60);
    const dbStatus = microservices.database?.status === 'healthy' ? 'ONLINE' : 'DEGRADED';
    const tmpLatency = microservices.truckersmp?.latencyMs >= 0 ? `${microservices.truckersmp.latencyMs}ms` : 'TIMEOUT';
    const nowTs = Math.floor(Date.now() / 1000);

    const content = [
      `## ${EmojiResolver.STATS} Vintage Platform — Live Telemetry & System Status`,
      `> *Vintage Platformu — Canlı Telemetri ve Sistem Durumu*`,
      '',
      `>>> **Autonomous Health Monitoring & Performance Stream.**`,
      `*Otonom Sistem Sağlığı ve Performans Akışı.*`,
      '',
      '```ansi',
      `\u001b[1;36m[SYSTEM]\u001b[0m Node.js ${process.version} • Uptime: ${uptimeMinutes} mins`,
      `\u001b[0;${dbStatus === 'ONLINE' ? '32' : '31'}m[DATABASE]\u001b[0m MongoDB: ${dbStatus} • Ping: ${microservices.database?.latencyMs || 0}ms`,
      `\u001b[0;${microservices.truckersmp?.status === 'healthy' ? '32' : '33'}m[TRUCKERSMP API]\u001b[0m Status: ${microservices.truckersmp?.status?.toUpperCase()} • Latency: ${tmpLatency}`,
      `\u001b[0;35m[DISCORD BOT]\u001b[0m Ping: ${interaction.client.ws.ping}ms • Presence: ${botSettings.statusType} (${botSettings.statusMode})`,
      `\u001b[0;37m[HTTP TELEMETRY]\u001b[0m 1h Requests: ${telemetryData.overview.totalRequests} • Avg Latency: ${telemetryData.overview.avgLatencyMs}ms`,
      '```',
      '',
      `### Microservices & Components / Mikroservisler ve Bileşenler`,
      `\`├─\` **MongoDB Core** *(Veritabanı)*: \`${dbStatus} (${microservices.database?.collectionsCount || 0} Collections)\``,
      `\`├─\` **TruckersMP REST v2** *(TMP Servisi)*: \`${microservices.truckersmp?.status?.toUpperCase()} (${tmpLatency})\``,
      `\`├─\` **Voice 24/7 Gateway** *(Ses Modülü)*: \`${botSettings.voiceChannel?.enabled ? `Connected (${botSettings.voiceChannel.channelId})` : 'Disabled'}\``,
      `\`└─\` **HTTP Error Buffer** *(Hata Sayacı)*: \`${telemetryData.overview.totalErrors} Errors (1h)\``,
      '',
      `- Requested by: **${interaction.user.tag}** • Time: <t:${nowTs}:F> (<t:${nowTs}:R>)`
    ].join('\n');

    await interaction.editReply({ content, components: [] });
  }
};

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName('istatistik')
    .setDescription('Displays Vintage Club VTC roster, convoys and fleet statistics')
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply().catch(() => null);

    const settings = await DatabaseService.getSettings();
    const members = await DatabaseService.getMembers();
    const events = await DatabaseService.getEvents();

    const totalMembers = members.length || settings.stats?.totalMembers || 48;
    const totalConvoys = settings.stats?.totalConvoys || 135;
    const totalKm = settings.stats?.totalKilometers || '1,240,500+';
    const nowTs = Math.floor(Date.now() / 1000);

    const content = [
      `## ${EmojiResolver.STATS} ${settings.vtcName} — Official Fleet Statistics`,
      `> *${settings.vtcName} — Resmi Filo İstatistikleri*`,
      '',
      `>>> **${settings.motto || 'Nobility on the Roads, Power in the Convoy'}**`,
      `*Yollarda Asalet, Konvoyda Güç*`,
      '',
      '```ansi',
      `\u001b[1;36m[VTC]\u001b[0m ${settings.vtcName} (TMP ID: #${settings.truckersMpVtcId || '80136'})`,
      `\u001b[0;33m[FOUNDER]\u001b[0m ${settings.founder || 'nasriemir.'} • Est. ${settings.establishedYear || 2024}`,
      `\u001b[0;32m[MEMBERS]\u001b[0m Active Drivers: ${totalMembers} Verified Drivers`,
      `\u001b[0;35m[CONVOYS]\u001b[0m Total Driven: ${totalConvoys} • Total Mileage: ${totalKm}`,
      `\u001b[0;37m[EVENTS]\u001b[0m Upcoming Convoys: ${events.length} Scheduled`,
      '```',
      '',
      `### Official Links / Resmi Bağlantılar`,
      `\`├─\` **TruckersMP VTC Profile** *(TMP Sayfası)*: \`${settings.truckersMpUrl || 'https://truckersmp.com/vtc/80136'}\``,
      `\`├─\` **Official Discord** *(Discord Sunucusu)*: \`${settings.discordInviteUrl || 'https://discord.gg/vintageclub'}\``,
      `\`└─\` **Web Portal** *(Web Sitesi)*: \`https://vintageclub.com\``,
      '',
      `- Requested by: **${interaction.user.tag}** • Time: <t:${nowTs}:F> (<t:${nowTs}:R>)`
    ].join('\n');

    await interaction.editReply({ content, components: [] });
  }
};

export default { statusCommand, statsCommand };
