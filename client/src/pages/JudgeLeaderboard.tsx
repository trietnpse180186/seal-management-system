import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  BarChart3,
  CheckSquare,
  Lock,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

export default function JudgeLeaderboard() {
  const token = localStorage.getItem("token");

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedRound, setSelectedRound] = useState<any>(null);

  const [standings, setStandings] = useState<any[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedMessage, setLockedMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  // Fetch event details (rounds)
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
      // Judges only see leaderboard when officially published
      const res = await axios.get(
        `http://localhost:5000/api/grades/leaderboard/${selectedRoundId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.locked) {
        setIsLocked(true);
        setLockedMessage(res.data.message || "Bảng xếp hạng chưa được công bố.");
        setStandings([]);
      } else {
        setIsLocked(false);
        setLockedMessage("");
        setStandings(res.data.standings || []);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRoundId, token]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId);
    const round = rounds.find((r: any) => r._id === roundId);
    setSelectedRound(round || null);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              Bảng Xếp Hạng Chung Cuộc
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Xem kết quả xếp hạng chính thức sau khi ban tổ chức đã công bố.
            </p>
          </div>
        </div>

        {lastUpdated && (
          <div className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
            <span className="text-slate-400 font-mono">
              Cập nhật: {lastUpdated.toLocaleTimeString("vi-VN")}
            </span>
            <button
              onClick={fetchRankings}
              disabled={loading}
              className="text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        )}
      </div>

      {/* Selectors Row */}
      <div className="glass p-6 rounded-2xl flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Cuộc thi
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs w-48"
          >
            {events.map((e: any) => (
              <option key={e._id} value={e._id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Vòng đấu (Round)
          </label>
          <select
            value={selectedRoundId}
            onChange={(e) => handleRoundChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs w-48"
          >
            {rounds.map((r: any) => (
              <option key={r._id} value={r._id}>
                {r.name} (Lấy Top {r.advanceTopN})
              </option>
            ))}
            {rounds.length === 0 && <option>Không có vòng thi</option>}
          </select>
        </div>

        {/* Round status pill */}
        {selectedRound?.status === "completed" && (
          <div className="ml-2">
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
              Trạng thái vòng
            </label>
            <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold">
              <CheckSquare size={12} />
              Đã khóa &amp; Công bố
            </span>
          </div>
        )}
      </div>

      {/* Standings Table */}
      <div className="glass p-6 rounded-3xl relative overflow-hidden">
        {loading ? (
          <div className="text-center py-24 text-slate-500 text-xs animate-pulse font-mono">
            [ĐANG TẢI BẢNG XẾP HẠNG...]
          </div>
        ) : isLocked ? (
          <div className="text-center py-24">
            <Lock size={40} className="mx-auto text-slate-700 mb-3 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
            <h3 className="font-bold text-slate-400 text-sm uppercase tracking-wider">
              Bảng điểm đang được bảo mật
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
              {lockedMessage ||
                "Bảng xếp hạng sẽ tự động hiển thị tại đây sau khi ban tổ chức tiến hành chốt khoá điểm thi và xếp hạng cuối cùng."}
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
                      className="border-b border-slate-800/60 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Rank */}
                      <td className="py-4 px-4 text-center font-black">
                        {rank <= 3 ? (
                          <span className="text-2xl leading-none">
                            {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-base font-black ${rankStyles}`}
                          >
                            {rank}
                          </span>
                        )}
                      </td>

                      {/* Team Name */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-100 text-sm block">
                          {row.teamId?.name}
                        </span>
                        {row.trackName && (
                          <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono mt-1 inline-block">
                            Bảng: {row.trackName}{" "}
                            {row.trackRank ? `(Hạng ${row.trackRank})` : ""}
                          </span>
                        )}
                      </td>

                      {/* Avg Score */}
                      <td className="py-4 px-4 text-center font-black text-cyan-400 text-sm">
                        {row.averageScore != null
                          ? row.averageScore.toFixed(2)
                          : "—"}
                        <span className="text-slate-500 text-[10px] font-normal">/10đ</span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        {selectedRound?.status !== "completed" ? null : row.isAdvanced ? (
                          <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md text-[10px] font-bold">
                            <CheckSquare size={10} /> ĐÃ ĐI TIẾP
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 bg-slate-800 text-slate-500 border border-slate-700 px-2 py-1 rounded-md text-[10px]">
                            Dừng bước
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
          <div className="text-center py-24">
            <AlertCircle size={36} className="mx-auto text-slate-700 mb-2 drop-shadow-[0_0_5px_rgba(100,116,139,0.5)]" />
            <BarChart3 size={24} className="mx-auto text-slate-700 mb-3" />
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Không có dữ liệu xếp hạng nào trong vòng thi này.
            </p>
            <p className="text-[10px] text-slate-600 max-w-sm mx-auto mt-1">
              Bảng xếp hạng sẽ tự động hiển thị tại đây sau khi ban tổ chức tiến hành chốt khoá điểm thi và xếp hạng cuối cùng.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
