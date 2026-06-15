import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FolderKanban, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:5000/api/events");
      setEvents(res.data);
    } catch (err) {
      console.error("Lỗi lấy danh sách sự kiện:", err);
      toast.error("Lỗi khi tải danh sách cuộc thi.");
    } finally {
      setLoading(false);
    }
  };

  const handleEventDoubleClick = (eventObj: any) => {
    navigate(`/admin/events?eventId=${eventObj._id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            <span className="text-cyan-400 text-cyan-glow font-mono-tech">QUẢN LÝ SỰ KIỆN</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Danh sách các cuộc thi hackathon đang diễn ra và đã kết thúc. Chọn cuộc thi để xem cấu hình chi tiết.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/events")}
          className="bg-cyan-500 hover:bg-cyan-400 text-white px-4 py-2.5 rounded-xl border border-cyan-500/20 text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/25 transition-all"
        >
          <CalendarPlus size={14} />
          TẠO CUỘC THI MỚI
        </button>
      </div>

      <div className="w-full space-y-4">
        <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2 font-mono">
          <FolderKanban size={18} className="text-cyan-400" />
          <span>DANH SÁCH SỰ KIỆN HIỆN CÓ</span>
        </h3>
        {loading ? (
          <p className="text-xs text-slate-500 animate-pulse font-mono">Đang tải danh sách cuộc thi...</p>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((e: any) => (
              <button
                key={e._id}
                onClick={() => handleEventDoubleClick(e)}
                onDoubleClick={() => handleEventDoubleClick(e)}
                className="w-full text-left p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-40 border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/40 text-slate-400 cursor-pointer"
              >
                <div>
                  <div className="flex justify-between items-start w-full">
                    <span className="font-mono text-sm tracking-tight text-slate-200">
                      {e.name}
                    </span>
                    <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded font-mono border border-slate-800 text-slate-350">
                      {e.semester} {e.year}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-3 font-sans font-normal leading-normal">
                    {e.description || "Chưa có mô tả chi tiết."}
                  </p>
                </div>

                <div className="flex justify-between items-center w-full mt-4 pt-2 border-t border-slate-800/40 text-[10px] font-mono">
                  <span>
                    Trạng thái:{" "}
                    <strong className="text-cyan-300 uppercase">
                      {e.status}
                    </strong>
                  </span>
                  <span className="text-cyan-400 font-bold bg-cyan-500/5 px-2.5 py-0.5 rounded">
                    {e.teamCount || 0} Đội tham gia
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic font-mono">
            Chưa có cuộc thi nào được khởi tạo.
          </p>
        )}
      </div>
    </div>
  );
}
