const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GithubRepositorySchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  orgName: { type: String },
  repoName: { type: String, required: true },
  repoUrl: { type: String },
  githubRepoId: { type: String },
  defaultBranch: { type: String, default: 'main' },
  visibility: { type: String, enum: ['private', 'public'], default: 'private' },
  createdBySystem: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAtGithub: { type: Date },
  lastSyncedAt: { type: Date },
  lastCommitSha: { type: String },
  syncStatus: { type: String, enum: ['not_synced', 'syncing', 'success', 'failed'], default: 'not_synced' },
  syncErrorMessage: { type: String },
  isArchived: { type: Boolean, default: false }
}, {
  timestamps: true
});

GithubRepositorySchema.index({ teamId: 1 }, { unique: true });
GithubRepositorySchema.index({ githubRepoId: 1 }, { unique: true, sparse: true });
GithubRepositorySchema.index({ eventId: 1, trackId: 1 });
GithubRepositorySchema.index({ syncStatus: 1, lastSyncedAt: 1 });

module.exports = mongoose.model('GithubRepository', GithubRepositorySchema);