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
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);

  const activeEvent = [...events].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;

  const formatDateString = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Chưa có thông báo";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Chưa có thông báo";
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  };

  const formatEventDateRange = (startDateStr: string | null | undefined, endDateStr: string | null | undefined) => {
    if (!startDateStr) return "Chưa có thông báo";
    const startStr = formatDateString(startDateStr);
    if (startStr === "Chưa có thông báo") return "Chưa có thông báo";

    if (!endDateStr) {
      return `Bắt đầu từ ${startStr}`;
    }
    
    const endStr = formatDateString(endDateStr);
    if (endStr === "Chưa có thông báo") {
      return `Bắt đầu từ ${startStr}`;
    }

    return `Từ ${startStr} đến ${endStr}`;
  };

  const formatSingleDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Chưa có thông báo";
    const dateStrFormatted = formatDateString(dateStr);
    if (dateStrFormatted === "Chưa có thông báo") return "Chưa có thông báo";
    return `Bắt đầu từ ${dateStrFormatted}`;
  };

  const getPhaseStatus = (phase: number) => {
    if (!activeEvent) {
      return { label: "CHƯA DIỄN RA", classes: "text-slate-500 border border-slate-900 px-1.5 py-0.5 rounded bg-slate-950/20" };
    }

    // If the event itself is completed or cancelled, all phases are ended
    if (activeEvent.status === "completed" || activeEvent.status === "cancelled") {
      return { label: "ĐÃ KẾT THÚC", classes: "text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded bg-slate-900/50" };
    }

    const now = new Date();
    const regOpen = activeEvent.registrationOpen ? new Date(activeEvent.registrationOpen) : null;
    const contestStart = activeEvent.contestStart ? new Date(activeEvent.contestStart) : null;
    const contestEnd = activeEvent.contestEnd ? new Date(activeEvent.contestEnd) : null;

    if (phase === 1) {
      if (!regOpen) {
        return { label: "CHƯA DIỄN RA", classes: "text-slate-500 border border-slate-900 px-1.5 py-0.5 rounded bg-slate-950/20" };
      }
      if (now < regOpen) {
        return { label: "CHƯA DIỄN RA", classes: "text-slate-500 border border-slate-900 px-1.5 py-0.5 rounded bg-slate-950/20" };
      }
      if (contestStart && now >= regOpen && now < contestStart) {
        return { label: "ĐANG DIỄN RA", classes: "text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded bg-cyan-950/20" };
      }
      if (!contestStart) {
        return { label: "ĐANG DIỄN RA", classes: "text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded bg-cyan-950/20" };
      }
      return { label: "ĐÃ KẾT THÚC", classes: "text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded bg-slate-900/50" };
    }

    if (phase === 2) {
      if (!contestStart) {
        return { label: "CHƯA DIỄN RA", classes: "text-slate-500 border border-slate-900 px-1.5 py-0.5 rounded bg-slate-950/20" };
      }
      if (now < contestStart) {
        return { label: "CHƯA DIỄN RA", classes: "text-slate-500 border border-slate-900 px-1.5 py-0.5 rounded bg-slate-950/20" };
      }
      if (contestEnd && now >= contestStart && now < contestEnd) {
        return { label: "ĐANG DIỄN RA", classes: "text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded bg-cyan-950/20" };
      }
      if (!contestEnd) {
        return { label: "ĐANG DIỄN RA", classes: "text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded bg-cyan-950/20" };
      }
      return { label: "ĐÃ KẾT THÚC", classes: "text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded bg-slate-900/50" };
    }

    if (phase === 3) {
      if (!contestEnd) {
        return { label: "CHƯA DIỄN RA", classes: "text-slate-500 border border-slate-900 px-1.5 py-0.5 rounded bg-slate-950/20" };
      }
      if (now < contestEnd) {
        return { label: "CHƯA DIỄN RA", classes: "text-slate-500 border border-slate-900 px-1.5 py-0.5 rounded bg-slate-950/20" };
      }
      return { label: "ĐANG DIỄN RA", classes: "text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded bg-cyan-950/20" };
    }

    return { label: "CHƯA DIỄN RA", classes: "text-slate-500 border border-slate-900 px-1.5 py-0.5 rounded bg-slate-950/20" };
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/events");
        // Show all events that are not in 'draft' status
        setEvents(res.data.filter((e: any) => e.status !== "draft"));
      } catch (err) {
        console.error("Lỗi lấy danh sách cuộc thi:", err);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, []);

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

  const getPhaseStyles = (phaseNum: number) => {
    const statusObj = getPhaseStatus(phaseNum);
    const label = statusObj.label;
    
    let headingClass = "";
    let dateClass = "";
    let descClass = "";
    let renderDot = () => <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-700"></div>;

    if (label === "ĐANG DIỄN RA") {
      headingClass = "text-xs text-cyan-400 text-cyan-glow font-bold uppercase tracking-wider";
      dateClass = "text-[9px] text-cyan-400/80 font-mono";
      descClass = "text-[11px] text-slate-300";
      renderDot = () => (
        <span className="absolute -left-[20px] top-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400 shadow-[0_0_8px_#00f0ff]"></span>
        </span>
      );
    } else if (label === "ĐÃ KẾT THÚC") {
      headingClass = "text-xs text-slate-300 font-bold uppercase tracking-wider";
      dateClass = "text-[9px] text-slate-400 font-mono";
      descClass = "text-[11px] text-slate-400";
      renderDot = () => (
        <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-slate-950 border border-cyan-500"></div>
      );
    } else {
      // CHƯA DIỄN RA
      headingClass = "text-xs text-slate-500 font-bold uppercase tracking-wider";
      dateClass = "text-[9px] text-slate-500 font-mono";
      descClass = "text-[11px] text-slate-500";
      renderDot = () => (
        <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-700"></div>
      );
    }

    return {
      label,
      classes: statusObj.classes,
      headingClass,
      dateClass,
      descClass,
      renderDot
    };
  };

  const phase1 = getPhaseStyles(1);
  const phase2 = getPhaseStyles(2);
  const phase3 = getPhaseStyles(3);

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

      {/* Active Competitions Widget */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Terminal size={18} className="text-cyan-400 shrink-0" />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">
              Cuộc thi hiện có
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 border border-slate-800 px-2 py-1 rounded bg-slate-900/50">
            [SỰ_KIỆN_HỆ_THỐNG]
          </span>
        </div>

        {loadingEvents ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass h-48 rounded-2xl border border-slate-800/80 animate-pulse flex flex-col justify-between p-6 bg-slate-900/10">
                <div className="h-4 bg-slate-850 rounded w-1/3"></div>
                <div className="h-8 bg-slate-850 rounded w-3/4"></div>
                <div className="h-4 bg-slate-850 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.map((e: any) => {
              const maxTeamsVal = e.maxTeams || 10;
              const teamCountVal = e.teamCount || 0;
              const percent = Math.min(100, (teamCountVal / maxTeamsVal) * 100);

              let statusLabel = "";
              let statusColor = "";
              switch (e.status) {
                case "registration":
                  statusLabel = "[MỞ ĐĂNG KÝ]";
                  statusColor = "text-cyan-400";
                  break;
                case "ongoing":
                  statusLabel = "[ĐANG DIỄN RA]";
                  statusColor = "text-amber-400";
                  break;
                case "completed":
                  statusLabel = "[ĐÃ KẾT THÚC]";
                  statusColor = "text-emerald-400";
                  break;
                case "cancelled":
                  statusLabel = "[ĐÃ HỦY]";
                  statusColor = "text-rose-500";
                  break;
                default:
                  statusLabel = `[${e.status.toUpperCase()}]`;
                  statusColor = "text-slate-500";
              }

              return (
                <div
                  key={e._id}
                  className="glass p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(0,240,255,0.08)] transition-all flex flex-col justify-between gap-6 relative overflow-hidden group bg-slate-900/10"
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/0 to-transparent group-hover:via-cyan-500/60 transition-all duration-500"></div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className={`font-bold uppercase tracking-wider ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <span className="text-slate-500 font-semibold font-mono">
                        {e.semester} {e.year}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white font-mono group-hover:text-cyan-400 transition-colors uppercase tracking-tight">
                      {e.name}
                    </h3>

                    <p className="text-xs text-slate-400 font-sans leading-relaxed line-clamp-3">
                      {e.description || "Chưa có mô tả chi tiết cho cuộc thi này."}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-500">Số đội đã đăng ký:</span>
                      <span className="text-slate-300 font-bold">
                        {teamCountVal} / {maxTeamsVal}
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                      <div
                        className="h-full bg-cyan-500 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>

                    {e.status === "registration" && (
                      <button
                        onClick={() => {
                          if (hasTeam) {
                            navigate("/team-area");
                          } else {
                            navigate(`/register-team?eventId=${e._id}`);
                          }
                        }}
                        className="w-full mt-2 py-2 border border-cyan-500/30 rounded-xl bg-cyan-500/10 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-all uppercase tracking-wider text-center cursor-pointer font-mono"
                      >
                        {hasTeam ? "Vào khu vực đội" : "Đăng ký tham gia"}
                      </button>
                    )}
                    
                    {e.status === "ongoing" && (
                      <button
                        onClick={() => navigate("/leaderboard")}
                        className="w-full mt-2 py-2 border border-slate-800 rounded-xl bg-slate-900/40 text-slate-300 text-xs font-bold hover:bg-slate-800/60 hover:text-white transition-all uppercase tracking-wider text-center cursor-pointer font-mono"
                      >
                        Bảng xếp hạng live
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass p-8 rounded-2xl border border-slate-800 text-center text-slate-500 italic text-xs font-mono">
            [HIỆN_TẠI_CHƯA_CÓ_CUỘC_THI_NÀO_ĐƯỢC_CÔNG_BỐ]
          </div>
        )}
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
                <span>Lộ trình cuộc thi {activeEvent ? `- ${activeEvent.name}` : ''}</span>
              </h2>
              <span className="text-[10px] text-slate-400 border border-slate-800 px-2 py-1 rounded bg-slate-900/50">
                [LỘ_TRÌNH]
              </span>
            </div>

            <div className="relative pl-4 space-y-6 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
              {/* Phase 1 */}
              <div className="relative pl-6">
                {phase1.renderDot()}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                  <h3 className={phase1.headingClass}>
                    Giai đoạn 1: Mở đăng ký
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={phase1.dateClass}>
                      {formatEventDateRange(activeEvent?.registrationOpen, activeEvent?.registrationClose || activeEvent?.contestStart)}
                    </span>
                    <span className={`text-[9px] ${phase1.classes}`}>
                      {phase1.label}
                    </span>
                  </div>
                </div>
                <p className={phase1.descClass}>
                  Các đội thi thực hiện đăng ký tài khoản, liên kết thành viên nhóm và liên kết repository Github chính thức để chuẩn bị nhận nhiệm vụ.
                </p>
              </div>

              {/* Phase 2 */}
              <div className="relative pl-6">
                {phase2.renderDot()}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                  <h3 className={phase2.headingClass}>
                    Giai đoạn 2: Bắt đầu thi đấu
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={phase2.dateClass}>
                      {formatEventDateRange(activeEvent?.contestStart, activeEvent?.contestEnd)}
                    </span>
                    <span className={`text-[9px] ${phase2.classes}`}>
                      {phase2.label}
                    </span>
                  </div>
                </div>
                <p className={phase2.descClass}>
                  Giai đoạn lập trình cường độ cao. Các đội thực hiện giải quyết yêu cầu dự án, liên tục push commit để AI tự động phân tích và đánh giá chất lượng mã nguồn.
                </p>
              </div>

              {/* Phase 3 */}
              <div className="relative pl-6">
                {phase3.renderDot()}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                  <h3 className={phase3.headingClass}>
                    Giai đoạn 3: Kết thúc và tổng kết
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={phase3.dateClass}>
                      {formatSingleDate(activeEvent?.contestEnd)}
                    </span>
                    <span className={`text-[9px] ${phase3.classes}`}>
                      {phase3.label}
                    </span>
                  </div>
                </div>
                <p className={phase3.descClass}>
                  Dừng cổng nộp bài, đóng repository. Các đội thi chuẩn bị báo cáo dự án trước hội đồng giám khảo và nhận kết quả xếp hạng chung cuộc từ hệ thống.
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
