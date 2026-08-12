const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ScoreAuditSchema = new Schema({
  scoreId: { type: Schema.Types.ObjectId, ref: 'Score' },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
  judgeId: { type: Schema.Types.ObjectId, ref: 'User' },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actorRole: { type: String },
  action: {
    type: String,
    enum: ['submit_score', 'regrade_score', 'blocked_regrade'],
    required: true,
  },
  summary: { type: String },
  changeDetails: [{
    criterionId: { type: String },
    criterionName: { type: String },
    change: { type: Schema.Types.Mixed },
  }],
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  reason: { type: String },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

ScoreAuditSchema.index({ teamId: 1, roundId: 1, createdAt: -1 });
ScoreAuditSchema.index({ actorId: 1, createdAt: -1 });

module.exports = mongoose.model('ScoreAudit', ScoreAuditSchema);
