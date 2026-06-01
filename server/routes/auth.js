const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');

const User = mongoose.model('User');
const EventRole = mongoose.model('EventRole');
const { authenticateToken, requireSystemAdmin } = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'seal_hackathon_secret_key_2026';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { email, password, fullName, studentId, university, githubUsername } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ message: 'Email, password, and full name are required.' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
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
      // Send verification email (Asynchronous, non-blocking to prevent UI lag)
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const verifyLink = `${backendUrl}/api/auth/verify-email?token=${emailVerificationToken}`;
      emailService.sendEmailVerification(user.email, user.fullName, verifyLink)
        .catch(err => console.error(`Failed to send email verification to ${user.email}:`, err.message));

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
      message: 'Registration successful!',
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
    return res.status(400).json({ message: 'Please provide both email and password.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
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
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Check session concurrency: if user has active session and heartbeat is fresh (< 20 seconds)
    if (user.activeSessionId && user.lastActiveAt && (Date.now() - new Date(user.lastActiveAt).getTime() < 20000)) {
      return res.status(409).json({ 
        message: 'Tài khoản này đang được đăng nhập ở nơi khác. Vui lòng đăng xuất ở thiết bị cũ hoặc đợi 20 giây.' 
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
 * @route   POST /api/auth/assign-role
 * @desc    Assign event role to a user (System Admin only)
 * @access  Private (System Admin)
 */
router.post('/assign-role', authenticateToken, requireSystemAdmin, async (req, res) => {
  const { userEmail, eventId, trackId, role } = req.body;

  if (!userEmail || !eventId || !role) {
    return res.status(400).json({ message: 'User email, event ID, and role are required.' });
  }

  try {
    const targetUser = await User.findOne({ email: userEmail.toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    // Delete existing role for same user/event to prevent duplicate key error
    await EventRole.deleteMany({ userId: targetUser._id, eventId });

    const newRole = new EventRole({
      userId: targetUser._id,
      eventId,
      trackId: trackId || undefined,
      role,
      assignedBy: req.user._id
    });

    await newRole.save();
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

    // Check session concurrency
    if (user.activeSessionId && user.lastActiveAt && (Date.now() - new Date(user.lastActiveAt).getTime() < 20000)) {
      return res.status(409).json({ 
        message: 'Tài khoản này đang được đăng nhập ở nơi khác. Vui lòng đăng xuất ở thiết bị cũ hoặc đợi 20 giây.' 
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
  const { accessToken, code, email, fullName, githubUsername, isMock } = req.body;

  let userEmail = email;
  let userName = fullName;
  let userGithub = githubUsername;
  let userAvatar = '';
  let currentToken = accessToken;

  if (!isMock && code) {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23liz8uHIFRtgdwDwE';
      const clientSecret = process.env.GITHUB_CLIENT_SECRET || 'eb9a526811f9bc9b70b5ec1042974aa5e3c55df9';

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code
        })
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

    // Check session concurrency
    if (user.activeSessionId && user.lastActiveAt && (Date.now() - new Date(user.lastActiveAt).getTime() < 20000)) {
      return res.status(409).json({ 
        message: 'Tài khoản này đang được đăng nhập ở nơi khác. Vui lòng đăng xuất ở thiết bị cũ hoặc đợi 20 giây.' 
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
          <a href="http://localhost:5173/login" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">QUAY LẠI TRANG ĐĂNG NHẬP</a>
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
            <a href="http://localhost:5173/login" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">QUAY LẠI TRANG ĐĂNG NHẬP</a>
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
          <a href="http://localhost:5173/login" class="inline-block w-full py-3 border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff] hover:text-[#0a141d] font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(0,240,255,0.1)] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]">ĐĂNG NHẬP NGAY</a>
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

module.exports = router;
