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

const emailService = require('../notifications/emailService');
const githubService = require('../github-ai/githubService');
const captchaService = require('../auth/captchaService');
const { ensureChatRoomForTeam } = require('../chat/chatRoomService');

function getSemesterSuffix(event) {
  if (!event || !event.semester || !event.year) return '';
  const semLower = event.semester.toLowerCase();
  let semCode = '';
  if (semLower === 'spring') semCode = 'sp';
  else if (semLower === 'summer') semCode = 'su';
  else if (semLower === 'fall') semCode = 'fa';
  return semCode ? `_${semCode}${event.year}` : '';
}
const {
  canUserAccessRoundExam,
  canUserAccessTrackExam,
  sanitizeRoundForParticipant,
  sanitizeTrackExamForParticipant,
  isTrackExamOpen,
  buildDriveUrl
} = require('../events/examAccessService');
const { ensureUserDriveAccess } = require('../events/driveAccessService');
const Round = mongoose.model('Round');
const { authenticateToken } = require('../auth/authMiddleware');
const { addEmailJob, addInAppJob, isQueueAvailable } = require('../notifications/notificationQueue');
const { createExternalTeam } = require('./externalTeamService');

function generateTeamCode(teamName) {
  return teamName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function syncTeamToExternalSimulator(team) {
  try {
    if (team.externalTeamId || team.testApiKey) {
      console.log(`[MQTT SERVICE] Team "${team.name}" is already synced to external API.`);
      return;
    }

    if (!team.trackId) {
      console.warn(`[MQTT SERVICE] Team "${team.name}" has no trackId assigned. Skipping external sync.`);
      return;
    }

    const track = await Track.findById(team.trackId);
    if (!track || !track.environmentId) {
      console.warn(`[MQTT SERVICE] Track not found or environmentId is empty for track "${team.trackId}". Skipping external sync.`);
      return;
    }

    let baseCode = generateTeamCode(team.name);
    if (!baseCode) {
      baseCode = `TEAM_${team._id.toString().substring(18).toUpperCase()}`;
    }

    let code = baseCode;
    let syncSuccess = false;
    let result = null;
    let attempts = 0;

    while (!syncSuccess && attempts < 3) {
      try {
        attempts++;
        result = await createExternalTeam(code, team.name, track.environmentId);
        syncSuccess = true;
      } catch (err) {
        if (err.code === 'TEAM_CODE_EXISTS' && attempts < 3) {
          const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
          code = `${baseCode}_${suffix}`;
          console.log(`[MQTT SERVICE] Team code conflicted. Retrying with new code: ${code}`);
        } else {
          throw err;
        }
      }
    }

    if (result) {
      team.externalTeamId = result.team?.id || '';
      team.externalTeamCode = code;
      team.accessCode = result.accessCode || '';
      team.testApiKey = result.testApiKey || '';
      team.judgeApiKey = result.judgeApiKey || '';
      team.mqttUsername = result.mqttUsername || '';
      team.mqttPassword = result.mqttPassword || '';
      team.testTopic = `hackathon/${code.toLowerCase()}/test/telemetry`;
      team.judgeTopic = `hackathon/${code.toLowerCase()}/judge/telemetry`;
      await team.save();

      console.log(`[MQTT SERVICE] Successfully synchronized team "${team.name}" to simulator. Code: ${code}`);
    }
  } catch (error) {
    console.error(`[MQTT SERVICE] Failed to sync team "${team.name}" to external API:`, error.message);
  }
}


/**
 * @route   GET /api/teams/check-eligibility
 * @desc    Check if a user is eligible to join a team for a specific event (not already in a team)
 * @access  Private (Authenticated Users)
 */
router.get('/check-eligibility', authenticateToken, async (req, res) => {
  const { email, eventId } = req.query;

  if (!email || !eventId) {
    return res.status(400).json({ message: 'Thiếu thông tin email hoặc eventId.' });
  }

  try {
    // Find all active teams (confirmed or pending) in the event
    const activeTeams = await Team.find({ eventId, status: { $in: ['confirmed', 'pending_confirm'] } });
    const activeTeamIds = activeTeams.map(t => t._id);

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (!existingUser) {
      return res.json({
        eligible: true,
        message: 'Hợp lệ (Thành viên chưa có tài khoản, hệ thống sẽ gửi thư mời đăng ký).'
      });
    }

    const memberHasTeam = await TeamMember.findOne({
      teamId: { $in: activeTeamIds },
      userId: existingUser._id
    });

    if (memberHasTeam) {
      const team = await Team.findById(memberHasTeam.teamId);
      const teamName = team ? team.name : 'nhóm khác';
      return res.json({
        eligible: false,
        message: `Thành viên này đã đăng ký tham gia đội "${teamName}" trong cuộc thi này.`
      });
    }

    return res.json({
      eligible: true,
      message: 'Hợp lệ (Thành viên chưa có nhóm trong cuộc thi này).',
      user: {
        fullName: existingUser.fullName,
        studentId: existingUser.studentId,
        githubUsername: existingUser.githubUsername,
        university: existingUser.university
      }
    });
  } catch (err) {
    console.error('Check eligibility error:', err);
    return res.status(500).json({ message: 'Lỗi kiểm tra tính hợp lệ của thành viên.' });
  }
});

/**
 * @route   POST /api/teams/register
 * @desc    Register a team and invite members
 * @access  Private (Participants)
 */
router.post('/register', authenticateToken, async (req, res) => {
  const { eventId, trackId, teamName, membersList, leaderInfo, captchaId, captchaValue } = req.body;

  if (!eventId || !teamName || !membersList || !Array.isArray(membersList)) {
    return res.status(400).json({ message: 'Đã xảy ra lỗi trong quá trình đăng ký.' });
  }

  let createdTeamId = null;
  try {
    // Validate Captcha
    if (!captchaService.verifyCaptcha(captchaId, captchaValue)) {
      return res.status(400).json({ message: 'Mã xác thực Captcha không chính xác hoặc đã hết hạn.' });
    }

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
    if (!event) return res.status(404).json({ message: 'Không tìm thấy thông tin cuộc thi.' });
    if (event.status !== 'registration') {
      return res.status(400).json({ message: 'Cuộc thi hiện không mở đăng ký.' });
    }

    // Check overall event capacity (both confirmed and pending_confirm)
    const activeTeamsCount = await Team.countDocuments({ eventId, status: { $in: ['confirmed', 'pending_confirm'] } });
    if (event.maxTeams && activeTeamsCount >= event.maxTeams) {
      return res.status(400).json({ message: 'Cuộc thi đã đạt giới hạn số lượng đội đăng ký dự kiến.' });
    }

    // Check track capacity if trackId is provided
    if (trackId) {
      const track = await Track.findById(trackId);
      if (!track) return res.status(404).json({ message: 'Bảng đấu không tồn tại.' });

      const trackActiveCount = await Team.countDocuments({ trackId, status: { $in: ['confirmed', 'pending_confirm'] } });
      if (track.maxTeams && trackActiveCount >= track.maxTeams) {
        return res.status(400).json({ message: 'Bảng đấu này đã đạt giới hạn số lượng đội đăng ký.' });
      }
    }

    // 2. Validate that none of the members or the leader are already in another team in this event
    const activeTeams = await Team.find({ eventId, status: { $in: ['confirmed', 'pending_confirm'] } });
    const activeTeamIds = activeTeams.map(t => t._id);

    // Check leader
    const leaderHasTeam = await TeamMember.findOne({
      teamId: { $in: activeTeamIds },
      userId: req.user._id
    });
    if (leaderHasTeam) {
      return res.status(400).json({ message: 'Tài khoản của bạn đã đăng ký tham gia một nhóm khác trong cuộc thi này.' });
    }

    // Check members
    for (const memberData of membersList) {
      const { email } = memberData;
      if (!email) continue;

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        const memberHasTeam = await TeamMember.findOne({
          teamId: { $in: activeTeamIds },
          userId: existingUser._id
        });
        if (memberHasTeam) {
          return res.status(400).json({
            message: `Thành viên với email "${email}" đã đăng ký tham gia một nhóm khác trong cuộc thi này.`
          });
        }
      }
    }

    // 3. Validate that team name is unique inside the event
    const nameFilter = { eventId, name: teamName };
    if (trackId) nameFilter.trackId = trackId;
    const existingTeam = await Team.findOne(nameFilter);
    if (existingTeam) {
      return res.status(400).json({ message: 'Tên đội đã tồn tại trong cuộc thi.' });
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
    createdTeamId = team._id;

    // 4. Register/Handle Leader as TeamMember
    const leaderMember = new TeamMember({
      teamId: team._id,
      eventId: team.eventId,
      userId: req.user._id,
      role: 'leader',
      confirmStatus: 'confirmed',
      confirmedAt: new Date()
    });
    await leaderMember.save();

    // Update/Create EventRole for the Leader to 'participant'
    let leaderRoleRecord = await EventRole.findOne({
      userId: req.user._id,
      eventId,
      status: 'active'
    });

    if (!leaderRoleRecord) {
      const newLeaderRole = new EventRole({
        userId: req.user._id,
        eventId,
        role: 'participant',
        assignedBy: req.user._id
      });
      await newLeaderRole.save();
    }

    // 5. Loop through and invite other members
    for (const memberData of membersList) {
      const { email, fullName, githubUsername, studentId, university } = memberData;
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
          university: university || '',
          isApproved: true
        });
        await memberUser.save();
      } else {
        let changed = false;
        if (githubUsername && !memberUser.githubUsername) {
          memberUser.githubUsername = githubUsername;
          changed = true;
        }
        if (university && !memberUser.university) {
          memberUser.university = university;
          changed = true;
        }
        if (changed) {
          await memberUser.save();
        }
      }

      // Generate verification token
      const token = crypto.randomBytes(32).toString('hex');
      const confirmTokenExpiry = new Date(Date.now() + 3600000 * 48); // 48h expiry

      const teamMember = new TeamMember({
        teamId: team._id,
        eventId: team.eventId,
        userId: memberUser._id,
        role: 'member',
        confirmStatus: 'pending',
        confirmTokenHash: token,
        confirmTokenExpiry
      });
      await teamMember.save();

      // Send email invitation via job queue (non-blocking, with retry)
      const inviteLink = `${req.protocol}://${req.get('host')}/api/teams/confirm-invite?token=${token}`;
      if (isQueueAvailable()) {
        await addEmailJob({
          type: 'team_invite',
          email: memberUser.email,
          teamName,
          inviteLink,
        });
        // Send In-App Notification via queue
        await addInAppJob({
          userId: memberUser._id.toString(),
          type: 'team_invite',
          title: 'Lời mời vào đội',
          body: `Bạn đã được mời vào đội "${teamName}". Hãy kiểm tra email để xác nhận!`,
        });
      } else {
        // Fallback: synchronous (Redis not available)
        emailService.sendTeamInvitation(memberUser.email, teamName, inviteLink)
          .catch(err => console.error(`[FALLBACK] Failed to send invitation email to ${memberUser.email}:`, err.message));
        const Notification = mongoose.model('Notification');
        await new Notification({
          userId: memberUser._id,
          type: 'team_invite',
          title: 'Lời mời vào đội',
          body: `Bạn đã được mời vào đội "${teamName}". Hãy kiểm tra email để xác nhận!`,
          channel: 'in_app',
          status: 'sent',
        }).save();
      }
    }

    // Check if team has any pending members. If none (e.g. registered with no additional members),
    // confirm the team immediately and auto-create repo!
    const pendingMembers = await TeamMember.countDocuments({ teamId: team._id, confirmStatus: 'pending' });
    if (pendingMembers === 0) {
      team.status = 'confirmed';
      await team.save();

      // Sync team to external simulator API for MQTT keys
      await syncTeamToExternalSimulator(team);

      console.log(`[TEAM] Team "${team.name}" is now FULLY CONFIRMED immediately upon registration! Creating repo...`);

      // Automatically create Github Repository
      const orgName = event ? event.githubOrgName : undefined;
      const suffix = getSemesterSuffix(event);
      const slugRepoName = team.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + suffix;
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



      return res.status(201).json({
        message: 'Đăng ký nhóm thành công! Nhóm đã được xác nhận lập tức và khởi tạo kho lưu trữ GitHub.',
        teamId: team._id,
        status: 'confirmed',
        repository: newRepo
      });
    }

    res.status(201).json({
      message: 'Đăng ký đội thành công! Đã gửi email xác nhận tham gia cho các thành viên.',
      teamId: team._id,
      status: team.status
    });

  } catch (error) {
    console.error('Team Registration Error:', error.message);
    if (createdTeamId) {
      try {
        console.log(`[ROLLBACK] Cleaning up team ${createdTeamId} due to registration error...`);
        const TeamMember = mongoose.model('TeamMember');
        const Team = mongoose.model('Team');
        await Team.deleteOne({ _id: createdTeamId });
        await TeamMember.deleteMany({ teamId: createdTeamId });
      } catch (rollbackError) {
        console.error('[ROLLBACK ERROR] Failed to clean up team registration:', rollbackError.message);
      }
    }
    
    // Xử lý lỗi trùng lặp duy nhất (Race condition / Concurrent registration)
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Một hoặc nhiều thành viên (hoặc chính bạn) đã được đăng ký vào một đội khác trong cuộc thi này.' 
      });
    }
    
    res.status(500).json({ message: 'Đăng ký đội thất bại.' });
  }
});

/**
 * @route   GET /api/teams/confirm-invite
 * @desc    Confirm team participation link
 * @access  Public
 */
router.get('/confirm-invite', async (req, res) => {
  const { token } = req.query;

  const clientUrl = process.env.CLIENT_URL || 'https://www.seal-hackathon.io.vn';

  if (!token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html class="dark" lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEAL HACKATHON // LỖI XÁC THỰC</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #0a141d;
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
          }
        </style>
      </head>
      <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-[#0a141d]/90 border border-red-500/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-pulse"></div>
          <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[INVITATION_ERROR]</div>
          <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">THIẾU MÃ XÁC NHẬN</h1>
          <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Không tìm thấy mã xác nhận lời mời trong yêu cầu của bạn.</p>
          <a href="${clientUrl}" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] rounded">ĐI TỚI BẢNG ĐIỀU KHIỂN</a>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const member = await TeamMember.findOne({
      confirmTokenHash: token
    });

    if (!member) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html class="dark" lang="vi">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SEAL HACKATHON // LỖI LỜI MỜI</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body {
              background-color: #0a141d;
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
              background-size: 40px 40px;
            }
          </style>
        </head>
        <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#0a141d]/90 border border-red-500/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-pulse"></div>
            <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[LINK_EXPIRED_OR_INVALID]</div>
            <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">LIÊN KẾT HẾT HẠN</h1>
            <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Mã xác thực của bạn không hợp lệ hoặc đường link này đã hết hạn hiệu lực (48 giờ).</p>
            <a href="${clientUrl}" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] rounded">ĐI TỚI BẢNG ĐIỀU KHIỂN</a>
          </div>
        </body>
        </html>
      `);
    }

    // If already confirmed, render success page immediately
    if (member.confirmStatus === 'confirmed') {
      const team = await Team.findById(member.teamId);
      return res.send(`
        <!DOCTYPE html>
        <html class="dark" lang="vi">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SEAL HACKATHON // XÁC NHẬN THÀNH CÔNG</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body {
              background-color: #0a141d;
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
              background-size: 40px 40px;
            }
          </style>
        </head>
        <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#0a141d]/90 border border-[#00f0ff]/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-80 animate-pulse"></div>
            <div class="inline-flex border border-[#00f0ff] px-3 py-1 text-xs font-mono text-[#00f0ff] mb-6 bg-[#00f0ff]/5 uppercase tracking-widest rounded">[INVITATION_CONFIRMED]</div>
            <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-[#00f0ff] flex items-center justify-center bg-[#00f0ff]/10 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
              <svg class="w-10 h-10 text-[#00f0ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">ĐÃ XÁC NHẬN THAM GIA</h1>
            <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Bạn đã xác nhận tham gia đội thi <strong>${team ? team.name : ''}</strong> từ trước. Bạn có thể đóng tab này hoặc nhấn nút bên dưới để quay lại hệ thống.</p>
            <a href="${clientUrl}/team-area" class="inline-block w-full py-3 border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff] hover:text-[#0a141d] font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(0,240,255,0.1)] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] rounded">QUAY LẠI TRANG ĐỘI THI</a>
          </div>
        </body>
        </html>
      `);
    }

    // Check token expiry for pending confirmation
    if (member.confirmTokenExpiry && member.confirmTokenExpiry < new Date()) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html class="dark" lang="vi">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SEAL HACKATHON // LỖI LỜI MỜI</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body {
              background-color: #0a141d;
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
              background-size: 40px 40px;
            }
          </style>
        </head>
        <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#0a141d]/90 border border-red-500/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-pulse"></div>
            <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[LINK_EXPIRED_OR_INVALID]</div>
            <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">LIÊN KẾT HẾT HẠN</h1>
            <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Mã xác thực của bạn không hợp lệ hoặc đường link này đã hết hạn hiệu lực (48 giờ).</p>
            <a href="${clientUrl}" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] rounded">ĐI TỚI BẢNG ĐIỀU KHIỂN</a>
          </div>
        </body>
        </html>
      `);
    }

    // Confirm member
    member.confirmStatus = 'confirmed';
    member.confirmedAt = new Date();
    await member.save();

    // Check if ALL team members are now confirmed
    const team = await Team.findById(member.teamId);

    // Update/Create EventRole for the Member to 'participant'
    if (team) {
      let memberRoleRecord = await EventRole.findOne({
        userId: member.userId,
        eventId: team.eventId,
        status: 'active'
      });

      if (!memberRoleRecord) {
        const newMemberRole = new EventRole({
          userId: member.userId,
          eventId: team.eventId,
          role: 'participant',
          assignedBy: team.leaderId
        });
        await newMemberRole.save();
      }
    }

    const totalMembers = await TeamMember.find({ teamId: team._id });
    const pendingCount = totalMembers.filter(m => m.confirmStatus !== 'confirmed').length;

    // Notify Leader that a member confirmed
    const user = await User.findById(member.userId);

    // Re-share Drive if exam already open for this round
    if (user?.email && team?.trackId) {
      try {
        const track = await Track.findById(team.trackId);
        if (track?.roundId) {
          const round = await Round.findById(track.roundId);
          if (round?.driveFileId && round.startTime && new Date() >= new Date(round.startTime)) {
            await ensureUserDriveAccess(round.driveFileId, user.email);
          }
        }
      } catch (driveErr) {
        console.error('[DRIVE] Re-sync on member confirm failed:', driveErr.message);
      }
    }

    if (member.userId.toString() !== team.leaderId.toString()) {
      if (isQueueAvailable()) {
        await addInAppJob({
          userId: team.leaderId.toString(),
          type: 'member_confirm',
          title: 'Thành viên đã xác nhận',
          body: `Thành viên ${user ? user.fullName : 'mới'} đã xác nhận tham gia đội "${team.name}".`,
        });
      } else {
        // Fallback: synchronous
        const Notification = mongoose.model('Notification');
        await new Notification({
          userId: team.leaderId,
          type: 'member_confirm',
          title: 'Thành viên đã xác nhận',
          body: `Thành viên ${user ? user.fullName : 'mới'} đã xác nhận tham gia đội "${team.name}".`,
          channel: 'in_app',
          status: 'sent',
        }).save();
      }
    }

    if (pendingCount === 0) {
      // All confirmed! Promote team status
      team.status = 'confirmed';
      await team.save();

      // Sync team to external simulator API for MQTT keys
      await syncTeamToExternalSimulator(team);

      console.log(`[TEAM] Team "${team.name}" is now FULLY CONFIRMED! Creating repo...`);

      // 1. Automatically create Github Repository
      const event = await Event.findById(team.eventId);
      const orgName = event ? event.githubOrgName : undefined;
      const suffix = getSemesterSuffix(event);
      const slugRepoName = team.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + suffix;
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



      // Notify all team members that team is confirmed
      for (const tm of populatedMembers) {
        if (isQueueAvailable()) {
          await addInAppJob({
            userId: (tm.userId._id || tm.userId).toString(),
            type: 'team_ready',
            title: 'Đội đã sẵn sàng thi đấu',
            body: `Tuyệt vời! Tất cả thành viên đội "${team.name}" đã xác nhận. Repository GitHub của bạn là ${slugRepoName}.`,
          });
        } else {
          // Fallback: synchronous
          const Notification = mongoose.model('Notification');
          await new Notification({
            userId: tm.userId._id || tm.userId,
            type: 'team_ready',
            title: 'Đội đã sẵn sàng thi đấu',
            body: `Tuyệt vời! Tất cả thành viên đội "${team.name}" đã xác nhận. Repository GitHub của bạn là ${slugRepoName}.`,
            channel: 'in_app',
            status: 'sent',
          }).save();
        }
      }
    }

    // Send successful response page (HTML mockup or redirect)
    res.send(`
      <!DOCTYPE html>
      <html class="dark" lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEAL HACKATHON // XÁC NHẬN THÀNH CÔNG</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #0a141d;
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
          }
        </style>
      </head>
      <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-[#0a141d]/90 border border-[#00f0ff]/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-80 animate-pulse"></div>
          <div class="inline-flex border border-[#00f0ff] px-3 py-1 text-xs font-mono text-[#00f0ff] mb-6 bg-[#00f0ff]/5 uppercase tracking-widest rounded">[INVITATION_CONFIRMED]</div>
          <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-[#00f0ff] flex items-center justify-center bg-[#00f0ff]/10 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
            <svg class="w-10 h-10 text-[#00f0ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">ĐÃ XÁC NHẬN THAM GIA</h1>
          <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Tuyệt vời! Bạn đã xác nhận tham gia đội thi <strong>${team.name}</strong> thành công. Bạn có thể đóng tab này hoặc nhấn nút bên dưới để quay lại hệ thống.</p>
          <a href="${clientUrl}/team-area" class="inline-block w-full py-3 border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff] hover:text-[#0a141d] font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(0,240,255,0.1)] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] rounded">QUAY LẠI TRANG ĐỘI THI</a>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Invite Confirmation Error:', error.message);
    const clientUrl = process.env.CLIENT_URL || 'https://www.seal-hackathon.io.vn';
    res.status(500).send(`
      <!DOCTYPE html>
      <html class="dark" lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEAL HACKATHON // LỖI HỆ THỐNG</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #0a141d;
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
          }
        </style>
      </head>
      <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-[#0a141d]/90 border border-red-500/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-pulse"></div>
          <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[SERVER_ERROR]</div>
          <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">LỖI HỆ THỐNG</h1>
          <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Đã xảy ra lỗi trong quá trình xử lý xác nhận lời mời của bạn. Vui lòng thử lại sau.</p>
          <a href="${clientUrl}" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] rounded">ĐI TỚI BẢNG ĐIỀU KHIỂN</a>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * @route   GET /api/teams/history
 * @desc    Get previous teams the logged in user has participated in
 * @access  Private
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const memberRecords = await TeamMember.find({
      userId: req.user._id,
      confirmStatus: 'confirmed'
    });

    if (!memberRecords || memberRecords.length === 0) {
      return res.json([]);
    }

    const teamIds = memberRecords.map(r => r.teamId);

    const teams = await Team.find({ _id: { $in: teamIds } })
      .populate('eventId', 'name semester year status')
      .lean();

    const teamsWithMembers = [];

    for (const team of teams) {
      const allMembers = await TeamMember.find({ teamId: team._id })
        .populate('userId', 'fullName email studentId githubUsername university')
        .lean();

      const otherMembers = allMembers
        .filter(m => m.userId && m.userId._id.toString() !== req.user._id.toString())
        .map(m => ({
          email: m.userId.email || '',
          fullName: m.userId.fullName || '',
          githubUsername: m.userId.githubUsername || '',
          studentId: m.userId.studentId || '',
          university: m.userId.university || ''
        }));

      teamsWithMembers.push({
        _id: team._id,
        name: team.name,
        event: team.eventId,
        members: otherMembers
      });
    }

    res.json(teamsWithMembers);
  } catch (error) {
    console.error('Fetch Team History Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải lịch sử nhóm.' });
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
      return res.status(404).json({ message: 'Bạn hiện không ở trong bất kỳ nhóm nào đã được xác nhận.' });
    }

    let team = null;
    let activeMemberRecord = null;
    const foundTeams = [];

    const targetEventId = req.query.eventId;

    // Find all confirmed records pointing to active teams that actually exist
    for (const record of memberRecords) {
      const foundTeam = await Team.findById(record.teamId)
        .populate('eventId', 'name semester year status contestStart contestEnd registrationOpen registrationClose seminar commitSyncInterval')
        .populate({
          path: 'trackId',
          select: 'name description startTime endTime roundId environmentId examDriveFileId examDriveFileName examDriveFileUrl isExamManualOpen',
          populate: {
            path: 'roundId',
            model: 'Round'
          }
        });
      if (foundTeam) {
        if (targetEventId && foundTeam.eventId && foundTeam.eventId._id.toString() !== targetEventId) {
          continue;
        }
        // Skip orphan teams whose event has been deleted/removed
        if (!foundTeam.eventId) {
          continue;
        }
        foundTeams.push({ team: foundTeam, record });
      }
    }

    if (foundTeams.length > 0) {
      // Prioritize teams belonging to events that are NOT completed/cancelled, and whose contestEnd has not passed
      const activeTeams = foundTeams.filter(({ team }) => {
        const isEnded = team.eventId && (
          team.eventId.status === 'completed' ||
          team.eventId.status === 'cancelled' ||
          (team.eventId.contestEnd && new Date(team.eventId.contestEnd) <= new Date())
        );
        return !isEnded;
      });

      if (activeTeams.length > 0) {
        team = activeTeams[0].team;
        activeMemberRecord = activeTeams[0].record;
      } else {
        // Fallback to the first found team (e.g. past team)
        team = foundTeams[0].team;
        activeMemberRecord = foundTeams[0].record;
      }
    }

    if (!team) {
      return res.status(404).json({ message: 'Bạn hiện không ở trong bất kỳ nhóm nào đã được xác nhận và đang hoạt động.' });
    }

    const members = await TeamMember.find({ teamId: team._id })
      .populate('userId', 'fullName email studentId githubUsername avatarUrl university');

    const repo = await GithubRepository.findOne({ teamId: team._id });

    const teamPlain = team.toObject();

    const trackPlain = teamPlain.trackId;
    if (trackPlain) {
      // Sanitize round for participant (strip raw drive url from round)
      const roundData = trackPlain.roundId;
      if (roundData) {
        trackPlain.roundId = sanitizeRoundForParticipant(roundData);
      }
      // Attach per-track exam info — only expose link when exam is open
      trackPlain.examAccess = sanitizeTrackExamForParticipant(trackPlain, roundData);
      // Remove raw exam fields so participant can't extract url directly from track object
      delete trackPlain.examDriveFileId;
      delete trackPlain.examDriveFileUrl;
      delete trackPlain.examDriveFileName;
      teamPlain.trackId = trackPlain;
    }

    // Calculate event rounds and elimination status
    const Round = mongoose.model('Round');
    const allRounds = await Round.find({ eventId: team.eventId._id }).sort({ order: 1 });
    const activeRound = allRounds.find(r => r.status === 'active' || r.status === 'scoring');

    let isEliminated = false;
    let eliminationMessage = '';
    let achievedResult = null;

    if (team.status === 'disqualified') {
      isEliminated = true;
      eliminationMessage = team.disqualifyReason || 'Đội thi của bạn đã bị loại khỏi cuộc thi.';
    } else if (trackPlain && trackPlain.roundId) {
      const teamRound = trackPlain.roundId;
      const hasNextRound = allRounds.some(r => r.order > teamRound.order);
      if (teamRound.status === 'completed' && hasNextRound) {
        isEliminated = true;
        eliminationMessage = `Đội thi của bạn đã dừng bước tại vòng "${teamRound.name}" và không thể tiến vào vòng kế tiếp.`;

        // Fetch ranking/result achieved in this completed round
        const Ranking = mongoose.model('Ranking');
        const rankingDoc = await Ranking.findOne({ teamId: team._id, roundId: teamRound._id }).lean();
        if (rankingDoc) {
          achievedResult = {
            score: rankingDoc.finalScore || rankingDoc.averageScore || 0,
            rank: rankingDoc.rank || 0,
            roundName: teamRound.name,
            trackName: trackPlain.name
          };
        }
      }
    }

    const currentEventRound = activeRound ? activeRound.name : null;

    teamPlain.isEliminated = isEliminated;
    teamPlain.eliminationMessage = eliminationMessage;
    teamPlain.currentEventRound = currentEventRound;
    teamPlain.achievedResult = achievedResult;

    // Fetch active judge status from simulator
    let isJudgeActive = false;
    if (teamPlain.externalTeamCode) {
      const { getJudgeActive } = require('./externalTeamService');
      try {
        const activeInfo = await getJudgeActive();
        const info = Array.isArray(activeInfo)
          ? activeInfo.find(item => item.teamCode === teamPlain.externalTeamCode)
          : (activeInfo && activeInfo.teamCode === teamPlain.externalTeamCode ? activeInfo : null);
        if (info) {
          isJudgeActive = true;
        }
      } catch (err) {
        console.warn('[SIMULATOR] Failed to fetch active judge status for my-team:', err.message);
      }
    }
    teamPlain.isJudgeActive = isJudgeActive;

    res.json({
      team: teamPlain,
      members,
      repository: repo
    });

  } catch (error) {
    console.error('Fetch My Team Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải thông tin nhóm.' });
  }
});

/**
 * @route   GET /api/teams/my-team/exam-access
 * @desc    Trả về link Google Drive đề bài cho thành viên đội đã xác nhận.
 *          Link Drive phải được admin set "Anyone with the link" — không cần OAuth cấp quyền.
 * @access  Private (Confirmed team member)
 */
router.get('/my-team/exam-access', authenticateToken, async (req, res) => {
  try {
    const memberRecord = await TeamMember.findOne({
      userId: req.user._id,
      confirmStatus: 'confirmed'
    });

    if (!memberRecord) {
      return res.status(403).json({ message: 'Bạn cần là thành viên đã xác nhận của đội để truy cập đề bài.' });
    }

    const team = await Team.findById(memberRecord.teamId).populate('trackId', 'roundId name examDriveFileId examDriveFileUrl examDriveFileName isExamManualOpen');
    if (!team || team.status !== 'confirmed') {
      return res.status(403).json({ message: 'Đội của bạn chưa được xác nhận hoàn tất.' });
    }

    const trackId = team.trackId?._id;
    if (!trackId) {
      return res.status(404).json({ message: 'Đội chưa được gán bảng đấu.' });
    }

    // ── Ưu tiên: kiểm tra link đề riêng của bảng (per-track) ──
    const trackAccess = await canUserAccessTrackExam(req.user._id, trackId);
    if (trackAccess.ok) {
      // Có link per-track → trả về luôn
      return res.json({ accessUrl: trackAccess.accessUrl, source: 'track' });
    }

    // Nếu bảng chưa có link riêng → fallback sang round-level (backward compat)
    if (trackAccess.reason === 'no_material') {
      const roundId = team.trackId?.roundId;
      if (!roundId) {
        return res.status(404).json({ message: 'Đội chưa được gán vòng thi / bảng đấu.' });
      }
      const access = await canUserAccessRoundExam(req.user._id, roundId);
      if (!access.ok) {
        return res.status(403).json({ message: access.message, reason: access.reason });
      }
      return res.json({ accessUrl: access.accessUrl, source: 'round' });
    }

    // Bảng có link nhưng chưa mở
    const access = trackAccess;
    if (!access.ok) {
      return res.status(403).json({ message: access.message, reason: access.reason });
    }

    // Trả về link Drive trực tiếp — thí sinh click vào là mở được ngay
    const accessUrl = access.accessUrl;

    res.json({
      fileName: access.round.driveFileName,
      accessUrl,
      roundName: access.round.name,
      message: 'Đề bài đã sẵn sàng. Nhấn vào link để mở Google Drive.'
    });
  } catch (error) {
    console.error('Exam Access Error:', error.message);
    res.status(500).json({ message: 'Lỗi khi mở đề bài.', detail: error.message });
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
    return res.status(400).json({ message: 'ID nhóm và tên đề tài là bắt buộc.' });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Không tìm thấy nhóm.' });

    // Validate that user is the leader
    if (team.leaderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Chỉ trưởng nhóm mới có quyền nộp thông tin đề tài.' });
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
      message: 'Đã lưu chi tiết đề tài và đường dẫn thành công!',
      submission: team.topicSubmission
    });

  } catch (error) {
    console.error('Submit Topic Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi lưu bài nộp.' });
  }
});

/**
 * @route   GET /api/teams/all
 * @desc    Get all teams in an event
 * @access  Private (Coordinator or Admin)
 */
router.get('/all/:eventId', authenticateToken, async (req, res) => {
  try {
    const Event = mongoose.model('Event');
    const event = await Event.findById(req.params.eventId);
    if (event && event.isArchived) {
      // Allow only System Admin or Coordinator
      let authorized = req.user.isSystemAdmin;
      if (!authorized) {
        const coordRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: event._id,
          role: { $in: ['coordinator', 'admin_view'] },
          status: 'active'
        });
        authorized = !!coordRole;
      }
      if (!authorized) {
        return res.status(403).json({ message: 'Sự kiện này đã bị ẩn. Bạn không có quyền truy cập.' });
      }
    }

    let query = { eventId: req.params.eventId };

    if (!req.user.isSystemAdmin) {
      const roundId = req.query.roundId;
      const roleQuery = req.query.role;
      let userRole = null;

      if (roundId) {
        const criteria = {
          userId: req.user._id,
          eventId: req.params.eventId,
          roundId: roundId,
          status: 'active'
        };
        if (roleQuery) {
          criteria.role = roleQuery;
        }
        userRole = await EventRole.findOne(criteria);
      }

      if (!userRole) {
        const criteria = {
          userId: req.user._id,
          eventId: req.params.eventId,
          status: 'active'
        };
        if (roleQuery) {
          criteria.role = roleQuery;
        }
        userRole = await EventRole.findOne(criteria);
      }

      if (userRole && userRole.role === 'mentor') {
        const activeRound = await Round.findOne({ eventId: req.params.eventId, status: 'active' });

        const mentorRoles = await EventRole.find({
          userId: req.user._id,
          eventId: req.params.eventId,
          role: 'mentor',
          status: 'active'
        });

        const activeRoundMentorRoles = [];
        if (activeRound) {
          for (const role of mentorRoles) {
            if (role.trackId) {
              const track = await Track.findById(role.trackId);
              if (track && track.roundId.toString() === activeRound._id.toString()) {
                activeRoundMentorRoles.push(role);
              }
            } else {
              activeRoundMentorRoles.push(role);
            }
          }
        } else {
          activeRoundMentorRoles.push(...mentorRoles);
        }

        if (activeRound && activeRoundMentorRoles.length === 0) {
          return res.status(403).json({ message: 'Bạn không được phân công cố vấn ở vòng thi này.' });
        }

        const trackIds = activeRoundMentorRoles.map(r => r.trackId).filter(id => id !== null && id !== undefined);

        if (trackIds.length > 0) {
          query.trackId = { $in: trackIds };
        } else {
          query.mentorId = req.user._id;
        }
      } else if (userRole && userRole.role === 'judge') {
        const roundId = req.query.roundId;
        let assignedRole = null;

        if (roundId && mongoose.Types.ObjectId.isValid(roundId)) {
          const TrackModel = mongoose.model('Track');
          const roundTracks = await TrackModel.find({ roundId: roundId });
          const roundTrackIds = roundTracks.map(t => t._id.toString());

          const judgeRoles = await EventRole.find({
            userId: req.user._id,
            eventId: req.params.eventId,
            role: 'judge',
            status: 'active'
          });

          assignedRole = judgeRoles.find(role => role.trackId && roundTrackIds.includes(role.trackId.toString()));

          if (!assignedRole) {
            return res.status(403).json({ message: 'Bạn không được phân công chấm điểm ở vòng thi này.' });
          }
        }

        let isFinalRound = false;
        if (roundId && mongoose.Types.ObjectId.isValid(roundId)) {
          const RoundModel = mongoose.model('Round');
          const roundObj = await RoundModel.findById(roundId);
          if (roundObj && (roundObj.name.toLowerCase().includes('chung kết') || roundObj.advanceTopN === 0)) {
            isFinalRound = true;
          }
        }

        if (isFinalRound) {
          // Judges can see all teams in the final round, don't restrict to track
        } else {
          let effectiveRoundId = roundId;
          if (!effectiveRoundId) {
            const activeRound = await Round.findOne({ eventId: req.params.eventId, status: 'active' });
            if (activeRound) {
              effectiveRoundId = activeRound._id;
            }
          }

          if (effectiveRoundId) {
            const roundDoc = await Round.findById(effectiveRoundId);
            if (roundDoc && roundDoc.status === 'completed') {
              // Hide all teams from judges if the round is already locked/completed
              return res.json([]);
            }
          }

          const trackIdToUse = assignedRole ? assignedRole.trackId : userRole.trackId;

          if (trackIdToUse) {
            const track = await Track.findById(trackIdToUse);
            if (track && effectiveRoundId && track.roundId.toString() !== effectiveRoundId.toString()) {
              // Queried/active round does not match the judge's assigned track's round
              return res.json([]);
            }
            query.trackId = trackIdToUse;
          } else {
            return res.json([]);
          }
        }
      } else if (!userRole) {
        let msg = 'Bạn không có quyền truy cập thông tin cuộc thi này.';
        if (roleQuery === 'mentor') {
          msg = 'Bạn không được phân công cố vấn ở cuộc thi này.';
        } else if (roleQuery === 'judge') {
          msg = 'Bạn không được phân công chấm điểm ở cuộc thi này.';
        }
        return res.status(403).json({ message: msg });
      }
    }

    // Kiểm tra xem người dùng có phải là Admin hoặc Ban tổ chức (Coordinator) không
    let isCoordinator = req.user.isSystemAdmin;
    if (!isCoordinator) {
      const coordRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: req.params.eventId,
        role: { $in: ['coordinator', 'admin_view'] },
        status: 'active'
      });
      isCoordinator = !!coordRole;
    }

    // Support historical and current track/round query matching
    const Ranking = mongoose.model('Ranking');
    let effectiveRoundIdForRanking = req.query.roundId;
    if (!effectiveRoundIdForRanking) {
      const activeRound = await Round.findOne({ eventId: req.params.eventId, status: 'active' });
      if (activeRound) {
        effectiveRoundIdForRanking = activeRound._id;
      }
    }

    let teamIdsFromRankings = [];
    if (query.trackId) {
      const rankings = await Ranking.find({ trackId: query.trackId });
      teamIdsFromRankings = rankings.map(r => r.teamId);
    } else if (effectiveRoundIdForRanking) {
      const rankings = await Ranking.find({ roundId: effectiveRoundIdForRanking });
      teamIdsFromRankings = rankings.map(r => r.teamId);
    }

    let finalQuery = { ...query };
    const isFilterRequested = !!req.query.roundId || !!req.query.trackId;

    // Chỉ áp dụng bộ lọc giới hạn vòng đấu/bảng đấu nếu người dùng KHÔNG phải Admin/BTC, 
    // HOẶC nếu họ chủ động truyền tham số bộ lọc (roundId/trackId) từ giao diện.
    if (isFilterRequested || !isCoordinator) {
      if (query.trackId) {
        delete finalQuery.trackId;
        finalQuery.$or = [
          { trackId: query.trackId },
          { _id: { $in: teamIdsFromRankings } }
        ];
      } else if (effectiveRoundIdForRanking) {
        finalQuery.$or = [
          { currentRoundId: effectiveRoundIdForRanking },
          { _id: { $in: teamIdsFromRankings } }
        ];
      }
    }

    const teams = await Team.find(finalQuery)
      .populate('trackId', 'name')
      .populate('currentRoundId', 'name order status')
      .populate('leaderId', 'fullName email')
      .populate('mentorId', 'fullName email');

    const detailedTeams = await Promise.all(teams.map(async (t) => {
      const members = await TeamMember.find({ teamId: t._id }).populate('userId', 'fullName email studentId university githubUsername confirmStatus');
      const repo = await GithubRepository.findOne({ teamId: t._id });
      const rankings = await Ranking.find({ teamId: t._id }).lean();
      return {
        ...t.toObject(),
        members,
        repository: repo,
        rankings: rankings || []
      };
    }));

    res.json(detailedTeams);
  } catch (error) {
    console.error('Get All Teams Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải danh sách nhóm.' });
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
      .populate({
        path: 'trackId',
        select: 'name description roundId attachments environmentId examDriveFileId examDriveFileUrl examDriveFileName isExamManualOpen',
        populate: {
          path: 'roundId',
          select: 'name driveFileName driveFileId driveFileUrl startTime advanceTopN'
        }
      })
      .populate('leaderId', 'fullName email')
      .populate('eventId', 'name status isArchived');

    if (!team) {
      return res.status(404).json({ message: 'Không tìm thấy đội thi.' });
    }

    // Block non-coordinators/non-admins if event is archived
    if (team.eventId && team.eventId.isArchived) {
      let authorized = req.user.isSystemAdmin;
      if (!authorized) {
        const coordRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId._id,
          role: { $in: ['coordinator', 'admin_view'] },
          status: 'active'
        });
        authorized = !!coordRole;
      }
      if (!authorized) {
        return res.status(403).json({ message: 'Sự kiện của đội thi này đã bị ẩn. Bạn không có quyền truy cập.' });
      }
    }

    // Verify track permissions for judges/mentors
    if (!req.user.isSystemAdmin) {
      const userRoles = await EventRole.find({
        userId: req.user._id,
        eventId: team.eventId,
        status: 'active'
      });

      if (userRoles.length === 0) {
        return res.status(403).json({ message: 'Bạn không có quyền truy cập thông tin của đội thi này.' });
      }

      const activeRound = await Round.findOne({ eventId: team.eventId, status: 'active' });
      let isAuthorized = false;

      for (const roleObj of userRoles) {
        if (roleObj.role === 'coordinator' || roleObj.role === 'admin_view') {
          isAuthorized = true;
          break;
        }

        if (roleObj.role === 'judge') {
          if (roleObj.trackId && activeRound) {
            const track = await Track.findById(roleObj.trackId);
            if (track && track.roundId.toString() !== activeRound._id.toString()) {
              continue; // Skip role if it belongs to a different round
            }
          }

          let isFinalRound = false;
          if (team.trackId && team.trackId.roundId) {
            const r = team.trackId.roundId;
            if (r.name.toLowerCase().includes('chung kết') || r.advanceTopN === 0) {
              isFinalRound = true;
            }
          }
          if (isFinalRound) {
            isAuthorized = true;
            break;
          }
          if (roleObj.trackId && team.trackId && roleObj.trackId.toString() === team.trackId._id.toString()) {
            isAuthorized = true;
            break;
          }
        }

        if (roleObj.role === 'mentor') {
          if (roleObj.trackId && activeRound) {
            const track = await Track.findById(roleObj.trackId);
            if (track && track.roundId.toString() !== activeRound._id.toString()) {
              continue; // Skip role if it belongs to a different round
            }
          }

          const isTeamMentor = team.mentorId && team.mentorId.toString() === req.user._id.toString();
          const isTrackMatch = roleObj.trackId && team.trackId && roleObj.trackId.toString() === team.trackId._id.toString();
          if (isTeamMentor || isTrackMatch) {
            isAuthorized = true;
            break;
          }
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ message: 'Bạn không có quyền truy cập thông tin của đội thi thuộc bảng đấu khác.' });
      }
    }

    const members = await TeamMember.find({ teamId: team._id })
      .populate('userId', 'fullName email studentId university githubUsername confirmStatus');

    const repo = await GithubRepository.findOne({ teamId: team._id });

    const teamPlain = team.toObject();

    if (teamPlain.trackId && teamPlain.trackId.roundId) {
      const r = teamPlain.trackId.roundId;
      teamPlain.trackId.roundId = {
        ...r,
        hasExamMaterial: !!(r.driveFileId || r.driveFileUrl)
      };
    }

    // Fetch environment code and active judge status if team has external code
    if (team.externalTeamCode) {
      const { getJudgeActive, getEnvironment } = require('./externalTeamService');
      
      let isJudgeActive = false;
      let currentScenario = 'NORMAL';
      try {
        const activeInfo = await getJudgeActive();
        const info = Array.isArray(activeInfo)
          ? activeInfo.find(item => item.teamCode === team.externalTeamCode)
          : (activeInfo && activeInfo.teamCode === team.externalTeamCode ? activeInfo : null);
        if (info) {
          isJudgeActive = true;
          currentScenario = info.scenario;
        }
      } catch (err) {
        console.warn('[SIMULATOR] Failed to fetch active judge status:', err.message);
      }
      teamPlain.isJudgeActive = isJudgeActive;
      teamPlain.currentScenario = currentScenario;

      if (team.trackId && team.trackId.environmentId) {
        try {
          const envInfo = await getEnvironment(team.trackId.environmentId);
          teamPlain.environmentCode = envInfo.code;
        } catch (err) {
          console.warn('[SIMULATOR] Failed to fetch environment code:', err.message);
        }
      }
    }

    const responseData = {
      ...teamPlain,
      members,
      repository: repo
    };

    res.json({
      ...responseData,
      team: responseData
    });
  } catch (error) {
    console.error('Get Team By ID Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải thông tin nhóm.' });
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
      if (!coordinatorRole) return res.status(403).json({ message: 'Không có quyền truy cập. Yêu cầu vai trò Điều phối viên hoặc Quản trị viên.' });
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

    // Sync team to external simulator if confirmed
    if (team.status === 'confirmed') {
      try {
        await syncTeamToExternalSimulator(team);
      } catch (syncErr) {
        console.error('[ASSIGN TRACK] Simulator sync failed:', syncErr.message);
      }
    }

    // Trigger GitHub Repo creation in the background
    const suffix = getSemesterSuffix(event);
    const slugRepoName = team.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + suffix;

    // Check if repo already exists for this team
    const existingRepo = await GithubRepository.findOne({ teamId: team._id });
    if (existingRepo) {
      existingRepo.trackId = track._id;
      await existingRepo.save();
    } else {
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

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: team.eventId,
      actorId: req.user._id,
      action: 'assign_team_track',
      type: 'operation',
      details: `Phân đội ${team.name} vào bảng đấu ${track.name}`
    });
    await newLog.save();

    // Also ensure chat room is created if mentor exists
    await ensureChatRoomForTeam(team);

    res.json({
      message: `Đã phân đội ${team.name} vào bảng đấu ${track.name} thành công.`,
      team
    });

  } catch (error) {
    console.error('Assign Track Error:', error.message);
    res.status(500).json({ message: 'Server error during track assignment.' });
  }
});

/**
 * @route   GET /api/teams/:teamId
 * @desc    Get details of a single team by ID
 * @access  Private
 */
router.get('/:teamId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate('eventId', 'name semester year status contestEnd registrationClose')
      .populate({
        path: 'trackId',
        select: 'name description roundId',
        populate: {
          path: 'roundId',
          select: 'name driveFileName driveFileId startTime'
        }
      })
      .populate('mentorId', 'fullName email');

    if (!team) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin đội thi.' });
    }

    const members = await TeamMember.find({ teamId: team._id })
      .populate('userId', 'fullName email studentId githubUsername avatarUrl');

    const repo = await GithubRepository.findOne({ teamId: team._id });

    const teamObj = team.toObject();
    if (teamObj.trackId?.roundId) {
      const r = teamObj.trackId.roundId;
      teamObj.trackId.roundId = {
        _id: r._id,
        name: r.name,
        driveFileName: r.driveFileName,
        hasExamMaterial: !!r.driveFileId,
        startTime: r.startTime
      };
    }

    res.json({
      team: teamObj,
      members,
      repository: repo
    });
  } catch (error) {
    console.error('Fetch Single Team Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải thông tin chi tiết nhóm.' });
  }
});

/**
 * @route   PUT /api/teams/:teamId/assign-mentor
 * @desc    Assign a mentor to a specific team and ensure their chat room is created
 * @access  Private (Coordinator or Admin)
 */
router.put('/:teamId/assign-mentor', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { mentorId } = req.body; // Can be a User ID or null/empty to unassign

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
      if (!coordinatorRole) {
        return res.status(403).json({ message: 'Không có quyền truy cập. Yêu cầu vai trò Điều phối viên hoặc Quản trị viên.' });
      }
    }

    // If mentorId is provided, verify they are actually registered as a mentor for this track/event
    if (mentorId) {
      const User = mongoose.model('User');
      const mentor = await User.findById(mentorId);
      if (!mentor) return res.status(404).json({ message: 'Mentor không tồn tại.' });

      const mentorRole = await EventRole.findOne({
        userId: mentorId,
        eventId: team.eventId,
        role: 'mentor',
        status: 'active'
      });
      if (!mentorRole) {
        return res.status(400).json({ message: 'Người dùng được chọn không phải là Mentor của sự kiện này.' });
      }

      // Check if this mentor is already assigned to another team in this event
      const alreadyMentoring = await Team.findOne({
        eventId: team.eventId,
        mentorId: mentorId
      });
      if (alreadyMentoring && alreadyMentoring._id.toString() !== teamId.toString()) {
        return res.status(400).json({ message: `Mentor này đã được phân công quản lý một đội thi khác (${alreadyMentoring.name}) trong cuộc thi.` });
      }
    }

    team.mentorId = mentorId || undefined;
    await team.save();

    // If a mentor is assigned, ensure the chat room is created for them and this team
    if (mentorId) {
      const { ensureChatRoomForTeam } = require('../chat/chatRoomService');
      await ensureChatRoomForTeam(team);
    }

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    let logDetailsMsg = '';
    if (mentorId) {
      const User = mongoose.model('User');
      const mentorObj = await User.findById(mentorId);
      const mentorName = mentorObj ? mentorObj.fullName : mentorId;
      logDetailsMsg = `Gán Mentor "${mentorName}" cho đội thi "${team.name}"`;
    } else {
      logDetailsMsg = `Hủy gán Mentor của đội thi "${team.name}"`;
    }
    const newLog = new EventLog({
      eventId: team.eventId,
      actorId: req.user._id,
      action: mentorId ? 'assign_team_mentor' : 'unassign_team_mentor',
      type: 'operation',
      details: logDetailsMsg
    });
    await newLog.save();

    res.json({
      message: mentorId ? 'Đã gán Mentor cho đội thi thành công.' : 'Đã hủy gán Mentor cho đội thi.',
      team
    });

  } catch (error) {
    console.error('Assign Mentor Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi phân công Mentor.' });
  }
});

/**
 * @route   POST /api/teams/:teamId/sync-mqtt
 * @desc    Manually sync MQTT credentials for a team
 * @access  Private (Admin, Coordinator, or Team Leader)
 */
router.post('/:teamId/sync-mqtt', authenticateToken, async (req, res) => {
  const { teamId } = req.params;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Không tìm thấy đội thi.' });
    }

    // Auth check: System Admin, Coordinator of the event, or the team leader themselves
    let hasAccess = req.user.isSystemAdmin || team.leaderId.toString() === req.user._id.toString();
    if (!hasAccess) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: 'coordinator',
        status: 'active'
      });
      if (coordinatorRole) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
    }

    // Check if track and environmentId are present
    if (!team.trackId) {
      return res.status(400).json({ message: 'Đội thi chưa được phân vào bảng đấu.' });
    }

    const track = await Track.findById(team.trackId);
    if (!track || !track.environmentId) {
      return res.status(400).json({ message: 'Bảng đấu của đội thi chưa được cấu hình Environment ID.' });
    }

    // If already registered on external system, fetch latest credentials using code
    if (team.externalTeamCode) {
      try {
        const { fetchExternalKeys } = require('./externalTeamService');
        const result = await fetchExternalKeys(team.externalTeamCode);
        
        team.testApiKey = result.testApiKey || team.testApiKey || '';
        team.judgeApiKey = result.judgeApiKey || team.judgeApiKey || '';
        team.mqttUsername = result.mqttUsername || team.mqttUsername || '';
        team.mqttPassword = result.mqttPassword || team.mqttPassword || '';
        team.testTopic = result.testTopic || team.testTopic || `hackathon/${team.externalTeamCode.toLowerCase()}/test/telemetry`;
        team.judgeTopic = result.judgeTopic || team.judgeTopic || `hackathon/${team.externalTeamCode.toLowerCase()}/judge/telemetry`;
        await team.save();

        return res.json({
          message: 'Đồng bộ khóa MQTT thành công từ hệ thống simulator!',
          team
        });
      } catch (err) {
        console.error('[MQTT SERVICE] fetch keys error during manual sync:', err.message);
        return res.status(502).json({
          message: `Không thể đồng bộ khóa từ simulator: ${err.message}`
        });
      }
    } else {
      // Not registered yet, register now
      let baseCode = generateTeamCode(team.name);
      if (!baseCode) {
        baseCode = `TEAM_${team._id.toString().substring(18).toUpperCase()}`;
      }

      let code = baseCode;
      let syncSuccess = false;
      let result = null;
      let attempts = 0;

      while (!syncSuccess && attempts < 3) {
        try {
          attempts++;
          const { createExternalTeam } = require('./externalTeamService');
          result = await createExternalTeam(code, team.name, track.environmentId);
          syncSuccess = true;
        } catch (err) {
          if (err.code === 'TEAM_CODE_EXISTS' && attempts < 3) {
            const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
            code = `${baseCode}_${suffix}`;
          } else {
            console.error('[MQTT SERVICE] create team error during manual sync:', err.message);
            return res.status(err.status || 500).json({
              message: `Lỗi kết nối simulator: ${err.message}`
            });
          }
        }
      }

      if (result) {
        team.externalTeamId = result.team?.id || '';
        team.externalTeamCode = code;
        team.accessCode = result.accessCode || '';
        team.testApiKey = result.testApiKey || '';
        team.judgeApiKey = result.judgeApiKey || '';
        team.mqttUsername = result.mqttUsername || '';
        team.mqttPassword = result.mqttPassword || '';
        team.testTopic = `hackathon/${code.toLowerCase()}/test/telemetry`;
        team.judgeTopic = `hackathon/${code.toLowerCase()}/judge/telemetry`;
        await team.save();

        return res.json({
          message: 'Đăng ký và khởi tạo khóa MQTT thành công từ hệ thống simulator!',
          team
        });
      }
    }
  } catch (error) {
    console.error('Manual Sync Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi đồng bộ khóa MQTT.' });
  }
});

/**
 * @route   PATCH /api/teams/:teamId/judge
 * @desc    Toggle active status of the judge environment for a team
 * @access  Private (System Admin or Event Judge/Coordinator)
 */
router.patch('/:teamId/judge', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { active } = req.body;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Không tìm thấy đội thi.' });
    }

    if (!team.externalTeamId) {
      return res.status(400).json({ message: 'Đội thi chưa được đồng bộ với hệ thống Simulator.' });
    }

    // Auth check: System Admin, or Event Coordinator/Judge
    let hasAccess = req.user.isSystemAdmin;
    if (!hasAccess) {
      const role = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ['coordinator', 'judge'] },
        status: 'active'
      });
      if (role) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
    }

    const { toggleJudgeActive } = require('./externalTeamService');
    await toggleJudgeActive(team.externalTeamId, active);

    // Emit real-time status change to team members and live room
    try {
      const socketModule = require('../chat/socket');
      const io = socketModule.getIO();
      
      // Emit to live room (for judges/admins)
      io.to(`live:${team.eventId}`).emit('judge_active_toggled', {
        teamId: team._id.toString(),
        isJudgeActive: active,
        judgeApiKey: active ? team.judgeApiKey : null,
        judgeTopic: active ? team.judgeTopic : null
      });

      // Emit to each team member
      const TeamMember = mongoose.model('TeamMember');
      const members = await TeamMember.find({ teamId: team._id });
      for (const member of members) {
        if (member.userId) {
          io.to(`user:${member.userId.toString()}`).emit('judge_active_toggled', {
            teamId: team._id.toString(),
            isJudgeActive: active,
            judgeApiKey: active ? team.judgeApiKey : null,
            judgeTopic: active ? team.judgeTopic : null
          });
        }
      }

      // If we activated this team, notify other teams in the same track that they are deactivated
      if (active) {
        const otherTeams = await Team.find({
          trackId: team.trackId,
          _id: { $ne: team._id }
        });
        for (const other of otherTeams) {
          io.to(`live:${team.eventId}`).emit('judge_active_toggled', {
            teamId: other._id.toString(),
            isJudgeActive: false,
            judgeApiKey: null,
            judgeTopic: null
          });

          // Also notify team members of other teams
          const otherMembers = await TeamMember.find({ teamId: other._id });
          for (const member of otherMembers) {
            if (member.userId) {
              io.to(`user:${member.userId.toString()}`).emit('judge_active_toggled', {
                teamId: other._id.toString(),
                isJudgeActive: false,
                judgeApiKey: null,
                judgeTopic: null
              });
            }
          }
        }
      }
    } catch (socketErr) {
      console.warn('Socket emit judge_active_toggled failed:', socketErr.message);
    }

    res.json({ message: active ? 'Đã bật môi trường chấm thi.' : 'Đã tắt môi trường chấm thi.' });
  } catch (error) {
    console.error('Toggle Judge Active Error:', error.message);
    res.status(error.status || 500).json({ message: `Lỗi kết nối simulator: ${error.message}` });
  }
});

/**
 * @route   PATCH /api/teams/:teamId/judge-scenario
 * @desc    Update judge scenario for a team
 * @access  Private (System Admin or Event Judge/Coordinator)
 */
router.patch('/:teamId/judge-scenario', authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { scenario } = req.body;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Không tìm thấy đội thi.' });
    }

    if (!team.externalTeamId) {
      return res.status(400).json({ message: 'Đội thi chưa được đồng bộ với hệ thống Simulator.' });
    }

    // Auth check: System Admin, or Event Coordinator/Judge
    let hasAccess = req.user.isSystemAdmin;
    if (!hasAccess) {
      const role = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ['coordinator', 'judge'] },
        status: 'active'
      });
      if (role) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
    }

    const { updateJudgeScenario } = require('./externalTeamService');
    await updateJudgeScenario(team.externalTeamId, scenario);

    res.json({ message: 'Đã cập nhật kịch bản chấm thi.' });
  } catch (error) {
    console.error('Update Judge Scenario Error:', error.message);
    res.status(error.status || 500).json({ message: `Lỗi kết nối simulator: ${error.message}` });
  }
});

/**
 * @route   GET /api/teams/judge/scenarios
 * @desc    Get all judge scenarios
 * @access  Private (System Admin or Event Judge/Coordinator)
 */
router.get('/judge/scenarios', authenticateToken, async (req, res) => {
  try {
    const { getJudgeScenarios } = require('./externalTeamService');
    const result = await getJudgeScenarios();
    res.json(result);
  } catch (error) {
    console.error('Get Judge Scenarios Error:', error.message);
    res.status(error.status || 500).json({ message: `Lỗi kết nối simulator: ${error.message}` });
  }
});

/**
 * @route   GET /api/teams/judge/live
 * @desc    Get live sensors data
 * @access  Private (System Admin or Event Judge/Coordinator)
 */
router.get('/judge/live', authenticateToken, async (req, res) => {
  const { teamId } = req.query;
  if (!teamId) {
    return res.status(400).json({ message: 'Thiếu tham số teamId.' });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team || !team.externalTeamId) {
      return res.status(404).json({ message: 'Đội thi chưa được đồng bộ hoặc không tồn tại.' });
    }

    const { getJudgeLive } = require('./externalTeamService');
    const result = await getJudgeLive(team.externalTeamId);
    res.json(result);
  } catch (error) {
    console.error('Get Judge Live Error:', error.message);
    res.status(error.status || 500).json({ message: `Lỗi kết nối simulator: ${error.message}` });
  }
});

module.exports = router;
