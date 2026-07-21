import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  HelpCircle,
  Trophy,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Loader2,
  Calendar,
  Mail,
  Award
} from "lucide-react";
import CustomSelect from "../shared/CustomSelect";

interface EventItem {
  _id: string;
  name: string;
  semester: string;
  year: number;
  status: string;
}

export default function ConfirmSurvey() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamNameFromUrl = searchParams.get("teamName") || "";

  const token = localStorage.getItem("token");

  const [hasParticipated, setHasParticipated] = useState<"never" | "past" | null>(null);
  const [completedEvents, setCompletedEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [pastEmail, setPastEmail] = useState<string>("");

  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "success" | "error">("idle");
  const [verifyMessage, setVerifyMessage] = useState<string>("");
  const [matchedDetails, setMatchedDetails] = useState<{ teamName?: string; eventName?: string }>({});
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);

  useEffect(() => {
    const fetchCompletedEvents = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(`${apiBase}/api/events/published`);
        const allEvents: EventItem[] = res.data || [];
        // Filter events with status === 'completed' or 'complete'
        const finished = allEvents.filter(
          (e) => e.status === "completed" || e.status === "complete"
        );
        setCompletedEvents(finished.length > 0 ? finished : allEvents);
      } catch (err) {
        console.error("Lỗi khi tải danh sách sự kiện hoàn thành:", err);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchCompletedEvents();
  }, []);

  const handleVerifyPastParticipation = async () => {
    if (!selectedEventId) {
      setVerifyStatus("error");
      setVerifyMessage("Vui lòng chọn sự kiện trước đó bạn đã từng tham gia.");
      return;
    }

    if (!pastEmail.trim()) {
      setVerifyStatus("error");
      setVerifyMessage("Vui lòng nhập địa chỉ email bạn đã từng dùng tại sự kiện đó.");
      return;
    }

    setVerifying(true);
    setVerifyStatus("idle");
    setVerifyMessage("");

    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(
        `${apiBase}/api/teams/verify-past-participation`,
        {
          eventId: selectedEventId,
          email: pastEmail.trim()
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data && res.data.success) {
        setVerifyStatus("success");
        setVerifyMessage(res.data.message);
        setMatchedDetails({
          teamName: res.data.teamName,
          eventName: res.data.eventName
        });
      } else {
        setVerifyStatus("error");
        setVerifyMessage(res.data.message || "Không tìm thấy thông tin tham gia.");
      }
    } catch (err: any) {
      console.error("Lỗi kiểm tra tham gia:", err);
      const msg =
        err.response?.data?.message ||
        "Không tìm thấy thông tin email này trong danh sách sự kiện đã chọn. Vui lòng kiểm tra lại!";
      setVerifyStatus("error");
      setVerifyMessage(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleFinish = () => {
    navigate("/team-area");
  };

  return (
    <div className="team-area-light min-h-screen bg-[#faf9f6] text-slate-800 font-sans flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-white border border-slate-200/80 rounded-3xl shadow-xl p-6 sm:p-10 space-y-8 relative overflow-hidden">
        {/* Top Decorative Banner */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 via-[#F27024] to-amber-500"></div>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 text-[#F27024] border border-orange-500/20 text-xs font-mono font-bold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>XÁC NHẬN THAM GIA THÀNH CÔNG</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Khảo sát Lịch sử Tham gia SEAL Hackathon
          </h1>

          {teamNameFromUrl && (
            <p className="text-xs font-semibold text-slate-500">
              Đội thi: <span className="text-[#F27024] font-bold">{teamNameFromUrl}</span>
            </p>
          )}

          <p className="text-slate-600 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
            Vui lòng hoàn thành câu hỏi khảo sát nhanh bên dưới để hệ thống cập nhật chính xác Bảng Thành Tích của bạn qua các mùa giải.
          </p>
        </div>

        {/* Question Card */}
        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <HelpCircle size={18} className="text-[#F27024]" />
            <span>Bạn đã từng tham gia SEAL Hackathon chưa? <span className="text-rose-500">*</span></span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Option A: Chưa từng */}
            <div
              onClick={() => {
                setHasParticipated("never");
                setVerifyStatus("idle");
                setVerifyMessage("");
              }}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                hasParticipated === "never"
                  ? "bg-orange-500/10 border-[#F27024] shadow-md"
                  : "bg-slate-50 hover:bg-slate-100/80 border-slate-200"
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${hasParticipated === "never" ? "bg-[#F27024] text-white" : "bg-slate-200 text-slate-600"}`}>
                <CheckCircle2 size={20} />
              </div>
              <div className="space-y-1">
                <h3 className={`text-sm font-bold ${hasParticipated === "never" ? "text-[#F27024]" : "text-slate-800"}`}>
                  Chưa từng tham gia
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Đây là mùa giải đầu tiên tôi đăng ký tham gia SEAL Hackathon.
                </p>
              </div>
            </div>

            {/* Option B: Đã từng */}
            <div
              onClick={() => {
                setHasParticipated("past");
                setVerifyStatus("idle");
                setVerifyMessage("");
              }}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                hasParticipated === "past"
                  ? "bg-orange-500/10 border-[#F27024] shadow-md"
                  : "bg-slate-50 hover:bg-slate-100/80 border-slate-200"
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${hasParticipated === "past" ? "bg-[#F27024] text-white" : "bg-slate-200 text-slate-600"}`}>
                <Trophy size={20} />
              </div>
              <div className="space-y-1">
                <h3 className={`text-sm font-bold ${hasParticipated === "past" ? "text-[#F27024]" : "text-slate-800"}`}>
                  Đã từng tham gia
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tôi đã từng tham gia thi đấu ở các mùa SEAL Hackathon trước đó.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Section for Option "Đã từng" */}
        {hasParticipated === "past" && (
          <div className="bg-orange-500/5 p-6 rounded-2xl border border-orange-500/20 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F27024] flex items-center gap-2">
              <Award size={16} />
              <span>XÁC THỰC LỊCH SỬ THAM GIA MÙA TRƯỚC</span>
            </h3>

            <div className="space-y-4">
              {/* Event Select Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={14} className="text-[#F27024]" />
                  <span>Chọn Sự kiện đã tham gia trước đó <span className="text-rose-500">*</span></span>
                </label>
                {loadingEvents ? (
                  <p className="text-xs text-slate-500 animate-pulse font-mono">Đang tải danh sách sự kiện...</p>
                ) : (
                  <CustomSelect
                    value={selectedEventId}
                    onChange={(val: any) => setSelectedEventId(val)}
                    options={completedEvents.map((e) => ({
                      value: e._id,
                      label: `${e.name} (${e.semester} ${e.year})`,
                    }))}
                    placeholder="Chọn sự kiện đã kết thúc..."
                    className="w-full font-mono"
                  />
                )}
              </div>

              {/* Past Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Mail size={14} className="text-[#F27024]" />
                  <span>Email đã dùng tại sự kiện đó <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="email"
                  value={pastEmail}
                  onChange={(e) => setPastEmail(e.target.value)}
                  placeholder="Nhập email bạn đã từng đăng ký ở mùa trước..."
                  className="w-full bg-white border border-slate-300 text-slate-900 px-4 py-2.5 rounded-xl text-xs focus:outline-none focus:border-[#F27024] transition-all font-mono"
                />
              </div>

              {/* Check Verification Button */}
              <button
                type="button"
                onClick={handleVerifyPastParticipation}
                disabled={verifying || !selectedEventId || !pastEmail.trim()}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#F27024] hover:bg-[#e05e1b] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition-all uppercase tracking-wider cursor-pointer shadow-md active:scale-95"
              >
                {verifying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>ĐANG KIỂM TRA HỆ THỐNG...</span>
                  </>
                ) : (
                  <>
                    <Trophy size={16} />
                    <span>KIỂM TRA & XÁC NHẬN THÀNH TÍCH</span>
                  </>
                )}
              </button>

              {/* Success / Error Banners */}
              {verifyStatus === "success" && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1.5 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 font-bold text-emerald-700">
                    <CheckCircle2 size={18} />
                    <span>XÁC THỰC THÀNH CÔNG!</span>
                  </div>
                  <p className="leading-relaxed">{verifyMessage}</p>
                  {matchedDetails.teamName && (
                    <p className="text-[11px] font-mono text-emerald-600 italic">
                      ✓ Đội thi đã ghép nối: <strong>{matchedDetails.teamName}</strong> ({matchedDetails.eventName})
                    </p>
                  )}
                </div>
              )}

              {verifyStatus === "error" && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1.5 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 font-bold text-rose-700">
                    <AlertCircle size={18} />
                    <span>THÔNG BÁO XÁC THỰC</span>
                  </div>
                  <p className="leading-relaxed">{verifyMessage}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit & Continue Button */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            disabled={!hasParticipated}
            onClick={handleFinish}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95"
          >
            <span>HOÀN TẤT & VỀ TRANG ĐỘI THI</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
