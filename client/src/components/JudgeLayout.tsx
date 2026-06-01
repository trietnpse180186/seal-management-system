import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Trophy, 
  LogOut, 
  Bell,
  Award
} from 'lucide-react';

interface JudgeLayoutProps {
  user: any;
  roles: any[];
  onLogout: () => void;
}

export default function JudgeLayout({ user, onLogout }: JudgeLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    {
      path: '/judge/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      path: '/judge/projects',
      label: 'Projects to Grade',
      icon: BookOpen
    },
    {
      path: '/leaderboard',
      label: 'Leaderboard',
      icon: Trophy
    }
  ];

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-[280px] bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-200 flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full border border-blue-200 flex items-center justify-center text-blue-600 mb-3 shadow-inner">
            <Award size={32} />
          </div>
          <h2 className="font-extrabold text-slate-800 text-lg tracking-wider">SEAL Adjudicator</h2>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-1">Hackathon Edition</p>
        </div>

        {/* User Quick Info */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow">
            {user?.fullName?.charAt(0) || 'J'}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-bold text-slate-800 truncate">{user?.fullName || 'Judge Name'}</h4>
            <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Vai trò: Giám khảo</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-6 space-y-1 overflow-y-auto px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                  active
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} className={active ? 'text-blue-600' : 'text-slate-400'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 rounded-lg text-rose-600 text-xs font-bold uppercase tracking-wider transition-all"
          >
            <LogOut size={14} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 ml-[280px] flex flex-col min-h-screen">
        {/* TopAppBar */}
        <header className="h-16 w-full px-8 bg-white border-b border-slate-200 flex justify-between items-center z-10 sticky top-0 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-blue-600 text-sm tracking-widest uppercase">
              Hệ thống SEAL Hackathon
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button className="text-slate-400 hover:text-slate-600 transition-colors relative p-1.5 rounded-full hover:bg-slate-50">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
              <span className="text-xs font-bold text-slate-700">{user?.fullName}</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shadow-sm">
                {user?.fullName?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 p-8 bg-[#F8FAFC]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
