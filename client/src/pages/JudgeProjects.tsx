import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "axios";
import { Search, Check, ChevronRight, AlertCircle } from "lucide-react";

export default function JudgeProjects() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [activeRound, setActiveRound] = useState<any>(null);
  const [assignedTrack, setAssignedTrack] = useState<any>(null);

  const [teams, setTeams] = useState<any[]>([]);
  const [gradedTeams, setGradedTeams] = useState<{ [teamId: string]: boolean }>(
    {},
  );
  const [teamScores, setTeamScores] = useState<{ [teamId: string]: any }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "graded"
  >("all");
  const [loading, setLoading] = useState(false);

  // Fetch active contest details
  useEffect(() => {
    axiosInstance
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

  // Fetch teams & scores
  useEffect(() => {
    if (!selectedRoundId) {
      setTeams([]);
      return;
    }
    setLoading(true);
    axiosInstance
      .get(`http://localhost:5000/api/teams/all/${selectedEventId}?roundId=${selectedRoundId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(async (res: any) => {
        const confirmed = res.data.filter((t: any) => t.status === "confirmed");
        setTeams(confirmed);

        // Fetch scores for each team
        const statusMap: { [teamId: string]: boolean } = {};
        const scoreMap: { [teamId: string]: any } = {};

        await Promise.all(
          confirmed.map(async (team: any) => {
            try {
              const gradeRes = await axiosInstance.get(
                `http://localhost:5000/api/grades/team/${team._id}/round/${selectedRoundId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (gradeRes.data && gradeRes.data.score) {
                statusMap[team._id] = true;
                scoreMap[team._id] = gradeRes.data.score;
              } else {
                statusMap[team._id] = false;
              }
            } catch (err) {
              statusMap[team._id] = false;
            }
          }),
        );

        setGradedTeams(statusMap);
        setTeamScores(scoreMap);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedRoundId, selectedEventId, token]);

  const filteredTeams = teams.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.topicSubmission?.title &&
        t.topicSubmission.title
          .toLowerCase()
          .includes(searchQuery.toLowerCase()));

    const isGraded = gradedTeams[t._id];
    const matchFilter =
      statusFilter === "all" ||
      (statusFilter === "graded" && isGraded) ||
      (statusFilter === "pending" && !isGraded);

    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
            Dự án cần chấm điểm
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Đánh giá và chấm điểm chất lượng mã nguồn, giải pháp kỹ thuật của
            các đội thi.
          </p>
        </div>
      </div>

      {/* Selectors & Filter Row */}
      <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-xl border border-white/10 shadow-lg flex flex-col md:flex-row gap-6 justify-between items-start md:items-center animate-fadeIn">
        <div className="flex flex-wrap gap-8 items-center w-full md:w-auto">
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
                  {activeRound ? `${activeRound.name} (Lấy Top ${activeRound.advanceTopN})` : "Không có vòng thi active"}
                </p>
              </div>
              {assignedTrack && (
                <>
                  <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Bảng đấu của bạn</p>
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

        {/* Filter Tab buttons & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Tìm kiếm dự án, đội..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800/80 border border-white/10 rounded-full text-xs pl-9 pr-4 py-2 w-full text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 shadow-inner"
            />
          </div>

          <div className="flex bg-slate-900/60 p-0.5 rounded-lg border border-white/5 shrink-0 shadow-inner">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-all ${statusFilter === "all"
                  ? "bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                  : "text-slate-500 hover:text-slate-300"
                }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-all ${statusFilter === "pending"
                  ? "bg-amber-500 text-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                  : "text-slate-500 hover:text-slate-300"
                }`}
            >
              Chưa chấm
            </button>
            <button
              onClick={() => setStatusFilter("graded")}
              className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-all ${statusFilter === "graded"
                  ? "bg-emerald-500 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                  : "text-slate-500 hover:text-slate-300"
                }`}
            >
              Đã chấm
            </button>
          </div>
        </div>
      </div>

      {/* Projects Data Table */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-xs animate-pulse font-mono">
            [ĐANG TẢI DANH SÁCH DỰ ÁN...]
          </div>
        ) : filteredTeams.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-white/10 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="px-6 py-4">Tên đội thi (Team)</th>
                  <th className="px-6 py-4">Đề tài & Giải pháp</th>
                  <th className="px-6 py-4">Trạng thái chấm</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {filteredTeams.map((team) => {
                  const isGraded = gradedTeams[team._id];
                  const scoreObj = teamScores[team._id];
                  return (
                    <tr
                      key={team._id}
                      className="hover:bg-cyan-950/20 transition-colors"
                    >
                      {/* Column 1: Team Info */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-extrabold font-mono shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                            {team.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-extrabold text-white block drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
                              {team.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              ID: {team._id.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Topic */}
                      <td className="px-6 py-5">
                        <div className="max-w-md">
                          <span className="font-bold text-white block truncate">
                            {team.topicSubmission?.title || "Chưa nộp đề tài"}
                          </span>
                          <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                            {team.topicSubmission?.description ||
                              "Không có mô tả chi tiết từ đội."}
                          </span>
                        </div>
                      </td>

                      {/* Column 3: Status */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        {isGraded ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                            <Check size={10} /> Đã chấm (
                            {scoreObj?.totalWeightedScore}/10)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                            Chờ chấm
                          </span>
                        )}
                      </td>

                      {/* Column 4: Action */}
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <button
                          onClick={() => navigate(`/judge/score/${team._id}?roundId=${selectedRoundId}`)}
                          className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] ${isGraded
                              ? "bg-slate-800 border border-white/10 text-slate-300 hover:bg-slate-700 hover:text-white"
                              : "bg-cyan-500 hover:bg-cyan-500 text-white hover:shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                            }`}
                        >
                          <span>{isGraded ? "Xem & Sửa" : "Bắt đầu chấm"}</span>
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 py-24 bg-slate-900/20">
            <AlertCircle size={36} className="mx-auto text-slate-500 mb-2 drop-shadow-[0_0_5px_rgba(100,116,139,0.5)]" />
            <p className="text-xs uppercase tracking-wider text-slate-400">
              Không tìm thấy đội thi nào phù hợp với bộ lọc.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
