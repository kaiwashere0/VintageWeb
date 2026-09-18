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
    .setDescription('Vintage Web Platformu log kanalları ve sistem yöneticisi paneli')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    // 1. Yanıt süresini aşmamak için hemen deferReply çağır
    await interaction.deferReply().catch(() => null);

    // Yetki kontrolü
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      const errorContent = [
        `## ${EmojiResolver.NO} Yetkisiz Erişim`,
        `> Bu komutu kullanabilmek için **Yönetici (Administrator)** yetkisine sahip olmanız gerekmektedir.`
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

    // Temiz ve Sade Türkçe Ana Mesaj
    const mainContent = [
      `## ${EmojiResolver.STATS} Vintage Web Platformu — Sistem Kurulum Paneli`,
      `> *Web sitesinin tüm işlemlerini Discord log kanallarına bağlayın ve yönetin.*`,
      '',
      '```ansi',
      `\u001b[1;36m[SİSTEM]\u001b[0m Vintage Web 2026 Motoru Aktif`,
      `\u001b[0;32m[SUNUCU]\u001b[0m ${interaction.guild.name}`,
      `\u001b[0;${configuredCount === CHANNEL_DEFINITIONS.length ? '32' : '33'}m[KANALLAR]\u001b[0m ${configuredCount} / ${CHANNEL_DEFINITIONS.length} Özel Log Kanalı Bağlı`,
      `\u001b[0;35m[GİZLİLİK]\u001b[0m @everyone için Tamamen Kapalı (Özel)`,
      '```',
      '',
      `### 📋 Kullanılabilir İşlemler`,
      `\`├─\` **Tümünü Kur**: Kategori ve 14 adet özel log kanalını otomatik açar.`,
      `\`├─\` **Kanalları Tamir Et**: Silinmiş veya eksik kanalları onarıp bağlar.`,
      `\`├─\` **Sıfırdan Yeniden Kur**: Kanalları temizleyip baştan oluşturur.`,
      `\`├─\` **Kanal Haritası**: Hangi logun hangi kanala gittiğini gösterir.`,
      `\`└─\` **Kanalları Sil**: Tüm sistem log kanallarını ve kategoriyi kaldırır.`,
      '',
      `- Yetkili: **${interaction.user.tag}** • <t:${nowTs}:R>`
    ].join('\n');

    // Seçim Menüsü
    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_select_action')
        .setPlaceholder('Yapmak istediğiniz işlemi seçin...')
        .addOptions([
          {
            label: 'Tüm Log Kanallarını Kur',
            description: '14 adet özel vweb-* log kanalını ve kategorisini açar',
            value: 'action_create_all'
          },
          {
            label: 'Kanalları Kontrol Et ve Tamir Et',
            description: 'Eksik veya silinmiş log kanallarını tespit edip onarır',
            value: 'action_repair'
          },
          {
            label: 'Sıfırdan Yeniden Kurulum Yap',
            description: 'Mevcut kanalları silip sıfırdan temiz kurulum yapar',
            value: 'action_recreate'
          },
          {
            label: 'Kanal Haritasını ve Durumu Gör',
            description: '14 log kanalının aktif bağlantı durumunu listeler',
            value: 'action_view_map'
          },
          {
            label: 'Tüm Log Kanallarını Sil',
            description: 'Oluşturulmuş log kanallarını ve kategorisini güvenle siler',
            value: 'action_delete_all'
          }
        ])
    );

    // Hızlı Eylem Butonları
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_setup_quick_create')
        .setLabel('Tümünü Kur')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('btn_setup_repair')
        .setLabel('Tamir Et')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_setup_view_map')
        .setLabel('Kanal Haritası')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_setup_delete')
        .setLabel('Kanalları Sil')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      content: mainContent,
      components: [selectRow, buttonRow]
    });
  }
};

export default setupCommand;
