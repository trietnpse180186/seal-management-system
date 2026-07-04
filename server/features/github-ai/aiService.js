const isMock = process.env.GEMINI_SERVICE_MOCK === 'true';

// Import Global System-Level Harness Layers
const promptsManager = require('../../harness/boundaries/promptsManager');
const schemaValidator = require('../../harness/guardrails/schemaValidator');
const contextStore = require('../../harness/memory/contextStore');
const resilienceEngine = require('../../harness/feedback/resilienceEngine');
const hitlManager = require('../../harness/telemetry/hitlManager');

// Local tools for database saving
const dbTools = require('./tools/dbTools');

/**
 * Filter criteria comments to keep only the active ones for the round
 */
function filterCriteriaComments(result, roundCriteria) {
  if (!result) return result;
  
  if (roundCriteria && roundCriteria.length > 0) {
    const activeCodes = new Set(roundCriteria.map(c => c.code.toUpperCase()));
    
    // Check if result has repository_review (combined review response)
    if (result.repository_review && result.repository_review.criteria_comments) {
      const filtered = {};
      Object.keys(result.repository_review.criteria_comments).forEach(key => {
        if (activeCodes.has(key.toUpperCase())) {
          filtered[key] = result.repository_review.criteria_comments[key];
        }
      });
      result.repository_review.criteria_comments = filtered;
    }
    
    // Check if result itself has criteria_comments (individual repository review response)
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
 * Call n8n webhook workflow asynchronously or synchronously.
 */
async function callN8nWebhook(payload) {
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nUrl) return null;
  
  const startTime = Date.now();
  console.log(`[N8N] Calling n8n webhook: ${n8nUrl} for ${payload.analysisType}...`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

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
    if (resultJson && resultJson.output) {
      resultJson = resultJson.output;
    } else if (resultJson && resultJson.result && typeof resultJson.result === 'object') {
      resultJson = resultJson.result;
    } else if (resultJson && resultJson.data && typeof resultJson.data === 'object') {
      resultJson = resultJson.data;
    }
    
    const latency = Date.now() - startTime;
    hitlManager.recordTelemetry(latency, 0, true);
    console.log(`[N8N] Received successful response from n8n.`);
    return schemaValidator.parseAiResult(resultJson);
  } catch (error) {
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    hitlManager.recordTelemetry(latency, 0, false);
    if (error.name === 'AbortError') {
      console.error(`[N8N] Webhook call timed out after 35 seconds.`);
    } else {
      console.error(`[N8N] Webhook call failed:`, error.message);
    }
    return null;
  }
}

/**
 * Analyzes a batch of commits (per-push) using Gemini AI.
 */
async function analyzeCommit(commit, files) {
  const activeFiles = files.filter(f => !promptsManager.shouldIgnoreFile(f.filename));
  const fileSummaries = activeFiles.map(f => {
    const patch = promptsManager.enforceFilePatchBoundary(f.patch);
    return `File: ${f.filename}\nStatus: ${f.status}\nAdditions: ${f.additions}, Deletions: ${f.deletions}\nDiff:\n${patch}`;
  }).join('\n\n');
  
  const prompt = promptsManager.promptsRegistry.commit_review(
    commit.authorName,
    commit.authorGithubUsername,
    commit.message,
    fileSummaries
  );

  // 1. Try n8n webhook first if configured
  const n8nResult = await callN8nWebhook({
    analysisType: 'commit_review',
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
    return n8nResult;
  }

  // 2. Mock service fallback (when n8n is bypassed or fails)
  if (isMock) {
    console.log(`[GEMINI MOCK] Analyzing commit per-push: ${commit.commitSha.substring(0, 7)}`);
    await new Promise(resolve => setTimeout(resolve, 600));

    let level = "Basic";
    let pattern = "None";
    let isSig = false;
    let qualityFeedback = "Thiết lập cấu trúc chuẩn React. Code chạy mượt mà, phân tách chức năng tốt.";
    let securityWarn = [];

    if (commit.message.toLowerCase().includes('rag') || commit.message.toLowerCase().includes('search')) {
      level = "Advanced";
      isSig = true;
    }
    if (commit.message.toLowerCase().includes('agent') || commit.message.toLowerCase().includes('tool')) {
      level = "Agentic-RAG";
      pattern = "ReAct";
      isSig = true;
    }
    if (commit.message.toLowerCase().includes('password') || commit.message.toLowerCase().includes('key')) {
      securityWarn = ["Phát hiện rủi ro lưu trữ thông tin nhạy cảm ở dạng plain-text hoặc hardcode API key."];
    }

    const mockResult = {
      tech_stack: {
        frameworks: ["React", "Express", "Node.js"],
        llm_models: ["Gemini 1.5 Pro"],
        vector_db: level !== "Basic" ? ["ChromaDB"] : [],
        agent_frameworks: level === "Agentic-RAG" ? ["LangChain"] : [],
        third_party_tools: ["TailwindCSS v4"]
      },
      inventory_exhaustive: {
        llm_models_and_apis: ["gemini-3.1-flash-lite", "openai-gpt-4o"],
        frameworks_and_runtimes: ["react-19", "nodejs-20"],
        vector_databases: level !== "Basic" ? ["chromadb-0.4"] : [],
        agent_orchestration: level === "Agentic-RAG" ? ["langchain-core"] : [],
        third_party_integrations: ["github-rest-api"]
      },
      agent_intelligence: {
        detected_skills: level === "Agentic-RAG" ? ["file-search", "api-call"] : [],
        tool_definitions: level === "Agentic-RAG" ? ["search_documents", "fetch_status"] : [],
        reasoning_pattern: pattern,
        has_agent_config_files: level === "Agentic-RAG"
      },
      rag_maturity: {
        level: level,
        features_detected: level === "Advanced" ? ["hybrid_search", "rerank"] : level === "Agentic-RAG" ? ["hybrid_search", "rerank", "agentic_routing"] : ["vector_search"]
      },
      overall_picture: {
        project_about: "Hệ thống quản lý hải quan và đối soát logistic SEAL.",
        tools_plain_bullets: `- React\n- Node.js\n- ${level !== "Basic" ? "ChromaDB" : "MongoDB"}`,
        current_focus: "Xây dựng pipeline RAG và liên kết dữ liệu nghiệp vụ.",
        architectural_style: "Layered MVC Architecture",
        significant_change: isSig,
        push_summary: `Đợt push này cập nhật: ${commit.message}`
      },
      assessment: {
        advantages: "Cấu trúc mã nguồn module hóa rõ ràng, dễ bảo trì.",
        disadvantages: "Thiếu xử lý timeout cho các cuộc gọi API ngoài.",
        improvement_areas: "Bổ sung cơ chế retry tự động và logging tập trung.",
        context_and_fit: "Phù hợp với yêu cầu thực tế của đề tài hackathon.",
        source_structure: "Khá tốt, tách biệt rõ controllers, routes và models.",
        completeness: "Đang hoàn thiện phần core, giao diện đã cơ bản chạy được.",
        security: securityWarn.length > 0 ? securityWarn[0] : "Không phát hiện lỗi bảo mật nghiêm trọng trong đợt commit này."
      },
      suggested_test_cases: [
        "Kiểm thử hệ thống khi nạp file PDF rỗng hoặc định dạng sai.",
        "Kiểm thử độ trễ của truy vấn tìm kiếm lai (hybrid search) khi tải cao."
      ],
      suggested_questions_for_team: [
        "Tại sao các bạn chọn sử dụng chiến lược chunking cố định thay vì dynamic chunking?",
        "Làm thế nào để hệ thống đảm bảo trích dẫn nguồn (citation) luôn khớp với văn bản gốc?"
      ],
      suggested_prompt_refinement: "Nên điều chỉnh System Prompt để hạn chế ảo giác của LLM khi trả lời câu hỏi nghiệp vụ hải quan phức tạp.",
      _provider: 'Mock Service',
      _model: 'mock-model'
    };

    if (hitlManager.requiresHumanApproval(mockResult)) {
      mockResult._requires_approval = true;
    }
    return mockResult;
  }

  throw new Error("Gọi webhook n8n thất bại hoặc hết hạn phản hồi (timeout). Vui lòng kiểm tra lại dịch vụ n8n và quota của API Gemini.");
}

/**
 * Performs a deep historical aggregate analysis for the team.
 */
async function analyzeTeamAggregate(teamId, commits, priorReviews) {
  // Load State Context from Global Context Store
  const context = await contextStore.loadTeamAggregateContext(teamId);

  const prompt = promptsManager.promptsRegistry.repository_review(
    teamId,
    context.commitSummaries,
    context.reviewSummaries,
    context.criteriaPrompt
  );

  // 1. Try n8n webhook first if configured
  const n8nResult = await callN8nWebhook({
    analysisType: 'repository_review',
    teamId,
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
    n8nResult._provider = 'n8n-gemini';
    n8nResult._model = 'gemini-2.5-flash (via n8n)';
    return n8nResult;
  }

  // 2. Mock service fallback (when n8n is bypassed or fails)
  if (isMock || !n8nResult) {
    console.log(`[GEMINI MOCK] Analyzing team aggregate for: ${teamId}`);
    await new Promise(resolve => setTimeout(resolve, 800));

    const commentsMap = {};
    const defaultCodes = context.roundCriteria.length > 0 ? context.roundCriteria.map(c => c.code) : ["R1_01", "R1_02", "R1_03", "R1_04", "R1_05", "R2_01", "R2_02", "R2_03", "R2_04", "R2_05"];
    
    defaultCodes.forEach(code => {
      let commentText = `Nhóm thực hiện tốt tiêu chí này, cấu trúc code sạch sẽ và rõ ràng.`;
      let grade = "Tốt";
      if (code === 'R1_01') {
        commentText = "Ý tưởng giải quyết bài toán logistics rất thực tế và thiết thực, có tính khả thi cao.";
        grade = "Xuất sắc";
      } else if (code === 'R1_02') {
        commentText = "Pipeline xử lý dữ liệu và chia tài liệu thành chunking hợp lý, có overlap 15% để giữ ngữ cảnh.";
        grade = "Tốt";
      } else if (code === 'R1_03') {
        commentText = "Đã có tìm kiếm ngữ nghĩa nhưng chưa có reranking nâng cao hoặc trích dẫn nguồn (citation) chi tiết.";
        grade = "Khá";
      }
      commentsMap[code] = { grade, comment: commentText };
    });

    return {
      criteria_comments: commentsMap,
      smb_scale_advisory: {
        system_identity_recap: "Hệ thống RAG và trợ lý số hỗ trợ thông quan tờ khai hải quan logistics.",
        summary: "Dự án có triển vọng thương mại hóa tốt cho các doanh nghiệp kho bãi logistics vừa và nhỏ.",
        tech_and_architecture: "Nên sử dụng kiến trúc Serverless Microservices để dễ dàng scale theo nhu cầu sử dụng.",
        cost_for_smb: "Chi phí vận hành ước tính $20-$50/tháng cho nhu cầu 5000 tờ khai/tháng.",
        throughput_and_reliability: "Đạt mức ổn định cơ bản. Cần bổ sung Redis cache để tối ưu truy vấn.",
        observability_and_operations: "Tích hợp OpenTelemetry hoặc Winston Log để dễ phát hiện lỗi.",
        data_and_integrations: "Hỗ trợ export kết quả qua API webhook để đồng bộ trực tiếp với hệ thống CRM/ERP."
      },
      overall_picture: {
        historical_synthesis: "Đội thi đã đi từ một khung sườn chatbot đơn giản ban đầu đến một hệ thống RAG hoàn thiện hơn với các file cấu hình và cơ sở dữ liệu vector.",
        evolution_notes: "Tuần 1: Khởi tạo scaffold; Tuần 2: Nạp dữ liệu Vector DB; Tuần 3: Tích hợp agent logic."
      },
      _provider: 'Mock Service',
      _model: 'mock-model'
    };
  }
}

/**
 * Suggests grades for a team's submission snapshot against a list of Rubric criteria.
 */
async function generateScoringSuggestion(repositorySnapshot, commits, criteria) {
  const AiAnalysis = require('mongoose').model('AiAnalysis');
  const latestAggReview = await AiAnalysis.findOne({
    teamId: repositorySnapshot.teamId,
    analysisType: 'repository_review',
    status: { $in: ['completed', 'approved'] }
  }).sort({ createdAt: -1 });

  const gradeToScoreFactor = {
    "Xuất sắc": 0.95,
    "Tốt": 0.82,
    "Khá": 0.68,
    "Trung bình": 0.50,
    "Yếu": 0.30
  };

  let cleanResult = null;
  if (latestAggReview && latestAggReview.result) {
    cleanResult = schemaValidator.parseAiResult(latestAggReview.result);
  }
  const hasAgg = cleanResult && cleanResult.criteria_comments;

  return criteria.map(c => {
    let critCode = c.code;
    if (!critCode.startsWith('R1_') && !critCode.startsWith('R2_')) {
      if (c.code.toLowerCase().includes('prob') || c.code.toLowerCase().includes('fit')) critCode = 'R1_01';
      else if (c.code.toLowerCase().includes('data') || c.code.toLowerCase().includes('pipe')) critCode = 'R1_02';
      else if (c.code.toLowerCase().includes('retriev') || c.code.toLowerCase().includes('cite')) critCode = 'R1_03';
      else if (c.code.toLowerCase().includes('prompt') || c.code.toLowerCase().includes('intent')) critCode = 'R1_04';
      else if (c.code.toLowerCase().includes('doc') || c.code.toLowerCase().includes('clean')) critCode = 'R1_05';
      else if (c.code.toLowerCase().includes('agent') || c.code.toLowerCase().includes('hop')) critCode = 'R2_01';
      else if (c.code.toLowerCase().includes('resource') || c.code.toLowerCase().includes('token')) critCode = 'R2_02';
      else if (c.code.toLowerCase().includes('prod') || c.code.toLowerCase().includes('operation')) critCode = 'R2_03';
      else if (c.code.toLowerCase().includes('extend') || c.code.toLowerCase().includes('creat')) critCode = 'R2_04';
      else critCode = 'R2_05';
    }

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

    const factor = gradeToScoreFactor[grade] || 0.8;
    const score = Math.round(c.maxScore * factor * 10) / 10;

    return {
      criterionCode: c.code,
      suggestedScore: score,
      comment: `[Gợi ý của AI - Xếp hạng: ${grade}]: ${comment}`
    };
  });
}

/**
 * Performs a combined AI analysis (commit_review + repository_review) in a single request.
 */
async function analyzeCommitAndAggregate(commit, files, teamId, commits, priorReviews) {
  const fs = require('fs');
  const path = require('path');
  
  // Load State Context from Global Context Store
  const context = await contextStore.loadTeamAggregateContext(teamId);
  
  // Read detailed rubrics from tieu_chi_danh_gia.md
  let detailedRubrics = '';
  try {
    const rubricPath = path.join(__dirname, '../../..', 'tieu_chi_danh_gia.md');
    detailedRubrics = fs.readFileSync(rubricPath, 'utf8');
  } catch (err) {
    console.warn('[AI SERVICE] Warning: Could not read tieu_chi_danh_gia.md:', err.message);
  }

  const activeFiles = files.filter(f => !promptsManager.shouldIgnoreFile(f.filename));
  const fileSummaries = activeFiles.map(f => {
    const patch = promptsManager.enforceFilePatchBoundary(f.patch);
    return `File: ${f.filename}\nStatus: ${f.status}\nAdditions: ${f.additions}, Deletions: ${f.deletions}\nDiff:\n${patch}`;
  }).join('\n\n');

  const prompt = promptsManager.promptsRegistry.combined_sync_review(
    commit.authorName,
    commit.authorGithubUsername,
    commit.message,
    fileSummaries,
    teamId,
    context.commitSummaries,
    context.reviewSummaries,
    context.criteriaPrompt,
    detailedRubrics
  );

  // 1. Call n8n webhook (only 1 call!)
  const n8nResult = await callN8nWebhook({
    analysisType: 'combined_sync_review',
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
    teamId,
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
    n8nResult._provider = 'n8n-gemini';
    n8nResult._model = 'gemini-2.5-flash (via n8n)';
    return filterCriteriaComments(n8nResult, context.roundCriteria);
  }

  // 2. Mock service fallback
  if (isMock) {
    console.log(`[GEMINI MOCK] Analyzing combined commit and aggregate for team: ${teamId}`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate mock commit review
    const mockCommitReview = {
      tech_stack: {
        frameworks: ["React", "Express"],
        llm_models: ["gemini-2.5-flash"],
        vector_db: ["Pinecone"],
        agent_frameworks: ["LangChain"],
        third_party_tools: ["TailwindCSS"]
      },
      inventory_exhaustive: {
        llm_models_and_apis: ["gemini-2.5-flash"],
        frameworks_and_runtimes: ["React", "Express", "Node.js"],
        vector_databases: ["Pinecone"],
        agent_orchestration: ["LangChain"],
        third_party_integrations: ["TailwindCSS"]
      },
      agent_intelligence: {
        detected_skills: ["Retrieval-Augmented Generation (RAG)", "Semantic Search"],
        tool_definitions: [],
        reasoning_pattern: "None",
        has_agent_config_files: false
      },
      rag_maturity: {
        level: "Basic",
        features_detected: ["semantic_search"]
      },
      overall_picture: {
        project_about: "Hệ thống RAG hỗ trợ quản lý và phân loại tài liệu SEAL.",
        tools_plain_bullets: "- React\n- Express\n- Pinecone Vector DB",
        current_focus: "Xây dựng khung giao diện dashboard và tích hợp kết nối API.",
        architectural_style: "Client-Server",
        significant_change: true,
        push_summary: "Đồng bộ mã nguồn và cấu hình API cho hệ thống RAG cơ bản."
      },
      assessment: {
        advantages: "Cấu trúc mã nguồn sạch sẽ, tổ chức thư mục rõ ràng.",
        disadvantages: "Thiếu phần kiểm tra lỗi dữ liệu đầu vào và các trường hợp biên.",
        improvement_areas: "Cần cải thiện chất lượng tìm kiếm bằng cách thêm Hybrid search hoặc Reranking.",
        context_and_fit: "Phù hợp với yêu cầu cơ bản của Hackathon.",
        source_structure: "Tốt",
        completeness: "Khá",
        security: "Không phát hiện rò rỉ API key."
      },
      suggested_test_cases: ["Kiểm tra tìm kiếm tài liệu với câu hỏi đúng chuyên ngành", "Kiểm tra phản hồi khi không tìm thấy tài liệu liên quan"],
      suggested_questions_for_team: ["Tại sao đội thi lựa chọn Pinecone thay vì các Vector DB local như ChromaDB?", "Giải pháp của đội thi để xử lý các tài liệu PDF chứa bảng biểu phức tạp là gì?"],
      suggested_prompt_refinement: "Nên thêm System Instruction để bắt buộc model chỉ trả lời dựa vào ngữ cảnh được cung cấp."
    };

    // Generate mock repository review
    const commentsMap = {};
    const defaultCodes = context.roundCriteria.length > 0 ? context.roundCriteria.map(c => c.code) : ["R1_01", "R1_02", "R1_03", "R1_04", "R1_05", "R2_01", "R2_02", "R2_03", "R2_04", "R2_05"];
    
    defaultCodes.forEach(code => {
      let commentText = `Nhóm thực hiện tốt tiêu chí này, cấu trúc code sạch sẽ và rõ ràng.`;
      let grade = "Tốt";
      if (code === 'R1_01') {
        commentText = "Ý tưởng giải quyết bài toán logistics rất thực tế và thiết thực, có tính khả thi cao.";
        grade = "Xuất sắc";
      } else if (code === 'R1_02') {
        commentText = "Pipeline xử lý dữ liệu và chia tài liệu thành chunking hợp lý, có overlap 15% để giữ ngữ cảnh.";
        grade = "Tốt";
      } else if (code === 'R1_03') {
        commentText = "Đã có tìm kiếm ngữ nghĩa nhưng chưa có reranking nâng cao hoặc trích dẫn nguồn (citation) chi tiết.";
        grade = "Khá";
      }
      commentsMap[code] = { grade, comment: commentText };
    });

    const mockRepositoryReview = {
      criteria_comments: commentsMap,
      smb_scale_advisory: {
        system_identity_recap: "Hệ thống RAG và trợ lý số hỗ trợ thông quan tờ khai hải quan logistics.",
        summary: "Dự án có triển vọng thương mại hóa tốt cho các doanh nghiệp kho bãi logistics vừa và nhỏ.",
        tech_and_architecture: "Nên sử dụng kiến trúc Serverless Microservices để dễ dàng scale theo nhu cầu sử dụng.",
        cost_for_smb: "Chi phí vận hành ước tính $20-$50/tháng cho nhu cầu 5000 tờ khai/tháng.",
        throughput_and_reliability: "Đạt mức ổn định cơ bản. Cần bổ sung Redis cache để tối ưu truy vấn.",
        observability_and_operations: "Tích hợp OpenTelemetry hoặc Winston Log để dễ phát hiện lỗi.",
        data_and_integrations: "Hỗ trợ export kết quả qua API webhook để đồng bộ trực tiếp với hệ thống CRM/ERP."
      },
      overall_picture: {
        historical_synthesis: "Đội thi đã đi từ một khung sườn chatbot đơn giản ban đầu đến một hệ thống RAG hoàn thiện hơn với các file cấu hình và cơ sở dữ liệu vector.",
        evolution_notes: "Tuần 1: Khởi tạo scaffold; Tuần 2: Nạp dữ liệu Vector DB; Tuần 3: Tích hợp agent logic."
      }
    };

    const mockResult = {
      commit_review: mockCommitReview,
      repository_review: mockRepositoryReview,
      _provider: 'Mock Service',
      _model: 'mock-model'
    };
    return filterCriteriaComments(mockResult, context.roundCriteria);
  }

  throw new Error("Gọi webhook n8n thất bại hoặc hết hạn phản hồi (timeout). Vui lòng kiểm tra lại dịch vụ n8n và quota của API Gemini.");
}

module.exports = {
  analyzeCommit,
  analyzeTeamAggregate,
  analyzeCommitAndAggregate,
  generateScoringSuggestion,
  parseAiResult: schemaValidator.parseAiResult
};
