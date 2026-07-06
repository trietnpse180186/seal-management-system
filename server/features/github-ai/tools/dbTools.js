/**
 * Execution Tools Layer - Database interactions
 * Exposes MongoDB database queries and updates.
 */

const mongoose = require('mongoose');

// Retrieve models dynamically
const getModels = () => {
  return {
    AiAnalysis: mongoose.model('AiAnalysis'),
    Commit: mongoose.model('Commit'),
    GithubRepository: mongoose.model('GithubRepository'),
    Team: mongoose.model('Team')
  };
};

/**
 * Save or update an AI analysis record in MongoDB
 */
async function saveAiAnalysisRecord(payload) {
  const { AiAnalysis } = getModels();
  const {
    analysisId,
    repositoryId,
    teamId,
    commitId,
    analysisType,
    result,
    status = 'completed',
    provider,
    model,
    errorMessage
  } = payload;

  let aiAnalysis = null;
  if (analysisId) {
    aiAnalysis = await AiAnalysis.findById(analysisId);
  }

  if (!aiAnalysis && commitId) {
    aiAnalysis = await AiAnalysis.findOne({ commitId, analysisType });
  }

  if (aiAnalysis) {
    if (result) aiAnalysis.result = result;
    aiAnalysis.status = status;
    if (provider) aiAnalysis.provider = provider;
    if (model) aiAnalysis.model = model;
    if (errorMessage) aiAnalysis.errorMessage = errorMessage;
    aiAnalysis.completedAt = new Date();
    await aiAnalysis.save();
    return aiAnalysis;
  } else {
    aiAnalysis = new AiAnalysis({
      repositoryId,
      teamId,
      commitId,
      analysisType,
      provider: provider || 'Google Gemini',
      model: model || 'gemini-3.1-flash-lite',
      result,
      status,
      errorMessage,
      completedAt: status === 'completed' ? new Date() : null
    });
    await aiAnalysis.save();
    return aiAnalysis;
  }
}

/**
 * Update the diffSummary of a Commit
 */
async function updateCommitDiffSummary(commitId, summary) {
  if (!commitId) return null;
  const { Commit } = getModels();
  const commit = await Commit.findById(commitId);
  if (commit) {
    commit.diffSummary = summary || '';
    await commit.save();
    return commit;
  }
  return null;
}

/**
 * Fetch all active repositories
 */
async function fetchActiveRepositories() {
  const { GithubRepository } = getModels();
  return await GithubRepository.find({ isArchived: false });
}

/**
 * Fetch commits for a specific team
 */
async function fetchTeamCommits(teamId, limit = 200) {
  const { Commit } = getModels();
  return await Commit.find({ teamId, message: { $not: /initial commit/i } }).sort({ committedAt: 1 }).limit(limit);
}

/**
 * Fetch prior reviews for a team
 */
async function fetchPriorReviews(teamId, limit = 40) {
  const { AiAnalysis } = getModels();
  return await AiAnalysis.find({
    teamId,
    analysisType: 'commit_review',
    status: 'completed'
  }).sort({ createdAt: -1 }).limit(limit);
}

module.exports = {
  saveAiAnalysisRecord,
  updateCommitDiffSummary,
  fetchActiveRepositories,
  fetchTeamCommits,
  fetchPriorReviews
};
