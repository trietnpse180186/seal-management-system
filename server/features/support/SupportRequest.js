const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, enum: ['participant', 'coordinator'], required: true },
  content: { type: String, required: true, trim: true, maxlength: 4000 }
}, { timestamps: true, _id: true });

const statusHistorySchema = new mongoose.Schema({
  from: String,
  to: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const supportRequestSchema = new mongoose.Schema({
  requestCode: { type: String, unique: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null, index: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  guestName: { type: String, trim: true, maxlength: 100 },
  guestEmail: { type: String, trim: true, lowercase: true, maxlength: 254, index: true },
  category: {
    type: String,
    enum: ['account', 'team', 'github', 'mqtt', 'submission', 'schedule', 'grading', 'appeal', 'other'],
    required: true
  },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 4000 },
  status: {
    type: String,
    enum: ['pending', 'processing', 'waiting_for_candidate', 'resolved', 'reopened', 'closed'],
    default: 'pending',
    index: true
  },
  replies: [replySchema],
  statusHistory: [statusHistorySchema],
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  closedAt: Date
}, { timestamps: true });

supportRequestSchema.index({ eventId: 1, status: 1, createdAt: -1 });

supportRequestSchema.pre('validate', function setRequestCode() {
  if (!this.requestCode) {
    this.requestCode = `SUP-${Date.now().toString(36).toUpperCase()}-${this._id.toString().slice(-5).toUpperCase()}`;
  }
});

module.exports = mongoose.model('SupportRequest', supportRequestSchema);
