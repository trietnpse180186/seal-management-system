const mongoose = require('../../server/node_modules/mongoose');
const { Octokit } = require('@octokit/rest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const orgName = 'sealhackathon-2026';

if (!githubToken) {
  console.error('[ERROR] GITHUB_PERSONAL_ACCESS_TOKEN is not defined in server/.env');
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });

async function main() {
  console.log('[CLEANUP] Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[CLEANUP] Connected successfully.');

  // Define simple schemas
  const EventSchema = new mongoose.Schema({ name: String });
  const TrackSchema = new mongoose.Schema({ eventId: mongoose.Schema.Types.ObjectId });
  const RoundSchema = new mongoose.Schema({ eventId: mongoose.Schema.Types.ObjectId });
  const TeamSchema = new mongoose.Schema({ eventId: mongoose.Schema.Types.ObjectId });
  const EventRoleSchema = new mongoose.Schema({ eventId: mongoose.Schema.Types.ObjectId });
  const GithubRepositorySchema = new mongoose.Schema({ eventId: mongoose.Schema.Types.ObjectId, repoName: String });
  const CommitSchema = new mongoose.Schema({ teamId: mongoose.Schema.Types.ObjectId });
  const CommitFileSchema = new mongoose.Schema({ repositoryId: mongoose.Schema.Types.ObjectId });
  const AiAnalysisSchema = new mongoose.Schema({ eventId: mongoose.Schema.Types.ObjectId, teamId: mongoose.Schema.Types.ObjectId });
  const RubricSchema = new mongoose.Schema({ roundId: mongoose.Schema.Types.ObjectId });
  const CriterionSchema = new mongoose.Schema({ rubricId: mongoose.Schema.Types.ObjectId });

  // Compile models
  const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);
  const Track = mongoose.models.Track || mongoose.model('Track', TrackSchema);
  const Round = mongoose.models.Round || mongoose.model('Round', RoundSchema);
  const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);
  const EventRole = mongoose.models.EventRole || mongoose.model('EventRole', EventRoleSchema);
  const GithubRepository = mongoose.models.GithubRepository || mongoose.model('GithubRepository', GithubRepositorySchema);
  const Commit = mongoose.models.Commit || mongoose.model('Commit', CommitSchema);
  const CommitFile = mongoose.models.CommitFile || mongoose.model('CommitFile', CommitFileSchema);
  const AiAnalysis = mongoose.models.AiAnalysis || mongoose.model('AiAnalysis', AiAnalysisSchema);
  const Rubric = mongoose.models.Rubric || mongoose.model('Rubric', RubricSchema);
  const Criterion = mongoose.models.Criterion || mongoose.model('Criterion', CriterionSchema);

  // Find our stress test event by semester and year to free the unique key constraint
  const event = await Event.findOne({ semester: 'Summer', year: 2026 });
  if (!event) {
    console.log('[CLEANUP] Summer 2026 Event not found. Nothing to clean up.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const eventId = event._id;

  // 1. Delete GitHub Repositories
  const repos = await GithubRepository.find({ eventId });
  console.log(`[CLEANUP] Found ${repos.length} GitHub repositories to delete...`);

  for (const repo of repos) {
    try {
      console.log(`[GITHUB] Deleting repository ${orgName}/${repo.repoName} on GitHub...`);
      await octokit.repos.delete({
        owner: orgName,
        repo: repo.repoName
      });
      console.log(`[GITHUB] Successfully deleted repo: ${repo.repoName}`);
    } catch (err) {
      console.warn(`[GITHUB WARNING] Failed to delete repository ${repo.repoName}:`, err.message);
      console.log('[GITHUB INFO] This is expected if the token does not have "delete_repo" scope. You can manually delete them from the organization dashboard.');
    }
  }

  // 2. Clean Database Records
  console.log('[CLEANUP] Deleting MongoDB records...');
  
  // Find teams to delete their commits and analyses
  const teams = await Team.find({ eventId });
  const teamIds = teams.map(t => t._id);

  const deletedCommits = await Commit.deleteMany({ teamId: { $in: teamIds } });
  const deletedCommitFiles = await CommitFile.deleteMany({ repositoryId: { $in: repos.map(r => r._id) } });
  const deletedAnalyses = await AiAnalysis.deleteMany({ teamId: { $in: teamIds } });

  const deletedTeams = await Team.deleteMany({ eventId });
  const deletedEventRoles = await EventRole.deleteMany({ eventId });
  const deletedRepos = await GithubRepository.deleteMany({ eventId });

  // Delete Rubric and Criteria
  const rounds = await Round.find({ eventId });
  const roundIds = rounds.map(r => r._id);
  
  const rubrics = await Rubric.find({ roundId: { $in: roundIds } });
  const rubricIds = rubrics.map(ru => ru._id);

  const deletedCriteria = await Criterion.deleteMany({ rubricId: { $in: rubricIds } });
  const deletedRubrics = await Rubric.deleteMany({ roundId: { $in: roundIds } });
  const deletedRounds = await Round.deleteMany({ eventId });
  const deletedTracks = await Track.deleteMany({ eventId });
  const deletedEvent = await Event.deleteOne({ _id: eventId });

  console.log('\n====================================================');
  console.log('[CLEANUP SUMMARY]');
  console.log(`- Deleted Event: ${deletedEvent.deletedCount}`);
  console.log(`- Deleted Tracks: ${deletedTracks.deletedCount}`);
  console.log(`- Deleted Rounds: ${deletedRounds.deletedCount}`);
  console.log(`- Deleted Rubrics: ${deletedRubrics.deletedCount}`);
  console.log(`- Deleted Criteria: ${deletedCriteria.deletedCount}`);
  console.log(`- Deleted Teams: ${deletedTeams.deletedCount}`);
  console.log(`- Deleted EventRoles: ${deletedEventRoles.deletedCount}`);
  console.log(`- Deleted Repos: ${deletedRepos.deletedCount}`);
  console.log(`- Deleted Commits: ${deletedCommits.deletedCount}`);
  console.log(`- Deleted CommitFiles: ${deletedCommitFiles.deletedCount}`);
  console.log(`- Deleted AI Analyses: ${deletedAnalyses.deletedCount}`);
  console.log('====================================================\n');

  console.log('[CLEANUP COMPLETED] Cleanup finished successfully.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[FATAL CLEANUP ERROR]:', err);
  mongoose.disconnect();
});
