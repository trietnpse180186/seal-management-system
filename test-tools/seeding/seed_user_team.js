const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

// Đăng ký các Model
require('../../server/features/auth/User');
require('../../server/features/events/Event');
require('../../server/features/events/Track');
require('../../server/features/events/Round');
require('../../server/features/auth/EventRole');
require('../../server/features/teams/Team');
require('../../server/features/teams/TeamMember');
require('../../server/features/github-ai/GithubRepository');
require('../../server/features/github-ai/Commit');

async function setupUserTeam() {
  console.log('=== KHỞI TẠO ĐỘI THI CHO TÀI KHOẢN CỦA BẠN ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  const Track = mongoose.model('Track');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');
  const GithubRepository = mongoose.model('GithubRepository');
  const Commit = mongoose.model('Commit');
  const EventRole = mongoose.model('EventRole');

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('123456', salt);

  // 1. Tạo/Cập nhật tài khoản của bạn
  const targetEmail = 'se182340nguyenvancuong@gmail.com';
  const user = await User.findOneAndUpdate(
    { email: targetEmail },
    {
      $set: {
        fullName: 'cương nguyễn',
        passwordHash,
        isApproved: true,
        isActive: true,
        studentId: 'SE182340',
        university: 'FPT'
      }
    },
    { upsert: true, new: true }
  );
  console.log(`- Tài khoản: ${user.email} / Mật khẩu: 123456`);

  // 2. Tìm sự kiện và bảng đấu
  const event = await Event.findOne({ semester: 'Summer', year: 2026 });
  if (!event) {
    console.error('Không tìm thấy sự kiện Summer 2026. Hãy chạy script seed_summer_2026_personnel.js trước.');
    await mongoose.disconnect();
    return;
  }

  const track = await Track.findOne({ eventId: event._id, name: 'Track 1 - AI Operations' });
  if (!track) {
    console.error('Không tìm thấy Track 1.');
    await mongoose.disconnect();
    return;
  }

  // 3. Dọn dẹp đội cũ của user này nếu có để tránh lỗi trùng lặp
  const oldMember = await TeamMember.findOne({ userId: user._id });
  if (oldMember) {
    await Team.deleteOne({ _id: oldMember.teamId });
    await TeamMember.deleteMany({ teamId: oldMember.teamId });
    await GithubRepository.deleteMany({ teamId: oldMember.teamId });
    await Commit.deleteMany({ teamId: oldMember.teamId });
  }

  // Dọn dẹp đội tên "Operators" nếu trùng lặp
  const duplicateTeam = await Team.findOne({ eventId: event._id, trackId: track._id, name: 'Operators' });
  if (duplicateTeam) {
    await Team.deleteOne({ _id: duplicateTeam._id });
    await TeamMember.deleteMany({ teamId: duplicateTeam._id });
    await GithubRepository.deleteMany({ teamId: duplicateTeam._id });
    await Commit.deleteMany({ teamId: duplicateTeam._id });
  }

  // 4. Tạo đội thi "Operators" đã confirmed
  const team = new Team({
    eventId: event._id,
    leaderId: user._id,
    name: 'Operators',
    status: 'confirmed',
    trackId: track._id
  });
  await team.save();
  console.log(`- Đã tạo đội thi: "${team.name}" thuộc bảng đấu "${track.name}"`);

  // 5. Thêm user vào đội với vai trò Trưởng nhóm (Leader)
  const teamMember = new TeamMember({
    teamId: team._id,
    eventId: event._id,
    userId: user._id,
    role: 'leader',
    confirmStatus: 'confirmed',
    confirmedAt: new Date()
  });
  await teamMember.save();
  console.log(`- Đã thêm ${user.fullName} làm Trưởng nhóm.`);

  // 6. Gán vai trò EventRole
  await EventRole.findOneAndUpdate(
    { userId: user._id, eventId: event._id, role: 'participant' },
    { $set: { status: 'active' } },
    { upsert: true }
  );

  // 7. Tạo mock Github Repository cho đội
  const repo = new GithubRepository({
    teamId: team._id,
    eventId: event._id,
    repoName: 'operators-repo',
    repoUrl: 'https://github.com/seal-hackathon-2026/operators-repo',
    githubRepoId: 'mock-repo-id-123456',
    orgName: 'seal-hackathon-2026'
  });
  await repo.save();
  console.log(`- Đã tạo mock Github Repository: ${repo.repoUrl}`);

  // 8. Tạo 2 commits mẫu cho đẹp giao diện
  await Commit.create([
    {
      teamId: team._id,
      repositoryId: repo._id,
      commitSha: '2c29cb95e4d2bfb2149b14eb1a58c0c1b48b61ea',
      message: 'Initial commit',
      authorName: 'cương nguyễn',
      authorEmail: targetEmail,
      authorGithubUsername: 'trietnpse180186',
      committedAt: new Date(Date.now() - 3600000 * 2) // 2 tiếng trước
    },
    {
      teamId: team._id,
      repositoryId: repo._id,
      commitSha: '7f9a12c8b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4',
      message: 'feat: Add AI Operations analytics UI',
      authorName: 'cương nguyễn',
      authorEmail: targetEmail,
      authorGithubUsername: 'trietnpse180186',
      committedAt: new Date(Date.now() - 600000) // 10 phút trước
    }
  ]);
  console.log(`- Đã tạo 2 commits mẫu.`);

  console.log('=== KHỞI TẠO HOÀN TẤT! HÃY ĐĂNG NHẬP VÀ KIỂM TRA ===');
  await mongoose.disconnect();
}

setupUserTeam().catch(console.error);
