/**
 * System-Level Harness: Layer 04 - Context & State Store
 * Manages memory storage, session persistence, and aggregate history retrievals.
 * Supports full Evidence Map serialization from Agent 1 reviews to Agent 2.
 */

const dbTools = require('../../features/github-ai/tools/dbTools');
const mongoose = require('mongoose');

/**
 * Load team historical memory and rich context for AI analysis (Agent 2)
 */
async function loadTeamAggregateContext(teamId, commitsLimit = 40, reviewsLimit = 15) {
  let commits = [];
  let priorReviews = [];
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      commits = await dbTools.fetchTeamCommits(teamId, commitsLimit);
      priorReviews = await dbTools.fetchPriorReviews(teamId, reviewsLimit);
    }
  } catch (err) {
    console.warn('[CONTEXT STORE] Warning fetching commits/reviews:', err.message);
  }

  const commitSummaries = commits.map((c, idx) => 
    `[${idx + 1}] SHA: ${c.commitSha ? c.commitSha.substring(0, 7) : 'N/A'}, Msg: "${c.message || 'N/A'}", Author: ${c.authorName || 'N/A'}, Time: ${c.committedAt ? new Date(c.committedAt).toISOString() : 'N/A'}`
  ).join('\n');

  const detailedReviews = priorReviews.map((r, idx) => {
    let resultObj = r.result;
    if (typeof resultObj === 'string') {
      try {
        resultObj = JSON.parse(resultObj);
      } catch (err) {
        // ignore
      }
    }
    if (!resultObj) return `[Push ${idx + 1}] (Không có dữ liệu review)`;

    const pushSummary = resultObj.overall_picture?.push_summary || resultObj.summary || 'Không có tóm tắt';
    const focus = resultObj.overall_picture?.current_focus || resultObj.system_identity?.current_focus || 'Chưa rõ';
    const track = resultObj.system_identity?.detected_track || 'Chưa xác định';
    const agents = (resultObj.multi_agent_architecture?.agents_and_roles || []).join('; ') || 'Chưa quan sát';
    const handoff = resultObj.multi_agent_architecture?.handoff_mechanism || 'Chưa quan sát';
    const multiAgentSubstantive = resultObj.multi_agent_architecture?.is_multi_agent_substantive ? 'Có' : 'Chưa rõ/Không';
    const devices = (resultObj.iot_integration?.devices_observed || []).join(', ') || 'Chưa quan sát';
    const mqttDecision = resultObj.iot_integration?.decision_influence || 'Chưa rõ';
    const readTools = (resultObj.tools_and_verification?.read_tools || []).join(', ') || 'Không';
    const writeTools = (resultObj.tools_and_verification?.state_changing_tools || []).join(', ') || 'Không';
    const verification = resultObj.tools_and_verification?.verification_mechanism || 'Chưa có';
    const approval = resultObj.safety_transparency_and_ux?.human_approval || 'Chưa có';
    const audit = resultObj.safety_transparency_and_ux?.audit_trace || 'Chưa có';

    // Extract rubric evidence summary
    let rubricEvidenceStr = '';
    if (resultObj.rubric_evidence) {
      rubricEvidenceStr = Object.entries(resultObj.rubric_evidence)
        .map(([k, v]) => `  - ${k}: status=${v?.status || 'N/A'}, evidence=${(v?.evidence || []).join('; ') || 'None'}, gaps=${(v?.gaps || []).join('; ') || 'None'}`)
        .join('\n');
    }

    return `--- ĐỢT PUSH REVIEW #${idx + 1} (${r.completedAt ? new Date(r.completedAt).toISOString() : 'N/A'}) ---
Tóm tắt push: ${pushSummary}
Tiêu điểm: ${focus} | Track nhận diện: ${track}
Multi-Agent: ${agents} (Thực chất: ${multiAgentSubstantive}) | Handoff: ${handoff}
Thiết bị IoT: ${devices} | Ảnh hưởng quyết định: ${mqttDecision}
Tool đọc: ${readTools} | Tool ghi: ${writeTools} | Verification: ${verification}
Human Approval: ${approval} | Audit Trace: ${audit}
Bằng chứng Rubric:
${rubricEvidenceStr || '  (Chưa ghi nhận rubric evidence chi tiết)'}
`;
  }).join('\n\n');

  let roundCriteria = [];
  let trackName = 'Unknown Track';
  let teamCode = 'team-unknown';
  let repoName = 'unknown-repo';
  let repositoryId = null;
  let roundId = null;
  let trackId = null;

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const Team = mongoose.model('Team');
      const Rubric = mongoose.model('Rubric');
      const Criterion = mongoose.model('Criterion');
      const GithubRepository = mongoose.model('GithubRepository');

      const team = await Team.findById(teamId).populate('trackId');
      if (team) {
        teamCode = team.code || team.name || teamId;
        if (team.trackId) {
          trackName = team.trackId.name || 'Unknown Track';
          trackId = team.trackId._id;
        }
        roundId = team.currentRoundId;
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

      const repo = await GithubRepository.findOne({ teamId });
      if (repo) {
        repoName = repo.repoName || 'unknown-repo';
        repositoryId = repo._id;
      }
    }
  } catch (err) {
    console.error('[CONTEXT STORE ERROR] Failed loading team/rubric metadata:', err.message);
  }

  let criteriaPrompt = '';
  if (roundCriteria.length > 0) {
    criteriaPrompt = roundCriteria.map(c => 
      `- ${c.code}: ${c.name} (criterionId: ${c._id}, weight: ${c.weight || 0}%, maxScore: ${c.maxScore}đ, mô tả: ${c.description || 'Không có'}, gradingLevels: ${JSON.stringify(c.gradingLevels || [])})`
    ).join('\n');
  } else {
    criteriaPrompt = `
- R1_01: MQTT / IoT như nguồn quan sát và ngữ cảnh quyết định (weight: 25%, maxScore: 5)
- R1_02: Phối hợp Multi-Agent (vai trò, handoff) (weight: 25%, maxScore: 5)
- R1_03: Tool/API bên ngoài + Verification (weight: 20%, maxScore: 5)
- R1_04: Phù hợp Domain, UX và human approval (weight: 15%, maxScore: 5)
- R1_05: Sáng tạo, giá trị sản phẩm và Demo (weight: 15%, maxScore: 5)
- R2_01: Sáng tạo và giá trị sản phẩm (weight: 25%, maxScore: 5)
- R2_02: Chất lượng phối hợp Multi-Agent (weight: 25%, maxScore: 5)
- R2_03: Tương tác IoT và thế giới bên ngoài (Tool/API) (weight: 20%, maxScore: 5)
- R2_04: Khả năng hoàn thành tác vụ & ổn định (weight: 15%, maxScore: 5)
- R2_05: Minh bạch, an toàn, giải thích, UX & phản biện (weight: 15%, maxScore: 5)`;
  }

  const aggregateContext = `
=========================================
LỊCH SỬ COMMIT (${commits.length} commits gần nhất):
=========================================
${commitSummaries || 'Không có commit nào.'}

=========================================
TỔNG HỢP REVIEW AGENT 1 QUA CÁC ĐỢT PUSH (${priorReviews.length} đợt review đã lưu):
=========================================
${detailedReviews || 'Chưa có review nào từ Agent 1.'}
`;

  return {
    teamId,
    teamCode,
    repoName,
    repositoryId,
    roundId,
    trackId,
    trackName,
    commits,
    priorReviews,
    commitSummaries,
    reviewSummaries: detailedReviews,
    aggregateContext,
    roundCriteria,
    criteriaPrompt
  };
}

module.exports = {
  loadTeamAggregateContext
};
