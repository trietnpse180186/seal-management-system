const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AiAnalysisSchema = new Schema({
  repositoryId: { type: Schema.Types.ObjectId, ref: 'GithubRepository', required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
  commitId: { type: Schema.Types.ObjectId, ref: 'Commit' },
  repositorySnapshotId: { type: Schema.Types.ObjectId, ref: 'RepositorySnapshot' },
  analysisType: { type: String, enum: ['commit_review', 'repository_review', 'readme_summary', 'scoring_suggestion'], required: true },
  provider: { type: String },
  model: { type: String },
  prompt: { type: String },
  inputSummary: { type: Schema.Types.Mixed },
  result: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

AiAnalysisSchema.index({ repositoryId: 1 });
AiAnalysisSchema.index({ teamId: 1 });
AiAnalysisSchema.index({ roundId: 1 });
AiAnalysisSchema.index({ commitId: 1 });
AiAnalysisSchema.index({ repositorySnapshotId: 1 });

module.exports = mongoose.model('AiAnalysis', AiAnalysisSchema);