import { useState, useEffect } from "react";
import axios from "axios";
import { Users, ExternalLink } from "lucide-react";
import CustomSelect from "../components/CustomSelect";

export default function MentorDashboard({ user, roles }: any) {
  const token = localStorage.getItem("token");
  
  const mentorRoles = roles.filter((r: any) => r.role === "mentor");
  const uniqueEvents = Array.from(new Set(mentorRoles.map((r: any) => r.eventId)))
    .filter(id => id !== null && id !== undefined)
    .map(id => {
      const r = mentorRoles.find((role: any) => role.eventId === id);
      return { value: String(id), label: r ? r.eventName : "Event" };
    });

  const [selectedEventId, setSelectedEventId] = useState(uniqueEvents.length > 0 ? String(uniqueEvents[0].value) : "");
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedEventId) return;
    setLoading(true);
    axios
      .get(`http://localhost:5000/api/teams/all/${selectedEventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res: any) => {
        // Only show confirmed teams
        setTeams(res.data.filter((t: any) => t.status === "confirmed"));
      })
      .catch((err: any) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedEventId, token]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
          Mentor Dashboard
        </h1>
        <p className="text-slate-400 mt-2 text-sm">
          Chào mừng <strong className="text-white">{user?.fullName}</strong>. Dưới đây là danh sách các đội thi mà bạn được phân công hướng dẫn.
        </p>
      </div>

      {mentorRoles.length === 0 ? (
        <div className="glass p-8 text-center rounded-2xl">
          <p className="text-slate-400">Bạn chưa được phân công làm Mentor cho bất kỳ sự kiện nào.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {uniqueEvents.length > 1 && (
            <div className="glass p-4 flex items-center gap-4 rounded-xl max-w-md">
              <label className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">Chọn sự kiện:</label>
              <CustomSelect 
                options={uniqueEvents}
                value={selectedEventId}
                onChange={setSelectedEventId}
                className="flex-1"
              />
            </div>
          )}

          <div className="glass p-6 rounded-2xl border-t-4 border-t-emerald-500">
            <div className="flex items-center gap-2 mb-6">
              <Users className="text-emerald-400" />
              <h2 className="text-lg font-bold text-white font-mono">
                Danh sách đội thi thuộc quyền hướng dẫn
              </h2>
            </div>
            
            {loading ? (
              <p className="text-slate-400 text-sm animate-pulse">Đang tải danh sách...</p>
            ) : teams.length === 0 ? (
              <p className="text-slate-500 text-sm italic border border-dashed border-slate-700 p-8 text-center rounded-xl">Không có đội thi nào trong bảng đấu của bạn hoặc bảng đấu chưa được phân đội.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map((team) => (
                  <div key={team._id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-emerald-500/50 transition-all shadow-lg hover:shadow-emerald-500/10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-bold text-white mb-1">{team.name}</h3>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded-full font-mono border border-slate-700">
                          Bảng: {team.trackId?.name || "Chưa rõ"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 flex-1">
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {team.topicSubmission?.description || "Chưa nộp mô tả đề tài."}
                      </p>
                    </div>
                    
                    <div className="space-y-1.5 mb-4 border-t border-slate-800 pt-3">
                      <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Thành viên ({team.members?.length || 0})</p>
                      {team.members?.map((m: any) => (
                        <div key={m._id} className="text-xs flex items-center justify-between">
                          <span className="text-slate-300 flex items-center gap-1.5">
                            {m.userId?.fullName} {m.userId?._id === team.leaderId?._id && <span className="text-emerald-400 text-[10px]">(Trưởng nhóm)</span>}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-800">
                      <a 
                        href={`/mentor/team/${team._id}`}
                        className="flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider rounded-lg text-xs transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      >
                        <Users size={14} /> Quản lý Tiến độ & Theo dõi
                      </a>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {team.repository ? (
                          <a 
                            href={team.repository.repoUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs transition-colors"
                          >
                            Repository
                          </a>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-800/50 text-slate-500 rounded-lg text-xs cursor-not-allowed">
                            Chưa có Repo
                          </div>
                        )}
                        
                        {team.topicSubmission?.documentationLink ? (
                          <a 
                            href={team.topicSubmission.documentationLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 w-full py-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg text-xs transition-colors"
                          >
                            <ExternalLink size={14} /> Tài liệu
                          </a>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-800/50 text-slate-500 rounded-lg text-xs cursor-not-allowed">
                            Chưa có TL
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
