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
  }

  static async seedInitialData() {
    try {
      // Seed Settings if not exists
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

  static async setSiteMode(mode) {
    let doc = await Settings.findOne();
    if (!doc) {
      doc = await Settings.create({ siteMode: mode });
    } else {
      doc.siteMode = mode;
      await doc.save();
    }
    return doc.siteMode;
  }

  // --- Members ---
  static async getMembers(filter = {}) {
    try {
      return await Member.find(filter).sort({ id: 1 }).lean();
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

  static async deleteMember(id) {
    return await Member.findOneAndDelete({ id });
  }

  // --- Events ---
  static async getEvents(filter = {}) {
    try {
      return await Event.find(filter).sort({ date: 1, createdAt: -1 }).lean();
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

  static async deleteEvent(id) {
    return await Event.findOneAndDelete({ id });
  }

  // --- Gallery ---
  static async getGallery(filter = {}) {
    try {
      return await Gallery.find(filter).sort({ id: 1 }).lean();
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

  static async deleteGalleryItem(id) {
    return await Gallery.findOneAndDelete({ id });
  }

  // --- Applications ---
  static async createApplication(applicationData) {
    const newApp = await Application.create({
      id: `app-${Date.now()}`,
      ...applicationData
    });
    return newApp.toObject();
  }

  static async getApplications(filter = {}) {
    try {
      return await Application.find(filter).sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error('[DatabaseService] getApplications error:', err.message);
      return [];
    }
  }

  static async updateApplicationStatus(id, status, reviewedBy = '') {
    const app = await Application.findOneAndUpdate(
      { id },
      { status, reviewedBy, updatedAt: new Date() },
      { new: true }
    ).lean();
    return app;
  }

  static async deleteApplication(id) {
    return await Application.findOneAndDelete({ id });
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

  static async deleteSubscriber(email) {
    return await Subscriber.findOneAndDelete({ email: email.trim().toLowerCase() });
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

  static async getAllUsers() {
    try {
      return await User.find().sort({ lastLogin: -1 }).lean();
    } catch (err) {
      return [];
    }
  }
}

DatabaseService.init().catch(err => console.error('[DatabaseService] Init error:', err.message));

export default DatabaseService;

