const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PersonnelInvitationSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  fullName: { type: String, required: true },
  unit: { type: String },
  assignments: [{
    role: { type: String, enum: ['judge', 'mentor'], required: true },
    isChiefJudge: { type: Boolean, default: false },
    roundName: { type: String },
    trackName: { type: String },
    note: { type: String },
  }],
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  tokenHash: { type: String, required: true },
  tokenExpiresAt: { type: Date, required: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  invitedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
  emailStatus: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  emailError: { type: String },
  accountStatus: {
    type: String,
    enum: ['not_provisioned', 'provisioned', 'revoked'],
    default: 'not_provisioned',
  },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  provisionedAt: { type: Date },
  revokedAt: { type: Date },
  accountEmailStatus: { type: String, enum: ['pending', 'sent', 'failed'] },
  accountEmailError: { type: String },
}, { timestamps: true });

PersonnelInvitationSchema.index({ eventId: 1, email: 1 }, { unique: true });
PersonnelInvitationSchema.index({ tokenHash: 1 }, { unique: true });

module.exports = mongoose.model('PersonnelInvitation', PersonnelInvitationSchema);
