import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Users, FileText, CheckSquare, GitCommit, ListChecks, Download, Plus, Trash2, Edit } from "lucide-react";

export default function MentorTeamDetail() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [activeTab, setActiveTab] = useState("overview"); // overview, tasks, commits, rubric
  const [team, setTeam] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [rubrics, setRubrics] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);

  // Form states for Tasks
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assigneeId: "",
    status: "TODO"
  });

  useEffect(() => {
    if (!teamId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch team
        const teamRes = await axios.get(`http://localhost:5000/api/teams/${teamId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTeam(teamRes.data);

        // 2. Fetch tasks
        const tasksRes = await axios.get(`http://localhost:5000/api/tasks/team/${teamId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTasks(tasksRes.data);

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
        if (teamRes.data.trackId && teamRes.data.trackId.roundId) {
          try {
            const rubricRes = await axios.get(`http://localhost:5000/api/rubrics/round/${teamRes.data.trackId.roundId}`, {
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

  const handleSaveTask = async (e: any) => {
    e.preventDefault();
    try {
      if (editingTask) {
        const res = await axios.put(`http://localhost:5000/api/tasks/${editingTask._id}`, taskForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTasks(tasks.map(t => t._id === editingTask._id ? res.data : t));
      } else {
        const res = await axios.post(`http://localhost:5000/api/tasks`, { ...taskForm, teamId }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTasks([res.data, ...tasks]);
      }
      setShowTaskModal(false);
      setEditingTask(null);
      setTaskForm({ title: "", description: "", assigneeId: "", status: "TODO" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa nhiệm vụ này?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/tasks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(tasks.filter(t => t._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

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
          { id: "tasks", icon: CheckSquare, label: "Nhiệm vụ (Tasks)" },
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
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText className="text-cyan-400"/> Đề thi / Tài liệu tham khảo của Bảng</h3>
              {team.trackId?.attachments && team.trackId.attachments.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {team.trackId.attachments.map((file: any, idx: number) => (
                    <a 
                      key={idx} 
                      href={file.url} 
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-700 hover:border-cyan-500/50 transition-colors"
                    >
                      <Download size={18} className="text-cyan-400" />
                      <div>
                        <p className="text-sm font-bold text-white">{file.name || `Tài liệu đính kèm ${idx + 1}`}</p>
                        <p className="text-[10px] text-slate-500">Bấm để tải xuống/xem</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic bg-slate-900/30 p-4 rounded-xl">Bảng đấu này không có file đề thi nào được đính kèm.</p>
              )}
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckSquare className="text-emerald-400"/> Theo dõi tiến độ
              </h3>
              <button 
                onClick={() => {
                  setEditingTask(null);
                  setTaskForm({ title: "", description: "", assigneeId: "", status: "TODO" });
                  setShowTaskModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
              >
                <Plus size={14} /> Giao nhiệm vụ
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['TODO', 'IN_PROGRESS', 'DONE'].map(status => (
                <div key={status} className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                    {status === 'TODO' ? 'Cần làm' : status === 'IN_PROGRESS' ? 'Đang tiến hành' : 'Hoàn thành'}
                    <span className="ml-2 bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">
                      {tasks.filter(t => t.status === status).length}
                    </span>
                  </h4>
                  <div className="space-y-3">
                    {tasks.filter(t => t.status === status).map(task => (
                      <div key={task._id} className="bg-slate-800 p-3 rounded-lg shadow-sm border border-slate-700 hover:border-slate-500 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-bold text-sm text-white">{task.title}</p>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingTask(task); setTaskForm(task); setShowTaskModal(true); }} className="text-slate-400 hover:text-cyan-400"><Edit size={14} /></button>
                            <button onClick={() => handleDeleteTask(task._id)} className="text-slate-400 hover:text-rose-400"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{task.description}</p>
                        <div className="text-[10px] font-mono flex items-center gap-2">
                          <span className="bg-slate-900 px-2 py-1 rounded text-cyan-400">
                            {task.assigneeId ? task.assigneeId.fullName : "Chưa phân công"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
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

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingTask ? "Cập nhật Nhiệm vụ" : "Giao Nhiệm vụ mới"}
            </h3>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tên nhiệm vụ</label>
                <input 
                  required
                  type="text" 
                  value={taskForm.title} 
                  onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mô tả</label>
                <textarea 
                  rows={3}
                  value={taskForm.description} 
                  onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Người phụ trách</label>
                  <select 
                    value={taskForm.assigneeId} 
                    onChange={e => setTaskForm({...taskForm, assigneeId: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">-- Chưa phân công --</option>
                    {team.members?.map((m: any) => (
                      <option key={m.userId._id} value={m.userId._id}>{m.userId.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Trạng thái</label>
                  <select 
                    value={taskForm.status} 
                    onChange={e => setTaskForm({...taskForm, status: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="TODO">Cần làm</option>
                    <option value="IN_PROGRESS">Đang làm</option>
                    <option value="DONE">Hoàn thành</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-lg"
                >
                  {editingTask ? "Lưu thay đổi" : "Tạo nhiệm vụ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
