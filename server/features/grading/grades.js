const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const XLSX = require('xlsx-js-style');

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

const aiService = require('../github-ai/aiService');
const { authenticateToken } = require('../auth/authMiddleware');
const { addInAppJob, isQueueAvailable } = require('../notifications/notificationQueue');

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
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    // Verify track permissions for judges
    if (!req.user.isSystemAdmin) {
      let userRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        roundId: roundId,
        status: 'active'
      });

      if (!userRole) {
        userRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId,
          $or: [{ roundId: null }, { roundId: { $exists: false } }],
          status: 'active'
        });
      }

      if (!userRole) {
        return res.status(403).json({ message: 'Only assigned judges or coordinators can request suggestions.' });
      }

      if (userRole.role === 'judge' && userRole.trackId) {
        if (!team.trackId || team.trackId.toString() !== userRole.trackId.toString()) {
          return res.status(403).json({ message: 'Bạn chỉ có quyền lấy gợi ý chấm điểm cho đội thuộc bảng đấu được phân công.' });
        }
      }
    }

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

    const commits = await Commit.find({ teamId, message: { $not: /initial commit/i } }).sort({ committedAt: -1 }).limit(10);

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
 * @route   GET /api/grades/team/:teamId/achievements
 * @desc    Get rankings and achievements for a team
 * @access  Private (Participants of the team, Mentors, Coords, System Admin)
 */
router.get('/team/:teamId/achievements', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    // Block non-coordinators/non-admins if event is archived
    const Event = mongoose.model('Event');
    const parentEvent = await Event.findById(team.eventId);
    if (parentEvent && parentEvent.isArchived) {
      let isCoordinatorOrAdmin = req.user.isSystemAdmin;
      if (!isCoordinatorOrAdmin) {
        const coordRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId,
          role: { $in: ['coordinator', 'admin_view'] },
          status: 'active'
        });
        isCoordinatorOrAdmin = !!coordRole;
      }
      if (!isCoordinatorOrAdmin) {
        return res.status(403).json({ message: 'Sự kiện của đội thi này đã bị ẩn. Bạn không có quyền truy cập.' });
      }
    }

    // 1. Auth check
    let authorized = req.user.isSystemAdmin;
    
    // Check if system coordinator
    if (!authorized) {
      const coordRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ['coordinator', 'admin_view'] },
        status: 'active'
      });
      authorized = !!coordRole;
    }

    // Check if team member
    if (!authorized) {
      const TeamMember = mongoose.model('TeamMember');
      const member = await TeamMember.findOne({
        teamId: team._id,
        userId: req.user._id,
        confirmStatus: 'confirmed'
      });
      authorized = !!member;
    }

    // Check if team mentor
    if (!authorized) {
      const mentorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        trackId: team.trackId,
        role: 'mentor',
        status: 'active'
      });
      authorized = !!mentorRole;
    }

    if (!authorized) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập thông tin thành tích của nhóm này.' });
    }

    const rankings = await Ranking.find({ teamId: req.params.teamId })
      .populate('roundId', 'name status')
      .populate('trackId', 'name')
      .populate('eventId', 'name semester year status')
      .sort({ createdAt: -1 })
      .lean();

    res.json(rankings);
  } catch (error) {
    console.error('Fetch Team Achievements Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải thành tích nhóm.' });
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

    // Block non-coordinators/non-admins if event is archived
    const Event = mongoose.model('Event');
    const parentEvent = await Event.findById(team.eventId);
    if (parentEvent && parentEvent.isArchived) {
      let isCoordinatorOrAdmin = req.user.isSystemAdmin;
      if (!isCoordinatorOrAdmin) {
        const coordRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId,
          role: { $in: ['coordinator', 'admin_view'] },
          status: 'active'
        });
        isCoordinatorOrAdmin = !!coordRole;
      }
      if (!isCoordinatorOrAdmin) {
        return res.status(403).json({ message: 'Sự kiện của đội thi này đã bị ẩn. Bạn không có quyền truy cập.' });
      }
    }

    // Check if the user is a coordinator or system admin
    const coordinatorRole = await EventRole.findOne({
      userId: req.user._id,
      eventId: team.eventId,
      role: { $in: ['coordinator', 'admin_view'] },
      status: 'active'
    });
    const isCoordinator = req.user.isSystemAdmin || !!coordinatorRole;

    // Verify track permissions for judges
    if (!isCoordinator) {
      let userRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        roundId: req.params.roundId,
        status: 'active'
      });

      if (!userRole) {
        userRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId,
          $or: [{ roundId: null }, { roundId: { $exists: false } }],
          status: 'active'
        });
      }

      if (!userRole) {
        return res.status(403).json({ message: 'Only assigned judges or coordinators can access scores.' });
      }

      if (userRole.trackId) {
        if (!team.trackId || team.trackId.toString() !== userRole.trackId.toString()) {
          return res.status(403).json({ message: 'Bạn chỉ có quyền xem điểm của các đội thuộc bảng đấu được phân công.' });
        }
      }
    }

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
    let userRole = await EventRole.findOne({
      userId: req.user._id,
      eventId: team.eventId,
      roundId: roundId,
      status: 'active'
    });

    if (!userRole) {
      userRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        $or: [{ roundId: null }, { roundId: { $exists: false } }],
        status: 'active'
      });
    }

    if (!userRole && !req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Only assigned judges or coordinators can submit scores.' });
    }

    // Verify track assignment if user is a judge
    if (userRole && userRole.role === 'judge' && userRole.trackId) {
      if (!team.trackId || team.trackId.toString() !== userRole.trackId.toString()) {
        return res.status(403).json({ message: 'Bạn chỉ có quyền chấm điểm cho các đội thuộc bảng đấu được phân công.' });
      }
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

    // Decide who is the judge
    let targetJudgeId = req.user._id;
    if (req.body.judgeId && (req.user.isSystemAdmin || (userRole && userRole.role === 'coordinator'))) {
      targetJudgeId = req.body.judgeId;
    }

    // Create or update Score
    let score = await Score.findOne({ teamId, roundId, judgeId: targetJudgeId });
    if (score) {
      if (score.status === 'locked' && !req.user.isSystemAdmin && !(userRole && userRole.role === 'coordinator')) {
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
        judgeId: targetJudgeId,
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

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const scoreLog = new EventLog({
      eventId: team.eventId,
      actorId: req.user._id,
      action: 'submit_score',
      type: 'grading',
      details: `Giám khảo ${req.user.fullName} đã nộp điểm cho đội thi: "${team.name}" (Điểm thô: ${totalRawScore}, Điểm quy đổi: ${score.totalWeightedScore})`
    });
    await scoreLog.save();

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
  const { eventId, roundId, trackId } = req.body;

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

    // Get event/round details and build tracksCache
    const round = await Round.findById(roundId);
    const tracksCache = {};
    for (const t of tracks) {
      tracksCache[t._id.toString()] = t;
    }

    // Save rankings
    await Ranking.deleteMany({ roundId });

    const rankingsToSave = [];
    for (let idx = 0; idx < rankingsData.length; idx++) {
      const item = rankingsData[idx];
      const rank = idx + 1;
      const track = tracksCache[item.trackId.toString()];
      const trackLimit = (track && typeof track.advanceTopN === 'number') ? track.advanceTopN : 999;
      const isAdvanced = (item.trackRank || 999) <= trackLimit;

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
    const TeamMember = mongoose.model('TeamMember');

    for (const team of teams) {
      const members = await TeamMember.find({ teamId: team._id, confirmStatus: 'confirmed' });
      for (const member of members) {
        if (isQueueAvailable()) {
          await addInAppJob({
            userId: member.userId.toString(),
            type: 'round_result',
            title: `Kết quả vòng "${round.name}" đã công bố`,
            body: `Vòng "${round.name}" đã hoàn tất chấm điểm và công bố kết quả. Hãy kiểm tra bảng xếp hạng ngay!`,
            metadata: { roundId: round._id, roundName: round.name, eventId, trackId },
          });
        } else {
          // Fallback: synchronous
          const Notification = mongoose.model('Notification');
          await new Notification({
            userId: member.userId,
            type: 'round_result',
            title: `Kết quả vòng "${round.name}" đã công bố`,
            body: `Vòng "${round.name}" đã hoàn tất chấm điểm và công bố kết quả. Hãy kiểm tra bảng xếp hạng ngay!`,
            channel: 'in_app',
            status: 'sent',
            metadata: { roundId: round._id, roundName: round.name, eventId, trackId },
          }).save();
        }
      }
    }

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'publish_results',
      type: 'grading',
      details: `Khóa điểm và công bố xếp hạng vòng thi: ${round.name}`
    });
    await newLog.save();

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
        role: { $in: ['coordinator', 'admin_view'] },
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
      .populate('teamId', 'name status topicSubmission')
      .populate('trackId', 'name');

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
        role: { $in: ['coordinator', 'admin_view'] },
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
      .populate('topicSubmission')
      .populate('trackId', 'name');

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

    const tracksCache = {};
    for (const t of tracks) {
      tracksCache[t._id.toString()] = t;
    }
    rankingData.forEach((item, idx) => {
      item.rank = idx + 1;
      const track = tracksCache[item.trackId.toString()];
      const trackLimit = (track && typeof track.advanceTopN === 'number') ? track.advanceTopN : 999;
      item.isAdvanced = (item.trackRank || 999) <= trackLimit;
    });

    res.json({ isLive: true, roundStatus: round.status, standings: rankingData });
  } catch (error) {
    console.error('Live Ranking Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving live ranking.' });
  }
});

/**
 * @route   GET /api/grades/judge-ranking/:roundId
 * @desc    Real-time ranking for judges (no individual judge score breakdown, but live average)
 * @access  Private (Judge / Coordinator / SystemAdmin)
 */
router.get('/judge-ranking/:roundId', authenticateToken, async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });

    // Verify user is a judge (or coordinator/admin) for this event
    let hasAccess = req.user.isSystemAdmin;
    let assignedTrackId = null;
    if (!hasAccess) {
      const roleRecord = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: { $in: ['judge', 'coordinator'] },
        status: 'active'
      });
      hasAccess = !!roleRecord;
      if (roleRecord && roleRecord.role === 'judge') {
        assignedTrackId = roleRecord.trackId;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Bạn không có quyền xem bảng xếp hạng này.' });
    }

    // Get all teams in this round's track
    let teamsQuery = { eventId: round.eventId, status: 'confirmed' };
    if (assignedTrackId) {
      teamsQuery.trackId = assignedTrackId;
    } else {
      // Coordinator or SystemAdmin: get all tracks for this round
      const tracksObj = await Track.find({ roundId: round._id });
      const trackIds = tracksObj.map(t => t._id);
      teamsQuery.trackId = { $in: trackIds };
    }
    const teams = await Team.find(teamsQuery).populate('topicSubmission');

    // Get all submitted/locked scores for this round
    const scores = await Score.find({
      roundId: req.params.roundId,
      status: { $in: ['submitted', 'locked'] }
    });

    // Calculate live average per team (excluding detailed judge breakdown for judges' view)
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
        isLive: true
      };
    });

    // Load tracks configurations of this round to get advanceTopN
    const tracks = await Track.find({ roundId: req.params.roundId });
    const tracksCache = {};
    for (const t of tracks) {
      tracksCache[t._id.toString()] = t;
    }

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

    rankingData.forEach((item, idx) => {
      item.rank = idx + 1;
      const track = tracksCache[item.trackId ? item.trackId.toString() : ''];
      const trackLimit = (track && typeof track.advanceTopN === 'number') ? track.advanceTopN : 999;
      item.isAdvanced = (item.trackRank || 999) <= trackLimit;
    });

    res.json({ isLive: true, roundStatus: round.status, standings: rankingData });
  } catch (error) {
    console.error('Judge Ranking Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving judge ranking.' });
  }
});

/**
 * @route   POST /api/grades/advance-round
 * @desc    Finalize the current round and advance qualified teams (isAdvanced: true) to the next round
 * @access  Private (Coordinator or Admin)
 */
router.post('/advance-round', authenticateToken, async (req, res) => {
  const { eventId, currentRoundId } = req.body;

  if (!eventId || !currentRoundId) {
    return res.status(400).json({ message: 'Event ID and Current Round ID are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({ userId: req.user._id, eventId, role: 'coordinator' });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
    }

    const currentRound = await Round.findById(currentRoundId);
    if (!currentRound) return res.status(404).json({ message: 'Current round not found.' });

    // 1. Verify if all tracks in the current round are locked (only checking tracks with registered teams)
    const tracks = await Track.find({ roundId: currentRoundId });
    if (tracks.length === 0) {
      return res.status(400).json({ message: 'No tracks found in the current round.' });
    }

    const Team = mongoose.model('Team');
    const trackIds = tracks.map(t => t._id);
    for (const trackId of trackIds) {
      const trackHasTeams = await Team.exists({ eventId, trackId });
      if (trackHasTeams) {
        const rankingsExist = await Ranking.exists({ roundId: currentRoundId, trackId });
        if (!rankingsExist) {
          const track = tracks.find(t => t._id.toString() === trackId.toString());
          return res.status(400).json({ 
            message: `Bảng đấu "${track ? track.name : trackId}" chưa được khóa điểm. Vui lòng khóa điểm và công bố tất cả bảng đấu trước khi chốt vòng.` 
          });
        }
      }
    }

    // 2. Find the next round in order
    const nextRound = await Round.findOne({ eventId, order: currentRound.order + 1 });
    
    // 3. Get all advanced teams in the current round
    const advancedRankings = await Ranking.find({ roundId: currentRoundId, isAdvanced: true });
    const advancedTeamIds = advancedRankings.map(r => r.teamId);

    if (advancedTeamIds.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy đội nào được thăng hạng (isAdvanced) trong vòng hiện tại.' });
    }

    const Event = mongoose.model('Event');

    if (nextRound) {
      // Find or create a consolidated track for the next round (e.g. "Chung kết")
      let nextRoundTrack = await Track.findOne({ roundId: nextRound._id });
      if (!nextRoundTrack) {
        nextRoundTrack = new Track({
          eventId,
          roundId: nextRound._id,
          name: nextRound.name === 'Chung kết' || nextRound.name.includes('Chung') ? 'Bảng Chung Kết' : `Bảng Đấu ${nextRound.name}`,
          description: `Bảng đấu tập trung dành cho các đội xuất sắc nhất vượt qua ${currentRound.name}`,
          maxTeams: advancedTeamIds.length,
          topicSubmissionOpen: true
        });
        await nextRoundTrack.save();
      }

      // Promote teams to next round and assign to the consolidated track
      await Team.updateMany(
        { _id: { $in: advancedTeamIds } },
        { 
          currentRoundId: nextRound._id, 
          trackId: nextRoundTrack._id 
        }
      );

      // Transition round statuses
      currentRound.status = 'completed';
      await currentRound.save();

      nextRound.status = 'active';
      await nextRound.save();

      return res.json({
        message: `Đã chốt thành công vòng đấu "${currentRound.name}". Cả ${advancedTeamIds.length} đội xuất sắc đã được thăng hạng tiến vào "${nextRound.name}" thuộc "${nextRoundTrack.name}".`,
        nextRoundId: nextRound._id,
        nextTrackId: nextRoundTrack._id,
        advancedTeamsCount: advancedTeamIds.length
      });
    } else {
      // No next round - this is the final round!
      currentRound.status = 'completed';
      await currentRound.save();

      // Update Event status to completed
      const eventObj = await Event.findById(eventId);
      if (eventObj) {
        eventObj.status = 'completed';
        await eventObj.save();
      }

      res.json({
        message: `Đã chốt thành công Vòng Chung Kết "${currentRound.name}". Sự kiện đã kết thúc và toàn bộ kết quả xếp hạng chung cuộc đã được công bố!`,
        isEventCompleted: true,
        advancedTeamsCount: advancedTeamIds.length
      });
    }

  } catch (error) {
    console.error('Advance Round Error:', error.message);
    res.status(500).json({ message: 'Server error during round advancement.' });
  }
});

/**
 * @route   GET /api/grades/export-grading-sheet/:roundId
 * @desc    Export scoring excel sheet for a judge or summary for coordinator
 * @access  Private (Coordinator/Admin/Judge)
 */
router.get('/export-grading-sheet/:roundId', authenticateToken, async (req, res) => {
  try {
    const { roundId } = req.params;
    const { trackId, judgeId } = req.query;

    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: 'Round not found.' });

    const Event = mongoose.model('Event');
    const event = await Event.findById(round.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // 1. Get rubric for this round
    const rubric = await Rubric.findOne({ roundId: round._id, isActive: true });
    if (!rubric) {
      return res.status(400).json({ message: 'Vòng thi này chưa được cấu hình Rubric chấm điểm.' });
    }

    // 2. Get criteria for this rubric
    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });

    // 3. Determine Judge and Track
    let targetJudgeId = judgeId;
    if (!targetJudgeId) {
      const roleRecord = await EventRole.findOne({
        userId: req.user._id,
        eventId: round.eventId,
        role: 'judge',
        status: 'active'
      });
      if (roleRecord) {
        const isCoord = await EventRole.findOne({
          userId: req.user._id,
          eventId: round.eventId,
          role: 'coordinator',
          status: 'active'
        });
        if (!isCoord && !req.user.isSystemAdmin) {
          targetJudgeId = req.user._id.toString();
        }
      }
    }

    let track = null;
    if (trackId) {
      track = await Track.findById(trackId);
    } else if (targetJudgeId) {
      const judgeRole = await EventRole.findOne({
        userId: targetJudgeId,
        eventId: round.eventId,
        role: 'judge',
        status: 'active'
      });
      if (judgeRole && judgeRole.trackId) {
        track = await Track.findById(judgeRole.trackId);
      }
    }

    // 4. Get Teams
    const teamsQuery = { eventId: round.eventId, status: 'confirmed' };
    if (track) {
      teamsQuery.trackId = track._id;
    }
    const teams = await Team.find(teamsQuery).populate('topicSubmission');

    const wb = XLSX.utils.book_new();
    let wsData = [];
    let title = '';
    let subtitle = '';
    let metadataRow = '';
    
    // Check if we are exporting for a specific judge or summary
    if (targetJudgeId) {
      // --- CASE 1: INDIVIDUAL JUDGE SCORING SHEET ---
      const judge = await User.findById(targetJudgeId);
      if (!judge) return res.status(404).json({ message: 'Judge not found.' });

      title = `PHIẾU CHẤM ĐIỂM CHI TIẾT - GIÁM KHẢO`;
      subtitle = event.name.toUpperCase();
      metadataRow = `Vòng thi: ${round.name} | Bảng đấu: ${track ? track.name : 'Tất cả'} | Giám khảo: ${judge.fullName}`;

      // Build table headers
      // STT | Tên Đội | Tên Đề Tài | Criteria 1 | ... | Criteria N | Tổng Điểm | Nhận Xét
      const headers = ["STT", "Tên Đội Thi", "Tên Đề Tài / Dự Án"];
      criteria.forEach(c => {
        const weightPercent = c.weight > 1 ? c.weight : c.weight * 100;
        headers.push(`${c.code}\n(${weightPercent}%)`);
      });
      headers.push("Tổng Điểm\n(Hệ 10)", "Ý Kiến / Nhận Xét");
      
      wsData.push([title], [subtitle], [metadataRow], [], headers);

      // Fetch judge's scores
      const scores = await Score.find({
        roundId: round._id,
        judgeId: judge._id,
        teamId: { $in: teams.map(t => t._id) }
      });
      const scoreIds = scores.map(s => s._id);
      const scoreDetails = await ScoreDetail.find({ scoreId: { $in: scoreIds } });

      teams.forEach((team, idx) => {
        const row = [
          idx + 1,
          team.name,
          team.topicSubmission?.title || 'Chưa đăng ký đề tài'
        ];

        const teamScore = scores.find(s => s.teamId.toString() === team._id.toString());
        
        criteria.forEach(c => {
          if (teamScore) {
            const detail = scoreDetails.find(d => 
              d.scoreId.toString() === teamScore._id.toString() && 
              d.criterionId.toString() === c._id.toString()
            );
            row.push(detail ? detail.scoreValue : 0);
          } else {
            row.push(0); // Not graded yet
          }
        });

        row.push(teamScore ? teamScore.totalWeightedScore : 0);
        row.push(teamScore ? (teamScore.overallComment || '') : '');
        wsData.push(row);
      });

      // Signature section
      const signRowStart = wsData.length + 2;
      wsData.push([]); // blank row
      wsData.push([]); // blank row
      
      // We will place signatures on columns: Column B (index 1) and Column G/H (index 4+N)
      const sigRow = [];
      sigRow[1] = "TRƯỞNG BAN TỔ CHỨC";
      sigRow[3 + criteria.length] = "GIÁM KHẢO XÁC NHẬN";
      wsData.push(sigRow);

      const subSigRow = [];
      subSigRow[1] = "(Ký và ghi rõ họ tên)";
      subSigRow[3 + criteria.length] = "(Ký và ghi rõ họ tên)";
      wsData.push(subSigRow);

      // Add 4 empty rows for space to sign
      wsData.push([], [], [], []);

      const nameSigRow = [];
      nameSigRow[1] = ".......................................";
      nameSigRow[3 + criteria.length] = judge.fullName;
      wsData.push(nameSigRow);

    } else {
      // --- CASE 2: SUMMARY GRADING SHEET (ALL JUDGES) ---
      title = `BẢNG TỔNG HỢP ĐIỂM ĐÁNH GIÁ`;
      subtitle = event.name.toUpperCase();
      metadataRow = `Vòng thi: ${round.name} | Bảng đấu: ${track ? track.name : 'Tất cả'}`;

      // Get all scores for this round and these teams
      const scores = await Score.find({
        roundId: round._id,
        teamId: { $in: teams.map(t => t._id) },
        status: { $in: ['submitted', 'locked'] }
      }).populate('judgeId', 'fullName email');

      // Unique judges who graded
      const uniqueJudgesMap = {};
      scores.forEach(s => {
        if (s.judgeId) {
          uniqueJudgesMap[s.judgeId._id.toString()] = s.judgeId;
        }
      });
      const judges = Object.values(uniqueJudgesMap);

      // Table Headers:
      // STT | Tên Đội | Tên Đề Tài | Judge 1 Total | ... | Judge M Total | Điểm Trung Bình | Thứ Hạng | Nhận Xét Tổng Hợp
      const headers = ["STT", "Tên Đội Thi", "Tên Đề Tài / Dự Án"];
      judges.forEach(j => {
        headers.push(j.fullName);
      });
      headers.push("Điểm Trung Bình", "Thứ Hạng", "Nhận Xét Tổng Hợp");
      wsData.push([title], [subtitle], [metadataRow], [], headers);

      // Build row data for each team
      const rowsWithAverages = teams.map((team, idx) => {
        const teamScores = scores.filter(s => s.teamId.toString() === team._id.toString());
        const judgeCount = teamScores.length;
        
        let averageScore = 0;
        if (judgeCount > 0) {
          const sum = teamScores.reduce((acc, s) => acc + s.totalWeightedScore, 0);
          averageScore = Math.round((sum / judgeCount) * 100) / 100;
        }

        const judgeScoresList = judges.map(j => {
          const s = teamScores.find(ts => ts.judgeId._id.toString() === j._id.toString());
          return s ? s.totalWeightedScore : '-';
        });

        const comments = teamScores
          .map(s => s.overallComment ? `${s.judgeId.fullName}: ${s.overallComment}` : '')
          .filter(Boolean)
          .join('\n');

        return {
          teamName: team.name,
          topic: team.topicSubmission?.title || 'Chưa đăng ký đề tài',
          judgeScoresList,
          averageScore,
          comments
        };
      });

      // Sort by averageScore descending to calculate rankings
      rowsWithAverages.sort((a, b) => b.averageScore - a.averageScore);

      rowsWithAverages.forEach((item, idx) => {
        wsData.push([
          idx + 1,
          item.teamName,
          item.topic,
          ...item.judgeScoresList,
          item.averageScore,
          idx + 1, // Rank
          item.comments
        ]);
      });

      // Signature section
      wsData.push([]); // blank row
      wsData.push([]); // blank row
      
      const sigRow = [];
      sigRow[1] = "ĐẠI DIỆN BAN THƯ KÝ";
      sigRow[2 + judges.length] = "TRƯỞNG BAN TỔ CHỨC";
      wsData.push(sigRow);

      const subSigRow = [];
      subSigRow[1] = "(Ký và ghi rõ họ tên)";
      subSigRow[2 + judges.length] = "(Ký và ghi rõ họ tên)";
      wsData.push(subSigRow);

      // Add 4 empty rows for space to sign
      wsData.push([], [], [], []);

      const nameSigRow = [];
      nameSigRow[1] = ".......................................";
      nameSigRow[2 + judges.length] = ".......................................";
      wsData.push(nameSigRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge title cells
    const maxCols = wsData[4] ? wsData[4].length : 8;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: maxCols - 1 } }
    ];

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 25 }, // Tên Đội Thi
      { wch: 30 }  // Tên Đề Tài
    ];
    for (let c = 3; c < maxCols; c++) {
      ws['!cols'].push({ wch: 18 });
    }
    // Make comment/remark column wider
    ws['!cols'][maxCols - 1] = { wch: 40 };

    // Apply beautiful styling
    const range = XLSX.utils.decode_range(ws['!ref']);
    const numDataRows = teams.length;
    const headerRowIdx = 4;
    const dataStartRowIdx = 5;
    const dataEndRowIdx = 5 + numDataRows - 1;

    for (let r = range.s.r; r <= range.e.r; ++r) {
      for (let c = range.s.c; c <= range.e.c; ++c) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;

        const cell = ws[cellRef];
        cell.s = cell.s || {};

        if (r === 0) {
          // Title
          cell.s.font = { bold: true, size: 14, name: 'Calibri', color: { rgb: '0F172A' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r === 1) {
          // Subtitle
          cell.s.font = { bold: true, size: 11, name: 'Calibri', color: { rgb: '475569' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r === 2) {
          // Metadata
          cell.s.font = { italic: true, size: 10, name: 'Calibri', color: { rgb: '475569' } };
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        } else if (r === headerRowIdx) {
          // Table Header
          cell.s.font = { bold: true, name: 'Calibri', color: { rgb: 'FFFFFF' }, size: 10 };
          cell.s.fill = { patternType: 'solid', fgColor: { rgb: '1E293B' } }; // Dark blue slate
          cell.s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
          cell.s.border = {
            top: { style: 'medium', color: { rgb: '475569' } },
            bottom: { style: 'medium', color: { rgb: '475569' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } }
          };
        } else if (r >= dataStartRowIdx && r <= dataEndRowIdx) {
          // Table Data
          cell.s.font = { name: 'Calibri', size: 10 };
          cell.s.alignment = { 
            vertical: 'center', 
            horizontal: c === 0 || (c >= 3 && c < maxCols - 1) ? 'center' : 'left', 
            wrapText: true 
          };
          cell.s.border = {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          };
          // Alternating row background
          if (r % 2 === 1) {
            cell.s.fill = { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } };
          }
        } else if (r > dataEndRowIdx) {
          // Signature Block
          cell.s.font = { name: 'Calibri', size: 10 };
          if (r === dataEndRowIdx + 3) {
            cell.s.font.bold = true;
          }
          if (r === dataEndRowIdx + 4) {
            cell.s.font.italic = true;
            cell.s.font.size = 9;
          }
          if (r === range.e.r && c !== 1) {
            cell.s.font.bold = true; // Bold name of judge/secretary at the end
          }
          cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        }
      }
    }

    // Set row heights
    ws['!rows'] = [];
    ws['!rows'][0] = { hpx: 30 }; // Title
    ws['!rows'][1] = { hpx: 20 }; // Subtitle
    ws['!rows'][2] = { hpx: 20 }; // Metadata
    ws['!rows'][headerRowIdx] = { hpx: 28 }; // Table header
    for (let r = dataStartRowIdx; r <= dataEndRowIdx; r++) {
      ws['!rows'][r] = { hpx: 24 }; // Data rows
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Grading_Sheet');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const safeTitle = title.replace(/\s+/g, '_');
    const filename = `${safeTitle}_${round.name.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Export Grading Sheet Error:', error.message);
    res.status(500).json({ message: 'Server error exporting grading sheet.' });
  }
});

module.exports = router;
