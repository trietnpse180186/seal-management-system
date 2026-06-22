/**
 * Verification & Guardrails Layer
 * Handles output verification, JSON parsing, and schema validation.
 */

/**
 * Safely parse AI results that might be wrapped in standard raw Gemini or string formats
 * @param {any} result - The raw result from LLM or n8n webhook
 * @returns {Object|string} Parsed JSON object or raw string if parsing fails
 */
function parseAiResult(result) {
  if (!result) return result;
  
  // 1. If result is already an object, check if it's nested
  if (typeof result === 'object' && !Array.isArray(result)) {
    // If it has standard wrappers, try to unpack
    if (result.output && typeof result.output === 'string') {
      return parseAiResult(result.output);
    }
    if (result.result && typeof result.result === 'object') {
      return parseAiResult(result.result);
    }
    if (result.data && typeof result.data === 'object') {
      return parseAiResult(result.data);
    }
    return result;
  }

  // 2. If result is a string, try to clean and parse it
  if (typeof result === 'string') {
    try {
      const cleaned = result.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      // Fallback for strings that might have other structures
      let text = null;
      try {
        // Try parsing the root string as JSON first
        const rootParsed = JSON.parse(result);
        if (rootParsed.content && Array.isArray(rootParsed.content.parts) && rootParsed.content.parts[0]?.text) {
          text = rootParsed.content.parts[0].text;
        } else if (rootParsed.text) {
          text = rootParsed.text;
        } else if (rootParsed.output) {
          text = rootParsed.output;
        }
      } catch (err) {
        // Not a direct JSON string, proceed with regex clean
      }

      if (text) {
        try {
          const cleanedText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          return JSON.parse(cleanedText);
        } catch (e2) {
          // ignore
        }
      }
      return result;
    }
  }

  return result;
}

/**
 * Validates that the AI result has the necessary structure for commit reviews
 */
function validateCommitReviewSchema(parsedResult) {
  const requiredKeys = ['tech_stack', 'rag_maturity', 'overall_picture', 'assessment'];
  for (const key of requiredKeys) {
    if (!parsedResult || !parsedResult[key]) {
      throw new Error(`Invalid AI result: Missing required root key "${key}"`);
    }
  }
  return true;
}

/**
 * Validates that the AI result has the necessary structure for team aggregates
 */
function validateTeamAggregateSchema(parsedResult) {
  if (!parsedResult || (!parsedResult.criteria_comments && !parsedResult.smb_scale_advisory)) {
    throw new Error('Invalid AI result: Missing criteria_comments or smb_scale_advisory');
  }
  return true;
}

module.exports = {
  parseAiResult,
  validateCommitReviewSchema,
  validateTeamAggregateSchema
};
