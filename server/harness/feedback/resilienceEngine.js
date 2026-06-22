/**
 * System-Level Harness: Layer 05 - Resilience Engine & Feedback Loops
 * Implements retry mechanics, exponential backoffs, and JSON self-correction protocols.
 */

/**
 * Execute a promise-returning function with a retry mechanism and exponential backoff
 */
async function executeWithRetry(fn, label = 'Operation', maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      console.warn(`[RESILIENCE ENGINE] ${label} failed (Attempt ${attempt}/${maxRetries + 1}): ${error.message}`);
      if (attempt > maxRetries) {
        throw error;
      }
      const delay = attempt * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Try to repair and sanitize a corrupted JSON string returned by LLMs
 */
function autoFixJsonString(rawText) {
  if (!rawText) return null;
  
  let cleaned = rawText.trim();
  // Remove markdown blocks
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    try {
      // Clean trailing commas
      const fixedCommas = cleaned
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/,\s*,/g, ',');
      return JSON.parse(fixedCommas);
    } catch (err2) {
      console.error('[RESILIENCE ENGINE] JSON syntax is too corrupted to auto-fix:', err.message);
      return null;
    }
  }
}

module.exports = {
  executeWithRetry,
  autoFixJsonString
};
