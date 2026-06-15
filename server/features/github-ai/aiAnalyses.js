const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const AiAnalysis = mongoose.model('AiAnalysis');
const Commit = mongoose.model('Commit');
const GithubRepository = mongoose.model('GithubRepository');
const Team = mongoose.model('Team');

const aiService = require('./aiService');
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
      
    res.json(analyses);
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
    
    res.json(analysis);
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

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Không tìm thấy đội thi.' });

    const repo = await GithubRepository.findOne({ teamId });
    if (!repo) return res.status(400).json({ message: 'Đội thi này chưa được thiết lập GitHub repository.' });

    console.log(`[SYNC MANUAL] Running Team Aggregate Review for team: ${teamId}...`);
    
    // Fetch up to 200 commits
    const commits = await Commit.find({ teamId }).sort({ committedAt: 1 }).limit(200);
    // Fetch up to 40 prior reviews
    const priorReviews = await AiAnalysis.find({
      teamId,
      analysisType: 'commit_review',
      status: 'completed'
    }).sort({ createdAt: -1 }).limit(40);

    const aggResult = await aiService.analyzeTeamAggregate(teamId, commits, priorReviews);

    const aggAnalysis = new AiAnalysis({
      repositoryId: repo._id,
      teamId: teamId,
      analysisType: 'repository_review', // maps to team_aggregate
      provider: 'Google Gemini',
      model: 'gemini-3.1-flash-lite',
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

module.exports = router;
