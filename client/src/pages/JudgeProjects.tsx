import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "axios";
import { Search, Check, ChevronRight, AlertCircle } from "lucide-react";

export default function JudgeProjects() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");

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

  // Fetch events
  useEffect(() => {
    axiosInstance
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
    axiosInstance
      .get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res: any) => {
        setRounds(res.data.rounds || []);
        if (res.data.rounds && res.data.rounds.length > 0) {
          setSelectedRoundId(res.data.rounds[0]._id);
        } else {
          setSelectedRoundId("");
        }
      })
      .catch((err: any) => console.error(err));
  }, [selectedEventId]);

  // Fetch teams & scores
  useEffect(() => {
    if (!selectedRoundId) {
      setTeams([]);
      return;
    }
    setLoading(true);
    axiosInstance
      .get(`http://localhost:5000/api/teams/all/${selectedEventId}`, {
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
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Dự án cần chấm điểm
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Đánh giá và chấm điểm chất lượng mã nguồn, giải pháp kỹ thuật của
            các đội thi.
          </p>
        </div>
      </div>

      {/* Selectors & Filter Row */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
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

        {/* Filter Tab buttons & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Tìm kiếm dự án, đội..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-full text-xs pl-9 pr-4 py-2 w-full text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-all ${
                statusFilter === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-all ${
                statusFilter === "pending"
                  ? "bg-amber-500 text-black shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Chưa chấm
            </button>
            <button
              onClick={() => setStatusFilter("graded")}
              className={`px-3 py-1 text-[10px] font-bold rounded uppercase transition-all ${
                statusFilter === "graded"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Đã chấm
            </button>
          </div>
        </div>
      </div>

      {/* Projects Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-xs animate-pulse font-mono">
            [ĐANG TẢI DANH SÁCH DỰ ÁN...]
          </div>
        ) : filteredTeams.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  <th className="px-6 py-4">Tên đội thi (Team)</th>
                  <th className="px-6 py-4">Đề tài & Giải pháp</th>
                  <th className="px-6 py-4">Trạng thái chấm</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredTeams.map((team) => {
                  const isGraded = gradedTeams[team._id];
                  const scoreObj = teamScores[team._id];
                  return (
                    <tr
                      key={team._id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Column 1: Team Info */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-150 flex items-center justify-center text-blue-600 font-extrabold font-mono">
                            {team.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 block">
                              {team.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              ID: {team._id.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Topic */}
                      <td className="px-6 py-5">
                        <div className="max-w-md">
                          <span className="font-bold text-slate-800 block truncate">
                            {team.topicSubmission?.title || "Chưa nộp đề tài"}
                          </span>
                          <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                            {team.topicSubmission?.description ||
                              "Không có mô tả chi tiết từ đội."}
                          </span>
                        </div>
                      </td>

                      {/* Column 3: Status */}
                      <td className="px-6 py-5 whitespace-nowrap">
                        {isGraded ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-sm">
                            <Check size={10} /> Đã chấm (
                            {scoreObj?.totalWeightedScore}/10)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-sm">
                            Chờ chấm
                          </span>
                        )}
                      </td>

                      {/* Column 4: Action */}
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <button
                          onClick={() => navigate(`/judge/score/${team._id}`)}
                          className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm ${
                            isGraded
                              ? "bg-slate-100 border border-slate-200 text-slate-650 hover:bg-slate-200"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
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
          <div className="text-center py-20 text-slate-400 py-24 bg-slate-50/20">
            <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs uppercase tracking-wider">
              Không tìm thấy đội thi nào phù hợp với bộ lọc.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
