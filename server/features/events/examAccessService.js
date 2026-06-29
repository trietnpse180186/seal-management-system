const mongoose = require('mongoose');

const Track = mongoose.model('Track');
const Team = mongoose.model('Team');
const TeamMember = mongoose.model('TeamMember');
const User = mongoose.model('User');
const Round = mongoose.model('Round');

/**
 * Parse Google Drive URL → file/folder ID.
 */
function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function buildDriveUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/open?id=${fileId}`;
}

/**
 * Confirmed team members in tracks belonging to this round.
 */
async function getEligibleEmailsForRound(roundId) {
  const tracks = await Track.find({ roundId }).select('_id');
  if (!tracks.length) return [];

  const trackIds = tracks.map((t) => t._id);
  const teams = await Team.find({ trackId: { $in: trackIds }, status: 'confirmed' }).select('_id');
  if (!teams.length) return [];

  const teamIds = teams.map((t) => t._id);
  const members = await TeamMember.find({
    teamId: { $in: teamIds },
    confirmStatus: 'confirmed'
  }).populate('userId', 'email isActive');

  const emails = new Set();
  for (const member of members) {
    if (member.userId?.isActive && member.userId.email) {
      emails.add(member.userId.email.toLowerCase().trim());
    }
  }
  return Array.from(emails);
}

async function getEligibleUserIdsForRound(roundId) {
  const tracks = await Track.find({ roundId }).select('_id');
  const trackIds = tracks.map((t) => t._id);
  const teams = await Team.find({ trackId: { $in: trackIds }, status: 'confirmed' }).select('_id');
  const teamIds = teams.map((t) => t._id);
  const members = await TeamMember.find({
    teamId: { $in: teamIds },
    confirmStatus: 'confirmed'
  }).populate('userId', 'isActive');

  const ids = new Set();
  for (const member of members) {
    if (member.userId?.isActive) ids.add(member.userId._id.toString());
  }
  return Array.from(ids);
}

function isRoundExamOpen(round) {
  if (!round?.driveFileId) return false;
  if (!round.startTime) return true;
  return new Date() >= new Date(round.startTime);
}

/**
 * Sanitize round for participant API — never expose raw Drive URL/ID before access gate.
 */
function sanitizeRoundForParticipant(round) {
  if (!round) return null;
  const plain = round.toObject ? round.toObject() : { ...round };
  const opened = isRoundExamOpen(plain);

  return {
    _id: plain._id,
    name: plain.name,
    order: plain.order,
    status: plain.status,
    startTime: plain.startTime,
    endTime: plain.endTime,
    gradingEndTime: plain.gradingEndTime,
    hasExamMaterial: !!plain.driveFileId,
    examOpened: opened,
    driveFileName: opened ? plain.driveFileName : null,
    isDriveAccessSynced: plain.isDriveAccessSynced,
    driveSyncedEmailCount: plain.driveSyncedEmailCount
  };
}

/**
 * Sanitize round for coordinator admin UI (includes sync status, not raw student access).
 */
function sanitizeRoundForAdmin(round) {
  if (!round) return null;
  const plain = round.toObject ? round.toObject() : { ...round };
  return {
    ...plain,
    hasExamMaterial: !!plain.driveFileId,
    examOpened: isRoundExamOpen(plain)
  };
}

async function canUserAccessRoundExam(userId, roundId) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    return { ok: false, reason: 'inactive', message: 'Tài khoản không hợp lệ hoặc đã bị khóa.' };
  }

  const round = await Round.findById(roundId);
  if (!round) {
    return { ok: false, reason: 'not_found', message: 'Không tìm thấy vòng thi.' };
  }

  if (!round.driveFileId) {
    return { ok: false, reason: 'no_material', message: 'Vòng thi chưa có đề bài được gắn.' };
  }

  if (round.startTime && new Date() < new Date(round.startTime)) {
    return { ok: false, reason: 'not_started', message: 'Đề bài chưa đến giờ mở.' };
  }

  const eligibleEmails = await getEligibleEmailsForRound(roundId);
  const userEmail = user.email.toLowerCase().trim();
  if (!eligibleEmails.includes(userEmail)) {
    return {
      ok: false,
      reason: 'not_eligible',
      message: 'Email của bạn chưa được đăng ký tham gia vòng thi này (cần là thành viên đội đã xác nhận).'
    };
  }

  return { ok: true, round, user };
}

module.exports = {
  extractDriveFileId,
  buildDriveUrl,
  getEligibleEmailsForRound,
  getEligibleUserIdsForRound,
  isRoundExamOpen,
  sanitizeRoundForParticipant,
  sanitizeRoundForAdmin,
  canUserAccessRoundExam
};
