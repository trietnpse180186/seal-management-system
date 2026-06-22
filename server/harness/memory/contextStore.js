/**
 * System-Level Harness: Layer 04 - Context & State Store
 * Manages memory storage, session persistence, and aggregate history retrievals.
 */

const dbTools = require('../../features/github-ai/tools/dbTools');
const mongoose = require('mongoose');

/**
 * Load team historical memory and context for AI analysis
 */
async function loadTeamAggregateContext(teamId, commitsLimit = 200, reviewsLimit = 40) {
  const commits = await dbTools.fetchTeamCommits(teamId, commitsLimit);
  const priorReviews = await dbTools.fetchPriorReviews(teamId, reviewsLimit);

  const commitSummaries = commits.map(c => `SHA: ${c.commitSha.substring(0, 7)}, Msg: ${c.message}, Committed: ${c.committedAt}`).join('\n');
  const reviewSummaries = priorReviews.map(r => {
    // Safely parse results
    let resultObj = r.result;
    if (typeof resultObj === 'string') {
      try {
        resultObj = JSON.parse(resultObj);
      } catch (err) {
        // ignore
      }
    }
    return `Level: ${resultObj?.rag_maturity?.level || 'Basic'}, Summary: ${resultObj?.overall_picture?.push_summary || ''}`;
  }).join('\n');

  // Fetch active criteria based on team's current round
  const Team = mongoose.model('Team');
  const Rubric = mongoose.model('Rubric');
  const Criterion = mongoose.model('Criterion');

  let roundCriteria = [];
  try {
    const team = await Team.findById(teamId);
    if (team) {
      let roundId = team.currentRoundId;
      if (!roundId) {
        const Round = mongoose.model('Round');
        const activeRound = await Round.findOne({ eventId: team.eventId, status: 'active' });
        if (activeRound) {
          roundId = activeRound._id;
        } else {
          const firstRound = await Round.findOne({ eventId: team.eventId }).sort({ order: 1 });
          if (firstRound) {
            roundId = firstRound._id;
          }
        }
      }

      if (roundId) {
        const rubric = await Rubric.findOne({ roundId, isActive: true });
        if (rubric) {
          roundCriteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });
        }
      }
    }
  } catch (err) {
    console.error('[CONTEXT STORE ERROR] Failed loading round criteria:', err.message);
  }

  let criteriaPrompt = '';
  if (roundCriteria.length > 0) {
    criteriaPrompt = roundCriteria.map(c => `- **${c.code}**: ${c.name} (Mô tả: ${c.description || 'Không có mô tả.'}, Điểm tối đa: ${c.maxScore}đ)`).join('\n');
  } else {
    criteriaPrompt = `
- **R1_01**: Problem & Solution Suitability
- **R1_02**: Data Pipeline
- **R1_03**: Retrieval & Citation
- **R1_04**: Intent & Prompting
- **R1_05**: Presentation/Documentation
- **R2_01**: Agent & Multi-hop
- **R2_02**: Model Resources Management
- **R2_03**: Production-grade Operations
- **R2_04**: Extensibility/Creativity
- **R2_05**: Defensibility/Q&A preparation`;
  }

  return {
    commits,
    priorReviews,
    commitSummaries,
    reviewSummaries,
    roundCriteria,
    criteriaPrompt
  };
}

module.exports = {
  loadTeamAggregateContext
};
