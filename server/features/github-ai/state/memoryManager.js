/**
 * State Management Layer
 * Manages contextual memory, history aggregation, and data handoffs.
 */

const dbTools = require('../tools/dbTools');
const mongoose = require('mongoose');

/**
 * Load and format historical context and active rubric criteria for a team
 */
async function loadTeamAggregateContext(teamId) {
  // 1. Fetch commits and prior reviews using dbTools
  const commits = await dbTools.fetchTeamCommits(teamId, 200);
  const priorReviews = await dbTools.fetchPriorReviews(teamId, 40);

  const commitSummaries = commits.map(c => `SHA: ${c.commitSha.substring(0, 7)}, Msg: ${c.message}, Committed: ${c.committedAt}`).join('\n');
  const reviewSummaries = priorReviews.map(r => {
    const resultObj = typeof r.result === 'string' ? JSON.parse(r.result) : r.result;
    return `Level: ${resultObj?.rag_maturity?.level || 'Basic'}, Summary: ${resultObj?.overall_picture?.push_summary || ''}`;
  }).join('\n');

  // 2. Fetch active rubric criteria based on team's current round
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
    console.error('Error fetching round criteria in memoryManager:', err.message);
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
