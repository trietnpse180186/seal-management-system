/**
 * System-Level Harness: Layer 06 - Observability & Human Approval Manager
 * Centralizes Human-in-the-Loop approval workflows and telemetry metrics.
 */

const mongoose = require('mongoose');

const REQUIRE_HUMAN_APPROVAL = process.env.REQUIRE_HUMAN_APPROVAL === 'true';

// Telemetry counters
const telemetryStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalTokensUsed: 0,
  totalLatencyMs: 0
};

/**
 * Log token usage and latency metrics for global observability
 */
function recordTelemetry(latencyMs, tokenCount = 0, isSuccess = true) {
  telemetryStats.totalRequests++;
  telemetryStats.totalLatencyMs += latencyMs;
  if (isSuccess) {
    telemetryStats.successfulRequests++;
  } else {
    telemetryStats.failedRequests++;
  }
  if (tokenCount) {
    telemetryStats.totalTokensUsed += tokenCount;
  }
  
  console.log(`[TELEMETRY] Logged AI Call - Latency: ${latencyMs}ms, Success: ${isSuccess}. Cumulative requests: ${telemetryStats.totalRequests}`);
}

/**
 * Get current system telemetry statistics
 */
function getTelemetryStats() {
  return { ...telemetryStats };
}

/**
 * Checks if a review requires human approval before publishing
 */
function requiresHumanApproval(aiResult) {
  if (!REQUIRE_HUMAN_APPROVAL) return false;
  
  // Requires approval if AI reports significant codebase changes
  return aiResult?.overall_picture?.significant_change === true || aiResult?.significant_change === true;
}

/**
 * Updates an analysis status to 'pending_review'
 */
async function markForHumanApproval(aiAnalysisId) {
  const AiAnalysis = mongoose.model('AiAnalysis');
  const record = await AiAnalysis.findById(aiAnalysisId);
  if (record) {
    record.status = 'pending_review';
    await record.save();
    console.log(`[HITL MANAGER] Analysis ${aiAnalysisId} marked as pending_review.`);
    return record;
  }
  return null;
}

/**
 * Approves a pending review
 */
async function approveReview(aiAnalysisId) {
  const AiAnalysis = mongoose.model('AiAnalysis');
  const record = await AiAnalysis.findById(aiAnalysisId);
  if (record) {
    record.status = 'approved';
    record.completedAt = new Date();
    await record.save();
    console.log(`[HITL MANAGER] Human approved analysis ${aiAnalysisId}.`);
    return record;
  }
  return null;
}

module.exports = {
  REQUIRE_HUMAN_APPROVAL,
  requiresHumanApproval,
  markForHumanApproval,
  approveReview,
  recordTelemetry,
  getTelemetryStats
};
