const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');

const Team = mongoose.model('Team');
const TeamMember = mongoose.model('TeamMember');
const User = mongoose.model('User');
const Event = mongoose.model('Event');
const Track = mongoose.model('Track');
const GithubRepository = mongoose.model('GithubRepository');
const EventRole = mongoose.model('EventRole');

const emailService = require('../services/emailService');
const githubService = require('../services/githubService');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/teams/register
 * @desc    Register a team and invite members
 * @access  Private (Participants)
 */
router.post('/register', authenticateToken, async (req, res) => {
  const { eventId, trackId, teamName, membersList, leaderInfo } = req.body;

  if (!eventId || !teamName || !membersList || !Array.isArray(membersList)) {
    return res.status(400).json({ message: 'Missing required registration parameters.' });
  }

  try {
    // Update leader's profile if provided
    if (leaderInfo) {
      const User = mongoose.model('User');
      const leader = await User.findById(req.user._id);
      if (leader) {
        if (leaderInfo.fullName) leader.fullName = leaderInfo.fullName;
        if (leaderInfo.studentId) leader.studentId = leaderInfo.studentId;
        if (leaderInfo.githubUsername) leader.githubUsername = leaderInfo.githubUsername;
        if (leaderInfo.university) leader.university = leaderInfo.university;
        await leader.save();
      }
    }
    // 1. Verify Event is active & open for registration
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (event.status !== 'draft' && event.status !== 'registration') {
      return res.status(400).json({ message: 'Registration for this event is closed.' });
    }

    // Check overall event capacity
    const confirmedTeamsCount = await Team.countDocuments({ eventId, status: 'confirmed' });
    if (event.maxTeams && confirmedTeamsCount >= event.maxTeams) {
      return res.status(400).json({ message: 'This event has reached its maximum team capacity.' });
    }

    // Check track capacity if trackId is provided
    if (trackId) {
      const track = await Track.findById(trackId);
      if (!track) return res.status(404).json({ message: 'Track not found.' });
      
      const trackConfirmedCount = await Team.countDocuments({ trackId, status: 'confirmed' });
      if (track.maxTeams && trackConfirmedCount >= track.maxTeams) {
        return res.status(400).json({ message: 'This track has reached its maximum team capacity.' });
      }
    }

    // 2. Validate that team name is unique inside the event
    const nameFilter = { eventId, name: teamName };
    if (trackId) nameFilter.trackId = trackId;
    const existingTeam = await Team.findOne(nameFilter);
    if (existingTeam) {
      return res.status(400).json({ message: 'A team with this name already exists.' });
    }

    // 3. Create the Team record
    const team = new Team({
      eventId,
      trackId: trackId || undefined,
      leaderId: req.user._id,
      name: teamName,
      status: 'pending_confirm'
    });
    await team.save();

    // 4. Register/Handle Leader as TeamMember
    const leaderMember = new TeamMember({
      teamId: team._id,
      userId: req.user._id,
      role: 'leader',
      confirmStatus: 'confirmed',
      confirmedAt: new Date()
    });
    await leaderMember.save();

    // 5. Loop through and invite other members
    for (const memberData of membersList) {
      const { email, fullName, githubUsername, studentId } = memberData;
      if (!email) continue;

      // Find or create User record for member
      let memberUser = await User.findOne({ email: email.toLowerCase() });
      if (!memberUser) {
        // Create user placeholder with random password (must set later)
        const placeholderPass = crypto.randomBytes(8).toString('hex');
        memberUser = new User({
          email: email.toLowerCase(),
          passwordHash: crypto.createHash('sha256').update(placeholderPass).digest('hex'), // temp hash
          fullName: fullName || email.split('@')[0],
          studentId: studentId || '',
          githubUsername: githubUsername || '',
          isApproved: true
        });
        await memberUser.save();
      } else if (githubUsername && !memberUser.githubUsername) {
        // Update user github if not filled
        memberUser.githubUsername = githubUsername;
        await memberUser.save();
      }

      // Generate verification token
      const token = crypto.randomBytes(32).toString('hex');
      const confirmTokenExpiry = new Date(Date.now() + 3600000 * 48); // 48h expiry

      const teamMember = new TeamMember({
        teamId: team._id,
        userId: memberUser._id,
        role: 'member',
        confirmStatus: 'pending',
        confirmTokenHash: token,
        confirmTokenExpiry
      });
      await teamMember.save();

      // Send email invitation (Asynchronous, non-blocking to prevent UI lag)
      // In production, point to real client domain.
      const inviteLink = `${req.protocol}://${req.get('host')}/api/teams/confirm-invite?token=${token}`;
      emailService.sendTeamInvitation(memberUser.email, teamName, inviteLink)
        .catch(err => console.error(`Failed to send invitation email to ${memberUser.email}:`, err.message));
      
      // Send In-App Notification
      const Notification = mongoose.model('Notification');
      await new Notification({
        userId: memberUser._id,
        type: 'team_invite',
        title: 'Lời mời vào đội',
        body: `Bạn đã được mời vào đội "${teamName}". Hãy kiểm tra email để xác nhận!`,
        channel: 'in_app'
      }).save();
    }

    // Check if team has any pending members. If none (e.g. registered with no additional members),
    // confirm the team immediately and auto-create repo!
    const pendingMembers = await TeamMember.countDocuments({ teamId: team._id, confirmStatus: 'pending' });
    if (pendingMembers === 0) {
      team.status = 'confirmed';
      await team.save();

      console.log(`[TEAM] Team "${team.name}" is now FULLY CONFIRMED immediately upon registration! Creating repo...`);

      // Automatically create Github Repository
      const orgName = event ? event.githubOrgName : undefined;
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
        syncStatus: 'not_synced'
      });
      await newRepo.save();

      // Invite collaborators (the leader)
      if (req.user.githubUsername) {
        await githubService.addCollaborator(slugRepoName, req.user.githubUsername, 'push', actualOrgName);
      }

      // Check capacity
      const confirmedTeams = await Team.countDocuments({ eventId: team.eventId, status: 'confirmed' });
      if (event.maxTeams && confirmedTeams >= event.maxTeams) {
        event.status = 'ongoing';
        await event.save();
      }

      return res.status(201).json({
        message: 'Đăng ký nhóm thành công! Nhóm đã được xác nhận lập tức và khởi tạo kho lưu trữ GitHub.',
        teamId: team._id,
        status: 'confirmed',
        repository: newRepo
      });
    }

    res.status(201).json({
      message: 'Team registered! Invitation emails have been sent. The team is pending confirmation from all members.',
      teamId: team._id,
      status: team.status
    });

  } catch (error) {
    console.error('Team Registration Error:', error.message);
    res.status(500).json({ message: 'Server error during team registration.' });
  }
});

/**
 * @route   GET /api/teams/confirm-invite
 * @desc    Confirm team participation link
 * @access  Public
 */
router.get('/confirm-invite', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('<h1>Error</h1><p>Confirmation token is missing.</p>');
  }

  try {
    const member = await TeamMember.findOne({
      confirmTokenHash: token,
      confirmTokenExpiry: { $gt: new Date() }
    });

    if (!member) {
      return res.status(400).send('<h1>Link Expired or Invalid</h1><p>Your team confirmation token is invalid or has expired.</p>');
    }

    // Confirm member
    member.confirmStatus = 'confirmed';
    member.confirmTokenHash = undefined;
    member.confirmTokenExpiry = undefined;
    member.confirmedAt = new Date();
    await member.save();

    // Check if ALL team members are now confirmed
    const team = await Team.findById(member.teamId);
    const totalMembers = await TeamMember.find({ teamId: team._id });
    const pendingCount = totalMembers.filter(m => m.confirmStatus !== 'confirmed').length;

    // Notify Leader that a member confirmed
    const Notification = mongoose.model('Notification');
    const user = await User.findById(member.userId);
    if (member.userId.toString() !== team.leaderId.toString()) {
      await new Notification({
        userId: team.leaderId,
        type: 'member_confirm',
        title: 'Thành viên đã xác nhận',
        body: `Thành viên ${user ? user.fullName : 'mới'} đã xác nhận tham gia đội "${team.name}".`,
        channel: 'in_app'
      }).save();
    }

    if (pendingCount === 0) {
      // All confirmed! Promote team status
      team.status = 'confirmed';
      await team.save();

      console.log(`[TEAM] Team "${team.name}" is now FULLY CONFIRMED! Creating repo...`);

      // 1. Automatically create Github Repository
      const event = await Event.findById(team.eventId);
      const orgName = event ? event.githubOrgName : undefined;
      const slugRepoName = team.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const populatedMembers = await TeamMember.find({ teamId: team._id }).populate('userId');

      try {
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
          syncStatus: 'not_synced'
        });
        await newRepo.save();

        // 2. Add collaborators
        for (const tm of populatedMembers) {
          if (tm.userId && tm.userId.githubUsername) {
            await githubService.addCollaborator(slugRepoName, tm.userId.githubUsername, 'push', actualOrgName);
          }
        }
      } catch (gitErr) {
        console.error('Lỗi tự động tạo repo GitHub:', gitErr.message);
      }

      // 3. Auto capacity checking and close form logic
      const confirmedTeams = await Team.countDocuments({ eventId: team.eventId, status: 'confirmed' });
      
      if (event && event.maxTeams && confirmedTeams >= event.maxTeams) {
        event.status = 'ongoing'; // Auto-close registration, lock event
        await event.save();
        console.log(`[EVENT] Event "${event.name}" registration automatically CLOSED as it hit max team limit (${event.maxTeams}).`);
      }

      // Notify all team members that team is confirmed
      for (const tm of populatedMembers) {
        await new Notification({
          userId: tm.userId._id || tm.userId,
          type: 'team_ready',
          title: 'Đội đã sẵn sàng thi đấu',
          body: `Tuyệt vời! Tất cả thành viên đội "${team.name}" đã xác nhận. Repository GitHub của bạn là ${slugRepoName}.`,
          channel: 'in_app'
        }).save();
      }
    }

    // Send successful response page (HTML mockup or redirect)
    res.send(`
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #10b981;">Participation Confirmed!</h1>
        <p>You have successfully joined the team. You may close this tab and return to the dashboard.</p>
        <a href="http://localhost:5173" style="color: #4f46e5; text-decoration: none; font-weight: bold;">Go to Dashboard</a>
      </div>
    `);

  } catch (error) {
    console.error('Invite Confirmation Error:', error.message);
    res.status(500).send('<h1>Server Error</h1><p>An error occurred verifying your invitation.</p>');
  }
});

/**
 * @route   GET /api/teams/my-team
 * @desc    Get logged in user's team details
 * @access  Private
 */
router.get('/my-team', authenticateToken, async (req, res) => {
  try {
    const memberRecords = await TeamMember.find({ userId: req.user._id, confirmStatus: 'confirmed' });
    if (!memberRecords || memberRecords.length === 0) {
      return res.status(404).json({ message: 'You are not currently in any confirmed team.' });
    }

    let team = null;
    let activeMemberRecord = null;

    // Find the first confirmed record pointing to an active team that actually exists
    for (const record of memberRecords) {
      const foundTeam = await Team.findById(record.teamId)
        .populate('eventId', 'name semester year status')
        .populate('trackId', 'name description');
      if (foundTeam) {
        team = foundTeam;
        activeMemberRecord = record;
        break;
      }
    }

    if (!team) {
      return res.status(404).json({ message: 'You are not currently in any active confirmed team.' });
    }

    const members = await TeamMember.find({ teamId: team._id })
      .populate('userId', 'fullName email studentId githubUsername avatarUrl');

    const repo = await GithubRepository.findOne({ teamId: team._id });

    res.json({
      team,
      members,
      repository: repo
    });

  } catch (error) {
    console.error('Fetch My Team Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving team.' });
  }
});

/**
 * @route   POST /api/teams/submit-topic
 * @desc    Submit project topic details (Team Leader only)
 * @access  Private (Team Leader)
 */
router.post('/submit-topic', authenticateToken, async (req, res) => {
  const { teamId, title, description, documentationLink } = req.body;

  if (!teamId || !title) {
    return res.status(400).json({ message: 'Team ID and topic title are required.' });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    // Validate that user is the leader
    if (team.leaderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the team leader can submit topic files.' });
    }

    team.topicSubmission = {
      title,
      description,
      documentationLink,
      submittedAt: new Date(),
      updatedAt: new Date()
    };

    await team.save();
    res.json({
      message: 'Topic details and link saved successfully!',
      submission: team.topicSubmission
    });

  } catch (error) {
    console.error('Submit Topic Error:', error.message);
    res.status(500).json({ message: 'Server error saving submission.' });
  }
});

/**
 * @route   GET /api/teams/all
 * @desc    Get all teams in an event
 * @access  Private (Coordinator or Admin)
 */
router.get('/all/:eventId', authenticateToken, async (req, res) => {
  try {
    const teams = await Team.find({ eventId: req.params.eventId })
      .populate('trackId', 'name')
      .populate('leaderId', 'fullName email');

    const detailedTeams = await Promise.all(teams.map(async (t) => {
      const members = await TeamMember.find({ teamId: t._id }).populate('userId', 'fullName email githubUsername confirmStatus');
      const repo = await GithubRepository.findOne({ teamId: t._id });
      return {
        ...t.toObject(),
        members,
        repository: repo
      };
    }));

    res.json(detailedTeams);
  } catch (error) {
    console.error('Get All Teams Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving teams.' });
  }
});

/**
 * @route   GET /api/teams/:teamId
 * @desc    Get team by ID with event, members, and repository details
 * @access  Private (Coordinator, Judge, or Admin)
 */
router.get('/:teamId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate('trackId', 'name')
      .populate('leaderId', 'fullName email')
      .populate('eventId', 'name status');

    if (!team) {
      return res.status(404).json({ message: 'Không tìm thấy đội thi.' });
    }

    const members = await TeamMember.find({ teamId: team._id })
      .populate('userId', 'fullName email githubUsername confirmStatus');
    
    const repo = await GithubRepository.findOne({ teamId: team._id });

    res.json({
      ...team.toObject(),
      members,
      repository: repo
    });
  } catch (error) {
    console.error('Get Team By ID Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving team.' });
  }
});

/**
 * @route   PUT /api/teams/:teamId/assign-track
 * @desc    Assign a team to a track (specific or random) and provision GitHub Repo
 * @access  Private (Coordinator or Admin)
 */
router.put('/:teamId/assign-track', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { trackId } = req.body; // can be a trackId or 'random'

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Không tìm thấy đội thi.' });

    // Auth check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: 'coordinator',
        status: 'active'
      });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator or Admin role required.' });
    }

    let targetTrackId = trackId;

    if (trackId === 'random') {
      const tracks = await Track.find({ eventId: team.eventId });
      if (tracks.length === 0) {
        return res.status(400).json({ message: 'Sự kiện chưa có bảng đấu nào. Vui lòng tạo bảng đấu trước.' });
      }
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      targetTrackId = randomTrack._id;
    }

    const track = await Track.findById(targetTrackId);
    if (!track) return res.status(404).json({ message: 'Bảng đấu không tồn tại.' });

    const event = await Event.findById(team.eventId);
    const orgName = event ? event.githubOrgName : undefined;

    team.trackId = track._id;
    await team.save();

    // Trigger GitHub Repo creation in the background
    const slugRepoName = team.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    
    // Check if repo already exists for this team
    const existingRepo = await GithubRepository.findOne({ teamId: team._id });
    if (!existingRepo) {
      githubService.createTeamRepository(slugRepoName, 'private', orgName)
        .then(async (gitResult) => {
          const actualOrgName = gitResult.owner || orgName;
          
          const newRepo = new GithubRepository({
            eventId: team.eventId,
            trackId: track._id,
            teamId: team._id,
            orgName: actualOrgName,
            repoName: slugRepoName,
            repoUrl: gitResult.repoUrl,
            githubRepoId: gitResult.githubRepoId,
            syncStatus: 'not_synced'
          });
          await newRepo.save();

          const populatedMembers = await TeamMember.find({ teamId: team._id }).populate('userId');
          for (const tm of populatedMembers) {
            if (tm.userId && tm.userId.githubUsername) {
              await githubService.addCollaborator(slugRepoName, tm.userId.githubUsername, 'push', actualOrgName);
            }
          }
          console.log(`[ASSIGN TRACK] Provisioned GitHub repo and added collaborators for team: ${team.name}`);
        })
        .catch((gitErr) => {
          console.error(`[ASSIGN TRACK] Error provisioning GitHub repo for team ${team.name}:`, gitErr.message);
        });
    }

    res.json({
      message: `Đã phân đội ${team.name} vào bảng đấu ${track.name} thành công.`,
      team
    });

  } catch (error) {
    console.error('Assign Track Error:', error.message);
    res.status(500).json({ message: 'Server error during track assignment.' });
  }
});

module.exports = router;
