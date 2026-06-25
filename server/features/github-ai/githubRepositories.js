const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');

const GithubRepository = mongoose.model('GithubRepository');
const Team = mongoose.model('Team');
const TeamMember = mongoose.model('TeamMember');
const EventRole = mongoose.model('EventRole');

const githubService = require('./githubService');
const cronService = require('../events/cronService');
const githubAiQueue = require('./githubAiQueue');
const { authenticateToken } = require('../auth/authMiddleware');

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

/**
 * @route   POST /api/github-repositories/:id/kick-all
 * @desc    Kick all team members and mentors from a repository (remove collaborators)
 * @access  Private (Coordinator or Admin)
 */
router.post('/:id/kick-all', authenticateToken, async (req, res) => {
  try {
    const repo = await GithubRepository.findById(req.params.id);
    if (!repo) return res.status(404).json({ message: 'Không tìm thấy repository.' });

    // Auth check
    if (!req.user.isSystemAdmin) {
      const isCoord = await EventRole.findOne({ userId: req.user._id, eventId: repo.eventId, role: 'coordinator', status: 'active' });
      if (!isCoord) return res.status(403).json({ message: 'Chỉ điều phối viên hoặc quản trị viên mới được quyền thu hồi quyền truy cập.' });
    }

    // 1. Get all confirmed team members
    const members = await TeamMember.find({ teamId: repo.teamId }).populate('userId');
    
    // 2. Get all mentors of the event
    const mentors = await EventRole.find({ eventId: repo.eventId, role: 'mentor', status: 'active' }).populate('userId');

    // 3. Extract unique github usernames
    const usernames = new Set();
    members.forEach(m => {
      if (m.userId && m.userId.githubUsername) {
        usernames.add(m.userId.githubUsername);
      }
    });
    mentors.forEach(m => {
      if (m.userId && m.userId.githubUsername) {
        usernames.add(m.userId.githubUsername);
      }
    });

    const kickedList = [];
    // 4. Remove each as collaborator
    for (const username of usernames) {
      const success = await githubService.removeCollaborator(repo.repoName, username, repo.orgName);
      if (success) {
        kickedList.push(username);
      }
    }

    // 5. Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: repo.eventId,
      actorId: req.user._id,
      action: 'kick_collaborators',
      details: `Thu hồi quyền truy cập repository ${repo.repoName} của các thành viên và mentor: ${kickedList.join(', ')}`
    });
    await newLog.save();

    res.json({
      message: 'Đã thu hồi thành công quyền truy cập repository của tất cả thành viên và mentor.',
      kickedUsers: kickedList
    });
  } catch (error) {
    console.error('Kick all collaborators error:', error.message);
    res.status(500).json({ message: 'Server error kicking collaborators.' });
  }
});

/**
 * @route   POST /api/github-repositories/webhook
 * @desc    Receive GitHub Organization/Repository push webhooks, verify signature, and queue sync task
 * @access  Public
 */
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const githubEvent = req.headers['x-github-event'];
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  console.log(`[GITHUB WEBHOOK] Received GitHub event: ${githubEvent}`);

  // 1. Verify GitHub event
  if (githubEvent !== 'push') {
    // We only care about push events. Return 200 OK so GitHub knows we received it.
    return res.json({ message: 'Event ignored. Only push events are processed.' });
  }

  // 2. Verify signature (only if secret is configured on BE)
  if (webhookSecret) {
    if (!signature) {
      console.warn('[GITHUB WEBHOOK] Missing X-Hub-Signature-256 header.');
      return res.status(401).json({ message: 'Missing signature.' });
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      console.error('[GITHUB WEBHOOK] Raw body is missing. Check Express rawBody configuration.');
      return res.status(500).json({ message: 'Internal server error verifying signature.' });
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      const trusted = Buffer.from(digest, 'utf8');
      const untrusted = Buffer.from(signature, 'utf8');
      if (trusted.length !== untrusted.length || !crypto.timingSafeEqual(trusted, untrusted)) {
        console.warn('[GITHUB WEBHOOK] Invalid signature.');
        return res.status(401).json({ message: 'Invalid signature.' });
      }
    } catch (err) {
      console.error('[GITHUB WEBHOOK] Signature matching error:', err.message);
      return res.status(401).json({ message: 'Invalid signature verification process.' });
    }
  } else {
    console.log('[GITHUB WEBHOOK] GITHUB_WEBHOOK_SECRET not configured. Skipping signature verification.');
  }

  // 3. Process push payload
  try {
    const { ref, repository } = req.body;
    if (!repository || !repository.name || !repository.owner || !repository.owner.login) {
      return res.status(400).json({ message: 'Invalid payload structure. Repository details missing.' });
    }

    const repoName = repository.name.toLowerCase();
    const orgName = repository.owner.login.toLowerCase();

    console.log(`[GITHUB WEBHOOK] Push detected on repo: ${orgName}/${repoName}, ref: ${ref}`);

    // Find repository in database (case-insensitive)
    const repo = await GithubRepository.findOne({
      repoName: { $regex: new RegExp(`^${repoName}$`, 'i') },
      orgName: { $regex: new RegExp(`^${orgName}$`, 'i') },
      isArchived: false
    });

    if (!repo) {
      console.log(`[GITHUB WEBHOOK] Repository ${orgName}/${repoName} not found in database or is archived.`);
      return res.status(404).json({ message: 'Repository not registered in system.' });
    }

    // 4. Enqueue or run syncRepo
    if (githubAiQueue.isQueueAvailable()) {
      await githubAiQueue.addSyncJob(repo._id.toString());
      console.log(`[GITHUB WEBHOOK] Enqueued sync job for ${repo.repoName}`);
      res.json({ message: 'GitHub push event received and enqueued for sync.', repositoryId: repo._id });
    } else {
      console.log(`[GITHUB WEBHOOK] Redis queue not available. Running sync asynchronously in background for ${repo.repoName}...`);
      // Fallback: Run in background asynchronously without blocking the response
      // Wrap in setTimeout to defer execution and let the HTTP response close immediately
      setTimeout(async () => {
        try {
          await cronService.syncRepo(repo._id);
        } catch (err) {
          console.error(`[GITHUB WEBHOOK BACKGROUND ERROR] Sync failed for ${repo.repoName}:`, err.message);
        }
      }, 100);
      res.json({ message: 'GitHub push event received. Synchronizing in background.', repositoryId: repo._id });
    }
  } catch (error) {
    console.error('[GITHUB WEBHOOK ERROR]', error.message);
    res.status(500).json({ message: 'Server error processing webhook.' });
  }
});

module.exports = router;
