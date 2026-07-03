import { Users } from "lucide-react";
import CustomSelect from "../shared/CustomSelect";

interface TeamsTabProps {
  selectedEvent: any;
  teamsList: any[];
  tracks: any[];
  loading: boolean;
  handleDistributeTeams: () => Promise<void>;
  handleAssignTrack: (teamId: string, trackId: string) => Promise<void>;
}

export default function TeamsTab({
  teamsList,
  tracks,
  loading,
  handleDistributeTeams,
  handleAssignTrack,
}: TeamsTabProps) {
  return (
    <div className="glass p-6 rounded-2xl space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-md font-bold text-white flex items-center gap-1.5 font-mono">
            <Users size={18} className="text-cyan-400" />
            <span>Đội thi & Thí sinh ({teamsList.length} đội)</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            Danh sách các đội thi đã đăng ký và phân nhóm trong sự kiện này
          </p>
        </div>

        {/* Auto distribute button */}
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleDistributeTeams}
            disabled={
              loading ||
              tracks.length === 0 ||
              !teamsList.some(
                (t) => t.status === "confirmed" && !t.trackId,
              )
            }
            className={`text-xs font-bold px-4 py-2 rounded-xl text-white font-mono transition-all flex items-center gap-1.5 ${tracks.length > 0 &&
              teamsList.some(
                (t) => t.status === "confirmed" && !t.trackId,
              )
              ? "bg-cyan-500 hover:bg-cyan-500 cursor-pointer shadow-lg shadow-cyan-500/25"
              : "bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/50"
              }`}
          >
            Chia bảng ngẫu nhiên vào Track
          </button>
          {tracks.length === 0 && (
            <span className="text-[9px] text-rose-400 font-mono">
              * Cần tạo Bảng đấu (Track) trước
            </span>
          )}
          {tracks.length > 0 &&
            !teamsList.some(
              (t) => t.status === "confirmed" && !t.trackId,
            ) && (
              <span className="text-[9px] text-slate-500 font-mono">
                * Không có nhóm thi đấu chờ chia bảng
              </span>
            )}
        </div>
      </div>

      {/* Grouped lists */}
      <div className="space-y-6">
        {/* 1. Confirmed Teams */}
        <div>
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
            <span>
              ✓ Đội thi đã Xác nhận (
              {teamsList.filter((t) => t.status === "confirmed").length}
              )
            </span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamsList
              .filter((t) => t.status === "confirmed")
              .map((team: any) => (
                <div
                  key={team._id}
                  className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-cyan-400 font-mono">
                        ĐỘI
                      </span>
                      <h5 className="font-bold text-slate-200 text-sm">
                        {team.name}
                      </h5>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${team.trackId
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                    >
                      {team.trackId?.name ||
                        (team.trackId ? "Đã gán" : "Chưa chia bảng")}
                    </span>
                  </div>

                  {/* Leader & Repo Info */}
                  <div className="text-[11px] text-slate-400 space-y-1">
                    <p>
                      Trưởng nhóm:{" "}
                      <strong className="text-slate-300">
                        {team.leaderId?.fullName}
                      </strong>{" "}
                      ({team.leaderId?.email})
                    </p>
                    {team.mentorId && (
                      <p>
                        Mentor:{" "}
                        <strong className="text-emerald-400">
                          {team.mentorId?.fullName || team.mentorId}
                        </strong>{" "}
                        {team.mentorId?.email && `(${team.mentorId.email})`}
                      </p>
                    )}
                    {team.repository ? (
                      <p>
                        Repository:{" "}
                        <a
                          href={team.repository.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline"
                        >
                          {team.repository.repoName}
                        </a>
                      </p>
                    ) : (
                      <p className="text-slate-500 italic">
                        GitHub Repo: Chưa cấp phát (chờ chia bảng)
                      </p>
                    )}
                  </div>

                  {/* Members */}
                  <div className="border-t border-slate-800/80 pt-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Thành viên ({team.members?.length || 0}):
                    </p>
                    <div className="space-y-1">
                      {team.members?.map((m: any) => (
                        <div
                          key={m.userId?._id}
                          className="flex justify-between text-[10px] text-slate-400"
                        >
                          <span>
                            • {m.userId?.fullName}{" "}
                            {m.userId?.studentId && `(${m.userId.studentId}) `}
                            {m.userId?.university && `- ${m.userId.university} `}
                            {m.role === "leader" && (
                              <span className="text-[9px] text-cyan-400 font-mono font-bold">
                                (Trưởng nhóm)
                              </span>
                            )}
                          </span>
                          <span className="text-slate-500 font-mono">
                            {m.userId?.githubUsername ||
                              "Chưa liên kết Git"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Assign Track controls */}
                  <div className="border-t border-slate-800/80 pt-2 flex flex-col gap-1.5">
                    <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider font-mono">
                      Phân chia / Thay đổi bảng đấu:
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleAssignTrack(team._id, "random")
                        }
                        disabled={loading || tracks.length === 0}
                        className="flex-1 bg-cyan-500 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] text-white font-bold py-1.5 px-2 rounded-lg font-mono transition-all flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed border border-cyan-500/20"
                      >
                        Phân ngẫu nhiên
                      </button>

                      {tracks.length > 0 && (
                        <CustomSelect
                          value={team.trackId?._id || team.trackId || ""}
                          onChange={(val) => {
                            if (val) {
                              handleAssignTrack(team._id, val);
                            }
                          }}
                          disabled={loading}
                          options={tracks.map((track: any) => ({
                            value: track._id,
                            label: track.name,
                          }))}
                          placeholder="-- Chọn Bảng đấu --"
                          className="flex-1"
                        />
                      )}
                    </div>
                    {tracks.length === 0 && (
                      <p className="text-[8px] text-rose-400 font-mono italic">
                        * Cần tạo Bảng đấu (Track) trước
                      </p>
                    )}
                  </div>
                </div>
              ))}
            {teamsList.filter((t) => t.status === "confirmed")
              .length === 0 && (
                <p className="col-span-2 text-xs text-slate-500 italic text-center py-2">
                  Chưa có đội thi nào xác nhận hoàn tất.
                </p>
              )}
          </div>
        </div>

        {/* 2. Pending Teams */}
        <div>
          <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-3">
            Đội thi đang chờ xác nhận (
            {
              teamsList.filter((t) => t.status === "pending_confirm")
                .length
            }
            )
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamsList
              .filter((t) => t.status === "pending_confirm")
              .map((team: any) => (
                <div
                  key={team._id}
                  className="bg-slate-900/10 p-4 rounded-xl border border-slate-800/40 space-y-3 opacity-75"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 font-mono">
                        ĐỘI CHỜ DUYỆT
                      </span>
                      <h5 className="font-bold text-slate-400 text-sm">
                        {team.name}
                      </h5>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded font-mono font-bold">
                      Chờ duyệt
                    </span>
                  </div>

                  {/* Members with status */}
                  <div className="space-y-1">
                    {team.members?.map((m: any) => (
                      <div
                        key={m.userId?._id}
                        className="flex justify-between items-center text-[10px]"
                      >
                        <span className="text-slate-400">
                          • {m.userId?.fullName}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1 rounded ${m.confirmStatus === "confirmed"
                            ? "text-emerald-400 bg-emerald-500/5"
                            : "text-slate-500 bg-slate-800"
                            }`}
                        >
                          {m.confirmStatus === "confirmed"
                            ? "Đã nhận"
                            : "Chờ xác nhận"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {teamsList.filter((t) => t.status === "pending_confirm")
              .length === 0 && (
                <p className="col-span-2 text-xs text-slate-500 italic text-center py-2">
                  Không có nhóm nào ở trạng thái chờ xác nhận.
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
