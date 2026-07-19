import { useState, useEffect } from "react";
import axios from "axios";
import { Users, ExternalLink } from "lucide-react";
import CustomSelect from "../shared/CustomSelect";

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
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedEventId) {
      setTeams([]);
      setError("");
      return;
    }
    setError("");
    setLoading(true);
    axios
      .get(`http://localhost:5000/api/teams/all/${selectedEventId}?role=mentor`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res: any) => {
        // Only show confirmed teams
        setTeams(res.data.filter((t: any) => t.status === "confirmed"));
      })
      .catch((err: any) => {
        console.error(err);
        const errMsg = err.response?.data?.message || "Đã xảy ra lỗi khi tải danh sách đội hướng dẫn.";
        setError(errMsg);
      })
      .finally(() => setLoading(false));
  }, [selectedEventId, token]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
          Mentor Dashboard
        </h1>
        <p className="text-slate-500 mt-2 text-sm">
          Chào mừng <strong className="text-slate-800">{user?.fullName}</strong>. Dưới đây là danh sách các đội thi mà bạn được phân công hướng dẫn.
        </p>
      </div>

      {mentorRoles.length === 0 ? (
        <div className="bg-white border border-slate-200 p-8 text-center rounded-2xl shadow-sm">
          <p className="text-slate-500 text-sm">Bạn chưa được phân công làm Mentor cho bất kỳ sự kiện nào.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {uniqueEvents.length > 1 && (
            <div className="bg-white border border-slate-200 p-4 flex items-center gap-4 rounded-2xl max-w-md shadow-sm">
              <label className="text-xs font-bold uppercase text-slate-500 whitespace-nowrap">Chọn sự kiện:</label>
              <CustomSelect 
                options={uniqueEvents}
                value={selectedEventId}
                onChange={setSelectedEventId}
                className="flex-1"
              />
            </div>
          )}

          <div className="bg-white border border-slate-200 p-6 rounded-2xl border-t-4 border-t-[#F27024] shadow-sm">
            <div className="flex items-center gap-2.5 mb-6">
              <Users className="text-[#F27024]" size={20} />
              <h2 className="text-lg font-bold text-slate-800">
                Danh sách đội thi thuộc quyền hướng dẫn
              </h2>
            </div>
            
            {loading ? (
              <p className="text-slate-500 text-sm animate-pulse">Đang tải danh sách đội thi...</p>
            ) : error ? (
              <div className="text-center py-10 text-rose-600 font-semibold text-sm">
                {error}
              </div>
            ) : teams.length === 0 ? (
              <p className="text-slate-500 text-sm italic border border-dashed border-slate-200 p-8 text-center rounded-xl">Không có đội thi nào trong bảng đấu của bạn hoặc bảng đấu chưa được phân đội.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map((team) => (
                  <div key={team._id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#F27024]/50 transition-all shadow-sm hover:shadow-md flex flex-col h-full">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-800 mb-1">{team.name}</h3>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200">
                          Bảng: {team.trackId?.name || "Chưa rõ"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 flex-1">
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {team.topicSubmission?.description || "Chưa nộp mô tả đề tài."}
                      </p>
                    </div>
                    
                    <div className="space-y-1.5 mb-4 border-t border-slate-100 pt-3">
                      <p className="text-xs font-bold uppercase text-slate-400 mb-2">Thành viên ({team.members?.length || 0})</p>
                      {team.members?.map((m: any) => (
                        <div key={m._id} className="text-sm flex items-center justify-between mt-1">
                          <span className="text-slate-700 flex items-center gap-1.5">
                            {m.userId?.fullName} {m.userId?._id === team.leaderId?._id && <span className="text-[#F27024] font-semibold text-xs">(Trưởng nhóm)</span>}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-100">
                      <a 
                        href={`/mentor/team/${team._id}`}
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-[#F27024] hover:bg-[#d95f1f] text-white font-bold rounded-xl text-sm transition-all"
                      >
                        <Users size={16} /> Quản lý tiến độ & Theo dõi
                      </a>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {team.repository ? (
                          <a 
                            href={team.repository.repoUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                          >
                            Repository
                          </a>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-50 text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs cursor-not-allowed">
                            Chưa có Repo
                          </div>
                        )}
                        
                        {team.topicSubmission?.documentationLink ? (
                          <a 
                            href={team.topicSubmission.documentationLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 w-full py-2 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-semibold transition-colors"
                          >
                            <ExternalLink size={14} /> Tài liệu
                          </a>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-50 text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs cursor-not-allowed">
                            Chưa có tài liệu
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
