import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  badge: { type: String, default: 'Member' },
  category: { type: String, default: 'driver' }, // leadership, staff, driver
  avatar: { type: String, default: '' },
  steamProfile: { type: String, default: '' },
  truckersMpProfile: { type: String, default: '' },
  joinedDate: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'members'
});

export const Member = mongoose.models.Member || mongoose.model('Member', memberSchema);
export default Member;
