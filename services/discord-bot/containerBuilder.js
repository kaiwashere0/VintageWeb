import {
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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
 * Discord Components V2 Container Engine for Vintage Web Platform
 */
export class VintageContainerBuilder {
  /**
   * Build a complete structured Bilingual Message Container
   */
  static buildBilingualContainer({
    enTitle,
    trTitle,
    enDesc = '',
    trDesc = '',
    emojiKey = 'yes',
    accentColor = VINTAGE_COLORS.GOLD,
    accessoryButton = null,
    ansiLines = [],
    treeItems = [],
    meta = {},
    actionRows = []
  }) {
    const container = new ContainerBuilder().setAccentColor(accentColor);
    const emojiStr = emojiKey ? `${EmojiResolver.get(emojiKey)} ` : '';

    // 1. Header: Use SectionBuilder if an accessoryButton is provided, otherwise TextDisplay
    if (accessoryButton) {
      const headerSection = new SectionBuilder();
      const headerText = new TextDisplayBuilder().setContent(`## ${emojiStr}${enTitle}\n> *${trTitle}*`);
      headerSection.addTextDisplayComponents(headerText);
      headerSection.setButtonAccessory(accessoryButton);
      container.addSectionComponents(headerSection);
    } else {
      const headerText = new TextDisplayBuilder().setContent(`## ${emojiStr}${enTitle}\n> *${trTitle}*`);
      container.addTextDisplayComponents(headerText);
    }

    // 2. Small Separator Divider
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // 3. Description Block
    if (enDesc && trDesc) {
      const descText = new TextDisplayBuilder().setContent(`>>> **${enDesc}**\n*${trDesc}*`);
      container.addTextDisplayComponents(descText);
    }

    // 4. ANSI Code Block (if provided)
    if (ansiLines && ansiLines.length > 0) {
      const ansiText = new TextDisplayBuilder().setContent(MarkdownBuilder.ansiBlock(ansiLines));
      container.addTextDisplayComponents(ansiText);
    }

    // 5. Tree Properties (if provided)
    if (treeItems && treeItems.length > 0) {
      const treeBlock = [
        `### Parameters & State / Parametreler ve Durum`,
        `*-# Live payload properties and contextual variables.*`,
        '',
        MarkdownBuilder.tree(treeItems)
      ].join('\n');
      const treeText = new TextDisplayBuilder().setContent(treeBlock);
      container.addTextDisplayComponents(treeText);
    }

    // 6. Meta Subtext Footer
    if (meta && Object.keys(meta).length > 0) {
      const footerSeparator = new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);
      container.addSeparatorComponents(footerSeparator);

      const footerText = new TextDisplayBuilder().setContent(MarkdownBuilder.metaFooter(meta));
      container.addTextDisplayComponents(footerText);
    }

    // 7. Embedded Action Rows inside Container (if any)
    if (actionRows && actionRows.length > 0) {
      for (const row of actionRows) {
        container.addActionRowComponents(row);
      }
    }

    return container;
  }

  /**
   * Helper to format a payload response object with Container and optional extra rows
   */
  static formatPayload(container, extraRows = []) {
    return {
      components: [container, ...extraRows]
    };
  }
}

export default VintageContainerBuilder;
