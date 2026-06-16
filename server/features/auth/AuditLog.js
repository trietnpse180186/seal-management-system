const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AuditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  targetType: { type: String },
  targetId: { type: String },
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  reason: { type: String }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);