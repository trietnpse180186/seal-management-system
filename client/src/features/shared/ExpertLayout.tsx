import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  Bell,
  Home,
  Users
} from 'lucide-react';

interface ExpertLayoutProps {
  user: any;
  roles: any[];
  onLogout: () => void;
}

export default function ExpertLayout({ user, roles = [], onLogout }: ExpertLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

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
            }
          );
          setNotifications(res.data);
        } catch (err) {
          console.error("Failed to fetch notifications", err);
        }
      };
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 120000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const unreadCount = notifications.filter(
    (n) => n.status === "pending"
  ).length;

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/notifications/${id}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setNotifications(
        notifications.map((n) => (n._id === id ? { ...n, status: "sent" } : n))
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
        }
      );
      setNotifications(notifications.map((n) => ({ ...n, status: "sent" })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const isActive = (path: string) => {
    if (path === '/expert/dashboard') {
      return location.pathname === '/expert/dashboard' || location.pathname === '/expert';
    }
    return location.pathname.startsWith(path);
  };

  const isSystemAdmin = user?.isSystemAdmin;
  const isJudge = roles?.some((r: any) => r.role === 'judge') || isSystemAdmin;
  const isMentor = roles?.some((r: any) => r.role === 'mentor') || isSystemAdmin;

  const navItems = [
    {
      path: '/expert/dashboard',
      label: 'Bảng điều khiển',
      icon: LayoutDashboard
    }
  ];

  if (isJudge) {
    navItems.push({
      path: '/expert/projects',
      label: 'Dự án cần chấm',
      icon: BookOpen
    });
  }

  if (isMentor) {
    navItems.push({
      path: '/expert/mentored-teams',
      label: 'Đội hướng dẫn',
      icon: Users
    });
  }

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#070d1f] text-slate-300 flex font-sans selection:bg-cyan-500/30">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-[280px] bg-slate-900/40 backdrop-blur-2xl border-r border-white/5 flex flex-col z-20 shadow-2xl">
        {/* User Quick Info */}
        <div className="px-6 py-3 border-b border-white/5 flex items-center gap-3 bg-slate-900/20">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-[0_0_10px_rgba(6,182,212,0.4)]">
            {user?.fullName?.charAt(0) || 'E'}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-bold text-white truncate">{user?.fullName || 'Expert Name'}</h4>
            <p className="text-[9px] text-cyan-400 font-mono uppercase tracking-wider">
              {isJudge && isMentor ? 'Giám khảo & Mentor' : isJudge ? 'Giám khảo' : 'Mentor'}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-6 space-y-2 overflow-y-auto px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 relative overflow-hidden ${active
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 border border-transparent hover:border-white/5'
                  }`}
              >
                {active && (
                  <div className="absolute left-0 top-0 h-full w-[3px] bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                )}
                <Icon size={16} className={active ? 'text-cyan-400' : 'text-slate-500'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 bg-slate-900/10 space-y-2">
          <Link
            to="/guest-portal"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-slate-300 text-xs font-bold uppercase tracking-wider transition-all"
          >
            <Home size={14} />
            <span>Về trang chủ</span>
          </Link>
          
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 hover:text-rose-300 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(244,63,94,0.1)] hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]"
          >
            <LogOut size={14} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 ml-[280px] flex flex-col min-h-screen relative">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>

        {/* TopAppBar */}
        <header className="h-16 w-full px-8 bg-slate-950/60 backdrop-blur-xl border-b border-white/5 flex justify-between items-center z-10 sticky top-0 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-cyan-300 text-sm tracking-widest uppercase drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
              Hệ thống SEAL Hackathon
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-slate-400 hover:text-cyan-300 transition-colors relative p-1.5 rounded-full hover:bg-cyan-500/10"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] z-50">
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
                          className={`p-3 border-b border-slate-800/50 cursor-pointer transition-colors ${notif.status === "pending" ? "bg-cyan-950/20 hover:bg-cyan-950/30" : "hover:bg-slate-800/50"}`}
                        >
                          <p
                            className={`text-xs font-semibold ${notif.status === "pending" ? "text-cyan-300" : "text-slate-300"}`}
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
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 p-8 relative z-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
