/**
 * Scope and boundary constraints for AI Agent Harness
 */

const SCOPE_CONFIG = {
  // Max diff size in characters to prevent API context overflow and manage token budget
  MAX_SINGLE_FILE_PATCH_SIZE: 3000,
  MAX_AGGREGATED_DIFF_SIZE: 50000,
  
  // Files to ignore from AI reviews
  IGNORED_FILES: [
    '.gitignore',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.env',
    '.env.example',
    'README.md'
  ],
  
  // Supported AI review types
  ALLOWED_ANALYSIS_TYPES: [
    'commit_review',
    'repository_review',
    'readme_summary',
    'scoring_suggestion'
  ]
};

/**
 * Filter and truncate patch content to keep it within safe boundaries
 */
function enforceFilePatchBoundary(patchContent) {
  if (!patchContent) return '';
  if (patchContent.length > SCOPE_CONFIG.MAX_SINGLE_FILE_PATCH_SIZE) {
    return patchContent.substring(0, SCOPE_CONFIG.MAX_SINGLE_FILE_PATCH_SIZE) + 
      '\n... [Truncated due to size limits in Harness] ...';
  }
  return patchContent;
}

/**
 * Filter out ignored files
 */
function shouldIgnoreFile(filename) {
  return SCOPE_CONFIG.IGNORED_FILES.some(skip => filename.endsWith(skip));
}

module.exports = {
  SCOPE_CONFIG,
  enforceFilePatchBoundary,
  shouldIgnoreFile
};
