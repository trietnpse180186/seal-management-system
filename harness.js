#!/usr/bin/env node
/**
 * System-Level Harness: Global Scaffolding CLI
 * Provides a unified interface to seed databases, list schemas, inspect telemetry,
 * and test mock/production AI Agent flows globally.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const mongoose = require('./server/node_modules/mongoose');
const toolRegistry = require('./server/harness/gateway/toolRegistry');
const hitlManager = require('./server/harness/telemetry/hitlManager');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

async function run() {
  switch (command) {
    case 'tools:list':
      console.log('\n--- REGISTERED TOOLS IN SYSTEM-LEVEL HARNESS ---');
      const schemas = toolRegistry.getRegisteredToolSchemas();
      schemas.forEach(tool => {
        console.log(`\n🛠️  Tool: "${tool.name}"`);
        console.log(`   Description: ${tool.description}`);
        console.log(`   Schema: ${JSON.stringify(tool.parameters.properties, null, 2)}`);
      });
      break;

    case 'telemetry:status':
      console.log('\n--- GLOBAL HARNESS TELEMETRY STATUS ---');
      console.log(JSON.stringify(hitlManager.getTelemetryStats(), null, 2));
      break;

    case 'db:seed':
      console.log('Seeding mock data for developer harness...');
      await connectDB();
      try {
        const setupScript = require('./test-tools/seeding/setup_complete_mock_contest');
        console.log('Successfully completed mock contest seeding.');
      } catch (err) {
        console.error('Seeding failed:', err.message);
      } finally {
        await mongoose.connection.close();
      }
      break;

    case 'test:sync':
      console.log('Running Git sync & AI Analysis integration test...');
      await connectDB();
      try {
        // Run test runner
        process.env.GITHUB_SERVICE_MOCK = 'true';
        process.env.GEMINI_SERVICE_MOCK = 'true';
        process.env.NODE_PATH = 'server/node_modules';
        require('./test-tools/flows/git_sync_ai_test');
      } catch (err) {
        console.error('Test run failed:', err.message);
        await mongoose.connection.close();
      }
      break;

    default:
      console.error(`Unknown command: "${command}". Run "node harness.js help" for details.`);
      process.exit(1);
  }
}

async function connectDB() {
  console.log(`Connecting to database: ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected successfully.');
}

function showHelp() {
  console.log(`
🤖 System-Level Harness CLI Scaffolding
Usage: node harness.js <command>

Available commands:
  tools:list          List all tools registered in the central Gateway.
  telemetry:status    Show token usage and latency telemetry logs.
  db:seed             Seed mock hackathon database states for dev testing.
  test:sync           Run full commit sync and AI review simulation.
  help                Show this help screen.
  `);
}

run();
