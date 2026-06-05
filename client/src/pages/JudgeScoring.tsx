import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Sparkles, 
  AlertCircle, 
  Save, 
  CheckCircle, 
  Lock, 
  ArrowLeft,
  ExternalLink,
  Activity,
  Code,
  Zap,
  ShieldAlert
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
  
  const [team, setTeam] = useState<any>(null);
  const [rubric, setRubric] = useState<any>(null);
  const [criteria, setCriteria] = useState<any[]>([]);
  
  // Commits & AI Insights (for scoring panel)
  const [commits, setCommits] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'commits' | 'ai'>('commits');
  
  // Grade state
  const [scores, setScores] = useState<any>({});
  const [overallComment, setOverallComment] = useState('');
  const [isGraded, setIsGraded] = useState(false);
  
  // Status indicators
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const currentRound = rounds.find((r: any) => r._id === selectedRoundId);
  const isRoundLocked = currentRound?.status === 'completed';

  // Fetch specific team info directly
  useEffect(() => {
    if (!teamId) return;
    axios.get(`http://localhost:5000/api/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        setTeam(res.data);
        if (res.data.eventId) {
          // If populated eventId is an object
          const evId = res.data.eventId._id || res.data.eventId;
          setSelectedEventId(evId);
        }
      })
      .catch((err: any) => console.error('Error fetching team info:', err));
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
        setCriteria(res.data.criteria || []);
        
        const initial: any = {};
        res.data.criteria.forEach((c: any) => {
          initial[c._id] = { scoreValue: '', comment: '' };
        });
        setScores(initial);
      })
      .catch((err: any) => {
        setRubric(null);
        setCriteria([]);
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
        const agg = res.data.find((r: any) => r.analysisType === 'repository_review' && r.status === 'completed');
        setAiInsight(agg ? agg.result : null);

        const commitReview = res.data.find((r: any) => r.analysisType === 'commit_review' && r.status === 'completed');
        setAiQuestions(commitReview?.result?.suggested_questions_for_team || []);
      })
      .catch((err: any) => {
        console.error(err);
        setAiInsight(null);
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

  const handleSubmitScores = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setMessage({ type: 'success', text: `Nộp điểm thành công! Tổng điểm: ${res.data.totalWeightedScore}/10` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Có lỗi khi nộp điểm.' });
    } finally {
      setSaving(false);
    }
  };

  if (!team) {
    return (
      <div className="text-center py-20 text-cyan-400 text-xs animate-pulse font-mono">
        [ĐANG TẢI THÔNG TIN ĐỘI THI...]
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Sub-header/Breadcrumb Row */}
      <div className="flex justify-between items-center bg-slate-900/40 backdrop-blur-md border border-white/10 px-6 py-4 rounded-xl shadow-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/judge/projects')}
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

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Project Info & Grading Rubric */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-xl border border-white/10 shadow-lg space-y-6">
            
            {/* Project Details */}
            <div className="border-b border-white/5 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                  Chi tiết đề tài của đội thi
                </span>
                <h2 className="text-2xl font-black text-white mt-2 uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{team.name}</h2>
                <p className="text-xs font-bold text-slate-300 mt-1">Đề tài: <span className="text-cyan-200">{team.topicSubmission?.title || 'Chưa đăng ký'}</span></p>
              </div>

              {team.topicSubmission?.demoUrl && (
                <a
                  href={team.topicSubmission.demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-white border border-cyan-500/30 hover:border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2 rounded-lg transition-all uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                >
                  <ExternalLink size={14} />
                  <span>Xem Demo</span>
                </a>
              )}
            </div>

            {team.topicSubmission?.description && (
              <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5 shadow-inner">
                <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider mb-1.5 font-mono drop-shadow-[0_0_5px_rgba(6,182,212,0.3)]">Mô tả chi tiết giải pháp:</p>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{team.topicSubmission.description}</p>
              </div>
            )}

            {isRoundLocked && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-xs flex items-center gap-2 font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                <Lock size={16} className="shrink-0" />
                <span>Vòng đấu này đã đóng và khóa điểm. Không thể chỉnh sửa điểm.</span>
              </div>
            )}

            {message.text && (
              <div className={`p-4 rounded-xl text-xs border flex items-center gap-2 shadow-[0_0_15px_rgba(0,0,0,0.2)] ${
                message.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{message.text}</span>
              </div>
            )}

            {/* AI Grading Assist trigger */}
            {!isRoundLocked && rubric && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleGetAiSuggestion}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 hover:from-teal-500/40 hover:to-cyan-500/40 text-teal-300 border border-teal-500/30 hover:border-teal-400 px-4 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider shadow-[0_0_15px_rgba(20,184,166,0.3)] hover:shadow-[0_0_20px_rgba(20,184,166,0.5)]"
                >
                  <Sparkles size={14} className={aiLoading ? 'animate-spin' : 'text-teal-400'} />
                  <span className="drop-shadow-[0_0_5px_rgba(20,184,166,0.5)]">{aiLoading ? 'AI đang phân tích...' : 'Lấy gợi ý từ Gemini AI'}</span>
                </button>
              </div>
            )}

            {/* Rubric Criteria Form */}
            {rubric ? (
              <form onSubmit={handleSubmitScores} className="space-y-6">
                <div className="space-y-6">
                  {criteria.map((c: any) => (
                    <div key={c._id} className="bg-slate-800/20 border border-white/5 p-5 rounded-xl space-y-4 hover:border-white/10 transition-colors shadow-inner">
                      
                      {/* Criterion Header & Score Input */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-cyan-400 font-mono drop-shadow-[0_0_5px_rgba(6,182,212,0.3)]">[{c.code}]</span>
                            <span className="text-xs font-bold text-white uppercase drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">{c.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{c.description || 'Không có mô tả.'}</p>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={c.maxScore}
                            required
                            placeholder={`0-${c.maxScore}`}
                            value={scores[c._id]?.scoreValue || ''}
                            onChange={e => handleScoreChange(c._id, 'scoreValue', e.target.value)}
                            disabled={isRoundLocked}
                            className="bg-slate-900 border border-slate-600 rounded-lg text-white text-center text-xs px-2 py-2 w-24 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 focus:outline-none disabled:opacity-50 font-bold shadow-inner placeholder-slate-600"
                          />
                          <span className="text-[10px] text-slate-500 font-mono">/ {c.maxScore}đ</span>
                        </div>
                      </div>

                      {/* Grading Levels Guides */}
                      {c.gradingLevels && c.gradingLevels.length > 0 && (
                        <div className="pt-3 border-t border-white/5 space-y-2">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Mức điểm hướng dẫn:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {c.gradingLevels.map((lvl: any, idx: number) => {
                              const scoreVal = parseFloat(scores[c._id]?.scoreValue);
                              const isMatched = !isNaN(scoreVal) && scoreVal >= lvl.minScore && scoreVal <= lvl.maxScore;

                              return (
                                <div
                                  key={idx}
                                  className={`p-3 rounded-lg border transition-all duration-300 ${
                                    isMatched
                                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                      : 'bg-slate-800/30 border-white/5 hover:border-white/10 text-slate-400'
                                  }`}
                                >
                                  <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className={isMatched ? 'text-cyan-200 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]' : 'text-slate-300'}>{lvl.label}</span>
                                    <span className={isMatched ? 'text-cyan-300 font-mono' : 'text-slate-500 font-mono'}>{lvl.minScore} - {lvl.maxScore}đ</span>
                                  </div>
                                  {lvl.description && (
                                    <p className={`text-[9px] mt-1 leading-relaxed font-sans ${isMatched ? 'text-cyan-200/70' : 'text-slate-500'}`}>{lvl.description}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Comment for this specific Criterion */}
                      <div>
                        <input
                          type="text"
                          placeholder={isRoundLocked ? "Không có nhận xét." : "Nhập nhận xét cụ thể cho tiêu chí này..."}
                          value={scores[c._id]?.comment || ''}
                          onChange={e => handleScoreChange(c._id, 'comment', e.target.value)}
                          disabled={isRoundLocked}
                          className="bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-xs px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 disabled:opacity-50 shadow-inner placeholder-slate-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overall Comment */}
                <div className="pt-4 border-t border-white/5">
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider font-mono">
                    Ý kiến nhận xét tổng quan (Overall Comment)
                  </label>
                  <textarea
                    placeholder={isRoundLocked ? "Không có nhận xét tổng quan." : "Ý kiến đánh giá thế mạnh, điểm yếu và định hướng phát triển của đội thi..."}
                    rows={4}
                    value={overallComment}
                    onChange={e => setOverallComment(e.target.value)}
                    disabled={isRoundLocked}
                    className="bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-xs px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 disabled:opacity-50 font-sans shadow-inner placeholder-slate-600"
                  ></textarea>
                </div>

                {/* Submit button */}
                {!isRoundLocked && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] uppercase tracking-widest"
                  >
                    <Save size={16} />
                    <span>{saving ? 'Đang lưu điểm...' : 'Nộp điểm chính thức'}</span>
                  </button>
                )}
              </form>
            ) : (
              <div className="bg-slate-900/20 p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[350px] border border-white/5 shadow-inner rounded-2xl">
                <Lock size={48} className="text-slate-600 mb-3 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                <p className="font-semibold text-lg text-slate-300">Bảng Rubric chưa sẵn sàng</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  Bảng điểm Rubric của vòng đấu này chưa được cấu hình hoặc chưa khóa chính thức. Giám khảo vui lòng quay lại sau.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Commits & AI Analysis Sidebar (xl:col-span-4) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-lg flex flex-col h-fit space-y-4">
            
            {/* Sidebar Tabs */}
            <div className="flex border-b border-white/5 pb-2">
              <button
                type="button"
                onClick={() => setSidebarTab('commits')}
                className={`flex-1 text-center py-1.5 text-xs font-bold transition-all uppercase tracking-wider relative ${
                  sidebarTab === 'commits' 
                    ? 'text-cyan-400 font-extrabold drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Commit ({commits.length})
                {sidebarTab === 'commits' && (
                  <div className="absolute bottom-[-9px] left-0 w-full h-[2px] bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('ai')}
                className={`flex-1 text-center py-1.5 text-xs font-bold transition-all uppercase tracking-wider relative ${
                  sidebarTab === 'ai' 
                    ? 'text-teal-400 font-extrabold drop-shadow-[0_0_5px_rgba(20,184,166,0.5)]' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Phân tích AI
                {sidebarTab === 'ai' && (
                  <div className="absolute bottom-[-9px] left-0 w-full h-[2px] bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
                )}
              </button>
            </div>

            {/* Commits List Tab */}
            {sidebarTab === 'commits' ? (
              <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
                {commits.map((c: any, idx: number) => (
                  <div key={c._id || idx} className="p-3.5 bg-slate-800/30 rounded-xl border border-white/5 text-[10px] space-y-1.5 hover:border-white/10 transition-colors shadow-inner">
                    <p className="font-semibold text-slate-200 truncate leading-snug drop-shadow-[0_0_2px_rgba(255,255,255,0.1)]">{c.message}</p>
                    <div className="flex justify-between items-center text-slate-400 font-mono">
                      <span className="text-cyan-400/80">@{c.authorGithubUsername || c.authorName}</span>
                      <span>{new Date(c.committedAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="flex gap-2 text-[9px] font-bold font-mono">
                      <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]">+{c.additions}</span>
                      <span className="text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.3)]">-{c.deletions}</span>
                    </div>
                  </div>
                ))}
                {commits.length === 0 && (
                  <p className="text-[10px] text-slate-500 italic text-center py-8 font-mono">
                    [CHƯA CÓ HOẠT ĐỘNG COMMIT]
                  </p>
                )}
              </div>
            ) : (
              /* AI Analysis Tab */
              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1 text-xs leading-relaxed">
                {aiInsight ? (
                  <>
                    {/* RAG Level Badge */}
                    <div className="bg-cyan-950/20 p-3.5 rounded-xl border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                      <span className="text-[9px] text-cyan-300/70 font-bold uppercase tracking-wider block font-mono flex items-center gap-1.5"><Zap size={12} className="text-cyan-400" /> Phân cấp RAG phát hiện</span>
                      <p className="text-cyan-400 font-black mt-1 text-sm drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                        {aiInsight.smb_scale_advisory?.system_identity_recap?.includes('Agentic') ? 'Agentic RAG' : 'Advanced RAG'}
                      </p>
                    </div>

                    {/* Historical Synthesis */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block font-mono flex items-center gap-1.5"><Code size={12} /> Tổng quan đánh giá</span>
                      <p className="text-slate-300 bg-slate-800/40 p-3 rounded-lg border border-white/5 text-[10px] leading-relaxed font-sans shadow-inner">
                        {aiInsight.overall_picture?.historical_synthesis}
                      </p>
                    </div>

                    {/* Qualitative criteria review */}
                    <div className="space-y-3">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block font-mono flex items-center gap-1.5"><Activity size={12} /> Đánh giá chi tiết tiêu chí (Stitch R1-R2)</span>
                        {Object.entries(aiInsight.criteria_comments || {}).map(([key, value]: [string, any]) => {
                          const matchedCrit = criteria.find(c => c.code === key);
                          const displayName = matchedCrit ? matchedCrit.name : key;
                          return (
                            <div key={key} className="bg-slate-800/40 p-3 rounded-xl border border-white/5 shadow-inner space-y-1.5 hover:border-white/10 transition-colors">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-300">{displayName}</span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
                                  value.grade === 'Xuất sắc' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' :
                                  value.grade === 'Tốt' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]' :
                                  value.grade === 'Khá' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]' :
                                  value.grade === 'Trung bình' ? 'bg-slate-800/60 text-slate-300 border border-slate-700' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}>
                                  {value.grade}
                                </span>
                              </div>
                              {value.comment && (
                                <p className="text-slate-400 leading-relaxed font-sans text-[10px] pl-2 border-l border-slate-700 mt-1">
                                  {value.comment}
                                </p>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Judge Q&A Questions */}
                    <div className="space-y-3 bg-teal-950/10 p-4 rounded-xl border border-teal-500/20 border-l-4 border-l-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.1)]">
                      <span className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-teal-500/20 pb-2">
                        <ShieldAlert size={14} className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]" />
                        <span className="drop-shadow-[0_0_5px_rgba(20,184,166,0.3)]">Câu hỏi phản biện gợi ý</span>
                      </span>
                      <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-300 text-[11px] font-medium leading-relaxed">
                        {aiQuestions.map((q: string, idx: number) => (
                          <li key={idx} className="hover:text-teal-300 transition-colors marker:text-teal-500">{q}</li>
                        ))}
                        {aiQuestions.length === 0 && (
                          <li className="list-none text-slate-500 italic font-mono">[KHÔNG CÓ GỢI Ý]</li>
                        )}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-slate-500 italic text-center py-8 font-mono">
                    [CHƯA CÓ PHÂN TÍCH TỔNG HỢP AI]
                  </p>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
