import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, 
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
      <div className="text-center py-20 text-slate-550 text-sm animate-pulse">
        Đang tải hoạt động và báo cáo AI của đội thi...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Breadcrumb Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-slate-200 px-6 py-4 rounded-2xl shadow-sm gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/expert/dashboard')}
            className="text-[#F27024] hover:text-[#d95f1f] text-sm font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 text-sm font-bold">Hoạt động: {team.name}</span>
        </div>

        <button
          onClick={() => navigate(`/expert/score/${team._id}`)}
          className="flex items-center gap-2 bg-[#F27024] hover:bg-[#d95f1f] text-white font-bold text-xs px-6 py-3 rounded-xl transition-all uppercase shrink-0 shadow-sm"
        >
          <Award size={14} />
          <span>Vào Bàn Chấm Điểm</span>
        </button>
      </div>

      {/* Team Profile Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] text-[#F27024] font-bold uppercase bg-[#F27024]/10 border border-[#F27024]/20 px-2.5 py-1 rounded-md shadow-sm">
              Tổng quan dự án của đội
            </span>
            <h2 className="text-2xl font-bold text-slate-800 mt-3">{team.name}</h2>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Git Repo Commit History */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
              <GitBranch size={16} className="text-[#F27024]" />
              <span>Lịch sử hoạt động Git Repo ({commits.length})</span>
            </h3>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {commits.map((c: any, idx: number) => (
                <div 
                  key={c._id || idx} 
                  className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-2 hover:border-slate-350 transition-colors shadow-sm"
                >
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-bold text-slate-800 text-sm leading-relaxed">{c.message}</p>
                    <span className="text-xs text-slate-450 font-mono shrink-0">
                      {c.commitSha?.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 font-sans pt-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-[#F27024]">@{c.authorGithubUsername || c.authorName}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px] sm:text-xs">
                      <span className="text-emerald-600 font-bold">+{c.additions} lines</span>
                      <span className="text-rose-600 font-bold">-{c.deletions} lines</span>
                      <span className="text-slate-450 flex items-center gap-1 font-sans">
                        <Calendar size={10} />
                        {getSyncTimeElapsed(c.committedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {commits.length === 0 && (
                <p className="text-xs text-slate-450 italic text-center py-12">
                  Chưa có hoạt động Git nào được ghi nhận.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis & Preview Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col space-y-5">
            <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 border-b border-slate-100 pb-4">
              <Sparkles size={16} className="text-[#F27024]" />
              <span>Phân tích và Nhận định Tổng quan từ AI</span>
            </h3>

            {aiInsight ? (
              <div className="space-y-6">
                {/* RAG level indicator */}
                <div className="bg-[#F27024]/5 p-4 rounded-xl border border-[#F27024]/20 shadow-sm">
                  <span className="text-xs text-[#F27024] font-bold uppercase tracking-normal block">Phân cấp kiến trúc RAG</span>
                  <p className="text-[#F27024] font-black mt-1 text-sm">
                    {aiInsight.smb_scale_advisory?.system_identity_recap?.includes('Agentic') ? 'Agentic RAG System' : 'Advanced RAG System'}
                  </p>
                </div>

                {/* Overall Historical Synthesis */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-normal block">Tóm tắt đánh giá dự án</span>
                  <p className="text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs leading-relaxed font-sans shadow-sm">
                    {aiInsight.overall_picture?.historical_synthesis}
                  </p>
                </div>

                {/* Qualitative Ratings */}
                <div className="space-y-3">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-normal block">Đánh giá định tính (Rubric Stitch R1-R2)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(aiInsight.criteria_comments || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex justify-between items-center shadow-sm hover:border-slate-350 transition-colors">
                        <span className="font-bold text-slate-700 uppercase tracking-normal text-[10px]">{key}</span>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-normal ${
                          value.grade === 'Xuất sắc' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          value.grade === 'Tốt' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          value.grade === 'Khá' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          value.grade === 'Trung bình' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {value.grade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Suggested Critique Questions */}
                <div className="space-y-3 bg-amber-50 p-4 rounded-xl border border-amber-250 border-l-4 border-l-[#F27024] shadow-sm">
                  <span className="text-xs font-bold text-[#F27024] uppercase tracking-normal block flex items-center gap-1.5 border-b border-amber-100 pb-2">
                    <HelpCircle size={14} className="text-[#F27024]" />
                    <span>Bộ câu hỏi phản biện gợi ý cho Giám khảo</span>
                  </span>
                  <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 text-xs font-medium leading-relaxed">
                    {aiQuestions.map((q: string, idx: number) => (
                      <li key={idx} className="hover:text-[#F27024] transition-colors marker:text-[#F27024]">{q}</li>
                    ))}
                    {aiQuestions.length === 0 && (
                      <li className="list-none text-slate-400 italic font-sans">[Chưa cấu hình câu hỏi phản biện gợi ý]</li>
                    )}
                  </ul>
                </div>

              </div>
            ) : (
              <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                <AlertCircle size={28} className="mx-auto text-slate-400 mb-2" />
                <p className="text-xs text-slate-450 italic">Chưa có dữ liệu đánh giá AI phân tích cho dự án này.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
