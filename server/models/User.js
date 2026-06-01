const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true },
  studentId: { type: String },
  university: { type: String },
  githubUsername: { type: String },
  githubAccessTokenEncrypted: { type: String },
  avatarUrl: { type: String },
  isSystemAdmin: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  emailVerificationToken: { type: String },
  emailVerificationTokenExpiry: { type: Date },
  notificationPrefs: { type: Schema.Types.Mixed, default: {} },
  activeSessionId: { type: String, default: null },
  lastActiveAt: { type: Date, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);