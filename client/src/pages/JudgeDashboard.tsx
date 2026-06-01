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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Tổng quan
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Theo dõi tiến độ chấm điểm và cập nhật Git thời gian thực của các
            đội thi.
          </p>
        </div>

        {/* Countdown Badge */}
        <div className="bg-white border border-slate-200 px-6 py-3.5 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-2 bg-rose-50 border border-rose-100 rounded-full">
            <Timer className="text-rose-500" size={20} />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              Thời gian chấm còn lại
            </p>
            <p className="text-xl font-bold text-slate-800 font-mono tracking-wider">
              {timeLeft}
            </p>
          </div>
        </div>
      </div>

      {/* Selectors Row */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
            Cuộc thi
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs px-3 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none w-56 font-bold"
          >
            {events.map((e: any) => (
              <option key={e._id} value={e._id}>
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
            className="bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs px-3 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none w-56 font-bold"
          >
            {rounds.map((r: any) => (
              <option key={r._id} value={r._id}>
                {r.name} (Lấy Top {r.advanceTopN})
              </option>
            ))}
            {rounds.length === 0 && <option>Không có vòng thi</option>}
          </select>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Tổng số đội thi
          </p>
          <p className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {stats.activeTeamsCount || teams.length}
          </p>
          <p className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">
            Tham gia sự kiện
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Push Per-Push (Đã tải)
          </p>
          <p className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {stats.perPushCount || allCommits.length}
          </p>
          <p className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">
            Đồng bộ từ webhook
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 border-l-4 border-l-indigo-600 shadow-sm hover:shadow-md transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Hoạt động code gần nhất
          </p>
          <p className="text-sm font-bold text-slate-900 mt-4 font-mono truncate">
            {stats.lastSyncTime
              ? new Date(stats.lastSyncTime).toLocaleString("vi-VN")
              : "Chưa cập nhật"}
          </p>
          <p className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">
            {getSyncTimeElapsed(stats.lastSyncTime)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 border-l-4 border-l-purple-600 shadow-sm hover:shadow-md transition-all">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            Tổng bản ghi đã tải
          </p>
          <p className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {stats.totalRecords || 215}
          </p>
          <p className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">
            Tối đa 1000 bản ghi
          </p>
        </div>
      </div>

      {/* Quick Resume Grading Banner */}
      {lastGradedTeamId && (
        <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border border-slate-200 p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 border border-blue-200 rounded-full flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
              <Play size={20} className="fill-blue-600 animate-pulse ml-0.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                Tiếp tục phiên làm việc
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Tiếp tục xem chi tiết và chấm điểm cho đội thi:{" "}
                <strong className="text-blue-600 font-bold">
                  "{lastGradedTeamName}"
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/judge/score/${lastGradedTeamId}`)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-lg shadow-sm transition-all uppercase tracking-wider shrink-0"
          >
            Vào Bàn Chấm Điểm
          </button>
        </div>
      )}

      {/* Recent Activity Feed */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Activity size={14} className="text-blue-600" />
            <span>Hoạt động Git gần nhất từ các đội ({allCommits.length})</span>
          </h3>
          <button
            onClick={() => navigate("/judge/projects")}
            className="text-blue-600 hover:text-blue-700 font-bold text-[10px] uppercase tracking-wider transition-colors"
          >
            Xem tất cả dự án &rarr;
          </button>
        </div>

        <div className="p-6 max-h-[500px] overflow-y-auto space-y-4">
          {commitsLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs animate-pulse font-mono">
              [ĐANG TẢI DỮ LIỆU HOẠT ĐỘNG GIT...]
            </div>
          ) : allCommits.length > 0 ? (
            allCommits.slice(0, 10).map((c, idx) => (
              <div
                key={c._id || idx}
                className="bg-slate-50/40 border border-slate-100 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-200 hover:bg-slate-50/80 transition-all"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-200/80 border border-slate-300 px-2 py-0.5 rounded">
                      {c.teamName}
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold font-mono">
                      @{c.authorGithubUsername || c.authorName}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      [{c.commitSha?.slice(0, 8) || "sha"}]
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {getSyncTimeElapsed(c.committedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-mono leading-relaxed truncate">
                    {c.message}
                  </p>
                  <div className="flex items-center gap-3 text-[9px] text-slate-500 font-mono">
                    <span className="text-emerald-600 font-bold">
                      +{c.additions} lines
                    </span>
                    <span className="text-rose-600 font-bold">
                      -{c.deletions} lines
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/judge/activity/${c.teamId}`)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-blue-650 hover:text-white border border-blue-600/30 hover:border-blue-600 hover:bg-blue-600 bg-blue-50/50 px-4 py-2 rounded-lg transition-all uppercase tracking-wider shrink-0 shadow-sm"
                >
                  <span>Hoạt động</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-12 bg-slate-50/20 rounded-xl border border-slate-200 shadow-sm">
              [CHƯA CÓ HOẠT ĐỘNG GIT NÀO ĐƯỢC GHI NHẬN]
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
