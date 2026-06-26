import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, Clock, FileDiff, BookOpen, Users, MessageSquare } from 'lucide-react';
import RegisterTeam from './RegisterTeam';

const Github = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function TeamArea() {
  const token = localStorage.getItem('token');
  const [data, setData] = useState<any>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const startTimeStr = data?.team?.trackId?.startTime;
    if (!startTimeStr) return;

    const startTime = new Date(startTimeStr);
    if (startTime <= new Date()) return;

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (now >= startTime) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [data?.team?.trackId?.startTime]);

  const getRemainingTimeText = (startTimeStr: string) => {
    const diff = new Date(startTimeStr).getTime() - currentTime.getTime();
    if (diff <= 0) return '00:00:00';
    
    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    const pad = (num: number) => num.toString().padStart(2, '0');
    
    if (days > 0) {
      return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const getTeamStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'ĐÃ XÁC NHẬN';
      case 'pending_confirm': return 'ĐANG CHỜ DUYỆT';
      default: return status?.toUpperCase() || '';
    }
  };
  
  
  // Git commits & AI report
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<any>(null);



  // Status indicators
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState('');
  const setError = (msg: string) => {
    _setError(msg);
    if (msg) toast.error(msg);
  };

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get('http://localhost:5000/api/teams/my-team', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const team = res.data?.team;
      const isEventEnded = team && (
        team.eventId?.status === 'completed' || 
        team.eventId?.status === 'cancelled' ||
        (team.eventId?.contestEnd && new Date(team.eventId.contestEnd) <= new Date())
      );
      if (isEventEnded) {
        setData({ team: null });
      } else {
        setData(res.data);
        


        // Fetch commits if repo exists
        if (res.data.repository) {
          fetchCommits(res.data.team._id);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 404) {
        setData({ team: null });
      } else {
        setError(err.response?.data?.message || 'Lỗi tải thông tin đội thi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCommits = async (teamId: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/analytics/team/${teamId}/commits`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCommits(res.data);
      if (res.data.length > 0) {
        handleSelectCommit(res.data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching commits:', err);
    }
  };

  const handleSelectCommit = (commitObj: any) => {
    setSelectedCommit(commitObj);
  };



  useEffect(() => {
    fetchTeamData();
  }, []);





  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="text-slate-400 text-lg animate-pulse">Đang tải thông tin đội thi...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="glass p-8 rounded-3xl border-rose-500/20">
          <p className="text-rose-400 font-semibold mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-indigo-600 px-5 py-2.5 rounded-xl text-sm font-semibold">Tải lại</button>
        </div>
      </div>
    );
  }

  const { team, members, repository } = data || {};

  const isEventEnded = team && (
    team.eventId?.status === 'completed' || 
    team.eventId?.status === 'cancelled' ||
    (team.eventId?.contestEnd && new Date(team.eventId.contestEnd) <= new Date())
  );

  if (!team || isEventEnded) {
    return <RegisterTeam />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8 font-mono">
      
      {/* Top Banner team details */}
      <div className="glass p-8 rounded-3xl relative overflow-hidden border border-slate-800 hover:border-cyan-500/30 transition-all">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          
          {/* Main Info (Col 5): Team name & Status */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-cyan-400 font-bold border border-cyan-500/30 px-2 py-0.5 rounded bg-cyan-950/20 tracking-widest uppercase">
                [ĐỘI THI]
              </span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded font-extrabold tracking-wider ${
                team?.status?.toLowerCase() === 'confirmed'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {getTeamStatusText(team?.status)}
              </span>
            </div>
            
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight text-cyan-glow">
                {team?.name}
              </h1>
              <p className="text-[11px] text-slate-400 mt-1.5 font-sans leading-relaxed">
                Khu vực làm việc và theo dõi tiến độ chính thức của đội thi.
              </p>
            </div>
          </div>

          {/* Vertical Divider (Hidden on mobile) */}
          <div className="hidden lg:block lg:col-span-1 h-16 border-l border-slate-800/80 mx-auto"></div>

          {/* Contest Metadata (Col 3): Event & Semester */}
          <div className="lg:col-span-3 space-y-3 font-sans">
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-mono tracking-wider font-bold">CUỘC THI</span>
              <span className="text-sm font-extrabold text-white font-mono uppercase truncate block">
                {team?.eventId?.name || '---'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-mono tracking-wider font-bold">HỌC KỲ</span>
              <span className="text-xs font-bold text-slate-300 font-mono">
                {team?.eventId?.semester ? `Kỳ ${team.eventId.semester} ${team.eventId.year}` : '---'}
              </span>
            </div>
          </div>

          {/* Track & Size Info (Col 3): Bảng đấu & Thành viên */}
          <div className="lg:col-span-3 space-y-3 font-sans">
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-mono tracking-wider font-bold">BẢNG ĐẤU</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/60 px-3 py-1 rounded-full mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                {team?.trackId?.name || 'Chờ phân bảng'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-mono tracking-wider font-bold">THÀNH VIÊN</span>
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mt-1 font-mono">
                <Users size={14} className="text-slate-400" />
                <span>{members?.length || 0} Operators</span>
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Chat Section */}
      {team && team.eventId?.status === 'ongoing' && (
        <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-950 text-cyan-400 rounded-xl">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold">Hỗ trợ từ Mentor</h3>
              <p className="text-xs text-slate-400 font-sans">Bạn có câu hỏi hoặc cần sự giúp đỡ? Hãy nhắn tin trao đổi trực tiếp với Mentor hướng dẫn.</p>
            </div>
          </div>
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open_chat_room', { detail: { teamId: team._id } }));
            }}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-lg shadow-cyan-600/25 whitespace-nowrap cursor-pointer font-sans"
          >
            Nhắn tin ngay
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Topic Submission & Members info */}
        <div className="lg:col-span-1 space-y-8">

          {/* Exam & Materials from BTC */}
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-mono-tech">
              <BookOpen size={18} className="text-cyan-400" />
              <span className="text-cyan-400">[ĐỀ_BÀI_&_TÀI_LIỆU_THI]</span>
            </h2>
            {team?.trackId?.startTime && new Date(team.trackId.startTime) > currentTime ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-amber-500 font-sans font-semibold">
                  Đề bài sẽ được tự động mở sau:
                </p>
                <p className="text-sm font-bold text-cyan-400 font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-850 tracking-wider">
                  {getRemainingTimeText(team.trackId.startTime)}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Thời gian mở đề: {new Date(team.trackId.startTime).toLocaleString('vi-VN')}
                </p>
              </div>
            ) : team?.trackId?.attachments && team.trackId.attachments.length > 0 ? (
              <div className="space-y-3">
                {team.trackId.attachments.map((file: any, idx: number) => (
                  <a
                    key={idx}
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800 hover:border-cyan-500/50 transition-colors"
                  >
                    <BookOpen size={16} className="text-cyan-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-white truncate">{file.fileName || `Tài liệu đính kèm ${idx + 1}`}</p>
                      <p className="text-[9px] text-slate-500 font-sans">Bấm để mở link Google Drive lấy đề tài</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-2 text-center font-sans">
                Chưa có đề bài hoặc tài liệu thi nào được đính kèm cho bảng đấu của bạn.
              </p>
            )}
          </div>
          

          {/* Members Invite Confirmations Status */}
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-mono-tech">
              <Users size={18} className="text-cyan-400" />
              <span className="text-cyan-400">[THÀNH_VIÊN_NHÓM]</span>
            </h2>
            <div className="space-y-3.5">
              {members?.map((m: any) => (
                <div key={m._id} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <p className="font-bold text-slate-200">{m.userId?.fullName}</p>
                    <p className="text-[10px] text-slate-400">{m.userId?.email}</p>
                    {(m.userId?.studentId || m.userId?.university) && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {m.userId?.studentId && `MSSV: ${m.userId.studentId}`}
                        {m.userId?.studentId && m.userId?.university && ' • '}
                        {m.userId?.university}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {m.confirmStatus === 'confirmed' ? (
                      <span className="flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                        <CheckCircle size={10} /> Đã xác nhận
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold">
                        <Clock size={10} /> Đang chờ
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Side: GitHub Integration & AI Commit Reviews */}
        <div className="lg:col-span-2 space-y-8">
          
          {repository ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Commits List Column */}
              <div className="md:col-span-1 glass p-5 rounded-2xl space-y-4 border border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-mono-tech">
                  <Github size={16} className="text-cyan-400" />
                  <span className="text-cyan-400">[COMMITS_({commits.length})]</span>
                </h3>
                
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {commits.map((c: any) => (
                    <button
                      key={c._id}
                      onClick={() => handleSelectCommit(c)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedCommit?._id === c._id
                          ? 'bg-cyan-600/20 border-cyan-500 text-white'
                          : 'border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-bold truncate">{c.message}</p>
                      <div className="flex justify-between items-center mt-1.5 text-[9px] text-slate-400">
                        <span>@{c.authorGithubUsername || 'dev'}</span>
                        <span>{new Date(c.committedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </button>
                  ))}
                  {commits.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-6">Chưa crawl được commit nào. Nhấn đồng bộ phía trên.</p>
                  )}
                </div>
              </div>

              {/* Commit Details & Gemini AI Analysis */}
              <div className="md:col-span-2 glass p-6 rounded-2xl space-y-6">
                
                {selectedCommit ? (
                  <div className="space-y-6">
                    
                    {/* Commit Basic Detail */}
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-cyan-400 font-bold font-mono-tech">
                        <span>SHA: {selectedCommit.commitSha.substring(0, 8)}</span>
                        <span>{new Date(selectedCommit.committedAt).toLocaleString()}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{selectedCommit.message}</h4>
                      <p className="text-xs text-slate-400">Tác giả: <span className="text-slate-300 font-semibold">{selectedCommit.authorName} (@{selectedCommit.authorGithubUsername})</span></p>
                      <div className="flex gap-3 text-[10px] pt-1">
                        <span className="text-emerald-400">+{selectedCommit.additions} dòng</span>
                        <span className="text-rose-400">-{selectedCommit.deletions} dòng</span>
                        <span className="text-slate-400">{selectedCommit.changedFilesCount} tệp</span>
                      </div>
                    </div>


                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-16">
                    <FileDiff size={32} className="mx-auto text-slate-700 mb-2" />
                    <p className="text-xs">Chọn một commit ở cột trái để xem đánh giá AI chi tiết.</p>
                  </div>
                )}

              </div>

            </div>
          ) : (
            <div className="glass p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
              <Github size={48} className="text-slate-600 mb-3" />
              <p className="font-semibold text-lg">Chưa thiết lập GitHub Repository</p>
              <p className="text-sm text-slate-500 max-w-sm mt-1">Đường dẫn repository sẽ tự động được tạo và phân quyền sau khi tất cả các thành viên xác nhận tham gia nhóm qua link email.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
