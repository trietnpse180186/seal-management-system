const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TrackSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
  name: { type: String, required: true },
  description: { type: String },
  maxTeams: { type: Number },
  topicSubmissionOpen: { type: Boolean, default: false },
  startTime: { type: Date },
  endTime: { type: Date },
  gradingEndTime: { type: Date },
  attachments: { type: Schema.Types.Mixed, default: [] },
  isAttachmentSent: { type: Boolean, default: false },
  advanceTopN: { type: Number },
  topicName: { type: String },
  topicLink: { type: String },
  environmentId: { type: String },
  // Per-track exam materials — each track stores its own Drive link
  examDriveFileId: { type: String },
  examDriveFileName: { type: String },
  examDriveFileUrl: { type: String },
  isExamManualOpen: { type: Boolean, default: false }
}, {
  timestamps: true
});

TrackSchema.index({ roundId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Track', TrackSchema);