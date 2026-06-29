const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EventSchema = new Schema({
  name: { type: String, required: true },
  semester: { type: String, enum: ['Spring', 'Summer', 'Fall'], required: true },
  year: { type: Number, required: true },
  description: { type: String },
  bannerUrl: { type: String },
  registrationOpen: { type: Date },
  registrationClose: { type: Date },
  contestStart: { type: Date },
  contestEnd: { type: Date },
  maxTeams: { type: Number },
  status: { type: String, enum: ['draft', 'registration', 'prepare', 'ongoing', 'completed', 'cancelled'], default: 'draft' },
  githubOrgName: { type: String },
  githubOrgCreated: { type: Boolean, default: false },
  attachments: { type: Schema.Types.Mixed, default: [] },
  commitSyncInterval: { type: Number, default: 30 },
  mainGoal: { 
    type: String, 
    default: 'Phát triển các giải pháp sáng tạo để giải quyết bài toán thực tế và xây dựng hệ thống phần mềm chất lượng. Các đội thi cần tối ưu mã nguồn, liên kết repository và tối ưu hóa hệ thống dưới sự hỗ trợ của AI.' 
  },
  durationText: { 
    type: String, 
    default: '48 GIỜ' 
  },
  memberLimitText: { 
    type: String, 
    default: '2-4 OPERATORS' 
  },
  prizePoolText: { 
    type: String, 
    default: '$50,000 USD' 
  },
  phase1Description: { 
    type: String, 
    default: 'Các đội thi thực hiện đăng ký tài khoản, liên kết thành viên nhóm và liên kết repository Github chính thức để chuẩn bị nhận nhiệm vụ.' 
  },
  phase2Description: { 
    type: String, 
    default: 'Giai đoạn lập trình cường độ cao. Các đội thực hiện giải quyết yêu cầu dự án, liên tục push commit để AI tự động phân tích và đánh giá chất lượng mã nguồn.' 
  },
  phase3Description: { 
    type: String, 
    default: 'Dừng cổng nộp bài, đóng repository. Các đội thi chuẩn bị báo cáo dự án trước hội đồng giám khảo và nhận kết quả xếp hạng chung cuộc từ hệ thống.' 
  },
  rules: { 
    type: [Schema.Types.Mixed], 
    default: [
      { title: 'Mã nguồn tự viết', description: 'Tất cả các dòng code chính và sản phẩm phải được viết trong thời gian diễn ra cuộc thi. Các thư viện và framework có sẵn được phép sử dụng nếu là mã nguồn mở.' },
      { title: 'Giới hạn đội thi', description: 'Mỗi đội phải có từ 2 đến 4 thành viên. Không cho phép tham gia cá nhân hoặc đội thi có số lượng vượt mức quy định.' },
      { title: 'Ranh giới Đạo đức', description: 'Bất kỳ hành vi gian lận hoặc tấn công phá hoại hạ tầng bên ngoài phạm vi quy định sẽ dẫn đến việc truất quyền thi đấu ngay lập tức.' }
    ]
  },
  seminar: {
    scheduledAt: { type: Date },
    scheduledEnd: { type: Date },
    meetUrl: { type: String },
    title: { type: String, default: 'Buổi Seminar Hướng Dẫn & Giải Đáp Thắc Mắc Cuộc Thi' },
    description: { type: String },
    isEmailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    attendanceFormUrl: { type: String },
    attendanceSpreadsheetUrl: { type: String }
  }
}, {
  timestamps: true
});

EventSchema.index({ semester: 1, year: 1 }, { unique: true });
EventSchema.index({ status: 1 });

module.exports = mongoose.model('Event', EventSchema);