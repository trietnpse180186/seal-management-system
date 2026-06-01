import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Terminal,
  ArrowRight,
  Shield,
  Compass,
  Scale,
  Users,
  DollarSign,
  Cpu,
} from "lucide-react";

interface GuestPortalProps {
  user: any;
}

export default function GuestPortal({ user }: GuestPortalProps) {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkTeamStatus = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/teams/my-team", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data && res.data.team) {
          setHasTeam(true);
          setTeamName(res.data.team.name);
        } else {
          setHasTeam(false);
        }
      } catch (err) {
        setHasTeam(false);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      checkTeamStatus();
    } else {
      setLoading(false);
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <Terminal size={32} className="mx-auto text-cyan-400 animate-pulse" />
          <p className="text-cyan-400 text-sm tracking-widest animate-pulse">
            [ACCESSING_PORTAL_TERMINAL...]
          </p>
        </div>
      </div>
    );
  }

  const displayName = user?.fullName || "GUEST_USER";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 font-mono">
      {/* Hero Section */}
      <section className="relative overflow-hidden border border-outline-variant/30 bg-surface-container-high/40 backdrop-blur-md p-8 flex flex-col md:flex-row items-center justify-between gap-8 rounded-2xl transition-all hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.05)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="flex-1 space-y-6 z-10">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="text-xs text-cyan-400 tracking-widest uppercase">
              [TRẠNG_THÁI: HOẠT_ĐỘNG]
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl text-white font-extrabold tracking-tight">
            Chào mừng trở lại,{" "}
            <span className="text-cyan-400 text-cyan-glow font-mono-tech">
              {displayName}
            </span>
            .
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            {hasTeam
              ? `Hệ thống của bạn đang hoạt động. Bạn hiện đã tham gia đội thi "${teamName}". Hãy truy cập khu vực quản lý của đội thi để xem nhiệm vụ dự án, đồng bộ commits và kiểm tra đánh giá từ AI.`
              : "Hệ thống của bạn đang hoạt động. Cuộc thi SEAL Hackathon đang chờ bạn nhập thông tin. Bạn đã sẵn sàng khởi tạo các tham số nhiệm vụ và gia nhập một đội chưa?"}
          </p>

          <div className="pt-2">
            {hasTeam ? (
              <button
                onClick={() => navigate("/team-area")}
                className="btn-primary font-bold px-8 py-3 uppercase tracking-wider flex items-center gap-2"
              >
                <Terminal size={18} />
                <span>Vào Khu vực Đội thi</span>
              </button>
            ) : (
              <button
                onClick={() => navigate("/register-team")}
                className="btn-primary font-bold px-8 py-3 uppercase tracking-wider flex items-center gap-2"
              >
                <Users size={18} />
                <span>Hoàn tất đăng ký đội</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 relative h-64 md:h-80 w-full rounded-xl border border-slate-800 overflow-hidden bg-slate-950/50">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-80 mix-blend-screen"
            src="/mp_.mp4"
          />
          <div className="absolute inset-0 border border-cyan-500/20 pointer-events-none rounded-xl"></div>
        </div>
      </section>

      {/* Intelligence & Roadmap Grid */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Event Intelligence Panel */}
        <div className="col-span-1 md:col-span-5 glass p-6 rounded-2xl flex flex-col justify-between border border-slate-800 hover:border-cyan-500/30 transition-all">
          <div>
            <div className="border-b border-slate-800 pb-3 mb-6 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield size={18} className="text-cyan-400" />
                <span>Thông tin cuộc thi</span>
              </h2>
              <span className="text-[10px] text-slate-400 border border-slate-800 px-2 py-1 rounded bg-slate-900/50">
                [TỔNG_QUAN]
              </span>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-2">
                  Mục tiêu chính
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Phát triển các giải pháp sáng tạo để giải quyết bài toán thực
                  tế và xây dựng hệ thống phần mềm chất lượng. Các đội thi cần
                  tối ưu mã nguồn, liên kết repository và tối ưu hóa hệ thống
                  dưới sự hỗ trợ của AI.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-800 p-3 bg-slate-900/30 rounded-xl">
                  <div className="text-[9px] text-slate-500 mb-1">
                    THỜI GIAN
                  </div>
                  <div className="text-sm font-bold text-white">48 GIỜ</div>
                </div>
                <div className="border border-slate-800 p-3 bg-slate-900/30 rounded-xl">
                  <div className="text-[9px] text-slate-500 mb-1">
                    SỐ THÀNH VIÊN
                  </div>
                  <div className="text-sm font-bold text-white">
                    2-4 OPERATORS
                  </div>
                </div>
                <div className="border border-slate-800 p-3 bg-slate-900/30 rounded-xl col-span-2 flex justify-between items-center">
                  <div>
                    <div className="text-[9px] text-slate-500 mb-1">
                      QUỸ GIẢI THƯỞNG
                    </div>
                    <div className="text-sm font-bold text-cyan-400">
                      $50,000 USD
                    </div>
                  </div>
                  <DollarSign size={20} className="text-cyan-400/40" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mission Roadmap Panel */}
        <div className="col-span-1 md:col-span-7 glass p-6 rounded-2xl flex flex-col justify-between border border-slate-800 hover:border-cyan-500/30 transition-all">
          <div>
            <div className="border-b border-slate-800 pb-3 mb-6 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass size={18} className="text-cyan-400" />
                <span>Lộ trình cuộc thi</span>
              </h2>
              <span className="text-[10px] text-slate-400 border border-slate-800 px-2 py-1 rounded bg-slate-900/50">
                [LỘ_TRÌNH]
              </span>
            </div>

            <div className="relative pl-4 space-y-6 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
              {/* Phase 1 */}
              <div className="relative pl-6">
                <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-slate-950 border border-cyan-500"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                  <h3 className="text-xs text-white font-bold uppercase tracking-wider">
                    Giai đoạn 1: Thành lập đội & Lên ý tưởng
                  </h3>
                  <span className="text-[9px] text-slate-500">
                    TRƯỚC 2 NGÀY
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Kết nối với các thí sinh khác, thành lập nhóm và phác thảo các
                  ý tưởng dự án ban đầu.
                </p>
              </div>

              {/* Phase 2 (Active) */}
              <div className="relative pl-6">
                <span className="absolute -left-[20px] top-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                  <h3 className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                    Giai đoạn 2: Phát triển sản phẩm (Coding)
                  </h3>
                  <span className="text-[9px] text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded bg-cyan-950/20">
                    ĐANG DIỄN RA
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Truy cập vào môi trường lập trình. Viết code, đồng bộ commit
                  và chuẩn bị phiên bản sản phẩm cuối cùng.
                </p>
              </div>

              {/* Phase 3 */}
              <div className="relative pl-6">
                <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-700"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                  <h3 className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Giai đoạn 3: Báo cáo & Thuyết trình
                  </h3>
                  <span className="text-[9px] text-slate-600">CHƯA MỞ</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Thuyết trình về phương pháp, tính năng sản phẩm và giải pháp
                  của đội trước ban giám khảo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Protocols Grid */}
      <section className="glass p-6 rounded-2xl border border-slate-800">
        <div className="border-b border-slate-800 pb-3 mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Scale size={18} className="text-cyan-400" />
            <span>Quy định cuộc thi</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-4 border border-slate-850 hover:border-cyan-500/40 transition-colors bg-slate-900/20 rounded-xl">
            <Cpu size={24} className="text-cyan-400 mb-3" />
            <h3 className="text-xs text-white font-bold uppercase tracking-wider mb-2">
              Mã nguồn tự viết
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tất cả các dòng code chính và sản phẩm phải được viết trong thời
              gian diễn ra cuộc thi. Các thư viện và framework có sẵn được phép
              sử dụng nếu là mã nguồn mở.
            </p>
          </div>
          <div className="p-4 border border-slate-850 hover:border-cyan-500/40 transition-colors bg-slate-900/20 rounded-xl">
            <Users size={24} className="text-cyan-400 mb-3" />
            <h3 className="text-xs text-white font-bold uppercase tracking-wider mb-2">
              Giới hạn đội thi
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Mỗi đội phải có từ 2 đến 4 thành viên. Không cho phép tham gia cá
              nhân hoặc đội thi có số lượng vượt mức quy định.
            </p>
          </div>
          <div className="p-4 border border-slate-850 hover:border-cyan-500/40 transition-colors bg-slate-900/20 rounded-xl">
            <Shield size={24} className="text-cyan-400 mb-3" />
            <h3 className="text-xs text-white font-bold uppercase tracking-wider mb-2">
              Ranh giới Đạo đức
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Bất kỳ hành vi gian lận hoặc tấn công phá hoại hạ tầng bên ngoài
              phạm vi quy định sẽ dẫn đến việc truất quyền thi đấu ngay lập tức.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-4 flex justify-center">
        {hasTeam ? (
          <button
            onClick={() => navigate("/team-area")}
            className="btn-primary font-bold text-sm px-12 py-4 uppercase tracking-widest flex items-center gap-2 group"
          >
            <span>Tiếp tục vào Khu vực Đội thi</span>
            <ArrowRight
              size={16}
              className="group-hover:translate-x-1 transition-transform"
            />
          </button>
        ) : (
          <button
            onClick={() => navigate("/register-team")}
            className="btn-primary font-bold text-sm px-12 py-4 uppercase tracking-widest flex items-center gap-2 group"
          >
            <span>Đăng ký thành lập đội thi</span>
            <ArrowRight
              size={16}
              className="group-hover:translate-x-1 transition-transform"
            />
          </button>
        )}
      </section>
    </div>
  );
}
