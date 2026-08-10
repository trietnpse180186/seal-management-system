function validateScoreSubmissionPolicy(existingScores, actorRole, targetJudgeId) {
  if (!Array.isArray(existingScores) || existingScores.length === 0) {
    return { allowed: true };
  }

  if (!targetJudgeId) {
    return {
      allowed: false,
      reason: 'Thiếu judgeId để xác định quyền chấm điểm.',
    };
  }

  const targetJudgeScore = existingScores.find((score) => {
    const judgeId = score.judgeId || score.judge?._id || score.judge?._id?.toString();
    return judgeId && judgeId.toString() === targetJudgeId.toString();
  });

  if (targetJudgeScore) {
    return {
      allowed: false,
      reason: 'Giám khảo đã gửi kết quả chấm cho đội này. Kết quả hiện đã được khóa.',
      existingScoreStatus: targetJudgeScore.status,
    };
  }

  return { allowed: true };
}

function buildScoreChangeSummary(previousScore, nextScore, criteriaList = []) {
  const criteriaById = new Map(criteriaList.map((criterion) => [criterion._id.toString(), criterion]));
  const previousDetails = Array.isArray(previousScore?.details) ? previousScore.details : [];
  const nextDetails = Array.isArray(nextScore?.details) ? nextScore.details : [];
  const detailsById = new Map(nextDetails.map((detail) => [detail.criterionId?.toString() || detail.criterionId, detail]));

  const changes = [];
  const previousById = new Map(previousDetails.map((detail) => [detail.criterionId?.toString() || detail.criterionId, detail]));

  for (const [criterionId, detail] of detailsById.entries()) {
    const prev = previousById.get(criterionId);
    if (!prev) {
      continue;
    }

    if (prev.scoreValue !== detail.scoreValue) {
      const criterion = criteriaById.get(criterionId);
      changes.push({
        criterionId,
        criterionName: criterion?.name || 'Không xác định',
        change: { from: prev.scoreValue, to: detail.scoreValue },
      });
    }
  }

  return changes;
}

module.exports = {
  validateScoreSubmissionPolicy,
  buildScoreChangeSummary,
};
