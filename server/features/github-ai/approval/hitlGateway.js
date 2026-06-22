/**
 * Human Approval Layer
 * Manages human approval gates, state transitions, and manual overrides.
 */

const dbTools = require('../tools/dbTools');
const mongoose = require('mongoose');

const REQUIRE_HUMAN_APPROVAL = process.env.REQUIRE_HUMAN_APPROVAL === 'true';

/**
 * Decides whether a review needs human approval before performing external publishing
 */
function requiresHumanApproval(aiResult) {
  if (!REQUIRE_HUMAN_APPROVAL) return false;
  
  // If there's a significant change, we want a human to verify before posting issues publicly
  return aiResult?.overall_picture?.significant_change === true || aiResult?.significant_change === true;
}

/**
 * Marks an analysis record status as 'pending_review'
 */
async function markReviewForHumanApproval(aiAnalysisId) {
  const AiAnalysis = mongoose.model('AiAnalysis');
  const record = await AiAnalysis.findById(aiAnalysisId);
  if (record) {
    record.status = 'pending_review';
    await record.save();
    console.log(`[HITL GATEWAY] Marked analysis ${aiAnalysisId} as pending_review.`);
    return record;
  }
  return null;
}

/**
 * Approve a pending review, transitioning status to 'completed' / 'approved'
 */
async function approveReview(aiAnalysisId) {
  const AiAnalysis = mongoose.model('AiAnalysis');
  const record = await AiAnalysis.findById(aiAnalysisId);
  if (record) {
    record.status = 'approved';
    record.completedAt = new Date();
    await record.save();
    console.log(`[HITL GATEWAY] Human approved analysis ${aiAnalysisId}.`);
    
    // Optionally trigger external actions here, like publishing Github Issues
    return record;
  }
  return null;
}

module.exports = {
  REQUIRE_HUMAN_APPROVAL,
  requiresHumanApproval,
  markReviewForHumanApproval,
  approveReview
};
