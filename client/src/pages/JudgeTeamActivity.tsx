import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, 
  ExternalLink, 
  HelpCircle,
  GitBranch,
  Sparkles,
  AlertCircle,
  Calendar,
  Award
} from 'lucide-react';

export default function JudgeTeamActivity() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [selectedEventId, setSelectedEventId] = useState('');
  const [team, setTeam] = useState<any>(null);
  const [commits, setCommits] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Fetch events
  useEffect(() => {
    axios.get('http://localhost:5000/api/events')
      .then((res: any) => {
        if (res.data.length > 0) {
          setSelectedEventId(res.data[0]._id);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Fetch specific team info
  useEffect(() => {
    if (!selectedEventId || !teamId) return;
    
    setLoading(true);
    axios.get(`http://localhost:5000/api/teams/all/${selectedEventId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        const found = res.data.find((t: any) => t._id === teamId);
        if (found) {
          setTeam(found);
        }
      })
      .catch((err: any) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedEventId, teamId, token]);

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

  const getSyncTimeElapsed = (dateStr: string) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `${diffDays} ngày trước`;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) return `${diffHours} giờ trước`;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins} phút trước`;
  };

  if (loading || !team) {
    return (
      <div className="text-center py-20 text-slate-400 text-xs animate-pulse font-mono">
        [ĐANG TẢI HOẠT ĐỘNG VÀ BÁO CÁO AI CỦA ĐỘI THI...]
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Breadcrumb Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-slate-200 px-6 py-4 rounded-xl shadow-sm gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/judge/dashboard')}
            className="text-blue-650 hover:text-blue-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 text-xs font-bold font-mono">Hoạt động: {team.name}</span>
        </div>

        <button
          onClick={() => navigate(`/judge/score/${team._id}`)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-lg shadow-sm transition-all uppercase tracking-wider shrink-0"
        >
          <Award size={14} />
          <span>Vào Bàn Chấm Điểm</span>
        </button>
      </div>

      {/* Team Profile Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[9px] text-blue-700 font-bold uppercase tracking-wider bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
              Tổng quan dự án của đội
            </span>
            <h2 className="text-2xl font-black text-slate-800 mt-2 uppercase">{team.name}</h2>
            <p className="text-xs font-bold text-slate-650 mt-1">Đề tài: {team.topicSubmission?.title || 'Chưa đăng ký'}</p>
          </div>

          {team.topicSubmission?.demoUrl && (
            <a
              href={team.topicSubmission.demoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-650 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-slate-50 px-4 py-2 rounded-lg transition-all uppercase tracking-wider shadow-sm"
            >
              <ExternalLink size={14} />
              <span>Xem Demo</span>
            </a>
          )}
        </div>

        {team.topicSubmission?.description && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 font-mono">Mô tả giải pháp:</p>
            <p className="text-xs text-slate-700 leading-relaxed font-sans">{team.topicSubmission.description}</p>
          </div>
        )}
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Git Repo Commit History */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-4 mb-4">
              <GitBranch size={16} className="text-blue-600" />
              <span>Lịch sử hoạt động Git Repo ({commits.length})</span>
            </h3>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {commits.map((c: any, idx: number) => (
                <div 
                  key={c._id || idx} 
                  className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl space-y-2 hover:border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-bold text-slate-800 text-xs leading-relaxed">{c.message}</p>
                    <span className="text-[9px] text-slate-400 font-mono shrink-0">
                      {c.commitSha?.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-blue-600">@{c.authorGithubUsername || c.authorName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-600 font-bold">+{c.additions} lines</span>
                      <span className="text-rose-600 font-bold">-{c.deletions} lines</span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {getSyncTimeElapsed(c.committedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {commits.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-12 font-mono">
                  [CHƯA CÓ HOẠT ĐỘNG GIT NÀO ĐƯỢC GHI NHẬN]
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis & Preview Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-4">
              <Sparkles size={16} className="text-blue-600" />
              <span>Phân tích và Nhận định Tổng quan từ AI</span>
            </h3>

            {aiInsight ? (
              <div className="space-y-6">
                {/* RAG level indicator */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-150">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Phân cấp kiến trúc RAG</span>
                  <p className="text-blue-700 font-black mt-1 text-sm">
                    {aiInsight.smb_scale_advisory?.system_identity_recap?.includes('Agentic') ? 'Agentic RAG System' : 'Advanced RAG System'}
                  </p>
                </div>

                {/* Overall Historical Synthesis */}
                <div className="space-y-2">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Tóm tắt đánh giá dự án</span>
                  <p className="text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs leading-relaxed font-sans">
                    {aiInsight.overall_picture?.historical_synthesis}
                  </p>
                </div>

                {/* Qualitative Ratings */}
                <div className="space-y-3">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Đánh giá định tính (Rubric Stitch R1-R2)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(aiInsight.criteria_comments || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-slate-50/50 p-3 rounded-xl border border-slate-150 flex justify-between items-center">
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">{key}</span>
                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                          value.grade === 'Xuất sắc' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' :
                          value.grade === 'Tốt' ? 'bg-blue-50 text-blue-700 border border-blue-250' :
                          value.grade === 'Khá' ? 'bg-amber-50 text-amber-700 border border-amber-250' : 'bg-slate-100 text-slate-550 border border-slate-200'
                        }`}>
                          {value.grade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Suggested Critique Questions */}
                <div className="space-y-3 bg-blue-50/40 p-4 rounded-xl border border-blue-100 border-l-4 border-l-blue-600 shadow-sm">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block flex items-center gap-1.5 border-b border-blue-100 pb-2">
                    <HelpCircle size={14} className="text-blue-600" />
                    <span>Bộ câu hỏi phản biện gợi ý cho Giám khảo</span>
                  </span>
                  <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 text-xs font-medium leading-relaxed">
                    {aiQuestions.map((q: string, idx: number) => (
                      <li key={idx} className="hover:text-blue-900 transition-colors">{q}</li>
                    ))}
                    {aiQuestions.length === 0 && (
                      <li className="list-none text-slate-400 italic font-mono">[Chưa cấu hình câu hỏi phản biện gợi ý]</li>
                    )}
                  </ul>
                </div>

              </div>
            ) : (
              <div className="text-center py-16 bg-slate-50/40 rounded-xl border border-slate-150">
                <AlertCircle size={28} className="mx-auto text-slate-350 mb-2" />
                <p className="text-xs text-slate-450 italic font-mono">[CHƯA CÓ DỮ LIỆU ĐÁNH GIÁ AI PHÂN TÍCH CHO DỰ ÁN NÀY]</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
