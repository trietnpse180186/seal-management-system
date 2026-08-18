const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ScoreSchema = new Schema({
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  repositoryId: { type: Schema.Types.ObjectId, ref: 'GithubRepository', required: true },
  repositorySnapshotId: { type: Schema.Types.ObjectId, ref: 'RepositorySnapshot' },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  trackId: { type: Schema.Types.ObjectId, ref: 'Track', required: true },
  roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
  rubricId: { type: Schema.Types.ObjectId, ref: 'Rubric', required: true },
  judgeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  totalRawScore: { type: Number },
  totalWeightedScore: { type: Number },
  overallComment: { type: String },
  status: { type: String, enum: ['submitted', 'locked'] },
  submittedAt: { type: Date },
  lockedAt: { type: Date }
}, {
  timestamps: true
});

ScoreSchema.index({ teamId: 1, roundId: 1, judgeId: 1 }, { unique: true });
ScoreSchema.index({ repositoryId: 1, roundId: 1, judgeId: 1 }, { unique: true });
ScoreSchema.index({ roundId: 1, judgeId: 1 });
ScoreSchema.index({ teamId: 1, roundId: 1 });

module.exports = mongoose.model('Score', ScoreSchema);