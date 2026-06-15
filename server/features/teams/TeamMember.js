const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TeamMemberSchema = new Schema({
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['leader', 'member'], required: true },
  confirmStatus: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
  confirmTokenHash: { type: String },
  confirmTokenExpiry: { type: Date },
  confirmedAt: { type: Date },
  invitedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

TeamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });
TeamMemberSchema.index({ userId: 1 });

module.exports = mongoose.model('TeamMember', TeamMemberSchema);