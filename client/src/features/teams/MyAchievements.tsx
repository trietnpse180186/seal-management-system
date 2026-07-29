import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Award, Trophy, Users } from "lucide-react";

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
        const res = await axios.get("/api/teams/history", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const resData = res.data;
        const teamHistory: TeamHistory[] = Array.isArray(resData) 
          ? resData 
          : Array.isArray(resData?.teams) 
          ? resData.teams 
          : Array.isArray(resData?.history) 
          ? resData.history 
          : [];
        setTeams(teamHistory);

        // Fetch achievements/rankings for each past team
        const achievementsMap: { [teamId: string]: any[] } = {};
        const requests = teamHistory.map(async (t: TeamHistory) => {
          try {
            const achRes = await axios.get(`/api/grades/team/${t._id}/achievements`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            return { id: t._id, data: achRes.data || [] };
          } catch (err: any) {
            console.warn(`Lỗi tải thành tích cho đội ${t.name}:`, err?.message || err);
            return { id: t._id, data: [] };
          }
        });

        const results = await Promise.allSettled(requests);
        results.forEach((res) => {
          if (res.status === 'fulfilled' && res.value) {
            achievementsMap[res.value.id] = res.value.data;
          }
        });
        setAchievements(achievementsMap);
      } catch (err: any) {
        console.warn("Lỗi tải lịch sử đội thi:", err?.message || err);
        setTeams([]);
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
      <div className="team-area-light relative overflow-hidden font-sans bg-[#faf9f6] text-slate-800 min-h-screen flex items-center justify-center font-mono">
        <p className="text-slate-500 text-sm animate-pulse">Đang tải thành tích lịch sử...</p>
      </div>
    );
  }

  return (
    <div className="team-area-light relative overflow-hidden font-sans bg-[#faf9f6] text-slate-800 min-h-screen">
      {/* Background Grid & Glow */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 font-mono">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3">
          <Award size={32} className="text-[#F27024]" />
          <span className="text-slate-800 font-mono-tech">THÀNH TÍCH CỦA TÔI</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1.5">
          Lịch sử các đội thi và thứ hạng bạn đã đạt được qua các mùa Hackathon
        </p>
      </div>

      {!Array.isArray(teams) || teams.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl text-center max-w-xl mx-auto space-y-4 border border-slate-200 shadow-sm">
          <Trophy size={48} className="mx-auto text-slate-400" />
          <p className="text-sm font-bold text-slate-700">Bạn chưa có thành tích nào</p>
          <div className="pt-2">
            <button
              onClick={() => navigate("/guest-portal")}
              className="px-6 py-2.5 bg-[#F27024] hover:bg-[#d95f1f] !text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer font-sans shadow-md shadow-orange-500/20"
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
                className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 relative overflow-hidden text-slate-800"
              >
                {/* Team & Event Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-[#F27024] border border-[#F27024]/20 px-3 py-1 rounded-xl bg-[#F27024]/10 tracking-wider">
                        Cuộc thi: {t.event?.name}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                      Đội: {t.name}
                    </h3>
                  </div>
                  <div className="text-right font-sans">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-wider">HỌC KỲ</span>
                    <span className="text-xs font-bold text-slate-600 font-mono">
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

                          const roundName = ach.roundId?.name || "";
                          const isFinalRound = 
                            roundName.toLowerCase() === "chung kết" || 
                            roundName.toLowerCase().includes("chung kết") || 
                            roundName.toLowerCase() === "final";

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
                                  {!isFinalRound && (
                                    <>
                                       {ach.isAdvanced ? (
                                         <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                                           ĐÃ ĐI TIẾP
                                         </span>
                                       ) : ach.roundId?.status === "completed" ? (
                                         <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-bold">
                                           DỪNG BƯỚC
                                         </span>
                                       ) : (
                                        <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold animate-pulse">
                                          ĐANG CHẤM
                                        </span>
                                      )}
                                    </>
                                  )}


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
    </div>
  );
}
