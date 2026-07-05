import { useNavigate } from 'react-router-dom';
import { Award, Users, CheckSquare } from 'lucide-react';

export default function ExpertDashboard({ user, roles = [] }: any) {
  const navigate = useNavigate();
  const isSystemAdmin = user?.isSystemAdmin;
  const isJudge = roles?.some((r: any) => r.role === 'judge') || isSystemAdmin;
  const isMentor = roles?.some((r: any) => r.role === 'mentor') || isSystemAdmin;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Grid of Roles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Judge Section */}
        {isJudge && (
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Award size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wider">Hội Đồng Giám Khảo</h3>
                <p className="text-slate-400 text-xs">
                  Thực hiện chấm điểm các dự án thi đấu, đánh giá các tiêu chí chuyên môn và xem xét lịch sử hoạt động mã nguồn của các đội thi trong bảng đấu được giao.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/expert/projects')}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-wider rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2"
            >
              <CheckSquare size={14} /> Đi tới Danh sách Chấm điểm
            </button>
          </div>
        )}

        {/* Mentor Section */}
        {isMentor && (
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Users size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wider">Cố Vấn & Hướng Dẫn</h3>
                <p className="text-slate-400 text-xs">
                  Theo dõi tiến độ hoàn thành đề tài, kiểm tra mã nguồn, hỗ trợ kỹ thuật và giao tiếp trực tiếp qua kênh trao đổi thảo luận với các đội thi được phân công hướng dẫn.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/expert/mentored-teams')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
            >
              <Users size={14} /> Đi tới Các Đội Hướng Dẫn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
