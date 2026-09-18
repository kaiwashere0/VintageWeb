import EmojiResolver from './emojiResolver.js';

/**
 * Advanced Discord Markdown Builder for Vintage Web Platform
 * Strictly enforces:
 * 1. English on top, Turkish directly underneath.
 * 2. Effective Discord Markdown (#, ##, ###, >>>, >, ```ansi, ```yaml, -# subtext).
 * 3. Only permitted server emojis (:yes:, :no:, :like:, :dislike:, :loading:, :stats:).
 */
export class MarkdownBuilder {
  /**
   * Format Discord Dynamic Timestamp
   * @param {Date|number|string} date 
   * @param {'F'|'R'|'t'|'T'|'d'|'D'} style 
   */
  static timestamp(date = new Date(), style = 'F') {
    const unix = Math.floor(new Date(date).getTime() / 1000);
    return `<t:${unix}:${style}>`;
  }

  /**
   * Relative time string (<t:UNIX:R>)
   */
  static relativeTime(date = new Date()) {
    const unix = Math.floor(new Date(date).getTime() / 1000);
    return `<t:${unix}:${style = 'R'}>`;
  }

  /**
   * ANSI Color Formatter for Discord ```ansi code blocks
   * 30: Gray/Black, 31: Red, 32: Green, 33: Yellow, 34: Blue, 35: Pink/Magenta, 36: Cyan, 37: White
   */
  static ansi(text, color = '37', bold = false) {
    const prefix = bold ? `\u001b[1;${color}m` : `\u001b[0;${color}m`;
    return `${prefix}${text}\u001b[0m`;
  }

  /**
   * ANSI Code Block Wrapper
   */
  static ansiBlock(lines = []) {
    return '```ansi\n' + lines.join('\n') + '\n```';
  }

  /**
   * Bilingual Header Block
   * @param {string} enText English text
   * @param {string} trText Turkish text
   * @param {string} emojiKey Optional emoji from allowed list
   */
  static header(enText, trText, emojiKey = null) {
    const emojiStr = emojiKey ? `${EmojiResolver.get(emojiKey)} ` : '';
    return `## ${emojiStr}${enText}\n> *${trText}*`;
  }

  /**
   * Bilingual Section Subtitle
   */
  static subheader(enText, trText, emojiKey = null) {
    const emojiStr = emojiKey ? `${EmojiResolver.get(emojiKey)} ` : '';
    return `### ${emojiStr}${enText}\n*-# ${trText}*`;
  }

  /**
   * Bilingual Content Block
   */
  static bilingual(enText, trText) {
    return `${enText}\n*${trText}*`;
  }

  /**
   * Key-Value Tree / Box-Drawing block
   * @param {Array<{enKey: string, trKey: string, val: string}>} items 
   */
  static tree(items = []) {
    if (!items || items.length === 0) return '';
    return items.map((item, idx) => {
      const isLast = idx === items.length - 1;
      const prefix = isLast ? '└─' : '├─';
      return `\`${prefix}\` **${item.enKey}** *(${item.trKey})*: \`${item.val}\``;
    }).join('\n');
  }

  /**
   * Technical Metadata Subtext (IP, Geolocation, User-Agent, Request ID)
   */
  static metaFooter(meta = {}) {
    const parts = [];
    if (meta.ip) parts.push(`IP: \`${meta.ip}\``);
    if (meta.country) parts.push(`Location: \`${meta.country}\``);
    if (meta.user) parts.push(`Actor: **${meta.user}**`);
    if (meta.time) parts.push(`Time: ${this.timestamp(meta.time, 'R')}`);
    if (meta.reqId) parts.push(`ID: \`${meta.reqId}\``);

    return `-# ${parts.join(' • ')}`;
  }

  /**
   * Standard Divider
   */
  static get divider() {
    return '──────────────────────────────────────────';
  }
}

export default MarkdownBuilder;
