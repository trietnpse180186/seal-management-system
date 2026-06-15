import { useState } from "react";
import { FolderKanban, ChevronRight, BookOpen, Users, Edit, Trash2 } from "lucide-react";
import { useConfirm } from "../shared/ConfirmDialog";
import CustomSelect from "../shared/CustomSelect";

interface TracksTabProps {
  selectedEvent: any;
  tracks: any[];
  trackName: string;
  setTrackName: (val: string) => void;
  trackDesc: string;
  setTrackDesc: (val: string) => void;
  trackMax: string;
  setTrackMax: (val: string) => void;
  trackRoundId: string;
  setTrackRoundId: (val: string) => void;
  handleCreateTrack: (e: React.FormEvent) => Promise<void>;
  selectedTrack: any;
  setSelectedTrack: (track: any) => void;
  editingTrack: any;
  setEditingTrack: (track: any) => void;
  handleUpdateTrack: (e: React.FormEvent) => Promise<void>;
  handleDeleteTrack: (trackId: string) => Promise<void>;
  rounds: any[];
  setSelectedRubricRoundId: (id: string) => void;
  setRubric: (rubric: any) => void;
  setCriteria: (criteria: any[]) => void;
  
  // Attachments Props
  attachmentName: string;
  setAttachmentName: (val: string) => void;
  attachmentUrl: string;
  setAttachmentUrl: (val: string) => void;
  handleUploadExam: (e: React.FormEvent) => Promise<void>;
  
  loading: boolean;
  
  // Event roles and judge assignment props
  eventRoles?: any[];
  handleAssignRoleForTrack?: (email: string, trackId: string, role?: "judge" | "mentor") => Promise<void>;
  handleRemoveRole?: (roleId: string) => Promise<void>;
}

export default function TracksTab({
  selectedEvent,
  tracks,
  trackName,
  setTrackName,
  setTrackDesc,
  trackMax,
  setTrackMax,
  trackRoundId,
  setTrackRoundId,
  handleCreateTrack,
  selectedTrack,
  setSelectedTrack,
  editingTrack,
  setEditingTrack,
  handleUpdateTrack,
  handleDeleteTrack,
  rounds,
  setSelectedRubricRoundId,
  setRubric,
  setCriteria,
  
  attachmentName,
  setAttachmentName,
  attachmentUrl,
  setAttachmentUrl,
  handleUploadExam,
  
  eventRoles = [],
  handleAssignRoleForTrack,
  handleRemoveRole,
}: TracksTabProps) {
  const [judgeEmail, setJudgeEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"judge" | "mentor">("judge");
  const confirm = useConfirm();

  const maxEventTeams = selectedEvent?.maxTeams || 0;
  const totalAllocatedTeams = tracks.reduce((sum, t) => sum + (t.maxTeams || 0), 0);
  const remainingTeams = maxEventTeams - totalAllocatedTeams;

  const trackMembers = eventRoles.filter(
    (role: any) =>
      (role.role === "judge" || role.role === "mentor") &&
      ((role.trackId?._id || role.trackId) === selectedTrack?._id)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Column 1: Tracks List & Form */}
      <div className="glass p-6 rounded-2xl flex flex-col justify-between">
        <div>
          <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
            <FolderKanban size={16} className="text-cyan-400" />
            <span>Các bảng đấu (Tracks)</span>
          </h3>
          <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto pr-1">
            {tracks.map((t: any) => (
              <div
                key={t._id}
                className={`w-full p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${
                  selectedTrack?._id === t._id
                    ? "bg-cyan-500/10 border-cyan-500/50 text-white"
                    : "border-slate-800/80 bg-slate-900/10 hover:border-slate-700 text-slate-400"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTrack(t);
                    // Auto select the round of this track
                    const roundOfTrack = rounds.find(
                      (r) => r._id === t.roundId,
                    );
                    if (roundOfTrack) {
                      setSelectedRubricRoundId(roundOfTrack._id);
                    } else {
                      setSelectedRubricRoundId("");
                      setRubric(null);
                      setCriteria([]);
                    }
                  }}
                  className="text-left flex-1"
                >
                  <span className="font-semibold block">
                    {t.name} (Tối đa {t.maxTeams} đội)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Vòng: {rounds.find((r) => r._id === t.roundId)?.name || "Chưa gán"}
                  </span>
                </button>
                <div className="flex items-center gap-2.5 ml-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTrack(t);
                      setTrackRoundId(t.roundId);
                      setTrackName(t.name);
                      setTrackMax(t.maxTeams.toString());
                      setTrackDesc(t.description || "");
                    }}
                    className="text-slate-400 hover:text-cyan-400 transition-colors p-1 cursor-pointer"
                    title="Chỉnh sửa bảng đấu"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const confirmed = await confirm({
                        title: "Xóa bảng đấu",
                        message: `Bạn có chắc chắn muốn xóa bảng đấu "${t.name}"?`,
                        variant: "danger",
                      });
                      if (confirmed) {
                        handleDeleteTrack(t._id);
                      }
                    }}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                    title="Xóa bảng đấu"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={14} className={selectedTrack?._id === t._id ? "text-cyan-400" : "text-slate-600"} />
                </div>
              </div>
            ))}
            {tracks.length === 0 && (
              <p className="text-xs text-slate-500 italic">
                Chưa có bảng đấu nào.
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={editingTrack ? handleUpdateTrack : handleCreateTrack}
          className="space-y-3.5 pt-3 border-t border-slate-800/80"
        >
          <p className="text-[10px] font-bold text-slate-300 uppercase font-mono">
            {editingTrack ? "Cập nhật bảng đấu:" : "Tạo thêm bảng đấu:"}
          </p>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
              Chọn Vòng thi
            </label>
            <CustomSelect
              value={trackRoundId}
              onChange={(val) => setTrackRoundId(val)}
              options={rounds.map((r: any) => ({
                value: r._id,
                label: `${r.name} (Vòng ${r.order})${r.status === 'completed' ? ' - Đã kết thúc' : ''}`,
                disabled: r.status === 'completed'
              }))}
              placeholder="-- Chọn Vòng thi --"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
              Tên bảng đấu
            </label>
            <input
              type="text"
              required
              placeholder="Tên bảng đấu (e.g. AI & IoT)"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
              Số lượng đội tối đa {maxEventTeams > 0 ? (editingTrack ? `(Còn lại: ${remainingTeams + (editingTrack.maxTeams || 0)} / ${maxEventTeams} đội)` : `(Còn lại: ${remainingTeams} / ${maxEventTeams} đội)`) : ""}
            </label>
            <input
              type="number"
              required
              placeholder="Số lượng đội tối đa (e.g. 5)"
              value={trackMax}
              onChange={(e) => setTrackMax(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer font-mono transition-colors"
            >
              {editingTrack ? "Lưu thay đổi" : "+ Thêm Bảng đấu"}
            </button>
            {editingTrack && (
              <button
                type="button"
                onClick={() => {
                  setEditingTrack(null);
                  setTrackRoundId("");
                  setTrackName("");
                  setTrackMax("");
                  setTrackDesc("");
                }}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer font-mono transition-all"
              >
                Hủy
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Column 2: Attachments & Judges list stack */}
      <div className="space-y-6">
        {/* Exam Upload / Attachments */}
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
            <BookOpen size={16} className="text-cyan-400" />
            <span>Đề bài & Tài liệu đính kèm</span>
          </h3>

          <form onSubmit={handleUploadExam} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Tên Tài liệu
              </label>
              <input
                type="text"
                required
                placeholder="E.g. Đề bài chung, Tài liệu API..."
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Đường dẫn / URL File
              </label>
              <input
                type="text"
                required
                placeholder="E.g. https://domain.com/exam.pdf"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200"
              />
            </div>

            <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl text-[10px] text-slate-400 font-sans">
              Tài liệu sẽ được hiển thị ở Bảng điều khiển của thí sinh thuộc bảng
              đấu đang chọn.
            </div>

            <button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-500 text-white text-xs font-bold py-2 rounded-lg cursor-pointer font-mono"
            >
              Tải Lên Tài Liệu
            </button>
          </form>
        </div>

        {/* Judge Assignment Card */}
        {selectedTrack ? (
          <div className="glass p-6 rounded-2xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-1.5 font-mono border-b border-slate-800/80 pb-3">
              <Users size={16} className="text-cyan-400" />
              <span>Ban chuyên môn ({selectedTrack.name})</span>
            </h3>

            {/* List of judges and mentors */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {trackMembers.map((role: any) => (
                <div
                  key={role._id}
                  className="p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/60 text-xs flex justify-between items-center font-sans"
                >
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-bold text-slate-200">
                        {role.userId?.fullName || "Chưa rõ tên"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {role.userId?.email}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${role.role === 'judge' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                      {role.role === 'judge' ? 'Giám khảo' : 'Mentor'}
                    </span>
                  </div>
                  {handleRemoveRole && (
                    <button
                      onClick={() => handleRemoveRole(role._id)}
                      className="text-rose-500 hover:text-rose-400 font-bold text-[9px] uppercase font-mono border border-rose-500/10 hover:border-rose-500/30 px-2 py-0.5 rounded bg-rose-500/5 cursor-pointer animate-all"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              ))}
              {trackMembers.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2 text-center font-sans">
                  Chưa có giám khảo hay mentor nào được phân cho bảng này.
                </p>
              )}
            </div>

            {/* Form to add member */}
            {handleAssignRoleForTrack && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!judgeEmail) return;
                  await handleAssignRoleForTrack(judgeEmail, selectedTrack._id, memberRole);
                  setJudgeEmail("");
                }}
                className="space-y-3 pt-3 border-t border-slate-800/80"
              >
                <div className="flex gap-4 items-center">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Phân quyền:
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
                    <input type="radio" name="memberRole" value="judge" checked={memberRole === "judge"} onChange={() => setMemberRole("judge")} className="accent-cyan-500" />
                    Giám khảo
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
                    <input type="radio" name="memberRole" value="mentor" checked={memberRole === "mentor"} onChange={() => setMemberRole("mentor")} className="accent-cyan-500" />
                    Mentor
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="email@domain.com"
                    value={judgeEmail}
                    onChange={(e) => setJudgeEmail(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="bg-cyan-500 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer font-mono whitespace-nowrap"
                  >
                    + Thêm
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="glass p-6 rounded-2xl text-center py-10 text-slate-500 font-mono border-dashed border-slate-800">
            <Users size={32} className="mx-auto mb-2 text-slate-600" />
            <p className="text-xs">Chọn một bảng đấu ở cột bên trái để quản lý Ban chuyên môn.</p>
          </div>
        )}
      </div>
    </div>
  );
}
