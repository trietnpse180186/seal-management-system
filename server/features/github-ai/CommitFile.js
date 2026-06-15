const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CommitFileSchema = new Schema({
  commitId: { type: Schema.Types.ObjectId, ref: 'Commit', required: true },
  repositoryId: { type: Schema.Types.ObjectId, ref: 'GithubRepository', required: true },
  filename: { type: String, required: true },
  status: { type: String },
  additions: { type: Number },
  deletions: { type: Number },
  changes: { type: Number },
  patch: { type: String },
  rawUrl: { type: String },
  blobUrl: { type: String }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

CommitFileSchema.index({ commitId: 1 });
CommitFileSchema.index({ repositoryId: 1 });

module.exports = mongoose.model('CommitFile', CommitFileSchema);