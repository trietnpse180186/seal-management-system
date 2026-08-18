const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoundSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true },
  order: { type: Number, required: true },
  submissionDeadline: { type: Date },
  advanceTopN: { type: Number },
  status: { type: String, enum: ['pending', 'active', 'scoring', 'completed'], default: 'pending' },
  // Round-level exam materials (one Drive link per round)
  driveFileId: { type: String },
  driveFileName: { type: String },
  driveFileUrl: { type: String },
  startTime: { type: Date },
  endTime: { type: Date },
  gradingEndTime: { type: Date },
  isDriveAccessSynced: { type: Boolean, default: false },
  driveSyncedAt: { type: Date },
  driveSyncedEmailCount: { type: Number, default: 0 },
  driveSyncErrors: { type: Schema.Types.Mixed, default: [] },
  isNotificationSent: { type: Boolean, default: false },
  isExamManualOpen: { type: Boolean, default: false }
}, {
  timestamps: true
});

RoundSchema.index({ eventId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('Round', RoundSchema);
