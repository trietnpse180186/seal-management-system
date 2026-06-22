/**
 * Feedback Loops Layer
 * Handles self-correction, retry managers, and resilience protocols.
 */

const outputValidator = require('../guardrails/outputValidator');

/**
 * Execute a promise-returning function with a retry mechanism
 */
async function executeWithRetry(fn, label = 'Operation', maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      console.warn(`[RETRY MANAGER] ${label} failed (Attempt ${attempt}/${maxRetries + 1}): ${error.message}`);
      if (attempt > maxRetries) {
        throw error;
      }
      // Wait for a short duration before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

/**
 * Attempt to auto-fix and sanitize a raw JSON string if parsing fails
 */
function autoFixJsonString(rawText) {
  if (!rawText) return null;
  
  let cleaned = rawText.trim();
  // 1. Remove markdown block wrappers
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // 2. Common fix: Strip trailing commas in arrays/objects
    try {
      const fixedTrailingCommas = cleaned
        .replace(/,\s*([\]}])/g, '$1') // remove trailing commas before closing brackets
        .replace(/,\s*,/g, ',');       // remove double commas
      return JSON.parse(fixedTrailingCommas);
    } catch (err2) {
      // Return null or fallback
      console.error('[RETRY MANAGER] Failed to auto-fix JSON syntax error:', err.message);
      return null;
    }
  }
}

module.exports = {
  executeWithRetry,
  autoFixJsonString
};
