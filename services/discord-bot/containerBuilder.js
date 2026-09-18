import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags
} from 'discord.js';
import EmojiResolver from './emojiResolver.js';
import MarkdownBuilder from './markdownBuilder.js';

export const VINTAGE_COLORS = {
  GOLD: 0x8C5137,
  PRIMARY: 0x5865F2,
  SUCCESS: 0x2ECC71,
  ERROR: 0xE74C3C,
  WARNING: 0xF1C40F,
  INFO: 0x3498DB,
  PURPLE: 0x9B59B6,
  DARK: 0x1E1F22
};

/**
 * Discord Components V2 Container & Section Builder for Vintage Web
 * Based on ZarScape/discord.js-v2-components standard
 */
export class VintageContainerBuilder {
  /**
   * Builds a native Discord Components V2 Container payload
   * 
   * @param {Object} options
   * @param {string} options.enTitle English header
   * @param {string} options.trTitle Turkish header
   * @param {string} [options.enDesc] English description
   * @param {string} [options.trDesc] Turkish description
   * @param {string} [options.emojiKey] Key for emoji resolver (:yes:, :no:, :like:, :dislike:, :loading:, :stats:)
   * @param {number} [options.accentColor] Hex color (default: GOLD 0x8C5137)
   * @param {Array<string>} [options.ansiLines] Colored ANSI log lines
   * @param {Array<{enKey: string, trKey: string, val: string}>} [options.treeItems] Parameter tree
   * @param {Object} [options.meta] Technical metadata (IP, Geo, User, Time)
   * @param {Array<ActionRowBuilder>} [options.actionRows] Interactive components (buttons, select menus)
   * @param {string} [options.thumbnailUrl] Section thumbnail URL
   * @param {ButtonBuilder} [options.accessoryButton] Section button accessory
   * @returns {{ flags: number, components: Array<any> }}
   */
  static buildNativeContainer({
    enTitle,
    trTitle,
    enDesc = '',
    trDesc = '',
    emojiKey = 'yes',
    accentColor = VINTAGE_COLORS.GOLD,
    ansiLines = [],
    treeItems = [],
    meta = {},
    actionRows = [],
    thumbnailUrl = null,
    accessoryButton = null
  }) {
    const container = new ContainerBuilder().setAccentColor(accentColor);

    // 1. Header Section
    const headerDisplay = new TextDisplayBuilder().setContent(
      MarkdownBuilder.header(enTitle, trTitle, emojiKey)
    );

    const headerSection = new SectionBuilder().addTextDisplayComponents(headerDisplay);
    if (thumbnailUrl) {
      headerSection.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: thumbnailUrl } }));
    } else if (accessoryButton) {
      headerSection.setButtonAccessory(accessoryButton);
    }
    container.addSectionComponents(headerSection);

    // 2. Divider
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // 3. Description Block
    if (enDesc || trDesc) {
      const descContent = (enDesc && trDesc)
        ? `>>> **${enDesc}**\n*${trDesc}*`
        : `>>> **${enDesc || trDesc}**`;
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(descContent));
    }

    // 4. ANSI Code Block
    if (ansiLines && ansiLines.length > 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(MarkdownBuilder.ansiBlock(ansiLines))
      );
    }

    // 5. Tree Properties Block
    if (treeItems && treeItems.length > 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### Parameters & State / Parametreler ve Durum\n*-# Live payload properties and contextual variables.*\n\n${MarkdownBuilder.tree(treeItems)}`
        )
      );
    }

    // 6. Metadata Footer
    if (meta && Object.keys(meta).length > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(MarkdownBuilder.metaFooter(meta))
      );
    }

    const components = [container];
    if (actionRows && actionRows.length > 0) {
      components.push(...actionRows);
    }

    return {
      flags: MessageFlags?.IsComponentsV2 || 32768,
      components
    };
  }

  /**
   * Compatibility method returning markdown content and ActionRow components
   */
  static buildBilingualContainer(options) {
    const parts = [];
    parts.push(MarkdownBuilder.header(options.enTitle, options.trTitle, options.emojiKey || 'yes'));
    parts.push('');

    if (options.enDesc && options.trDesc) {
      parts.push(`>>> **${options.enDesc}**\n*${options.trDesc}*`);
    } else if (options.enDesc) {
      parts.push(`>>> **${options.enDesc}**`);
    }

    if (options.ansiLines && options.ansiLines.length > 0) {
      parts.push('', MarkdownBuilder.ansiBlock(options.ansiLines));
    }

    if (options.treeItems && options.treeItems.length > 0) {
      parts.push(
        '',
        `### Parameters & State / Parametreler ve Durum`,
        `*-# Live payload properties and contextual variables.*`,
        '',
        MarkdownBuilder.tree(options.treeItems)
      );
    }

    if (options.meta && Object.keys(options.meta).length > 0) {
      parts.push('', MarkdownBuilder.metaFooter(options.meta));
    }

    const components = [];
    if (options.accessoryButton) {
      components.push(new ActionRowBuilder().addComponents(options.accessoryButton));
    }
    if (options.actionRows && options.actionRows.length > 0) {
      components.push(...options.actionRows);
    }

    return {
      content: parts.join('\n'),
      components
    };
  }
}

export default VintageContainerBuilder;

