const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TeamMemberSchema = new Schema({
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['leader', 'member'], required: true },
  confirmStatus: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
  confirmTokenHash: { type: String },
  confirmTokenExpiry: { type: Date },
  confirmedAt: { type: Date },
  invitedAt: { type: Date, default: Date.now },
  invitationEmailSent: { type: Boolean, default: true },
  invitationEmailStatus: {
    type: String,
    enum: ['pending', 'queued', 'sending', 'sent', 'failed']
  },
  invitationEmailJobId: { type: String },
  invitationEmailSentAt: { type: Date },
  invitationEmailLastError: { type: String },
  invitationEmailAttempts: { type: Number, default: 0 }
}, {
  timestamps: true
});

TeamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });
// Partial unique index: Chỉ cấm trùng lặp khi đang pending hoặc đã confirmed.
// Cho phép user bị reject ở đội này được mời lại bởi đội khác trong cùng cuộc thi.
TeamMemberSchema.index(
  { eventId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { confirmStatus: { $in: ['pending', 'confirmed'] } }
  }
);
TeamMemberSchema.index({ userId: 1 });

module.exports = mongoose.model('TeamMember', TeamMemberSchema);
