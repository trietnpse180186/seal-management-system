import { useState } from "react";
import { FolderKanban, ChevronRight, BookOpen, Users } from "lucide-react";

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
  handleAssignRoleForTrack?: (email: string, trackId: string) => Promise<void>;
  handleRemoveRole?: (roleId: string) => Promise<void>;
}

export default function TracksTab({
  tracks,
  trackName,
  setTrackName,
  trackMax,
  setTrackMax,
  trackRoundId,
  setTrackRoundId,
  handleCreateTrack,
  selectedTrack,
  setSelectedTrack,
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

  const trackJudges = eventRoles.filter(
    (role: any) =>
      role.role === "judge" &&
      ((role.trackId?._id || role.trackId) === selectedTrack?._id)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Column 1: Tracks List & Form */}
      <div className="glass p-6 rounded-2xl flex flex-col justify-between">
        <div>
          <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
            <FolderKanban size={16} className="text-indigo-400" />
            <span>Các bảng đấu (Tracks)</span>
          </h3>
          <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto pr-1">
            {tracks.map((t: any) => (
              <button
                key={t._id}
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
                className={`w-full text-left p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${
                  selectedTrack?._id === t._id
                    ? "bg-indigo-600/10 border-indigo-500/50 text-white"
                    : "border-slate-800/80 bg-slate-900/10 hover:border-slate-700 text-slate-400"
                }`}
              >
                <div>
                  <span className="font-semibold block">
                    {t.name} (Tối đa {t.maxTeams} đội)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Vòng: {rounds.find((r) => r._id === t.roundId)?.name || "Chưa gán"}
                  </span>
                </div>
                <ChevronRight size={14} />
              </button>
            ))}
            {tracks.length === 0 && (
              <p className="text-xs text-slate-500 italic">
                Chưa có bảng đấu nào.
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={handleCreateTrack}
          className="space-y-3 pt-3 border-t border-slate-800/80"
        >
          <p className="text-[10px] font-bold text-slate-300 uppercase font-mono">
            Tạo thêm bảng đấu:
          </p>
          <select
            required
            value={trackRoundId}
            onChange={(e) => setTrackRoundId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-900 border border-slate-850 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">-- Chọn Vòng thi --</option>
            {rounds.map((r: any) => (
              <option key={r._id} value={r._id}>
                {r.name} (Vòng {r.order})
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            placeholder="Tên bảng đấu (e.g. AI & IoT)"
            value={trackName}
            onChange={(e) => setTrackName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200"
          />
          <input
            type="number"
            placeholder="Số lượng đội tối đa (e.g. 5)"
            value={trackMax}
            onChange={(e) => setTrackMax(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200"
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer font-mono"
          >
            + Thêm Bảng đấu
          </button>
        </form>
      </div>

      {/* Column 2: Attachments & Judges list stack */}
      <div className="space-y-6">
        {/* Exam Upload / Attachments */}
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-md font-bold text-white mb-4 flex items-center gap-1.5 font-mono">
            <BookOpen size={16} className="text-indigo-400" />
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg cursor-pointer font-mono"
            >
              Tải Lên Tài Liệu
            </button>
          </form>
        </div>

        {/* Judge Assignment Card */}
        {selectedTrack ? (
          <div className="glass p-6 rounded-2xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-1.5 font-mono border-b border-slate-800/80 pb-3">
              <Users size={16} className="text-indigo-400" />
              <span>Giám khảo Bảng đấu ({selectedTrack.name})</span>
            </h3>

            {/* List of judges */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {trackJudges.map((role: any) => (
                <div
                  key={role._id}
                  className="p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/60 text-xs flex justify-between items-center font-sans"
                >
                  <div>
                    <p className="font-bold text-slate-200">
                      {role.userId?.fullName || "Chưa rõ tên"}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {role.userId?.email}
                    </p>
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
              {trackJudges.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2 text-center font-sans">
                  Chưa có giám khảo nào được phân cho bảng này.
                </p>
              )}
            </div>

            {/* Form to add judge */}
            {handleAssignRoleForTrack && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!judgeEmail) return;
                  await handleAssignRoleForTrack(judgeEmail, selectedTrack._id);
                  setJudgeEmail("");
                }}
                className="space-y-2 pt-2 border-t border-slate-800/80"
              >
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Thêm Giám khảo bằng Email:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="giamkhao@domain.com"
                    value={judgeEmail}
                    onChange={(e) => setJudgeEmail(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer font-mono whitespace-nowrap"
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
            <p className="text-xs">Chọn một bảng đấu ở cột bên trái để quản lý Giám khảo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
