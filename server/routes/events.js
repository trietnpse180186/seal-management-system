const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Event = mongoose.model('Event');
const Track = mongoose.model('Track');
const Round = mongoose.model('Round');
const EventRole = mongoose.model('EventRole');
const User = mongoose.model('User');
const Team = mongoose.model('Team');
const TeamMember = mongoose.model('TeamMember');
const GithubRepository = mongoose.model('GithubRepository');

const emailService = require('../services/emailService');
const githubService = require('../services/githubService');
const { authenticateToken, requireSystemAdmin, requireEventRole } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/events
 * @desc    Get all events (filtered by semester/year/status)
 * @access  Public
 */
router.get('/', async (req, res) => {
  const { semester, year, status } = req.query;
  const filter = {};
  
  if (semester) filter.semester = semester;
  if (year) filter.year = parseInt(year);
  if (status) filter.status = status;

  try {
    const events = await Event.find(filter).sort({ year: -1, semester: 1 }).lean();
    
    const eventsWithTeamCount = await Promise.all(events.map(async (event) => {
      const teamCount = await Team.countDocuments({ eventId: event._id });
      return { ...event, teamCount };
    }));

    res.json(eventsWithTeamCount);
  } catch (error) {
    console.error('Fetch Events Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving events.' });
  }
});

/**
 * @route   POST /api/events
 * @desc    Create a new event (System Admin only)
 * @access  Private (System Admin)
 */
router.post('/', authenticateToken, requireSystemAdmin, async (req, res) => {
  const { name, semester, year, description, bannerUrl, maxTeams, githubOrgName } = req.body;

  if (!name || !semester || !year) {
    return res.status(400).json({ message: 'Event name, semester, and year are required.' });
  }

  try {
    // Check if event already exists for this semester and year
    const existing = await Event.findOne({ semester, year });
    if (existing) {
      return res.status(400).json({ 
        message: `An event already exists for semester "${semester}" and year "${year}".` 
      });
    }

    const newEvent = new Event({
      name,
      semester,
      year: parseInt(year),
      description,
      bannerUrl,
      maxTeams: maxTeams ? parseInt(maxTeams) : 20,
      githubOrgName: githubOrgName || 'seal-hackathon-2026',
      status: 'draft',
      registrationOpen: new Date(),
      registrationClose: new Date(Date.now() + 3600000 * 24 * 14) // 2 weeks default
    });

    // Auto-provision or link Github organization
    await githubService.createOrganization(newEvent.githubOrgName);

    await newEvent.save();

    // Create a default coordinator EventRole for the creator
    const creatorRole = new EventRole({
      userId: req.user._id,
      eventId: newEvent._id,
      role: 'coordinator',
      assignedBy: req.user._id
    });
    await creatorRole.save();

    // Send email notifications to all members (non-admins) in the background
    User.find({ isSystemAdmin: false }).then(users => {
      users.forEach(user => {
        emailService.sendEventCreationNotification(
          user.email,
          user.fullName,
          newEvent.name,
          newEvent.semester,
          newEvent.year
        ).catch(err => console.error(`Failed to send event notification to ${user.email}:`, err.message));
      });
    }).catch(err => console.error('Error fetching users for event creation notification:', err.message));

    res.status(201).json({
      message: 'Event created successfully!',
      event: newEvent
    });

  } catch (error) {
    console.error('Create Event Error:', error.message);
    res.status(500).json({ message: 'Server error creating event.' });
  }
});

/**
 * @route   GET /api/events/:id
 * @desc    Get detailed event info including tracks & rounds
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const tracks = await Track.find({ eventId: event._id });
    const rounds = await Round.find({ eventId: event._id }).sort({ order: 1 });

    res.json({
      event,
      tracks,
      rounds
    });
  } catch (error) {
    console.error('Fetch Event Details Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving event details.' });
  }
});

/**
 * @route   POST /api/events/:eventId/tracks
 * @desc    Create a Track in an event
 * @access  Private (Coordinator or Admin)
 */
router.post('/:eventId/tracks', authenticateToken, async (req, res) => {
  const { eventId } = req.params;
  const { name, description, maxTeams, roundId } = req.body;

  if (!name || !roundId) {
    return res.status(400).json({ message: 'Track name and roundId are required.' });
  }

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const round = await Round.findById(roundId);
    if (!round) {
      return res.status(404).json({ message: 'Round not found.' });
    }

    // Auth check: System Admin or has coordinator role
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: 'coordinator',
        status: 'active'
      });
      if (!coordinatorRole) {
        return res.status(403).json({ message: 'Only coordinators or system administrators can create tracks.' });
      }
    }

    const newTrack = new Track({
      eventId,
      roundId,
      name,
      description,
      maxTeams: maxTeams ? parseInt(maxTeams) : 10,
      topicSubmissionOpen: true
    });

    await newTrack.save();
    res.status(201).json(newTrack);

  } catch (error) {
    console.error('Create Track Error:', error.message);
    res.status(500).json({ message: 'Server error creating track.' });
  }
});

/**
 * @route   POST /api/events/:eventId/rounds
 * @desc    Add a Round to an event
 * @access  Private (Coordinator or Admin)
 */
router.post('/:eventId/rounds', authenticateToken, async (req, res) => {
  const { eventId } = req.params;
  const { name, order, submissionDeadline, advanceTopN } = req.body;

  if (!name || order === undefined) {
    return res.status(400).json({ message: 'Round name and order sequence are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: 'coordinator',
        status: 'active'
      });
      if (!coordinatorRole) {
        return res.status(403).json({ message: 'Unauthorized.' });
      }
    }

    const newRound = new Round({
      eventId,
      name,
      order: parseInt(order),
      submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : undefined,
      advanceTopN: advanceTopN ? parseInt(advanceTopN) : undefined,
      status: 'pending'
    });

    await newRound.save();
    res.status(201).json(newRound);

  } catch (error) {
    console.error('Create Round Error:', error.message);
    res.status(500).json({ message: 'Server error creating round.' });
  }
});

/**
 * @route   POST /api/events/:eventId/upload-exam
 * @desc    Simulate exam attachment file upload
 * @access  Private (Coordinator or Admin)
 */
router.post('/:eventId/upload-exam', authenticateToken, async (req, res) => {
  const { eventId } = req.params;
  const { trackId, fileName, fileUrl, roundId } = req.body;

  if (!fileName || !fileUrl) {
    return res.status(400).json({ message: 'File name and URL are required.' });
  }

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // Auth check
    if (!req.user.isSystemAdmin) {
      const isCoord = await EventRole.findOne({ userId: req.user._id, eventId, role: 'coordinator' });
      if (!isCoord) return res.status(403).json({ message: 'Unauthorized.' });
    }

    const fileMeta = {
      id: `file-${Date.now()}`,
      fileName,
      fileUrl,
      roundId: roundId || null,
      trackId: trackId || null,
      uploadedAt: new Date(),
      uploadedBy: req.user.fullName
    };

    if (trackId) {
      const track = await Track.findById(trackId);
      if (track) {
        track.attachments.push(fileMeta);
        await track.save();
      }
    } else {
      event.attachments.push(fileMeta);
      await event.save();
    }

    res.json({
      message: 'Exam file details successfully saved to track/event schema!',
      attachment: fileMeta
    });

  } catch (error) {
    console.error('Upload Exam Details Error:', error.message);
    res.status(500).json({ message: 'Server error saving exam attachments.' });
  }
});

/**
 * @route   GET /api/events/:eventId/roles
 * @desc    Get all assigned roles for an event
 * @access  Private (Coordinator or Admin)
 */
router.get('/:eventId/roles', authenticateToken, async (req, res) => {
  const { eventId } = req.params;
  
  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: 'coordinator',
        status: 'active'
      });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
    }

    const roles = await EventRole.find({ eventId, status: 'active' })
      .populate('userId', 'email fullName studentId university githubUsername')
      .populate('trackId', 'name');

    res.json(roles);
  } catch (error) {
    console.error('Fetch Event Roles Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving roles.' });
  }
});

/**
 * @route   DELETE /api/events/:eventId/roles/:roleId
 * @desc    Remove an event role assignment
 * @access  Private (Coordinator or Admin)
 */
router.delete('/:eventId/roles/:roleId', authenticateToken, async (req, res) => {
  const { eventId, roleId } = req.params;

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: 'coordinator',
        status: 'active'
      });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized.' });
    }

    const roleToUpdate = await EventRole.findById(roleId);
    if (!roleToUpdate) return res.status(404).json({ message: 'Role assignment not found.' });

    // Mark status as removed
    roleToUpdate.status = 'removed';
    await roleToUpdate.save();

    res.json({ message: 'Successfully removed role assignment.' });
  } catch (error) {
    console.error('Remove Role Error:', error.message);
    res.status(500).json({ message: 'Server error removing role.' });
  }
});

/**
 * @route   POST /api/events/:eventId/distribute-teams
 * @desc    Randomly distribute confirmed teams (without trackId) to tracks of this event
 * @access  Private (Coordinator or Admin)
 */
router.post('/:eventId/distribute-teams', authenticateToken, async (req, res) => {
  const { eventId } = req.params;

  try {
    // 1. Auth Check (Admin or Coordinator)
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId,
        role: 'coordinator',
        status: 'active'
      });
      if (!coordinatorRole) return res.status(403).json({ message: 'Unauthorized. Coordinator or Admin role required.' });
    }

    // Fetch Event to get org name
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    const orgName = event ? event.githubOrgName : undefined;

    // 2. Fetch tracks
    const tracks = await Track.find({ eventId });
    if (tracks.length === 0) {
      return res.status(400).json({ message: 'Sự kiện này chưa có bảng đấu nào. Vui lòng tạo bảng đấu trước.' });
    }

    // 3. Fetch confirmed teams without trackId
    const teams = await Team.find({ 
      eventId, 
      status: 'confirmed', 
      $or: [{ trackId: null }, { trackId: { $exists: false } }] 
    });
    
    if (teams.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy nhóm thi đấu nào đã xác nhận mà chưa chia bảng.' });
    }

    // 4. Shuffle teams (Fisher-Yates)
    const shuffledTeams = [...teams];
    for (let i = shuffledTeams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
    }

    // 5. Distribute teams to tracks evenly
    const distributionResult = [];
    for (let i = 0; i < shuffledTeams.length; i++) {
      const team = shuffledTeams[i];
      const trackIndex = i % tracks.length;
      const track = tracks[trackIndex];

      team.trackId = track._id;
      await team.save();

      // Trigger GitHub Repo creation in the background
      const slugRepoName = team.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      
      githubService.createTeamRepository(slugRepoName, 'private', orgName)
        .then(async (gitResult) => {
          // Check if repo already exists for this team
          const existingRepo = await GithubRepository.findOne({ teamId: team._id });
          if (!existingRepo) {
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

            // Add collaborators
            const populatedMembers = await TeamMember.find({ teamId: team._id }).populate('userId');
            for (const tm of populatedMembers) {
              if (tm.userId && tm.userId.githubUsername) {
                await githubService.addCollaborator(slugRepoName, tm.userId.githubUsername, 'push', actualOrgName);
              }
            }
            console.log(`[DISTRIBUTION] Provisioned GitHub repo and added collaborators for team: ${team.name}`);
          }
        })
        .catch(gitErr => {
          console.error(`[DISTRIBUTION] Error provisioning GitHub repo for team ${team.name}:`, gitErr.message);
        });

      distributionResult.push({
        teamId: team._id,
        teamName: team.name,
        trackId: track._id,
        trackName: track.name
      });
    }

    res.json({
      message: `Đã phân chia thành công ${shuffledTeams.length} đội thi vào ${tracks.length} bảng đấu.`,
      distribution: distributionResult
    });

  } catch (error) {
    console.error('Distribute Teams Error:', error.message);
    res.status(500).json({ message: 'Server error during team distribution.' });
  }
});

/**
 * @route   PUT /api/events/:id
 * @desc    Update event details/status (System Admin or Coordinator)
 * @access  Private
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, semester, year, description, bannerUrl, maxTeams, githubOrgName, status } = req.body;
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // Auth check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: event._id,
        role: 'coordinator',
        status: 'active'
      });
      if (!coordinatorRole) {
        return res.status(403).json({ message: 'Only coordinators or system administrators can update events.' });
      }
    }

    if (name) event.name = name;
    if (semester) event.semester = semester;
    if (year) event.year = parseInt(year);
    if (description) event.description = description;
    if (bannerUrl) event.bannerUrl = bannerUrl;
    if (maxTeams) event.maxTeams = parseInt(maxTeams);
    
    if (githubOrgName && githubOrgName !== event.githubOrgName) {
      event.githubOrgName = githubOrgName;
      // Auto-provision or link new organization
      await githubService.createOrganization(githubOrgName);
    }
    
    if (status) event.status = status;

    await event.save();
    res.json({ message: 'Event updated successfully!', event });
  } catch (error) {
    console.error('Update Event Error:', error.message);
    res.status(500).json({ message: 'Server error updating event.' });
  }
});

module.exports = router;
