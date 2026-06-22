/**
 * System-Level Harness: Layer 03 - Guardrails (Schema Validator)
 * Validates and sanitizes LLM JSON output schemas.
 */

/**
 * Safely parse AI results that might be wrapped in standard raw Gemini or string formats
 */
function parseAiResult(result) {
  if (!result) return result;
  
  // 1. If result is already an object, check if it's nested
  if (typeof result === 'object' && !Array.isArray(result)) {
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
      let text = null;
      try {
        const rootParsed = JSON.parse(result);
        if (rootParsed.content && Array.isArray(rootParsed.content.parts) && rootParsed.content.parts[0]?.text) {
          text = rootParsed.content.parts[0].text;
        } else if (rootParsed.text) {
          text = rootParsed.text;
        } else if (rootParsed.output) {
          text = rootParsed.output;
        }
      } catch (err) {
        // ignore
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
 * Checks if a parsed object satisfies a required JSON schema
 */
function validateSchema(parsedObject, requiredFields = []) {
  if (!parsedObject || typeof parsedObject !== 'object') {
    throw new Error('Verification failed: AI response is not a valid JSON object.');
  }

  for (const field of requiredFields) {
    if (parsedObject[field] === undefined) {
      throw new Error(`Verification failed: Missing required output field "${field}"`);
    }
  }
  return true;
}

module.exports = {
  parseAiResult,
  validateSchema
};
