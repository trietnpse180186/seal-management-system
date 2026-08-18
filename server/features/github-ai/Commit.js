const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CommitSchema = new Schema({
  repositoryId: { type: Schema.Types.ObjectId, ref: 'GithubRepository', required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  commitSha: { type: String, required: true },
  branch: { type: String },
  authorGithubUsername: { type: String },
  authorName: { type: String },
  authorEmail: { type: String },
  message: { type: String },
  commitUrl: { type: String },
  additions: { type: Number },
  deletions: { type: Number },
  changedFilesCount: { type: Number },
  committedAt: { type: Date },
  pulledAt: { type: Date, default: Date.now },
  diffFetched: { type: Boolean, default: false },
  diffSummary: { type: String }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

CommitSchema.index({ repositoryId: 1, commitSha: 1 }, { unique: true });
CommitSchema.index({ teamId: 1, committedAt: -1 });
CommitSchema.index({ repositoryId: 1 });

module.exports = mongoose.model('Commit', CommitSchema);