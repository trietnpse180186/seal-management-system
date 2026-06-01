import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import {
  LogOut,
  Award,
  Users,
  ShieldAlert,
  GitBranch,
  BarChart2,
  Bell,
  Compass,
  Settings2,
} from "lucide-react";
import logo from "../assets/logo.svg";

interface NavbarProps {
  user: any;
  roles: any[];
  onLogout: () => void;
}

export default function Navbar({ user, roles, onLogout }: NavbarProps) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      const fetchNotifications = async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get(
            "http://localhost:5000/api/notifications",
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          setNotifications(res.data);
        } catch (err) {
          console.error("Failed to fetch notifications", err);
        }
      };
      fetchNotifications();
      // Optional: Polling every 30s
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const unreadCount = notifications.filter(
    (n) => n.status === "pending",
  ).length;

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/notifications/${id}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setNotifications(
        notifications.map((n) => (n._id === id ? { ...n, status: "sent" } : n)),
      );
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        "http://localhost:5000/api/notifications/read-all",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setNotifications(notifications.map((n) => ({ ...n, status: "sent" })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const isSystemAdmin = user?.isSystemAdmin;
  const isCoordinator =
    roles?.some((r) => r.role === "coordinator") || isSystemAdmin;
  const isJudge = roles?.some((r) => r.role === "judge") || isSystemAdmin;
  const isParticipant =
    roles?.some((r) => r.role === "participant") ||
    (!isSystemAdmin && !isCoordinator && !isJudge);

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) => `
    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
    ${
      isActive(path)
        ? "bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]"
        : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
    }
  `;

  return (
    <nav className="glass-nav sticky top-0 z-50 w-full px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src={logo}
            alt="SEAL Logo"
            className="h-10 w-10 group-hover:scale-105 transition-transform duration-300 logo-glow"
          />
          <div>
            <span className="font-extrabold text-lg tracking-wider text-gradient-purple-blue">
              SEAL
            </span>
            <span className="font-semibold text-xs ml-1 bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
              HACKATHON
            </span>
          </div>
        </Link>

        {/* Navigation Items */}
        {user && (
          <div className="hidden md:flex items-center gap-2">
            {/* Participant Links */}
            {isParticipant && (
              <>
                <Link to="/guest-portal" className={linkClass("/guest-portal")}>
                  <Compass size={16} />
                  <span>Trang chủ</span>
                </Link>
                <Link
                  to="/register-team"
                  className={linkClass("/register-team")}
                >
                  <Users size={16} />
                  <span>Đăng ký đội</span>
                </Link>
                <Link to="/team-area" className={linkClass("/team-area")}>
                  <GitBranch size={16} />
                  <span>Khu vực đội thi</span>
                </Link>
              </>
            )}

            {/* Coordinator/Admin Links */}
            {isCoordinator && (
              <>
                <Link to="/admin" className={linkClass("/admin")}>
                  <ShieldAlert size={16} />
                  <span>Quản trị viên</span>
                </Link>
                <Link to="/admin/events" className={linkClass("/admin/events")}>
                  <Settings2 size={16} />
                  <span>Thiết lập sự kiện</span>
                </Link>
              </>
            )}

            {/* Judge Links */}
            {isJudge && !isCoordinator && (
              <Link to="/judge/dashboard" className={linkClass("/judge/dashboard")}>
                <Award size={16} />
                <span>Bàn chấm điểm</span>
              </Link>
            )}

            {/* General Links */}
            <Link to="/leaderboard" className={linkClass("/leaderboard")}>
              <BarChart2 size={16} />
              <span>Bảng xếp hạng</span>
            </Link>
          </div>
        )}

        {/* User Info & Actions */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent transition-all duration-200"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-slate-900"></span>
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50">
                    <div className="flex justify-between items-center p-3 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                      <h4 className="text-sm font-semibold text-white">
                        Thông báo
                      </h4>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          Đánh dấu đã đọc
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Chưa có thông báo nào.
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif._id}
                            onClick={() => {
                              if (notif.status === "pending")
                                markAsRead(notif._id);
                            }}
                            className={`p-3 border-b border-slate-800/50 cursor-pointer transition-colors ${notif.status === "pending" ? "bg-indigo-900/20 hover:bg-indigo-900/30" : "hover:bg-slate-800/50"}`}
                          >
                            <p
                              className={`text-xs font-semibold ${notif.status === "pending" ? "text-indigo-300" : "text-slate-300"}`}
                            >
                              {notif.title}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {notif.body}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-2">
                              {new Date(notif.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-200">
                  {user.fullName}
                </p>
                <p className="text-xs text-slate-400">
                  {isSystemAdmin
                    ? "Quản trị viên Hệ thống"
                    : roles[0]?.role
                      ? roles[0].role === "coordinator"
                        ? "Ban tổ chức"
                        : roles[0].role === "judge"
                          ? "Giám khảo"
                          : "Thí sinh"
                      : "Thí sinh"}
                </p>
              </div>

              <div className="h-9 w-9 rounded-full bg-gradient-premium flex items-center justify-center text-white text-sm font-bold shadow-md border border-white/10">
                {user.fullName.charAt(0)}
              </div>

              <button
                onClick={onLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-200"
                title="Đăng xuất"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            !isLoginPage && (
              <Link
                to="/login"
                className="btn-primary text-xs font-bold uppercase tracking-wider px-5 py-2.5 flex items-center justify-center"
              >
                Đăng nhập
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
