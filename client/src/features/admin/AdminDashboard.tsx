import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FolderKanban, CalendarPlus, Info } from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchEvents();
    fetchAllLogs();
    const interval = setInterval(() => {
      fetchAllLogs();
    }, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
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

  const fetchAllLogs = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/events/all/logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(res.data || []);
    } catch (err) {
      console.error("Lỗi lấy nhật ký hoạt động:", err);
    }
  };

  const handleEventDoubleClick = (eventObj: any) => {
    navigate(`/admin/events?eventId=${eventObj._id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
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

      {/* EVENT LOGS SECTION */}
      <div className="w-full space-y-4 pt-6 border-t border-slate-800/50">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-bold text-white flex items-center gap-2 font-mono">
            <Info size={18} className="text-cyan-400" />
            <span>NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG</span>
          </h3>
          <button
            onClick={fetchAllLogs}
            className="bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-white px-3 py-1.5 rounded-xl border border-slate-850 text-xs font-mono transition-all cursor-pointer"
          >
            Tải lại nhật ký
          </button>
        </div>

        <div className="glass p-6 rounded-2xl border border-slate-800/80 bg-slate-900/10 max-h-96 overflow-y-auto">
          {logs.length > 0 ? (
            <div className="flow-root">
              <ul className="-mb-8">
                {logs.map((log: any, logIdx: number) => (
                  <li key={log._id}>
                    <div className="relative pb-8">
                      {logIdx !== logs.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-800"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center ring-8 ring-slate-900/50">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-slate-200">
                              <span className="text-cyan-405 font-bold font-mono mr-2 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 text-[10px]">
                                {log.eventId?.name || "HỆ THỐNG"}
                              </span>
                              {log.details}{" "}
                              <span className="font-mono text-xs text-slate-500 font-medium">
                                ({log.action})
                              </span>
                            </p>
                            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-2">
                              <span>Thực hiện bởi:</span>
                              <span className="text-cyan-400 font-semibold font-mono">
                                {log.actorId?.fullName || "Hệ thống"}
                              </span>
                              <span>({log.actorId?.email || "N/A"})</span>
                            </p>
                          </div>
                          <div className="text-right text-xs whitespace-nowrap text-slate-500 font-mono">
                            <time dateTime={log.createdAt}>
                              {new Date(log.createdAt).toLocaleString("vi-VN")}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500 font-mono text-sm">
              Chưa có nhật ký hoạt động nào được ghi nhận.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
