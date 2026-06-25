import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
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
  MessageSquare,
} from "lucide-react";

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
  const [isScrolled, setIsScrolled] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0.08, start);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      const now = audioCtx.currentTime;
      playTone(783.99, now, 0.12);
      playTone(1046.50, now + 0.08, 0.20);
    } catch (error) {
      console.warn("AudioContext failed to play sound:", error);
    }
  };

  const showDesktopNotification = (notif: any) => {
    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      document.hidden
    ) {
      try {
        new Notification(notif.title, {
          body: notif.body,
          icon: "/favicon.ico",
        });
      } catch (err) {
        console.warn("Failed to create desktop notification:", err);
      }
    }
  };

  useEffect(() => {
    if (user) {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

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
      // Polling every 15s as fallback
      const interval = setInterval(fetchNotifications, 15000);

      // Real-time: connect socket to receive instant push notifications
      const token = localStorage.getItem("token");
      if (token) {
        const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const sock = io(socketUrl, { query: { token } });
        socketRef.current = sock;
        sock.on("new_notification", (notif: any) => {
          setNotifications((prev) => [notif, ...prev]);

          // Suppress alert/toast/sound if the user is already actively viewing this chat room
          const activeRoomId = (window as any).activeChatRoomId;
          const notifRoomId = notif.metadata?.roomId;
          if (
            activeRoomId &&
            notifRoomId &&
            activeRoomId.toString() === notifRoomId.toString()
          ) {
            return;
          }

          playNotificationSound();
          toast(notif.title, {
            description: notif.body,
            duration: 5000,
          });
          showDesktopNotification(notif);
        });
      }

      return () => {
        clearInterval(interval);
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    }
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
      setNotifications(prev =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
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
      setNotifications(prev => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const isSystemAdmin = user?.isSystemAdmin;
  const isCoordinator = roles?.some((r) => r.role === "coordinator") || isSystemAdmin;
  const isJudge = roles?.some((r) => r.role === "judge") || isSystemAdmin;
  const isMentor = roles?.some((r) => r.role === "mentor");
  const isParticipant =
    roles?.some((r) => r.role === "participant") ||
    (!isSystemAdmin && !isCoordinator && !isJudge && !isMentor);

  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    if (user && isParticipant) {
      const checkTeamStatus = async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get("http://localhost:5000/api/teams/my-team", {
            headers: { Authorization: `Bearer ${token}` }
          });
          setHasTeam(!!res.data.team);
        } catch (err) {
          setHasTeam(false);
        }
      };
      checkTeamStatus();
    } else {
      setHasTeam(false);
    }
  }, [user, roles, isParticipant]);

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) => `
    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 font-mono
    ${isActive(path)
      ? "bg-cyan-600/30 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]"
      : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
    }
  `;

  const isLandingPage = location.pathname === "/";

  const navClass = isLandingPage
    ? isScrolled
      ? "fixed top-0 left-0 w-full z-50 px-6 py-3 glass-nav transition-all duration-300"
      : "absolute top-0 left-0 w-full z-50 px-6 py-4 bg-transparent border-b-transparent shadow-none transition-all duration-300"
    : "glass-nav sticky top-0 z-50 w-full px-6 py-4";

  return (
    <nav className={navClass}>
      <div className="w-full flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex-1 flex justify-start">
          <Link to="/" className="flex items-center gap-2 group">
            <div>
              <span className="font-extrabold text-lg tracking-wider text-cyan-400 text-cyan-glow font-mono-tech">
                SEAL
              </span>
              <span className="font-semibold text-xs ml-1 bg-slate-800 text-white px-2 py-0.5 font-mono-tech">
                HACKATHON
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        {user && (
          <div className="hidden md:flex items-center gap-2 justify-center">
            {/* Participant Links */}
            {isParticipant && (
              <>
                <Link to="/guest-portal" className={linkClass("/guest-portal")}>
                  <Compass size={16} />
                  <span>Trang chủ</span>
                </Link>
                {!hasTeam && (
                  <Link
                    to="/register-team"
                    className={linkClass("/register-team")}
                  >
                    <Users size={16} />
                    <span>Đăng ký đội</span>
                  </Link>
                )}
                {hasTeam && (
                  <Link to="/team-area" className={linkClass("/team-area")}>
                    <GitBranch size={16} />
                    <span>Khu vực đội thi</span>
                  </Link>
                )}
                <Link to="/my-achievements" className={linkClass("/my-achievements")}>
                  <Award size={16} />
                  <span>Thành tích của tôi</span>
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
                <Link to="/admin/grades" className={linkClass("/admin/grades")}>
                  <Award size={16} />
                  <span>Xem chi tiết điểm</span>
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

            {/* Mentor Links */}
            {isMentor && !isCoordinator && !isJudge && (
              <Link to="/mentor/dashboard" className={linkClass("/mentor/dashboard")}>
                <Users size={16} />
                <span>Mentor Dashboard</span>
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
        <div className="flex-1 flex justify-end">
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Notification Bell */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent transition-all duration-200"
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
                            className="text-xs text-cyan-400 hover:text-cyan-300"
                          >
                            Đánh dấu đã đọc
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                            <Bell size={24} className="text-slate-700" />
                            Chưa có thông báo nào.
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif._id}
                              onClick={() => {
                                if (!notif.isRead) markAsRead(notif._id);
                              }}
                              className={`p-3 border-b border-slate-800/50 cursor-pointer transition-colors flex gap-3 items-start ${
                                !notif.isRead
                                  ? "bg-cyan-950/20 hover:bg-cyan-950/30"
                                  : "hover:bg-slate-800/50"
                              }`}
                            >
                              <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                                notif.type === 'chat_message'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-cyan-500/20 text-cyan-400'
                              }`}>
                                {notif.type === 'chat_message'
                                  ? <MessageSquare size={14} />
                                  : <Bell size={14} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold truncate ${
                                  !notif.isRead ? "text-cyan-300" : "text-slate-300"
                                }`}>
                                  {notif.title}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                  {notif.body}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1.5">
                                  {new Date(notif.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </p>
                              </div>
                              {!notif.isRead && (
                                <div className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-right hidden sm:block font-mono">
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
                            : roles[0].role === "mentor"
                              ? "Mentor"
                              : "Thí sinh"
                        : "Thí sinh"}
                  </p>
                </div>

                <div className="h-9 w-9 rounded-full bg-cyan-950/50 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-sm font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] font-mono">
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
      </div>
    </nav>
  );
}
