const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TrackSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
  name: { type: String, required: true },
  description: { type: String },
  maxTeams: { type: Number },
  topicSubmissionOpen: { type: Boolean, default: false },
  attachments: { type: Schema.Types.Mixed, default: [] }
}, {
  timestamps: true
});

TrackSchema.index({ roundId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Track', TrackSchema);