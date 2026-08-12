import { useState, useEffect } from "react";
import axios from "axios";
import {
  Users,
  RefreshCw,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  FileText,
  X
} from "lucide-react";
import CustomSelect from "../shared/CustomSelect";

interface TeamsTabProps {
  selectedEvent: any;
  teamsList: any[];
  tracks: any[];
  rounds?: any[];
  loading: boolean;
  handleDistributeTeams: () => Promise<void>;
  handleAssignTrack: (teamId: string, trackId: string) => Promise<void>;
  handleSyncRepo: (repoId: string) => Promise<void>;
  syncingRepoId: string | null;
  readOnly?: boolean;
  onRefreshTeams?: () => Promise<void> | void;
}

export default function TeamsTab({
  selectedEvent,
  teamsList,
  tracks,
  rounds = [],
  loading,
  handleDistributeTeams,
  handleAssignTrack,
  handleSyncRepo,
  syncingRepoId,
  readOnly = false,
  onRefreshTeams,
}: TeamsTabProps) {
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    teamIds?: string[];
    memberCount?: number;
    errors?: string[];
  } | null>(null);

  // 2-Step Confirmation Email State
  // 0: Initial / No recent import
  // 1: Imported -> Show "Đã xác nhận danh sách import"
  // 2: Confirmed -> Button changes to "Gửi email mời (N thành viên)"
  const [emailStep, setEmailStep] = useState<0 | 1 | 2>(0);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailResult, setEmailResult] = useState<{
    sent: number;
    failed: number;
    total: number;
    message: string;
  } | null>(null);

  // Helper to persist flow state to localStorage
  const persistFlowState = (
    newImportResult: typeof importResult,
    newEmailStep: 0 | 1 | 2,
    newEmailResult: typeof emailResult
  ) => {
    if (!selectedEvent?._id) return;
    const key = `seal_import_flow_${selectedEvent._id}`;
    try {
      if (!newImportResult && newEmailStep === 0 && !newEmailResult) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(
          key,
          JSON.stringify({
            importResult: newImportResult,
            emailStep: newEmailStep,
            emailResult: newEmailResult,
            updatedAt: Date.now(),
          })
        );
      }
    } catch (e) {
      console.warn("Failed to save import flow state:", e);
    }
  };

  // Load saved state on mount or when selectedEvent changes
  useEffect(() => {
    if (!selectedEvent?._id) return;
    const key = `seal_import_flow_${selectedEvent._id}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && (saved.emailStep === 1 || saved.emailStep === 2 || saved.importResult || saved.emailResult)) {
          setImportResult(saved.importResult || null);
          setEmailStep(saved.emailStep || 0);
          setEmailResult(saved.emailResult || null);
        }
      }
    } catch (e) {
      console.warn("Failed to parse saved import flow state:", e);
    }
  }, [selectedEvent?._id]);

  const handleClearFlowState = () => {
    setImportResult(null);
    setEmailStep(0);
    setEmailResult(null);
    persistFlowState(null, 0, null);
  };

  const handleExportTeams = async () => {
    if (!selectedEvent?._id) return;
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `http://localhost:5000/api/events/${selectedEvent._id}/export-teams`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const safeName = selectedEvent.name.replace(/\s+/g, "_");
      link.setAttribute("download", `Teams_${safeName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export teams error:", err);
      alert("Lỗi khi xuất danh sách đội thi ra file Excel. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const token = localStorage.getItem("token");
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${apiBase}/api/teams/import-template?type=admin`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Template_Import_Teams_Admin.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download template error:", err);
      alert("Lỗi khi tải file template mẫu. Vui lòng thử lại.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportTeams = async () => {
    if (!importFile || !selectedEvent?._id) return;
    setImporting(true);
    setImportResult(null);
    setEmailStep(0);
    setEmailResult(null);
    persistFlowState(null, 0, null);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("eventId", selectedEvent._id);
      formData.append("skipEmail", "true");

      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${apiBase}/api/teams/import`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const newResult = {
        success: true,
        message: res.data.message || `Đã import thành công ${res.data.count} đội thi!`,
        count: res.data.count,
        teamIds: res.data.teamIds || [],
        memberCount: res.data.memberCount || 0,
      };

      const newStep = (res.data.memberCount || 0) > 0 ? 1 : 0;

      setImportResult(newResult);
      setEmailStep(newStep);
      persistFlowState(newResult, newStep, null);

      // Refresh team list in parent
      if (onRefreshTeams) {
        await onRefreshTeams();
      }
    } catch (err: any) {
      console.error("Import error:", err);
      const resData = err.response?.data;
      const errorResult = {
        success: false,
        message: resData?.message || "Lỗi khi import danh sách đội thi.",
        errors: resData?.errors || [],
      };
      setImportResult(errorResult);
      persistFlowState(errorResult, 0, null);
    } finally {
      setImporting(false);
      setImportFile(null);
    }
  };

  const handleConfirmStep1 = () => {
    setEmailStep(2);
    persistFlowState(importResult, 2, emailResult);
  };

  const handleSendInvitations = async () => {
    if (!importResult?.teamIds || importResult.teamIds.length === 0) return;
    setSendingEmails(true);
    setEmailResult(null);

    try {
      const token = localStorage.getItem("token");
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(
        `${apiBase}/api/teams/send-import-invitations`,
        { teamIds: importResult.teamIds },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const newEmailResult = {
        sent: res.data.sent || 0,
        failed: res.data.failed || 0,
        total: res.data.total || 0,
        message: res.data.message || `Đã gửi thành công ${res.data.sent} email mời!`,
      };

      setEmailResult(newEmailResult);
      setEmailStep(0);
      persistFlowState(null, 0, newEmailResult);

      // Refresh team list to update any UI states
      if (onRefreshTeams) {
        await onRefreshTeams();
      }
    } catch (err: any) {
      console.error("Send invitations error:", err);
      alert(err.response?.data?.message || "Lỗi khi gửi email mời thành viên.");
    } finally {
      setSendingEmails(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 font-mono">
            <Users size={18} className="text-[#F27024]" />
            <span>Đội thi & Thí sinh ({teamsList.length} đội)</span>
          </h3>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            onClick={handleExportTeams}
            disabled={exporting || teamsList.length === 0}
            className="text-xs font-bold px-4 py-2.5 rounded-xl font-mono transition-all flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer border border-slate-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} className="text-[#F27024]" />
            <span>{exporting ? "Đang xuất..." : "Xuất Excel"}</span>
          </button>

          {!readOnly && (
            <div className="flex flex-col items-stretch md:items-end gap-1">
              <button
                onClick={handleDistributeTeams}
                disabled={
                  loading ||
                  tracks.length === 0 ||
                  !teamsList.some((t) => t.status === "confirmed" && !t.trackId)
                }
                className={`text-xs font-bold px-4 py-2.5 rounded-xl font-mono transition-all flex items-center justify-center gap-1.5 ${
                  tracks.length > 0 &&
                  teamsList.some((t) => t.status === "confirmed" && !t.trackId)
                    ? "bg-[#F27024] hover:bg-[#d95f1d] text-white cursor-pointer shadow-md shadow-[#F27024]/20"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                }`}
              >
                Chia bảng ngẫu nhiên vào Track
              </button>
              {tracks.length === 0 && (
                <span className="text-[10px] text-rose-500 font-mono text-center md:text-right">
                  * Cần tạo Bảng đấu (Track) trước
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── IMPORT EXCEL SECTION FOR ADMIN (WHITE THEME) ─── */}
      {!readOnly && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-[#F27024] uppercase tracking-wider font-mono flex items-center gap-2">
              <Upload size={15} />
              <span>Import Danh sách Đội thi từ Excel</span>
            </h4>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="text-xs font-mono text-slate-600 hover:text-[#F27024] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 transition-all cursor-pointer disabled:opacity-50"
            >
              {downloadingTemplate ? (
                <Loader2 size={13} className="animate-spin text-[#F27024]" />
              ) : (
                <FileText size={13} className="text-[#F27024]" />
              )}
              <span>Tải file Excel mẫu</span>
            </button>
          </div>

          {/* Upload Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-8">
              <label className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-dashed border-slate-200 hover:border-[#F27024]/60 hover:bg-orange-50/20 rounded-2xl cursor-pointer transition-all group">
                <div className="p-2 rounded-xl bg-orange-50 group-hover:bg-orange-100/70 transition-colors">
                  <FileSpreadsheet
                    size={20}
                    className="text-[#F27024] shrink-0"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 font-mono truncate">
                    {importFile ? importFile.name : "Nhấn để chọn hoặc kéo thả file Excel (.xlsx, .xls)"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Form chuẩn: STT, MSSV, Họ và Tên, Tên Đội, Mail, Vai Trò, Trường
                  </p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] || null);
                    setImportResult(null);
                    setEmailStep(0);
                    setEmailResult(null);
                  }}
                />
              </label>
            </div>

            <div className="md:col-span-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportTeams}
                disabled={!importFile || importing}
                className="w-full text-xs font-bold px-5 py-3 rounded-xl font-mono text-white transition-all flex items-center justify-center gap-2 bg-[#F27024] hover:bg-[#d95f1d] cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none shadow-md shadow-[#F27024]/20 active:scale-[0.99]"
              >
                {importing ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-white" />
                    <span>Đang xử lý dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    <span>Import Danh Sách</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Import Result Feedback */}
          {importResult && (
            <div
              className={`p-4 rounded-2xl text-xs space-y-2 animate-in fade-in duration-200 border relative ${
                importResult.success
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                  : "bg-rose-50/80 border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold font-mono">
                  {importResult.success ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600" />
                  )}
                  <span>{importResult.message}</span>
                </div>
                {!importResult.success && (
                  <button
                    type="button"
                    onClick={handleClearFlowState}
                    className="p-1 rounded-lg hover:bg-rose-200/60 text-rose-700 transition-all cursor-pointer"
                    title="Đóng thông báo"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {importResult.success && importResult.memberCount !== undefined && (
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  ✓ Hệ thống đã tạo danh sách đội thi. Email mời tham gia đội hiện <strong>chưa được gửi</strong> (tránh quá tải). Hãy xác nhận 2 bước bên dưới để tiến hành gửi email.
                </p>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-rose-200/80 max-h-48 overflow-y-auto font-mono text-[11px]">
                  {importResult.errors.map((err, idx) => (
                    <p key={idx} className="text-rose-700">
                      • {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── 2-STEP CONFIRMATION EMAIL SENDING (WHITE/LIGHT THEME) ─── */}
          {emailStep === 1 && (
            <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                  <AlertCircle size={16} />
                </div>
                <div className="space-y-1 flex-1">
                  <h5 className="text-xs font-bold text-amber-800 font-mono uppercase">
                    Bước 1/2: Xác nhận danh sách vừa import
                  </h5>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Vui lòng kiểm tra lại danh sách các đội thi vừa import ở bên dưới. Nhấn <strong>"Đã xác nhận"</strong> để mở khóa bước gửi email mời tham gia ({importResult?.memberCount || 0} thí sinh bao gồm cả Trưởng nhóm & Thành viên).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmStep1}
                className="w-full text-xs font-bold font-mono py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 active:scale-[0.99]"
              >
                <CheckCircle2 size={15} />
                <span>ĐÃ XÁC NHẬN DANH SÁCH ĐỘI THI</span>
              </button>
            </div>
          )}

          {emailStep === 2 && (
            <div className="p-5 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-orange-100 text-[#F27024] shrink-0 mt-0.5">
                  <Mail size={16} />
                </div>
                <div className="space-y-1 flex-1">
                  <h5 className="text-xs font-bold text-[#F27024] font-mono uppercase">
                    Bước 2/2: Gửi email mời thí sinh vào đội
                  </h5>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Hệ thống sẽ gửi email mời qua hàng đợi (rate-limiting chống quá tải) tới toàn bộ <strong>{importResult?.memberCount || 0} thí sinh (gồm cả Trưởng nhóm & Thành viên)</strong> để họ xác nhận và điền GitHub Username.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendInvitations}
                disabled={sendingEmails}
                className="w-full text-xs font-bold font-mono py-3.5 px-4 rounded-xl bg-[#F27024] hover:bg-[#d95f1d] text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#F27024]/25 active:scale-[0.99]"
              >
                {sendingEmails ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang gửi email mời theo hàng đợi...</span>
                  </>
                ) : (
                  <>
                    <Mail size={15} />
                    <span>GỬI EMAIL MỜI ({importResult?.memberCount || 0} THÍ SINH)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Email Result Notification */}
          {emailResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{emailResult.message}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-emerald-700">
                  Thành công: <strong>{emailResult.sent} / {emailResult.total}</strong>
                  {emailResult.failed > 0 && ` (Thất bại: ${emailResult.failed})`}
                </span>
                <button
                  type="button"
                  onClick={handleClearFlowState}
                  className="p-1 rounded-lg hover:bg-emerald-200/60 text-emerald-700 transition-all cursor-pointer"
                  title="Đóng thông báo"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grouped lists */}
      <div className="space-y-6">
        {/* 1. Confirmed Teams */}
        <div>
          <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
            <span>
              ✓ Đội thi đã Xác nhận (
              {teamsList.filter((t) => t.status === "confirmed").length})
            </span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamsList
              .filter((t) => t.status === "confirmed")
              .map((team: any) => (
                <div
                  key={team._id}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-[#F27024] font-mono">
                        ĐỘI THI
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm">
                        {team.name}
                      </h5>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {selectedEvent?.status !== "registration" &&
                        selectedEvent?.status !== "upcoming" &&
                        team.currentRoundId && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold bg-orange-50 text-[#F27024] border border-orange-200">
                            {(() => {
                              if (typeof team.currentRoundId === "object") {
                                return team.currentRoundId?.name || "";
                              }
                              const rObj = (rounds || []).find(
                                (r: any) => r._id === team.currentRoundId,
                              );
                              return rObj ? rObj.name : team.currentRoundId;
                            })()}
                          </span>
                        )}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold ${
                          team.trackId
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {team.trackId?.name
                          ? team.trackId.name.startsWith("Bảng")
                            ? team.trackId.name
                            : `Bảng ${team.trackId.name}`
                          : team.trackId
                            ? "Đã gán"
                            : "Chưa chia bảng"}
                      </span>
                    </div>
                  </div>

                  {/* Leader & Repo Info */}
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p>
                      Trưởng nhóm:{" "}
                      <strong className="text-slate-800 font-semibold">
                        {team.leaderId?.fullName}
                      </strong>{" "}
                      ({team.leaderId?.email})
                    </p>
                    {team.mentorId && (
                      <p>
                        Mentor:{" "}
                        <strong className="text-emerald-700 font-semibold">
                          {team.mentorId?.fullName || team.mentorId}
                        </strong>{" "}
                        {team.mentorId?.email && `(${team.mentorId.email})`}
                      </p>
                    )}
                    {team.repository ? (
                      <p className="flex items-center gap-2 flex-wrap">
                        <span>Repository:</span>
                        <a
                          href={team.repository.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#F27024] hover:underline font-mono"
                        >
                          {team.repository.repoName}
                        </a>
                        {!readOnly && (
                          <button
                            onClick={() => handleSyncRepo(team.repository._id)}
                            disabled={
                              loading || syncingRepoId === team.repository._id
                            }
                            title="Đồng bộ commit và chạy AI đánh giá thủ công ngay lập tức"
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed ${
                              syncingRepoId === team.repository._id
                                ? "bg-orange-100 text-orange-700 border-orange-200"
                                : "bg-orange-50 hover:bg-orange-100 text-[#F27024] border-orange-200"
                            }`}
                          >
                            <RefreshCw
                              size={10}
                              className={
                                syncingRepoId === team.repository._id
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                            <span>
                              {syncingRepoId === team.repository._id
                                ? "Đang đồng bộ..."
                                : "Đồng bộ AI"}
                            </span>
                          </button>
                        )}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">
                        GitHub Repo: Chưa cấp phát (chờ chia bảng)
                      </p>
                    )}
                  </div>

                  {/* Members */}
                  <div className="border-t border-slate-100 pt-2.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Thành viên ({team.members?.length || 0}):
                    </p>
                    <div className="space-y-1">
                      {team.members?.map((m: any) => (
                        <div
                          key={m.userId?._id}
                          className="flex justify-between items-center text-xs text-slate-700"
                        >
                          <span>
                            • {m.userId?.fullName}{" "}
                            {m.userId?.studentId && `(${m.userId.studentId}) `}
                            {m.userId?.university &&
                              `- ${m.userId.university} `}
                            {m.role === "leader" && (
                              <span className="text-[10px] text-[#F27024] font-mono font-bold">
                                (Trưởng nhóm)
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {m.userId?.githubUsername || "Chưa liên kết Git"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Assign Track controls */}
                  {!readOnly && (
                    <div className="border-t border-slate-100 pt-2.5 flex flex-col gap-1.5">
                      <p className="text-[10px] font-bold text-[#F27024] uppercase tracking-wider font-mono">
                        Phân chia / Thay đổi bảng đấu:
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAssignTrack(team._id, "random")}
                          disabled={loading || tracks.length === 0}
                          className="flex-1 bg-white hover:bg-orange-50 disabled:bg-slate-100 disabled:text-slate-400 text-xs text-[#F27024] font-bold py-1.5 px-3 rounded-xl font-mono transition-all flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed border border-orange-200"
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
                            options={tracks
                              .filter((track: any) => {
                                const currentTrackId =
                                  team.trackId?._id || team.trackId;
                                const isCurrentTrack =
                                  track._id === currentTrackId;
                                return (
                                  isCurrentTrack ||
                                  (track.name.toLowerCase() !==
                                    "bảng chung kết" &&
                                    !track.name
                                      .toLowerCase()
                                      .includes("chung kết"))
                                );
                              })
                              .map((track: any) => ({
                                value: track._id,
                                label: track.name.startsWith("Bảng")
                                  ? track.name
                                  : `Bảng ${track.name}`,
                              }))}
                            placeholder="-- Chọn Bảng đấu --"
                            className="flex-1"
                          />
                        )}
                      </div>
                      {tracks.length === 0 && (
                        <p className="text-[9px] text-rose-500 font-mono italic">
                          * Cần tạo Bảng đấu (Track) trước
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            {teamsList.filter((t) => t.status === "confirmed").length === 0 && (
              <p className="col-span-2 text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
                Chưa có đội thi nào xác nhận hoàn tất.
              </p>
            )}
          </div>
        </div>

        {/* 2. Pending Teams */}
        <div>
          <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider font-mono mb-3">
            Đội thi đang chờ xác nhận (
            {teamsList.filter((t) => t.status === "pending_confirm").length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamsList
              .filter((t) => t.status === "pending_confirm")
              .map((team: any) => (
                <div
                  key={team._id}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-[#F27024] font-mono">
                        ĐỘI CHỜ DUYỆT
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm">
                        {team.name}
                      </h5>
                    </div>
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-mono font-bold">
                      Chờ duyệt
                    </span>
                  </div>

                  {/* Leader & Repo Info */}
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p>
                      Trưởng nhóm:{" "}
                      <strong className="text-slate-800 font-semibold">
                        {team.leaderId?.fullName || "Chưa thiết lập"}
                      </strong>{" "}
                      {team.leaderId?.email && `(${team.leaderId.email})`}
                    </p>
                    {team.repository ? (
                      <p className="flex items-center gap-2 flex-wrap">
                        <span>Repository:</span>
                        <a
                          href={team.repository.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#F27024] hover:underline font-mono"
                        >
                          {team.repository.repoName}
                        </a>
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">
                        GitHub Repo: Chưa cấp phát (chờ chia bảng)
                      </p>
                    )}
                  </div>

                  {/* Members with status */}
                  <div className="border-t border-slate-100 pt-2.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Thành viên ({team.members?.length || 0}):
                    </p>
                    <div className="space-y-1">
                      {team.members?.map((m: any) => (
                        <div
                          key={m.userId?._id}
                          className="flex justify-between items-center text-xs"
                        >
                          <span className="text-slate-700">
                            • {m.userId?.fullName}{" "}
                            {m.userId?.studentId && `(${m.userId.studentId}) `}
                            {m.userId?.university && `- ${m.userId.university} `}
                            {m.role === "leader" && (
                              <span className="text-[#F27024] font-bold">(Trưởng nhóm)</span>
                            )}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border ${
                              m.confirmStatus === "confirmed"
                                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                : "text-amber-700 bg-amber-50 border-amber-200"
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
                </div>
              ))}
            {teamsList.filter((t) => t.status === "pending_confirm").length ===
              0 && (
                <p className="col-span-2 text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
                  Không có nhóm nào ở trạng thái chờ xác nhận.
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
