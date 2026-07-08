import { useState, useEffect } from "react";
import {
  Play,
  Lock,
  Unlock,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  HelpCircle
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useConfirm } from "../shared/ConfirmDialog";

interface OperationsTabProps {
  selectedEvent: any;
  rounds: any[];
  tracks: any[];
  teamsList: any[];
  handleAdvanceRound: (roundId: string) => Promise<void>;
  handleLockRound: (roundId: string) => Promise<void>;
  handleUnlockRound: (roundId: string) => Promise<void>;
  handleSyncAllRepos: () => Promise<void>;
  handleUpdateRound: (roundId: string, updatedData: any) => Promise<void>;
  fetchEventDetails: () => Promise<void>;
  readOnly?: boolean;
}

export default function OperationsTab({
  selectedEvent,
  rounds,
  tracks: _tracks,
  teamsList,
  handleAdvanceRound,
  handleLockRound,
  handleUnlockRound,
  handleSyncAllRepos,
  handleUpdateRound,
  fetchEventDetails,
  readOnly = false
}: OperationsTabProps) {
  const confirm = useConfirm();
  const [updatingEvent, setUpdatingEvent] = useState(false);
  const [updatingRoundMap, setUpdatingRoundMap] = useState<{ [roundId: string]: boolean }>({});
  const [selectedRoundId, setSelectedRoundId] = useState<string>(() => {
    if (rounds && rounds.length > 0) {
      // Default to the first active/pending round
      const active = rounds.find(r => r.status === "active" || r.status === "pending");
      return active ? active._id : rounds[0]._id;
    }
    return "";
  });

  useEffect(() => {
    if (rounds && rounds.length > 0) {
      const hasSelected = rounds.some(r => r._id === selectedRoundId);
      if (!hasSelected) {
        const active = rounds.find(r => r.status === "active" || r.status === "pending");
        setSelectedRoundId(active ? active._id : rounds[0]._id);
      }
    } else {
      setSelectedRoundId("");
    }
  }, [rounds, selectedRoundId]);

  const token = localStorage.getItem("token");

  // Get current selected round object
  const selectedRound = rounds.find(r => r._id === selectedRoundId);

  // Helper to update event status
  const updateEventStatus = async (newStatus: string) => {
    if (!selectedEvent) return;
    const confirmMsg = `Bạn có chắc chắn muốn chuyển trạng thái cuộc thi sang "${newStatus === "registration" ? "Mở Đăng Ký" :
      newStatus === "prepare" ? "Đóng Đăng Ký (Chuẩn Bị)" :
        newStatus === "ongoing" ? "Đang Diễn Ra" :
          newStatus === "completed" ? "Đã Hoàn Thành" : newStatus
      }"?`;

    const isConfirmed = await confirm({
      title: "Chuyển trạng thái cuộc thi",
      message: confirmMsg,
    });
    if (!isConfirmed) return;

    setUpdatingEvent(true);
    try {
      await axios.put(
        `http://localhost:5000/api/events/${selectedEvent._id}`,
        { status: newStatus, isForceOverride: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Cập nhật trạng thái cuộc thi thành công!");
      await fetchEventDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật trạng thái cuộc thi.");
    } finally {
      setUpdatingEvent(false);
    }
  };

  // Toggle Manual Exam Open
  const handleToggleManualExam = async (round: any) => {
    if (!round) return;
    const newManualStatus = !round.isExamManualOpen;
    setUpdatingRoundMap(prev => ({ ...prev, [round._id]: true }));
    try {
      await handleUpdateRound(round._id, { isExamManualOpen: newManualStatus });
      toast.success(newManualStatus ? "Đã mở khóa đề bài thủ công thành công!" : "Đã khóa đề bài thủ công!");
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingRoundMap(prev => ({ ...prev, [round._id]: false }));
    }
  };



  return (
    <div className="space-y-8 max-w-5xl mx-auto">

      {/* Grid Steps */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">

        {/* Left Side (Steps 1 & 2) */}
        <div className="md:col-span-5 flex flex-col gap-8">

          {/* STEP 1: Registration Control */}
          <div className="glass p-5 rounded-2xl border border-slate-800 space-y-4 relative overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <div className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-mono text-[10px] font-bold border border-cyan-800">
                1
              </div>
              <h3 className="text-sm font-bold text-white font-mono uppercase">Điều Phối Đăng Ký</h3>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <p className="text-slate-400 leading-relaxed">
                Mở hoặc đóng cổng đăng ký để cho phép thí sinh tạo tài khoản, thành lập đội và đăng ký các bảng đấu phù hợp.
              </p>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-900 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Cổng đăng ký:</span>
                  {selectedEvent?.status === "registration" ? (
                    <span className="text-emerald-400 font-bold font-mono">ĐANG MỞ</span>
                  ) : (
                    <span className="text-slate-500 font-bold font-mono">ĐANG ĐÓNG</span>
                  )}
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Số đội thi hiện tại:</span>
                  <span className="text-cyan-400 font-mono font-bold">{teamsList?.length || 0} đội</span>
                </div>
              </div>

              {!readOnly && (
                <div className="pt-2 flex flex-col gap-2">
                  {selectedEvent?.status === "draft" && (
                    <button
                      onClick={() => updateEventStatus("registration")}
                      disabled={updatingEvent}
                      className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/10"
                    >
                      <Play size={14} />
                      MỞ CỔNG ĐĂNG KÝ
                    </button>
                  )}
                  {selectedEvent?.status === "registration" && (
                    <button
                      onClick={() => updateEventStatus("prepare")}
                      disabled={updatingEvent}
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-600/10"
                    >
                      <Lock size={14} />
                      ĐÓNG ĐĂNG KÝ
                    </button>
                  )}
                  {selectedEvent?.status === "prepare" && (
                    <button
                      onClick={() => updateEventStatus("ongoing")}
                      disabled={updatingEvent}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/10"
                    >
                      <Play size={14} />
                      BẮT ĐẦU CUỘC THI
                    </button>
                  )}
                  {selectedEvent?.status !== "draft" && selectedEvent?.status !== "registration" && selectedEvent?.status !== "prepare" && (
                    <div className="text-center py-2 text-slate-500 italic">
                      Cổng đăng ký đã đóng và sự kiện đang hoạt động.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: Codebase Sync */}
          <div className="glass p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <div className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-mono text-[10px] font-bold border border-cyan-800">
                2
              </div>
              <h3 className="text-sm font-bold text-white font-mono uppercase">Đồng bộ phân tích AI</h3>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <p className="text-slate-400 leading-relaxed">
                Đồng bộ phân tích AI từ GitHub Repository của các đội thi.
              </p>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-900 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Đã đồng bộ:</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {teamsList?.filter(t => t.repository).length || 0} / {teamsList?.length || 0}
                  </span>
                </div>
              </div>

              {!readOnly && (
                <div className="pt-2">
                  <button
                    onClick={handleSyncAllRepos}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 font-mono text-xs font-bold border border-slate-700 hover:border-cyan-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={14} />
                    ĐỒNG BỘ PHÂN TÍCH TỪ AI
                  </button>
                </div>
              )}

              <div className="bg-slate-950/30 p-3.5 rounded-xl border border-slate-900 text-[11px] text-slate-400 flex gap-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-slate-350">Cảnh báo tràn request:</strong> Hạn chế kích hoạt liên tục trong thời gian ngắn để tránh vượt giới hạn API (rate limit) từ OpenAI hoặc GitHub.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side (STEP 3: Round Operations) */}
        <div className="md:col-span-7 flex flex-col">

          {/* STEP 3: Round Management */}
          <div className="glass p-6 rounded-2xl border border-slate-800 space-y-6 relative overflow-hidden flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-mono text-[10px] font-bold border border-cyan-800">
                  3
                </div>
                <h3 className="text-sm font-bold text-white font-mono uppercase">Vận Hành Vòng Thi &amp; Mở Đề</h3>
              </div>

              {/* Round Selector */}
              {rounds && rounds.length > 0 && (
                <select
                  value={selectedRoundId}
                  onChange={(e) => setSelectedRoundId(e.target.value)}
                  className="bg-slate-900 border border-slate-850 text-slate-200 text-xs font-mono px-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {rounds.map(r => (
                    <option key={r._id} value={r._id}>
                      Vòng: {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedRound ? (
              <div className="space-y-6 font-sans">

                {/* Selected Round Info Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-900 space-y-1.5">
                    <span className="text-[9px] text-slate-550 font-bold block uppercase tracking-wider">Trạng thái Vòng:</span>
                    <span className={`text-xs font-mono font-bold uppercase ${selectedRound.status === "active" ? "text-emerald-400 animate-pulse" :
                      selectedRound.status === "scoring" ? "text-amber-400" :
                        selectedRound.status === "completed" ? "text-slate-450" : "text-slate-400"
                      }`}>
                      {selectedRound.status === "pending" && "Chưa bắt đầu"}
                      {selectedRound.status === "active" && "Đang diễn ra (Active)"}
                      {selectedRound.status === "scoring" && "Đang chấm điểm (Scoring)"}
                      {selectedRound.status === "completed" && "Đã kết thúc"}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-900 space-y-1.5">
                    <span className="text-[9px] text-slate-550 font-bold block uppercase tracking-wider">Mở Đề Bài Thủ Công:</span>
                    {selectedRound.isExamManualOpen ? (
                      <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                        <Unlock size={12} /> ĐANG MỞ
                      </span>
                    ) : (
                      <span className="text-slate-450 font-bold text-xs flex items-center gap-1">
                        <Lock size={12} /> THEO LỊCH
                      </span>
                    )}
                  </div>

                  <div className="col-span-2 bg-slate-950/40 p-4 rounded-xl border border-slate-900 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-mono">Bắt đầu:</span>
                      <span className="text-slate-350">{selectedRound.startTime ? new Date(selectedRound.startTime).toLocaleString('vi-VN') : 'Chưa cấu hình'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-mono">Hạn nộp bài:</span>
                      <span className="text-slate-350">{selectedRound.endTime ? new Date(selectedRound.endTime).toLocaleString('vi-VN') : 'Chưa cấu hình'}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-850/60 pt-2">
                      <span className="text-slate-500 font-mono">Tài liệu đề bài:</span>
                      <span className="text-slate-350 truncate max-w-[200px]" title={selectedRound.driveFileName}>
                        {selectedRound.driveFileName || 'Chưa gắn tệp đề'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Operations Buttons Workflow */}
                <div className="space-y-4">
                  <span className="text-[10px] text-slate-550 font-bold block uppercase tracking-wider border-b border-slate-850 pb-2">
                    CÁC THAO TÁC ĐIỀU HÀNH VÒNG THI
                  </span>

                  {!readOnly ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">

                      {/* Button: Manual Exam Toggle */}
                      <button
                        onClick={() => handleToggleManualExam(selectedRound)}
                        disabled={updatingRoundMap[selectedRound._id]}
                        className={`py-3 px-1.5 text-[10px] lg:text-xs font-mono font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${selectedRound.isExamManualOpen
                          ? "bg-slate-900 border-slate-850 text-amber-500 hover:text-amber-450 hover:border-amber-500/20"
                          : "bg-emerald-950/20 border-emerald-900/40 text-emerald-400 hover:text-emerald-350 hover:bg-emerald-900/10 hover:border-emerald-500/30"
                          }`}
                      >
                        {selectedRound.isExamManualOpen ? (
                          <>
                            <Lock size={12} />
                            ĐÓNG ĐỀ BÀI
                          </>
                        ) : (
                          <>
                            <Unlock size={12} />
                            MỞ ĐỀ THỦ CÔNG
                          </>
                        )}
                      </button>

                      {/* Button: Lock/Unlock Round */}
                      {selectedRound.status === 'completed' ? (
                        <button
                          onClick={async () => {
                            const isConfirmed = await confirm({
                              title: `Mở khóa Vòng thi: ${selectedRound.name}`,
                              message: `Bạn có chắc chắn muốn mở khóa vòng thi này? Kết quả xếp hạng hiện tại sẽ bị thu hồi, trạng thái vòng thi được đổi về "active" và giám khảo có thể tiếp tục chỉnh sửa điểm.`,
                            });
                            if (isConfirmed) {
                              setUpdatingRoundMap(prev => ({ ...prev, [selectedRound._id]: true }));
                              try {
                                await handleUnlockRound(selectedRound._id);
                                toast.success(`Đã mở khóa Vòng thi "${selectedRound.name}" thành công!`);
                              } catch (err: any) {
                                console.error(err);
                                toast.error(err.response?.data?.message || `Lỗi khi mở khóa vòng thi.`);
                              } finally {
                                setUpdatingRoundMap(prev => ({ ...prev, [selectedRound._id]: false }));
                              }
                            }
                          }}
                          disabled={updatingRoundMap[selectedRound._id]}
                          className="py-3 px-1.5 text-[10px] lg:text-xs font-mono font-bold bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 hover:bg-emerald-900/10 hover:border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Unlock size={12} />
                          MỞ KHÓA ĐIỂM
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            const isConfirmed = await confirm({
                              title: `Khóa và kết thúc Vòng thi: ${selectedRound.name}`,
                              message: `Bạn có chắc chắn muốn khóa và kết thúc vòng thi này? Trạng thái vòng thi sẽ được chuyển sang "completed", tính toán kết quả xếp hạng và học sinh sẽ không thể sửa điểm hay nộp thêm bài mới.`,
                            });
                            if (isConfirmed) {
                              setUpdatingRoundMap(prev => ({ ...prev, [selectedRound._id]: true }));
                              try {
                                await handleLockRound(selectedRound._id);
                                toast.success(`Đã khóa và kết thúc Vòng thi "${selectedRound.name}" thành công!`);
                              } catch (err: any) {
                                console.error(err);
                                toast.error(err.response?.data?.message || `Lỗi khi khóa vòng thi.`);
                              } finally {
                                setUpdatingRoundMap(prev => ({ ...prev, [selectedRound._id]: false }));
                              }
                            }
                          }}
                          disabled={updatingRoundMap[selectedRound._id]}
                          className="py-3 px-1.5 text-[10px] lg:text-xs font-mono font-bold bg-amber-950/20 border border-amber-900/40 text-amber-400 hover:bg-amber-900/10 hover:border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Lock size={12} />
                          KHÓA ĐIỂM VÀ XẾP HẠNG
                        </button>
                      )}

                      {/* Button: Advance teams */}
                      <button
                        onClick={async () => {
                          const isConfirmed = await confirm({
                            title: `Tiến cử đội đi tiếp từ Vòng thi: ${selectedRound.name}`,
                            message: `Bạn có chắc chắn muốn tiến cử Top ${selectedRound.advanceTopN || 3} đội xuất sắc nhất sang vòng tiếp theo? Hệ thống sẽ tự động chuyển các đội thăng hạng vào bảng đấu của vòng thi kế tiếp.`,
                          });
                          if (isConfirmed) {
                            setUpdatingRoundMap(prev => ({ ...prev, [selectedRound._id]: true }));
                            try {
                              await handleAdvanceRound(selectedRound._id);
                              toast.success(`Đã tiến cử các đội đi tiếp từ Vòng "${selectedRound.name}" thành công!`);
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setUpdatingRoundMap(prev => ({ ...prev, [selectedRound._id]: false }));
                            }
                          }
                        }}
                        disabled={updatingRoundMap[selectedRound._id]}
                        className="py-3 px-1.5 text-[10px] lg:text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-600/15 whitespace-nowrap"
                      >
                        BẮT ĐẦU VÒNG KẾ TIẾP
                      </button>

                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-500 italic text-xs">
                      Tài khoản của bạn chỉ có quyền xem, không thể thực hiện các thao tác điều hành vòng thi.
                    </div>
                  )}

                  {/* Operational Notes and Warnings */}
                  <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-900 text-[11px] text-slate-400 space-y-2">
                    <div className="flex gap-2">
                      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      <p>
                        <strong className="text-slate-350">Lưu ý mở đề:</strong> Mở đề bài thủ công sẽ làm tệp đề và tài liệu hướng dẫn xuất hiện ngay lập tức trong Khu vực Đội thi của tất cả các học sinh mà không cần đợi thời gian bắt đầu của Vòng đấu.
                      </p>
                    </div>
                    <div className="flex gap-2 border-t border-slate-900 pt-2">
                      <HelpCircle size={14} className="text-cyan-500 shrink-0" />
                      <p>
                        <strong className="text-slate-350">Tiến trình chuẩn:</strong> Mở cổng đăng ký → Đóng cổng → Đồng bộ phân tích AI (nếu cần thiết) → Mở đề → Khóa điểm & xếp hạng → Bắt đầu vòng kế tiếp.
                      </p>
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div className="text-center py-12 text-slate-550 italic font-mono text-xs">
                Không tìm thấy vòng thi nào được thiết lập cho cuộc thi hiện tại.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* STEP 4: End Event */}
      {selectedEvent?.status === "ongoing" && !readOnly && (
        <div className="glass p-5 rounded-2xl border border-slate-800 space-y-4 relative overflow-hidden bg-rose-950/5 border-rose-950/30 shadow-[inset_0_0_15px_rgba(244,63,94,0.01)] animate-pulse w-full mt-8">
          <div className="flex items-center gap-2 border-b border-rose-900/30 pb-3">
            <div className="w-5 h-5 rounded-full bg-rose-950 text-rose-400 flex items-center justify-center font-mono text-[10px] font-bold border border-rose-800">
              4
            </div>
            <h3 className="text-sm font-bold text-rose-400 font-mono uppercase">Kết Thúc Cuộc Thi</h3>
          </div>

          <div className="space-y-3 font-sans text-xs">
            <p className="text-slate-400 leading-relaxed">
              Kết thúc cuộc thi hackathon. Tất cả các vòng thi sẽ dừng lại, dừng crawl commit, và khóa bảng điểm xếp hạng.
            </p>

            <button
              onClick={() => updateEventStatus("completed")}
              disabled={updatingEvent}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/10"
            >
              <ShieldAlert size={14} />
              KẾT THÚC HACKATHON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
