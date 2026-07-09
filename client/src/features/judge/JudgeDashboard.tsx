import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Timer, Activity, Play, ArrowRight } from "lucide-react";

export default function JudgeDashboard() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [activeRound, setActiveRound] = useState<any>(null);
  const [assignedTrack, setAssignedTrack] = useState<any>(null);

  const [teams, setTeams] = useState<any[]>([]);
  const [lastGradedTeamId, setLastGradedTeamId] = useState<string | null>(null);
  const [lastGradedTeamName, setLastGradedTeamName] = useState<string>("");

  const [stats, setStats] = useState({
    activeTeamsCount: 0,
    perPushCount: 0,
    totalRecords: 0,
    lastSyncTime: "",
  });

  const [allCommits, setAllCommits] = useState<any[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState("00:00:00");
  const [timerLabel, setTimerLabel] = useState("Thời gian chấm còn lại");

  // Fetch active contest details
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/events/judge/active-contest", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res: any) => {
        if (res.data.event) {
          setActiveEvent(res.data.event);
          setSelectedEventId(res.data.event._id);

          if (res.data.currentRound) {
            setActiveRound(res.data.currentRound);
            setSelectedRoundId(res.data.currentRound._id);
          }

          if (res.data.assignedTrack) {
            setAssignedTrack(res.data.assignedTrack);
          } else if (res.data.tracks && res.data.tracks.length > 0) {
            setAssignedTrack(res.data.tracks[0]);
          }
        }
      })
      .catch((err: any) => console.error("Error fetching active contest:", err));
  }, [token]);

  // Fetch AI stats
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/ai-analyses/stats", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res: any) => {
        setStats(res.data);
      })
      .catch((err: any) => console.error("Error fetching stats:", err));
  }, [token]);

  // Fetch Teams and find last graded team
  useEffect(() => {
    if (!selectedEventId) return;
    axios
      .get(`http://localhost:5000/api/teams/all/${selectedEventId}?roundId=${selectedRoundId}&role=judge`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(async (res: any) => {
        const confirmed = res.data.filter((t: any) => t.status === "confirmed");
        setTeams(confirmed);

        if (confirmed.length > 0) {
          // Default last graded team to the first team
          setLastGradedTeamId(confirmed[0]._id);
          setLastGradedTeamName(confirmed[0].name);

          // Let's check which team was actually recently graded
          for (const team of confirmed) {
            try {
              const gradeRes = await axios.get(
                `http://localhost:5000/api/grades/team/${team._id}/round/${selectedRoundId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (gradeRes.data && gradeRes.data.score) {
                setLastGradedTeamId(team._id);
                setLastGradedTeamName(team.name);
                break;
              }
            } catch (e) {
              // ignore
            }
          }
        }
      })
      .catch((err: any) => console.error(err));
  }, [selectedEventId, selectedRoundId, token]);

  // Fetch Commits from all teams
  useEffect(() => {
    if (teams.length === 0) {
      setAllCommits([]);
      return;
    }

    const fetchAllCommits = async () => {
      setCommitsLoading(true);
      const commitList: any[] = [];
      await Promise.all(
        teams.map(async (team) => {
          try {
            const res = await axios.get(
              `http://localhost:5000/api/analytics/team/${team._id}/commits`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (Array.isArray(res.data)) {
              const commitsWithTeam = res.data.map((c) => ({
                ...c,
                teamName: team.name,
                teamId: team._id,
              }));
              commitList.push(...commitsWithTeam);
            }
          } catch (err) {
            console.error("Failed to fetch commits for team:", team.name, err);
          }
        }),
      );

      commitList.sort(
        (a, b) =>
          new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime(),
      );
      setAllCommits(commitList);
      setCommitsLoading(false);
    };

    fetchAllCommits();
  }, [teams, token]);

  // Countdown timer based on track schedules
  useEffect(() => {
    if (!assignedTrack) {
      setTimeLeft("CHƯA CÓ LỊCH");
      setTimerLabel("Thời gian thi đấu");
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const startTime = assignedTrack.startTime ? new Date(assignedTrack.startTime).getTime() : 0;
      const endTime = assignedTrack.endTime ? new Date(assignedTrack.endTime).getTime() : 0;
      const gradingEndTime = assignedTrack.gradingEndTime ? new Date(assignedTrack.gradingEndTime).getTime() : 0;

      if (startTime && now < startTime) {
        setTimerLabel("Trạng thái bảng đấu");
        setTimeLeft("CHƯA BẮT ĐẦU THI");
      } else if (endTime && now < endTime) {
        setTimerLabel("Thời gian làm bài còn lại");
        const diff = endTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      } else if (gradingEndTime && now < gradingEndTime) {
        setTimerLabel("Thời gian chấm còn lại");
        const diff = gradingEndTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      } else {
        setTimerLabel("Trạng thái bảng đấu");
        setTimeLeft("ĐÃ HẾT HẠN CHẤM");
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [assignedTrack]);

  const getSyncTimeElapsed = (dateStr: string) => {
    if (!dateStr) return "Chưa có hoạt động";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `${diffDays} ngày trước`;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) return `${diffHours} giờ trước`;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins} phút trước`;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Title & Countdown Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
            Tổng quan
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Theo dõi tiến độ chấm điểm và cập nhật Git thời gian thực của các
            đội thi.
          </p>
        </div>

        {/* Countdown Badge */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 px-6 py-3.5 rounded-xl flex items-center gap-4 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.3)]">
            <Timer className="text-rose-400" size={20} />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              {timerLabel}
            </p>
            <p className="text-xl font-bold text-rose-400 font-mono tracking-wider drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]">
              {timeLeft}
            </p>
          </div>
        </div>
      </div>

      {/* Selectors Row (Read-only Active Contest Info) */}
      <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-lg flex flex-wrap gap-8 items-center animate-fadeIn">
        {activeEvent ? (
          <>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Cuộc thi đang diễn ra</p>
              <p className="text-sm font-extrabold text-white mt-1 font-mono uppercase drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                {activeEvent.name}
              </p>
            </div>
            <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Vòng thi hiện tại</p>
              <p className="text-sm font-extrabold text-cyan-400 mt-1 font-mono uppercase drop-shadow-[0_0_5px_rgba(34,211,238,0.2)]">
                {activeRound ? (activeRound.advanceTopN > 0 ? `${activeRound.name} (Lấy Top ${activeRound.advanceTopN})` : activeRound.name) : "Không có vòng thi active"}
              </p>
            </div>
            {assignedTrack && (
              <>
                <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Bảng đấu được phân công</p>
                  <p className="text-sm font-extrabold text-teal-400 mt-1 font-mono uppercase drop-shadow-[0_0_5px_rgba(20,184,166,0.2)]">
                    {assignedTrack.name}
                  </p>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-xs text-rose-400 font-semibold font-mono uppercase">
            Hiện tại không có cuộc thi nào đang diễn ra (Ongoing).
          </div>
        )}
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-xl p-5 border-l-4 border-l-cyan-500 shadow-lg hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Tổng số đội thi
          </p>
          <p className="text-3xl font-black text-white mt-2 font-mono drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            {stats.activeTeamsCount || teams.length}
          </p>
          <p className="text-[9px] text-cyan-400 mt-1 uppercase font-semibold">
            Tham gia sự kiện
          </p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-xl p-5 border-l-4 border-l-cyan-500 shadow-lg hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Push Per-Push (Đã tải)
          </p>
          <p className="text-3xl font-black text-white mt-2 font-mono drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            {stats.perPushCount || allCommits.length}
          </p>
          <p className="text-[9px] text-cyan-400 mt-1 uppercase font-semibold">
            Đồng bộ từ webhook
          </p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-xl p-5 border-l-4 border-l-teal-500 shadow-lg hover:shadow-[0_0_15px_rgba(20,184,166,0.2)] transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Hoạt động code gần nhất
          </p>
          <p className="text-sm font-bold text-white mt-4 font-mono truncate drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            {stats.lastSyncTime
              ? new Date(stats.lastSyncTime).toLocaleString("vi-VN")
              : "Chưa cập nhật"}
          </p>
          <p className="text-[9px] text-teal-400 mt-1 uppercase font-semibold">
            {getSyncTimeElapsed(stats.lastSyncTime)}
          </p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-xl p-5 border-l-4 border-l-pink-500 shadow-lg hover:shadow-[0_0_15px_rgba(236,72,153,0.2)] transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Tổng bản ghi đã tải
          </p>
          <p className="text-3xl font-black text-white mt-2 font-mono drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            {stats.totalRecords || 215}
          </p>
          <p className="text-[9px] text-pink-400 mt-1 uppercase font-semibold">
            Tối đa 1000 bản ghi
          </p>
        </div>
      </div>

      {/* Quick Resume Grading Banner */}
      {lastGradedTeamId && (
        <div className="bg-gradient-to-r from-cyan-950/40 to-teal-950/40 backdrop-blur-md border border-cyan-500/30 p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(6,182,212,0.15)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.15),transparent_50%)] pointer-events-none"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-cyan-500/20 border border-cyan-500/50 rounded-full flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Play size={20} className="fill-cyan-400 animate-pulse ml-0.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                Tiếp tục phiên làm việc
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Tiếp tục xem chi tiết và chấm điểm cho đội thi:{" "}
                <strong className="text-cyan-300 font-bold drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">
                  "{lastGradedTeamName}"
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/expert/score/${lastGradedTeamId}?roundId=${selectedRoundId}`)}
            className="bg-cyan-500 hover:bg-cyan-500 text-white font-bold text-xs px-6 py-3 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all uppercase tracking-wider shrink-0 relative z-10"
          >
            Vào Bàn Chấm Điểm
          </button>
        </div>
      )}

      {/* Recent Activity Feed */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-lg rounded-xl flex flex-col">
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-900/60">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity size={14} className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" />
            <span className="drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">Hoạt động Git gần nhất từ các đội ({allCommits.length})</span>
          </h3>
          <button
            onClick={() => navigate("/expert/projects")}
            className="text-cyan-400 hover:text-cyan-300 font-bold text-[10px] uppercase tracking-wider transition-colors drop-shadow-[0_0_5px_rgba(6,182,212,0.3)]"
          >
            Xem tất cả dự án &rarr;
          </button>
        </div>

        <div className="p-6 max-h-[500px] overflow-y-auto space-y-4">
          {commitsLoading ? (
            <div className="text-center py-12 text-slate-500 text-xs animate-pulse font-mono">
              [ĐANG TẢI DỮ LIỆU HOẠT ĐỘNG GIT...]
            </div>
          ) : allCommits.length > 0 ? (
            allCommits.slice(0, 10).map((c, idx) => (
              <div
                key={c._id || idx}
                className="bg-slate-800/40 border border-white/5 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-white/10 hover:bg-slate-800/60 transition-all shadow-inner"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-white bg-slate-700/80 border border-slate-600 px-2 py-0.5 rounded shadow-sm">
                      {c.teamName}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-semibold font-mono drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]">
                      @{c.authorGithubUsername || c.authorName}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      [{c.commitSha?.slice(0, 8) || "sha"}]
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {getSyncTimeElapsed(c.committedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed truncate">
                    {c.message}
                  </p>
                  <div className="flex items-center gap-3 text-[9px] text-slate-400 font-mono">
                    <span className="text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]">
                      +{c.additions} lines
                    </span>
                    <span className="text-rose-400 font-bold drop-shadow-[0_0_5px_rgba(251,113,133,0.3)]">
                      -{c.deletions} lines
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/expert/activity/${c.teamId}`)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-300 hover:text-white border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 bg-cyan-500/10 px-4 py-2 rounded-lg transition-all uppercase tracking-wider shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                >
                  <span>Hoạt động</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic text-center py-12 bg-slate-800/20 rounded-xl border border-white/5 shadow-sm">
              [CHƯA CÓ HOẠT ĐỘNG GIT NÀO ĐƯỢC GHI NHẬN]
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
