import { SlashCommandBuilder } from 'discord.js';
import TruckersMPService from '../../truckersmp/index.js';
import EmojiResolver from '../emojiResolver.js';

export const driverCommand = {
  data: new SlashCommandBuilder()
    .setName('surucu-ara')
    .setDescription('Look up a TruckersMP player profile and active ban history')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('TruckersMP ID or SteamID64 / TruckersMP ID veya SteamID64')
        .setRequired(true)
    )
    .setDMPermission(false),

  async execute(interaction) {
    const targetId = interaction.options.getString('id');
    await interaction.deferReply().catch(() => null);

    const [playerRes, bansRes] = await Promise.all([
      TruckersMPService.getPlayer(targetId),
      TruckersMPService.getBans(targetId)
    ]);

    if (playerRes.error || !playerRes.response) {
      const notFoundContent = [
        `## ${EmojiResolver.NO} Driver Lookup Failed: #${targetId}`,
        `> *Sürücü Sorgusu Başarısız: #${targetId}*`,
        '',
        `>>> **No TruckersMP account found matching identifier \`${targetId}\`.**`,
        `*\`${targetId}\` kimliğiyle eşleşen TruckersMP hesabı bulunamadı.*`,
        '',
        `- Searched by: **${interaction.user.tag}** • Time: <t:${Math.floor(Date.now() / 1000)}:R>`
      ].join('\n');

      return interaction.editReply({ content: notFoundContent, components: [] });
    }

    const p = playerRes.response;
    const bans = (bansRes && !bansRes.error && Array.isArray(bansRes.response)) ? bansRes.response : [];
    const activeBans = bans.filter(b => b.active);

    const isBanned = activeBans.length > 0;
    const banStatusStr = isBanned ? `BANNED (${activeBans.length} Active)` : 'CLEAN (0 Active Bans)';
    const emojiStr = isBanned ? EmojiResolver.NO : EmojiResolver.YES;
    const nowTs = Math.floor(Date.now() / 1000);

    const driverContent = [
      `## ${emojiStr} TruckersMP Driver Profile: ${p.name}`,
      `> *TruckersMP Sürücü Profili: ${p.name}*`,
      '',
      `>>> **Verified TruckersMP Simulation Profile.**`,
      `*Doğrulanmış TruckersMP Simülasyon Profili.*`,
      '',
      '```ansi',
      `\u001b[1;36m[DRIVER]\u001b[0m ${p.name} (TMP ID: #${p.id})`,
      `\u001b[0;${isBanned ? '31' : '32'}m[STATUS]\u001b[0m Ban Record: ${banStatusStr}`,
      `\u001b[0;37m[STEAM ID]\u001b[0m ${p.steamID64 || 'N/A'}`,
      `\u001b[0;33m[VTC]\u001b[0m ${p.vtc?.name ? `${p.vtc.name} (Role: ${p.vtc.role || 'Member'})` : 'None / Bağımsız Sürücü'}`,
      `\u001b[0;37m[JOIN DATE]\u001b[0m ${p.joinDate || 'N/A'}`,
      '```',
      '',
      `### Driver Details / Sürücü Detayları`,
      `\`├─\` **TruckersMP Profile** *(TMP Profili)*: \`https://truckersmp.com/user/${p.id}\``,
      `\`├─\` **Steam Community** *(Steam Sayfası)*: \`${p.steamID64 ? `https://steamcommunity.com/profiles/${p.steamID64}` : 'N/A'}\``,
      `\`├─\` **Total Bans Recorded** *(Toplam Ban Sayısı)*: \`${bans.length} Bans Recorded\``,
      `\`└─\` **Group / Role** *(Grup / Rol)*: \`${p.groupName || 'Player'}\``,
      '',
      `- Requested by: **${interaction.user.tag}** • Time: <t:${nowTs}:F> (<t:${nowTs}:R>)`
    ].join('\n');

    await interaction.editReply({ content: driverContent, components: [] });
  }
};

export default driverCommand;
