import mongoose from 'mongoose';

const gallerySchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  title: { type: String, required: true },
  author: { type: String, default: 'Vintage Media' },
  imageUrl: { type: String, required: true },
  category: { type: String, default: 'convoy' }, // convoy, truck, landscape
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'gallery'
});

export const Gallery = mongoose.models.Gallery || mongoose.model('Gallery', gallerySchema);
export default Gallery;
