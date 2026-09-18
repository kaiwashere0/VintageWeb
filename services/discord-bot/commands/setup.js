import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import DatabaseService from '../../database/index.js';
import ChannelManager, { CHANNEL_DEFINITIONS } from '../channelManager.js';
import MarkdownBuilder from '../markdownBuilder.js';
import EmojiResolver from '../emojiResolver.js';

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName('kurulum')
    .setDescription('Vintage Web Platform setup, channel manager & log system controller')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    // Administrator check
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: [
          MarkdownBuilder.header('Access Denied: Administrator Required', 'Erişim Reddedildi: Yönetici Yetkisi Gerekir', 'no'),
          MarkdownBuilder.bilingual(
            'You do not have permission to execute the system setup command.',
            'Sistem kurulum komutunu çalıştırmak için yetkiniz bulunmamaktadır.'
          )
        ].join('\n'),
        ephemeral: true
      });
    }

    const botSettings = await DatabaseService.getBotSettings();
    const configuredChannels = botSettings.channels || {};
    const configuredCount = Object.values(configuredChannels).filter(Boolean).length;

    // Build main setup panel message
    const lines = [
      MarkdownBuilder.header('Vintage Web Platform — System Control Hub', 'Vintage Web Platformu — Sistem Kontrol Merkezi', 'stats'),
      '',
      `>>> **Autonomous Channel Manager & Granular Telemetry Engine**`,
      `*Otonom Kanal Yöneticisi ve Detaylı Telemetri Motoru*`,
      '',
      MarkdownBuilder.ansiBlock([
        MarkdownBuilder.ansi(`[ENGINE] Vintage Web 2026 Platform Controller`, '36', true),
        MarkdownBuilder.ansi(`[STATUS] Active • Guild: ${interaction.guild.name}`, '32'),
        MarkdownBuilder.ansi(`[CHANNELS] Configured: ${configuredCount} / ${CHANNEL_DEFINITIONS.length} Dedicated Streams`, configuredCount === CHANNEL_DEFINITIONS.length ? '32' : '33'),
        MarkdownBuilder.ansi(`[VOICE 24/7] ${botSettings.voiceChannel?.enabled ? 'ENABLED' : 'DISABLED'} • Status: ${botSettings.onlineStatus?.toUpperCase() || 'ONLINE'}`, '35')
      ]),
      '',
      `### Select an Operation / Bir İşlem Seçin`,
      `*-# Use the menu or quick action buttons below to manage your dedicated vweb-* log channels.*`,
      '',
      MarkdownBuilder.tree([
        { enKey: 'Auto-Install', trKey: 'Otomatik Kurulum', val: 'Creates category & 14 vweb-* channels' },
        { enKey: 'Self-Repair', trKey: 'Otomatik Tamir', val: 'Detects and restores missing channels' },
        { enKey: 'Recreate', trKey: 'Yeniden Kurulum', val: 'Cleans up and rebuilds fresh channels' },
        { enKey: 'Purge / Delete', trKey: 'Kanalları Temizle', val: 'Safely removes system channels & resets DB' }
      ]),
      '',
      MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date(), reqId: 'setup_panel' })
    ];

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

    await interaction.reply({
      content: lines.join('\n'),
      components: [selectRow, buttonRow],
      ephemeral: false
    });
  }
};

export default setupCommand;
