const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GalleryPhotoSchema = new Schema({
  driveFileId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  size: { type: String },
  category: { type: String, required: true }, // e.g., 'Spring 2026', 'Summer 2026'
  createdTime: { type: Date, required: true },
  localPath: { type: String, required: true } // Static path (e.g., '/uploads/gallery/fileId.jpg')
}, { timestamps: true });

module.exports = mongoose.model('GalleryPhoto', GalleryPhotoSchema);
