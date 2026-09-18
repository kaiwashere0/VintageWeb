import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import DatabaseService from '../../database/index.js';
import { CHANNEL_DEFINITIONS } from '../channelManager.js';
import EmojiResolver from '../emojiResolver.js';

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName('kurulum')
    .setDescription('Vintage Web Platform setup, channel manager & log system controller')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    // 1. Immediately defer reply to prevent 3-second Discord interaction timeout
    await interaction.deferReply().catch(() => null);

    // Administrator check
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      const errorContent = [
        `## ${EmojiResolver.NO} Access Denied: Administrator Required`,
        `> *Erişim Reddedildi: Yönetici Yetkisi Gerekir*`,
        '',
        `>>> **You do not have permission to execute the system setup command.**`,
        `*Sistem kurulum komutunu çalıştırmak için yetkiniz bulunmamaktadır.*`
      ].join('\n');

      return interaction.editReply({ content: errorContent, components: [] });
    }

    let botSettings = {};
    try {
      botSettings = await DatabaseService.getBotSettings();
    } catch (dbErr) {
      botSettings = {};
    }
    const configuredChannels = botSettings.channels || {};
    const configuredCount = Object.values(configuredChannels).filter(Boolean).length;
    const nowTs = Math.floor(Date.now() / 1000);

    // Build Setup Hub Message Directly
    const mainContent = [
      `## ${EmojiResolver.STATS} Vintage Web Platform — System Control Hub`,
      `> *Vintage Web Platformu — Sistem Kontrol Merkezi*`,
      '',
      `>>> **Autonomous Channel Manager & Granular Telemetry Engine for Vintage Club.**`,
      `*Vintage Club için Otonom Kanal Yöneticisi ve Detaylı Telemetri Motoru.*`,
      '',
      '```ansi',
      `\u001b[1;36m[ENGINE]\u001b[0m Vintage Web 2026 Platform Controller`,
      `\u001b[0;32m[STATUS]\u001b[0m Active • Guild: ${interaction.guild.name}`,
      `\u001b[0;${configuredCount === CHANNEL_DEFINITIONS.length ? '32' : '33'}m[CHANNELS]\u001b[0m Configured: ${configuredCount} / ${CHANNEL_DEFINITIONS.length} Dedicated Streams`,
      `\u001b[0;35m[VOICE 24/7]\u001b[0m ${botSettings.voiceChannel?.enabled ? 'ENABLED' : 'DISABLED'} • Status: ${botSettings.onlineStatus?.toUpperCase() || 'ONLINE'}`,
      '```',
      '',
      `### Parameters & State / Parametreler ve Durum`,
      `*-# Live payload properties and contextual variables.*`,
      '',
      `\`├─\` **Auto-Install** *(Otomatik Kurulum)*: \`Creates category & 14 vweb-* channels\``,
      `\`├─\` **Self-Repair** *(Otomatik Tamir)*: \`Detects and restores missing channels\``,
      `\`├─\` **Recreate** *(Yeniden Kurulum)*: \`Cleans up and rebuilds fresh channels\``,
      `\`└─\` **Purge / Delete** *(Kanalları Temizle)*: \`Safely removes system channels & resets DB\``,
      '',
      `- Actor: **${interaction.user.tag}** • Time: <t:${nowTs}:R> • ID: \`setup_console\``
    ].join('\n');

    // Select Menu Row
    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_select_action')
        .setPlaceholder('Choose a setup or management task / Bir görev seçin...')
        .addOptions([
          {
            label: 'Auto-Create All Channels / Tüm Kanalları Kur',
            description: 'Creates dedicated category & 14 distinct vweb-* channels',
            value: 'action_create_all'
          },
          {
            label: 'Repair & Sync Channels / Kanalları Tamir Et',
            description: 'Scans and restores missing or deleted channels',
            value: 'action_repair'
          },
          {
            label: 'Recreate Channels / Baştan Yeniden Kur',
            description: 'Deletes existing channels and rebuilds clean setup',
            value: 'action_recreate'
          },
          {
            label: 'View Channel Map / Kanal Haritasını Gör',
            description: 'Lists all 14 vweb-* channels with their current status',
            value: 'action_view_map'
          },
          {
            label: 'Delete All Channels / Tüm Kanalları Sil',
            description: 'Deletes all created vweb-* channels and resets database',
            value: 'action_delete_all'
          }
        ])
    );

    // Quick Button Action Row
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_setup_quick_create')
        .setLabel('Install All / Hepsini Kur')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('btn_setup_repair')
        .setLabel('Repair / Tamir Et')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_setup_view_map')
        .setLabel('Channel Map / Kanal Haritası')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_setup_delete')
        .setLabel('Delete Channels / Kanalları Sil')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      content: mainContent,
      components: [selectRow, buttonRow]
    });
  }
};

export default setupCommand;
