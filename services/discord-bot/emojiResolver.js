/**
 * Emoji Resolver Utility for Vintage Club Discord Bot
 * Resolves only allowed server emojis: :yes:, :no:, :dislike:, :like:, :loading:, :stats:
 */

export class EmojiResolver {
  static client = null;

  static setClient(client) {
    this.client = client;
  }

  /**
   * Resolve an emoji by key name
   * @param {'yes' | 'no' | 'like' | 'dislike' | 'loading' | 'stats'} key 
   * @param {string} [guildId] optional guild ID
   * @returns {string} Formatted Discord emoji string (<a:name:id> or <:name:id> or :key:)
   */
  static get(key, guildId = null) {
    const cleanKey = String(key || '').replace(/:/g, '').trim().toLowerCase();

    if (!this.client || !this.client.isReady || !this.client.isReady()) {
      return `:${cleanKey}:`;
    }

    try {
      let emoji = null;

      // 1. If guildId is provided, check guild first
      if (guildId) {
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
          emoji = guild.emojis.cache.find(e => e.name.toLowerCase() === cleanKey);
        }
      }

      // 2. Check across all client cached emojis
      if (!emoji) {
        emoji = this.client.emojis.cache.find(e => e.name.toLowerCase() === cleanKey);
      }

      if (emoji) {
        return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
      }
    } catch (err) {
      // Fallback
    }

    return `:${cleanKey}:`;
  }

  static get YES() { return this.get('yes'); }
  static get NO() { return this.get('no'); }
  static get LIKE() { return this.get('like'); }
  static get DISLIKE() { return this.get('dislike'); }
  static get LOADING() { return this.get('loading'); }
  static get STATS() { return this.get('stats'); }
}

export default EmojiResolver;
