import connectToDatabase from './connection.js';
import Settings from './models/Settings.js';
import Member from './models/Member.js';
import Event from './models/Event.js';
import Gallery from './models/Gallery.js';
import Application from './models/Application.js';
import Subscriber from './models/Subscriber.js';
import User from './models/User.js';

export { Settings, Member, Event, Gallery, Application, Subscriber, User };

export class DatabaseService {
  static async init() {
    await connectToDatabase();
    await this.seedInitialData();
    await this.clearGalleryAndRoster();
  }

  static async clearGalleryAndRoster() {
    try {
      // Clear legacy dummy/mock gallery and members
      await Member.deleteMany({});
      await Gallery.deleteMany({});
      console.log('\x1b[32m✔\x1b[0m \x1b[1m[MongoDB]\x1b[0m Galeri ve Roster veritabanı temizlendi.');
    } catch (err) {
      console.error('[DatabaseService] clearGalleryAndRoster error:', err.message);
    }
  }

  static async seedInitialData() {
    try {
      // 1. Seed Settings
      const settingsCount = await Settings.countDocuments();
      if (settingsCount === 0) {
        await Settings.create({
          siteMode: 3,
          vtcName: "Vintage Club",
          founder: "nasriemir.",
          establishedYear: 2024,
          motto: "Nobility on the Roads, Power in the Convoy",
          truckersMpVtcId: "80136",
          discordInviteUrl: "https://discord.com/invite/vintageclub",
          truckersMpUrl: "https://truckersmp.com/vtc/80136",
          youtubeUrl: "https://www.youtube.com/@VntgClub",
          instagramUrl: "https://www.instagram.com/vintageclubofficiall?stkn=MXNmcnY5cDYweTJ6cQ%3D%3D&utm_source=qr",
          stats: {
            totalMembers: 48,
            totalConvoys: 135,
            totalKilometers: "1,240,500+",
            foundedDate: "October 2024"
          },
          systemNotice: "Vintage Club 2026 Season Driver Recruitment is Active."
        });
        console.log('\x1b[32m✔\x1b[0m \x1b[1m[MongoDB]\x1b[0m Varsayılan VTC ayarları hazırlandı.');
      }
    } catch (err) {
      console.error('\x1b[31m✖\x1b[0m \x1b[1m[MongoDB]\x1b[0m Seed hatası:', err.message);
    }
  }

  // --- Settings ---
  static async getSettings() {
    try {
      let doc = await Settings.findOne();
      if (!doc) {
        doc = await Settings.create({});
      }
      return doc.toObject();
    } catch (err) {
      console.error('[DatabaseService] getSettings error:', err.message);
      return {
        vtcName: "Vintage Club",
        founder: "nasriemir.",
        establishedYear: 2024,
        motto: "Nobility on the Roads, Power in the Convoy",
        truckersMpVtcId: "80136",
        discordInviteUrl: "https://discord.com/invite/vintageclub",
        truckersMpUrl: "https://truckersmp.com/vtc/80136",
        youtubeUrl: "https://www.youtube.com/@VntgClub",
        instagramUrl: "https://www.instagram.com/vintageclubofficiall?stkn=MXNmcnY5cDYweTJ6cQ%3D%3D&utm_source=qr",
        stats: { totalMembers: 48, totalConvoys: 135, totalKilometers: "1,240,500+", foundedDate: "October 2024" },
        systemNotice: "Vintage Club 2026 Season Driver Recruitment is Active."
      };
    }
  }

  static async updateSettings(updates) {
    let doc = await Settings.findOne();
    if (!doc) {
      doc = new Settings(updates);
    } else {
      Object.assign(doc, updates);
    }
    await doc.save();
    return doc.toObject();
  }

  // --- Members ---
  static async getMembers() {
    try {
      return await Member.find().sort({ id: 1 }).lean();
    } catch (err) {
      console.error('[DatabaseService] getMembers error:', err.message);
      return [];
    }
  }

  static async addMember(memberData) {
    const maxIdDoc = await Member.findOne().sort({ id: -1 });
    const nextId = (maxIdDoc?.id || 0) + 1;
    const newMember = await Member.create({
      id: nextId,
      ...memberData
    });
    return newMember.toObject();
  }

  // --- Events ---
  static async getEvents() {
    try {
      return await Event.find().sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error('[DatabaseService] getEvents error:', err.message);
      return [];
    }
  }

  static async addEvent(eventData) {
    const newEvent = await Event.create({
      id: `evt-${Date.now()}`,
      ...eventData
    });
    return newEvent.toObject();
  }

  // --- Gallery ---
  static async getGallery() {
    try {
      return await Gallery.find().sort({ id: 1 }).lean();
    } catch (err) {
      console.error('[DatabaseService] getGallery error:', err.message);
      return [];
    }
  }

  static async addGalleryItem(item) {
    const maxIdDoc = await Gallery.findOne().sort({ id: -1 });
    const nextId = (maxIdDoc?.id || 0) + 1;
    const newItem = await Gallery.create({
      id: nextId,
      ...item
    });
    return newItem.toObject();
  }

  // --- Applications ---
  static async createApplication(applicationData) {
    const newApp = await Application.create({
      id: `app-${Date.now()}`,
      ...applicationData
    });
    return newApp.toObject();
  }

  static async getApplications() {
    try {
      return await Application.find().sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error('[DatabaseService] getApplications error:', err.message);
      return [];
    }
  }

  // --- Subscribers ---
  static async addSubscriber(email, ip) {
    try {
      const trimmed = email.trim().toLowerCase();
      const existing = await Subscriber.findOne({ email: trimmed });
      if (existing) {
        return { alreadySubscribed: true, subscriber: existing.toObject() };
      }
      const newSub = await Subscriber.create({
        email: trimmed,
        ip: ip || ''
      });
      return { alreadySubscribed: false, subscriber: newSub.toObject() };
    } catch (err) {
      console.error('[DatabaseService] addSubscriber error:', err.message);
      throw err;
    }
  }

  static async getSubscribers() {
    try {
      return await Subscriber.find().sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error('[DatabaseService] getSubscribers error:', err.message);
      return [];
    }
  }

  // --- Users (Discord OAuth) ---
  static async findOrCreateUser(discordProfile, isSuper = false) {
    try {
      const { id, username, global_name, discriminator, avatar, email } = discordProfile;
      const avatarUrl = avatar
        ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${(parseInt(discriminator || '0', 10) || 0) % 5}.png`;

      let user = await User.findOne({ discordId: id });
      if (!user) {
        user = await User.create({
          discordId: id,
          username: username || 'DiscordUser',
          globalName: global_name || username || '',
          discriminator: discriminator || '0',
          avatar: avatar || '',
          avatarUrl,
          email: email || '',
          role: isSuper ? 'Super Admin' : 'Member',
          isSuperAdmin: isSuper,
          lastLogin: new Date()
        });
      } else {
        user.username = username || user.username;
        user.globalName = global_name || user.globalName;
        user.avatar = avatar || user.avatar;
        user.avatarUrl = avatarUrl;
        if (email) user.email = email;
        if (isSuper) {
          user.role = 'Super Admin';
          user.isSuperAdmin = true;
        }
        user.lastLogin = new Date();
        await user.save();
      }
      const userObj = user.toObject();
      if (isSuper) {
        userObj.isSuperAdmin = true;
        userObj.role = 'Super Admin';
      }
      return userObj;
    } catch (err) {
      console.error('[DatabaseService] findOrCreateUser error:', err.message);
      throw err;
    }
  }

  static async getUserById(id) {
    try {
      return await User.findById(id).lean();
    } catch (err) {
      return null;
    }
  }
}

DatabaseService.init().catch(err => console.error('[DatabaseService] Init error:', err.message));

export default DatabaseService;

