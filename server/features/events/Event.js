const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EventSchema = new Schema({
  name: { type: String, required: true },
  semester: { type: String, enum: ['Spring', 'Summer', 'Fall'], required: true },
  year: { type: Number, required: true },
  description: { type: String },
  bannerUrl: { type: String },
  registrationOpen: { type: Date },
  registrationClose: { type: Date },
  contestStart: { type: Date },
  contestEnd: { type: Date },
  maxTeams: { type: Number },
  status: { type: String, enum: ['draft', 'registration', 'ongoing', 'completed', 'cancelled'], default: 'draft' },
  githubOrgName: { type: String },
  githubOrgCreated: { type: Boolean, default: false },
  attachments: { type: Schema.Types.Mixed, default: [] }
}, {
  timestamps: true
});

EventSchema.index({ semester: 1, year: 1 }, { unique: true });
EventSchema.index({ status: 1 });

module.exports = mongoose.model('Event', EventSchema);