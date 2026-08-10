import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import { BriefcaseBusiness, CheckCircle2, Download, FileSpreadsheet, RefreshCw, ShieldCheck, Trash2, Upload, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

type PersonnelRow = {
  fullName: string;
  email: string;
  unit: string;
  role: "judge" | "mentor";
  isChiefJudge: boolean;
  existingStatus?: "pending" | "accepted" | "rejected";
  existingInvitationId?: string;
  roundName: string;
  trackName: string;
  note: string;
};

export default function PersonnelManagement() {
  const { readOnly = false } = useOutletContext<{ readOnly?: boolean }>();
  const token = localStorage.getItem("token");
  const [event, setEvent] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [preview, setPreview] = useState<PersonnelRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isPreviewConfirmed, setIsPreviewConfirmed] = useState(false);
  const [isSendingInvitations, setIsSendingInvitations] = useState(false);
  const [isAccountActionLoading, setIsAccountActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPersonnel = async () => {
    try {
      setLoading(true);
      const eventsRes = await axios.get("http://localhost:5000/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ongoingEvent = eventsRes.data.find(
        (item: any) => item.status === "ongoing" && !item.isArchived,
      );
      setEvent(ongoingEvent || null);
      if (!ongoingEvent) {
        setRoles([]);
        return;
      }
      const [rolesRes, invitationsRes, eventDetailsRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/events/${ongoingEvent._id}/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`http://localhost:5000/api/personnel-invitations/event/${ongoingEvent._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`http://localhost:5000/api/events/${ongoingEvent._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setRoles(rolesRes.data.filter((item: any) => ["judge", "mentor"].includes(item.role)));
      setInvitations(invitationsRes.data);
      const activeRound = eventDetailsRes.data.rounds?.find((round: any) => round.status === "active");
      setTracks((eventDetailsRes.data.tracks || []).filter((track: any) => !activeRound || String(track.roundId) === String(activeRound._id)));
    } catch (error) {
      console.error("Load personnel error", error);
      toast.error("Không thể tải danh sách nhân sự sự kiện.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonnel();
  }, []);

  const parseMasterSheet = async (file: File) => {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const personnelSheetName = workbook.SheetNames.find(
        (name) => name.trim().toLocaleUpperCase("vi-VN") === "NHÂN SỰ",
      );
      if (!personnelSheetName) throw new Error("Không tìm thấy tab NHÂN SỰ.");

      const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[personnelSheetName], {
        header: 1,
        defval: "",
      });
      const converted: PersonnelRow[] = [];
      let role: "judge" | "mentor" | "" = "";
      let roundName = "";
      let trackName = "";

      for (const row of rows.slice(1)) {
        const marker = String(row[0] || "").trim().toLocaleUpperCase("vi-VN");
        if (marker === "MENTOR") {
          role = "mentor";
          roundName = "Tất cả các vòng";
          trackName = "";
          continue;
        }
        if (marker === "BAN GIÁM KHẢO") {
          role = "judge";
          continue;
        }
        if (marker.startsWith("VÒNG SƠ LOẠI")) {
          role = "judge";
          roundName = "Vòng sơ loại";
          trackName = marker.match(/TRACK\s*\d+/)?.[0] || "";
          continue;
        }
        if (marker === "VÒNG CHUNG KẾT") {
          role = "judge";
          roundName = "Vòng chung kết";
          trackName = "Chung kết";
          continue;
        }
        if (!role || !row[1]) continue;
        converted.push({
          fullName: String(row[1]).trim(),
          email: String(row[2]).trim().toLowerCase(),
          unit: String(row[3]).trim(),
          role,
          isChiefJudge: false,
          roundName,
          trackName: role === "mentor"
            ? String(row[4]).match(/Track\s*\d+/i)?.[0] || ""
            : trackName,
          note: String(row[4]).trim(),
        });
      }

      if (!converted.length) throw new Error("Không đọc được Mentor hoặc Judge từ file.");
      setFileName(file.name);
      const hasChiefJudge = invitations.some((invitation) => ["pending", "accepted"].includes(invitation.status) && invitation.assignments?.some((assignment: any) => assignment.role === "judge" && assignment.isChiefJudge))
        || roles.some((role) => role.role === "judge" && role.isChiefJudge);
      setPreview(converted.map((item) => {
        const existing = invitations.find((invitation) => invitation.email === item.email);
        return {
          ...item,
          existingStatus: existing?.status,
          existingInvitationId: existing?._id,
        };
      }).filter((item) => !item.existingStatus || (!hasChiefJudge && item.role === "judge" && item.existingStatus !== "rejected")));
      setIsPreviewConfirmed(false);
      toast.success(`Đã chuyển đổi ${converted.length} phân công nhân sự.`);
    } catch (error: any) {
      setFileName("");
      setPreview([]);
      setIsPreviewConfirmed(false);
      toast.error(error.message || "File Master Sheet không hợp lệ.");
    }
  };

  const shouldProcessPreviewRow = (item: PersonnelRow) => !item.existingStatus || Boolean(item.isChiefJudge);

  const stats = useMemo(() => ({
    judges: roles.filter((item) => item.role === "judge").length,
    mentors: roles.filter((item) => item.role === "mentor").length,
    acceptedPreview: preview.filter((item) => shouldProcessPreviewRow(item) && item.email && (item.role !== "mentor" || item.trackName)).length,
    invalidPreview: preview.filter((item) => shouldProcessPreviewRow(item) && (!item.email || (item.role === "mentor" && !item.trackName))).length,
  }), [roles, preview]);

  const visiblePreview = preview
    .map((item, index) => ({ item, index }));

  const updateMentorTrack = (index: number, trackName: string) => {
    setPreview((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, trackName }
      : item));
    setIsPreviewConfirmed(false);
  };

  const updateChiefJudge = (index: number, isChiefJudge: boolean) => {
    setPreview((current) => current.map((item, itemIndex) => ({
      ...item,
      isChiefJudge: item.role === "judge" && itemIndex === index ? isChiefJudge : false,
    })));
    setIsPreviewConfirmed(false);
  };

  const confirmConvertedPersonnel = async () => {
    const invalidRows = preview.filter(
      (item) => shouldProcessPreviewRow(item) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)
        || (item.role === "mentor" && !item.trackName)
      ),
    );
    if (invalidRows.length > 0) {
      toast.error(`Còn ${invalidRows.length} dòng thiếu email hoặc email không hợp lệ.`);
      return;
    }
    if (!event) return;
    const personnelToSend = preview.filter((item) => !item.existingStatus);
    const existingChiefJudge = preview.find((item) => item.existingInvitationId && item.isChiefJudge);
    if (!personnelToSend.length && !existingChiefJudge) {
      toast.info("Không có nhân sự mới hoặc Chủ tịch Hội đồng cần cập nhật.");
      return;
    }
    try {
      setIsSendingInvitations(true);
      let successMessage = "Đã cập nhật danh sách nhân sự.";
      if (existingChiefJudge) {
        const chiefResponse = await axios.put(
          `http://localhost:5000/api/personnel-invitations/${existingChiefJudge.existingInvitationId}/chief-judge`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        successMessage = chiefResponse.data.message || successMessage;
      }
      if (personnelToSend.length) {
        const response = await axios.post(
          `http://localhost:5000/api/personnel-invitations/event/${event._id}/send`,
          { personnel: personnelToSend },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        successMessage = response.data.message || successMessage;
      }
      setPreview([]);
      setFileName("");
      setIsPreviewConfirmed(false);
      toast.success(successMessage);
      await loadPersonnel();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể gửi lời mời nhân sự.");
    } finally {
      setIsSendingInvitations(false);
    }
  };

  const downloadConvertedPersonnel = () => {
    const rows = preview.map((item, index) => ({
      STT: index + 1,
      "HỌ VÀ TÊN": item.fullName,
      EMAIL: item.email,
      "ĐƠN VỊ": item.unit,
      "VAI TRÒ": item.role.toUpperCase(),
      "CHỦ TỊCH HỘI ĐỒNG": item.role === "judge" && item.isChiefJudge ? "Có" : "Không",
      "VÒNG THI": item.roundName,
      "TRACK/BẢNG": item.trackName,
      "GHI CHÚ": item.note,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 7 }, { wch: 24 }, { wch: 30 }, { wch: 34 },
      { wch: 13 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 28 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NHÂN SỰ");
    XLSX.writeFile(workbook, "NHAN_SU_SEAL_HACKATHON_DA_CHUYEN_DOI.xlsx");
  };

  const runAccountAction = async (path: string, successFallback: string, requireConfirmation = false) => {
    if (requireConfirmation && !window.confirm("Bạn có chắc chắn muốn thu hồi quyền nhân sự đã chọn?")) return;
    try {
      setIsAccountActionLoading(true);
      const response = await axios.post(
        `http://localhost:5000/api/personnel-invitations/${path}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message || successFallback);
      await loadPersonnel();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể cập nhật quyền nhân sự.");
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  const deleteInvitation = async (invitation: any) => {
    if (!window.confirm(`Xóa lời mời đã gửi đến ${invitation.email}?`)) return;
    try {
      setIsAccountActionLoading(true);
      const response = await axios.delete(
        `http://localhost:5000/api/personnel-invitations/${invitation._id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message || "Đã xóa lời mời.");
      await loadPersonnel();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể xóa lời mời nhân sự.");
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  const resendInvitation = async (invitation: any) => {
    try {
      setIsAccountActionLoading(true);
      const response = await axios.post(
        `http://localhost:5000/api/personnel-invitations/${invitation._id}/resend`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message || "Đã gửi lại lời mời.");
      await loadPersonnel();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể gửi lại lời mời.");
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  const updateInvitationMentorTrack = async (invitationId: string, trackId: string) => {
    if (!trackId) return;
    try {
      setIsAccountActionLoading(true);
      const response = await axios.put(
        `http://localhost:5000/api/personnel-invitations/${invitationId}/mentor-track`,
        { trackId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message || "Đã cập nhật track cho Mentor.");
      await loadPersonnel();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể cập nhật track cho Mentor.");
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Đang tải nhân sự...</div>;
  }

  return (
    <div className="space-y-6 text-slate-800">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#F27024]/20 bg-[#F27024]/10 text-[#F27024]">
            <BriefcaseBusiness size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wide">Quản lý nhân sự</h1>
            <p className="mt-1 text-xs text-slate-500">
              {event ? `Sự kiện đang hoạt động: ${event.name}` : "Hiện chưa có sự kiện đang hoạt động"}
            </p>
          </div>
        </div>
        <button type="button" onClick={loadPersonnel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30">
          <RefreshCw size={14} /> Tải lại
        </button>
      </header>

      {!event ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Tab nhân sự chỉ mở dữ liệu khi có sự kiện mang trạng thái “Đang diễn ra”.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Judge đã cấp quyền", stats.judges],
              ["Mentor đã cấp quyền", stats.mentors],
              ["Dòng hợp lệ trong file", stats.acceptedPreview],
              ["Dòng thiếu email", stats.invalidPreview],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-[#F27024]">{value}</p>
              </div>
            ))}
          </section>

          {!readOnly && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold"><FileSpreadsheet size={18} className="text-[#F27024]" /> Chuyển đổi Master Sheet</h2>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F27024] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#d95f1f] focus-within:ring-2 focus-within:ring-[#F27024]/30">
                  <Upload size={15} /> Import Excel
                  <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => event.target.files?.[0] && parseMasterSheet(event.target.files[0])} />
                </label>
              </div>
              {fileName && <p className="mt-3 text-xs text-slate-500">File đang kiểm duyệt: <strong>{fileName}</strong></p>}
            </section>
          )}

          {preview.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold">Danh sách nhân sự xem trước</h2>
                  <p className="mt-1 text-xs text-slate-500">Kiểm tra dữ liệu trước khi mở bước gửi lời mời.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isPreviewConfirmed ? (
                    <>
                      <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 size={14} /> Đã xác nhận
                      </span>
                      <button
                        type="button"
                        onClick={downloadConvertedPersonnel}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30"
                      >
                        <Download size={14} /> Tải file đã chuyển đổi
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={confirmConvertedPersonnel}
                      disabled={stats.invalidPreview > 0 || isSendingInvitations}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#F27024] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#d95f1f] focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} /> {isSendingInvitations ? "Đang gửi lời mời..." : "Xác nhận & gửi lời mời"}
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Họ tên</th><th className="p-3">Email</th><th className="p-3">Vai trò</th><th className="p-3">Vòng/Track</th><th className="p-3">Kiểm tra</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {visiblePreview.map(({ item, index }) => (
                      <tr key={`${item.email}-${item.role}-${index}`}><td className="p-3 font-semibold">{item.fullName}</td><td className="p-3 text-slate-500">{item.email || "Thiếu email"}</td><td className="p-3"><div className="flex flex-col items-start gap-2"><span className="rounded-md bg-[#F27024]/10 px-2 py-1 font-bold text-[#F27024]">{item.role.toUpperCase()}</span>{item.role === "judge" && <label className="inline-flex cursor-pointer items-center gap-2 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={item.isChiefJudge} onChange={(event) => updateChiefJudge(index, event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#F27024] focus:ring-2 focus:ring-[#F27024]/30" />Chủ tịch Hội đồng</label>}</div></td><td className="p-3 text-slate-500">{item.role === "mentor" ? <label className="block"><span className="sr-only">Chọn track cho {item.fullName}</span><select value={item.trackName} onChange={(event) => updateMentorTrack(index, event.target.value)} className={`w-full min-w-36 rounded-lg border bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 ${item.trackName ? "border-slate-200 text-slate-700" : "border-rose-300 text-rose-700"}`}><option value="">Chọn track</option>{tracks.map((track) => <option key={track._id} value={track.name}>{track.name}</option>)}</select></label> : <>{item.roundName}{item.trackName ? ` · ${item.trackName}` : ""}</>}</td><td className="p-3">{item.email && (item.role !== "mentor" || item.trackName) ? <CheckCircle2 size={16} className="text-emerald-600" /> : <span className="text-rose-600">{!item.email ? "Thiếu email" : "Chưa chọn track"}</span>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-sm font-bold">Trạng thái lời mời</h2><p className="mt-1 text-xs text-slate-500">Tải lại để cập nhật phản hồi mới nhất từ nhân sự.</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={isAccountActionLoading || !invitations.some((item) => item.status === "accepted" && item.accountStatus !== "provisioned")} onClick={() => runAccountAction(`event/${event._id}/provision-all`, "Đã cấp tài khoản.")} className="rounded-lg bg-[#F27024] px-3 py-2 text-xs font-bold text-white hover:bg-[#d95f1f] disabled:opacity-50">Cấp tất cả đã chấp thuận</button>
                <button type="button" disabled={isAccountActionLoading || !invitations.some((item) => item.accountStatus === "provisioned")} onClick={() => runAccountAction(`event/${event._id}/revoke-all`, "Đã thu hồi tất cả.", true)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">Thu hồi tất cả</button>
                <button type="button" onClick={loadPersonnel} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Tải lại trạng thái"><RefreshCw size={15} /></button>
              </div>
            </div>
            {invitations.length ? (
              <div className="divide-y divide-slate-100">
                {invitations.map((invitation) => {
                  const statusStyle = invitation.status === "accepted"
                    ? "bg-emerald-50 text-emerald-700"
                    : invitation.status === "rejected"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-700";
                  const statusLabel = invitation.status === "accepted" ? "Đã chấp thuận" : invitation.status === "rejected" ? "Đã từ chối" : "Đang chờ phản hồi";
                  return (
                    <div key={invitation._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm font-bold">{invitation.fullName}</p><p className="text-xs text-slate-500">{invitation.email}</p><div className="mt-2 flex flex-wrap gap-1">{invitation.assignments?.map((item: any, index: number) => <span key={index} className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${item.isChiefJudge ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.role}{item.trackName ? ` · ${item.trackName}` : ""}{item.isChiefJudge ? " · Chủ tịch Hội đồng" : ""}</span>)}</div>{invitation.assignments?.some((item: any) => item.role === "mentor") && <label className="mt-3 block max-w-52"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Track của Mentor</span><select value={tracks.find((track) => track.name === invitation.assignments.find((item: any) => item.role === "mentor")?.trackName)?._id || ""} disabled={isAccountActionLoading} onChange={(event) => updateInvitationMentorTrack(invitation._id, event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F27024]/30 disabled:opacity-50"><option value="">Chọn track</option>{tracks.map((track) => <option key={track._id} value={track._id}>{track.name}</option>)}</select></label>}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${statusStyle}`}>{statusLabel}</span>
                        {invitation.emailStatus === "failed" && <span className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-700">Gửi email thất bại</span>}
                        {invitation.accountEmailStatus === "failed" && <span className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-700">Email tài khoản thất bại</span>}
                        {["pending", "rejected"].includes(invitation.status) && <button type="button" disabled={isAccountActionLoading} onClick={() => resendInvitation(invitation)} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10px] font-bold text-orange-700 transition-colors hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50">Gửi lại lời mời</button>}
                        {["pending", "rejected"].includes(invitation.status) && <button type="button" aria-label={`Xóa lời mời của ${invitation.fullName}`} disabled={isAccountActionLoading} onClick={() => deleteInvitation(invitation)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-700 transition-colors hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={12} aria-hidden="true" />Xóa lời mời</button>}
                        {invitation.status === "accepted" && invitation.accountStatus !== "provisioned" && <button type="button" disabled={isAccountActionLoading} onClick={() => runAccountAction(`${invitation._id}/provision`, "Đã cấp tài khoản.")} className="rounded-lg bg-[#F27024] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#d95f1f] disabled:opacity-50">{invitation.accountStatus === "revoked" ? "Cấp lại tài khoản" : "Cấp tài khoản"}</button>}
                        {invitation.accountStatus === "provisioned" && <><span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">Đã cấp tài khoản</span><button type="button" disabled={isAccountActionLoading} onClick={() => runAccountAction(`${invitation._id}/revoke`, "Đã thu hồi quyền.", true)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Thu hồi</button></>}
                        {invitation.accountStatus === "revoked" && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600">Đã thu hồi</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="p-8 text-center text-xs text-slate-500">Chưa gửi lời mời nhân sự nào.</p>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5"><h2 className="flex items-center gap-2 text-sm font-bold"><UserRoundCheck size={18} className="text-[#F27024]" /> Nhân sự đã được cấp quyền</h2></div>
            {roles.length ? <div className="divide-y divide-slate-100">{roles.map((item) => <div key={item._id} className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-bold">{item.userId?.fullName}</p><p className="text-xs text-slate-500">{item.userId?.email} · {item.trackId?.name || "Toàn sự kiện"}</p></div><div className="flex items-center gap-2"><span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><ShieldCheck size={12} className="mr-1 inline" />Đã cấp tài khoản</span><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{item.role}</span></div></div>)}</div> : <p className="p-8 text-center text-xs text-slate-500">Chưa có Judge hoặc Mentor nào được cấp quyền.</p>}
          </section>
        </>
      )}
    </div>
  );
}
