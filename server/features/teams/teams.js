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
const { authenticateToken } = require('../auth/authMiddleware');
const { addEmailJob, addInAppJob, isQueueAvailable } = require('../notifications/notificationQueue');

/**
 * @route   POST /api/teams/register
 * @desc    Register a team and invite members
 * @access  Private (Participants)
 */
router.post('/register', authenticateToken, async (req, res) => {
  const { eventId, trackId, teamName, membersList, leaderInfo } = req.body;

  if (!eventId || !teamName || !membersList || !Array.isArray(membersList)) {
    return res.status(400).json({ message: 'Đã xảy ra lỗi trong quá trình đăng ký.' });
  }

  let createdTeamId = null;
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

    // 2. Validate that team name is unique inside the event
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
      return res.status(404).json({ message: 'Bạn hiện không ở trong bất kỳ nhóm nào đã được xác nhận và đang hoạt động.' });
    }

    const members = await TeamMember.find({ teamId: team._id })
      .populate('userId', 'fullName email studentId githubUsername avatarUrl university');

    const repo = await GithubRepository.findOne({ teamId: team._id });

    res.json({
      team,
      members,
      repository: repo
    });

  } catch (error) {
    console.error('Fetch My Team Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải thông tin nhóm.' });
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
    let query = { eventId: req.params.eventId };

    if (!req.user.isSystemAdmin) {
      const roundId = req.query.roundId;
      let userRole = null;

      if (roundId) {
        userRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: req.params.eventId,
          roundId: roundId,
          status: 'active'
        });
      }

      if (!userRole) {
        userRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: req.params.eventId,
          $or: [{ roundId: null }, { roundId: { $exists: false } }],
          status: 'active'
        });
      }

      if (userRole && (userRole.role === 'judge' || userRole.role === 'mentor' || userRole.role === 'coordinator') && userRole.trackId) {
        query.trackId = userRole.trackId;
      } else if (!userRole) {
        return res.json([]); // No active role in this event/round, return empty
      }
    }

    const teams = await Team.find(query)
      .populate('trackId', 'name')
      .populate('leaderId', 'fullName email');

    const detailedTeams = await Promise.all(teams.map(async (t) => {
      const members = await TeamMember.find({ teamId: t._id }).populate('userId', 'fullName email studentId university githubUsername confirmStatus');
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
      .populate('trackId', 'name attachments')
      .populate('leaderId', 'fullName email')
      .populate('eventId', 'name status');

    if (!team) {
      return res.status(404).json({ message: 'Không tìm thấy đội thi.' });
    }

    // Verify track permissions for judges
    if (!req.user.isSystemAdmin) {
      const userRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ['judge', 'mentor', 'coordinator'] },
        status: 'active',
        $or: [{ trackId: team.trackId }, { trackId: null }, { trackId: { $exists: false } }]
      });

      if (!userRole) {
        return res.status(403).json({ message: 'Bạn không có quyền truy cập thông tin của đội thi thuộc bảng đấu khác.' });
      }
    }

    const members = await TeamMember.find({ teamId: team._id })
      .populate('userId', 'fullName email studentId university githubUsername confirmStatus');

    const repo = await GithubRepository.findOne({ teamId: team._id });

    const responseData = {
      ...team.toObject(),
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

/**
 * @route   GET /api/teams/:teamId
 * @desc    Get details of a single team by ID
 * @access  Private
 */
router.get('/:teamId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate('eventId', 'name semester year status')
      .populate('trackId', 'name description');

    if (!team) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin đội thi.' });
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
    console.error('Fetch Single Team Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải thông tin chi tiết nhóm.' });
  }
});

module.exports = router;
