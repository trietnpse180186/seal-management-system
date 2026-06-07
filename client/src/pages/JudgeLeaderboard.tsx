import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Trophy,
  RefreshCw,
  Award,
  Users,
  Search,
  CheckSquare
} from "lucide-react";
import CustomSelect from "../components/CustomSelect";

export default function JudgeLeaderboard() {
  const token = localStorage.getItem("token");

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedRound, setSelectedRound] = useState<any>(null);

  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch events
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/events")
      .then((res) => {
        setEvents(res.data);
        if (res.data.length > 0) setSelectedEventId(res.data[0]._id);
      })
      .catch((err) => console.error(err));
  }, []);

  // Fetch rounds for selected event
  useEffect(() => {
    if (!selectedEventId) return;
    axios
      .get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res) => {
        setRounds(res.data.rounds || []);
        if (res.data.rounds && res.data.rounds.length > 0) {
          setSelectedRoundId(res.data.rounds[0]._id);
          setSelectedRound(res.data.rounds[0]);
        } else {
          setSelectedRoundId("");
          setSelectedRound(null);
        }
      })
      .catch((err) => console.error(err));
  }, [selectedEventId]);

  const fetchRankings = useCallback(async () => {
    if (!selectedRoundId) {
      setStandings([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:5000/api/grades/judge-ranking/${selectedRoundId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStandings(res.data.standings || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching judge rankings:", err);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRoundId, token]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  // Auto-refresh every 30s for active viewing
  useEffect(() => {
    if (!selectedRoundId) return;
    const interval = setInterval(() => {
      fetchRankings();
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedRoundId, fetchRankings]);

  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId);
    const round = rounds.find((r: any) => r._id === roundId);
    setSelectedRound(round || null);
  };

  const filteredStandings = standings.filter(
    (item) =>
      item.teamId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.teamId?.topicSubmission?.title
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/10 p-3 rounded-xl text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Trophy size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              Bảng Xếp Hạng Giám Khảo
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Xem xếp hạng thời gian thực dựa trên điểm trung bình của Ban giám khảo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <Users size={12} />
            Chế độ Giám khảo
          </span>

          <button
            onClick={fetchRankings}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 hover:text-white text-slate-300 border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Selectors and Search */}
      <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1 tracking-wider font-mono">
              Cuộc thi
            </label>
            <CustomSelect
              value={selectedEventId}
              onChange={(val) => setSelectedEventId(val)}
              options={events.map((e: any) => ({
                value: e._id,
                label: e.name,
              }))}
              className="w-56"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1 tracking-wider font-mono">
              Vòng đấu
            </label>
            <CustomSelect
              value={selectedRoundId}
              onChange={(val) => handleRoundChange(val)}
              options={rounds.map((r: any) => ({
                value: r._id,
                label: r.name,
              }))}
              placeholder="Không có vòng đấu"
              className="w-56"
            />
          </div>

          {selectedRound?.status === "completed" && (
            <div className="self-end pb-0.5">
              <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                <CheckSquare size={12} />
                Đã khóa & Công bố
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm đội, đề tài..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-xl text-xs pl-9 pr-4 py-2 w-full text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all"
          />
        </div>
      </div>

      {/* Standings Table Card */}
      <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden">
        {lastUpdated && (
          <div className="bg-slate-950/40 px-6 py-3 border-b border-white/5 flex justify-between items-center text-[9px] font-bold text-slate-400 tracking-wider font-mono uppercase">
            <span>Danh sách xếp hạng tạm thời (Live)</span>
            <span>Cập nhật lúc: {lastUpdated.toLocaleTimeString("vi-VN")}</span>
          </div>
        )}

        {loading && standings.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            <RefreshCw size={24} className="animate-spin mx-auto text-cyan-400 mb-2" />
            Đang tải bảng xếp hạng...
          </div>
        ) : filteredStandings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 uppercase tracking-wider text-[9px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-4 px-6 w-20 text-center">Hạng</th>
                  <th className="py-4 px-6">Tên Đội</th>
                  <th className="py-4 px-6">Đề Tài Dự Án</th>
                  <th className="py-4 px-6 text-center">Số Lượt Chấm</th>
                  <th className="py-4 px-6 text-center">Điểm Trung Bình</th>
                  <th className="py-4 px-6 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredStandings.map((row: any, idx: number) => {
                  const rank = row.rank ?? idx + 1;
                  const rankStyles =
                    rank === 1
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                      : rank === 2
                        ? "bg-slate-300/10 text-slate-300 border-slate-400/25 shadow-[0_0_10px_rgba(203,213,225,0.1)]"
                        : rank === 3
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.15)]"
                          : "bg-slate-950/40 text-slate-400 border-white/5";

                  return (
                    <tr
                      key={row.teamId?._id || idx}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors duration-200"
                    >
                      <td className="py-4 px-6 text-center font-black">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full border font-bold ${rankStyles}`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-extrabold text-slate-100 text-sm block">
                          {row.teamId?.name}
                        </span>
                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                          ID: {row.teamId?._id?.slice(-6)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-200 block max-w-xs truncate">
                          {row.teamId?.topicSubmission?.title || "Chưa nộp đề tài"}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate mt-0.5 max-w-xs leading-relaxed">
                          {row.teamId?.topicSubmission?.description || "Không có mô tả chi tiết."}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center text-slate-300 font-medium">
                        <span className="bg-slate-950/60 text-slate-300 px-2 py-1 rounded text-[10px] font-bold border border-white/5">
                          {row.judgeCount} Giám khảo
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-cyan-400 font-black text-sm drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                          {row.averageScore != null ? row.averageScore.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {selectedRound?.status !== "completed" ? (
                          <span className="inline-flex items-center bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">
                            Đang Đánh Giá
                          </span>
                        ) : row.isAdvanced ? (
                          <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                            Đã Đi Tiếp
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-slate-950/40 text-slate-500 border border-white/5 px-2 py-0.5 rounded text-[10px] font-medium uppercase">
                            Dừng Bước
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500 bg-slate-900/10 border border-white/5 rounded-2xl">
            <Award size={36} className="mx-auto text-slate-600 mb-2" />
            <p className="text-xs font-bold uppercase tracking-wider">Không có dữ liệu xếp hạng</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
              Không tìm thấy kết quả xếp hạng nào cho vòng đấu hiện tại hoặc chưa có điểm số nào được nộp.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
