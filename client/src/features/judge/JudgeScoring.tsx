import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { 
  Sparkles, 
  Save, 
  Lock, 
  ArrowLeft,
  ExternalLink,
  Activity,
  Code,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  Terminal,
  BookOpen,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Server,
  Database
} from 'lucide-react';

export default function JudgeScoring() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryRoundId = searchParams.get('roundId');
  const token = localStorage.getItem('token');

  const [selectedEventId, setSelectedEventId] = useState('');
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [isHighlighted, setIsHighlighted] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Real-time synchronization for highlighted team
  useEffect(() => {
    if (!selectedEventId || !token || !teamId) return;

    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const socket = io(socketUrl, { query: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_live_room", { eventId: selectedEventId });
    });

    socket.on("team_highlighted", (data: any) => {
      console.log("Team highlighted event received on scoring board:", data);
      if (data.teamId === teamId) {
        setIsHighlighted(true);
        toast.info("Đội thi này đang được chọn để trình bày / chấm điểm bởi Coordinator!", {
          position: "top-center",
          duration: 5000
        });
      } else {
        setIsHighlighted(false);
      }
    });

    return () => {
      socket.emit("leave_live_room", { eventId: selectedEventId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [selectedEventId, teamId, token]);
  
  const [team, setTeam] = useState<any>(null);
  const [rubric, setRubric] = useState<any>(null);
  const [criteria, setCriteria] = useState<any[]>([]);
  
  // Commits & AI Insights (for scoring panel)
  const [commits, setCommits] = useState<any[]>([]);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  
  // Main tabs state
  const [activeMainTab, setActiveMainTab] = useState<'scoring' | 'ai_analysis'>('scoring');
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>('');
  const [allAiAnalyses, setAllAiAnalyses] = useState<any[]>([]);
  const [expandedCommitId, setExpandedCommitId] = useState<string | null>(null);
  const [expandedSli, setExpandedSli] = useState<boolean>(false); // for SMB scale details
  
  // Grade state
  const [scores, setScores] = useState<any>({});
  const [overallComment, setOverallComment] = useState('');
  const [isGraded, setIsGraded] = useState(false);
  
  // Status indicators
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const setMessage = (msg: { type: string; text: string }) => {
    if (msg.text) {
      if (msg.type === 'success') {
        toast.success(msg.text);
      } else if (msg.type === 'error') {
        toast.error(msg.text);
      }
    }
  };

  const currentRound = rounds.find((r: any) => r._id === selectedRoundId);
  const isRoundLocked = currentRound?.status === 'completed';

  // Fetch specific team info & set event context
  useEffect(() => {
    if (!teamId) return;
    axios.get(`http://localhost:5000/api/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        const teamData = res.data.team || res.data;
        if (teamData) {
          setTeam(teamData);
          const evId = teamData.eventId?._id || teamData.eventId;
          if (evId) {
            setSelectedEventId(evId);
          }
        }
      })
      .catch((err: any) => console.error('Error fetching team details:', err));
  }, [teamId, token]);

  // Fetch event details (rounds, tracks)
  useEffect(() => {
    if (!selectedEventId) return;
    axios.get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res: any) => {
        const eventRounds = res.data.rounds || [];
        setRounds(eventRounds);
        
        // Select the round based on query parameters or fallback to the first round
        if (queryRoundId && eventRounds.some((r: any) => r._id === queryRoundId)) {
          setSelectedRoundId(queryRoundId);
        } else if (eventRounds.length > 0) {
          setSelectedRoundId(eventRounds[0]._id);
        }
      })
      .catch((err: any) => console.error('Error fetching event details:', err));
  }, [selectedEventId, queryRoundId]);

  // Fetch rubric/criteria
  useEffect(() => {
    if (!selectedRoundId) return;

    setRubric(null);
    setCriteria([]);
    setScores({});
    setOverallComment('');

    // Fetch Rubric for round
    axios.get(`http://localhost:5000/api/rubrics/round/${selectedRoundId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        setRubric(res.data.rubric);
        const crits = res.data.criteria || [];
        setCriteria(crits);
        
        if (crits.length > 0) {
          setSelectedCriterionId(crits[0]._id);
        } else {
          setSelectedCriterionId('summary');
        }
        
        const initial: any = {};
        crits.forEach((c: any) => {
          initial[c._id] = { scoreValue: '', comment: '' };
        });
        setScores(initial);
      })
      .catch((err: any) => {
        setRubric(null);
        setCriteria([]);
        setSelectedCriterionId('summary');
        console.error('Error fetching rubric:', err);
      });
  }, [selectedRoundId, token]);

  // Fetch commits & AI reports for active team
  useEffect(() => {
    if (!teamId) return;

    axios.get(`http://localhost:5000/api/analytics/team/${teamId}/commits`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => setCommits(res.data))
      .catch((err: any) => console.error(err));

    axios.get(`http://localhost:5000/api/ai-analyses/team/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        const data = res.data || [];
        setAllAiAnalyses(data);

        const commitReviews = data.filter((r: any) => r.analysisType === 'commit_review' && r.status === 'completed');
        if (commitReviews.length > 0) {
          setAiQuestions(commitReviews[0]?.result?.suggested_questions_for_team || []);
        } else {
          setAiQuestions([]);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setAllAiAnalyses([]);
        setAiQuestions([]);
      });

  }, [teamId, token]);

  // Load existing score
  useEffect(() => {
    if (!teamId || !selectedRoundId || criteria.length === 0) {
      setOverallComment('');
      setIsGraded(false);
      return;
    }

    axios.get(`http://localhost:5000/api/grades/team/${teamId}/round/${selectedRoundId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        if (res.data && res.data.score) {
          setIsGraded(true);
          setOverallComment(res.data.score.overallComment || '');
          const populated: any = {};
          criteria.forEach((c: any) => {
            populated[c._id] = { scoreValue: '', comment: '' };
          });
          res.data.details.forEach((d: any) => {
            if (populated[d.criterionId]) {
              populated[d.criterionId] = {
                scoreValue: String(d.scoreValue),
                comment: d.comment || ''
              };
            }
          });
          setScores(populated);
        } else {
          setIsGraded(false);
          setOverallComment('');
          const initial: any = {};
          criteria.forEach((c: any) => {
            initial[c._id] = { scoreValue: '', comment: '' };
          });
          setScores(initial);
        }
      })
      .catch((err: any) => {
        console.error('Error fetching existing score:', err);
      });
  }, [teamId, selectedRoundId, criteria, token]);

  const handleScoreChange = (critId: string, field: string, val: any) => {
    setScores((prev: any) => ({
      ...prev,
      [critId]: {
        ...prev[critId],
        [field]: val
      }
    }));
  };

  const handleGetAiSuggestion = async () => {
    if (!teamId || !selectedRoundId || !rubric) return;
    setAiLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await axios.get(
        `http://localhost:5000/api/grades/suggestion?teamId=${teamId}&roundId=${selectedRoundId}&rubricId=${rubric._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated = { ...scores };
      res.data.forEach((item: any) => {
        if (item.criterionId) {
          updated[item.criterionId] = {
            scoreValue: item.suggestedScore,
            comment: `[Gợi ý của AI]: ${item.comment}`
          };
        }
      });
      setScores(updated);
      setOverallComment('Ý kiến gợi ý tổng quan từ Gemini AI: Nhóm có sự phối hợp git rất tốt, các commit mang tính chất tăng trưởng rõ ràng, logic code vững vàng.');
      setMessage({ type: 'success', text: 'Tải thành công điểm số gợi ý từ Gemini AI!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Không thể tạo gợi ý điểm tự động từ AI.' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmitScores = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!teamId || !selectedRoundId || !rubric) return;
    setSaving(true);
    setMessage({ type: '', text: '' });

    const details = criteria.map((c: any) => {
      const val = scores[c._id] || {};
      return {
        criterionId: c._id,
        scoreValue: parseFloat(val.scoreValue),
        comment: val.comment || ''
      };
    });

    if (details.some(d => isNaN(d.scoreValue))) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ điểm số cho tất cả tiêu chí.' });
      setSaving(false);
      return;
    }

    try {
      const res = await axios.post(
        'http://localhost:5000/api/grades/submit',
        {
          teamId,
          roundId: selectedRoundId,
          rubricId: rubric._id,
          overallComment,
          details
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsGraded(true);
      setMessage({ type: 'success', text: `Nộp điểm thành công! Tổng điểm: ${res.data.totalWeightedScore}/${rubric ? rubric.maxCriterionScore : 10}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Có lỗi khi nộp điểm.' });
    } finally {
      setSaving(false);
    }
  };

  // Find latest commit review for tech stack / RAG / Agent intelligence cards
  const latestCommitReview = allAiAnalyses.find(
    r => r.analysisType === 'commit_review' && r.status === 'completed'
  );

  // Find team aggregate review (repository_review)
  const teamAggregateReview = allAiAnalyses.find(
    r => r.analysisType === 'repository_review' && r.status === 'completed'
  );

  // Filter commit reviews (per-push reviews)
  const commitReviews = allAiAnalyses.filter(
    r => r.analysisType === 'commit_review' && r.status === 'completed'
  );

  if (!team) {
    return (
      <div className="text-center py-20 text-cyan-400 text-xs animate-pulse font-mono">
        [ĐANG TẢI THÔNG TIN ĐỘI THI...]
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {isHighlighted && (
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-white uppercase tracking-wider font-mono">
                ĐỘI THI ĐANG TRÌNH BÀY / ĐƯỢC CHỌN CHẤM
              </p>
              <p className="text-[11px] text-slate-350 mt-0.5">
                Coordinator đang highlight đội thi này. Hãy tập trung theo dõi và chấm điểm.
              </p>
            </div>
          </div>
          <span className="bg-amber-500 text-slate-950 font-black text-[9px] uppercase px-2.5 py-1 rounded-md tracking-widest shadow-[0_0_8px_rgba(245,158,11,0.5)]">
            LIVE FOCUS
          </span>
        </div>
      )}

      {/* Sub-header/Breadcrumb Row */}
      <div className="flex justify-between items-center bg-slate-900/40 backdrop-blur-md border border-white/10 px-6 py-4 rounded-xl shadow-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/expert/projects')}
            className="text-cyan-400 hover:text-cyan-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]"
          >
            <ArrowLeft size={14} />
            <span>Danh sách dự án</span>
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-white text-xs font-bold font-mono drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">Chấm điểm: {team.name}</span>
        </div>

        <div className="flex items-center gap-3">
          {isGraded ? (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              Đã chấm điểm
            </span>
          ) : (
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              Chờ chấm điểm
            </span>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex gap-4 border-b border-white/10 pb-1">
        <button
          onClick={() => setActiveMainTab('scoring')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider relative transition-all ${
            activeMainTab === 'scoring'
              ? 'text-cyan-400 font-extrabold drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Save size={14} />
          <span>Bảng Chấm Điểm</span>
          {activeMainTab === 'scoring' && (
            <div className="absolute bottom-[-5px] left-0 w-full h-[3px] bg-cyan-500 rounded-t shadow-[0_0_12px_rgba(6,182,212,0.8)]"></div>
          )}
        </button>
        <button
          onClick={() => setActiveMainTab('ai_analysis')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider relative transition-all ${
            activeMainTab === 'ai_analysis'
              ? 'text-teal-400 font-extrabold drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Sparkles size={14} />
          <span>Báo Cáo Phân Tích AI</span>
          {activeMainTab === 'ai_analysis' && (
            <div className="absolute bottom-[-5px] left-0 w-full h-[3px] bg-teal-500 rounded-t shadow-[0_0_12px_rgba(20,184,166,0.8)]"></div>
          )}
        </button>
      </div>

      {/* Render Main Content depending on Tab */}
      {activeMainTab === 'scoring' ? (
        /* TAB 1: SCORING TAB (Master-Detail layout) */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Main Area (12/12): Scoring Master-Detail Container */}
          <div className="xl:col-span-12 bg-slate-900/40 backdrop-blur-md p-6 rounded-xl border border-white/10 shadow-lg flex flex-col space-y-6">
            
            {/* Scoring Header */}
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <span className="text-[9px] text-cyan-300/70 font-bold uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                  Phân hệ chấm điểm Rubric
                </span>
                <h3 className="text-lg font-black text-white mt-1 uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                  Đánh giá & Nhập điểm
                </h3>
              </div>
              
              {!isRoundLocked && rubric && (
                <button
                  type="button"
                  onClick={handleGetAiSuggestion}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 hover:from-teal-500/40 hover:to-cyan-500/40 text-teal-300 border border-teal-500/30 hover:border-teal-400 px-4 py-2 rounded-xl text-[11px] font-bold transition-all uppercase tracking-wider shadow-[0_0_15px_rgba(20,184,166,0.3)]"
                >
                  <Sparkles size={12} className={aiLoading ? 'animate-spin' : 'text-teal-400'} />
                  <span>{aiLoading ? 'AI đang phân tích...' : 'Lấy gợi ý AI'}</span>
                </button>
              )}
            </div>

            {/* Inner Master-Detail Layout */}
            {rubric ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[480px]">
                
                {/* Sidebar menu: list of criteria (col-span-4) */}
                <div className="md:col-span-4 border-r border-white/5 pr-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-2">Tiêu chí</p>
                    {criteria.map((c: any) => {
                      const scoreState = scores[c._id]?.scoreValue;
                      const hasScore = scoreState !== undefined && scoreState !== '';
                      return (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => setSelectedCriterionId(c._id)}
                          className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${
                            selectedCriterionId === c._id
                              ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                              : 'bg-slate-800/20 border-white/5 text-slate-400 hover:bg-slate-800/30 hover:text-slate-300'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 truncate pr-2">
                            <span className="font-mono font-bold">[{c.code}]</span>
                            <span className="font-medium truncate leading-tight">{c.name}</span>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                            hasScore 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-slate-900/60 text-slate-500 border border-slate-800'
                          }`}>
                            {hasScore ? `${scoreState}đ` : `max ${c.maxScore}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-white/5 pt-4">
                    <button
                      type="button"
                      onClick={() => setSelectedCriterionId('summary')}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${
                        selectedCriterionId === 'summary'
                          ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                          : 'bg-slate-800/20 border-white/5 text-slate-400 hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold">Tổng kết & Gửi</span>
                        <span className="text-[10px] text-slate-500">Nhập nhận xét tổng quan</span>
                      </div>
                      <Save size={14} className={selectedCriterionId === 'summary' ? 'text-cyan-400' : 'text-slate-500'} />
                    </button>
                  </div>
                </div>

                {/* Detail pane (col-span-8) */}
                <div className="md:col-span-8 pl-0 md:pl-2 flex flex-col justify-between min-h-[400px]">
                  {selectedCriterionId === 'summary' ? (
                    /* Summary & Submit view */
                    <div className="space-y-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle size={16} className="text-cyan-400" />
                            <span>Tổng kết điểm đánh giá</span>
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1">Xem lại tóm tắt bảng điểm và nộp kết quả chính thức của bạn.</p>
                        </div>

                        {/* List of current scores */}
                        <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-2">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Bảng điểm hiện tại:</p>
                          <div className="space-y-2">
                            {criteria.map((c: any) => {
                              const val = scores[c._id]?.scoreValue;
                              const hasScore = val !== undefined && val !== '';
                              return (
                                <div key={c._id} className="flex justify-between items-center text-xs border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                                  <span className="text-slate-300 font-mono">[{c.code}] {c.name}</span>
                                  <span className="font-bold text-cyan-400 font-mono">
                                    {hasScore ? `${val} / ${c.maxScore}đ` : <span className="text-rose-400 font-normal italic">[Chưa nhập]</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                            Ý kiến nhận xét tổng quan (Overall Comment)
                          </label>
                          <textarea
                            placeholder={isRoundLocked ? "Không có nhận xét tổng quan." : "Ý kiến đánh giá thế mạnh, điểm yếu và định hướng phát triển của đội thi..."}
                            rows={5}
                            value={overallComment}
                            onChange={e => setOverallComment(e.target.value)}
                            disabled={isRoundLocked}
                            className="bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-xs px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 disabled:opacity-50 font-sans shadow-inner placeholder-slate-600"
                          ></textarea>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5">
                        {!isRoundLocked && (
                          <button
                            type="button"
                            onClick={() => handleSubmitScores()}
                            disabled={saving}
                            className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.3)] uppercase tracking-widest"
                          >
                            <Save size={14} />
                            <span>{saving ? 'Đang lưu điểm...' : 'Nộp điểm chính thức'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Individual Criterion grading view */
                    (() => {
                      const c = criteria.find(item => item._id === selectedCriterionId);
                      if (!c) {
                        return (
                          <div className="text-center text-slate-500 py-10 font-mono text-xs">
                            [CHỌN MỘT TIÊU CHÍ BÊN TRÁI ĐỂ BẮT ĐẦU CHẤM ĐIỂM]
                          </div>
                        );
                      }
                      
                      const scoreVal = scores[c._id]?.scoreValue || '';
                      const commentVal = scores[c._id]?.comment || '';

                      return (
                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                          <div className="space-y-4">
                            {/* Title & Description */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{c.code}]</span>
                                <span className="text-sm font-bold text-white uppercase">{c.name}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{c.description || 'Không có mô tả chi tiết.'}</p>
                            </div>

                            {/* Centered Large Score Input Box */}
                            <div className="flex flex-col items-center justify-center p-3 bg-slate-950/40 rounded-xl border border-cyan-500/10 my-2">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 font-mono">
                                Điểm Số Đánh Giá
                              </label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max={c.maxScore}
                                  required
                                  placeholder={`0-${c.maxScore}`}
                                  value={scoreVal}
                                  onChange={e => handleScoreChange(c._id, 'scoreValue', e.target.value)}
                                  disabled={isRoundLocked}
                                  className="bg-slate-900 border-2 border-cyan-500/40 rounded-xl text-white text-center text-lg px-4 py-2 w-32 focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-400 focus:outline-none disabled:opacity-50 font-black shadow-[0_0_15px_rgba(6,182,212,0.05)] placeholder-slate-700 font-mono"
                                />
                                <span className="text-xs text-cyan-400 font-bold font-mono">/ {c.maxScore}đ</span>
                              </div>
                            </div>

                            {/* Grading Levels Guides */}
                            {c.gradingLevels && c.gradingLevels.length > 0 && (
                              <div className="pt-2 border-t border-white/5 space-y-1">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Mức điểm hướng dẫn:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                  {c.gradingLevels.map((lvl: any, idx: number) => {
                                    const parsedScore = parseFloat(scoreVal);
                                    const isMatched = !isNaN(parsedScore) && parsedScore >= lvl.minScore && parsedScore <= lvl.maxScore;

                                    return (
                                      <div
                                        key={idx}
                                        onClick={() => {
                                          if (!isRoundLocked) {
                                            handleScoreChange(c._id, 'scoreValue', lvl.maxScore);
                                          }
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg border transition-all duration-300 flex flex-col justify-between cursor-pointer text-left ${
                                          isMatched
                                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                                            : 'bg-slate-800/30 border-white/5 hover:border-white/12 text-slate-400'
                                        }`}
                                      >
                                        <div className="flex flex-col gap-0.5 text-[8.5px] font-bold">
                                          <span className={isMatched ? 'text-cyan-200' : 'text-slate-355'}>{lvl.label}</span>
                                          <span className={isMatched ? 'text-cyan-400 font-mono font-black' : 'text-slate-500 font-mono font-black'}>{lvl.minScore} - {lvl.maxScore}đ</span>
                                        </div>
                                        {lvl.description && (
                                          <p className={`text-[8px] mt-0.5 leading-normal font-sans ${isMatched ? 'text-cyan-200/70' : 'text-slate-500'}`}>{lvl.description}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Comment */}
                            <div className="space-y-1">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Nhận xét tiêu chí này</label>
                              <textarea
                                placeholder={isRoundLocked ? "Không có nhận xét." : "Nhập nhận xét cụ thể, lý do chấm điểm và góp ý chi tiết cho tiêu chí này..."}
                                value={commentVal}
                                onChange={e => handleScoreChange(c._id, 'comment', e.target.value)}
                                disabled={isRoundLocked}
                                rows={4}
                                className="bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-xs px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 disabled:opacity-50 shadow-inner placeholder-slate-655 font-sans leading-relaxed resize-y"
                              />
                            </div>
                          </div>

                          {/* Navigation buttons */}
                          <div className="pt-3 border-t border-white/5 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const currentIndex = criteria.findIndex(item => item._id === c._id);
                                if (currentIndex < criteria.length - 1) {
                                  setSelectedCriterionId(criteria[currentIndex + 1]._id);
                                } else {
                                  setSelectedCriterionId('summary');
                                }
                              }}
                              className="bg-slate-850 hover:bg-slate-800 text-cyan-400 border border-cyan-500/10 px-4 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 uppercase tracking-wider shadow-inner"
                            >
                              <span>Tiêu chí tiếp theo</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-slate-900/20 p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[350px] border border-white/5 shadow-inner rounded-2xl">
                <Lock size={40} className="text-slate-600 mb-3 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                <p className="font-semibold text-sm text-slate-300">Bảng Rubric chưa sẵn sàng</p>
                <p className="text-[11px] text-slate-500 max-w-sm mt-1 leading-relaxed">
                  Bảng điểm Rubric của vòng đấu này chưa được cấu hình hoặc chưa khóa chính thức. Giám khảo vui lòng quay lại sau.
                </p>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* TAB 2: AI ANALYSIS TAB (Widescreen layout) */
        <div className="space-y-6">
          
          {/* Top Row: Tech Stack, RAG Maturity, Agent Intelligence Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Tech Stack Card */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-lg flex flex-col justify-between min-h-[220px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Server size={14} className="text-cyan-400" />
                    <span>Tech Stack</span>
                  </span>
                  <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 text-[8px] font-bold px-1.5 py-0.5 rounded font-mono">
                    Gemini AI
                  </span>
                </div>

                {latestCommitReview?.result?.tech_stack ? (
                  <div className="space-y-2 text-[11px] leading-relaxed">
                    {latestCommitReview.result.tech_stack.frameworks?.length > 0 && (
                      <p className="text-slate-400 font-sans">
                        <strong className="text-slate-300">Frameworks:</strong>{' '}
                        {latestCommitReview.result.tech_stack.frameworks.join(', ')}
                      </p>
                    )}
                    {latestCommitReview.result.tech_stack.llm_models?.length > 0 && (
                      <p className="text-slate-400 font-sans">
                        <strong className="text-slate-300">LLM Models:</strong>{' '}
                        {latestCommitReview.result.tech_stack.llm_models.join(', ')}
                      </p>
                    )}
                    {latestCommitReview.result.tech_stack.vector_db?.length > 0 && (
                      <p className="text-slate-400 font-sans">
                        <strong className="text-slate-300">Vector DB:</strong>{' '}
                        {latestCommitReview.result.tech_stack.vector_db.join(', ')}
                      </p>
                    )}
                    {latestCommitReview.result.tech_stack.agent_frameworks?.length > 0 && (
                      <p className="text-slate-400 font-sans">
                        <strong className="text-slate-300">Agent Frameworks:</strong>{' '}
                        {latestCommitReview.result.tech_stack.agent_frameworks.join(', ')}
                      </p>
                    )}
                    {latestCommitReview.result.tech_stack.third_party_tools?.length > 0 && (
                      <p className="text-slate-400 font-sans">
                        <strong className="text-slate-300">Tools khác:</strong>{' '}
                        {latestCommitReview.result.tech_stack.third_party_tools.join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-500 italic text-[10px] font-mono flex items-center justify-center gap-1 bg-slate-950/20 rounded border border-white/5">
                    <AlertCircle size={12} className="text-slate-600" />
                    <span>Chưa có dữ liệu phân tích từ Gemini AI cho tiêu chí này.</span>
                  </div>
                )}
              </div>
            </div>

            {/* RAG Maturity Card */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-lg flex flex-col justify-between min-h-[220px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Database size={14} className="text-cyan-400" />
                    <span>RAG Maturity</span>
                  </span>
                  <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 text-[8px] font-bold px-1.5 py-0.5 rounded font-mono">
                    Gemini AI
                  </span>
                </div>

                {latestCommitReview?.result?.rag_maturity ? (
                  <div className="space-y-3 text-[11px] leading-relaxed">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-bold font-sans">Mức độ hoàn thiện:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
                        latestCommitReview.result.rag_maturity.level === 'Agentic-RAG'
                          ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                          : latestCommitReview.result.rag_maturity.level === 'Advanced'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {latestCommitReview.result.rag_maturity.level}
                      </span>
                    </div>

                    {latestCommitReview.result.rag_maturity.features_detected?.length > 0 && (
                      <div className="space-y-1">
                        <strong className="text-slate-300 block font-sans">Features phát hiện:</strong>
                        <div className="flex flex-wrap gap-1">
                          {latestCommitReview.result.rag_maturity.features_detected.map((f: string, idx: number) => (
                            <span key={idx} className="bg-slate-800 text-slate-300 border border-white/5 px-2 py-0.5 rounded text-[9px] font-mono">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-500 italic text-[10px] font-mono flex items-center justify-center gap-1 bg-slate-950/20 rounded border border-white/5">
                    <AlertCircle size={12} className="text-slate-600" />
                    <span>Chưa có dữ liệu phân tích từ Gemini AI cho tiêu chí này.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Intelligence Card */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-lg flex flex-col justify-between min-h-[220px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Cpu size={14} className="text-cyan-400" />
                    <span>Agent Intelligence</span>
                  </span>
                  <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 text-[8px] font-bold px-1.5 py-0.5 rounded font-mono">
                    Gemini AI
                  </span>
                </div>

                {latestCommitReview?.result?.agent_intelligence ? (
                  <div className="space-y-2 text-[11px] leading-relaxed">
                    <p className="text-slate-400 font-sans">
                      <strong className="text-slate-300">Động cơ suy luận (Reasoning):</strong>{' '}
                      <span className="font-mono text-cyan-300 font-bold">{latestCommitReview.result.agent_intelligence.reasoning_pattern}</span>
                    </p>
                    <p className="text-slate-400 font-sans">
                      <strong className="text-slate-300">File cấu hình Agent:</strong>{' '}
                      <span className="font-mono">{latestCommitReview.result.agent_intelligence.has_agent_config_files ? 'Đã phát hiện' : 'Không có'}</span>
                    </p>
                    
                    {latestCommitReview.result.agent_intelligence.detected_skills?.length > 0 && (
                      <div className="space-y-1">
                        <strong className="text-slate-300 block font-sans">Kỹ năng phát hiện (Skills):</strong>
                        <div className="flex flex-wrap gap-1">
                          {latestCommitReview.result.agent_intelligence.detected_skills.map((s: string, idx: number) => (
                            <span key={idx} className="bg-slate-800 text-slate-300 border border-white/5 px-2 py-0.5 rounded text-[9px] font-mono">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-500 italic text-[10px] font-mono flex items-center justify-center gap-1 bg-slate-950/20 rounded border border-white/5">
                    <AlertCircle size={12} className="text-slate-600" />
                    <span>Chưa có dữ liệu phân tích từ Gemini AI cho tiêu chí này.</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Bottom Columns: Team Aggregate (Left 8/12) & Q&A Questions (Right 4/12) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* Left Area (8/12): Team Aggregate Review & Per-push reviews */}
            <div className="xl:col-span-8 space-y-6">
              
              {/* Card 1: Team Aggregate Review (repository_review) */}
              <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-xl border border-white/10 shadow-lg space-y-6">
                <div className="border-b border-white/5 pb-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity size={16} className="text-cyan-400" />
                    <span>Tổng hợp phân tích & Đánh giá cấp Team</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Phân tích sâu toàn bộ lịch sử commits và cấu trúc mã nguồn đối chiếu với rubric.</p>
                </div>

                {teamAggregateReview ? (
                  <div className="space-y-6 text-xs leading-relaxed">
                    {/* Historical Synthesis */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono flex items-center gap-1.5">
                        <BookOpen size={12} className="text-cyan-400" /> Tóm tắt lịch sử phát triển
                      </span>
                      <p className="text-slate-300 bg-slate-950/30 p-4 rounded-xl border border-white/5 leading-relaxed font-sans shadow-inner">
                        {teamAggregateReview.result.overall_picture?.historical_synthesis}
                      </p>
                    </div>

                    {/* Qualitative criteria review */}
                    {teamAggregateReview.result.criteria_comments && (
                      <div className="space-y-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono flex items-center gap-1.5">
                          <Code size={12} className="text-cyan-400" /> Đánh giá định tính theo tiêu chí Rubric (R1/R2)
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(teamAggregateReview.result.criteria_comments).map(([key, value]: [string, any]) => {
                            const matchedCrit = criteria.find(c => c.code === key);
                            const displayName = matchedCrit ? matchedCrit.name : key;
                            return (
                              <div key={key} className="bg-slate-800/20 p-3.5 rounded-xl border border-white/5 shadow-inner space-y-2 hover:border-white/10 transition-colors">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-200 font-mono text-[11px]">[{key}] {displayName}</span>
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
                                    value.grade === 'Xuất sắc' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                    value.grade === 'Tốt' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                                    value.grade === 'Khá' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                    value.grade === 'Trung bình' ? 'bg-slate-800/60 text-slate-300 border border-slate-700' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}>
                                    {value.grade}
                                  </span>
                                </div>
                                {value.comment && (
                                  <p className="text-slate-400 leading-relaxed font-sans text-[10px] pl-2 border-l border-slate-700">
                                    {value.comment}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SMB Scale Advisory (Collapsible) */}
                    {teamAggregateReview.result.smb_scale_advisory && (
                      <div className="border border-white/5 rounded-xl overflow-hidden bg-slate-950/20">
                        <button
                          type="button"
                          onClick={() => setExpandedSli(!expandedSli)}
                          className="w-full text-left p-4 flex justify-between items-center hover:bg-slate-800/20 transition-colors"
                        >
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                            <Terminal size={12} className="text-cyan-400" /> Tư vấn quy mô SMB (SMB Scale Advisory)
                          </span>
                          {expandedSli ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </button>
                        
                        {expandedSli && (
                          <div className="p-4 border-t border-white/5 space-y-3 bg-slate-900/20 leading-relaxed text-[11px]">
                            {teamAggregateReview.result.smb_scale_advisory.system_identity_recap && (
                              <p className="text-slate-300"><strong className="text-cyan-300">Hệ thống:</strong> {teamAggregateReview.result.smb_scale_advisory.system_identity_recap}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.summary && (
                              <p className="text-slate-300"><strong className="text-cyan-300">Tóm tắt:</strong> {teamAggregateReview.result.smb_scale_advisory.summary}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.tech_and_architecture && (
                              <p className="text-slate-300"><strong className="text-cyan-300">Kiến trúc khuyên dùng:</strong> {teamAggregateReview.result.smb_scale_advisory.tech_and_architecture}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.cost_for_smb && (
                              <p className="text-slate-300"><strong className="text-cyan-300">Ước lượng chi phí API/Hosting:</strong> {teamAggregateReview.result.smb_scale_advisory.cost_for_smb}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.throughput_and_reliability && (
                              <p className="text-slate-300"><strong className="text-cyan-300">Độ tin cậy & Băng thông:</strong> {teamAggregateReview.result.smb_scale_advisory.throughput_and_reliability}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.observability_and_operations && (
                              <p className="text-slate-300"><strong className="text-cyan-300">Giám sát & Vận hành (Observability):</strong> {teamAggregateReview.result.smb_scale_advisory.observability_and_operations}</p>
                            )}
                            {teamAggregateReview.result.smb_scale_advisory.data_and_integrations && (
                              <p className="text-slate-300"><strong className="text-cyan-300">Liên kết & Tích hợp:</strong> {teamAggregateReview.result.smb_scale_advisory.data_and_integrations}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 italic text-[10px] font-mono flex items-center justify-center gap-1 bg-slate-950/20 rounded border border-white/5">
                    <AlertCircle size={12} className="text-slate-600" />
                    <span>Chưa có dữ liệu phân tích tổng hợp cấp team từ Gemini AI.</span>
                  </div>
                )}

              </div>

              {/* Card 2: Per-push reviews timeline */}
              <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-xl border border-white/10 shadow-lg space-y-4">
                <div className="border-b border-white/5 pb-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity size={16} className="text-cyan-400" />
                    <span>Lịch sử phân tích Per-push (Từng đợt Commit/Push)</span>
                  </h3>
                </div>

                <div className="space-y-4">
                  {commitReviews.map((r: any, idx: number) => {
                    const commitInfo = r.commitId || {};
                    const isExpanded = expandedCommitId === r._id;
                    const resObj = r.result || {};
                    
                    const isSignificant = resObj.overall_picture?.significant_change === true || resObj.significant_change === true;
                    const githubIssueUrl = resObj.github_issue_url;

                    return (
                      <div key={r._id || idx} className="bg-slate-800/20 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all shadow-inner">
                        
                        {/* Collapsed Header */}
                        <div
                          onClick={() => setExpandedCommitId(isExpanded ? null : r._id)}
                          className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer select-none"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                {commitInfo.commitSha ? commitInfo.commitSha.substring(0, 7) : 'push-sync'}
                              </span>
                              <p className="text-xs font-semibold text-slate-200 line-clamp-1">{commitInfo.message || resObj.overall_picture?.push_summary}</p>
                            </div>
                            <div className="flex gap-3 text-[9px] text-slate-400 font-mono">
                              <span>Tác giả: <strong className="text-slate-300">@{commitInfo.authorGithubUsername || commitInfo.authorName || 'unknown'}</strong></span>
                              <span>Ngày: {commitInfo.committedAt ? new Date(commitInfo.committedAt).toLocaleString('vi-VN') : new Date(r.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSignificant && (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                                Thay đổi quan trọng
                              </span>
                            )}
                            {githubIssueUrl && (
                              <a
                                href={githubIssueUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase flex items-center gap-1 transition-all"
                              >
                                <span>Issue tự động</span>
                                <ExternalLink size={10} />
                              </a>
                            )}
                            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="p-4 border-t border-white/5 bg-slate-950/20 space-y-4 text-xs leading-relaxed text-slate-300">
                            {resObj.overall_picture?.push_summary && (
                              <div className="space-y-1">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Tóm tắt thay đổi đợt push:</span>
                                <p className="text-[10px] pl-2 border-l border-cyan-500/30 text-slate-200">{resObj.overall_picture.push_summary}</p>
                              </div>
                            )}

                            {resObj.overall_picture?.current_focus && (
                              <div className="space-y-1">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Tiêu điểm lập trình:</span>
                                <p className="text-[10px] pl-2 border-l border-cyan-500/30 text-slate-200">{resObj.overall_picture.current_focus}</p>
                              </div>
                            )}

                            {resObj.assessment && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1 bg-slate-800/10 p-2.5 rounded-lg border border-white/5">
                                  <span className="text-[8.5px] text-emerald-400 font-bold uppercase tracking-wider font-mono">Ưu điểm thiết kế:</span>
                                  <p className="text-[9.5px] text-slate-400 leading-normal">{resObj.assessment.advantages || 'Không có.'}</p>
                                </div>
                                <div className="space-y-1 bg-slate-800/10 p-2.5 rounded-lg border border-white/5">
                                  <span className="text-[8.5px] text-rose-400 font-bold uppercase tracking-wider font-mono">Hạn chế & Rủi ro:</span>
                                  <p className="text-[9.5px] text-slate-400 leading-normal">{resObj.assessment.disadvantages || 'Không có.'}</p>
                                </div>
                              </div>
                            )}

                            {resObj.assessment?.security && resObj.assessment?.security !== 'Không phát hiện lỗi bảo mật nghiêm trọng trong đợt commit này.' && (
                              <div className="bg-rose-500/5 p-3 rounded-lg border border-rose-500/20 text-[9.5px] text-rose-400/90 flex items-start gap-2">
                                <ShieldAlert size={14} className="shrink-0 text-rose-400" />
                                <div>
                                  <strong className="block uppercase text-[8.5px] tracking-wider mb-0.5">Khuyến cáo bảo mật:</strong>
                                  <span>{resObj.assessment.security}</span>
                                </div>
                              </div>
                            )}

                            {resObj.assessment?.improvement_areas && (
                              <div className="space-y-1">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Đề xuất cải tiến:</span>
                                <p className="text-[9.5px] text-slate-400">{resObj.assessment.improvement_areas}</p>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}

                  {commitReviews.length === 0 && (
                    <div className="py-8 text-center text-slate-500 italic text-[10px] font-mono flex items-center justify-center gap-1 bg-slate-950/20 rounded border border-white/5">
                      <AlertCircle size={12} className="text-slate-600" />
                      <span>Chưa có dữ liệu phân tích per-push cho đội thi này.</span>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Right Area (4/12): suggested questions, project profile */}
            <div className="xl:col-span-4 space-y-6">
              
              {/* Q&A Suggested questions */}
              <div className="bg-teal-950/10 p-5 rounded-xl border border-teal-500/20 border-l-4 border-l-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.1)] space-y-3">
                <span className="text-xs font-black text-teal-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-teal-500/10 pb-2">
                  <ShieldAlert size={14} className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)] animate-pulse" />
                  <span className="drop-shadow-[0_0_5px_rgba(20,184,166,0.3)]">Gợi ý câu hỏi phản biện</span>
                </span>
                
                <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-300 text-[11px] font-medium leading-relaxed">
                  {aiQuestions.map((q: string, idx: number) => (
                    <li key={idx} className="hover:text-teal-300 transition-colors marker:text-teal-500">{q}</li>
                  ))}
                  {aiQuestions.length === 0 && (
                    <li className="list-none text-slate-500 italic font-mono text-[10px] py-4">[CHƯA CÓ GỢI Ý CÂU HỎI PHẢN BIỆN]</li>
                  )}
                </ul>
              </div>

              {/* Hoạt động Commit card moved from grading tab */}
              <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-lg flex flex-col h-fit space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <Clock size={14} className="text-cyan-400" />
                    <span>Hoạt động Commit ({commits.length})</span>
                  </h3>
                </div>
                
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {commits.map((c: any, idx: number) => (
                    <div key={c._id || idx} className="p-3 bg-slate-800/30 rounded-xl border border-white/5 text-[10px] space-y-1.5 hover:border-white/10 transition-colors shadow-inner">
                      <p className="font-semibold text-slate-200 truncate leading-snug">{c.message}</p>
                      <div className="flex justify-between items-center text-slate-400 font-mono">
                        <span className="text-cyan-400/80">@{c.authorGithubUsername || c.authorName}</span>
                        <span>{new Date(c.committedAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div className="flex gap-2 text-[9px] font-bold font-mono">
                        <span className="text-emerald-400">+{c.additions}</span>
                        <span className="text-rose-400">-{c.deletions}</span>
                      </div>
                    </div>
                  ))}
                  {commits.length === 0 && (
                    <p className="text-[10px] text-slate-500 italic text-center py-10 font-mono">
                      [CHƯA CÓ HOẠT ĐỘNG COMMIT]
                    </p>
                  )}
                </div>
              </div>

              {/* Project Profile Info */}
              <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-lg space-y-4">
                <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(6,182,212,0.2)] block w-fit">
                  Hồ sơ dự án đội thi
                </span>
                <h4 className="text-sm font-black text-white uppercase truncate">{team.name}</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  Đề tài: <span className="text-cyan-300 font-semibold">{team.topicSubmission?.title || 'Chưa đăng ký'}</span>
                </p>
                
                {team.topicSubmission?.description && (
                  <div className="bg-slate-800/40 p-3.5 rounded-xl border border-white/5 shadow-inner">
                    <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider mb-1.5 font-mono">Mô tả giải pháp:</p>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed font-sans line-clamp-6">{team.topicSubmission.description}</p>
                  </div>
                )}

                {team.members && team.members.length > 0 && (
                  <div className="bg-slate-800/40 p-3.5 rounded-xl border border-white/5 shadow-inner mt-4">
                    <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider mb-2 font-mono">Thành viên nhóm:</p>
                    <div className="space-y-3">
                      {team.members.map((m: any) => (
                        <div key={m._id} className="text-[11px] text-slate-300 border-b border-white/5 pb-2 last:border-none last:pb-0">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-white">{m.userId?.fullName || 'Chưa cập nhật'}</span>
                            <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                              m.role === 'leader' 
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                                : 'bg-slate-700/30 text-slate-400 border border-white/5'
                            }`}>
                              {m.role === 'leader' ? 'Trưởng nhóm' : 'Thành viên'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                            {m.userId?.studentId && <span>MSSV: {m.userId.studentId} • </span>}
                            {m.userId?.university && <span>Trường: {m.userId.university}</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                            Email: {m.userId?.email || 'N/A'}
                          </div>
                          {m.userId?.githubUsername && (
                            <div className="text-[10px] text-cyan-400/80 font-mono mt-1 flex items-center gap-1">
                              <span className="text-[8px] bg-cyan-900/30 px-1 py-0.2 rounded border border-cyan-500/20">GitHub</span>
                              <span className="truncate">{m.userId.githubUsername}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {team.topicSubmission?.demoUrl && (
                  <a
                    href={team.topicSubmission.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-white border border-cyan-500/30 hover:border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2.5 rounded-xl transition-all uppercase tracking-wider shadow-inner w-full"
                  >
                    <ExternalLink size={12} />
                    <span>Xem Link Demo dự án</span>
                  </a>
                )}
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
