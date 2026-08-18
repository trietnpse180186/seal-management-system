const { Octokit } = require('@octokit/rest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const orgName = 'sealhackathon-2026';

if (!githubToken) {
  console.error('[ERROR] GITHUB_PERSONAL_ACCESS_TOKEN is not defined in server/.env');
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });

async function main() {
  console.log(`[GITHUB CLEANUP] Listing all repositories for organization "${orgName}"...`);

  try {
    let repos = [];
    let page = 1;
    let keepFetching = true;

    while (keepFetching) {
      const response = await octokit.repos.listForOrg({
        org: orgName,
        per_page: 100,
        page: page
      });

      if (response.data.length === 0) {
        keepFetching = false;
      } else {
        repos = repos.concat(response.data);
        page++;
      }
    }

    console.log(`[GITHUB CLEANUP] Found ${repos.length} repositories in total.`);

    // Filter repos starting with "team-stress-"
    const stressRepos = repos.filter(r => r.name.startsWith('team-stress-'));

    if (stressRepos.length === 0) {
      console.log('[GITHUB CLEANUP] No repositories matching "team-stress-*" found. Nothing to delete.');
      return;
    }

    console.log(`[GITHUB CLEANUP] Found ${stressRepos.length} stress test repositories to delete.`);

    let successCount = 0;
    let failCount = 0;

    for (const repo of stressRepos) {
      try {
        console.log(`[GITHUB CLEANUP] Deleting ${orgName}/${repo.name}...`);
        await octokit.repos.delete({
          owner: orgName,
          repo: repo.name
        });
        console.log(`[GITHUB CLEANUP] Successfully deleted ${repo.name}`);
        successCount++;
      } catch (err) {
        console.error(`[GITHUB CLEANUP ERROR] Failed to delete ${repo.name}:`, err.message);
        if (err.status === 403 || err.status === 401) {
          console.error('[GITHUB CLEANUP SUGGESTION] Please make sure your GitHub Personal Access Token has the "delete_repo" scope enabled.');
        }
        failCount++;
      }
    }

    console.log('\n====================================================');
    console.log('[GITHUB CLEANUP COMPLETE]');
    console.log(`- Successfully deleted: ${successCount}`);
    console.log(`- Failed to delete: ${failCount}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('[FATAL GITHUB CLEANUP ERROR]:', error.message);
  }
}

main();
