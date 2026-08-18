const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

// Require models
require('../../server/features/auth/User');
require('../../server/features/events/Event');
require('../../server/features/events/Track');
require('../../server/features/events/Round');
require('../../server/features/auth/EventRole');
require('../../server/features/teams/Team');
require('../../server/features/teams/TeamMember');
require('../../server/features/grading/Ranking');

async function testAdvanceRoundLogic() {
  console.log('=== CHẠY KIỂM THỬ TỰ ĐỘNG: LOGIC THĂNG HẠNG (ADVANCE ROUND) ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const Event = mongoose.model('Event');
  const Round = mongoose.model('Round');
  const Track = mongoose.model('Track');
  const Team = mongoose.model('Team');
  const Ranking = mongoose.model('Ranking');

  // 1. Tìm event mock vừa seed
  const event = await Event.findOne({ semester: 'Fall', year: 2026 }).sort({ createdAt: -1 });
  if (!event) {
    console.error('Không tìm thấy Event Fall 2026. Hãy chạy setup_complete_mock_contest.js trước.');
    await mongoose.disconnect();
    return;
  }
  console.log(`- Tìm thấy Event: "${event.name}" (ID: ${event._id})`);

  const round = await Round.findOne({ eventId: event._id, name: 'Vòng Sơ Loại' });
  if (!round) {
    console.error('Không tìm thấy Round.');
    await mongoose.disconnect();
    return;
  }

  // Lấy các tracks
  const tracks = await Track.find({ roundId: round._id });
  console.log(`- Có ${tracks.length} bảng đấu thuộc vòng sơ loại.`);

  // THỬ NGHIỆM 1: Tất cả bảng đấu có đội và đã được khóa điểm -> Phải PASS kiểm tra
  console.log('\n--- Thử nghiệm 1: Tất cả bảng đấu đều có Rankings và có Đội thi ---');
  let hasBlocked = false;
  
  const tracksWithTeams = await Team.distinct('trackId', {
    eventId: event._id,
    trackId: { $in: tracks.map(t => t._id) },
    status: 'confirmed'
  });

  console.log(`- Các bảng đấu có đội thi thực tế: ${tracksWithTeams.length} bảng.`);
  for (const trackId of tracksWithTeams) {
    const rankingsExist = await Ranking.exists({ roundId: round._id, trackId });
    if (!rankingsExist) {
      hasBlocked = true;
      console.log(`❌ Bảng ${trackId} chưa khóa điểm!`);
    }
  }

  if (!hasBlocked) {
    console.log('✅ THỬ NGHIỆM 1: ĐẠT YÊU CẦU (Không bị chặn vô lý).');
  } else {
    console.log('❌ THỬ NGHIỆM 1: THẤT BẠI.');
  }

  // THỬ NGHIỆM 2: Tạo một bảng đấu mới (Track 4 - Empty) không có đội thi nào
  console.log('\n--- Thử nghiệm 2: Tạo thêm một bảng đấu TRỐNG (0 đội thi) ---');
  const emptyTrack = new Track({
    eventId: event._id,
    roundId: round._id,
    name: 'Bảng D - Empty Track',
    description: 'Bảng đấu thử nghiệm không có đội thi nào.'
  });
  await emptyTrack.save();
  console.log(`- Đã tạo bảng đấu trống: "${emptyTrack.name}" (ID: ${emptyTrack._id})`);

  // Kiểm tra lại với logic cũ: Chắc chắn sẽ bị CHẶN vì Bảng D không có Rankings!
  console.log('- Đang kiểm tra theo logic cũ (quét mọi bảng đấu không lọc):');
  const allTracks = await Track.find({ roundId: round._id });
  let oldLogicBlocked = false;
  for (const t of allTracks) {
    const rankingsExist = await Ranking.exists({ roundId: round._id, trackId: t._id });
    if (!rankingsExist) {
      oldLogicBlocked = true;
      console.log(`  -> 🛑 Logic cũ chặn thăng hạng vì bảng "${t.name}" chưa khóa điểm.`);
    }
  }

  // Kiểm tra lại với logic mới: Phải vượt qua (PASS) vì Bảng D trống không có đội thi!
  console.log('- Đang kiểm tra theo logic mới (chỉ quét bảng có đội thi):');
  const newTracksWithTeams = await Team.distinct('trackId', {
    eventId: event._id,
    trackId: { $in: allTracks.map(t => t._id) },
    status: 'confirmed'
  });

  let newLogicBlocked = false;
  for (const trackId of newTracksWithTeams) {
    const rankingsExist = await Ranking.exists({ roundId: round._id, trackId });
    if (!rankingsExist) {
      newLogicBlocked = true;
      const track = allTracks.find(t => t._id.toString() === trackId.toString());
      console.log(`  -> 🛑 Logic mới chặn thăng hạng vì bảng "${track.name}" chưa khóa điểm.`);
    }
  }

  if (oldLogicBlocked && !newLogicBlocked) {
    console.log('✅ THỬ NGHIỆM 2: ĐẠT YÊU CẦU (Logic mới đã bỏ qua bảng đấu trống thành công, không chặn thăng hạng!).');
  } else {
    console.log('❌ THỬ NGHIỆM 2: THẤT BẠI.');
  }

  // Dọn dẹp empty track
  await Track.deleteOne({ _id: emptyTrack._id });
  console.log('\n- Đã dọn dẹp bảng đấu trống thử nghiệm.');
  
  await mongoose.disconnect();
  console.log('Disconnected.');
}

testAdvanceRoundLogic().catch(console.error);
