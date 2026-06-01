const mongoose = require('mongoose');
require('dotenv').config();

// Require models
require('./models/User');
require('./models/Event');
require('./models/Track');
require('./models/Round');
require('./models/Team');

async function setupRoundsAndTracks() {
  console.log('=== KHIÊU KHỞI TẠO 2 ROUNDS, MỖI ROUNDS 2 TRACKS, MỖI TRACK 5 TEAMS ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  console.log(`Kết nối MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('Đã kết nối.');

  const Event = mongoose.model('Event');
  const Round = mongoose.model('Round');
  const Track = mongoose.model('Track');
  const Team = mongoose.model('Team');

  // Tìm cuộc thi mới nhất
  const event = await Event.findOne().sort({ _id: -1 });
  if (!event) {
    console.error('Lỗi: Không tìm thấy cuộc thi nào.');
    await mongoose.disconnect();
    return;
  }
  console.log(`Sự kiện đích: "${event.name}" (ID: ${event._id})`);

  // Xóa sạch các Round và Track cũ của sự kiện này để tránh trùng lặp
  console.log('\nDọn dẹp các Round và Track cũ của sự kiện này...');
  await Round.deleteMany({ eventId: event._id });
  await Track.deleteMany({ eventId: event._id });

  // 1. Tạo 2 Round đấu
  console.log('\nTạo 2 Round đấu...');
  const round1 = new Round({
    eventId: event._id,
    name: 'Vòng sơ khảo (Round 1)',
    order: 1,
    submissionDeadline: new Date(Date.now() + 3600000 * 24 * 7),
    advanceTopN: 5
  });
  await round1.save();
  console.log(`- Đã tạo Round 1: "${round1.name}" (ID: ${round1._id})`);

  const round2 = new Round({
    eventId: event._id,
    name: 'Vòng chung kết (Round 2)',
    order: 2,
    submissionDeadline: new Date(Date.now() + 3600000 * 24 * 14),
    advanceTopN: 3
  });
  await round2.save();
  console.log(`- Đã tạo Round 2: "${round2.name}" (ID: ${round2._id})`);

  // 2. Tạo 2 Track dưới mỗi Round
  console.log('\nTạo các Track cho từng Round...');
  
  // Tracks cho Round 1
  const trackA1 = new Track({
    eventId: event._id,
    roundId: round1._id,
    name: 'Bảng A1 - Phát triển ứng dụng Web',
    description: 'Bảng Web thuộc vòng sơ khảo',
    maxTeams: 10
  });
  await trackA1.save();
  console.log(`- Đã tạo Track A1: "${trackA1.name}" dưới Round 1`);

  const trackA2 = new Track({
    eventId: event._id,
    roundId: round1._id,
    name: 'Bảng A2 - Trí tuệ nhân tạo (AI)',
    description: 'Bảng AI thuộc vòng sơ khảo',
    maxTeams: 10
  });
  await trackA2.save();
  console.log(`- Đã tạo Track A2: "${trackA2.name}" dưới Round 1`);

  // Tracks cho Round 2
  const trackB1 = new Track({
    eventId: event._id,
    roundId: round2._id,
    name: 'Bảng B1 - Chung kết Web xuất sắc',
    description: 'Bảng Web thuộc vòng chung kết',
    maxTeams: 5
  });
  await trackB1.save();
  console.log(`- Đã tạo Track B1: "${trackB1.name}" dưới Round 2`);

  const trackB2 = new Track({
    eventId: event._id,
    roundId: round2._id,
    name: 'Bảng B2 - Chung kết AI xuất sắc',
    description: 'Bảng AI thuộc vòng chung kết',
    maxTeams: 5
  });
  await trackB2.save();
  console.log(`- Đã tạo Track B2: "${trackB2.name}" dưới Round 2`);

  // 3. Phân phối 20 đội thi vào 4 Track này (mỗi Track 5 đội)
  console.log('\nPhân phối đội thi...');
  const teams = await Team.find({ eventId: event._id, status: 'confirmed' });
  if (teams.length < 20) {
    console.warn(`Cảnh báo: Chỉ tìm thấy ${teams.length} đội thi đã confirmed (cần 20 đội).`);
  }

  const distribution = [
    { track: trackA1, round: round1 },
    { track: trackA2, round: round1 },
    { track: trackB1, round: round2 },
    { track: trackB2, round: round2 }
  ];

  let teamIndex = 0;
  for (let d = 0; d < distribution.length; d++) {
    const { track, round } = distribution[d];
    console.log(`\nGán 5 đội vào ${track.name} (${round.name}):`);
    for (let count = 0; count < 5; count++) {
      if (teamIndex >= teams.length) {
        console.log('- Hết đội thi để gán.');
        break;
      }
      const team = teams[teamIndex];
      team.trackId = track._id;
      team.currentRoundId = round._id;
      await team.save();
      console.log(`  + Đội "${team.name}" -> Track: "${track.name}" / Round: "${round.name}"`);
      teamIndex++;
    }
  }

  console.log('\n=== ĐÃ HOÀN THÀNH SETUP 2 ROUNDS, 4 TRACKS, PHÂN PHỐI ĐỀU 5 ĐỘI/TRACK ===');
  await mongoose.disconnect();
}

setupRoundsAndTracks().catch(err => {
  console.error('Lỗi khi chạy script:', err);
  mongoose.disconnect();
});
