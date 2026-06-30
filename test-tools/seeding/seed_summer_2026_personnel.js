const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

// Đăng ký các Model cần thiết
require('../../server/features/auth/User');
require('../../server/features/events/Event');
require('../../server/features/events/Track');
require('../../server/features/events/Round');
require('../../server/features/auth/EventRole');

async function seedSummer2026() {
  console.log('=== KHỞI TẠO HỆ THỐNG NHÂN SỰ & CẤU TRÚC SUMMER 2026 (CHẾ ĐỘ UPSERT) ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  console.log(`Connecting to database: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  const Round = mongoose.model('Round');
  const Track = mongoose.model('Track');
  const EventRole = mongoose.model('EventRole');

  // [1] Cập nhật / Tạo mới Event (Summer 2026) bằng Upsert
  console.log('\n[1] Upsert Event Summer 2026...');
  const event = await Event.findOneAndUpdate(
    { semester: 'Summer', year: 2026 },
    {
      $set: {
        name: 'SEAL Hackathon Summer 2026',
        description: 'Chủ đề: “AI-Driven Smart Operations: Turning Real-Time IoT Data into Intelligent Actions”. Giải quyết bài toán vận hành thông minh dựa trên dữ liệu cảm biến và AI.',
        bannerUrl: '/assets/banner-summer-2026.png',
        registrationOpen: new Date('2026-06-01'),
        registrationClose: new Date('2026-06-20'),
        contestStart: new Date('2026-06-25T14:00:00Z'),
        contestEnd: new Date('2026-06-26T18:00:00Z'),
        maxTeams: 24,
        status: 'registration',
        mainGoal: 'Xây dựng các sản phẩm ứng dụng IoT và trí tuệ nhân tạo nhằm giải quyết những bài toán vận hành trong thực tế. Tiếp nhận và xử lý dữ liệu cảm biến theo thời gian thực.',
        durationText: '48 GIỜ',
        memberLimitText: '2-4 OPERATORS',
        prizePoolText: 'Cơ cấu giải thưởng: Nhất, Nhì, Ba, Khuyến khích',
        rules: [
          { title: 'Thời gian thi đấu', description: 'Thi đấu chính thức: 07h00 - 14h00. Đến trễ quá 60 phút sẽ bị loại.' },
          { title: 'Mã nguồn & Quản lý', description: 'Mã nguồn lưu trữ trên GitHub/GitLab. Tài liệu quản lý bằng Jira, Confluence hoặc Notion.' },
          { title: 'Đạo đức và Bản quyền', description: 'Nghiêm cấm mọi hành vi gian lận, đạo nhái, hoặc can thiệp trái phép vào hệ thống thi đấu.' }
        ],
        seminar: {
          scheduledAt: new Date('2026-06-15T09:00:00Z'),
          scheduledEnd: new Date('2026-06-15T11:00:00Z'),
          title: 'Workshop “AI-Driven Smart Operations: From Real-Time IoT Data to Intelligent Decisions”',
          description: 'Workshop cung cấp kiến thức nền tảng về xử lý dữ liệu IoT thời gian thực và ứng dụng AI phát hiện bất thường. Diễn giả: Thầy Trương Long, Anh Nguyễn Đức Tuấn.'
        }
      }
    },
    { upsert: true, new: true }
  );
  console.log(`- Event ID: ${event._id} ("${event.name}")`);

  // [2] Upsert các Vòng thi (Round)
  console.log('\n[2] Upsert các Vòng thi (Round)...');
  const roundPrelim = await Round.findOneAndUpdate(
    { eventId: event._id, name: 'Vòng Sơ Loại' },
    {
      $set: {
        order: 1,
        status: 'active',
        startTime: new Date('2026-06-26T07:00:00Z'),
        endTime: new Date('2026-06-26T14:00:00Z'),
        gradingEndTime: new Date('2026-06-26T15:30:00Z'),
        advanceTopN: 2
      }
    },
    { upsert: true, new: true }
  );

  const roundFinal = await Round.findOneAndUpdate(
    { eventId: event._id, name: 'Vòng Chung Kết' },
    {
      $set: {
        order: 2,
        status: 'pending',
        startTime: new Date('2026-06-26T15:30:00Z'),
        endTime: new Date('2026-06-26T17:00:00Z'),
        gradingEndTime: new Date('2026-06-26T17:30:00Z')
      }
    },
    { upsert: true, new: true }
  );
  console.log(`- Round Sơ Loại ID: ${roundPrelim._id}`);
  console.log(`- Round Chung Kết ID: ${roundFinal._id}`);

  // [3] Upsert các Bảng đấu (Track)
  console.log('\n[3] Upsert các Bảng đấu (Track)...');
  const tracksData = [
    { name: 'Track 1 - AI Operations', desc: 'Ứng dụng AI xử lý dữ liệu cảm biến thời gian thực của dây chuyền nhà máy.' },
    { name: 'Track 2 - Smart Logistics', desc: 'Tối ưu hóa và giám sát trạng thái đội xe vận tải tự hành.' },
    { name: 'Track 3 - Predictive Maintenance', desc: 'Dự báo hư hỏng thiết bị và cảnh báo lỗi bất thường.' }
  ];
  const tracks = [];
  for (const t of tracksData) {
    const track = await Track.findOneAndUpdate(
      { eventId: event._id, name: t.name },
      {
        $set: {
          description: t.desc,
          maxTeams: 8,
          roundId: roundPrelim._id
        }
      },
      { upsert: true, new: true }
    );
    tracks.push(track);
    console.log(`- Track "${track.name}" ID: ${track._id}`);
  }

  // [4] Upsert tài khoản người dùng
  console.log('\n[4] Upsert tài khoản người dùng (Default Password: 123456)...');
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('123456', salt);

  const personnel = [
    { email: 'huongntc@fpt.edu.vn', name: 'Nguyễn Thị Cẩm Hương' },
    { email: 'longt@fpt.edu.vn', name: 'Trương Long' },
    { email: 'ngandvt@fpt.edu.vn', name: 'Đặng Vũ Thuỳ Ngân' },
    { email: 'anltd@fpt.edu.vn', name: 'Lê Thị Diệu Ân' },
    { email: 'tuann@guest.com', name: 'Nguyễn Đức Tuấn' },
    { email: 'sangnm@fpt.edu.vn', name: 'Nguyễn Minh Sang' },
    { email: 'thinhdp@fpt.edu.vn', name: 'Đỗ Phúc Thịnh' },
    { email: 'minhth@fpt.edu.vn', name: 'Tôn Thất Hoàng Minh' },
    { email: 'vulns@fpt.edu.vn', name: 'Lê Nguyễn Sơn Vũ' },
    { email: 'tript@fpt.edu.vn', name: 'Phạm Thanh Trí' },
    { email: 'lamnn@fpt.edu.vn', name: 'Nguyễn Ngọc Lâm' },
    { email: 'phuonglhk@fpt.edu.vn', name: 'Lâm Hữu Khánh Phương' },
    { email: 'phucth@amazingtech.com', name: 'Trần Hoàng Phúc' },
    { email: 'doanhnghiep@guest.com', name: 'Khách mời từ Doanh nghiệp' }
  ];

  const userMap = {};
  for (const p of personnel) {
    const user = await User.findOneAndUpdate(
      { email: p.email.toLowerCase() },
      {
        $setOnInsert: {
          passwordHash,
          fullName: p.name,
          isApproved: true,
          isActive: true
        }
      },
      { upsert: true, new: true }
    );
    userMap[p.email] = user;
    console.log(`- User: ${user.fullName} (${user.email})`);
  }

  // [5] Upsert vai trò chi tiết (EventRole)
  console.log('\n[5] Upsert các vai trò chi tiết (EventRole)...');

  // A. Coordinators
  const coordinators = ['huongntc@fpt.edu.vn', 'longt@fpt.edu.vn', 'ngandvt@fpt.edu.vn', 'anltd@fpt.edu.vn'];
  for (const email of coordinators) {
    const user = userMap[email];
    await EventRole.findOneAndUpdate(
      { userId: user._id, eventId: event._id, role: 'coordinator' },
      { $set: { status: 'active' } },
      { upsert: true }
    );
    console.log(`- Coordinator Role: ${user.fullName}`);
  }

  // B. Mentors
  const mentors = ['sangnm@fpt.edu.vn', 'thinhdp@fpt.edu.vn', 'minhth@fpt.edu.vn', 'vulns@fpt.edu.vn', 'tript@fpt.edu.vn', 'lamnn@fpt.edu.vn'];
  for (const email of mentors) {
    const user = userMap[email];
    await EventRole.findOneAndUpdate(
      { userId: user._id, eventId: event._id, role: 'mentor' },
      { $set: { status: 'active' } },
      { upsert: true }
    );
    console.log(`- Mentor Role: ${user.fullName}`);
  }

  // C. Giám khảo Vòng sơ loại (theo Track)
  const trackJudges = [
    { email: 'tript@fpt.edu.vn', trackName: 'Track 1 - AI Operations' },
    { email: 'thinhdp@fpt.edu.vn', trackName: 'Track 1 - AI Operations' },
    { email: 'minhth@fpt.edu.vn', trackName: 'Track 2 - Smart Logistics' },
    { email: 'vulns@fpt.edu.vn', trackName: 'Track 2 - Smart Logistics' },
    { email: 'sangnm@fpt.edu.vn', trackName: 'Track 3 - Predictive Maintenance' },
    { email: 'lamnn@fpt.edu.vn', trackName: 'Track 3 - Predictive Maintenance' }
  ];

  for (const tj of trackJudges) {
    const user = userMap[tj.email];
    // Truy vấn động trackId dựa trên tên bảng đấu
    const track = await Track.findOne({ eventId: event._id, name: tj.trackName });
    if (track) {
      await EventRole.findOneAndUpdate(
        { userId: user._id, eventId: event._id, roundId: roundPrelim._id, trackId: track._id, role: 'judge' },
        { $set: { status: 'active' } },
        { upsert: true }
      );
      console.log(`- Judge Role (Sơ loại): ${user.fullName} -> ${track.name}`);
    }
  }

  // D. Giám khảo Vòng chung kết (chấm toàn cuộc thi, trackId = null)
  const finalJudges = [
    'huongntc@fpt.edu.vn',
    'phuonglhk@fpt.edu.vn',
    'longt@fpt.edu.vn',
    'phucth@amazingtech.com',
    'doanhnghiep@guest.com'
  ];

  for (const email of finalJudges) {
    const user = userMap[email];
    await EventRole.findOneAndUpdate(
      { userId: user._id, eventId: event._id, roundId: roundFinal._id, trackId: null, role: 'judge' },
      { $set: { status: 'active' } },
      { upsert: true }
    );
    console.log(`- Judge Role (Chung kết): ${user.fullName}`);
  }

  console.log('\n=== ĐÃ HOÀN TẤT SEEDING HOÀN TOÀN KHÔNG GÂY TRÙNG LẶP DỮ LIỆU ===');
  await mongoose.disconnect();
}

seedSummer2026().catch((err) => {
  console.error('Lỗi seeding:', err);
  mongoose.disconnect();
});
