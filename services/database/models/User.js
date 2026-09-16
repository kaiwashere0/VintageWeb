import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  globalName: { type: String, default: '' },
  discriminator: { type: String, default: '0' },
  avatar: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  email: { type: String, default: '' },
  role: { type: String, default: 'Member' }, // Member, Driver, Staff, Admin
  lastLogin: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'users'
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
