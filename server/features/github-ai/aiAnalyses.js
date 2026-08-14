const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const AiAnalysis = mongoose.model('AiAnalysis');
const Commit = mongoose.model('Commit');
const GithubRepository = mongoose.model('GithubRepository');
const Team = mongoose.model('Team');
const Rubric = mongoose.model('Rubric');
const Criterion = mongoose.model('Criterion');

const aiService = require('./aiService');
const { parseAiResult } = require('./aiService');
const { authenticateToken } = require('../auth/authMiddleware');

/**
 * @route   GET /api/ai-analyses/team/:teamId
 * @desc    Get all AI analyses (per-push and team aggregate reviews) for a team
 * @access  Private
 */
router.get('/team/:teamId', authenticateToken, async (req, res) => {
  try {
    const analyses = await AiAnalysis.find({ teamId: req.params.teamId })
      .populate('commitId', 'message commitSha committedAt authorGithubUsername authorName')
      .populate('teamId', 'name')
      .populate('repositoryId', 'repoName repoUrl')
      .sort({ createdAt: -1 });
      
    const cleanedAnalyses = analyses.map(a => {
      const obj = a.toObject();
      obj.result = parseAiResult(obj.result);
      return obj;
    });
    res.json(cleanedAnalyses);
  } catch (error) {
    console.error('Fetch AI analyses error:', error.message);
    res.status(500).json({ message: 'Server error fetching AI analyses.' });
  }
});

/**
 * @route   GET /api/ai-analyses/stats
 * @desc    Get aggregate stats of reviews for Hackathon Review Dashboard
 * @access  Private
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // 1. Total active teams with repository
    const activeTeamsCount = await GithubRepository.countDocuments({ isArchived: false });
    
    // 2. Count of per-push records
    const perPushCount = await AiAnalysis.countDocuments({ analysisType: 'commit_review', status: 'completed' });
    
    // 3. Count of total records
    const totalRecords = await AiAnalysis.countDocuments({ status: 'completed' });

    // 4. Latest sync time
    const latestReview = await AiAnalysis.findOne({ status: 'completed' }).sort({ completedAt: -1 });
    const lastSyncTime = latestReview ? latestReview.completedAt : new Date();

    res.json({
      activeTeamsCount,
      perPushCount,
      totalRecords,
      lastSyncTime
    });
  } catch (error) {
    console.error('Fetch review stats error:', error.message);
    res.status(500).json({ message: 'Server error fetching stats.' });
  }
});

/**
 * @route   GET /api/ai-analyses/:id
 * @desc    Get details of a specific AI analysis record
 * @access  Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const analysis = await AiAnalysis.findById(req.params.id)
      .populate('commitId')
      .populate('repositoryId')
      .populate('teamId');
      
    if (!analysis) {
      return res.status(404).json({ message: 'Không tìm thấy phân tích AI.' });
    }
    
    const obj = analysis.toObject();
    obj.result = parseAiResult(obj.result);
    res.json(obj);
  } catch (error) {
    console.error('Get AI analysis detail error:', error.message);
    res.status(500).json({ message: 'Server error fetching AI analysis details.' });
  }
});

/**
 * @route   POST /api/ai-analyses/team/:teamId/aggregate
 * @desc    Manually trigger a team aggregate review
 * @access  Private
 */
router.post('/team/:teamId/aggregate', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { roundId, rubricId } = req.body;

  try {
    if (!roundId || !rubricId) {
      return res.status(400).json({ message: 'roundId and rubricId are required for Agent 2 analysis.' });
    }
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Không tìm thấy đội thi.' });

    const repo = await GithubRepository.findOne({ teamId });
    if (!repo) return res.status(400).json({ message: 'Đội thi này chưa được thiết lập GitHub repository.' });

    const rubric = await Rubric.findOne({ _id: rubricId, roundId, isActive: true });
    if (!rubric) return res.status(400).json({ message: 'Rubric is not active or is not assigned to the selected round.' });
    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });
    if (criteria.length === 0) return res.status(404).json({ message: 'No criteria found for this rubric.' });

    console.log(`[AI MANUAL] Running Agent 2 aggregate review for team: ${teamId}, round: ${roundId}...`);
    
    // Fetch up to 40 commits
    const commits = await Commit.find({ teamId, message: { $not: /initial commit/i } }).sort({ committedAt: 1 }).limit(40);
    // Fetch up to 10 prior reviews (if available)
    const priorReviews = await AiAnalysis.find({
      teamId,
      repositoryId: repo._id,
      analysisType: 'commit_review',
      status: 'completed'
    }).sort({ createdAt: -1 }).limit(10);

    const aggResult = await aiService.analyzeTeamAggregate(
      teamId,
      commits,
      priorReviews,
      { roundId, rubricId, criteria }
    );

    const aggAnalysis = new AiAnalysis({
      repositoryId: repo._id,
      teamId: teamId,
      roundId,
      analysisType: 'repository_review', // maps to team_aggregate
      provider: aggResult._provider || 'Google Gemini',
      model: aggResult._model || 'gemini-3.1-flash-lite',
      inputSummary: {
        trigger: 'manual_ai_analysis',
        rubricId,
        rubricVersion: rubric.version,
        agent1AnalysisIds: priorReviews.map(review => review._id)
      },
      result: aggResult,
      status: 'completed',
      completedAt: new Date()
    });
    await aggAnalysis.save();

    res.json({
      message: 'Phân tích tổng hợp đội thi đã hoàn thành thành công!',
      analysis: aggAnalysis
    });

  } catch (error) {
    console.error('Manual aggregate review error:', error.message);
    res.status(500).json({ message: error.message || 'Server error running aggregate review.' });
  }
});

/**
 * @route   POST /api/ai-analyses/n8n-callback
 * @desc    Callback endpoint for n8n to asynchronously save AI analysis results
 * @access  Public (Secured via X-API-Key header)
 */
router.post('/n8n-callback', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.N8N_API_KEY || 'seal-n8n-secret-key-2026';
  
  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ message: 'Unauthorized callback. Invalid X-API-Key.' });
  }

  const { analysisId, repositoryId, teamId, commitId, analysisType, result, status, provider, model } = req.body;

  if (!repositoryId || !teamId || !analysisType || !result) {
    return res.status(400).json({ message: 'Missing required fields: repositoryId, teamId, analysisType, result.' });
  }

  try {
    const parsedResult = parseAiResult(result);
    let aiAnalysis;
    if (analysisId) {
      aiAnalysis = await AiAnalysis.findById(analysisId);
    }

    if (!aiAnalysis && commitId) {
      aiAnalysis = await AiAnalysis.findOne({ commitId, analysisType });
    }

    if (aiAnalysis) {
      aiAnalysis.result = parsedResult;
      aiAnalysis.status = status || 'completed';
      if (provider) aiAnalysis.provider = provider;
      if (model) aiAnalysis.model = model;
      aiAnalysis.completedAt = new Date();
      await aiAnalysis.save();
      console.log(`[N8N CALLBACK] Updated existing AiAnalysis record: ${aiAnalysis._id}`);
    } else {
      aiAnalysis = new AiAnalysis({
        repositoryId,
        teamId,
        commitId,
        analysisType,
        provider: provider || 'n8n-gemini',
        model: model || 'n8n-workflow',
        result: parsedResult,
        status: status || 'completed',
        completedAt: new Date()
      });
      await aiAnalysis.save();
      console.log(`[N8N CALLBACK] Created new AiAnalysis record: ${aiAnalysis._id}`);
    }

    // If it's a commit review, update the commit message diff summary
    if (analysisType === 'commit_review' && commitId) {
      const Commit = mongoose.model('Commit');
      const commit = await Commit.findById(commitId);
      if (commit) {
        commit.diffSummary = parsedResult.overall_picture?.push_summary || parsedResult.summary || '';
        await commit.save();
      }
    }

    res.json({ message: 'Analysis saved successfully.', analysis: aiAnalysis });
  } catch (error) {
    console.error('n8n callback error:', error.message);
    res.status(500).json({ message: 'Server error saving callback analysis.' });
  }
});

module.exports = router;
