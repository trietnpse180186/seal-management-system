import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Timer, Activity, Play, ArrowRight } from "lucide-react";

export default function JudgeDashboard() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");

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

  const currentRound = rounds.find((r: any) => r._id === selectedRoundId);

  // Fetch events
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/events")
      .then((res: any) => {
        setEvents(res.data);
        if (res.data.length > 0) {
          setSelectedEventId(res.data[0]._id);
        }
      })
      .catch((err: any) => console.error(err));
  }, []);

  // Fetch event details (rounds)
  useEffect(() => {
    if (!selectedEventId) return;
    axios
      .get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res: any) => {
        setRounds(res.data.rounds || []);
        if (res.data.rounds && res.data.rounds.length > 0) {
          setSelectedRoundId(res.data.rounds[0]._id);
        }
      })
      .catch((err: any) => console.error(err));
  }, [selectedEventId]);

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
      .get(`http://localhost:5000/api/teams/all/${selectedEventId}`, {
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

  // Countdown timer
  useEffect(() => {
    if (!currentRound?.submissionDeadline) {
      setTimeLeft("CHƯA CÓ HẠN");
      return;
    }
    const interval = setInterval(() => {
      const diff =
        new Date(currentRound.submissionDeadline).getTime() -
        new Date().getTime();
      if (diff <= 0) {
        setTimeLeft("ĐÃ HẾT HẠN");
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentRound]);

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
              Thời gian chấm còn lại
            </p>
            <p className="text-xl font-bold text-rose-400 font-mono tracking-wider drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]">
              {timeLeft}
            </p>
          </div>
        </div>
      </div>

      {/* Selectors Row */}
      <div className="bg-slate-900/40 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
            Cuộc thi
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-slate-800/80 border border-white/10 rounded-lg text-white text-xs px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:outline-none w-56 font-bold shadow-inner"
          >
            {events.map((e: any) => (
              <option key={e._id} value={e._id} className="bg-slate-800 text-white">
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
            Vòng thi
          </label>
          <select
            value={selectedRoundId}
            onChange={(e) => setSelectedRoundId(e.target.value)}
            className="bg-slate-800/80 border border-white/10 rounded-lg text-white text-xs px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:outline-none w-56 font-bold shadow-inner"
          >
            {rounds.map((r: any) => (
              <option key={r._id} value={r._id} className="bg-slate-800 text-white">
                {r.name} (Lấy Top {r.advanceTopN})
              </option>
            ))}
            {rounds.length === 0 && <option className="bg-slate-800 text-white">Không có vòng thi</option>}
          </select>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-xl p-5 border-l-4 border-l-indigo-500 shadow-lg hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Tổng số đội thi
          </p>
          <p className="text-3xl font-black text-white mt-2 font-mono drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            {stats.activeTeamsCount || teams.length}
          </p>
          <p className="text-[9px] text-indigo-400 mt-1 uppercase font-semibold">
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

        <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-xl p-5 border-l-4 border-l-violet-500 shadow-lg hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Hoạt động code gần nhất
          </p>
          <p className="text-sm font-bold text-white mt-4 font-mono truncate drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            {stats.lastSyncTime
              ? new Date(stats.lastSyncTime).toLocaleString("vi-VN")
              : "Chưa cập nhật"}
          </p>
          <p className="text-[9px] text-violet-400 mt-1 uppercase font-semibold">
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
        <div className="bg-gradient-to-r from-indigo-900/40 to-violet-900/40 backdrop-blur-md border border-indigo-500/30 p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(99,102,241,0.15)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.15),transparent_50%)] pointer-events-none"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-indigo-500/20 border border-indigo-500/50 rounded-full flex items-center justify-center text-indigo-400 shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <Play size={20} className="fill-indigo-400 animate-pulse ml-0.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                Tiếp tục phiên làm việc
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Tiếp tục xem chi tiết và chấm điểm cho đội thi:{" "}
                <strong className="text-indigo-300 font-bold drop-shadow-[0_0_5px_rgba(165,180,252,0.5)]">
                  "{lastGradedTeamName}"
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/judge/score/${lastGradedTeamId}?roundId=${selectedRoundId}`)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] transition-all uppercase tracking-wider shrink-0 relative z-10"
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
            onClick={() => navigate("/judge/projects")}
            className="text-indigo-400 hover:text-indigo-300 font-bold text-[10px] uppercase tracking-wider transition-colors drop-shadow-[0_0_5px_rgba(99,102,241,0.3)]"
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
                  onClick={() => navigate(`/judge/activity/${c.teamId}`)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-500/20 bg-indigo-500/10 px-4 py-2 rounded-lg transition-all uppercase tracking-wider shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.1)]"
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
