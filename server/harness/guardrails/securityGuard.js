/**
 * System-Level Harness: Layer 03 - Guardrails (Security Guard)
 * Input sanitization, Prompt Injection defense, and sensitive data scrubbing.
 */

const BLOCKED_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt override/i,
  /bypass security/i,
  /dan mode/i
];

/**
 * Sanitizes input string to prevent Prompt Injection
 */
function sanitizePromptString(inputStr) {
  if (typeof inputStr !== 'string') return inputStr;
  
  let cleaned = inputStr;
  // Check against prompt injection patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cleaned)) {
      console.warn(`[SECURITY GUARD] Prompt injection pattern detected and blocked: ${pattern}`);
      cleaned = cleaned.replace(pattern, '[REDACTED PROMPT INJECTION]');
    }
  }
  
  // Clean sensitive env values if leaked
  const sensitiveKeys = ['GEMINI_API_KEY', 'N8N_API_KEY', 'MONGO_URI', 'FIREBASE_PRIVATE_KEY'];
  for (const key of sensitiveKeys) {
    const val = process.env[key];
    if (val && cleaned.includes(val)) {
      console.warn(`[SECURITY GUARD] Redacted sensitive environment key leak: ${key}`);
      cleaned = cleaned.replaceAll(val, `[REDACTED_${key}]`);
    }
  }
  
  return cleaned;
}

/**
 * Express middleware to sanitize body and query inputs (Global Guardrail)
 */
function globalSecurityGuardMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

/**
 * Recursive object sanitizer helper
 */
function sanitizeObject(obj) {
  if (!obj) return obj;
  if (typeof obj === 'string') return sanitizePromptString(obj);
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));
  if (typeof obj === 'object') {
    const cleanedObj = {};
    for (const [key, val] of Object.entries(obj)) {
      cleanedObj[key] = sanitizeObject(val);
    }
    return cleanedObj;
  }
  return obj;
}

module.exports = {
  sanitizePromptString,
  globalSecurityGuardMiddleware,
  sanitizeObject
};
