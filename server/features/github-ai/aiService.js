const { GoogleGenAI } = require('@google/generative-ai');

const isMock = process.env.GEMINI_SERVICE_MOCK === 'true';
const apiKey = process.env.GEMINI_API_KEY;

let ai;
if (!isMock && apiKey) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    ai = new GoogleGenerativeAI(apiKey);
  } catch (err) {
    console.error('Error initializing Google Generative AI:', err.message);
  }
}

/**
 * Call n8n webhook workflow asynchronously or synchronously.
 */
async function callN8nWebhook(payload) {
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nUrl) return null;
  
  console.log(`[N8N] Calling n8n webhook: ${n8nUrl} for ${payload.analysisType}...`);
  try {
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`n8n returned status ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    let resultJson;
    try {
      resultJson = JSON.parse(text);
    } catch (parseErr) {
      throw new Error(`Failed to parse n8n response as JSON: ${text.substring(0, 200)}`);
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
    
    console.log(`[N8N] Received successful response from n8n.`);
    return resultJson;
  } catch (error) {
    console.error(`[N8N] Webhook call failed:`, error.message);
    return null;
  }
}

/**
 * Analyzes a batch of commits (per-push) using Gemini AI.
 * @param {Object} commit - The representing Commit model object
 * @param {Array<Object>} files - Array of CommitFile objects
 * @returns {Promise<Object>} The structured JSON analysis result
 */
async function analyzeCommit(commit, files) {
  const fileSummaries = files.map(f => `File: ${f.filename}\nStatus: ${f.status}\nAdditions: ${f.additions}, Deletions: ${f.deletions}\nDiff:\n${f.patch}`).join('\n\n');
  
  const prompt = `
    You are an expert AI code reviewer. Analyze the following GitHub commit files and patch changes.
    Commit Author: ${commit.authorName} (@${commit.authorGithubUsername})
    Commit Message: ${commit.message}
    
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

    IMPORTANT: You MUST write all descriptive fields (especially suggested_questions_for_team, overall_picture.push_summary, overall_picture.current_focus, overall_picture.project_about, assessment.advantages, assessment.disadvantages, assessment.improvement_areas, and suggested_test_cases) entirely in fluent, professional Vietnamese.
  `;

  // Try n8n webhook first if configured
  const n8nResult = await callN8nWebhook({
    analysisType: 'commit_review',
    commit: {
      _id: commit._id,
      commitSha: commit.commitSha,
      message: commit.message,
      authorName: commit.authorName,
      authorGithubUsername: commit.authorGithubUsername,
      committedAt: commit.committedAt
    },
    files: files.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch
    })),
    prompt
  });
  
  if (n8nResult) {
    return n8nResult;
  }

  if (isMock || !ai) {
    console.log(`[GEMINI MOCK] Analyzing commit per-push: ${commit.commitSha.substring(0, 7)}`);
    await new Promise(resolve => setTimeout(resolve, 600));

    // Simulated result based on commit messages
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

    return {
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
      suggested_prompt_refinement: "Nên điều chỉnh System Prompt để hạn chế ảo giác của LLM khi trả lời câu hỏi nghiệp vụ hải quan phức tạp."
    };
  }

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const result = await model.generateContent(prompt);
    const textResponse = result.response.text().trim();
    
    // Parse JSON safely
    const cleanedText = textResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error generating per-push review with Gemini:', error.message);
    return {
      tech_stack: { frameworks: ["React", "Express"], llm_models: [], vector_db: [], agent_frameworks: [], third_party_tools: [] },
      inventory_exhaustive: { llm_models_and_apis: [], frameworks_and_runtimes: [], vector_databases: [], agent_orchestration: [], third_party_integrations: [] },
      agent_intelligence: { detected_skills: [], tool_definitions: [], reasoning_pattern: "None", has_agent_config_files: false },
      rag_maturity: { level: "Basic", features_detected: [] },
      overall_picture: { project_about: "Analysis failed", tools_plain_bullets: "", current_focus: "", architectural_style: "", significant_change: false, push_summary: `LLM API Error: ${error.message}` },
      assessment: { advantages: "", disadvantages: "", improvement_areas: "", context_and_fit: "", source_structure: "", completeness: "", security: `Service limits reached or invalid key. Details: ${error.message}` },
      suggested_test_cases: [],
      suggested_questions_for_team: [],
      suggested_prompt_refinement: ""
    };
  }
}

/**
 * Performs a deep historical aggregate analysis for the team.
 * @param {string} teamId - Team ID
 * @param {Array<Object>} commits - Last 200 commits metadata
 * @param {Array<Object>} priorReviews - Last 40 per-push reviews
 * @returns {Promise<Object>} Detailed R1/R2 and SMB advisories JSON
 */
async function analyzeTeamAggregate(teamId, commits, priorReviews) {
  const commitSummaries = commits.map(c => `SHA: ${c.commitSha.substring(0, 7)}, Msg: ${c.message}, Committed: ${c.committedAt}`).join('\n');
  const reviewSummaries = priorReviews.map(r => `Level: ${r.result?.rag_maturity?.level || 'Basic'}, Summary: ${r.result?.overall_picture?.push_summary}`).join('\n');

  // Dynamically query active criteria from Mongoose
  const Team = require('mongoose').model('Team');
  const Rubric = require('mongoose').model('Rubric');
  const Criterion = require('mongoose').model('Criterion');

  let roundCriteria = [];
  try {
    const team = await Team.findById(teamId);
    if (team) {
      let roundId = team.currentRoundId;
      if (!roundId) {
        const Round = require('mongoose').model('Round');
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
    console.error('Error fetching round criteria for AI analysis:', err.message);
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

  const prompt = `
    You are an expert AI Judge Auditor for the SEAL Hackathon. Synthesize the development history of team ${teamId}.
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
    
    IMPORTANT: You MUST write the detailed assessment comments, overall pictures, evolution notes, reasoning processes, and SMB Advisories entirely in fluent, professional Vietnamese.
    Also compile an SMB Scale Advisory (system_identity_recap, summary, tech_and_architecture, cost_for_smb, throughput_and_reliability, observability_and_operations, data_and_integrations).
    
    Return a raw JSON block without markdown formatting or code block wrapper:
    {
      "criteria_comments": {
        // You MUST include exactly one entry for each criterion code listed above.
        // Format: "CODE": {"grade": "Tốt|Xuất sắc|...", "comment": "detailed review comment in Vietnamese explaining the grade based on code commits"}
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
  `;

  // Try n8n webhook first if configured
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
    return n8nResult;
  }

  if (isMock || !ai) {
    console.log(`[GEMINI MOCK] Analyzing team aggregate for: ${teamId}`);
    await new Promise(resolve => setTimeout(resolve, 800));

    const commentsMap = {};
    if (roundCriteria.length > 0) {
      roundCriteria.forEach(c => {
        let commentText = `Nhóm thực hiện tốt tiêu chí ${c.name}, cấu trúc code sạch sẽ và rõ ràng.`;
        let grade = "Tốt";
        if (c.code === 'CODE') {
          commentText = "Mã nguồn được cấu hình chuẩn, áp dụng các design pattern tối ưu, cấu trúc thư mục phân tách Layered MVC rõ ràng và dễ bảo trì.";
          grade = "Tốt";
        } else if (c.code === 'TEAM') {
          commentText = "Sự phối hợp trong nhóm rất nhịp nhàng, đóng góp của các thành viên qua các commit đồng đều, lịch sử Git rõ ràng.";
          grade = "Tốt";
        } else if (c.code === 'R1_01') {
          commentText = "Ý tưởng giải quyết bài toán logistics rất thực tế và thiết thực, có tính khả thi cao.";
          grade = "Xuất sắc";
        } else if (c.code === 'R1_02') {
          commentText = "Pipeline xử lý dữ liệu và chia tài liệu thành chunking hợp lý, có overlap 15% để giữ ngữ cảnh.";
          grade = "Tốt";
        } else if (c.code === 'R1_03') {
          commentText = "Đã có tìm kiếm ngữ nghĩa nhưng chưa có reranking nâng cao hoặc trích dẫn nguồn (citation) chi tiết.";
          grade = "Khá";
        }
        commentsMap[c.code] = { grade, comment: commentText };
      });
    } else {
      // Fallback defaults
      commentsMap["R1_01"] = { grade: "Xuất sắc", comment: "Ý tưởng giải quyết bài toán logistics rất thực tế và thiết thực." };
      commentsMap["R1_02"] = { grade: "Tốt", comment: "Pipeline xử lý PDF và chia chunking hợp lý, có overlap 15%." };
      commentsMap["R1_03"] = { grade: "Khá", comment: "Đã có tìm kiếm ngữ nghĩa nhưng chưa có reranking nâng cao." };
      commentsMap["R1_04"] = { grade: "Tốt", comment: "Prompts được thiết kế khá chỉnh chu, có phân vai rõ ràng." };
      commentsMap["R1_05"] = { grade: "Tốt", comment: "README ghi chú cài đặt chi tiết, cấu trúc thư mục module hóa sạch sẽ." };
      commentsMap["R2_01"] = { grade: "Khá", comment: "Có cài đặt agent dạng ReAct đơn giản, chưa thực sự tối ưu multi-hop." };
      commentsMap["R2_02"] = { grade: "Tốt", comment: "Có theo dõi token sử dụng của các api calls cục bộ." };
      commentsMap["R2_03"] = { grade: "Khá", comment: "Khả năng chịu lỗi trung bình, cần cấu hình retry khi sập network." };
      commentsMap["R2_04"] = { grade: "Khá", comment: "Giải pháp ở mức tiêu chuẩn, độ đột phá công nghệ trung bình khá." };
      commentsMap["R2_05"] = { grade: "Tốt", comment: "AI đề xuất bộ câu hỏi phản biện rất sát thực tế, giúp nhóm chuẩn bị tốt." };
    }

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
      }
    };
  }

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const result = await model.generateContent(prompt);
    const textResponse = result.response.text().trim();
    const cleanedText = textResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error generating aggregate review with Gemini:', error.message);
    const fallbackMap = {};
    const defaultCodes = roundCriteria.length > 0 ? roundCriteria.map(c => c.code) : ["R1_01", "R1_02", "R1_03", "R1_04", "R1_05", "R2_01", "R2_02", "R2_03", "R2_04", "R2_05"];
    defaultCodes.forEach(code => {
      fallbackMap[code] = { grade: "Tốt", comment: `Phân tích chi tiết tiêu chí tạm thời chưa khả dụng. Chi tiết: ${error.message}` };
    });
    return {
      criteria_comments: fallbackMap,
      smb_scale_advisory: { summary: `Giới hạn dịch vụ hoặc lỗi API kết nối Gemini. Chi tiết: ${error.message}` },
      overall_picture: { historical_synthesis: "Phân tích thất bại", evolution_notes: "Không có ghi nhận" }
    };
  }
}

/**
 * Suggests grades for a team's submission snapshot against a list of Rubric criteria.
 * Maps qualitative grades from aggregate review to numeric scores.
 */
async function generateScoringSuggestion(repositorySnapshot, commits, criteria) {
  // Try to find the latest completed team aggregate review for this team
  const AiAnalysis = require('mongoose').model('AiAnalysis');
  const latestAggReview = await AiAnalysis.findOne({
    teamId: repositorySnapshot.teamId,
    analysisType: 'repository_review',
    status: 'completed'
  }).sort({ createdAt: -1 });

  // Map qualitative grades to numeric factors
  const gradeToScoreFactor = {
    "Xuất sắc": 0.95, // 95% of max score
    "Tốt": 0.82,      // 82% of max score
    "Khá": 0.68,      // 68% of max score
    "Trung bình": 0.50, // 50% of max score
    "Yếu": 0.30       // 30% of max score
  };

  const hasAgg = latestAggReview && latestAggReview.result && latestAggReview.result.criteria_comments;

  return criteria.map(c => {
    // Map criteria codes to R1/R2 keys
    // Example codes: R1_01 or c.code
    let critCode = c.code; // e.g. R1_01 or problem_solution
    // If criterion code isn't exactly R1_01 etc., try matching by position or substring
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

    let grade = "Tốt"; // Default fallback
    let comment = "Nhóm thể hiện tiến độ làm việc ổn định, có commit giải quyết tiêu chí này.";

    if (hasAgg) {
      if (latestAggReview.result.criteria_comments[c.code]) {
        grade = latestAggReview.result.criteria_comments[c.code].grade || "Tốt";
        comment = latestAggReview.result.criteria_comments[c.code].comment || comment;
      } else if (latestAggReview.result.criteria_comments[critCode]) {
        grade = latestAggReview.result.criteria_comments[critCode].grade || "Tốt";
        comment = latestAggReview.result.criteria_comments[critCode].comment || comment;
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

module.exports = {
  analyzeCommit,
  analyzeTeamAggregate,
  generateScoringSuggestion
};

