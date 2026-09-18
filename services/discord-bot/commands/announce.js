import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import EmojiResolver from '../emojiResolver.js';

export const announceCommand = {
  data: new SlashCommandBuilder()
    .setName('duyuru')
    .setDescription('Publish a structured bilingual announcement with Discord Container layout')
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
    await interaction.deferReply({ ephemeral: true }).catch(() => null);

    const titleEn = interaction.options.getString('title_en');
    const titleTr = interaction.options.getString('title_tr');
    const contentEn = interaction.options.getString('content_en');
    const contentTr = interaction.options.getString('content_tr');
    const targetChannel = interaction.options.getChannel('target_channel') || interaction.channel;
    const nowTs = Math.floor(Date.now() / 1000);

    const announceContent = [
      `## ${EmojiResolver.YES} ${titleEn}`,
      `> *${titleTr}*`,
      '',
      `>>> **${contentEn}**`,
      `*${contentTr}*`,
      '',
      '```ansi',
      `\u001b[1;35m[OFFICIAL ANNOUNCEMENT]\u001b[0m Vintage Club Management`,
      `\u001b[0;36m[PUBLISHED BY]\u001b[0m ${interaction.user.tag}`,
      `\u001b[0;37m[DATE]\u001b[0m ${new Date().toUTCString()}`,
      '```',
      '',
      `- Published by: **${interaction.user.tag}** • Time: <t:${nowTs}:F> (<t:${nowTs}:R>)`
    ].join('\n');

    await targetChannel.send({ content: announceContent });

    const confirmationContent = [
      `## ${EmojiResolver.YES} Announcement Published Successfully`,
      `> *Duyuru Başarıyla Yayınlandı*`,
      '',
      `>>> **Announcement broadcasted to ${targetChannel}.**`,
      `*Duyuru ${targetChannel} kanalına başarıyla iletildi.*`
    ].join('\n');

    await interaction.editReply({ content: confirmationContent, components: [] });
  }
};

export default announceCommand;
