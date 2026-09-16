import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  age: { type: Number },
  discordTag: { type: String, required: true },
  truckersMpProfile: { type: String, required: true },
  steamProfile: { type: String, default: '' },
  experienceHours: { type: String, default: '' },
  dlcList: { type: [String], default: [] },
  notes: { type: String, default: '' },
  ip: { type: String, default: '' },
  status: { type: String, default: 'pending' }, // pending, approved, rejected
  reviewedBy: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'applications'
});

export const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);
export default Application;
