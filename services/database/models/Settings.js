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
    }
  }
}, {
  timestamps: true,
  collection: 'settings'
});

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
export default Settings;
