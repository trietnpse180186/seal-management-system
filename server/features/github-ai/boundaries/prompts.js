/**
 * Prompts template definitions for AI Auditor Harness
 */

function getCommitReviewPrompt(authorName, authorGithubUsername, message, fileSummaries) {
  return `
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
}

function getTeamAggregatePrompt(teamId, commitSummaries, reviewSummaries, criteriaPrompt) {
  return `
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
}

module.exports = {
  getCommitReviewPrompt,
  getTeamAggregatePrompt
};
