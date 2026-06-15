import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  BarChart3,
  CheckSquare,
  Lock,
  RefreshCw,
  Radio,
} from "lucide-react";
import CustomSelect from "../shared/CustomSelect";

export default function Leaderboard({
  user,
  roles = [],
}: {
  user?: any;
  roles?: any[];
}) {
  const token = localStorage.getItem("token");

  // Detect user role
  const isSystemAdmin = user?.isSystemAdmin;

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedRound, setSelectedRound] = useState<any>(null);

  const [standings, setStandings] = useState<any[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lockedMessage, setLockedMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Detect if coordinator for selectedEvent
  const isCoordinator =
    isSystemAdmin ||
    roles.some(
      (r: any) => r.eventId === selectedEventId && r.role === "coordinator",
    );

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/events")
      .then((res) => {
        setEvents(res.data);
        if (res.data.length > 0) setSelectedEventId(res.data[0]._id);
      })
      .catch((err) => console.error(err));
  }, []);

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
      if (isCoordinator && selectedRound?.status !== "completed") {
        // Coordinator: use live-ranking for real-time view
        const res = await axios.get(
          `http://localhost:5000/api/grades/live-ranking/${selectedRoundId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setStandings(res.data.standings || []);
        setIsLive(res.data.isLive || true);
        setIsLocked(false);
        setLockedMessage("");
      } else {
        // Non-coordinator or completed round: use normal leaderboard
        const res = await axios.get(
          `http://localhost:5000/api/grades/leaderboard/${selectedRoundId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.data.locked) {
          setIsLocked(true);
          setLockedMessage(res.data.message || "");
          setStandings([]);
        } else {
          setIsLocked(false);
          setLockedMessage("");
          setStandings(res.data.standings || []);
        }
        setIsLive(false);
      }
    } catch (err) {
      console.error(err);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRoundId, isCoordinator, token, selectedRound]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  // Auto-refresh every 30s for coordinator (real-time)
  useEffect(() => {
    if (!isCoordinator || !selectedRoundId) return;
    const interval = setInterval(() => {
      fetchRankings();
    }, 30000);
    return () => clearInterval(interval);
  }, [isCoordinator, selectedRoundId, fetchRankings]);

  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId);
    const round = rounds.find((r: any) => r._id === roundId);
    setSelectedRound(round || null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 font-mono">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white">
              <span className="text-cyan-400 text-cyan-glow font-mono-tech">BẢNG XẾP HẠNG CHUNG CUỘC</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Thứ hạng của các đội thi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live badge for coordinator */}
          {isCoordinator && isLive && (
            <span className="flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse">
              <Radio size={12} />
              LIVE — Cập nhật mỗi 30 giây
            </span>
          )}



          {/* Manual refresh for coordinator */}
          {isCoordinator && (
            <button
              onClick={fetchRankings}
              disabled={loading}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Làm mới
            </button>
          )}
        </div>
      </div>

      {/* Selectors */}
      <div className="glass p-6 rounded-2xl flex flex-wrap gap-4 items-center border border-slate-800 hover:border-cyan-500/20 transition-all relative z-20">
        <div className="relative z-20">
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Cuộc thi
          </label>
          <CustomSelect
            value={selectedEventId}
            onChange={(val) => setSelectedEventId(val)}
            options={events.map((e: any) => ({
              value: e._id,
              label: e.name,
            }))}
            className="w-48"
          />
        </div>

        <div className="relative z-20">
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Vòng đấu (Round)
          </label>
          <CustomSelect
            value={selectedRoundId}
            onChange={(val) => handleRoundChange(val)}
            options={rounds.map((r: any) => ({
              value: r._id,
              label: r.name,
            }))}
            placeholder="Không có vòng đấu"
            className="w-48"
          />
        </div>

        {/* Round status pill */}
        {selectedRound?.status === "completed" && (
          <div className="ml-2">
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
              Trạng thái vòng
            </label>
            <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold">
              <CheckSquare size={12} />
              Đã khóa & Công bố
            </span>
          </div>
        )}
      </div>

      {/* Standings Grid Table */}
      <div className="glass p-6 rounded-3xl relative overflow-hidden border border-slate-800 hover:border-cyan-500/30 transition-all z-5">
        {/* Coordinator live header */}
        {isCoordinator && isLive && standings.length > 0 && (
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-800">
            <Radio size={14} className="text-rose-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-300">
              Bảng xếp hạng tạm thời (Live) —{" "}
              <span className="text-rose-400">{standings.length} đội</span> —
              Điểm TB từ{" "}
              {standings.reduce(
                (max: number, s: any) => Math.max(max, s.judgeCount),
                0,
              )}{" "}
              giám khảo (tối đa)
            </span>
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-500 py-12 text-xs">
            Đang tải bảng điểm xếp hạng...
          </p>
        ) : isLocked ? (
          /* Locked state for non-coordinator */
          <div className="text-center text-slate-500 py-16 z-5">
            <Lock size={36} className="mx-auto text-slate-700 mb-3" />
            <p className="text-sm font-semibold text-slate-400">
              Bảng xếp hạng chưa được công bố
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
              {lockedMessage ||
                "Bảng xếp hạng sẽ tự động hiển thị sau khi ban tổ chức tiến hành chốt khóa điểm thi và xếp hạng cuối cùng."}
            </p>
          </div>
        ) : standings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-4 px-4 w-[15%] text-center">Thứ Hạng</th>
                  <th className="py-4 px-4 w-[45%]">Tên Đội Thi</th>
                  <th className="py-4 px-4 w-[20%] text-center">Điểm Trung Bình</th>
                  <th className="py-4 px-4 w-[20%] text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row: any, idx: number) => {
                  const rank = row.rank ?? idx + 1;
                  const rankStyles =
                    rank === 1
                      ? "text-amber-400 bg-amber-500/10"
                      : rank === 2
                        ? "text-slate-300 bg-slate-300/10"
                        : rank === 3
                          ? "text-amber-600 bg-amber-700/10"
                          : "text-slate-400 bg-slate-800/40";

                  return (
                    <tr
                      key={row._id || row.teamId?._id || idx}
                      className="border-b border-slate-800/60 hover:bg-white/2 transition-colors"
                    >
                      <td className="py-4 px-4 text-center font-black">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${rankStyles}`}
                        >
                          {rank}
                        </span>
                        {isCoordinator && isLive && (
                          <span className="block text-[8px] text-rose-400 font-bold mt-0.5">
                            LIVE
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-100 text-sm">
                        {row.teamId?.name}
                      </td>

                      <td className="py-4 px-4 text-center font-black text-cyan-400 text-sm font-mono-tech">
                        {row.averageScore != null
                          ? row.averageScore.toFixed(2)
                          : "—"}
                        {isCoordinator && isLive && row.judgeCount === 0 && (
                          <span className="block text-[9px] text-slate-500 font-normal font-sans">
                            Chưa có điểm
                          </span>
                        )}
                      </td>



                      <td className="py-4 px-4 text-center">
                        {selectedRound?.status !==
                          "completed" ? // Round not finalized: leave status cell empty
                          null : // Round finalized: show official advancement status
                          row.isAdvanced ? (
                            <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md text-[10px] font-bold">
                              <CheckSquare size={10} /> ĐÃ ĐI TIẾP
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 bg-slate-800 text-slate-500 border border-slate-700 px-2 py-1 rounded-md text-[10px]">
                              Bị loại
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
          <div className="text-center text-slate-500 py-16 z-5">
            <BarChart3 size={32} className="mx-auto text-slate-700 mb-2" />
            <p className="text-xs">Bảng xếp hạng chưa được công bố.</p>
            <p className="text-[10px] text-slate-600 max-w-sm mx-auto mt-1">
              {isCoordinator
                ? "Chưa có giám khảo nào nộp điểm cho vòng này."
                : "Bảng xếp hạng sẽ tự động hiển thị tại đây sau khi ban tổ chức tiến hành chốt khoá điểm thi và xếp hạng cuối cùng."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
