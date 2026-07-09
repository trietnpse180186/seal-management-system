import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Users, FileText, MessageSquare, GitCommit, ListChecks } from "lucide-react";

export default function MentorTeamDetail() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [activeTab, setActiveTab] = useState("overview"); // overview, chat, commits, rubric
  const [team, setTeam] = useState<any>(null);
  const [commits, setCommits] = useState<any[]>([]);
  const [rubrics, setRubrics] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const teamRes = await axios.get(`http://localhost:5000/api/teams/${teamId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = teamRes.data;
        setTeam({ ...payload.team, members: payload.members });

        // 3. Fetch commits
        try {
          const commitsRes = await axios.get(`http://localhost:5000/api/analytics/team/${teamId}/commits`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCommits(commitsRes.data);
        } catch (e) {
          console.error("No commits found");
        }

        // 4. Fetch rubric for this track's round
        if (payload.team?.trackId?.roundId) {
          const roundId = typeof payload.team.trackId.roundId === 'object'
            ? payload.team.trackId.roundId._id
            : payload.team.trackId.roundId;
          try {
            const rubricRes = await axios.get(`http://localhost:5000/api/rubrics/round/${roundId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            setRubrics(rubricRes.data);
          } catch(e) {
            console.error("No rubric found");
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId, token]);



  if (loading || !team) {
    return <div className="text-center py-20 text-slate-400">Đang tải dữ liệu đội thi...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/mentor/dashboard')}
          className="text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5 bg-slate-800/50 px-4 py-2 rounded-lg"
        >
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Quản lý Đội thi: {team.name}</h1>
          <p className="text-slate-400 text-xs font-mono mt-1">Bảng đấu: {team.trackId?.name || 'Không rõ'} | Sự kiện: {team.eventId?.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
        {[
          { id: "overview", icon: Users, label: "Tổng quan & Đề thi" },
          { id: "chat", icon: MessageSquare, label: "Chat" },
          { id: "commits", icon: GitCommit, label: "Lịch sử Code" },
          { id: "rubric", icon: ListChecks, label: "Tiêu chí chấm điểm" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === tab.id 
                ? "bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
                : "bg-slate-900/50 text-slate-400 hover:bg-slate-800"
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass p-6 rounded-2xl">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Users className="text-cyan-400"/> Thành viên trong đội</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {team.members?.map((m: any) => (
                  <div key={m._id} className="bg-slate-900/80 p-4 rounded-xl border border-slate-700">
                    <p className="font-bold text-white">{m.userId?.fullName}</p>
                    <p className="text-xs text-slate-400 font-mono mt-1">{m.userId?.email}</p>
                    {m.userId?._id === team.leaderId?._id && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded">Trưởng nhóm</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-8">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText className="text-cyan-400"/> Đề thi vòng thi</h3>
              {(team.trackId?.roundId?.hasExamMaterial || team.trackId?.examDriveFileId || team.trackId?.examDriveFileUrl) ? (
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 text-sm text-slate-400 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <p className="text-white font-bold">
                      {team.trackId?.examDriveFileName || team.trackId?.roundId?.driveFileName || team.trackId?.roundId?.name || `Đề thi ${team.trackId?.name || ''}`}
                    </p>
                    <p className="text-xs mt-2">
                      {team.trackId?.examDriveFileId ? "Đề thi cấp bảng đấu." : "Đề thi cấp vòng thi."}
                    </p>
                  </div>
                  {(team.trackId?.examDriveFileUrl || team.trackId?.roundId?.driveFileUrl) && (
                    <a
                      href={team.trackId?.examDriveFileUrl || team.trackId?.roundId?.driveFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-lg shadow-cyan-600/25 shrink-0 text-center"
                    >
                      Xem đề thi
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic bg-slate-900/30 p-4 rounded-xl">Chưa có đề cho vòng thi này.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          team.eventId?.status === 'ongoing' ? (
            <div className="py-12 text-center flex flex-col items-center justify-center max-w-md mx-auto animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center mb-4 animate-pulse">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Trò chuyện với Đội thi</h3>
              <p className="text-slate-400 text-xs mb-6">Mở khung hội thoại nổi để trực tiếp trao đổi và hỗ trợ đội thi {team.name} giải quyết các khó khăn trong quá trình làm bài.</p>
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open_chat_room', { detail: { teamId: team._id } }));
                }}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-lg shadow-cyan-600/25 cursor-pointer font-sans"
              >
                Mở hộp thoại chat
              </button>
            </div>
          ) : (
            <div className="py-16 text-center flex flex-col items-center justify-center max-w-md mx-auto animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mb-4">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-slate-400 font-bold text-lg mb-2">
                {team.eventId?.status === 'completed' || team.eventId?.status === 'cancelled'
                  ? 'Kênh chat đã đóng'
                  : 'Hộp thoại chat chưa khả dụng'}
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                {team.eventId?.status === 'completed' || team.eventId?.status === 'cancelled'
                  ? 'Cuộc thi đã kết thúc. Lịch sử chat chỉ còn hiển thị với Ban tổ chức (Coordinator).'
                  : 'Kênh chat sẽ được mở khi cuộc thi chính thức bước vào giai đoạn thi đấu.'}
              </p>
            </div>
          )
        )}

        {/* Commits Tab */}
        {activeTab === "commits" && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <GitCommit className="text-pink-400"/> Lịch sử Code (Commits)
            </h3>
            {commits.length === 0 ? (
              <p className="text-sm text-slate-500 italic text-center p-8 bg-slate-900/30 rounded-xl">Đội thi chưa có hoạt động code nào được ghi nhận.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {commits.map(c => (
                  <div key={c._id} className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl flex justify-between items-center gap-4">
                    <div>
                      <p className="font-bold text-sm text-white mb-1">{c.message}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        <span className="text-cyan-400 font-bold">@{c.authorGithubUsername || c.authorName}</span> 
                        <span className="mx-2">•</span> 
                        {new Date(c.committedAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                      <span className="text-emerald-400">+{c.additions}</span>
                      <span className="text-rose-400">-{c.deletions}</span>
                      <span className="bg-slate-800 px-2 py-1 rounded text-slate-300 ml-2">{c.commitSha?.slice(0,7)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rubric Tab */}
        {activeTab === "rubric" && (
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <ListChecks className="text-amber-400"/> Tiêu chí chấm điểm
            </h3>
            {rubrics ? (
              <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-700">
                <h4 className="font-bold text-amber-400 text-lg mb-2">{rubrics.name}</h4>
                <p className="text-slate-400 text-sm mb-6">{rubrics.description}</p>
                <div className="space-y-4">
                  {rubrics.criteria?.map((c: any, idx: number) => (
                    <div key={c._id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-white">{idx + 1}. {c.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{c.description}</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg text-center shrink-0 ml-4">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Trọng số</p>
                        <p className="text-lg font-black text-cyan-400 font-mono">{c.weight}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic text-center p-8 bg-slate-900/30 rounded-xl">Chưa có rubric nào được cấu hình cho vòng thi này.</p>
            )}
          </div>
        )}
      </div>


    </div>
  );
}
