/**
 * System-Level Harness: Layer 01 - Constraints & Boundaries
 * Manages prompts, boundaries, token budgets, and scoping rules globally.
 */

const GLOBAL_SCOPE_CONFIG = {
  MAX_SINGLE_FILE_PATCH_SIZE: 3000,
  MAX_AGGREGATED_DIFF_SIZE: 50000,
  
  IGNORED_FILES: [
    '.gitignore',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.env',
    '.env.example',
    'README.md'
  ],

  DESIGN_CONSTRAINTS: {
    NO_3D_COLORED_ICONS: true,
    RULE: 'Never use 3D-styled colored emoji/icon assets (such as 📥, 📤) in code or UI. Always use flat, outline, vector-based SVG icons.'
  }
};

/**
 * Filter and truncate patch content to keep it within safe boundaries
 */
function enforceFilePatchBoundary(patchContent) {
  if (!patchContent) return '';
  if (patchContent.length > GLOBAL_SCOPE_CONFIG.MAX_SINGLE_FILE_PATCH_SIZE) {
    return patchContent.substring(0, GLOBAL_SCOPE_CONFIG.MAX_SINGLE_FILE_PATCH_SIZE) + 
      '\n... [Truncated due to System-Level Harness size limits] ...';
  }
  return patchContent;
}

/**
 * Filter out ignored files
 */
function shouldIgnoreFile(filename) {
  return GLOBAL_SCOPE_CONFIG.IGNORED_FILES.some(skip => filename.endsWith(skip));
}

/**
 * Registry of system-wide prompts
 */
const promptsRegistry = {
  commit_review: (authorName, authorGithubUsername, message, fileSummaries) => `
    You are an expert AI code reviewer. Analyze the following GitHub commit files and patch changes.
    Commit Author: ${authorName} (@${authorGithubUsername})
    Commit Message: ${message}
    
    Files changed:
    ${fileSummaries}
    
    Please provide an analysis in JSON format with the following keys. Do not include markdown code block syntax. Return only raw JSON:
    {
      "tech_stack": {
        "frameworks": ["e.g. React", "FastAPI"],
        "llm_models": ["e.g. Gemini 1.5 Pro"],
        "vector_db": ["e.g. ChromaDB"],
        "agent_frameworks": ["e.g. LangChain"],
        "third_party_tools": ["e.g. TailwindCSS"]
      },
      "inventory_exhaustive": {
        "llm_models_and_apis": [],
        "frameworks_and_runtimes": [],
        "vector_databases": [],
        "agent_orchestration": [],
        "third_party_integrations": []
      },
      "agent_intelligence": {
        "detected_skills": [],
        "tool_definitions": [],
        "reasoning_pattern": "e.g. ReAct | Plan-and-Solve | None",
        "has_agent_config_files": false
      },
      "rag_maturity": {
        "level": "Basic | Advanced | Agentic-RAG",
        "features_detected": ["e.g. hybrid_search", "rerank", "metadata_filtering"]
      },
      "system_identity": {
        "project_about": "",
        "detected_track": "Smart Home | Smart Agriculture | Smart Factory | Unknown",
        "target_personas": [],
        "primary_user_value": "",
        "current_focus": ""
      },
      "multi_agent_architecture": {
        "agent_count_observed": 0,
        "agents_and_roles": [],
        "handoff_mechanism": "",
        "multi_agent_task_evidence": "",
        "is_multi_agent_substantive": false
      },
      "iot_integration": {
        "mqtt_connection_and_topic": "",
        "payload_handling": "",
        "devices_observed": [],
        "decision_influence": "",
        "reconnect_and_invalid_data_handling": ""
      },
      "tools_and_verification": {
        "read_tools": [],
        "state_changing_tools": [],
        "verification_mechanism": "",
        "idempotency_and_retry": ""
      },
      "rubric_evidence": {
        "R1_01": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]},
        "R1_02": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]},
        "R1_03": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]},
        "R1_04": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]},
        "R1_05": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]},
        "R2_01": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]},
        "R2_02": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]},
        "R2_03": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]},
        "R2_04": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]},
        "R2_05": {"status":"implemented|partial|missing|not_observable_in_diff","evidence":[],"gaps":[]}
      },
      "overall_picture": {
        "project_about": "Brief description of what this project does",
        "tools_plain_bullets": "- Tool 1\\n- Tool 2",
        "current_focus": "What the developer is currently working on based on the commits",
        "architectural_style": "e.g. Microservices, MVC",
        "significant_change": true,
        "push_summary": "Summary of the changes in this push"
      },
      "assessment": {
        "advantages": "Pros of the design",
        "disadvantages": "Cons of the design",
        "improvement_areas": "Areas of enhancement",
        "context_and_fit": "How it fits in the hackathon context",
        "source_structure": "Quality of project structure",
        "completeness": "Readiness level",
        "security": "Security warnings (e.g. exposed keys, poor validation)"
      },
      "suggested_test_cases": ["Test case 1", "Test case 2"],
      "suggested_questions_for_team": ["Question 1", "Question 2"],
      "suggested_prompt_refinement": "Refinement suggestions for their LLM prompts"
    }

    IMPORTANT: You MUST write all descriptive fields (especially suggested_questions_for_team, overall_picture.push_summary, overall_picture.current_focus, overall_picture.project_about, assessment.advantages, assessment.disadvantages, assessment.improvement_areas, rubric_evidence, and suggested_test_cases) entirely in fluent, professional Vietnamese.
    Agent 1 never assigns scores. It only records repository evidence and gaps for all SU26 R1/R2 criteria. Demo-only claims must be marked not_observable_in_diff instead of invented.
  `,

  repository_review: (teamId, commitSummaries, reviewSummaries, criteriaPrompt, trackName) => `
    You are an expert AI Judge Auditor for the SEAL Hackathon. Synthesize the development history of team ${teamId}.
    This team is participating in: ${trackName || 'Unknown Track'}

    Use the following inputs:
    
    Commits history (up to 200):
    ${commitSummaries}
    
    Prior reviews (up to 40):
    ${reviewSummaries}
    
    Execute a 3-step reasoning process (B1, B2, B3):
    1. B1 (System Identity): State what the system is, its use case, and boundaries.
    2. B2 (Gap & Risk): Compare code state to target hackathon expectation. Identify technical debt and security risks.
    3. B3 (Improvements): Suggest clear proposals.
    
    Rate the team qualitatively for the following criteria defined in the active Rubric. All qualitative grades MUST choose from ["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu"]:
    ${criteriaPrompt}

    The criteria listed above are the active rubric assigned to the selected round and are the sole source of truth.
    Include exactly one criteria_comments entry for every listed criterion code, with no extra or inferred criteria.
    This rubric uses levels 5, 4, 3, 2, 1 as scoring anchors. Match evidence against the two nearest gradingLevels descriptions.
    Each entry must be an object: {"grade":"Xuất sắc|Tốt|Khá|Trung bình|Yếu","suggested_score":4.5,"comment":"Vietnamese evidence-based comment"}.
    suggested_score may be decimal within [1, maxScore], with at most 2 decimal places, when evidence falls between two adjacent anchors. The comment must explain the interpolation; never exceed the rubric range.
    Keep grade consistent with score: [4.5,5] Xuất sắc; [3.5,4.5) Tốt; [2.5,3.5) Khá; [1.5,2.5) Trung bình; [1,1.5) Yếu.
    Base the assessment on the saved per-push evidence reviews. Missing runtime evidence must lower confidence and be stated as a gap; never invent evidence.
    
    IMPORTANT: You MUST write the detailed assessment comments, overall pictures, evolution notes, reasoning processes, and SMB Advisories entirely in fluent, professional Vietnamese.
    Also compile an SMB Scale Advisory (system_identity_recap, summary, tech_and_architecture, cost_for_smb, throughput_and_reliability, observability_and_operations, data_and_integrations).
    
    Return a raw JSON block without markdown formatting or code block wrapper:
    {
      "criteria_comments": {
        // You MUST include exactly one entry for each criterion code listed above.
        // Format: "CODE": {"grade": "Tốt|Xuất sắc|...", "suggested_score": 1.0..5.0, "comment": "detailed Vietnamese evidence-based comment; explain decimal interpolation when used"}
      },
      "smb_scale_advisory": {
        "system_identity_recap": "system identity recap in Vietnamese",
        "summary": "overall viability summary in Vietnamese",
        "tech_and_architecture": "architecture advice in Vietnamese",
        "cost_for_smb": "estimated API and hosting costs in Vietnamese",
        "throughput_and_reliability": "reliability pointers in Vietnamese",
        "observability_and_operations": "monitoring advice in Vietnamese",
        "data_and_integrations": "integration capabilities in Vietnamese"
      },
      "overall_picture": {
        "historical_synthesis": "overview of the team development progress in Vietnamese",
        "evolution_notes": "notable milestones during the hackathon in Vietnamese"
      }
    }
  `,

  combined_sync_review: (authorName, authorGithubUsername, message, fileSummaries, teamId, commitSummaries, reviewSummaries, criteriaPrompt, detailedRubrics, trackName) => `
    You are an expert AI code reviewer and Hackathon Judge Auditor for the SEAL Hackathon.
    Your task is to analyze the new batch of commits and also synthesize the overall development history of team ${teamId} to evaluate their progress.
    
    The team participating in this Hackathon belongs to: ${trackName || 'Unknown Track'}
    
    IMPORTANT: You MUST evaluate and audit this team based EXCLUSIVELY on the criteria and device checklist of their designated track: ${trackName || 'Unknown Track'}.
    Do NOT check criteria for other tracks.

    =========================================
    PART 1: NEW BATCH OF COMMITS TO REVIEW
    =========================================
    Commit Author: ${authorName} (@${authorGithubUsername})
    Commit Message: ${message}
    
    Files changed in this batch:
    ${fileSummaries}
    
    =========================================
    PART 2: TEAM HISTORICAL MEMORY
    =========================================
    Commits history (up to 200):
    ${commitSummaries}
    
    Prior reviews (up to 40):
    ${reviewSummaries}
    
    Active Rubric Criteria to score:
    ${criteriaPrompt}
    
    =========================================
    PART 3: DETAILED EVALUATION GUIDELINES (RUBRICS)
    =========================================
    Use the following exact rubric levels and criteria descriptions to grade the team. All qualitative grades MUST choose from ["Xuất sắc", "Tốt", "Khá", "Trung bình", "Yếu"].
    ${detailedRubrics}
    
    =========================================
    PART 4: HARD CONSTRAINTS VALIDATION (CRITICAL FAILS)
    =========================================
    Analyze the code repository for their designated track (${trackName || 'Unknown Track'}) based on the specific Auto-Fail criteria:
    - Track 1 (Smart Home):
      1. AI Algorithm Evidence: Look for imports or configurations of ML/DL/LLM Agent libraries or APIs. If it is only static IF/ELSE/SWITCH rules, flag it as WARNING_CHECK_SLIDE since the team might present their architecture in the slide.
      2. Severity Accuracy: Scan for severity mapping logic (LOW/MEDIUM/HIGH/CRITICAL) for incidents and check for logical alignment with BTC rules.
      3. UX & 04/06 Devices: Check if at least 4 out of 6 Track 1 devices (AC_01, SENSOR_01, METER_01, CO2_01, HEATER_01, LIGHT_01) are parsed and displayed on UI. Check if UI messages are friendly for "Chủ hộ" (homeowner) with actionable advice in Vietnamese.
    - Track 2 (Smart Agriculture):
      1. Time-window processing: Check if the AI model or code handles a time-window of data instead of just the latest single data point. If it's a static threshold on the last record, flag it as WARNING_CHECK_SLIDE.
      2. Mobile-friendly: Check if CSS/Tailwind classes indicate responsive design.
      3. Technical stability & 04/06 Devices: Check if at least 4 out of 6 Track 2 devices (SOIL_01, WEATHER_01, PUMP_01, PH_01, TANK_01, SUN_01) are parsed and plotted.
    - Track 3 (Smart Factory):
      1. Predictive algorithm evidence: Check if there is code predicting faults before threshold is reached (e.g. trend analysis, forecasting) rather than just passive threshold checking. Flag as WARNING_CHECK_SLIDE if only passive code is found.
      2. Debouncing/Filtering: Check for debounce/throttle logic to filter noise.
      3. UX Industrial Dashboard & 04/06 Devices: Check if layout is designed for control rooms (incident prioritizing, non-cluttered). Check if at least 4 out of 6 Track 3 devices (MOTOR_01, LINE_01, CONVEYOR_01, PRESS_01, GAS_01, PROBE_01) are parsed and displayed.

    =========================================
    INSTRUCTIONS & OUTPUT FORMAT
    =========================================
    Please provide your review in JSON format with the following keys. Do not include markdown code block syntax. Return only raw JSON.
    All comments, summaries, evolution notes, test cases, advisories, and validation details MUST be in fluent, professional Vietnamese.
    
    {
      "commit_review": {
        "tech_stack": {
          "frameworks": ["e.g. React", "FastAPI"],
          "llm_models": ["e.g. Gemini 1.5 Pro"],
          "vector_db": ["e.g. ChromaDB"],
          "agent_frameworks": ["e.g. LangChain"],
          "third_party_tools": ["e.g. TailwindCSS"]
        },
        "inventory_exhaustive": {
          "llm_models_and_apis": [],
          "frameworks_and_runtimes": [],
          "vector_databases": [],
          "agent_orchestration": [],
          "third_party_integrations": []
        },
        "agent_intelligence": {
          "detected_skills": [],
          "tool_definitions": [],
          "reasoning_pattern": "e.g. ReAct | Plan-and-Solve | None",
          "has_agent_config_files": false
        },
        "rag_maturity": {
          "level": "Basic | Advanced | Agentic-RAG",
          "features_detected": ["e.g. hybrid_search", "rerank", "metadata_filtering"]
        },
        "overall_picture": {
          "project_about": "Brief description of what this project does",
          "tools_plain_bullets": "- Tool 1\\n- Tool 2",
          "current_focus": "What the developer is currently working on based on the commits",
          "architectural_style": "e.g. Microservices, MVC",
          "significant_change": true,
          "push_summary": "Summary of the changes in this push"
        },
        "assessment": {
          "advantages": "Pros of the design",
          "disadvantages": "Cons of the design",
          "improvement_areas": "Areas of enhancement",
          "context_and_fit": "How it fits in the hackathon context",
          "source_structure": "Quality of project structure",
          "completeness": "Readiness level",
          "security": "Security warnings (e.g. exposed keys, poor validation)"
        },
        "suggested_test_cases": ["Test case 1", "Test case 2"],
        "suggested_questions_for_team": ["Question 1", "Question 2"],
        "suggested_prompt_refinement": "Refinement suggestions for their LLM prompts"
      },
      "repository_review": {
        "criteria_comments": {
          // You MUST include exactly one entry for each criterion code listed in the Active Rubric.
          // Format: "CODE": {"grade": "Tốt|Xuất sắc|...", "comment": "detailed review comment in Vietnamese explaining the grade based on code commits and matching the rubrics descriptions"}
        },
        "smb_scale_advisory": {
          "system_identity_recap": "system identity recap in Vietnamese",
          "summary": "overall viability summary in Vietnamese",
          "tech_and_architecture": "architecture advice in Vietnamese",
          "cost_for_smb": "estimated API and hosting costs in Vietnamese",
          "throughput_and_reliability": "reliability pointers in Vietnamese",
          "observability_and_operations": "monitoring advice in Vietnamese",
          "data_and_integrations": "integration capabilities in Vietnamese"
        },
        "overall_picture": {
          "historical_synthesis": "overview of the team development progress in Vietnamese",
          "evolution_notes": "notable milestones during the hackathon in Vietnamese"
        }
      },
      "hard_constraints_validation": {
        "track_detected": "Track 1 | Track 2 | Track 3 | Unknown",
        "ai_algorithm_check": {
          "status": "PASSED | WARNING_CHECK_SLIDE | FAILED",
          "details": "Explanation of what AI algorithm evidence was found or missed in Vietnamese. If WARNING_CHECK_SLIDE, suggest what slide/presentation details the judge should look for."
        },
        "severity_accuracy_check": {
          "status": "PASSED | WARNING | FAILED | NOT_APPLICABLE",
          "details": "Explanation of incident severity mapping code logic in Vietnamese."
        },
        "ux_and_devices_check": {
          "status": "PASSED | WARNING | FAILED",
          "devices_detected": ["e.g. AC_01", "SENSOR_01"],
          "details": "Explanation of device count, UI friendliness for target Persona, responsive design, debouncing, or chart plots in Vietnamese."
        },
        "is_disqualified": false,
        "disqualification_reason": "Summary of disqualification reasons if any, in Vietnamese"
      }
    }
  `
};

module.exports = {
  GLOBAL_SCOPE_CONFIG,
  enforceFilePatchBoundary,
  shouldIgnoreFile,
  promptsRegistry
};
