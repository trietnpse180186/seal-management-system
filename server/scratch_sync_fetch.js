const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';

mongoose.connect(MONGO_URI).then(async () => {
  const Team = require('./features/teams/Team');
  const { fetchExternalKeys } = require('./features/teams/externalTeamService');

  const team = await Team.findOne({ name: 'CCCCCCCCCCCCCCCCCC' });
  if (!team) {
    console.log('Team C not found');
    process.exit(1);
  }

  console.log('Current Team C:', team.toObject());

  try {
    const code = 'CCCCCCCCCCCCCCCCCC';
    const result = await fetchExternalKeys(code);
    console.log('Fetched Keys:', result);

    team.externalTeamCode = code;
    team.externalTeamId = result.teamId || result.id || ''; // Let's check where the team ID is
    team.accessCode = result.accessCode || '';
    team.testApiKey = result.testApiKey || '';
    team.judgeApiKey = result.judgeApiKey || '';
    team.mqttUsername = result.mqttUsername || '';
    team.mqttPassword = result.mqttPassword || '';
    team.testTopic = `hackathon/${code.toLowerCase()}/test/telemetry`;
    team.judgeTopic = `hackathon/${code.toLowerCase()}/judge/telemetry`;

    const saved = await team.save();
    console.log('Updated Team C successfully:', saved.toObject());
  } catch (err) {
    console.error('Error fetching/updating keys:', err);
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
