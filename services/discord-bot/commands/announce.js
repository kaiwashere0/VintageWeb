import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import MarkdownBuilder from '../markdownBuilder.js';
import EmojiResolver from '../emojiResolver.js';

export const announceCommand = {
  data: new SlashCommandBuilder()
    .setName('duyuru')
    .setDescription('Publish a structured bilingual announcement with modern section layout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName('title_en')
        .setDescription('Announcement Title (English) / Duyuru Başlığı (İngilizce)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('title_tr')
        .setDescription('Announcement Title (Turkish) / Duyuru Başlığı (Türkçe)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('content_en')
        .setDescription('Announcement Content (English) / Duyuru İçeriği (İngilizce)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('content_tr')
        .setDescription('Announcement Content (Turkish) / Duyuru İçeriği (Türkçe)')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('target_channel')
        .setDescription('Target Discord Channel / Gönderilecek Kanal')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .setDMPermission(false),

  async execute(interaction) {
    const titleEn = interaction.options.getString('title_en');
    const titleTr = interaction.options.getString('title_tr');
    const contentEn = interaction.options.getString('content_en');
    const contentTr = interaction.options.getString('content_tr');
    const targetChannel = interaction.options.getChannel('target_channel') || interaction.channel;

    const messageContent = [
      MarkdownBuilder.header(titleEn, titleTr, 'yes'),
      '',
      `>>> **${contentEn}**`,
      `*${contentTr}*`,
      '',
      MarkdownBuilder.ansiBlock([
        MarkdownBuilder.ansi(`[OFFICIAL ANNOUNCEMENT] Vintage Club Management`, '35', true),
        MarkdownBuilder.ansi(`[PUBLISHED BY] ${interaction.user.tag}`, '36'),
        MarkdownBuilder.ansi(`[DATE] ${new Date().toUTCString()}`, '37')
      ]),
      MarkdownBuilder.metaFooter({ user: interaction.user.tag, time: new Date() })
    ].join('\n');

    await targetChannel.send({ content: messageContent });

    await interaction.reply({
      content: [
        MarkdownBuilder.header('Announcement Published Successfully', 'Duyuru Başarıyla Yayınlandı', 'yes'),
        MarkdownBuilder.bilingual(
          `Announcement sent to ${targetChannel}.`,
          `Duyuru ${targetChannel} kanalına iletildi.`
        )
      ].join('\n'),
      ephemeral: true
    });
  }
};

export default announceCommand;
