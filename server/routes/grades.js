const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Score = mongoose.model('Score');
const ScoreDetail = mongoose.model('ScoreDetail');
const Rubric = mongoose.model('Rubric');
const Criterion = mongoose.model('Criterion');
const Team = mongoose.model('Team');
const Round = mongoose.model('Round');
const GithubRepository = mongoose.model('GithubRepository');
const RepositorySnapshot = mongoose.model('RepositorySnapshot');
const Commit = mongoose.model('Commit');
const Ranking = mongoose.model('Ranking');
const EventRole = mongoose.model('EventRole');
const Track = mongoose.model('Track');

const aiService = require('../services/aiService');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/grades/suggestion
 * @desc    Get Gemini AI suggested grading based on commits & rubric
 * @access  Private (Judges / Coords)
 */
router.get('/suggestion', authenticateToken, async (req, res) => {
  const { teamId, roundId, rubricId } = req.query;

  if (!teamId || !roundId || !rubricId) {
    return res.status(400).json({ message: 'Missing teamId, roundId, or rubricId parameters.' });
  }

  try {
    // 1. Fetch criteria
    const criteria = await Criterion.find({ rubricId }).sort({ order: 1 });
    if (criteria.length === 0) {
      return res.status(404).json({ message: 'No criteria found for this rubric.' });
    }

    // 2. Fetch repo & commits
    const repo = await GithubRepository.findOne({ teamId });
    if (!repo) {
      return res.status(404).json({ message: 'No GitHub repository associated with this team.' });
    }

    const commits = await Commit.find({ teamId }).sort({ committedAt: -1 }).limit(10);

    // 3. Find or create a snapshot representation
    let snapshot = await RepositorySnapshot.findOne({ teamId, roundId });
    if (!snapshot) {
      snapshot = new RepositorySnapshot({
        repositoryId: repo._id,
        teamId,
        roundId,
        commitSha: repo.lastCommitSha || 'mock-sha-latest',
        branch: repo.defaultBranch,
        capturedReason: 'AI Grading Pre-fetch Generation'
      });
      await snapshot.save();
    }

    // 4. Generate suggestion
    const suggestions = await aiService.generateScoringSuggestion(snapshot, commits, criteria);

    // Map code back to Criterion ID for UI ease
    const mappedSuggestions = suggestions.map(s => {
      const match = criteria.find(c => c.code === s.criterionCode);
      return {
        ...s,
        criterionId: match ? match._id : null
      };
    });

    res.json(mappedSuggestions);

  } catch (error) {
    console.error('AI Grading Suggestion Error:', error.message);
    res.status(500).json({ message: 'Server error generating suggestions.' });
  }
});

/**
 * @route   GET /api/grades/team/:teamId/round/:roundId
 * @desc    Get existing score for a team in a round by the current judge
 * @access  Private (Judges / Coords)
 */
router.get('/team/:teamId/round/:roundId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    // Check if the user is a coordinator or system admin
    const coordinatorRole = await EventRole.findOne({
      userId: req.user._id,
      eventId: team.eventId,
      role: 'coordinator',
      status: 'active'
    });
    const isCoordinator = req.user.isSystemAdmin || !!coordinatorRole;

    if (isCoordinator) {
      // Coordinator views all scores submitted/locked by all judges for this team/round
      const scores = await Score.find({
        teamId: req.params.teamId,
        roundId: req.params.roundId,
        status: { $in: ['submitted', 'locked'] }
      }).populate('judgeId', 'fullName email');

      const results = [];
      for (const s of scores) {
        const details = await ScoreDetail.find({ scoreId: s._id });
        results.push({
          judge: s.judgeId,
          score: s,
          details: details
        });
      }

      return res.json({
        isCoordinator: true,
        judgesScores: results
      });
    }

    // Standard Judge views their own score
    const score = await Score.findOne({
      teamId: req.params.teamId,
      roundId: req.params.roundId,
      judgeId: req.user._id
    });

    if (!score) {
      return res.json({ score: null, details: [] });
    }

    const details = await ScoreDetail.find({ scoreId: score._id });
    res.json({ score, details });
  } catch (error) {
    console.error('Fetch Score Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving scores.' });
  }
});

/**
 * @route   POST /api/grades/submit
 * @desc    Submit score for a team by a judge
 * @access  Private (Judges / Coords)
 */
router.post('/submit', authenticateToken, async (req, res) => {
  const { teamId, roundId, rubricId, overallComment, details } = req.body;

  if (!teamId || !roundId || !rubricId || !details || !Array.isArray(details)) {
    return res.status(400).json({ message: 'Missing required grading submission parameters.' });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    const rubric = await Rubric.findById(rubricId);
    if (!rubric) return res.status(404).json({ message: 'Rubric not found.' });
    if (!rubric.isLocked) {
      return res.status(400).json({ message: 'Rubric must be locked by the coordinator before scores can be input.' });
    }

    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });
    if (round.status === 'completed') {
      return res.status(400).json({ message: 'Vòng đấu này đã bị khoá. Điểm số đã được chốt và không thể sửa đổi.' });
    }

    // Verify user is a Judge or Coordinator in this event
    const userRole = await EventRole.findOne({
      userId: req.user._id,
      eventId: team.eventId,
      role: { $in: ['judge', 'coordinator'] },
      status: 'active'
    });

    if (!userRole && !req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Only assigned judges or coordinators can submit scores.' });
    }

    const repo = await GithubRepository.findOne({ teamId });
    const snapshot = await RepositorySnapshot.findOne({ teamId, roundId });

    // Calculate score totals
    let totalRawScore = 0;
    let totalWeightedScore = 0;

    const criteriaList = await Criterion.find({ rubricId });
    const detailsToSave = [];

    for (const d of details) {
      const { criterionId, scoreValue, comment } = d;
      const criterion = criteriaList.find(c => c._id.toString() === criterionId.toString());

      if (!criterion) {
        return res.status(400).json({ message: `Criterion ID ${criterionId} not found in rubric.` });
      }

      if (scoreValue < 0 || scoreValue > criterion.maxScore) {
        return res.status(400).json({
          message: `Score value ${scoreValue} violates boundaries (0 to ${criterion.maxScore}) for ${criterion.name}.`
        });
      }

      // Math weighted score: scoreValue * (weight / totalRubricWeight)
      const wScore = scoreValue * (criterion.weight / rubric.totalWeight);

      totalRawScore += scoreValue;
      totalWeightedScore += wScore;

      detailsToSave.push({
        criterionId,
        scoreValue,
        weightedScore: Math.round(wScore * 100) / 100,
        comment
      });
    }

    // Create or update Score
    let score = await Score.findOne({ teamId, roundId, judgeId: req.user._id });
    if (score) {
      if (score.status === 'locked') {
        return res.status(400).json({ message: 'Điểm số của bạn cho đội thi này trong vòng đấu này đã bị khoá.' });
      }
      score.totalRawScore = totalRawScore;
      score.totalWeightedScore = Math.round(totalWeightedScore * 100) / 100;
      score.overallComment = overallComment;
      score.status = 'submitted';
      score.submittedAt = new Date();
      await score.save();
    } else {
      score = new Score({
        teamId,
        repositoryId: repo ? repo._id : undefined,
        repositorySnapshotId: snapshot ? snapshot._id : undefined,
        eventId: team.eventId,
        trackId: team.trackId,
        roundId,
        rubricId,
        judgeId: req.user._id,
        totalRawScore,
        totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
        overallComment,
        status: 'submitted',
        submittedAt: new Date()
      });
      await score.save();
    }

    // Save details (re-create for clarity)
    await ScoreDetail.deleteMany({ scoreId: score._id });

    const preparedDetails = detailsToSave.map(d => ({
      scoreId: score._id,
      ...d
    }));
    await ScoreDetail.insertMany(preparedDetails);

    res.json({
      message: 'Scores submitted successfully!',
      scoreId: score._id,
      totalRawScore,
      totalWeightedScore: score.totalWeightedScore
    });

  } catch (error) {
    console.error('Submit Grade Error:', error.message);
    res.status(500).json({ message: 'Server error saving scores.' });
  }
});

/**
 * @route   POST /api/grades/lock-round
 * @desc    Finalize all scores and generate rankings
 * @access  Private (Coordinator or Admin)
 */
router.post('/lock-round', authenticateToken, async (req, res) => {
  const { eventId, roundId } = req.body;

  if (!eventId || !roundId) {
    return res.status(400).json({ message: 'Event ID and Round ID are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({ userId: req.user._id, eventId, role: 'coordinator' });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
    }

    // 1. Get all tracks in this round
    const tracks = await Track.find({ roundId });
    const trackIds = tracks.map(t => t._id);

    // 2. Get all confirmed teams in these tracks
    const teams = await Team.find({ eventId, trackId: { $in: trackIds }, status: 'confirmed' });
    if (teams.length === 0) {
      return res.status(400).json({ message: 'No confirmed teams found in this round.' });
    }

    // 3. Fetch all scores submitted for this round
    const scores = await Score.find({ roundId, status: { $in: ['submitted', 'locked'] } });

    // 4. For each team, calculate average weighted score
    const rankingsData = [];
    for (const team of teams) {
      const teamScores = scores.filter(s => s.teamId.toString() === team._id.toString());
      const judgeCount = teamScores.length;

      let averageScore = 0;
      if (judgeCount > 0) {
        const sum = teamScores.reduce((acc, s) => acc + s.totalWeightedScore, 0);
        averageScore = Math.round((sum / judgeCount) * 100) / 100;
      }

      rankingsData.push({
        teamId: team._id,
        trackId: team.trackId,
        averageScore,
        judgeCount
      });
    }

    // 5. Group by trackId and sort within each track to calculate trackRank
    const tracksMap = {};
    rankingsData.forEach(item => {
      if (item.trackId) {
        const tId = item.trackId.toString();
        if (!tracksMap[tId]) {
          tracksMap[tId] = [];
        }
        tracksMap[tId].push(item);
      }
    });

    for (const tId in tracksMap) {
      const trackTeams = tracksMap[tId];
      trackTeams.sort((a, b) => b.averageScore - a.averageScore);
      trackTeams.forEach((item, idx) => {
        item.trackRank = idx + 1;
      });
    }

    // 6. Sort overall by trackRank ascending, then averageScore descending
    rankingsData.sort((a, b) => {
      const aTrackRank = a.trackRank || 999;
      const bTrackRank = b.trackRank || 999;
      if (aTrackRank !== bTrackRank) {
        return aTrackRank - bTrackRank;
      }
      return b.averageScore - a.averageScore;
    });

    // Get event/round details to check advanceTopN
    const round = await Round.findById(roundId);
    const advanceLimit = round.advanceTopN || 999;

    // Save rankings
    await Ranking.deleteMany({ roundId });

    const rankingsToSave = [];
    for (let idx = 0; idx < rankingsData.length; idx++) {
      const item = rankingsData[idx];
      const rank = idx + 1;
      const isAdvanced = rank <= advanceLimit;

      const rankingRecord = new Ranking({
        eventId,
        trackId: item.trackId,
        roundId,
        teamId: item.teamId,
        averageScore: item.averageScore,
        finalScore: item.averageScore, // custom edits can adjust later
        judgeCount: item.judgeCount,
        rank,
        isAdvanced,
        status: 'published',
        calculatedAt: new Date(),
        publishedAt: new Date()
      });
      rankingsToSave.push(rankingRecord);

      // Lock all scores for this round
      await Score.updateMany({ roundId, teamId: item.teamId }, { status: 'locked', lockedAt: new Date() });
    }

    await Ranking.insertMany(rankingsToSave);

    // Update Round status to completed
    round.status = 'completed';
    await round.save();

    // Gửi thông báo in-app tới toàn bộ thành viên trong bảng đấu
    const Notification = mongoose.model('Notification');
    const TeamMember = mongoose.model('TeamMember');

    for (const team of teams) {
      const members = await TeamMember.find({ teamId: team._id, confirmStatus: 'confirmed' });
      for (const member of members) {
        await new Notification({
          userId: member.userId,
          type: 'round_result',
          title: `Kết quả vòng "${round.name}" đã công bố`,
          body: `Vòng "${round.name}" đã hoàn tất chấm điểm và công bố kết quả. Hãy kiểm tra bảng xếp hạng ngay!`,
          channel: 'in_app',
          metadata: { roundId: round._id, roundName: round.name, eventId, trackId }
        }).save();
      }
    }

    res.json({
      message: 'Round scores finalized, locked, and team rankings generated successfully!',
      rankings: rankingsToSave
    });

  } catch (error) {
    console.error('Lock Round Grades Error:', error.message);
    res.status(500).json({ message: 'Server error locking round grades.' });
  }
});

/**
 * @route   GET /api/grades/leaderboard/:roundId
 * @desc    Get team rankings leaderboard for a round
 * @access  Private
 *   - Coordinator / SystemAdmin: luôn xem được khi đã có ranking (sau lock)
 *   - Các role khác (judge, participant): chỉ xem khi round status = 'completed'
 */
router.get('/leaderboard/:roundId', authenticateToken, async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });

    // Check if the requester is coordinator or system admin
    let isCoordinator = req.user.isSystemAdmin;
    if (!isCoordinator) {
      const coordRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: 'coordinator',
        status: 'active'
      });
      isCoordinator = !!coordRole;
    }

    // Non-coordinator: block if round is not completed yet
    if (!isCoordinator && round.status !== 'completed') {
      return res.json({
        locked: true,
        message: 'Bảng xếp hạng sẽ được công bố sau khi điều phối viên chốt điểm và khóa vòng thi.',
        standings: []
      });
    }

    const leaderboard = await Ranking.find({ roundId: req.params.roundId })
      .sort({ rank: 1 })
      .populate('teamId', 'name status topicSubmission');

    res.json({ locked: false, isCoordinator, standings: leaderboard });
  } catch (error) {
    console.error('Fetch Leaderboard Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving leaderboard.' });
  }
});

/**
 * @route   GET /api/grades/live-ranking/:roundId
 * @desc    Real-time ranking calculated from submitted scores (no lock required)
 * @access  Private (Coordinator / SystemAdmin only)
 */
router.get('/live-ranking/:roundId', authenticateToken, async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });

    // Auth: only coordinator or system admin
    let isCoordinator = req.user.isSystemAdmin;
    if (!isCoordinator) {
      const coordRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: 'coordinator',
        status: 'active'
      });
      isCoordinator = !!coordRole;
    }

    if (!isCoordinator) {
      return res.status(403).json({ message: 'Chỉ Điều phối viên mới có thể xem bảng xếp hạng thời gian thực.' });
    }

    // 1. Get all tracks in this round
    const tracks = await Track.find({ roundId: req.params.roundId });
    const trackIds = tracks.map(t => t._id);

    // 2. Get all confirmed teams in these tracks
    const teams = await Team.find({ eventId: round.eventId, trackId: { $in: trackIds }, status: 'confirmed' })
      .populate('topicSubmission');

    // Get all submitted/locked scores for this round
    const scores = await Score.find({
      roundId: req.params.roundId,
      status: { $in: ['submitted', 'locked'] }
    }).populate('judgeId', 'fullName email');

    // Calculate live average per team
    const rankingData = teams.map((team) => {
      const teamScores = scores.filter(s => s.teamId.toString() === team._id.toString());
      const judgeCount = teamScores.length;
      let averageScore = 0;
      if (judgeCount > 0) {
        const sum = teamScores.reduce((acc, s) => acc + s.totalWeightedScore, 0);
        averageScore = Math.round((sum / judgeCount) * 100) / 100;
      }
      return {
        teamId: { _id: team._id, name: team.name, topicSubmission: team.topicSubmission },
        trackId: team.trackId,
        averageScore,
        judgeCount,
        judges: teamScores.map(s => ({ fullName: s.judgeId?.fullName, score: s.totalWeightedScore })),
        isLive: true
      };
    });

    // Group by trackId and sort within each track to calculate trackRank
    const tracksMap = {};
    rankingData.forEach(item => {
      if (item.trackId) {
        const tId = item.trackId.toString();
        if (!tracksMap[tId]) {
          tracksMap[tId] = [];
        }
        tracksMap[tId].push(item);
      }
    });

    for (const tId in tracksMap) {
      const trackTeams = tracksMap[tId];
      trackTeams.sort((a, b) => b.averageScore - a.averageScore);
      trackTeams.forEach((item, idx) => {
        item.trackRank = idx + 1;
      });
    }

    // Sort overall by trackRank ascending, then averageScore descending
    rankingData.sort((a, b) => {
      const aTrackRank = a.trackRank || 999;
      const bTrackRank = b.trackRank || 999;
      if (aTrackRank !== bTrackRank) {
        return aTrackRank - bTrackRank;
      }
      return b.averageScore - a.averageScore;
    });

    const advanceLimit = round.advanceTopN || 999;
    rankingData.forEach((item, idx) => {
      item.rank = idx + 1;
      item.isAdvanced = (idx + 1) <= advanceLimit;
    });

    res.json({ isLive: true, roundStatus: round.status, standings: rankingData });
  } catch (error) {
    console.error('Live Ranking Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving live ranking.' });
  }
});

module.exports = router;
