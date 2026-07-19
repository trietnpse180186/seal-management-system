import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  Bell,
  Users
} from 'lucide-react';

interface JudgeLayoutProps {
  user: any;
  roles: any[];
  onLogout: () => void;
}

export default function JudgeLayout({ user, roles = [], onLogout }: JudgeLayoutProps) {
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

  const isActive = (path: string) => location.pathname === path;

  const isMentor = roles?.some((r: any) => r.role === 'mentor');

  const navItems = [
    {
      path: '/judge/dashboard',
      label: 'Bảng điều khiển',
      icon: LayoutDashboard
    },
    {
      path: '/judge/projects',
      label: 'Dự án cần chấm',
      icon: BookOpen
    }
  ];

  if (isMentor) {
    navItems.push({
      path: '/mentor/dashboard',
      label: 'Mentor Dashboard',
      icon: Users
    });
  }


  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex font-sans selection:bg-[#F27024]/30">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-[280px] bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
        {/* User Quick Info */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F27024] to-[#f9823a] text-white flex items-center justify-center font-bold text-base shadow-sm">
            {user?.fullName?.charAt(0) || 'J'}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-bold text-slate-800 truncate">{user?.fullName || 'Judge Name'}</h4>
            <p className="text-xs text-[#F27024] font-semibold mt-0.5 tracking-normal">
              Vai trò: {isMentor ? 'Giám khảo & Mentor' : 'Giám khảo'}
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
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden ${active
                  ? 'bg-[#F27024]/10 text-[#F27024] border border-[#F27024]/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                  }`}
              >
                {active && (
                  <div className="absolute left-0 top-0 h-full w-[3.5px] bg-[#F27024] shadow-[0_0_8px_rgba(242,112,36,0.4)]"></div>
                )}
                <Icon size={18} className={active ? 'text-[#F27024]' : 'text-slate-500'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100/70 border border-rose-200 rounded-xl text-rose-600 text-sm font-bold transition-all shadow-sm"
          >
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 ml-[280px] flex flex-col min-h-screen relative">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>

        {/* TopAppBar */}
        <header className="h-16 w-full px-8 bg-white border-b border-slate-200 flex justify-between items-center z-10 sticky top-0 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-slate-800 text-sm tracking-wider uppercase">
              Hệ thống SEAL Hackathon
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-slate-500 hover:text-[#F27024] transition-colors relative p-2 rounded-full hover:bg-[#F27024]/10"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50">
                  <div className="flex justify-between items-center p-3 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-10">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Thông báo
                    </h4>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-[#F27024] hover:text-[#d95f1f] font-semibold"
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
                          className={`p-3 border-b border-slate-50 cursor-pointer transition-colors ${
                            notif.status === "pending"
                              ? "bg-[#F27024]/5 hover:bg-[#F27024]/10"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <p
                            className={`text-xs font-semibold ${
                              notif.status === "pending"
                                ? "text-[#F27024]"
                                : "text-slate-700"
                            }`}
                          >
                            {notif.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {notif.body}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-2">
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
