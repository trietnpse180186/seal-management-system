/**
 * System-Level Harness: Layer 02 - Tool Registry
 * A central registration point (MCP-like Gateway) for tools that AI Agents can execute.
 */

const registry = new Map();

/**
 * Register a new tool with a schema and execution function
 */
function registerTool(name, description, executeFn, parametersSchema = {}) {
  registry.set(name, {
    description,
    execute: executeFn,
    schema: parametersSchema
  });
  console.log(`[TOOL REGISTRY] Registered tool: "${name}"`);
}

/**
 * Execute a tool by name with arguments
 */
async function executeTool(name, args = {}) {
  const tool = registry.get(name);
  if (!tool) {
    throw new Error(`Tool "${name}" is not registered in the System-Level Harness.`);
  }
  
  console.log(`[TOOL REGISTRY] Executing tool: "${name}" with args:`, JSON.stringify(args));
  try {
    return await tool.execute(args);
  } catch (error) {
    console.error(`[TOOL REGISTRY ERROR] Failed executing tool "${name}":`, error.message);
    throw error;
  }
}

/**
 * Get schemas of all registered tools (for LLM Function Calling)
 */
function getRegisteredToolSchemas() {
  const schemas = [];
  for (const [name, tool] of registry.entries()) {
    schemas.push({
      name,
      description: tool.description,
      parameters: tool.schema
    });
  }
  return schemas;
}

// --- Pre-register Core Database Tools for backward compatibility ---
const dbTools = require('../../features/github-ai/tools/dbTools');

registerTool(
  'saveAiAnalysisRecord',
  'Saves or updates an AI analysis record in MongoDB database.',
  async (args) => await dbTools.saveAiAnalysisRecord(args),
  {
    type: 'object',
    properties: {
      repositoryId: { type: 'string' },
      teamId: { type: 'string' },
      analysisType: { type: 'string', enum: ['commit_review', 'repository_review'] },
      result: { type: 'object' },
      status: { type: 'string' }
    },
    required: ['repositoryId', 'teamId', 'analysisType', 'result']
  }
);

registerTool(
  'updateCommitDiffSummary',
  'Updates the diff summary for a specific commit in database.',
  async (args) => await dbTools.updateCommitDiffSummary(args.commitId, args.summary),
  {
    type: 'object',
    properties: {
      commitId: { type: 'string' },
      summary: { type: 'string' }
    },
    required: ['commitId', 'summary']
  }
);

module.exports = {
  registerTool,
  executeTool,
  getRegisteredToolSchemas,
  registry
};
