const mongoose = require('../../server/node_modules/mongoose');
const path = require('path'); require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

// Require models
require('../../server/features/auth/User');
require('../../server/features/events/Event');
require('../../server/features/events/Track');
require('../../server/features/teams/Team');
require('../../server/features/teams/TeamMember');

async function create20Teams() {
  console.log('=== KHIÊU KHỞI TẠO 20 ĐỘI THI CHƯA PHÂN PHỐI TRACK ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  console.log(`Kết nối MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('Đã kết nối.');

  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');

  // Tìm cuộc thi mới nhất
  const event = await Event.findOne().sort({ _id: -1 });
  if (!event) {
    console.error('Lỗi: Không tìm thấy cuộc thi nào trong cơ sở dữ liệu.');
    await mongoose.disconnect();
    return;
  }
  console.log(`Đang thêm 20 đội thi vào cuộc thi: "${event.name}" (ID: ${event._id})`);

  const suffix = Date.now().toString().slice(-4);

  for (let i = 1; i <= 19; i++) {
    // 1. Tạo tài khoản Mock Leader
    const email = `mock-leader-${i}-${suffix}@example.com`;
    const leaderUser = new User({
      email,
      passwordHash: 'e10adc3949ba59abbe56e057f20f883e', // '123456'
      fullName: `Mock Leader ${i} (${suffix})`,
      githubUsername: `mock-git-leader-${i}-${suffix}`,
      isApproved: true
    });
    await leaderUser.save();

    // 2. Tạo Đội thi (confirmed, trackId: null)
    const team = new Team({
      eventId: event._id,
      leaderId: leaderUser._id,
      name: `Đội Mock ${i} (${suffix})`,
      status: 'confirmed',
      trackId: null
    });
    await team.save();

    // 3. Tạo Thành viên Nhóm Trưởng
    const tmLeader = new TeamMember({
      teamId: team._id,
      userId: leaderUser._id,
      role: 'leader',
      confirmStatus: 'confirmed',
      confirmedAt: new Date()
    });
    await tmLeader.save();

    console.log(`- Đã tạo Đội Mock ${i} (Trưởng nhóm: ${email})`);
  }

  console.log('\n=== ĐÃ HOÀN THÀNH TẠO 20 ĐỘI THI CHƯA PHÂN TRACK ===');
  await mongoose.disconnect();
}

create20Teams().catch(err => {
  console.error('Lỗi khi chạy script:', err);
  mongoose.disconnect();
});
