const mongoose = require('mongoose');
require('dotenv').config();

// Require models
require('./models/User');
require('./models/Event');
require('./models/Track');
require('./models/Round');
require('./models/EventRole');
require('./models/Team');
require('./models/TeamMember');
require('./models/GithubRepository');

async function createTestData() {
  console.log('=== KHIÊU KHỞI TẠO DỮ LIỆU KIỂM THỬ: ĐỘI CHƯA CÓ TRACK ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  console.log(`Kết nối MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('Đã kết nối.');

  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  const Track = mongoose.model('Track');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');

  const suffix = Date.now().toString().slice(-4);

  // 1. Tạo các tài khoản mock
  console.log('\nTạo các tài khoản kiểm thử...');
  const createMockUser = async (roleName, index) => {
    const email = `${roleName}-${index}-${suffix}@example.com`;
    const user = new User({
      email,
      passwordHash: 'e10adc3949ba59abbe56e057f20f883e', // md5 hash cho '123456' để dễ đăng nhập nếu cần
      fullName: `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} Test ${index} (${suffix})`,
      githubUsername: `git-${roleName}-${index}-${suffix}`,
      isApproved: true
    });
    await user.save();
    return user;
  };

  const adminUser = await createMockUser('admin', 1);
  adminUser.isSystemAdmin = true;
  await adminUser.save();

  console.log(`Tạo tài khoản Admin: Email: ${adminUser.email} / Mật khẩu: 123456 (nếu dùng đăng nhập)`);

  // 2. Tạo một Event mới tinh
  console.log('\nTạo sự kiện (Event) mới...');
  const eventName = `SEAL Hackathon Random Test ${suffix}`;
  
  // Dọn dẹp học kỳ trùng để tránh lỗi unique index
  await Event.deleteMany({ semester: 'Summer', year: 2026 });

  const event = new Event({
    name: eventName,
    semester: 'Summer',
    year: 2026,
    description: 'Sự kiện kiểm thử phân chia bảng đấu ngẫu nhiên',
    maxTeams: 15,
    githubOrgName: 'seal-random-test',
    status: 'registration'
  });
  await event.save();
  console.log(`Đã tạo Event: "${event.name}" (ID: ${event._id})`);

  // 2.5 Tạo một Vòng thi mặc định (Round)
  console.log('\nTạo vòng thi mặc định (Round)...');
  const Round = mongoose.model('Round');
  const round = new Round({
    eventId: event._id,
    name: 'Vòng sơ loại',
    order: 1,
    submissionDeadline: new Date(Date.now() + 3600000 * 24 * 7),
    advanceTopN: 5
  });
  await round.save();
  console.log(`Đã tạo Round: "${round.name}" (ID: ${round._id})`);

  // 3. Tạo 3 Bảng đấu (Tracks) cho Event này
  console.log('\nTạo 3 bảng đấu (Tracks)...');
  const trackNames = ['Bảng A - AI & Data Science', 'Bảng B - Web/Mobile Applications', 'Bảng C - IoT & Hardware'];
  const tracks = [];
  for (const name of trackNames) {
    const t = new Track({
      eventId: event._id,
      name,
      description: `Bảng đấu dành cho các đội thi thuộc lĩnh vực ${name}`,
      maxTeams: 5,
      roundId: round._id
    });
    await t.save();
    tracks.push(t);
  }
  console.log(`Đã tạo ${tracks.length} bảng đấu.`);

  // 4. Tạo 3 Đội thi đã CONFIRMED nhưng CHƯA CÓ TRACK (trackId = null)
  console.log('\nTạo 3 đội thi đã xác nhận nhưng chưa có Track...');
  const teamNames = ['Đội Phoenix', 'Đội Alpha Tech', 'Đội Code Breakers'];
  
  for (let i = 0; i < teamNames.length; i++) {
    const leaderUser = await createMockUser('leader', i + 1);
    const memberUser = await createMockUser('member', i + 1);

    const team = new Team({
      eventId: event._id,
      leaderId: leaderUser._id,
      name: `${teamNames[i]} (${suffix})`,
      status: 'confirmed',
      trackId: null // Bảo đảm chưa gán track
    });
    await team.save();

    // Tạo TeamMember tương ứng
    const tmLeader = new TeamMember({
      teamId: team._id,
      userId: leaderUser._id,
      role: 'leader',
      confirmStatus: 'confirmed',
      confirmedAt: new Date()
    });
    await tmLeader.save();

    const tmMember = new TeamMember({
      teamId: team._id,
      userId: memberUser._id,
      role: 'member',
      confirmStatus: 'confirmed',
      confirmedAt: new Date()
    });
    await tmMember.save();

    console.log(`- Đã tạo đội: "${team.name}" (Trưởng nhóm: ${leaderUser.email})`);
  }

  console.log('\n=== ĐÃ HOÀN THÀNH TẠO DỮ LIỆU KIỂM THỬ ===');
  console.log(`Tên sự kiện: "${event.name}"`);
  console.log('Hãy mở Admin Dashboard, chọn sự kiện này để kiểm thử tính năng Chia bảng ngẫu nhiên hàng loạt hoặc cho từng nhóm.');

  await mongoose.disconnect();
}

createTestData().catch(err => {
  console.error('Lỗi khởi tạo dữ liệu:', err);
  mongoose.disconnect();
});
