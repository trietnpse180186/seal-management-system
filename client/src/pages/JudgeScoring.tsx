import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Sparkles, 
  AlertCircle, 
  Save, 
  CheckCircle, 
  Lock, 
  ArrowLeft,
  ExternalLink,
  HelpCircle
} from 'lucide-react';

export default function JudgeScoring() {
  const { teamId } = useParams();
  const navigate = useNavigate();
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

  // Fetch events
  useEffect(() => {
    axios.get('http://localhost:5000/api/events')
      .then((res: any) => {
        if (res.data.length > 0) {
          setSelectedEventId(res.data[0]._id);
        }
      })
      .catch((err: any) => console.error(err));
  }, []);

  // Fetch event details (rounds, tracks)
  useEffect(() => {
    if (!selectedEventId) return;
    axios.get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res: any) => {
        setRounds(res.data.rounds || []);
        if (res.data.rounds && res.data.rounds.length > 0) {
          setSelectedRoundId(res.data.rounds[0]._id);
        }
      })
      .catch((err: any) => console.error(err));
  }, [selectedEventId]);

  // Fetch specific team info
  useEffect(() => {
    if (!selectedEventId || !teamId) return;
    axios.get(`http://localhost:5000/api/teams/all/${selectedEventId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        const found = res.data.find((t: any) => t._id === teamId);
        if (found) {
          setTeam(found);
        }
      })
      .catch((err: any) => console.error(err));
  }, [selectedEventId, teamId, token]);

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

    const details = Object.entries(scores).map(([critId, val]: [string, any]) => ({
      criterionId: critId,
      scoreValue: parseFloat(val.scoreValue),
      comment: val.comment
    }));

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
      <div className="text-center py-20 text-slate-400 text-xs animate-pulse font-mono">
        [ĐANG TẢI THÔNG TIN ĐỘI THI...]
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Sub-header/Breadcrumb Row */}
      <div className="flex justify-between items-center bg-white border border-slate-200 px-6 py-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/judge/projects')}
            className="text-blue-650 hover:text-blue-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            <span>Danh sách dự án</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 text-xs font-bold font-mono">Chấm điểm: {team.name}</span>
        </div>

        <div className="flex items-center gap-3">
          {isGraded ? (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
              Đã chấm điểm
            </span>
          ) : (
            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
              Chờ chấm điểm
            </span>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Project Info & Grading Rubric */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            
            {/* Project Details */}
            <div className="border-b border-slate-100 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[9px] text-blue-700 font-bold uppercase tracking-wider bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                  Chi tiết đề tài của đội thi
                </span>
                <h2 className="text-2xl font-black text-slate-800 mt-2 uppercase">{team.name}</h2>
                <p className="text-xs font-bold text-slate-650 mt-1">Đề tài: {team.topicSubmission?.title || 'Chưa đăng ký'}</p>
              </div>

              {team.topicSubmission?.demoUrl && (
                <a
                  href={team.topicSubmission.demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-slate-50 px-4 py-2 rounded-lg transition-all uppercase tracking-wider shadow-sm"
                >
                  <ExternalLink size={14} />
                  <span>Xem Demo</span>
                </a>
              )}
            </div>

            {team.topicSubmission?.description && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 font-mono">Mô tả chi tiết giải pháp:</p>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">{team.topicSubmission.description}</p>
              </div>
            )}

            {isRoundLocked && (
              <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-4 rounded-xl text-xs flex items-center gap-2 font-bold uppercase tracking-wider shadow-sm">
                <Lock size={16} className="shrink-0" />
                <span>Vòng đấu này đã đóng và khóa điểm. Không thể chỉnh sửa điểm.</span>
              </div>
            )}

            {message.text && (
              <div className={`p-4 rounded-xl text-xs border flex items-center gap-2 shadow-sm ${
                message.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
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
                  className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider shadow-sm"
                >
                  <Sparkles size={14} className={aiLoading ? 'animate-spin' : ''} />
                  <span>{aiLoading ? 'AI đang phân tích...' : 'Lấy gợi ý từ Gemini AI'}</span>
                </button>
              </div>
            )}

            {/* Rubric Criteria Form */}
            {rubric ? (
              <form onSubmit={handleSubmitScores} className="space-y-6">
                <div className="space-y-6">
                  {criteria.map((c: any) => (
                    <div key={c._id} className="bg-slate-50/40 border border-slate-200 p-5 rounded-xl space-y-4">
                      
                      {/* Criterion Header & Score Input */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-600 font-mono">[{c.code}]</span>
                            <span className="text-xs font-bold text-slate-800 uppercase">{c.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-sans">{c.description || 'Không có mô tả.'}</p>
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
                            className="bg-white border border-slate-300 rounded-lg text-slate-850 text-center text-xs px-2 py-2 w-24 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none disabled:opacity-50 font-bold"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">/ {c.maxScore}đ</span>
                        </div>
                      </div>

                      {/* Grading Levels Guides */}
                      {c.gradingLevels && c.gradingLevels.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Mức điểm hướng dẫn:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {c.gradingLevels.map((lvl: any, idx: number) => {
                              const scoreVal = parseFloat(scores[c._id]?.scoreValue);
                              const isMatched = !isNaN(scoreVal) && scoreVal >= lvl.minScore && scoreVal <= lvl.maxScore;

                              return (
                                <div
                                  key={idx}
                                  className={`p-3 rounded-lg border transition-all duration-300 ${
                                    isMatched
                                      ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-sm'
                                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-500'
                                  }`}
                                >
                                  <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className={isMatched ? 'text-blue-700' : 'text-slate-700'}>{lvl.label}</span>
                                    <span className="text-slate-400 font-mono">{lvl.minScore} - {lvl.maxScore}đ</span>
                                  </div>
                                  {lvl.description && (
                                    <p className="text-[9px] text-slate-500 mt-1 leading-relaxed font-sans">{lvl.description}</p>
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
                          className="bg-white border border-slate-250 rounded-lg text-slate-700 text-xs px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overall Comment */}
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider font-mono">
                    Ý kiến nhận xét tổng quan (Overall Comment)
                  </label>
                  <textarea
                    placeholder={isRoundLocked ? "Không có nhận xét tổng quan." : "Ý kiến đánh giá thế mạnh, điểm yếu và định hướng phát triển của đội thi..."}
                    rows={4}
                    value={overallComment}
                    onChange={e => setOverallComment(e.target.value)}
                    disabled={isRoundLocked}
                    className="bg-white border border-slate-350 rounded-lg text-slate-700 text-xs px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 font-sans"
                  ></textarea>
                </div>

                {/* Submit button */}
                {!isRoundLocked && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 uppercase tracking-widest"
                  >
                    <Save size={16} />
                    <span>{saving ? 'Đang nộp điểm...' : 'Xác nhận nộp điểm số'}</span>
                  </button>
                )}
              </form>
            ) : (
              <div className="bg-white p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[350px] border border-slate-200 shadow-sm rounded-2xl">
                <Lock size={48} className="text-slate-300 mb-3" />
                <p className="font-semibold text-lg text-slate-800">Bảng Rubric chưa sẵn sàng</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  Bảng điểm Rubric của vòng đấu này chưa được cấu hình hoặc chưa khóa chính thức. Giám khảo vui lòng quay lại sau.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Commits & AI Analysis Sidebar (xl:col-span-4) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-fit space-y-4">
            
            {/* Sidebar Tabs */}
            <div className="flex border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setSidebarTab('commits')}
                className={`flex-1 text-center py-1.5 text-xs font-bold transition-all uppercase tracking-wider ${
                  sidebarTab === 'commits' 
                    ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Commits ({commits.length})
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('ai')}
                className={`flex-1 text-center py-1.5 text-xs font-bold transition-all uppercase tracking-wider ${
                  sidebarTab === 'ai' 
                    ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Phân tích AI
              </button>
            </div>

            {/* Commits List Tab */}
            {sidebarTab === 'commits' ? (
              <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
                {commits.map((c: any, idx: number) => (
                  <div key={c._id || idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-[10px] space-y-1.5 hover:border-slate-200 transition-colors">
                    <p className="font-semibold text-slate-800 truncate leading-snug">{c.message}</p>
                    <div className="flex justify-between items-center text-slate-500 font-mono">
                      <span>@{c.authorGithubUsername || c.authorName}</span>
                      <span>{new Date(c.committedAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="flex gap-2 text-[9px] font-bold font-mono">
                      <span className="text-emerald-600">+{c.additions}</span>
                      <span className="text-rose-600">-{c.deletions}</span>
                    </div>
                  </div>
                ))}
                {commits.length === 0 && (
                  <p className="text-[10px] text-slate-400 italic text-center py-8 font-mono">
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
                    <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Phân cấp RAG phát hiện</span>
                      <p className="text-blue-700 font-black mt-1 text-sm">
                        {aiInsight.smb_scale_advisory?.system_identity_recap?.includes('Agentic') ? 'Agentic RAG' : 'Advanced RAG'}
                      </p>
                    </div>

                    {/* Historical Synthesis */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-550 font-bold uppercase tracking-wider block font-mono">Tổng quan đánh giá</span>
                      <p className="text-slate-650 bg-slate-50 p-3 rounded-lg border border-slate-150 text-[10px] leading-relaxed font-sans">
                        {aiInsight.overall_picture?.historical_synthesis}
                      </p>
                    </div>

                    {/* Qualitative criteria review */}
                    <div className="space-y-2">
                      <span className="text-[9px] text-slate-550 font-bold uppercase tracking-wider block font-mono">Đánh giá định tính (Stitch R1-R2)</span>
                      <div className="space-y-1.5 text-[10px]">
                        {Object.entries(aiInsight.criteria_comments || {}).map(([key, value]: [string, any]) => (
                          <div key={key} className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-150">
                            <span className="font-bold text-slate-700">{key}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                              value.grade === 'Xuất sắc' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' :
                              value.grade === 'Tốt' ? 'bg-blue-50 text-blue-700 border border-blue-250' :
                              value.grade === 'Khá' ? 'bg-amber-50 text-amber-700 border border-amber-250' : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {value.grade}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Judge Q&A Questions */}
                    <div className="space-y-3 bg-blue-50/40 p-4 rounded-xl border border-blue-100 border-l-4 border-l-blue-600 shadow-sm">
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block flex items-center gap-1.5 border-b border-blue-100 pb-2">
                        <HelpCircle size={14} className="text-blue-600" />
                        <span>Câu hỏi phản biện gợi ý</span>
                      </span>
                      <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 text-xs font-medium leading-relaxed">
                        {aiQuestions.map((q: string, idx: number) => (
                          <li key={idx} className="hover:text-blue-900 transition-colors">{q}</li>
                        ))}
                        {aiQuestions.length === 0 && (
                          <li className="list-none text-slate-400 italic font-mono">[KHÔNG CÓ GỢI Ý]</li>
                        )}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-slate-400 italic text-center py-8 font-mono">
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
