const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');

const User = mongoose.model('User');
const EventRole = mongoose.model('EventRole');
const { authenticateToken, requireSystemAdmin } = require('./authMiddleware');
const emailService = require('../notifications/emailService');
const { addEmailJob, isQueueAvailable } = require('../notifications/notificationQueue');

const JWT_SECRET = process.env.JWT_SECRET || 'seal_hackathon_secret_key_2026';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { email, password, fullName, studentId, university, githubUsername } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ message: 'Email, mật khẩu và họ tên là bắt buộc.' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Tài khoản với email này đã tồn tại.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user. First user registered is auto system admin for testing ease.
    const isFirstUser = (await User.countDocuments({})) === 0;
    
    // Generate verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const user = new User({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      studentId,
      university,
      githubUsername,
      isSystemAdmin: isFirstUser,
      isApproved: isFirstUser, // Auto-approve only the first user (system admin)
      emailVerificationToken,
      emailVerificationTokenExpiry
    });

    await user.save();

    if (!isFirstUser) {
      // Send verification email via queue (non-blocking, with retry)
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const verifyLink = `${backendUrl}/api/auth/verify-email?token=${emailVerificationToken}`;
      if (isQueueAvailable()) {
        addEmailJob({
          type: 'email_verify',
          email: user.email,
          fullName: user.fullName,
          verifyLink,
        }).catch(err => console.error(`[QUEUE] Failed to enqueue email verification for ${user.email}:`, err.message));
      } else {
        // Fallback: synchronous
        emailService.sendEmailVerification(user.email, user.fullName, verifyLink)
          .catch(err => console.error(`[FALLBACK] Failed to send email verification to ${user.email}:`, err.message));
      }

      return res.status(201).json({
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.',
        requiresVerification: true
      });
    }

    // First user is auto-logged in
    const activeSessionId = crypto.randomBytes(16).toString('hex');
    user.activeSessionId = activeSessionId;
    user.lastActiveAt = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id, sessionId: activeSessionId }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'Đăng ký thành công!',
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isSystemAdmin: user.isSystemAdmin,
        githubUsername: user.githubUsername
      }
    });

  } catch (error) {
    console.error('Registration Error:', error.message);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user & return token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập cả email và mật khẩu.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Thông tin đăng nhập không chính xác.' });
    }

    // Check if user is locked / deactivated
    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.',
        isDeactivated: true 
      });
    }

    // Check if user is approved (email verified)
    if (!user.isApproved) {
      return res.status(403).json({ 
        message: 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email của bạn để xác thực tài khoản.',
        requiresVerification: true 
      });
    }

    // Match password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Thông tin đăng nhập không chính xác.' });
    }

    // Check session concurrency: if user has active session and heartbeat is fresh (< 90 seconds)
    if (!req.body.force && user.activeSessionId && user.lastActiveAt && (Date.now() - new Date(user.lastActiveAt).getTime() < 90000)) {
      return res.status(409).json({ 
        message: 'Tài khoản này đang được đăng nhập ở nơi khác. Vui lòng đăng xuất ở thiết bị cũ.',
        code: 'ACTIVE_SESSION_EXISTS'
      });
    }

    // Generate session ID
    const activeSessionId = crypto.randomBytes(16).toString('hex');
    user.activeSessionId = activeSessionId;
    user.lastActiveAt = new Date();
    await user.save();

    // Get event roles
    const roles = await EventRole.find({ userId: user._id, status: 'active' }).populate('eventId', 'name semester year');

    // Generate JWT (including sessionId)
    const token = jwt.sign({ id: user._id, sessionId: activeSessionId }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isSystemAdmin: user.isSystemAdmin,
        githubUsername: user.githubUsername,
        avatarUrl: user.avatarUrl
      },
      roles: roles.map(r => ({
        id: r._id,
        eventId: r.eventId ? r.eventId._id : null,
        eventName: r.eventId ? `${r.eventId.name} (${r.eventId.semester} ${r.eventId.year})` : 'System',
        role: r.role,
        trackId: r.trackId
      }))
    });

  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user details & context-specific roles
 * @access  Private
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const roles = await EventRole.find({ userId: req.user._id, status: 'active' }).populate('eventId', 'name semester year');
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email,
        fullName: req.user.fullName,
        studentId: req.user.studentId,
        university: req.user.university,
        githubUsername: req.user.githubUsername,
        isSystemAdmin: req.user.isSystemAdmin
      },
      roles: roles.map(r => ({
        id: r._id,
        eventId: r.eventId ? r.eventId._id : null,
        eventName: r.eventId ? `${r.eventId.name} (${r.eventId.semester} ${r.eventId.year})` : 'System',
        role: r.role,
        trackId: r.trackId
      }))
    });
  } catch (error) {
    console.error('Fetch Profile Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving profile.' });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user profile details
 * @access  Private
 */
router.put('/profile', authenticateToken, async (req, res) => {
  const { fullName, studentId, university, githubUsername } = req.body;

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ message: 'Họ tên là bắt buộc.' });
  }

  try {
    const user = req.user;
    user.fullName = fullName.trim();
    user.studentId = studentId ? studentId.trim() : undefined;
    user.university = university ? university.trim() : undefined;
    user.githubUsername = githubUsername ? githubUsername.trim() : undefined;

    await user.save();

    const roles = await EventRole.find({ userId: user._id, status: 'active' }).populate('eventId', 'name semester year');

    res.json({
      message: 'Cập nhật thông tin cá nhân thành công!',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        studentId: user.studentId,
        university: user.university,
        githubUsername: user.githubUsername,
        isSystemAdmin: user.isSystemAdmin,
        avatarUrl: user.avatarUrl
      },
      roles: roles.map(r => ({
        id: r._id,
        eventId: r.eventId ? r.eventId._id : null,
        eventName: r.eventId ? `${r.eventId.name} (${r.eventId.semester} ${r.eventId.year})` : 'System',
        role: r.role,
        trackId: r.trackId
      }))
    });
  } catch (error) {
    console.error('Update Profile Error:', error.message);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
});

/**
 * @route   POST /api/auth/assign-role
 * @desc    Assign event role to a user (System Admin only)
 * @access  Private (System Admin)
 */
router.post('/assign-role', authenticateToken, requireSystemAdmin, async (req, res) => {
  const { userEmail, eventId, trackId, role, teamId } = req.body;

  if (!userEmail || !eventId || !role) {
    return res.status(400).json({ message: 'User email, event ID, and role are required.' });
  }

  try {
    let targetUser = await User.findOne({ email: userEmail.toLowerCase() });
    if (!targetUser) {
      if (role === 'judge') {
        const defaultPassword = 'password123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(defaultPassword, salt);
        
        targetUser = new User({
          email: userEmail.toLowerCase(),
          passwordHash,
          fullName: userEmail.split('@')[0],
          isApproved: true,
          isActive: true
        });
        await targetUser.save();

        try {
          const emailService = require('../notifications/emailService');
          await emailService.sendAccountProvisionEmail(targetUser.email, targetUser.fullName, defaultPassword, 'Giám khảo');
        } catch (emailErr) {
          console.error('Failed to send auto-created judge email:', emailErr.message);
        }
      } else {
        return res.status(404).json({ message: 'Tài khoản người dùng này chưa tồn tại trong hệ thống. Vui lòng tạo tài khoản trước.' });
      }
    }

    // Resolve roundId if trackId is provided
    let resolvedRoundId = undefined;
    if (trackId) {
      const Track = mongoose.model('Track');
      const track = await Track.findById(trackId);
      if (track) {
        resolvedRoundId = track.roundId;
      }
    }

    // Delete existing duplicate role to prevent duplicate key error
    await EventRole.deleteOne({
      userId: targetUser._id,
      eventId,
      trackId: trackId || undefined,
      roundId: resolvedRoundId,
      role
    });

    const newRole = new EventRole({
      userId: targetUser._id,
      eventId,
      trackId: trackId || undefined,
      roundId: resolvedRoundId,
      role,
      assignedBy: req.user._id
    });

    await newRole.save();

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    let roleDetails = `Gán vai trò "${role}" cho người dùng ${userEmail}`;
    if (trackId) {
      const Track = mongoose.model('Track');
      const track = await Track.findById(trackId);
      if (track) {
        roleDetails += ` tại bảng đấu: "${track.name}"`;
      }
    }
    if (teamId) {
      const Team = mongoose.model('Team');
      const team = await Team.findById(teamId);
      if (team) {
        roleDetails += ` của đội thi: "${team.name}"`;
      }
    }
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'assign_role',
      type: 'operation',
      details: roleDetails
    });
    await newLog.save();

    // If role is mentor and teamId is specified, assign mentor to team and ensure chat room
    if (role === 'mentor' && teamId) {
      const Team = mongoose.model('Team');
      
      // Check if this mentor is already assigned to another team in this event
      const alreadyMentoring = await Team.findOne({
        eventId,
        mentorId: targetUser._id
      });
      if (alreadyMentoring && alreadyMentoring._id.toString() !== teamId.toString()) {
        return res.status(400).json({ message: `Mentor này đã được phân công quản lý một đội thi khác (${alreadyMentoring.name}) trong cuộc thi.` });
      }

      const team = await Team.findById(teamId);
      if (team) {
        team.mentorId = targetUser._id;
        await team.save();

        const { ensureChatRoomForTeam } = require('../chat/chatRoomService');
        await ensureChatRoomForTeam(team);
      }
    } else if (role === 'mentor' && trackId && !teamId) {
      try {
        const { ensureChatRoomsForMentorTrack } = require('../chat/chatRoomService');
        await ensureChatRoomsForMentorTrack(targetUser._id, trackId, eventId);
      } catch (chatErr) {
        console.error('Error creating chat rooms for mentor on assignment:', chatErr.message);
      }
    }

    // Ensure track-wide mentor group chat room is created/updated
    if (role === 'mentor' && trackId) {
      try {
        const { ensureTrackMentorChatRoom } = require('../chat/chatRoomService');
        await ensureTrackMentorChatRoom(trackId, eventId);
      } catch (chatErr) {
        console.error('Error creating track mentor group chat:', chatErr.message);
      }
    }

    res.status(201).json({ message: `Successfully assigned role ${role} to ${userEmail}.` });

  } catch (error) {
    console.error('Assign Role Error:', error.message);
    res.status(500).json({ message: 'Server error assigning role.' });
  }
});

/**
 * @route   POST /api/auth/google
 * @desc    Login or Register with Google Account
 * @access  Public
 */
router.post('/google', async (req, res) => {
  const { idToken, email, fullName, isMock } = req.body;

  let userEmail = email;
  let userName = fullName;
  let userAvatar = '';

  if (isMock || !idToken) {
    // Mock simulation flow
    if (!userEmail) {
      return res.status(400).json({ message: 'Email is required for Google Sign-in.' });
    }
    userName = userName || userEmail.split('@')[0];
  } else {
    try {
      // Real flow: verify token with Google API
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      if (!googleRes.ok) {
        return res.status(400).json({ message: 'Invalid Google token.' });
      }
      const payload = await googleRes.json();
      userEmail = payload.email;
      userName = payload.name || payload.email.split('@')[0];
      userAvatar = payload.picture;
    } catch (err) {
      console.error('Google Auth Error:', err.message);
      return res.status(500).json({ message: 'Error verifying Google account.' });
    }
  }

  try {
    let user = await User.findOne({ email: userEmail.toLowerCase() });
    const isNewUser = !user;

    if (!user) {
      // Register new user via Google
      const salt = await bcrypt.genSalt(10);
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, salt);
      
      const isFirstUser = (await User.countDocuments({})) === 0;

      user = new User({
        email: userEmail.toLowerCase(),
        passwordHash,
        fullName: userName,
        avatarUrl: userAvatar,
        isSystemAdmin: isFirstUser,
        isApproved: true
      });
      await user.save();
    } else if (userAvatar && !user.avatarUrl) {
      user.avatarUrl = userAvatar;
      await user.save();
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.',
        isDeactivated: true 
      });
    }

    // Check session concurrency
    if (!req.body.force && user.activeSessionId && user.lastActiveAt && (Date.now() - new Date(user.lastActiveAt).getTime() < 90000)) {
      return res.status(409).json({ 
        message: 'Tài khoản này đang được đăng nhập ở nơi khác. Vui lòng đăng xuất ở thiết bị cũ.',
        code: 'ACTIVE_SESSION_EXISTS'
      });
    }

    // Generate session ID
    const activeSessionId = crypto.randomBytes(16).toString('hex');
    user.activeSessionId = activeSessionId;
    user.lastActiveAt = new Date();
    await user.save();

    const roles = await EventRole.find({ userId: user._id, status: 'active' }).populate('eventId', 'name semester year');
    const token = jwt.sign({ id: user._id, sessionId: activeSessionId }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      isNewUser,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isSystemAdmin: user.isSystemAdmin,
        githubUsername: user.githubUsername,
        avatarUrl: user.avatarUrl
      },
      roles: roles.map(r => ({
        id: r._id,
        eventId: r.eventId ? r.eventId._id : null,
        eventName: r.eventId ? `${r.eventId.name} (${r.eventId.semester} ${r.eventId.year})` : 'System',
        role: r.role,
        trackId: r.trackId
      }))
    });

  } catch (error) {
    console.error('Google Login DB Error:', error.message);
    res.status(500).json({ message: 'Server error processing Google account.' });
  }
});

/**
 * @route   POST /api/auth/github
 * @desc    Login or Register with GitHub Account
 * @access  Public
 */
router.post('/github', async (req, res) => {
  const { accessToken, code, redirectUri, email, fullName, githubUsername, isMock } = req.body;

  let userEmail = email;
  let userName = fullName;
  let userGithub = githubUsername;
  let userAvatar = '';
  let currentToken = accessToken;

  if (!isMock && code) {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23liz8uHIFRtgdwDwE';
      const clientSecret = process.env.GITHUB_CLIENT_SECRET || 'eb9a526811f9bc9b70b5ec1042974aa5e3c55df9';

      const exchangeBody = {
        client_id: clientId,
        client_secret: clientSecret,
        code
      };
      if (redirectUri) {
        exchangeBody.redirect_uri = redirectUri;
      }

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(exchangeBody)
      });

      if (!tokenRes.ok) {
        return res.status(400).json({ message: 'Failed to exchange GitHub authorization code.' });
      }

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return res.status(400).json({ message: tokenData.error_description || 'GitHub OAuth authorization failed.' });
      }

      currentToken = tokenData.access_token;
    } catch (err) {
      console.error('GitHub Code Exchange Error:', err.message);
      return res.status(500).json({ message: 'Server error during GitHub code exchange.' });
    }
  }

  if (isMock || !currentToken) {
    // Mock simulation flow
    if (!userEmail) {
      return res.status(400).json({ message: 'Email is required for GitHub Sign-in.' });
    }
    userName = userName || userEmail.split('@')[0];
    userGithub = userGithub || userName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  } else {
    try {
      // Real flow: fetch user profile from GitHub API using currentToken
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${currentToken}`,
          'Accept': 'application/json',
          'User-Agent': 'SEAL-Hackathon'
        }
      });
      if (!userRes.ok) {
        return res.status(400).json({ message: 'Invalid GitHub access token.' });
      }
      const profile = await userRes.json();
      
      // Fetch primary email if public email is not set
      let emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${currentToken}`,
          'Accept': 'application/json',
          'User-Agent': 'SEAL-Hackathon'
        }
      });
      let primaryEmail = profile.email;
      if (emailRes.ok) {
        const emails = await emailRes.json();
        const primary = emails.find(e => e.primary);
        if (primary) primaryEmail = primary.email;
      }

      userEmail = primaryEmail || profile.email;
      if (!userEmail) {
        return res.status(400).json({ message: 'Could not retrieve email from GitHub. Please set a public email on GitHub.' });
      }

      userName = profile.name || profile.login;
      userGithub = profile.login;
      userAvatar = profile.avatar_url;
    } catch (err) {
      console.error('GitHub Auth Error:', err.message);
      return res.status(500).json({ message: 'Error verifying GitHub account.' });
    }
  }

  try {
    let user = await User.findOne({ email: userEmail.toLowerCase() });
    const isNewUser = !user;

    if (!user) {
      // Register new user via GitHub
      const salt = await bcrypt.genSalt(10);
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      const isFirstUser = (await User.countDocuments({})) === 0;

      user = new User({
        email: userEmail.toLowerCase(),
        passwordHash,
        fullName: userName,
        githubUsername: userGithub,
        avatarUrl: userAvatar,
        isSystemAdmin: isFirstUser,
        isApproved: true
      });
      await user.save();
    } else {
      let updated = false;
      if (!user.githubUsername) {
        user.githubUsername = userGithub;
        updated = true;
      }
      if (userAvatar && !user.avatarUrl) {
        user.avatarUrl = userAvatar;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.',
        isDeactivated: true 
      });
    }

    // Check session concurrency
    if (!req.body.force && user.activeSessionId && user.lastActiveAt && (Date.now() - new Date(user.lastActiveAt).getTime() < 90000)) {
      return res.status(409).json({ 
        message: 'Tài khoản này đang được đăng nhập ở nơi khác. Vui lòng đăng xuất ở thiết bị cũ.',
        code: 'ACTIVE_SESSION_EXISTS'
      });
    }

    // Generate session ID
    const activeSessionId = crypto.randomBytes(16).toString('hex');
    user.activeSessionId = activeSessionId;
    user.lastActiveAt = new Date();
    await user.save();

    const roles = await EventRole.find({ userId: user._id, status: 'active' }).populate('eventId', 'name semester year');
    const token = jwt.sign({ id: user._id, sessionId: activeSessionId }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      isNewUser,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isSystemAdmin: user.isSystemAdmin,
        githubUsername: user.githubUsername,
        avatarUrl: user.avatarUrl
      },
      roles: roles.map(r => ({
        id: r._id,
        eventId: r.eventId ? r.eventId._id : null,
        eventName: r.eventId ? `${r.eventId.name} (${r.eventId.semester} ${r.eventId.year})` : 'System',
        role: r.role,
        trackId: r.trackId
      }))
    });

  } catch (error) {
    console.error('GitHub Login DB Error:', error.message);
    res.status(500).json({ message: 'Server error processing GitHub account.' });
  }
});

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify email token and approve user account
 * @access  Public
 */
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'https://www.seal-hackathon.io.vn';

  if (!token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html class="dark" lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEAL HACKATHON // ACTIVATION ERROR</title>
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
          <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[PROTOCOL_ACTIVATION_FAILED]</div>
          <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">MÃ XÁC THỰC RỖNG</h1>
          <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Không tìm thấy mã xác thực (token) trong yêu cầu kích hoạt tài khoản của bạn.</p>
          <a href="${clientUrl}/login" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">QUAY LẠI TRANG ĐĂNG NHẬP</a>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html class="dark" lang="vi">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SEAL HACKATHON // ACTIVATION ERROR</title>
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
            <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[PROTOCOL_ACTIVATION_FAILED]</div>
            <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">LIÊN KẾT HẾT HẠN</h1>
            <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Mã xác thực không hợp lệ hoặc đường link kích hoạt của bạn đã hết hạn (24 giờ). Vui lòng thử đăng ký lại.</p>
            <a href="${clientUrl}/login" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">QUAY LẠI TRANG ĐĂNG NHẬP</a>
          </div>
        </body>
        </html>
      `);
    }

    // Approve the account
    user.isApproved = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiry = undefined;
    await user.save();

    res.send(`
      <!DOCTYPE html>
      <html class="dark" lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEAL HACKATHON // NODE ACTIVATED</title>
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
          <div class="inline-flex border border-[#00f0ff] px-3 py-1 text-xs font-mono text-[#00f0ff] mb-6 bg-[#00f0ff]/5 uppercase tracking-widest rounded">[PROTOCOL_ACTIVATION_SUCCESS]</div>
          <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-[#00f0ff] flex items-center justify-center bg-[#00f0ff]/10 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
            <svg class="w-10 h-10 text-[#00f0ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">NODE_ACTIVATED</h1>
          <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Xin chúc mừng! Tài khoản của bạn đã được kích hoạt thành công trên hệ thống SEAL Hackathon. Khóa bảo mật đã được đồng bộ.</p>
          <a href="${clientUrl}/login" class="inline-block w-full py-3 border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff] hover:text-[#0a141d] font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(0,240,255,0.1)] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]">ĐĂNG NHẬP NGAY</a>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Email Verification Route Error:', error.message);
    res.status(500).send('Server error during email verification.');
  }
});

/**
 * @route   GET /api/auth/test-email
 * @desc    Diagnose SMTP connection and credentials on the live server
 * @access  Public (For debugging)
 */
router.get('/test-email', async (req, res) => {
  const config = {
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  };

  const logs = [];

  try {
    logs.push(`Initiating E2E email diagnostics through emailService...`);
    let emailTo = req.query.to || 'sealhackathonfpt@gmail.com';
    if (!req.query.to && process.env.EMAIL_USER && process.env.EMAIL_USER.includes('@')) {
      emailTo = process.env.EMAIL_USER;
    }
    logs.push(`Target recipient: ${emailTo}`);
    
    // Call emailService directly (this will route via Brevo HTTP API or standard SMTP depending on key prefix)
    const success = await emailService.sendEmailVerification(
      emailTo, 
      'SEAL Debugger', 
      'https://seal-management-system.onrender.com/api/auth/verify-email?token=test-diagnostics'
    );
    
    if (!success) {
      throw new Error('emailService returned false');
    }
    
    logs.push(`✅ emailService reported success!`);

    res.json({
      status: 'success',
      message: 'SMTP/API mail delivery is fully functional!',
      configUsed: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.auth.user,
        passMasked: config.auth.pass ? `${config.auth.pass.substring(0, 4)}***` : 'None'
      },
      diagnosticLogs: logs
    });

  } catch (error) {
    logs.push(`❌ ERROR ENCOUNTERED: ${error.message}`);
    res.status(500).json({
      status: 'failed',
      message: 'SMTP/API Diagnostics failed. See logs below.',
      errorDetails: {
        message: error.message,
        stack: error.stack
      },
      configUsed: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.auth.user,
        passMasked: config.auth.pass ? `${config.auth.pass.substring(0, 4)}***` : 'None'
      },
      diagnosticLogs: logs
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user & invalidate session
 * @access  Private
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    user.activeSessionId = null;
    user.lastActiveAt = null;
    await user.save();
    res.json({ message: 'Đăng xuất thành công!' });
  } catch (error) {
    console.error('Logout Error:', error.message);
    res.status(500).json({ message: 'Server error during logout.' });
  }
});

/**
 * @route   POST /api/auth/heartbeat
 * @desc    Keep session active
 * @access  Private
 */
router.post('/heartbeat', authenticateToken, async (req, res) => {
  try {
    res.json({ status: 'active' });
  } catch (error) {
    console.error('Heartbeat Error:', error.message);
    res.status(500).json({ message: 'Server error during heartbeat.' });
  }
});

/**
 * @route   GET /api/auth/users
 * @desc    Get all users for Admin management
 * @access  Private (System Admin only)
 */
router.get('/users', authenticateToken, requireSystemAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = { isSystemAdmin: { $ne: true } };
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }
    const users = await User.find(query).select('-passwordHash -emailVerificationToken').sort({ createdAt: -1 }).lean();
    
    // Populate event roles for each user
    const userIds = users.map(u => u._id);
    const roles = await EventRole.find({ userId: { $in: userIds }, status: 'active' }).populate('eventId', 'name semester year').lean();
    
    const usersWithRoles = users.map(u => {
      const userRoles = roles.filter(r => r.userId.toString() === u._id.toString());
      return {
        ...u,
        roles: userRoles
      };
    });

    res.json(usersWithRoles);
  } catch (error) {
    console.error('Get Users Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving users.' });
  }
});

/**
 * @route   POST /api/auth/users
 * @desc    Admin create new user
 * @access  Private (System Admin only)
 */
router.post('/users', authenticateToken, requireSystemAdmin, async (req, res) => {
  const { email, password, fullName, studentId, university, isSystemAdmin, isActive } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ message: 'Email, mật khẩu và họ tên là bắt buộc.' });
  }
  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Tài khoản với email này đã tồn tại.' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = new User({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      studentId: studentId || '',
      university: university || 'FPT University',
      isSystemAdmin: !!isSystemAdmin,
      isApproved: true,
      isActive: isActive !== undefined ? !!isActive : true
    });
    await newUser.save();

    res.status(201).json({ message: 'Tạo tài khoản người dùng thành công!', user: newUser });
  } catch (error) {
    console.error('Create User Error:', error.message);
    res.status(500).json({ message: 'Server error creating user.' });
  }
});

/**
 * @route   PUT /api/auth/users/:id
 * @desc    Admin update user details, permissions, or active status
 * @access  Private (System Admin only)
 */
router.put('/users/:id', authenticateToken, requireSystemAdmin, async (req, res) => {
  const { fullName, studentId, university, isSystemAdmin, isActive, password } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User không tồn tại.' });

    if (fullName !== undefined) user.fullName = fullName;
    if (studentId !== undefined) user.studentId = studentId;
    if (university !== undefined) user.university = university;
    if (isSystemAdmin !== undefined) user.isSystemAdmin = !!isSystemAdmin;
    if (isActive !== undefined) user.isActive = !!isActive;

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password.trim(), salt);
    }

    await user.save();
    res.json({ message: 'Cập nhật tài khoản người dùng thành công!', user });
  } catch (error) {
    console.error('Update User Error:', error.message);
    res.status(500).json({ message: 'Server error updating user.' });
  }
});

/**
 * @route   DELETE /api/auth/users/:id
 * @desc    Admin delete user
 * @access  Private (System Admin only)
 */
router.delete('/users/:id', authenticateToken, requireSystemAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Không thể tự xóa tài khoản Admin đang đăng nhập!' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User không tồn tại.' });
    res.json({ message: 'Đã xóa tài khoản người dùng thành công!' });
  } catch (error) {
    console.error('Delete User Error:', error.message);
    res.status(500).json({ message: 'Server error deleting user.' });
  }
});

/**
 * @route   POST /api/auth/users/:id/toggle-coordinator
 * @desc    Toggle global coordinator role for user
 * @access  Private (System Admin only)
 */
router.post('/users/:id/toggle-coordinator', authenticateToken, requireSystemAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const existingRoles = await EventRole.find({ userId, role: 'coordinator', status: 'active' });
    const isCurrentlyCoordinator = existingRoles.length > 0;

    if (isCurrentlyCoordinator) {
      await EventRole.deleteMany({ userId, role: 'coordinator' });
      return res.json({ message: 'Đã thu hồi quyền Ban tổ chức (Coordinator)!', isCoordinator: false });
    } else {
      const Event = mongoose.model('Event');
      const events = await Event.find({});
      if (events.length > 0) {
        for (const ev of events) {
          await EventRole.updateOne(
            { userId, eventId: ev._id, role: 'coordinator' },
            { $set: { status: 'active', assignedBy: req.user._id } },
            { upsert: true }
          );
        }
      } else {
        // Dummy placeholder eventRole if no events exist yet
        await EventRole.create({
          userId,
          role: 'coordinator',
          assignedBy: req.user._id,
          status: 'active'
        });
      }
      return res.json({ message: 'Đã cấp quyền Ban tổ chức (Coordinator) thành công!', isCoordinator: true });
    }
  } catch (error) {
    console.error('Toggle Coordinator Error:', error.message);
    res.status(500).json({ message: 'Server error toggling coordinator role.' });
  }
});

router.post('/users/auto-provision', authenticateToken, requireSystemAdmin, async (req, res) => {
  try {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const judgeEmail = `judge.auto_${randomSuffix}@seal.com`;
    const mentorEmail = `mentor.auto_${randomSuffix}@seal.com`;
    const defaultPassword = 'password123';

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // Create Judge User
    const judgeUser = new User({
      email: judgeEmail,
      passwordHash,
      fullName: `Auto Judge ${randomSuffix.toUpperCase()}`,
      isApproved: true,
      isActive: true
    });
    await judgeUser.save();

    // Create Mentor User
    const mentorUser = new User({
      email: mentorEmail,
      passwordHash,
      fullName: `Auto Mentor ${randomSuffix.toUpperCase()}`,
      isApproved: true,
      isActive: true
    });
    await mentorUser.save();

    // Assign roles for all events or a placeholder
    const Event = mongoose.model('Event');
    const events = await Event.find({});
    if (events.length > 0) {
      for (const ev of events) {
        // Assign judge
        await EventRole.updateOne(
          { userId: judgeUser._id, eventId: ev._id, role: 'judge' },
          { $set: { status: 'active', assignedBy: req.user._id } },
          { upsert: true }
        );
        // Assign mentor
        await EventRole.updateOne(
          { userId: mentorUser._id, eventId: ev._id, role: 'mentor' },
          { $set: { status: 'active', assignedBy: req.user._id } },
          { upsert: true }
        );
      }
    } else {
      // Dummy placeholders
      await EventRole.create({
        userId: judgeUser._id,
        role: 'judge',
        assignedBy: req.user._id,
        status: 'active'
      });
      await EventRole.create({
        userId: mentorUser._id,
        role: 'mentor',
        assignedBy: req.user._id,
        status: 'active'
      });
    }

    res.status(201).json({
      message: 'Tự động tạo tài khoản Judge & Mentor thành công!',
      judge: { email: judgeEmail, password: defaultPassword, fullName: judgeUser.fullName },
      mentor: { email: mentorEmail, password: defaultPassword, fullName: mentorUser.fullName }
    });
  } catch (error) {
    console.error('Auto Provision Error:', error.message);
    res.status(500).json({ message: 'Server error during auto-provisioning.' });
  }
});

router.post('/users/:id/toggle-judge', authenticateToken, requireSystemAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const existingRoles = await EventRole.find({ userId, role: 'judge', status: 'active' });
    const isCurrentlyJudge = existingRoles.length > 0;

    if (isCurrentlyJudge) {
      await EventRole.deleteMany({ userId, role: 'judge' });
      return res.json({ message: 'Đã thu hồi quyền Giám khảo (Judge)!', isJudge: false });
    } else {
      const Event = mongoose.model('Event');
      const events = await Event.find({});
      if (events.length > 0) {
        for (const ev of events) {
          await EventRole.updateOne(
            { userId, eventId: ev._id, role: 'judge' },
            { $set: { status: 'active', assignedBy: req.user._id } },
            { upsert: true }
          );
        }
      } else {
        await EventRole.create({
          userId,
          role: 'judge',
          assignedBy: req.user._id,
          status: 'active'
        });
      }
      return res.json({ message: 'Đã cấp quyền Giám khảo (Judge) thành công!', isJudge: true });
    }
  } catch (error) {
    console.error('Toggle Judge Error:', error.message);
    res.status(500).json({ message: 'Server error toggling judge role.' });
  }
});

router.post('/users/:id/toggle-mentor', authenticateToken, requireSystemAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const existingRoles = await EventRole.find({ userId, role: 'mentor', status: 'active' });
    const isCurrentlyMentor = existingRoles.length > 0;

    if (isCurrentlyMentor) {
      await EventRole.deleteMany({ userId, role: 'mentor' });
      return res.json({ message: 'Đã thu hồi quyền Mentor!', isMentor: false });
    } else {
      const Event = mongoose.model('Event');
      const events = await Event.find({});
      if (events.length > 0) {
        for (const ev of events) {
          await EventRole.updateOne(
            { userId, eventId: ev._id, role: 'mentor' },
            { $set: { status: 'active', assignedBy: req.user._id } },
            { upsert: true }
          );
        }
      } else {
        await EventRole.create({
          userId,
          role: 'mentor',
          assignedBy: req.user._id,
          status: 'active'
        });
      }
      return res.json({ message: 'Đã cấp quyền Mentor thành công!', isMentor: true });
    }
  } catch (error) {
    console.error('Toggle Mentor Error:', error.message);
    res.status(500).json({ message: 'Server error toggling mentor role.' });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Vui lòng cung cấp email của bạn.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log(`[FORGOT PASSWORD] Password reset requested for non-existent email: ${email}`);
      return res.json({ message: 'Nếu email này đã được đăng ký, một đường dẫn khôi phục mật khẩu sẽ được gửi đến hộp thư của bạn.' });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(20).toString('hex');

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    const emailService = require('../notifications/emailService');
    await emailService.sendPasswordResetEmail(user.email, user.fullName, resetLink);

    res.json({ message: 'Nếu email này đã được đăng ký, một đường dẫn khôi phục mật khẩu sẽ được gửi đến hộp thư của bạn.' });
  } catch (error) {
    console.error('Forgot Password Error:', error.message);
    res.status(500).json({ message: 'Có lỗi xảy ra trong quá trình xử lý yêu cầu.' });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: 'Email, token, và mật khẩu mới là bắt buộc.' });
  }

  try {
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Đường dẫn khôi phục mật khẩu không hợp lệ hoặc đã hết hạn.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.activeSessionId = null;
    await user.save();

    res.json({ message: 'Mật khẩu của bạn đã được đặt lại thành công! Vui lòng đăng nhập lại.' });
  } catch (error) {
    console.error('Reset Password Error:', error.message);
    res.status(500).json({ message: 'Có lỗi xảy ra trong quá trình đặt lại mật khẩu.' });
  }
});

module.exports = router;
