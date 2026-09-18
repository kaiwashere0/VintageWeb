import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  siteMode: { type: Number, default: 3 },
  vtcName: { type: String, default: 'Vintage Club' },
  founder: { type: String, default: 'nasriemir.' },
  establishedYear: { type: Number, default: 2024 },
  motto: { type: String, default: 'Nobility on the Roads, Power in the Convoy' },
  truckersMpVtcId: { type: String, default: '80136' },
  discordInviteUrl: { type: String, default: 'https://discord.com/invite/vintageclub' },
  truckersMpUrl: { type: String, default: 'https://truckersmp.com/vtc/80136' },
  youtubeUrl: { type: String, default: 'https://www.youtube.com/@VntgClub' },
  instagramUrl: { type: String, default: 'https://www.instagram.com/vintageclubofficiall?stkn=MXNmcnY5cDYweTJ6cQ%3D%3D&utm_source=qr' },
  stats: {
    totalMembers: { type: Number, default: 48 },
    totalConvoys: { type: Number, default: 135 },
    totalKilometers: { type: String, default: '1,240,500+' },
    foundedDate: { type: String, default: 'October 2024' }
  },
  systemNotice: { type: String, default: 'Vintage Club 2026 Season Driver Recruitment is Active.' },
  discordBot: {
    statusType: { type: String, default: 'STREAMING' }, // STREAMING, PLAYING, WATCHING, LISTENING, COMPETING
    streamingUrl: { type: String, default: 'https://twitch.tv/vintageclub' },
    statusMode: { type: String, default: 'ROTATING' }, // STATIC or ROTATING
    statuses: {
      type: [String],
      default: [
        '👑 Vintage Club | 2026',
        '🚛 Nobility on the Roads',
        '✨ vintageclub.com'
      ]
    },
    rotationIntervalSeconds: { type: Number, default: 15 },
    onlineStatus: { type: String, default: 'online' }, // online, idle, dnd, invisible
    voiceChannel: {
      enabled: { type: Boolean, default: false },
      guildId: { type: String, default: '' },
      channelId: { type: String, default: '' },
      selfDeaf: { type: Boolean, default: true },
      selfMute: { type: Boolean, default: true }
    },
    guildId: { type: String, default: '' },
    logCategoryId: { type: String, default: '' },
    channels: {
      auth: { type: String, default: '' },            // vweb-auth
      lookup: { type: String, default: '' },          // vweb-lookup
      applications: { type: String, default: '' },    // vweb-applications
      appStatus: { type: String, default: '' },       // vweb-app-status
      appDelete: { type: String, default: '' },       // vweb-app-delete
      settings: { type: String, default: '' },        // vweb-settings
      members: { type: String, default: '' },         // vweb-members
      events: { type: String, default: '' },          // vweb-events
      gallery: { type: String, default: '' },         // vweb-gallery
      newsletter: { type: String, default: '' },      // vweb-newsletter
      botPresence: { type: String, default: '' },     // vweb-bot-presence
      botVoice: { type: String, default: '' },        // vweb-bot-voice
      cache: { type: String, default: '' },           // vweb-cache
      systemErrors: { type: String, default: '' }     // vweb-system-errors
    },
    logToggles: {
      auth: { type: Boolean, default: true },
      lookup: { type: Boolean, default: true },
      applications: { type: Boolean, default: true },
      appStatus: { type: Boolean, default: true },
      appDelete: { type: Boolean, default: true },
      settings: { type: Boolean, default: true },
      members: { type: Boolean, default: true },
      events: { type: Boolean, default: true },
      gallery: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: true },
      botPresence: { type: Boolean, default: true },
      botVoice: { type: Boolean, default: true },
      cache: { type: Boolean, default: true },
      systemErrors: { type: Boolean, default: true }
    },
    notificationRoles: {
      type: [String],
      default: []
    }
  }
}, {
  timestamps: true,
  collection: 'settings'
});

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
export default Settings;
