const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const GithubRepository = mongoose.model('GithubRepository');
const Team = mongoose.model('Team');
const TeamMember = mongoose.model('TeamMember');
const EventRole = mongoose.model('EventRole');

const githubService = require('../services/githubService');
const cronService = require('../services/cronService');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/github-repositories
 * @desc    Get all GitHub repositories (filtered by eventId/trackId)
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
  const { eventId, trackId } = req.query;
  const filter = { isArchived: false };
  if (eventId) filter.eventId = eventId;
  if (trackId) filter.trackId = trackId;

  try {
    // Check if user is participant. Participants only see their own team's repo.
    if (!req.user.isSystemAdmin) {
      // Check roles
      const roles = await EventRole.find({ userId: req.user._id, status: 'active' });
      const isStaff = roles.some(r => ['coordinator', 'judge', 'mentor'].includes(r.role));
      
      if (!isStaff) {
        // Participant -> find their team repo
        const member = await TeamMember.findOne({ userId: req.user._id, confirmStatus: 'confirmed' });
        if (!member) {
          return res.status(403).json({ message: 'Bạn không thuộc đội thi nào hoặc chưa được xác nhận.' });
        }
        const repo = await GithubRepository.findOne({ teamId: member.teamId });
        return res.json(repo ? [repo] : []);
      }
    }

    const repos = await GithubRepository.find(filter)
      .populate('teamId', 'name status')
      .populate('trackId', 'name')
      .sort({ createdAt: -1 });

    res.json(repos);
  } catch (error) {
    console.error('List repositories error:', error.message);
    res.status(500).json({ message: 'Server error listing repositories.' });
  }
});

/**
 * @route   GET /api/github-repositories/team/:teamId
 * @desc    Get repository details for a specific team
 * @access  Private
 */
router.get('/team/:teamId', authenticateToken, async (req, res) => {
  try {
    const repo = await GithubRepository.findOne({ teamId: req.params.teamId });
    if (!repo) {
      return res.status(404).json({ message: 'Chưa có GitHub repository cho đội thi này.' });
    }
    res.json(repo);
  } catch (error) {
    console.error('Get team repository error:', error.message);
    res.status(500).json({ message: 'Server error fetching repository details.' });
  }
});

/**
 * @route   POST /api/github-repositories/create
 * @desc    Automatically create a new GitHub repository for a team
 * @access  Private (Coordinator or Admin)
 */
router.post('/create', authenticateToken, async (req, res) => {
  const { teamId } = req.body;
  if (!teamId) return res.status(400).json({ message: 'Thiếu thông tin teamId.' });

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Không tìm thấy đội thi.' });

    // Auth check
    if (!req.user.isSystemAdmin) {
      const isCoord = await EventRole.findOne({ userId: req.user._id, eventId: team.eventId, role: 'coordinator', status: 'active' });
      if (!isCoord) return res.status(403).json({ message: 'Chỉ điều phối viên hoặc quản trị viên mới được quyền tạo repository.' });
    }

    // Check if repository already exists
    const existingRepo = await GithubRepository.findOne({ teamId });
    if (existingRepo) {
      return res.status(400).json({ message: 'Đội thi này đã có repository.' });
    }

    // Fetch Event to get org name
    const Event = mongoose.model('Event');
    const event = await Event.findById(team.eventId);
    const orgName = event ? event.githubOrgName : undefined;

    // Slugify repo name
    const slugRepoName = team.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const gitResult = await githubService.createTeamRepository(slugRepoName, 'private', orgName);

    const actualOrgName = gitResult.owner || orgName;

    const newRepo = new GithubRepository({
      eventId: team.eventId,
      trackId: team.trackId,
      teamId: team._id,
      orgName: actualOrgName,
      repoName: slugRepoName,
      repoUrl: gitResult.repoUrl,
      githubRepoId: gitResult.githubRepoId,
      createdBySystem: true,
      createdBy: req.user._id,
      syncStatus: 'not_synced'
    });
    await newRepo.save();

    // Invite collaborators
    const members = await TeamMember.find({ teamId: team._id }).populate('userId');
    for (const tm of members) {
      if (tm.userId && tm.userId.githubUsername) {
        await githubService.addCollaborator(slugRepoName, tm.userId.githubUsername, 'push', actualOrgName);
      }
    }

    res.status(201).json({
      message: 'Đã khởi tạo GitHub repository và mời các thành viên tham gia cộng tác thành công!',
      repository: newRepo
    });
  } catch (error) {
    console.error('Create repository error:', error.message);
    res.status(500).json({ message: 'Server error creating GitHub repository.' });
  }
});

/**
 * @route   POST /api/github-repositories/link
 * @desc    Manually link an existing GitHub repository to a team
 * @access  Private (Coordinator or Admin)
 */
router.post('/link', authenticateToken, async (req, res) => {
  const { teamId, repoUrl, repoName } = req.body;
  if (!teamId || !repoUrl || !repoName) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ: teamId, repoUrl và repoName.' });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Không tìm thấy đội thi.' });

    // Auth check
    if (!req.user.isSystemAdmin) {
      const isCoord = await EventRole.findOne({ userId: req.user._id, eventId: team.eventId, role: 'coordinator', status: 'active' });
      if (!isCoord) return res.status(403).json({ message: 'Chỉ điều phối viên hoặc quản trị viên mới được quyền liên kết repository.' });
    }

    // Check existing repo
    const existingRepo = await GithubRepository.findOne({ teamId });
    if (existingRepo) {
      return res.status(400).json({ message: 'Đội thi này đã có repository.' });
    }

    const Event = mongoose.model('Event');
    const event = await Event.findById(team.eventId);
    const orgName = event ? event.githubOrgName : undefined;

    const linkedRepo = new GithubRepository({
      eventId: team.eventId,
      trackId: team.trackId,
      teamId: team._id,
      orgName: orgName,
      repoName: repoName,
      repoUrl: repoUrl,
      githubRepoId: `linked-${Date.now()}`,
      createdBySystem: false,
      createdBy: req.user._id,
      syncStatus: 'not_synced'
    });
    await linkedRepo.save();

    res.status(201).json({
      message: 'Đã liên kết GitHub repository thành công!',
      repository: linkedRepo
    });
  } catch (error) {
    console.error('Link repository error:', error.message);
    res.status(500).json({ message: 'Server error linking repository.' });
  }
});

/**
 * @route   POST /api/github-repositories/:id/sync
 * @desc    Sync commits for a repository immediately
 * @access  Private
 */
router.post('/:id/sync', authenticateToken, async (req, res) => {
  try {
    const success = await cronService.syncRepo(req.params.id);
    if (success) {
      res.json({ message: 'Đồng bộ repository và phân tích AI hoàn thành thành công!' });
    } else {
      res.status(500).json({ message: 'Đồng bộ thất bại. Vui lòng kiểm tra lại log.' });
    }
  } catch (error) {
    console.error('Sync repository error:', error.message);
    res.status(500).json({ message: error.message || 'Server error syncing repository.' });
  }
});

module.exports = router;
