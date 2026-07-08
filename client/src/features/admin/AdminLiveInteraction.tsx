import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { 
  Sparkles, 
  Tv, 
  ListFilter, 
  UserCheck, 
  Edit3, 
  Save, 
  Activity, 
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import CustomSelect from "../shared/CustomSelect";

export default function AdminLiveInteraction() {
  const { readOnly = false } = useOutletContext<{ readOnly?: boolean }>();
  const token = localStorage.getItem("token");
  const socketRef = useRef<Socket | null>(null);

  // Selector states
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");

  // Data states
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [judges, setJudges] = useState<any[]>([]);
  const [rubric, setRubric] = useState<any | null>(null);
  const [criteria, setCriteria] = useState<any[]>([]);

  // Live Sync states
  const [highlightedTeamId, setHighlightedTeamId] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);

  // Score Override Panel states
  const [selectedJudgeId, setSelectedJudgeId] = useState("");
  const [overrideScores, setOverrideScores] = useState<{ [criterionId: string]: number }>({});
  const [overrideComment, setOverrideComment] = useState("");
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, []);

  // Refs to avoid stale closures in socket callbacks
  const selectedRoundIdRef = useRef(selectedRoundId);
  const selectedTeamRef = useRef(selectedTeam);

  useEffect(() => {
    selectedRoundIdRef.current = selectedRoundId;
  }, [selectedRoundId]);

  useEffect(() => {
    selectedTeamRef.current = selectedTeam;
  }, [selectedTeam]);

  // Fetch rounds and roles when event is selected, and connect to socket room
  useEffect(() => {
    if (!selectedEventId) {
      setRounds([]);
      setSelectedRoundId("");
      setTeams([]);
      setSelectedTeam(null);
      return;
    }

    fetchEventDetails();
    fetchJudges();

    // Socket Connection
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const socket = io(socketUrl, { query: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_live_room", { eventId: selectedEventId });
      console.log(`Connected to live socket for event: ${selectedEventId}`);
    });

    socket.on("team_highlighted", (data: any) => {
      console.log("Socket Event: team_highlighted", data);
      if (!data.roundId || data.roundId === selectedRoundIdRef.current) {
        setHighlightedTeamId(data.teamId);
      }
    });

    // Listen for real-time score updates to refresh rankings
    socket.on("score_updated", (data: any) => {
      console.log("Socket Event: score_updated in AdminLiveInteraction:", data);
      if (data.roundId === selectedRoundIdRef.current) {
        fetchLiveRankings();
        if (selectedTeamRef.current && selectedTeamRef.current.teamId._id === data.teamId) {
          fetchJudgeScoresForTeam();
        }
      }
    });

    // Real-time EventLogs pushing to live center
    socket.on("new_event_log", (newLog: any) => {
      if (newLog.eventId?._id === selectedEventId || newLog.eventId === selectedEventId) {
        setLiveLogs((prev) => [newLog, ...prev].slice(0, 15)); // keep last 15 logs
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_live_room", { eventId: selectedEventId });
        socketRef.current.disconnect();
      }
    };
  }, [selectedEventId]);

  // Fetch team rankings when round is selected
  useEffect(() => {
    if (!selectedRoundId) {
      setTeams([]);
      setSelectedTeam(null);
      return;
    }
    fetchLiveRankings();
    fetchRubric();
  }, [selectedRoundId]);

  // Fetch score override details when selected team or judge changes
  useEffect(() => {
    if (!selectedTeam || !selectedRoundId || !selectedJudgeId) {
      setOverrideScores({});
      setOverrideComment("");
      return;
    }
    fetchJudgeScoresForTeam();
  }, [selectedTeam, selectedJudgeId, selectedRoundId]);

  const fetchEvents = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/events", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(res.data);
      if (res.data.length > 0) {
        setSelectedEventId(res.data[0]._id);
      }
    } catch (err) {
      toast.error("Không thể tải danh sách cuộc thi");
    }
  };

  const fetchEventDetails = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/events/${selectedEventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRounds(res.data.rounds || []);
      if (res.data.rounds && res.data.rounds.length > 0) {
        setSelectedRoundId(res.data.rounds[0]._id);
      }
    } catch (err) {
      toast.error("Không thể tải chi tiết cuộc thi");
    }
  };

  const fetchJudges = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/events/${selectedEventId}/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const judgeRoles = res.data.filter((r: any) => r.role === "judge" && r.userId);
      setJudges(judgeRoles.map((r: any) => r.userId));
      if (judgeRoles.length > 0) {
        setSelectedJudgeId(judgeRoles[0].userId._id);
      }
    } catch (err) {
      toast.error("Không thể tải danh sách giám khảo");
    }
  };

  const fetchLiveRankings = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/grades/live-ranking/${selectedRoundId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeams(res.data.standings || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRubric = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/rubrics/round/${selectedRoundId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.rubric) {
        const activeRubric = res.data.rubric;
        setRubric(activeRubric);
        setCriteria(res.data.criteria || []);
      } else {
        setRubric(null);
        setCriteria([]);
      }
    } catch (err) {
      console.error("Fetch Rubric Error:", err);
      setRubric(null);
      setCriteria([]);
    }
  };



  const fetchJudgeScoresForTeam = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/grades/team/${selectedTeam.teamId._id}/round/${selectedRoundId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const judgeScore = res.data.scores?.find((s: any) => s.judgeId?._id === selectedJudgeId);
      if (judgeScore) {
        const scoresMap: { [criterionId: string]: number } = {};
        judgeScore.details?.forEach((d: any) => {
          scoresMap[d.criterionId?._id || d.criterionId] = d.scoreValue;
        });
        setOverrideScores(scoresMap);
        setOverrideComment(judgeScore.overallComment || "");
      } else {
        // Reset scores
        setOverrideScores({});
        setOverrideComment("");
      }
    } catch (err) {
      console.error("Error fetching judge scores for team", err);
    }
  };

  const handleHighlightTeam = (teamId: string) => {
    if (!socketRef.current) return;

    if (highlightedTeamId === teamId) {
      // Toggle off highlight
      socketRef.current.emit("coordinator_select_team", {
        eventId: selectedEventId,
        teamId: null,
        roundId: selectedRoundId
      });
      setHighlightedTeamId(null);
      toast.success("Đã tắt highlight đội thi");
    } else {
      // Highlight new team
      socketRef.current.emit("coordinator_select_team", {
        eventId: selectedEventId,
        teamId,
        roundId: selectedRoundId
      });
      setHighlightedTeamId(teamId);
      toast.success(`Đang highlight đội thi: ${teams.find(t => t.teamId._id === teamId)?.teamId.name}`);
    }
  };

  const handleScoreChange = (criterionId: string, val: number) => {
    setOverrideScores(prev => ({
      ...prev,
      [criterionId]: val
    }));
  };

  const handleSaveOverride = async () => {
    if (!selectedTeam || !rubric || !selectedJudgeId) {
      toast.error("Vui lòng chọn đầy đủ Đội thi, Giám khảo và Rubric.");
      return;
    }

    // Verify all criteria are scored
    const emptyCriteria = criteria.filter(c => overrideScores[c._id] === undefined);
    if (emptyCriteria.length > 0) {
      toast.error(`Vui lòng nhập điểm cho tất cả tiêu chí: ${emptyCriteria.map(c => c.code).join(", ")}`);
      return;
    }

    setIsSubmittingOverride(true);
    try {
      const details = Object.entries(overrideScores).map(([critId, scoreVal]) => ({
        criterionId: critId,
        scoreValue: scoreVal
      }));

      await axios.post("http://localhost:5000/api/grades/submit", {
        teamId: selectedTeam.teamId._id,
        roundId: selectedRoundId,
        rubricId: rubric._id,
        judgeId: selectedJudgeId, // override judge
        details,
        overallComment: overrideComment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("Đã cập nhật điểm số thành công!");
      fetchLiveRankings(); // reload list rankings
      fetchJudgeScoresForTeam(); // reload detail override form
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật điểm số");
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Group teams by track
  const groupedTeams: { [trackId: string]: { trackName: string, items: any[] } } = {};
  teams.forEach((item) => {
    const trackId = item.trackId?._id || "unassigned";
    const trackName = item.trackId?.name || "Chưa phân bảng";
    if (!groupedTeams[trackId]) {
      groupedTeams[trackId] = { trackName, items: [] };
    }
    groupedTeams[trackId].items.push(item);
  });

  const eventOptions = events.map((ev) => ({
    value: ev._id,
    label: `${ev.name} (${ev.semester})`
  }));

  const roundOptions = rounds.length > 0
    ? rounds.map((rd) => ({ value: rd._id, label: rd.name }))
    : [];

  return (
    <div className="space-y-6 font-sans text-slate-300">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-950 p-6 rounded-2xl border border-slate-800/80 shadow-2xl gap-4 relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Tv size={24} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-widest font-mono">
              SEAL LIVE CONTROL CENTER
            </h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
              <span>Đồng bộ và điều khiển chấm điểm thời gian thực</span>
            </p>
          </div>
        </div>

        {/* SELECTORS */}
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto relative z-30">
          {/* Event Selector */}
          <div className="flex flex-col gap-1 w-full sm:w-64">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-widest">Cuộc thi</span>
            <CustomSelect
              value={selectedEventId}
              onChange={setSelectedEventId}
              options={eventOptions}
              className="w-full font-sans"
              placeholder="Chọn cuộc thi..."
            />
          </div>

          {/* Round Selector */}
          <div className="flex flex-col gap-1 w-full sm:w-48">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-widest">Vòng thi</span>
            <CustomSelect
              value={selectedRoundId}
              onChange={setSelectedRoundId}
              options={roundOptions}
              className="w-full font-sans"
              placeholder="Chọn vòng thi..."
              disabled={rounds.length === 0}
            />
          </div>
        </div>
      </div>

      {/* MAIN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: TEAMS RANKING & SOCKET LOGS (col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* TEAMS CARD */}
          <div className="bg-slate-950/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <ListFilter size={16} className="text-cyan-400" />
                <span>DANH SÁCH ĐỘI & ĐIỂM SỐ LIVE</span>
              </h3>
              <button 
                onClick={fetchLiveRankings} 
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Tải lại
              </button>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {Object.keys(groupedTeams).length > 0 ? (
                Object.entries(groupedTeams).map(([trackId, group]) => (
                  <div key={trackId} className="space-y-2">
                    {/* Track Header Divider */}
                    <div className="flex items-center gap-2 pt-2 pb-1 sticky top-0 bg-slate-950 z-10">
                      <span className="text-[10px] uppercase font-bold text-cyan-400 font-mono tracking-wider bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/30">
                        Bảng đấu: {group.trackName}
                      </span>
                      <div className="h-px bg-slate-800/60 flex-1"></div>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((item, idx) => {
                        const isHighlighted = highlightedTeamId === item.teamId._id;
                        const isSelected = selectedTeam?.teamId._id === item.teamId._id;
                        const rank = item.trackRank || (idx + 1);
                        return (
                          <div
                            key={item.teamId._id}
                            onClick={() => setSelectedTeam(item)}
                            className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer group ${
                              isSelected
                                ? "bg-slate-900/60 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                                : isHighlighted
                                ? "bg-amber-500/10 border-amber-500/40"
                                : "bg-slate-950/40 border-slate-850 hover:bg-slate-900/30"
                            }`}
                          >
                            {/* Left glowing marker */}
                            {isHighlighted && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l animate-pulse" />
                            )}

                            <div className="flex items-center gap-3">
                              {/* Rank Badge */}
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold font-mono text-[10px] ${
                                rank === 1 
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                                  : rank === 2 
                                  ? "bg-slate-300/20 text-slate-300 border border-slate-300/30" 
                                  : rank === 3 
                                  ? "bg-amber-700/20 text-amber-600 border border-amber-700/30"
                                  : "bg-slate-900 text-slate-500 border border-slate-800"
                              }`}>
                                {rank}
                              </div>

                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs text-white tracking-wide group-hover:text-cyan-300 transition-colors">
                                    {item.teamId.name}
                                  </span>
                                  {isHighlighted && (
                                    <span className="bg-amber-500 text-slate-950 font-black text-[7px] px-1 py-0.5 rounded tracking-widest uppercase animate-pulse">
                                      LIVE
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 block truncate max-w-[200px] mt-0.5">
                                  {item.teamId.topicSubmission?.title || "Chưa nộp đề tài"}
                                </span>
                              </div>
                            </div>

                            {/* Right: Scores */}
                            <div className="text-right flex items-center gap-4">
                              <div>
                                <span className="text-xs font-mono font-bold text-cyan-400 block">
                                  {item.averageScore > 0 ? `${item.averageScore}đ` : "--"}
                                </span>
                                <span className="text-[9px] text-slate-500 block font-mono">
                                  {item.judgeCount} Giám khảo
                                </span>
                              </div>
                              <ChevronRight size={14} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-8 text-slate-500 font-mono text-xs">
                  Không có đội thi nào được ghi nhận trong bảng này.
                </p>
              )}
            </div>
          </div>

          {/* REAL-TIME EVENT LOGS BLOCK */}
          <div className="bg-slate-950/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2 pb-2 border-b border-slate-800/60">
              <Activity size={16} className="text-cyan-400" />
              <span>LIVE LOGGING (SOCKET)</span>
            </h3>
            <div className="space-y-2.5 max-h-[180px] overflow-y-auto text-[10px] font-mono pr-1">
              {liveLogs.length > 0 ? (
                liveLogs.map((log, lIdx) => (
                  <div key={lIdx} className="flex gap-2 pb-2 border-b border-slate-900/50 last:border-0 last:pb-0">
                    <span className="text-slate-500 shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="text-slate-350">{log.details}</span>
                  </div>
                ))
              ) : (
                <p className="text-center py-4 text-slate-600 italic">
                  Chờ các tương tác hoặc cập nhật từ server...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL CONTROL PANEL & SCORE OVERRIDE (col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedTeam ? (
            <div className="bg-slate-950/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 space-y-6 shadow-xl">
              {/* Profile Card */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-850">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[10px] font-bold font-mono uppercase bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      ĐỘI THI
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono">ID: {selectedTeam.teamId._id}</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-white tracking-wide">
                    {selectedTeam.teamId.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Đề tài: {selectedTeam.teamId.topicSubmission?.title || "Chưa đăng ký đề tài"}
                  </p>
                </div>

                {/* Highlight Controller Button */}
                {!readOnly && (
                  <button
                    onClick={() => handleHighlightTeam(selectedTeam.teamId._id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
                      highlightedTeamId === selectedTeam.teamId._id
                        ? "bg-amber-500 text-slate-950 hover:bg-amber-400 hover:shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse"
                        : "bg-slate-900 hover:bg-slate-850 text-amber-500 border border-amber-500/20"
                    }`}
                  >
                    <Sparkles size={14} />
                    <span>
                      {highlightedTeamId === selectedTeam.teamId._id 
                        ? "BỎ SPOTLIGHT" 
                        : "SPOTLIGHT"}
                    </span>
                  </button>
                )}
              </div>

              {/* LIVE JUDGES SCORES DETAILS CARD */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider font-mono">
                  Chi tiết điểm từ các Giám khảo
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTeam.judges && selectedTeam.judges.length > 0 ? (
                    selectedTeam.judges.map((j: any, jIdx: number) => (
                      <div key={jIdx} className="bg-slate-900/30 p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className="text-slate-500" />
                          <span className="font-bold text-slate-200">{j.fullName}</span>
                        </div>
                        <span className="font-mono font-bold text-cyan-400 bg-cyan-900/10 border border-cyan-900/20 px-2 py-0.5 rounded">
                          {j.score}đ
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-2 text-xs text-slate-500 font-mono italic">
                      Chưa có giám khảo nào hoàn tất và nộp điểm.
                    </p>
                  )}
                </div>
              </div>

              {/* QUICK SCORE EDIT PANEL (OVERRIDE JUDGE SCORE) */}
              <div className="bg-slate-900/20 border border-slate-850 p-5 rounded-2xl space-y-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-850">
                  <div className="flex items-center gap-2">
                    <Edit3 size={16} className="text-cyan-400" />
                    <h4 className="text-xs font-extrabold uppercase text-white tracking-widest font-mono">
                      CẬP NHẬT/GHI ĐÈ ĐIỂM SỐ THAY GIÁM KHẢO
                    </h4>
                  </div>
                  
                  {/* Select Judge to Override */}
                  <select
                    value={selectedJudgeId}
                    onChange={(e) => setSelectedJudgeId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-350 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none w-48 font-semibold"
                  >
                    {judges.map((jg) => (
                      <option key={jg._id} value={jg._id}>
                        {jg.fullName} ({jg.email.split("@")[0]})
                      </option>
                    ))}
                  </select>
                </div>

                {readOnly ? (
                  <p className="text-center py-4 text-xs text-slate-500 font-mono italic">
                    Bạn đang ở chế độ xem. Không có quyền sửa đổi hay ghi đè điểm số.
                  </p>
                ) : rubric ? (
                  <div className="space-y-4">
                    {/* CRITERIA SCORES OVERRIDE INPUTS */}
                    <div className="space-y-3.5">
                      {criteria.map((c) => {
                        const val = overrideScores[c._id];
                        return (
                          <div key={c._id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold font-mono text-[10px] text-cyan-400 bg-cyan-900/10 px-1.5 py-0.5 rounded border border-cyan-900/25">
                                  {c.code}
                                </span>
                                <span className="text-xs font-bold text-slate-200">{c.name}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 truncate max-w-sm">
                                Trọng số: {c.weight}% | Tối đa: {c.maxScore}đ
                              </p>
                            </div>

                            {/* Score Input Slider/Spinner combo */}
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <input
                                type="number"
                                min={0}
                                max={c.maxScore}
                                step={0.5}
                                value={val !== undefined ? val : ""}
                                onChange={(e) => handleScoreChange(c._id, parseFloat(e.target.value) || 0)}
                                className="bg-slate-900 border border-slate-750 text-slate-200 text-xs px-2 py-1 w-16 text-center rounded-lg font-bold font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                              <span className="text-xs text-slate-500 font-mono">/ {c.maxScore}đ</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* OVERALL COMMENT */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">
                        Ý kiến nhận xét tổng quan của giám khảo
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Coordinator nhập phản hồi bổ sung hoặc nhận xét của giám khảo..."
                        value={overrideComment}
                        onChange={(e) => setOverrideComment(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-350 text-xs px-3 py-2 w-full rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-650"
                      />
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                      onClick={handleSaveOverride}
                      disabled={isSubmittingOverride}
                      className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase py-2.5 rounded-xl tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                    >
                      <Save size={14} />
                      <span>{isSubmittingOverride ? "Đang xử lý..." : "Cập nhật & Chốt điểm"}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-center py-4 text-xs text-slate-500 font-mono italic">
                    Chưa kích hoạt hoặc chưa khóa Rubric cho vòng thi này. Không thể sửa điểm.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-12 text-center shadow-xl flex flex-col items-center justify-center space-y-4">
              <Tv size={48} className="text-slate-700 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-mono">
                  LIVE CONTROL PANEL
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mx-auto leading-relaxed">
                  Chọn một đội thi bất kỳ từ danh sách bên trái để mở trung tâm highlight và cập nhật điểm số live của họ.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
