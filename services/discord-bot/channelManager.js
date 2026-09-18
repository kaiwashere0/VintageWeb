import { ChannelType, PermissionFlagsBits } from 'discord.js';
import DatabaseService from '../database/index.js';
import EmojiResolver from './emojiResolver.js';
import MarkdownBuilder from './markdownBuilder.js';

export const CATEGORY_NAME = '︱ VINTAGE WEB LOGS';

export const CHANNEL_DEFINITIONS = [
  {
    key: 'auth',
    name: 'vweb-auth',
    topic: 'Vintage Web — Discord OAuth Login & Access Logs | Giriş & Güvenlik Kayıtları',
    enDesc: 'Discord OAuth login, logout, and access attempts',
    trDesc: 'Discord OAuth giriş, çıkış ve yetki denemeleri'
  },
  {
    key: 'lookup',
    name: 'vweb-lookup',
    topic: 'Vintage Web — TruckersMP & Steam Driver Lookup Logs | Sürücü Sorgu Kayıtları',
    enDesc: 'TruckersMP player and ban history searches',
    trDesc: 'TruckersMP sürücü ve ban geçmişi sorgulamaları'
  },
  {
    key: 'applications',
    name: 'vweb-applications',
    topic: 'Vintage Web — Driver Recruitment Applications | Sürücü Başvuruları',
    enDesc: 'New driver application submissions from website',
    trDesc: 'Web sitesi üzerinden gelen yeni sürücü başvuruları'
  },
  {
    key: 'appStatus',
    name: 'vweb-app-status',
    topic: 'Vintage Web — Application Status Updates & Reviews | Başvuru Onay/Red İşlemleri',
    enDesc: 'Driver application approvals and rejections',
    trDesc: 'Sürücü başvuru onay ve red inceleme işlemleri'
  },
  {
    key: 'appDelete',
    name: 'vweb-app-delete',
    topic: 'Vintage Web — Application Deletion Logs | Başvuru Silme Kayıtları',
    enDesc: 'Driver application removals by administrators',
    trDesc: 'Yöneticiler tarafından silinen başvuru kayıtları'
  },
  {
    key: 'settings',
    name: 'vweb-settings',
    topic: 'Vintage Web — VTC General Settings & Mode Updates | VTC Ayar Güncellemeleri',
    enDesc: 'VTC configurations, site modes and social links',
    trDesc: 'VTC genel ayarları, site modu ve sosyal medya linkleri'
  },
  {
    key: 'members',
    name: 'vweb-members',
    topic: 'Vintage Web — Roster & Team Member Modifications | Ekip Üyesi İşlemleri',
    enDesc: 'Team member additions, updates and removals',
    trDesc: 'Ekip kadrosu üye ekleme, düzenleme ve silme'
  },
  {
    key: 'events',
    name: 'vweb-events',
    topic: 'Vintage Web — Convoy & Event Management | Konvoy ve Etkinlik Kayıtları',
    enDesc: 'VTC convoy and event creations and removals',
    trDesc: 'Konvoy ve etkinlik oluşturma, güncelleme ve silme'
  },
  {
    key: 'gallery',
    name: 'vweb-gallery',
    topic: 'Vintage Web — Media & Gallery Management | Galeri ve Medya İşlemleri',
    enDesc: 'Media and gallery image uploads and removals',
    trDesc: 'Galeri fotoğrafı yükleme ve silme işlemleri'
  },
  {
    key: 'newsletter',
    name: 'vweb-newsletter',
    topic: 'Vintage Web — Newsletter Subscriptions | Bülten Abonelik Kayıtları',
    enDesc: 'Newsletter email subscriptions and unsubscribes',
    trDesc: 'Bülten e-posta abonelikleri ve kayıtları'
  },
  {
    key: 'botPresence',
    name: 'vweb-bot-presence',
    topic: 'Vintage Web — Discord Bot Live Presence & Stream Updates | Bot Canlı Yayın & Durum Kayıtları',
    enDesc: 'Discord Bot streaming status and text rotation changes',
    trDesc: 'Discord Bot yayın ve durum metni rotasyonu değişiklikleri'
  },
  {
    key: 'botVoice',
    name: 'vweb-bot-voice',
    topic: 'Vintage Web — 24/7 Voice Channel Connection & Gateway Status | Bot Ses Kanalı Durum Kayıtları',
    enDesc: '24/7 voice channel connections and reconnect events',
    trDesc: '7/24 ses kanalı bağlantısı ve yeniden bağlanma olayları'
  },
  {
    key: 'cache',
    name: 'vweb-cache',
    topic: 'Vintage Web — Cache Flushes & Telemetry Resets | Önbellek ve Telemetri Sıfırlama Kayıtları',
    enDesc: 'TruckersMP and system cache flushes and log clears',
    trDesc: 'TruckersMP ve sistem önbelleği temizleme işlemleri'
  },
  {
    key: 'systemErrors',
    name: 'vweb-system-errors',
    topic: 'Vintage Web — Critical 5xx Errors & Security Alerts | Sistem Hataları ve Güvenlik Alarmları',
    enDesc: 'Server 5xx errors, unhandled exceptions and telemetry alerts',
    trDesc: 'Sunucu 5xx hataları, istisnalar ve kritik telemetri alarmları'
  }
];

export class ChannelManager {
  /**
   * Find or create the dedicated category
   */
  static async getOrCreateCategory(guild) {
    if (!guild) return null;

    let category = null;
    const botSettings = await DatabaseService.getBotSettings();

    if (botSettings.logCategoryId) {
      category = guild.channels.cache.get(botSettings.logCategoryId);
    }

    if (!category) {
      category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === CATEGORY_NAME.toLowerCase()
      );
    }

    if (!category) {
      category = await guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.SendMessages]
          }
        ]
      });
      console.log(`\x1b[32m✔\x1b[0m \x1b[1m[Discord Bot]\x1b[0m Yeni Log Kategorisi Oluşturuldu: \x1b[36m${category.name}\x1b[0m`);
    }

    return category;
  }

  /**
   * Auto-Create all 14 vweb-* channels under the category
   */
  static async createAllChannels(guild) {
    if (!guild) throw new Error('Guild not provided.');

    const category = await this.getOrCreateCategory(guild);
    const createdMap = {};
    const createdList = [];

    for (const def of CHANNEL_DEFINITIONS) {
      // Check if channel already exists in category or guild
      let channel = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.name.toLowerCase() === def.name.toLowerCase() && c.parentId === category.id
      );

      if (!channel) {
        channel = await guild.channels.create({
          name: def.name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: def.topic,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.SendMessages]
            }
          ]
        });

        // Send initial welcoming Container message
        const welcomeContainer = VintageContainerBuilder.buildBilingualContainer({
          enTitle: `Dedicated Channel Initialized: ${def.name}`,
          trTitle: `Özel Kanal Başlatıldı: ${def.name}`,
          enDesc: def.enDesc,
          trDesc: def.trDesc,
          emojiKey: 'yes',
          accentColor: VINTAGE_COLORS.GOLD,
          ansiLines: [
            `\u001b[1;32m[STATUS]\u001b[0m READY • 2026 ENGINE`,
            `\u001b[0;36m[CHANNEL]\u001b[0m #${def.name}`,
            `\u001b[0;37m[PURPOSE]\u001b[0m ${def.enDesc}`
          ],
          meta: { time: new Date(), user: 'Vintage System Engine' }
        });

        await channel.send({ components: [welcomeContainer] }).catch(() => null);
        createdList.push({ name: def.name, id: channel.id, status: 'CREATED' });
      } else {
        createdList.push({ name: def.name, id: channel.id, status: 'EXISTING' });
      }

      createdMap[def.key] = channel.id;
    }

    // Save to database
    await DatabaseService.saveBotChannels(guild.id, category.id, createdMap);

    return {
      success: true,
      categoryId: category.id,
      categoryName: category.name,
      channels: createdList,
      channelsMap: createdMap
    };
  }

  /**
   * Scan and Repair missing or deleted channels
   */
  static async repairChannels(guild) {
    if (!guild) throw new Error('Guild not provided.');

    const category = await this.getOrCreateCategory(guild);
    const botSettings = await DatabaseService.getBotSettings();
    const currentChannels = botSettings.channels || {};
    const updatedMap = { ...currentChannels };
    const repairedList = [];

    for (const def of CHANNEL_DEFINITIONS) {
      let existingChannelId = currentChannels[def.key];
      let channel = existingChannelId ? guild.channels.cache.get(existingChannelId) : null;

      // Also check by name inside category if ID was lost
      if (!channel) {
        channel = guild.channels.cache.find(
          c => c.type === ChannelType.GuildText && c.name.toLowerCase() === def.name.toLowerCase() && c.parentId === category.id
        );
      }

      if (!channel || channel.deleted) {
        // Recreate the missing channel
        channel = await guild.channels.create({
          name: def.name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: def.topic,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.SendMessages]
            }
          ]
        });

        const repairContainer = VintageContainerBuilder.buildBilingualContainer({
          enTitle: `Channel Repaired & Restored: ${def.name}`,
          trTitle: `Kanal Tamir Edildi ve Yeniden Oluşturuldu: ${def.name}`,
          enDesc: def.enDesc,
          trDesc: def.trDesc,
          emojiKey: 'yes',
          accentColor: VINTAGE_COLORS.WARNING,
          ansiLines: [
            `\u001b[1;33m[REPAIR STATUS]\u001b[0m RESTORED & LINKED`,
            `\u001b[0;36m[CHANNEL]\u001b[0m #${def.name}`,
            `\u001b[0;32m[SYNC]\u001b[0m MongoDB Configuration Updated`
          ],
          meta: { time: new Date(), user: 'Vintage System Repair Engine' }
        });

        await channel.send({ components: [repairContainer] }).catch(() => null);
        repairedList.push({ name: def.name, id: channel.id, status: 'REPAIRED' });
      } else {
        repairedList.push({ name: def.name, id: channel.id, status: 'HEALTHY' });
      }

      updatedMap[def.key] = channel.id;
    }

    await DatabaseService.saveBotChannels(guild.id, category.id, updatedMap);

    return {
      success: true,
      categoryId: category.id,
      repairedCount: repairedList.filter(r => r.status === 'REPAIRED').length,
      channels: repairedList,
      channelsMap: updatedMap
    };
  }

  /**
   * Recreate all channels from scratch (Delete existing & fresh install)
   */
  static async recreateAllChannels(guild) {
    await this.deleteAllChannels(guild);
    return await this.createAllChannels(guild);
  }

  /**
   * Delete all vweb-* channels and category
   */
  static async deleteAllChannels(guild) {
    if (!guild) throw new Error('Guild not provided.');

    const botSettings = await DatabaseService.getBotSettings();
    const channelsMap = botSettings.channels || {};
    const deletedList = [];

    // Delete text channels
    for (const [key, channelId] of Object.entries(channelsMap)) {
      if (channelId) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          await channel.delete('Vintage Setup: Delete Channels Requested').catch(() => null);
          deletedList.push({ key, id: channelId, status: 'DELETED' });
        }
      }
    }

    // Also look for any channels matching vweb-* in the guild
    const vwebChannels = guild.channels.cache.filter(c => c.name.startsWith('vweb-'));
    for (const [, ch] of vwebChannels) {
      await ch.delete('Vintage Cleanup').catch(() => null);
    }

    // Delete category if empty or matching
    if (botSettings.logCategoryId) {
      const category = guild.channels.cache.get(botSettings.logCategoryId);
      if (category) {
        await category.delete('Vintage Setup: Category Deleted').catch(() => null);
      }
    }

    const catByName = guild.channels.cache.find(c => c.name.toLowerCase() === CATEGORY_NAME.toLowerCase());
    if (catByName) {
      await catByName.delete().catch(() => null);
    }

    await DatabaseService.clearBotChannels();

    return {
      success: true,
      deletedCount: deletedList.length,
      deletedList
    };
  }

  /**
   * Resolve target Discord text channel for a given log type
   */
  static async getChannelForLog(client, logType) {
    if (!client) return null;

    try {
      const botSettings = await DatabaseService.getBotSettings();
      const channelsMap = botSettings.channels || {};
      const channelId = channelsMap[logType];

      if (!channelId) return null;

      // 1. Try cache
      let channel = client.channels.cache.get(channelId);
      if (channel) return channel;

      // 2. Try fetch
      channel = await client.channels.fetch(channelId).catch(() => null);
      return channel;
    } catch (err) {
      return null;
    }
  }
}

export default ChannelManager;
