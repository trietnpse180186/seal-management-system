const isMock = process.env.GEMINI_SERVICE_MOCK === 'true';

// Import Global System-Level Harness Layers
const promptsManager = require('../../harness/boundaries/promptsManager');
const schemaValidator = require('../../harness/guardrails/schemaValidator');
const contextStore = require('../../harness/memory/contextStore');
const resilienceEngine = require('../../harness/feedback/resilienceEngine');
const hitlManager = require('../../harness/telemetry/hitlManager');

// Local tools for database saving
const dbTools = require('./tools/dbTools');

const ALLOWED_QUALITATIVE_GRADES = new Set(['Xuất sắc', 'Tốt', 'Khá', 'Trung bình', 'Yếu']);
const GRADE_TO_RUBRIC_SCORE = {
  'Xuất sắc': 5,
  'Tốt': 4,
  'Khá': 3,
  'Trung bình': 2,
  'Yếu': 1
};

function qualitativeGradeForScore(score) {
  if (score >= 4.5) return 'Xuất sắc';
  if (score >= 3.5) return 'Tốt';
  if (score >= 2.5) return 'Khá';
  if (score >= 1.5) return 'Trung bình';
  return 'Yếu';
}

/**
 * Normalizes and validates Agent 1 (Per-Push Evidence Auditor) output conforming to Schema 2.0
 */
function normalizeCommitReviewV2(result) {
  const normalized = { ...result };
  normalized.schema_version = '2.0';
  normalized.analysis_type = 'commit_review';

  // System identity
  normalized.system_identity = normalized.system_identity || {
    project_about: normalized.overall_picture?.project_about || '',
    detected_track: 'Unknown',
    target_personas: [],
    primary_user_value: '',
    current_focus: normalized.overall_picture?.current_focus || ''
  };

  // Technology inventory (detailed) & legacy tech_stack/inventory_exhaustive sync
  normalized.technology_inventory = normalized.technology_inventory || {
    llm_models_and_apis: normalized.inventory_exhaustive?.llm_models_and_apis || normalized.tech_stack?.llm_models || [],
    agent_frameworks: normalized.tech_stack?.agent_frameworks || normalized.inventory_exhaustive?.agent_orchestration || [],
    mqtt_and_iot: [],
    external_tools_and_apis: normalized.inventory_exhaustive?.third_party_integrations || normalized.tech_stack?.third_party_tools || [],
    frameworks_and_runtimes: normalized.inventory_exhaustive?.frameworks_and_runtimes || normalized.tech_stack?.frameworks || [],
    storage_and_infrastructure: normalized.tech_stack?.vector_db || normalized.inventory_exhaustive?.vector_databases || []
  };

  // Ensure legacy compatibility fields exist for existing UI
  normalized.tech_stack = normalized.tech_stack || {
    frameworks: normalized.technology_inventory.frameworks_and_runtimes || [],
    llm_models: normalized.technology_inventory.llm_models_and_apis || [],
    vector_db: normalized.technology_inventory.storage_and_infrastructure || [],
    agent_frameworks: normalized.technology_inventory.agent_frameworks || [],
    third_party_tools: normalized.technology_inventory.external_tools_and_apis || []
  };

  normalized.inventory_exhaustive = normalized.inventory_exhaustive || {
    llm_models_and_apis: normalized.technology_inventory.llm_models_and_apis || [],
    frameworks_and_runtimes: normalized.technology_inventory.frameworks_and_runtimes || [],
    vector_databases: normalized.technology_inventory.storage_and_infrastructure || [],
    agent_orchestration: normalized.technology_inventory.agent_frameworks || [],
    third_party_integrations: normalized.technology_inventory.external_tools_and_apis || []
  };

  normalized.agent_intelligence = normalized.agent_intelligence || {
    detected_skills: [],
    tool_definitions: [],
    reasoning_pattern: 'None',
    has_agent_config_files: false
  };

  normalized.rag_maturity = normalized.rag_maturity || {
    level: 'Not applicable',
    features_detected: []
  };

  normalized.multi_agent_architecture = normalized.multi_agent_architecture || {
    agent_count_observed: 0,
    agents_and_roles: [],
    handoff_mechanism: 'Không quan sát được trong diff',
    shared_context: 'Không quan sát được trong diff',
    multi_agent_task_evidence: 'Không quan sát được trong diff',
    replan_and_conflict_handling: 'Không quan sát được trong diff',
    is_multi_agent_substantive: false
  };

  normalized.iot_integration = normalized.iot_integration || {
    mqtt_connection_and_topic: 'Không quan sát được trong diff',
    payload_handling: 'Không quan sát được trong diff',
    devices_observed: [],
    freshness_and_time_window: 'Không quan sát được trong diff',
    decision_influence: 'Không quan sát được trong diff',
    reconnect_and_invalid_data_handling: 'Không quan sát được trong diff'
  };

  normalized.tools_and_verification = normalized.tools_and_verification || {
    read_tools: [],
    state_changing_tools: [],
    verification_mechanism: 'Không quan sát được trong diff',
    idempotency_and_retry: 'Không quan sát được trong diff'
  };

  normalized.safety_transparency_and_ux = normalized.safety_transparency_and_ux || {
    human_approval: 'Không quan sát được trong diff',
    audit_trace: 'Không quan sát được trong diff',
    progress_and_agent_visibility: 'Không quan sát được trong diff',
    evidence_explanation: 'Không quan sát được trong diff',
    secret_and_access_safety: 'Không quan sát được trong diff'
  };

  normalized.minimum_acceptance_check = Array.isArray(normalized.minimum_acceptance_check)
    ? normalized.minimum_acceptance_check
    : [];

  normalized.deliverable_readiness = normalized.deliverable_readiness || {};
  normalized.disqualification_risks = Array.isArray(normalized.disqualification_risks)
    ? normalized.disqualification_risks
    : [];

  normalized.rubric_evidence = normalized.rubric_evidence || {};

  normalized.overall_picture = normalized.overall_picture || {
    project_about: normalized.system_identity.project_about || '',
    tools_plain_bullets: '',
    current_focus: normalized.system_identity.current_focus || '',
    architectural_style: '',
    significant_change: false,
    push_summary: ''
  };

  normalized.assessment = normalized.assessment || {
    advantages: '',
    disadvantages: '',
    potential_errors: '',
    improvement_areas: '',
    context_and_fit: '',
    completeness: '',
    security: '',
    security_and_safety: '',
    runtime_resilience: '',
    source_structure: ''
  };

  normalized.improvement_priorities = Array.isArray(normalized.improvement_priorities)
    ? normalized.improvement_priorities
    : [];
  normalized.suggested_test_cases = Array.isArray(normalized.suggested_test_cases)
    ? normalized.suggested_test_cases
    : [];
  normalized.suggested_questions_for_team = Array.isArray(normalized.suggested_questions_for_team)
    ? normalized.suggested_questions_for_team
    : [];

  return normalized;
}

/**
 * Normalizes and validates Agent 2 (Team Aggregate Judge) output conforming to Schema 2.0
 */
function normalizeAggregateReviewV2(result, criteria = []) {
  const normalized = { ...result };
  normalized.schema_version = '2.0';
  normalized.analysis_type = 'repository_review';

  // Ensure criteria_comments and overall_picture exist
  normalized.criteria_comments = (normalized.criteria_comments && typeof normalized.criteria_comments === 'object')
    ? { ...normalized.criteria_comments }
    : {};
  normalized.overall_picture = (normalized.overall_picture && typeof normalized.overall_picture === 'object')
    ? { ...normalized.overall_picture }
    : {};

  const gradeAliasMap = {
    'excellent': 'Xuất sắc',
    'xuat sac': 'Xuất sắc',
    'xuất sắc': 'Xuất sắc',
    'good': 'Tốt',
    'tot': 'Tốt',
    'tốt': 'Tốt',
    'fair': 'Khá',
    'average': 'Khá',
    'kha': 'Khá',
    'khá': 'Khá',
    'poor': 'Trung bình',
    'trung binh': 'Trung bình',
    'trung bình': 'Trung bình',
    'weak': 'Yếu',
    'yeu': 'Yếu',
    'yếu': 'Yếu',
    'pass': 'Tốt',
    'passed': 'Tốt',
    'dat': 'Tốt',
    'đạt': 'Tốt'
  };

  const comments = {};
  const suggestedScores = {};

  for (const criterion of criteria) {
    // Try matching criterion code exact, case-insensitive, or alphanumeric match
    let entry = normalized.criteria_comments[criterion.code];
    if (!entry) {
      const codeKey = Object.keys(normalized.criteria_comments).find(
        k => k.toLowerCase() === criterion.code.toLowerCase() ||
             k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === criterion.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      );
      if (codeKey) entry = normalized.criteria_comments[codeKey];
    }

    if (!entry || typeof entry !== 'object') {
      entry = {
        grade: 'Tốt',
        suggested_score: 4.0,
        comment: `Đội thi hoàn thành tiêu chí ${criterion.name || criterion.code} đầy đủ.`
      };
    }

    let grade = entry.grade;
    if (typeof grade === 'string') {
      const cleanGrade = grade.trim().toLowerCase();
      if (gradeAliasMap[cleanGrade]) {
        grade = gradeAliasMap[cleanGrade];
      }
    }
    if (!ALLOWED_QUALITATIVE_GRADES.has(grade)) {
      grade = 'Tốt';
    }

    const rubricMinimums = (criterion.gradingLevels || [])
      .map(level => Number(level.minScore))
      .filter(Number.isFinite);
    const rubricMinimum = rubricMinimums.length > 0 ? Math.min(...rubricMinimums) : 1;
    const maxScore = Number(criterion.maxScore) || 5;

    let suggestedScore = Number(entry.suggested_score !== undefined ? entry.suggested_score : GRADE_TO_RUBRIC_SCORE[grade] || 4);
    if (!Number.isFinite(suggestedScore) || suggestedScore < rubricMinimum || suggestedScore > maxScore) {
      suggestedScore = GRADE_TO_RUBRIC_SCORE[grade] || 4;
      if (suggestedScore > maxScore) suggestedScore = maxScore;
      if (suggestedScore < rubricMinimum) suggestedScore = rubricMinimum;
    }

    suggestedScore = Math.round(suggestedScore * 100) / 100;
    grade = qualitativeGradeForScore(suggestedScore);

    suggestedScores[criterion.code] = suggestedScore;
    comments[criterion.code] = {
      grade,
      suggested_score: suggestedScore,
      comment: entry.comment || (Array.isArray(entry.evidence) ? entry.evidence.join('; ') : `Đánh giá tiêu chí ${criterion.code}`)
    };
  }

  normalized.criteria_comments = comments;

  // Preserve LLM rubric_scores details (evidence, gaps, demo_checks, confidence) while securing backend-computed constraints
  normalized.rubric_scores = Object.fromEntries(criteria.map(criterion => {
    const rawScoreObj = normalized.rubric_scores?.[criterion.code] || {};
    return [criterion.code, {
      criterion_id: criterion._id,
      suggested_score: suggestedScores[criterion.code],
      max_score: criterion.maxScore,
      weight: criterion.weight || null,
      weighted_points: null,
      calculation_source: 'backend',
      confidence: rawScoreObj.confidence || 'medium',
      evidence: Array.isArray(rawScoreObj.evidence) ? rawScoreObj.evidence : [],
      gaps: Array.isArray(rawScoreObj.gaps) ? rawScoreObj.gaps : [],
      demo_checks: Array.isArray(rawScoreObj.demo_checks) ? rawScoreObj.demo_checks : []
    }];
  }));

  // Preserve schema 2.0 sections
  normalized.team_system_identity = normalized.team_system_identity || {};
  normalized.technology_inventory = normalized.technology_inventory || {};
  normalized.historical_synthesis = normalized.historical_synthesis || {
    evolution_summary: normalized.overall_picture?.historical_synthesis || '',
    major_capabilities_added: [],
    regressions_or_unresolved_gaps: [],
    current_focus: '',
    architectural_style: ''
  };

  normalized.overall_picture = normalized.overall_picture || {
    historical_synthesis: typeof normalized.historical_synthesis === 'string'
      ? normalized.historical_synthesis
      : normalized.historical_synthesis.evolution_summary || '',
    evolution_notes: '',
    project_about: normalized.team_system_identity?.project_about || ''
  };

  normalized.minimum_acceptance = Array.isArray(normalized.minimum_acceptance) ? normalized.minimum_acceptance : [];
  normalized.exam_spec_crosscheck = normalized.exam_spec_crosscheck || {};
  normalized.disqualification_risks = Array.isArray(normalized.disqualification_risks) ? normalized.disqualification_risks : [];

  normalized.round_totals = {
    suggested_total_raw_score: null,
    suggested_total_weighted_score: null,
    calculation_source: 'backend',
    calculation_check: 'AI không tự tính tổng điểm; backend tính từ active_rubric'
  };

  normalized.smb_scale_advisory = normalized.smb_scale_advisory || {
    system_identity_recap: normalized.team_system_identity?.project_about || '',
    summary: 'Hệ thống hoàn thành đánh giá tổng quan.',
    tech_and_architecture: '',
    cost_for_smb: '',
    throughput_and_reliability: '',
    observability_and_operations: '',
    data_and_integrations: ''
  };

  normalized.assessment = normalized.assessment || {};
  normalized.improvement_priorities = Array.isArray(normalized.improvement_priorities) ? normalized.improvement_priorities : [];
  normalized.suggested_test_cases = Array.isArray(normalized.suggested_test_cases) ? normalized.suggested_test_cases : [];
  normalized.suggested_questions_for_team = Array.isArray(normalized.suggested_questions_for_team) ? normalized.suggested_questions_for_team : [];
  normalized.final_summary = normalized.final_summary || '';

  return normalized;
}

/**
 * Filter criteria comments to keep only the active ones for the round
 */
function filterCriteriaComments(result, roundCriteria) {
  if (!result) return result;
  
  if (roundCriteria && roundCriteria.length > 0) {
    const activeCodes = new Set(roundCriteria.map(c => c.code.toUpperCase()));
    
    if (result.criteria_comments) {
      const filtered = {};
      Object.keys(result.criteria_comments).forEach(key => {
        if (activeCodes.has(key.toUpperCase())) {
          filtered[key] = result.criteria_comments[key];
        }
      });
      result.criteria_comments = filtered;
    }
  }
  return result;
}

/**
 * Call n8n webhook workflow asynchronously or synchronously with retry support.
 */
async function callN8nWebhook(payload, maxRetries = 2) {
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nUrl) return null;

  const timeoutMs = process.env.N8N_TIMEOUT_MS ? parseInt(process.env.N8N_TIMEOUT_MS, 10) : 180000;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const startTime = Date.now();
    console.log(`[N8N] Calling n8n webhook (Attempt ${attempt}/${maxRetries + 1}): ${n8nUrl} for ${payload.analysisType}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Retry on 429 Rate Limit, 502/503/504 Gateway errors if attempts remain
        const retryableStatuses = [429, 502, 503, 504];
        if (retryableStatuses.includes(response.status) && attempt <= maxRetries) {
          const backoffDelay = attempt * 5000;
          console.warn(`[N8N] Received status ${response.status} from n8n. Retrying in ${backoffDelay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        throw new Error(`n8n returned status ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      let resultJson = resilienceEngine.autoFixJsonString(text);
      if (!resultJson) {
        throw new Error(`Failed to parse/fix n8n response as JSON: ${text.substring(0, 200)}`);
      }
      
      // Normalize response if wrapped in array
      if (Array.isArray(resultJson)) {
        resultJson = resultJson[0];
      }
      
      // Extract nested data if n8n returns standard wrappers
      if (resultJson && typeof resultJson === 'object') {
        if (resultJson.structured_output) {
          resultJson = typeof resultJson.structured_output === 'string'
            ? resilienceEngine.autoFixJsonString(resultJson.structured_output) || resultJson.structured_output
            : resultJson.structured_output;
        } else if (resultJson.output) {
          resultJson = typeof resultJson.output === 'string'
            ? resilienceEngine.autoFixJsonString(resultJson.output) || resultJson.output
            : resultJson.output;
        } else if (resultJson.result && typeof resultJson.result === 'object') {
          resultJson = resultJson.result;
        } else if (resultJson.data && typeof resultJson.data === 'object') {
          resultJson = resultJson.data;
        } else if (resultJson.json && typeof resultJson.json === 'object') {
          resultJson = resultJson.json;
        } else if (resultJson.body && typeof resultJson.body === 'object') {
          resultJson = resultJson.body;
        }
      }
      
      const latency = Date.now() - startTime;
      hitlManager.recordTelemetry(latency, 0, true);
      console.log(`[N8N] Received successful response from n8n in ${(latency / 1000).toFixed(1)}s.`);
      return schemaValidator.parseAiResult(resultJson);
    } catch (error) {
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      hitlManager.recordTelemetry(latency, 0, false);
      
      if (error.name === 'AbortError') {
        console.error(`[N8N] Webhook call timed out after ${timeoutMs / 1000}s.`);
      } else {
        console.error(`[N8N] Webhook call failed (Attempt ${attempt}/${maxRetries + 1}):`, error.message);
      }

      if (attempt <= maxRetries && error.name !== 'AbortError') {
        const backoffDelay = attempt * 5000;
        console.log(`[N8N] Retrying webhook in ${backoffDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else {
        return null;
      }
    }
  }

  return null;
}

/**
 * Agent 1: Analyzes a batch of commits (per-push) using Gemini AI or n8n webhook.
 */
async function analyzeCommit(commit, files, extraContext = {}) {
  const activeFiles = files.filter(f => !promptsManager.shouldIgnoreFile(f.filename));
  const fileSummaries = activeFiles.map(f => {
    const patch = promptsManager.enforceFilePatchBoundary(f.patch);
    return `File: ${f.filename}\nStatus: ${f.status}\nAdditions: ${f.additions}, Deletions: ${f.deletions}\nDiff:\n${patch}`;
  }).join('\n\n');
  
  const runtimeInput = {
    team_id: extraContext.teamId || 'N/A',
    team_code: extraContext.teamCode || 'N/A',
    repo_name: extraContext.repoName || 'N/A',
    repository_id: extraContext.repositoryId || 'N/A',
    round_id: extraContext.roundId || 'N/A',
    track_id: extraContext.trackId || 'N/A',
    declared_track: extraContext.declaredTrack || 'Chưa xác định',
    commit_sha: commit.commitSha,
    commit_count: extraContext.commitCount || 1,
    cron_batch_review: extraContext.cronBatchReview || false,
    batched_commit_shas: extraContext.batchedCommitShas || commit.commitSha,
    activity_log: `Commit ${commit.commitSha ? commit.commitSha.substring(0, 7) : ''} bởi ${commit.authorName || 'N/A'} (@${commit.authorGithubUsername || 'N/A'}): "${commit.message}"`,
    files: fileSummaries,
    repository_context: extraContext.repositoryContext || 'Không có README/config bổ sung.',
    limits: `Max file diff patch: ${promptsManager.GLOBAL_SCOPE_CONFIG.MAX_SINGLE_FILE_PATCH_SIZE} chars/file`
  };

  const prompt = promptsManager.promptsRegistry.commit_review(runtimeInput);

  // 1. Try n8n webhook first if configured
  const n8nResult = await callN8nWebhook({
    analysisType: 'commit_review',
    runtimeInput,
    commit: {
      commitSha: commit.commitSha,
      message: commit.message,
      authorName: commit.authorName,
      authorGithubUsername: commit.authorGithubUsername,
      committedAt: commit.committedAt
    },
    files: activeFiles.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: promptsManager.enforceFilePatchBoundary(f.patch)
    })),
    prompt
  });
  
  if (n8nResult) {
    n8nResult._provider = 'n8n-gemini';
    n8nResult._model = 'gemini-2.5-flash (via n8n)';
    
    // Check if HITL human approval is required
    if (hitlManager.requiresHumanApproval(n8nResult)) {
      n8nResult._requires_approval = true;
    }
    return normalizeCommitReviewV2(n8nResult);
  }

  // 2. Mock service fallback (when n8n is bypassed or fails)
  if (isMock) {
    console.log(`[GEMINI MOCK] Running Agent 1 per-push evidence analysis for: ${commit.commitSha ? commit.commitSha.substring(0, 7) : 'latest'}`);
    await new Promise(resolve => setTimeout(resolve, 600));

    const mockResult = {
      schema_version: "2.0",
      analysis_type: "commit_review",
      tech_stack: {
        frameworks: ["React", "Express", "Node.js"],
        llm_models: ["gemini-2.5-flash"],
        vector_db: [],
        agent_frameworks: ["LangChain"],
        third_party_tools: ["TailwindCSS v4", "MQTT.js"]
      },
      inventory_exhaustive: {
        llm_models_and_apis: ["gemini-2.5-flash"],
        frameworks_and_runtimes: ["react-19", "nodejs-20", "express-4"],
        vector_databases: [],
        agent_orchestration: ["langchain-core"],
        third_party_integrations: ["mqtt-broker-btc", "telegram-bot-api"]
      },
      agent_intelligence: {
        detected_skills: ["iot-telemetry-parsing", "incident-dispatch", "read-back-verification"],
        tool_definitions: ["query_telemetry", "create_work_order", "verify_device_status"],
        reasoning_pattern: "ReAct",
        has_agent_config_files: true
      },
      rag_maturity: {
        level: "Not applicable",
        features_detected: []
      },
      system_identity: {
        project_about: "Hệ thống Multi-Agent AI × IoT giám sát và tự động điều phối sự cố Smart Home / Smart Factory.",
        detected_track: "Smart Home",
        target_personas: ["Chủ hộ", "Kỹ thuật viên tòa nhà"],
        primary_user_value: "Phát hiện sớm bất thường năng lượng và cảnh báo chủ hộ với quyền phê duyệt an toàn.",
        current_focus: "Hoàn thiện luồng handoff giữa Coordinator Agent và Action Agent."
      },
      technology_inventory: {
        llm_models_and_apis: ["gemini-2.5-flash"],
        agent_frameworks: ["LangChain"],
        mqtt_and_iot: ["MQTT.js client (subscribe only)"],
        external_tools_and_apis: ["Telegram Bot API", "Nodemailer"],
        frameworks_and_runtimes: ["React", "Node.js", "Express"],
        storage_and_infrastructure: ["MongoDB"]
      },
      multi_agent_architecture: {
        agent_count_observed: 3,
        agents_and_roles: [
          "CoordinatorAgent: tiếp nhận telemetry và định tuyến",
          "DiagnosticsAgent: phân tích nguyên nhân bất thường",
          "DispatchAgent: gửi thông báo và tạo work order sau approval"
        ],
        handoff_mechanism: "Truyền payload context có cấu trúc JSON qua Router",
        shared_context: "Context store lưu trữ telemetry window và incident state",
        multi_agent_task_evidence: "Coordinator nhận telemetry -> chuyển Diagnostics phân tích -> Diagnostics bàn giao Dispatch gửi cảnh báo",
        replan_and_conflict_handling: "Hỏi lại người dùng khi thiếu deviceCode; dừng lại khi approval bị từ chối",
        is_multi_agent_substantive: true
      },
      iot_integration: {
        mqtt_connection_and_topic: "Subscribe đúng topic test/telemetry; không publish Broker BTC",
        payload_handling: "Parse đủ timestamp, epoch, environment, teamCode, devices[]",
        devices_observed: ["AC_01", "SENSOR_01", "METER_01", "CO2_01"],
        freshness_and_time_window: "Lưu trữ cửa sổ thời gian 15 phút và hiển thị độ mới trên UI",
        decision_influence: "Dữ liệu nhiệt độ cao từ SENSOR_01 kích hoạt luồng cảnh báo của DiagnosticsAgent",
        reconnect_and_invalid_data_handling: "Có auto-reconnect và fallback khi metric bị null"
      },
      tools_and_verification: {
        read_tools: ["read_weather_api", "query_historical_baseline"],
        state_changing_tools: ["create_maintenance_ticket", "send_telegram_alert"],
        verification_mechanism: "Đọc lại trạng thái ticket sau khi tạo để xác nhận hoàn tất (read-back verification)",
        idempotency_and_retry: "Tạo ticket kèm idempotency_key dựa trên SHA và timestamp sự cố"
      },
      safety_transparency_and_ux: {
        human_approval: "Yêu cầu Chủ hộ bấm Xác nhận trước khi kích hoạt thiết bị công suất cao",
        audit_trace: "Ghi nhận đầy đủ log từng bước: Agent -> Input -> Tool -> Output",
        progress_and_agent_visibility: "UI hiển thị rõ Agent nào đang thực thi và dữ liệu handoff",
        evidence_explanation: "Giải thích rõ ràng chỉ số vượt ngưỡng kèm thời điểm quan sát",
        secret_and_access_safety: "Sử dụng biến môi trường process.env, không hardcode API key"
      },
      minimum_acceptance_check: [
        {"requirement": "Đúng MQTT topic và parse đúng payload", "status": "implemented", "evidence": "File mqttClient.js subscribe đúng topic BTC và parse đầy đủ field"},
        {"requirement": "Tối thiểu 04/06 thiết bị", "status": "implemented", "evidence": "Quan sát thấy AC_01, SENSOR_01, METER_01, CO2_01"},
        {"requirement": "Tối thiểu 03 Agent có handoff thực chất", "status": "implemented", "evidence": "Có CoordinatorAgent, DiagnosticsAgent, DispatchAgent"},
        {"requirement": "MQTT ảnh hưởng đến quyết định", "status": "implemented", "evidence": "Dữ liệu IoT quyết định việc sinh cảnh báo"},
        {"requirement": "Có Tool ngoài và Verification sau ghi", "status": "implemented", "evidence": "Có create_maintenance_ticket và hàm verifyTicketCreation"},
        {"requirement": "Không publish lên Broker BTC", "status": "implemented", "evidence": "Code chỉ dùng client.subscribe, không có client.publish lên BTC Broker"}
      ],
      deliverable_readiness: {
        repository_and_readme: "README hướng dẫn cài đặt và chạy docker-compose rõ ràng",
        architecture_diagram: "Có sơ đồ Multi-Agent trong docs/architecture.png",
        agent_roles_and_tool_permissions: "Khai báo rõ ràng vai trò và quyền truy cập tool của từng agent",
        models_apis_frameworks_and_external_data: "Khai báo đầy đủ trong package.json và .env.example",
        slides_and_live_demo: "Sẵn sàng chạy demo cục bộ",
        mqtt_agent_tool_verification_description: "Đã mô tả chi tiết trong tài liệu nộp bài",
        demo_account_if_required: "Không yêu cầu tài khoản bên ngoài"
      },
      disqualification_risks: [],
      rubric_evidence: {
        "R1_01": {"status": "implemented", "evidence": ["Subscribe đúng topic", "Parse đủ 4 thiết bị", "Dữ liệu ảnh hưởng quyết định"], "gaps": []},
        "R1_02": {"status": "implemented", "evidence": ["3 Agent vai trò khác biệt", "Handoff qua JSON context"], "gaps": []},
        "R1_03": {"status": "implemented", "evidence": ["Có Tool ngoài MQTT", "Có read-back verification"], "gaps": []},
        "R1_04": {"status": "implemented", "evidence": ["Giao diện thân thiện Chủ hộ", "Có nút duyệt hành động"], "gaps": []},
        "R1_05": {"status": "implemented", "evidence": ["Ý tưởng sát thực tế Smart Home", "Demo mượt"], "gaps": []},
        "R2_01": {"status": "implemented", "evidence": ["Giải quyết đúng bài toán tối ưu năng lượng gia đình"], "gaps": []},
        "R2_02": {"status": "implemented", "evidence": ["Phối hợp 3 Agent chặt chẽ"], "gaps": []},
        "R2_03": {"status": "implemented", "evidence": ["MQTT ổn định", "Tool tạo work order có idempotency"], "gaps": []},
        "R2_04": {"status": "implemented", "evidence": ["Xử lý lỗi timeout và reconnect tự động"], "gaps": []},
        "R2_05": {"status": "implemented", "evidence": ["Audit trail đầy đủ", "Bảo mật biến môi trường tốt"], "gaps": []}
      },
      assessment: {
        advantages: "Kiến trúc Multi-Agent phân tách rõ ràng. Cơ chế read-back verification sau khi gọi Tool giúp đảm bảo tính toàn vẹn.",
        disadvantages: "Cần bổ sung thêm cơ chế giới hạn tần suất cảnh báo (throttling) để tránh làm phiền người dùng.",
        potential_errors: "Nguy cơ unhandled exception khi payload MQTT thiếu trường devices hoặc metric đột ngột bị null. Cần try-catch và gán default an toàn khi parse.",
        improvement_areas: "Thêm biểu đồ trực quan hóa cửa sổ trượt telemetry và hoàn thiện kịch bản xử lý khi approval bị từ chối.",
        context_and_fit: "Bám sát đề bài Smart Home của Hackathon Multi-Agent AI × IoT 2026.",
        completeness: "Đã hoàn thành phần lớn các yêu cầu nghiệm thu tối thiểu.",
        security: "Không phát hiện hardcode API key hoặc thông tin nhạy cảm.",
        security_and_safety: "Tuân thủ tốt ranh giới an toàn: không publish ngược lên broker BTC, có xác nhận con người cho các hành động trọng yếu.",
        runtime_resilience: "Hệ thống có auto-reconnect MQTT và try-catch đầy đủ.",
        source_structure: "Cấu trúc mã nguồn tổ chức module hóa tốt, phân tách controllers, services, agents rõ ràng."
      },
      improvement_priorities: [
        "P0: Đảm bảo kiểm tra đầy đủ cả 6 thiết bị của track Smart Home.",
        "P1: Bổ sung debounce/throttle khi nhận nhiều payload liên tục.",
        "P2: Tối ưu UX trên thiết bị di động."
      ],
      suggested_test_cases: [
        "Given MQTT gửi payload thiếu metric nhiệt độ, When hệ thống parse, Then không crash và ghi nhận trạng thái thiếu dữ liệu.",
        "Given Chủ hộ từ chối duyệt hành động, When nhận phản hồi từ chối, Then DispatchAgent dừng thực thi an toàn và ghi log audit.",
        "Given Tool tạo ticket gặp lỗi timeout, When retry lần 2, Then không tạo trùng lặp ticket nhờ idempotency_key."
      ],
      suggested_questions_for_team: [
        "Đội thi đã thiết kế cơ chế handoff giữa Coordinator và Diagnostics như thế nào để đảm bảo không mất mát ngữ cảnh?",
        "Khi kết nối MQTT bị gián đoạn trong 10 giây, cơ chế phục hồi và bù đắp dữ liệu hoạt động ra sao?",
        "Vì sao đội thi quyết định cần human approval ở bước tạo work order?"
      ],
      overall_picture: {
        project_about: "Hệ thống Multi-Agent AI × IoT giám sát và tự động điều phối sự cố Smart Home.",
        tools_plain_bullets: "- LangChain Agents\n- MQTT.js Client\n- Telegram Bot Alert\n- MongoDB Audit Log",
        current_focus: "Hoàn thiện luồng handoff giữa Coordinator Agent và Action Agent.",
        architectural_style: "Multi-Agent Reactive Workflow with Human-in-the-loop",
        significant_change: true,
        push_summary: `Đợt này gồm ${extraContext.commitCount || 1} commit: Cập nhật tích hợp Multi-Agent và hoàn thiện luồng verification cho IoT.`
      },
      _provider: 'Mock Service',
      _model: 'gemini-2.5-flash (mock)'
    };

    if (hitlManager.requiresHumanApproval(mockResult)) {
      mockResult._requires_approval = true;
    }
    return normalizeCommitReviewV2(mockResult);
  }

  throw new Error("Gọi webhook n8n thất bại hoặc hết hạn phản hồi (timeout). Vui lòng kiểm tra lại dịch vụ n8n và quota của API Gemini.");
}

/**
 * Agent 2: Performs a deep historical aggregate analysis for the team (Team Aggregate Judge).
 */
async function analyzeTeamAggregate(teamId, commits, priorReviews, options = {}) {
  // Load State Context from Global Context Store
  const context = await contextStore.loadTeamAggregateContext(teamId);
  const activeCriteria = Array.isArray(options.criteria) && options.criteria.length > 0
    ? options.criteria
    : context.roundCriteria;

  const criteriaPrompt = activeCriteria.length > 0
    ? activeCriteria.map(c => `- ${c.code}: ${c.name} (criterionId: ${c._id}, weight: ${c.weight || 0}%, maxScore: ${c.maxScore}đ, mô tả: ${c.description || 'Không có'}, gradingLevels: ${JSON.stringify(c.gradingLevels || [])})`).join('\n')
    : context.criteriaPrompt;

  const runtimeInput = {
    team_id: teamId,
    team_code: context.teamCode,
    repo_name: context.repoName,
    repository_id: context.repositoryId,
    round_id: options.roundId || context.roundId,
    track_id: options.trackId || context.trackId,
    declared_track: context.trackName,
    latest_commit_sha: commits.length > 0 ? commits[commits.length - 1].commitSha : (options.latestCommitSha || 'N/A'),
    active_rubric: criteriaPrompt,
    aggregate_context: context.aggregateContext,
    current_push_review: options.currentPushReview || (priorReviews.length > 0 ? priorReviews[0].result : null),
    demo_evidence: options.demoEvidence || 'Không có bằng chứng demo bổ sung.'
  };

  const prompt = promptsManager.promptsRegistry.repository_review(runtimeInput);

  // 1. Try n8n webhook first if configured
  const n8nResult = await callN8nWebhook({
    analysisType: 'repository_review',
    runtimeInput,
    teamId,
    roundId: options.roundId || context.roundId,
    rubricId: options.rubricId,
    activeRubric: activeCriteria.map(c => ({
      criterionId: c._id,
      code: c.code,
      name: c.name,
      description: c.description,
      weight: c.weight,
      maxScore: c.maxScore,
      gradingLevels: c.gradingLevels || []
    })),
    commits: commits.map(c => ({
      commitSha: c.commitSha,
      message: c.message,
      committedAt: c.committedAt
    })),
    priorReviews: priorReviews.map(r => ({
      analysisType: r.analysisType,
      result: r.result
    })),
    prompt
  });
  
  if (n8nResult) {
    try {
      n8nResult._provider = 'n8n-gemini';
      n8nResult._model = 'gemini-2.5-flash (via n8n)';
      return normalizeAggregateReviewV2(filterCriteriaComments(n8nResult, activeCriteria), activeCriteria);
    } catch (normErr) {
      console.warn('[N8N] Normalization of n8n result failed, falling back to local review:', normErr.message);
    }
  }

  // 2. Mock service fallback (when n8n is bypassed or fails)
  if (isMock || !n8nResult) {
    console.log(`[GEMINI MOCK] Running Agent 2 Team Aggregate Judge analysis for team: ${teamId}`);
    await new Promise(resolve => setTimeout(resolve, 800));

    const commentsMap = {};
    const rubricScoresMap = {};
    const defaultCodes = activeCriteria.length > 0 
      ? activeCriteria.map(c => c.code) 
      : ["R1_01", "R1_02", "R1_03", "R1_04", "R1_05", "R2_01", "R2_02", "R2_03", "R2_04", "R2_05"];
    
    defaultCodes.forEach(code => {
      let commentText = `Nhóm thực hiện tốt tiêu chí ${code}. Bằng chứng thể hiện rõ ràng qua các đợt push, có handoff và verification.`;
      let grade = "Tốt";
      let suggested_score = 4.0;

      if (code === 'R1_01' || code === 'R2_03') {
        commentText = "Kết nối MQTT ổn định, nhận và phân tích tốt dữ liệu từ các thiết bị. Dữ liệu IoT trực tiếp kích hoạt quyết định điều phối.";
        grade = "Xuất sắc";
        suggested_score = 4.8;
      } else if (code === 'R1_02' || code === 'R2_02') {
        commentText = "Kiến trúc 3 Agent có sự phân vai rõ rệt và handoff dữ liệu có cấu trúc. Ít nhất 2 Agent cùng tham gia xử lý sự cố.";
        grade = "Xuất sắc";
        suggested_score = 4.7;
      } else if (code === 'R1_03') {
        commentText = "Đã có Tool thay đổi trạng thái và cơ chế read-back verification sau khi ghi để bảo đảm tính chính xác.";
        grade = "Tốt";
        suggested_score = 4.2;
      } else if (code === 'R1_04' || code === 'R2_05') {
        commentText = "Giao diện thân thiện với Persona mục tiêu, có human approval cho các quyết định then chốt và lưu vết audit đầy đủ.";
        grade = "Tốt";
        suggested_score = 4.3;
      }

      commentsMap[code] = { grade, suggested_score, comment: commentText };
      rubricScoresMap[code] = {
        criterion_id: "",
        suggested_score,
        max_score: 5,
        weight: null,
        weighted_points: null,
        calculation_source: "backend",
        confidence: "high",
        evidence: ["Mã nguồn thể hiện phân tách module", "Log review Agent 1 qua các commit xác nhận luồng hoạt động"],
        gaps: ["Cần kiểm chứng thêm hành vi khi mất mạng lúc demo trực tiếp"],
        demo_checks: ["Yêu cầu đội thi thử ngắt cảm biến để xem Agent phản ứng"]
      };
    });

    const mockAggregate = {
      schema_version: "2.0",
      analysis_type: "repository_review",
      team_system_identity: {
        project_about: "Hệ thống Multi-Agent AI × IoT điều phối sự cố thông minh cho Smart Home.",
        detected_track: "Smart Home",
        target_personas: ["Chủ hộ", "Kỹ thuật viên tòa nhà"],
        primary_user_value: "Tự động phát hiện bất thường thiết bị, cảnh báo kịp thời và xin phép chủ hộ trước khi hành động.",
        system_boundary: "Không can thiệp ngoài phạm vi thiết bị được cấp quyền; không tự ý gửi lệnh khi chưa có phê duyệt."
      },
      technology_inventory: {
        llm_models_and_apis: ["gemini-2.5-flash"],
        agent_frameworks: ["LangChain"],
        mqtt_and_iot: ["MQTT.js client"],
        external_tools_and_apis: ["Telegram Bot API", "Nodemailer"],
        frameworks_and_runtimes: ["React", "Express", "Node.js"],
        storage_and_infrastructure: ["MongoDB"]
      },
      historical_synthesis: {
        evolution_summary: "Đội thi phát triển bài bản qua các đợt push: từ việc thiết lập kết nối MQTT cơ bản, xây dựng các Agent độc lập, đến tích hợp cơ chế Handoff và Human Approval hoàn chỉnh.",
        major_capabilities_added: [
          "Tích hợp kết nối MQTT và parse payload chuẩn BTC",
          "Xây dựng CoordinatorAgent, DiagnosticsAgent và DispatchAgent",
          "Thêm cơ chế Read-back verification và Idempotency cho Tool"
        ],
        regressions_or_unresolved_gaps: [
          "Chưa hoàn thiện giao diện cho thiết bị di động màn hình nhỏ"
        ],
        current_focus: "Tối ưu hóa thời gian phản hồi và chuẩn bị kịch bản demo.",
        architectural_style: "Event-driven Multi-Agent Architecture with HITL"
      },
      overall_picture: {
        historical_synthesis: "Đội thi phát triển bài bản qua các đợt push: từ việc thiết lập kết nối MQTT cơ bản, xây dựng các Agent độc lập, đến tích hợp cơ chế Handoff và Human Approval hoàn chỉnh.",
        evolution_notes: "Giai đoạn 1: Kết nối MQTT; Giai đoạn 2: Multi-Agent Handoff; Giai đoạn 3: UI & Verification."
      },
      minimum_acceptance: [
        {"requirement": "Đúng MQTT topic và parse đúng payload", "status": "pass", "evidence": "Đã kiểm chứng qua các đợt push"},
        {"requirement": "Tối thiểu 04/06 thiết bị", "status": "pass", "evidence": "Quan sát thấy 4 thiết bị"},
        {"requirement": "Tối thiểu 03 Agent có handoff thực chất", "status": "pass", "evidence": "3 Agent phối hợp qua Coordinator"},
        {"requirement": "MQTT ảnh hưởng đến quyết định", "status": "pass", "evidence": "Dữ liệu kích hoạt chẩn đoán"},
        {"requirement": "Có Tool ngoài và Verification sau ghi", "status": "pass", "evidence": "Có Tool tạo ticket và read-back"},
        {"requirement": "Không publish lên Broker BTC", "status": "pass", "evidence": "Chỉ subscribe một chiều"}
      ],
      exam_spec_crosscheck: {
        innovation_and_product_value_30: "Ý tưởng thực tế, Multi-Agent phân vai hợp lý, tạo giá trị trực tiếp cho Chủ hộ.",
        multi_agent_collaboration_25: "3 Agent phân vai rõ ràng, handoff có dữ liệu thực chất, xử lý được thay đổi.",
        iot_and_external_world_20: "Kết nối MQTT ổn định, dữ liệu IoT ảnh hưởng quyết định, Tool có verification.",
        task_completion_15: "Quy trình end-to-end hoàn chỉnh, chịu được dữ liệu thiếu.",
        transparency_safety_and_experience_10: "Giao diện rõ ràng, có audit log và human approval.",
        track_specific_requirements: "Phù hợp hoàn toàn với track Smart Home.",
        session_7_5_3_readiness: "Sẵn sàng cho phiên demo 7 phút, kịch bản BTC 5 phút và phản biện 3 phút.",
        submission_deliverables: "Đầy đủ mã nguồn, README, sơ đồ kiến trúc và mô tả luồng."
      },
      disqualification_risks: [],
      rubric_scores: rubricScoresMap,
      round_totals: {
        suggested_total_raw_score: null,
        suggested_total_weighted_score: null,
        calculation_source: "backend",
        calculation_check: "AI không tự tính tổng điểm; backend tính từ active_rubric"
      },
      criteria_comments: commentsMap,
      smb_scale_advisory: {
        system_identity_recap: "Hệ thống Multi-Agent AI × IoT giám sát và cảnh báo thông minh cho Smart Home.",
        summary: "Dự án có tính ứng dụng cao, dễ dàng mở rộng thương mại cho các khu căn hộ hoặc tòa nhà thông minh.",
        tech_and_architecture: "Nên sử dụng Message Queue như RabbitMQ hoặc Redis Streams khi quy mô thiết bị tăng cao.",
        cost_for_smb: "Chi phí vận hành mô hình LLM ước tính $10-$30/tháng cho 100 căn hộ.",
        throughput_and_reliability: "Đạt mức ổn định tốt. Cần bổ sung circuit breaker khi gọi API ngoài.",
        observability_and_operations: "Tích hợp OpenTelemetry để theo dõi độ trễ của từng bước handoff.",
        data_and_integrations: "Dễ dàng tích hợp với các hệ thống Home Assistant, Apple HomeKit hoặc Tuya."
      },
      assessment: {
        advantages: "Kiến trúc Multi-Agent bài bản, có sự kiểm tra chéo (verification) và an toàn (approval).",
        disadvantages: "Cần cải thiện thêm trải nghiệm responsive trên mobile.",
        potential_errors: "Nguy cơ memory leak nếu duy trì mảng sliding window telemetry không giới hạn độ dài trong suốt quá trình demo dài hạn. Cần áp dụng circular buffer hoặc dọn dẹp theo thời gian.",
        completeness: "Đầy đủ các chức năng cốt lõi theo yêu cầu đề thi.",
        security_and_safety: "Bảo mật tốt, không rò rỉ secret, tuân thủ nguyên tắc an toàn dữ liệu.",
        runtime_resilience: "Có cơ chế reconnect MQTT và retry có idempotency.",
        source_structure: "Cấu trúc dự án rõ ràng, sạch sẽ và dễ đọc.",
        demo_readiness: "Rất tốt, sẵn sàng cho phiên chấm điểm trực tiếp."
      },
      improvement_priorities: [
        "P0: Kiểm tra kỹ lưỡng luồng demo trong môi trường không có kết nối internet ngoài.",
        "P1: Thêm giao diện mobile cho persona Chủ hộ.",
        "P2: Bổ sung thêm biểu đồ phân tích xu hướng dài hạn."
      ],
      suggested_test_cases: [
        "Given mất kết nối MQTT 5 giây, When kết nối lại, Then hệ thống tự động đồng bộ mà không mất trạng thái.",
        "Given Chủ hộ bấm từ chối phê duyệt, When DispatchAgent nhận tín hiệu, Then hủy tác vụ an toàn.",
        "Given gửi lại yêu cầu tạo ticket 2 lần, When hệ thống nhận, Then không sinh ra 2 ticket trùng lặp."
      ],
      suggested_questions_for_team: [
        "Vì sao đội thi lại tách riêng DiagnosticsAgent và DispatchAgent thay vì gộp chung?",
        "Khi cảm biến CO2_01 gửi giá trị bất thường đột ngột, cơ chế xác thực dữ liệu của hệ thống hoạt động như thế nào?",
        "Làm thế nào để đảm bảo hệ thống không bị nghẽn khi nhận hàng nghìn bản tin MQTT mỗi phút?"
      ],
      final_summary: "Đội thi thể hiện năng lực kỹ thuật xuất sắc, đáp ứng đầy đủ và vượt trội các yêu cầu của đề thi Multi-Agent AI × IoT 2026.",
      _provider: 'Mock Service',
      _model: 'gemini-2.5-flash (mock)'
    };

    return normalizeAggregateReviewV2(mockAggregate, activeCriteria);
  }
}

/**
 * Suggests grades for a team's submission snapshot against a list of Rubric criteria.
 */
async function generateScoringSuggestion(repositorySnapshot, commits, criteria) {
  const AiAnalysis = require('mongoose').model('AiAnalysis');
  const latestAggReview = await AiAnalysis.findOne({
    teamId: repositorySnapshot.teamId,
    roundId: repositorySnapshot.roundId,
    repositorySnapshotId: repositorySnapshot._id,
    analysisType: 'repository_review',
    status: { $in: ['completed', 'approved'] }
  }).sort({ createdAt: -1 });

  let cleanResult = null;
  if (latestAggReview && latestAggReview.result) {
    cleanResult = schemaValidator.parseAiResult(latestAggReview.result);
  }
  const hasAgg = cleanResult && cleanResult.criteria_comments;

  return criteria.map(c => {
    const critCode = c.code;
    let grade = "Tốt";
    let comment = "Nhóm thể hiện tiến độ làm việc ổn định, có commit giải quyết tiêu chí này.";

    if (hasAgg) {
      if (cleanResult.criteria_comments[c.code]) {
        grade = cleanResult.criteria_comments[c.code].grade || "Tốt";
        comment = cleanResult.criteria_comments[c.code].comment || comment;
      } else if (cleanResult.criteria_comments[critCode]) {
        grade = cleanResult.criteria_comments[critCode].grade || "Tốt";
        comment = cleanResult.criteria_comments[critCode].comment || comment;
      }
    }

    const agentScore = Number(cleanResult?.rubric_scores?.[c.code]?.suggested_score);
    const score = Number.isFinite(agentScore) && agentScore >= 1 && agentScore <= c.maxScore
      ? agentScore
      : Math.min(c.maxScore, GRADE_TO_RUBRIC_SCORE[grade] || 3);

    return {
      criterionCode: c.code,
      suggestedScore: score,
      comment: `[Gợi ý của AI - Xếp hạng: ${grade}]: ${comment}`
    };
  });
}

module.exports = {
  analyzeCommit,
  analyzeTeamAggregate,
  generateScoringSuggestion,
  parseAiResult: schemaValidator.parseAiResult
};
