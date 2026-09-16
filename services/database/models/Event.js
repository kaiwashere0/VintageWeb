import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  server: { type: String, default: 'Simulation 1' },
  departure: { type: String, default: 'Berlin' },
  destination: { type: String, default: 'Paris' },
  distance: { type: String, default: '1,050 km' },
  dlcRequired: { type: String, default: 'Base Game' },
  date: { type: String, default: '' },
  meetTime: { type: String, default: '20:30 UTC+3' },
  departureTime: { type: String, default: '21:00 UTC+3' },
  status: { type: String, default: 'upcoming' }, // upcoming, completed, cancelled
  routeMapUrl: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'events'
});

export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
export default Event;
