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

  const [team, setTeam] = useState<any>(null);
  const [commits, setCommits] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Fetch specific team info directly
  useEffect(() => {
    if (!teamId) return;
    
    setLoading(true);
    axios.get(`http://localhost:5000/api/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        setTeam(res.data);
      })
      .catch((err: any) => {
        console.error('Error fetching team info:', err);
      })
      .finally(() => setLoading(false));
  }, [teamId, token]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/40 backdrop-blur-md border border-white/10 px-6 py-4 rounded-xl shadow-lg gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/expert/dashboard')}
            className="text-cyan-400 hover:text-cyan-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]"
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-white text-xs font-bold font-mono drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">Hoạt động: {team.name}</span>
        </div>

        <button
          onClick={() => navigate(`/expert/score/${team._id}`)}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all uppercase tracking-wider shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)]"
        >
          <Award size={14} />
          <span>Vào Bàn Chấm Điểm</span>
        </button>
      </div>

      {/* Team Profile Banner */}
      <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-xl border border-white/10 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(6,182,212,0.2)]">
              Tổng quan dự án của đội
            </span>
            <h2 className="text-2xl font-black text-white mt-2 uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{team.name}</h2>
            <p className="text-xs font-bold text-slate-300 mt-1">Đề tài: <span className="text-cyan-200">{team.topicSubmission?.title || 'Chưa đăng ký'}</span></p>
          </div>

          {team.topicSubmission?.demoUrl && (
            <a
              href={team.topicSubmission.demoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-white border border-cyan-500/30 hover:border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2 rounded-xl transition-all uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.1)]"
            >
              <ExternalLink size={14} />
              <span>Xem Demo</span>
            </a>
          )}
        </div>

        {team.topicSubmission?.description && (
          <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5 shadow-inner">
            <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider mb-1.5 font-mono drop-shadow-[0_0_5px_rgba(6,182,212,0.3)]">Mô tả giải pháp:</p>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{team.topicSubmission.description}</p>
          </div>
        )}
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Git Repo Commit History */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-lg flex flex-col">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
              <GitBranch size={16} className="text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
              <span>Lịch sử hoạt động Git Repo ({commits.length})</span>
            </h3>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {commits.map((c: any, idx: number) => (
                <div 
                  key={c._id || idx} 
                  className="bg-slate-800/30 border border-white/5 p-4 rounded-xl space-y-2 hover:border-white/10 transition-colors shadow-inner"
                >
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-bold text-slate-200 text-xs leading-relaxed drop-shadow-[0_0_2px_rgba(255,255,255,0.1)]">{c.message}</p>
                    <span className="text-[9px] text-slate-500 font-mono shrink-0">
                      {c.commitSha?.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-cyan-400/80">@{c.authorGithubUsername || c.authorName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]">+{c.additions} lines</span>
                      <span className="text-rose-400 font-bold drop-shadow-[0_0_5px_rgba(251,113,133,0.3)]">-{c.deletions} lines</span>
                      <span className="text-slate-500 flex items-center gap-1">
                        <Calendar size={10} />
                        {getSyncTimeElapsed(c.committedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {commits.length === 0 && (
                <p className="text-xs text-slate-500 italic text-center py-12 font-mono">
                  [CHƯA CÓ HOẠT ĐỘNG GIT NÀO ĐƯỢC GHI NHẬN]
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis & Preview Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-lg flex flex-col space-y-5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-4">
              <Sparkles size={16} className="text-teal-400 drop-shadow-[0_0_5px_rgba(20,184,166,0.5)]" />
              <span>Phân tích và Nhận định Tổng quan từ AI</span>
            </h3>

            {aiInsight ? (
              <div className="space-y-6">
                {/* RAG level indicator */}
                <div className="bg-cyan-950/20 p-4 rounded-xl border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <span className="text-[9px] text-cyan-300/70 font-bold uppercase tracking-wider block font-mono">Phân cấp kiến trúc RAG</span>
                  <p className="text-cyan-400 font-black mt-1 text-sm drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                    {aiInsight.smb_scale_advisory?.system_identity_recap?.includes('Agentic') ? 'Agentic RAG System' : 'Advanced RAG System'}
                  </p>
                </div>

                {/* Overall Historical Synthesis */}
                <div className="space-y-2">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block font-mono">Tóm tắt đánh giá dự án</span>
                  <p className="text-slate-300 bg-slate-800/40 p-4 rounded-xl border border-white/5 text-xs leading-relaxed font-sans shadow-inner">
                    {aiInsight.overall_picture?.historical_synthesis}
                  </p>
                </div>

                {/* Qualitative Ratings */}
                <div className="space-y-3">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block font-mono">Đánh giá định tính (Rubric Stitch R1-R2)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(aiInsight.criteria_comments || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-slate-800/40 p-3 rounded-xl border border-white/5 flex justify-between items-center shadow-inner hover:border-white/10 transition-colors">
                        <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">{key}</span>
                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                          value.grade === 'Xuất sắc' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' :
                          value.grade === 'Tốt' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]' :
                          value.grade === 'Khá' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]' :
                          value.grade === 'Trung bình' ? 'bg-slate-800/60 text-slate-300 border border-slate-700' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {value.grade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Suggested Critique Questions */}
                <div className="space-y-3 bg-teal-950/10 p-4 rounded-xl border border-teal-500/20 border-l-4 border-l-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.1)]">
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block flex items-center gap-1.5 border-b border-teal-500/20 pb-2">
                    <HelpCircle size={14} className="text-teal-400 drop-shadow-[0_0_5px_rgba(20,184,166,0.5)]" />
                    <span>Bộ câu hỏi phản biện gợi ý cho Giám khảo</span>
                  </span>
                  <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-300 text-xs font-medium leading-relaxed">
                    {aiQuestions.map((q: string, idx: number) => (
                      <li key={idx} className="hover:text-teal-300 transition-colors marker:text-teal-500">{q}</li>
                    ))}
                    {aiQuestions.length === 0 && (
                      <li className="list-none text-slate-500 italic font-mono">[Chưa cấu hình câu hỏi phản biện gợi ý]</li>
                    )}
                  </ul>
                </div>

              </div>
            ) : (
              <div className="text-center py-16 bg-slate-900/20 rounded-xl border border-white/5 shadow-inner">
                <AlertCircle size={28} className="mx-auto text-slate-600 mb-2 drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]" />
                <p className="text-xs text-slate-500 italic font-mono">[CHƯA CÓ DỮ LIỆU ĐÁNH GIÁ AI PHÂN TÍCH CHO DỰ ÁN NÀY]</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
