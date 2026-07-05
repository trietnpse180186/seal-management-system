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
  // Phòng thi mở khi có link Drive (id hoặc url) và đã đến giờ hoặc được mở thủ công
  const hasMaterial = !!(round?.driveFileId || round?.driveFileUrl);
  if (!hasMaterial) return false;
  if (round?.isExamManualOpen) return true;
  if (!round.startTime) return true;
  return new Date() >= new Date(round.startTime);
}

/**
 * Sanitize round for participant API.
 * Chỉ expose driveFileUrl khi đề đã mở — không lộ link khi chưa đến giờ.
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
    hasExamMaterial: !!(plain.driveFileId || plain.driveFileUrl),
    examOpened: opened,
    driveFileName: opened ? plain.driveFileName : null,
    // Chỉ trả về URL khi được mở — frontend sẽ window.open() trực tiếp
    driveFileUrl: opened ? plain.driveFileUrl : null,
    isDriveAccessSynced: plain.isDriveAccessSynced,
    driveSyncedEmailCount: plain.driveSyncedEmailCount,
    isExamManualOpen: plain.isExamManualOpen
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

/**
 * Kiểm tra xem user có quyền xem đề bài không.
 * Logic mới: Không cần match email — chỉ cần là thành viên đã xác nhận và đến giờ mở đề.
 */
async function canUserAccessRoundExam(userId, roundId) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    return { ok: false, reason: 'inactive', message: 'Tài khoản không hợp lệ hoặc đã bị khóa.' };
  }

  const round = await Round.findById(roundId);
  if (!round) {
    return { ok: false, reason: 'not_found', message: 'Không tìm thấy vòng thi.' };
  }

  if (!round.driveFileUrl && !round.driveFileId) {
    return { ok: false, reason: 'no_material', message: 'Vòng thi chưa có đề bài được gắn.' };
  }

  if (round.startTime && new Date() < new Date(round.startTime) && !round.isExamManualOpen) {
    return { ok: false, reason: 'not_started', message: 'Đề bài chưa đến giờ mở.' };
  }

  // Link Drive được sử dụng trực tiếp, không cần cấp quyền theo email
  const accessUrl = round.driveFileUrl || buildDriveUrl(round.driveFileId);

  return { ok: true, round, user, accessUrl };
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
