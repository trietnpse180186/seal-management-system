const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RepositorySnapshotSchema = new Schema({
  repositoryId: { type: Schema.Types.ObjectId, ref: 'GithubRepository', required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
  commitSha: { type: String, required: true },
  branch: { type: String, default: 'main' },
  capturedReason: { type: String },
  capturedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  capturedAt: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

RepositorySnapshotSchema.index({ repositoryId: 1, roundId: 1, commitSha: 1 }, { unique: true });
RepositorySnapshotSchema.index({ teamId: 1, roundId: 1 });

module.exports = mongoose.model('RepositorySnapshot', RepositorySnapshotSchema);