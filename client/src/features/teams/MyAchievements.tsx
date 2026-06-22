import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Award, Trophy, Users, ArrowRight } from "lucide-react";

interface TeamHistory {
  _id: string;
  name: string;
  event: {
    _id: string;
    name: string;
    semester: string;
    year: number;
    status: string;
  };
  members: Array<{
    fullName: string;
    email: string;
    studentId: string;
    githubUsername: string;
    university: string;
  }>;
}

export default function MyAchievements() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamHistory[]>([]);
  const [achievements, setAchievements] = useState<{ [teamId: string]: any[] }>({});

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/teams/history", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const teamHistory = res.data || [];
        setTeams(teamHistory);

        // Fetch achievements/rankings for each past team
        const achievementsMap: { [teamId: string]: any[] } = {};
        for (const t of teamHistory) {
          try {
            const achRes = await axios.get(`http://localhost:5000/api/grades/team/${t._id}/achievements`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            achievementsMap[t._id] = achRes.data || [];
          } catch (err) {
            console.error(`Lỗi tải thành tích cho đội ${t.name}:`, err);
            achievementsMap[t._id] = [];
          }
        }
        setAchievements(achievementsMap);
      } catch (err) {
        console.error("Lỗi tải lịch sử đội thi:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [token]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center font-mono">
        <p className="text-slate-400 text-sm animate-pulse">Đang tải thành tích lịch sử...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 font-mono">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <Award size={32} className="text-cyan-400 text-cyan-glow" />
          <span className="text-cyan-400 text-cyan-glow font-mono-tech">THÀNH TÍCH CỦA TÔI</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1.5">
          Lịch sử các đội thi và thứ hạng bạn đã đạt được qua các mùa Hackathon
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="glass p-12 rounded-3xl border border-slate-800 text-center text-slate-500 max-w-xl mx-auto space-y-4">
          <Trophy size={48} className="mx-auto text-slate-700 animate-pulse" />
          <p className="text-sm font-semibold text-slate-400">Chưa tìm thấy thành tích lịch sử nào</p>
          <p className="text-xs text-slate-500 font-sans leading-relaxed">
            Bạn chưa hoàn tất tham gia đội thi nào trong quá khứ hoặc chưa xác nhận tham gia. Hãy đăng ký đội thi ở cuộc thi mới nhất để bắt đầu hành trình của mình!
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate("/guest-portal")}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer font-sans"
            >
              Trở về Trang chủ
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {teams.map((t) => {
            const teamAchievements = achievements[t._id] || [];
            
            return (
              <div
                key={t._id}
                className="glass p-6 md:p-8 rounded-3xl border border-slate-800 hover:border-cyan-500/20 transition-all space-y-6 relative overflow-hidden bg-slate-900/10"
              >
                {/* Background glow decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

                {/* Team & Event Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-cyan-400 font-bold border border-cyan-500/30 px-2 py-0.5 rounded bg-cyan-950/20 tracking-wider">
                      {t.event?.name}
                    </span>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight text-cyan-glow">
                      Đội: {t.name}
                    </h3>
                  </div>
                  <div className="text-right font-sans">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">HỌC KỲ</span>
                    <span className="text-xs font-bold text-slate-300 font-mono">
                      Kỳ {t.event?.semester} {t.event?.year}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left block (Col 4): Members List */}
                  <div className="lg:col-span-4 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase font-mono-tech border-b border-slate-800/60 pb-2">
                      <Users size={14} className="text-cyan-400" />
                      <span>Đồng đội của bạn</span>
                    </h4>
                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                      {t.members.map((m, idx) => (
                        <div key={idx} className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl space-y-0.5">
                          <p className="text-xs font-bold text-slate-200">{m.fullName}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{m.email}</p>
                        </div>
                      ))}
                      {t.members.length === 0 && (
                        <p className="text-xs text-slate-550 italic font-sans py-2">Không có thành viên nào khác.</p>
                      )}
                    </div>
                  </div>

                  {/* Right block (Col 8): Achievements / Round Rankings */}
                  <div className="lg:col-span-8 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase font-mono-tech border-b border-slate-800/60 pb-2">
                      <Trophy size={14} className="text-cyan-400" />
                      <span>Thành tích các vòng đấu</span>
                    </h4>

                    {teamAchievements.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {teamAchievements.map((ach) => {
                          const rank = ach.rank || 1;
                          const rankColor = 
                            rank === 1 ? "text-amber-400 bg-amber-500/10 border-amber-500/30 font-black shadow-[0_0_10px_rgba(245,158,11,0.15)]" :
                            rank === 2 ? "text-slate-300 bg-slate-300/10 border-slate-300/30" :
                            rank === 3 ? "text-amber-600 bg-amber-700/10 border-amber-800/30" :
                            "text-slate-400 bg-slate-800/40 border-slate-700/30";

                          return (
                            <div
                              key={ach._id}
                              className="border border-slate-800/80 p-4 bg-slate-900/30 rounded-2xl flex flex-col justify-between gap-4 hover:border-cyan-500/30 transition-all group"
                            >
                              <div className="space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <h5 className="text-xs font-bold text-white uppercase truncate font-mono-tech">
                                    Vòng: {ach.roundId?.name}
                                  </h5>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${rankColor}`}>
                                    Hạng {rank}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-500">
                                  <span>Bảng đấu: <span className="text-slate-350 font-bold">{ach.trackId?.name}</span></span>
                                  <span>Số GK: <span className="text-slate-350 font-bold">{ach.judgeCount}</span></span>
                                </div>
                              </div>

                              <div className="flex justify-between items-center border-t border-slate-800/60 pt-3">
                                <div>
                                  <span className="text-[9px] text-slate-500 block uppercase">ĐIỂM TRUNG BÌNH</span>
                                  <span className="text-sm font-extrabold text-cyan-400 font-mono-tech">
                                    {ach.averageScore != null ? ach.averageScore.toFixed(2) : "—"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {ach.isAdvanced ? (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                                      ĐÃ ĐI TIẾP
                                    </span>
                                  ) : ach.roundId?.status === "completed" ? (
                                    <span className="text-[9px] bg-slate-800 text-slate-500 border border-slate-750 px-2 py-0.5 rounded">
                                      DỪNG BƯỚC
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold animate-pulse">
                                      ĐANG CHẤM
                                    </span>
                                  )}

                                  <button
                                    onClick={() => navigate(`/leaderboard?eventId=${t.event?._id}&roundId=${ach.roundId?._id}`)}
                                    className="p-1.5 bg-slate-900/60 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 border border-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title="Xem toàn bộ bảng xếp hạng vòng này"
                                  >
                                    <ArrowRight size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="glass p-6 rounded-2xl border border-slate-800/50 text-center text-slate-500 italic text-xs py-10 font-sans">
                        Chưa có bảng điểm hay xếp hạng chính thức nào được công bố cho đội của bạn ở cuộc thi này.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
