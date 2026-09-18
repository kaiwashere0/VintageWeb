import { SlashCommandBuilder } from 'discord.js';
import TruckersMPService from '../../truckersmp/index.js';
import MarkdownBuilder from '../markdownBuilder.js';
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
    await interaction.deferReply();

    const [playerRes, bansRes] = await Promise.all([
      TruckersMPService.getPlayer(targetId),
      TruckersMPService.getBans(targetId)
    ]);

    if (playerRes.error || !playerRes.response) {
      return interaction.editReply({
        content: [
          MarkdownBuilder.header(`Driver Lookup Failed: #${targetId}`, `Sürücü Sorgusu Başarısız: #${targetId}`, 'no'),
          MarkdownBuilder.bilingual(
            `No TruckersMP account found matching identifier \`${targetId}\`.`,
            `\`${targetId}\` kimliğiyle eşleşen TruckersMP hesabı bulunamadı.`
          ),
          MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
        ].join('\n')
      });
    }

    const p = playerRes.response;
    const bans = (bansRes && !bansRes.error && Array.isArray(bansRes.response)) ? bansRes.response : [];
    const activeBans = bans.filter(b => b.active);

    const isBanned = activeBans.length > 0;
    const banStatusStr = isBanned ? `BANNED (${activeBans.length} Active)` : 'CLEAN (0 Active Bans)';

    const lines = [
      MarkdownBuilder.header(`TruckersMP Driver Profile: ${p.name}`, `TruckersMP Sürücü Profili: ${p.name}`, isBanned ? 'no' : 'yes'),
      '',
      `>>> **Verified TruckersMP Simulation Profile**`,
      `*Doğrulanmış TruckersMP Simülasyon Profili*`,
      '',
      MarkdownBuilder.ansiBlock([
        MarkdownBuilder.ansi(`[DRIVER] ${p.name} (TMP ID: #${p.id})`, '36', true),
        MarkdownBuilder.ansi(`[STATUS] Ban Record: ${banStatusStr}`, isBanned ? '31' : '32', true),
        MarkdownBuilder.ansi(`[STEAM ID] ${p.steamID64 || 'N/A'}`, '37'),
        MarkdownBuilder.ansi(`[VTC] ${p.vtc?.name ? `${p.vtc.name} (Role: ${p.vtc.role || 'Member'})` : 'None / Bağımsız Sürücü'}`, '33'),
        MarkdownBuilder.ansi(`[JOIN DATE] ${p.joinDate || 'N/A'}`, '37')
      ]),
      '',
      `### Driver Details / Sürücü Detayları`,
      `*-# Official TruckersMP community records.*`,
      '',
      MarkdownBuilder.tree([
        { enKey: 'TruckersMP Profile', trKey: 'TMP Profili', val: `https://truckersmp.com/user/${p.id}` },
        { enKey: 'Steam Community', trKey: 'Steam Sayfası', val: p.steamID64 ? `https://steamcommunity.com/profiles/${p.steamID64}` : 'N/A' },
        { enKey: 'Total Bans Recorded', trKey: 'Toplam Ban Sayısı', val: `${bans.length} Bans Recorded` },
        { enKey: 'Group / Role', trKey: 'Grup / Rol', val: p.groupName || 'Player' }
      ]),
      '',
      MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
    ];

    await interaction.editReply({ content: lines.join('\n') });
  }
};

export default driverCommand;
