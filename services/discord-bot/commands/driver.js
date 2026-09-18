import { SlashCommandBuilder } from 'discord.js';
import TruckersMPService from '../../truckersmp/index.js';
import VintageContainerBuilder, { VINTAGE_COLORS } from '../containerBuilder.js';

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
      const notFoundContainer = VintageContainerBuilder.buildBilingualContainer({
        enTitle: `Driver Lookup Failed: #${targetId}`,
        trTitle: `Sürücü Sorgusu Başarısız: #${targetId}`,
        enDesc: `No TruckersMP account found matching identifier \`${targetId}\`.`,
        trDesc: `\`${targetId}\` kimliğiyle eşleşen TruckersMP hesabı bulunamadı.`,
        emojiKey: 'no',
        accentColor: VINTAGE_COLORS.ERROR,
        meta: { user: interaction.user.tag, time: new Date() }
      });
      return interaction.editReply(notFoundContainer);
    }

    const p = playerRes.response;
    const bans = (bansRes && !bansRes.error && Array.isArray(bansRes.response)) ? bansRes.response : [];
    const activeBans = bans.filter(b => b.active);

    const isBanned = activeBans.length > 0;
    const banStatusStr = isBanned ? `BANNED (${activeBans.length} Active)` : 'CLEAN (0 Active Bans)';

    const driverContainer = VintageContainerBuilder.buildBilingualContainer({
      enTitle: `TruckersMP Driver Profile: ${p.name}`,
      trTitle: `TruckersMP Sürücü Profili: ${p.name}`,
      enDesc: 'Verified TruckersMP Simulation Profile.',
      trDesc: 'Doğrulanmış TruckersMP Simülasyon Profili.',
      emojiKey: isBanned ? 'no' : 'yes',
      accentColor: isBanned ? VINTAGE_COLORS.ERROR : VINTAGE_COLORS.INFO,
      ansiLines: [
        `\u001b[1;36m[DRIVER]\u001b[0m ${p.name} (TMP ID: #${p.id})`,
        `\u001b[0;${isBanned ? '31' : '32'}m[STATUS]\u001b[0m Ban Record: ${banStatusStr}`,
        `\u001b[0;37m[STEAM ID]\u001b[0m ${p.steamID64 || 'N/A'}`,
        `\u001b[0;33m[VTC]\u001b[0m ${p.vtc?.name ? `${p.vtc.name} (Role: ${p.vtc.role || 'Member'})` : 'None / Bağımsız Sürücü'}`,
        `\u001b[0;37m[JOIN DATE]\u001b[0m ${p.joinDate || 'N/A'}`
      ],
      treeItems: [
        { enKey: 'TruckersMP Profile', trKey: 'TMP Profili', val: `https://truckersmp.com/user/${p.id}` },
        { enKey: 'Steam Community', trKey: 'Steam Sayfası', val: p.steamID64 ? `https://steamcommunity.com/profiles/${p.steamID64}` : 'N/A' },
        { enKey: 'Total Bans Recorded', trKey: 'Toplam Ban Sayısı', val: `${bans.length} Bans Recorded` },
        { enKey: 'Group / Role', trKey: 'Grup / Rol', val: p.groupName || 'Player' }
      ],
      meta: { user: interaction.user.tag, time: new Date() }
    });

    await interaction.editReply(driverContainer);
  }
};

export default driverCommand;
