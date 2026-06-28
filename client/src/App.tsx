import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Navbar from './features/landing/Navbar';
import Footer from './features/landing/Footer';
import Login from './features/auth/Login';
import LandingPage from './features/landing/LandingPage';
import AdminDashboard from './features/admin/AdminDashboard';
import AdminEvents from './features/admin/AdminEvents';
import TeamArea from './features/teams/TeamArea';
import MyAchievements from './features/teams/MyAchievements';
import Leaderboard from './features/leaderboard/Leaderboard';
import ProtectedRoute from './features/auth/ProtectedRoute';
import GuestPortal from './features/landing/GuestPortal';
import JudgeLayout from './features/judge/JudgeLayout';
import JudgeDashboard from './features/judge/JudgeDashboard';
import JudgeProjects from './features/judge/JudgeProjects';
import JudgeScoring from './features/judge/JudgeScoring';
import JudgeTeamActivity from './features/judge/JudgeTeamActivity';
import AdminGradesView from './features/admin/AdminGradesView';
import AdminUsersView from './features/admin/AdminUsersView';
import AdminLayout from './features/admin/AdminLayout';
import MentorDashboard from './features/mentor/MentorDashboard';
import MentorTeamDetail from './features/mentor/MentorTeamDetail';
import MentorChat from './features/mentor/MentorChat';
import { Toaster } from 'sonner';
import { ConfirmProvider } from './features/shared/ConfirmDialog';

function AppContent({ user, roles, handleLoginSuccess, handleLogout }: any) {
  const location = useLocation();
  const isJudgeRoute = location.pathname.startsWith('/judge');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isCoordinator = user?.isSystemAdmin || roles?.some((r: any) => r.role === 'coordinator');
  const showChatWidget = user && !isJudgeRoute && (!isAdminRoute || isCoordinator);

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {!isJudgeRoute && !isAdminRoute && <Navbar user={user} roles={roles} onLogout={handleLogout} />}
      
      <main className="flex-1">
        <Routes>
          <Route path="/" element={
            user ? (
              user.isSystemAdmin || roles.some((r: any) => r.role === 'coordinator') ? (
                <Navigate to="/admin" />
              ) : roles.some((r: any) => r.role === 'judge') ? (
                <Navigate to="/judge/dashboard" />
              ) : roles.some((r: any) => r.role === 'mentor') ? (
                <Navigate to="/mentor/dashboard" />
              ) : (
                <Navigate to="/guest-portal" />
              )
            ) : (
              <LandingPage user={user} roles={roles} />
            )
          } />
          <Route path="/login" element={!user ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/" />} />
          
          <Route path="/register-team" element={<Navigate to="/team-area" replace />} />

          <Route path="/guest-portal" element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={['participant']}>
              <GuestPortal user={user} />
            </ProtectedRoute>
          } />
          
          <Route path="/team-area" element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={['participant']}>
              <TeamArea />
            </ProtectedRoute>
          } />
          
          <Route path="/my-achievements" element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={['participant']}>
              <MyAchievements />
            </ProtectedRoute>
          } />
          
          {/* Admin Routes under AdminLayout */}
          <Route path="/admin" element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={['coordinator']}>
              <AdminLayout user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="users" element={<AdminUsersView />} />
            <Route path="grades" element={<AdminGradesView />} />
            <Route path="leaderboard" element={<Leaderboard user={user} roles={roles} />} />
          </Route>
          
          {/* Judge Sub-Routes under JudgeLayout */}
          <Route path="/judge" element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={['judge']}>
              <JudgeLayout user={user} roles={roles} onLogout={handleLogout} />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<JudgeDashboard />} />
            <Route path="projects" element={<JudgeProjects />} />
            <Route path="score/:teamId" element={<JudgeScoring />} />
            <Route path="activity/:teamId" element={<JudgeTeamActivity />} />
          </Route>
          
          {/* Mentor Routes */}
          <Route path="/mentor/dashboard" element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={['mentor']}>
              <MentorDashboard user={user} roles={roles} />
            </ProtectedRoute>
          } />
          
          <Route path="/mentor/team/:teamId" element={
            <ProtectedRoute user={user} roles={roles} allowedRoles={['mentor']}>
              <MentorTeamDetail />
            </ProtectedRoute>
          } />
          
          <Route path="/leaderboard" element={<Leaderboard user={user} roles={roles} />} />
        </Routes>
      </main>

      {!isJudgeRoute && !isAdminRoute && <Footer />}
      
      {showChatWidget && (
        <MentorChat roles={roles} isSystemAdmin={!!user?.isSystemAdmin} />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);

  const fetchProfile = async (token: string) => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data.user);
      setRoles(res.data.roles || []);
    } catch (err) {
      console.error('Profile fetch failed:', err);
      localStorage.removeItem('token');
      setUser(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  // 1. Single tab detection
  useEffect(() => {
    let tabId = sessionStorage.getItem('tab_id');
    if (!tabId) {
      tabId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem('tab_id', tabId);
    }

    const checkDuplicateTab = () => {
      const activeTabId = localStorage.getItem('active_tab_id');
      const activeTabTimestamp = localStorage.getItem('active_tab_timestamp');
      const now = Date.now();

      if (activeTabId && activeTabId !== tabId && activeTabTimestamp) {
        const timeDiff = now - parseInt(activeTabTimestamp, 10);
        if (timeDiff < 3000) {
          setIsDuplicateTab(true);
          return true;
        }
      }

      localStorage.setItem('active_tab_id', tabId!);
      localStorage.setItem('active_tab_timestamp', now.toString());
      setIsDuplicateTab(false);
      return false;
    };

    const isDup = checkDuplicateTab();

    let heartbeatInterval: any = null;
    if (!isDup) {
      heartbeatInterval = setInterval(() => {
        const activeTabId = localStorage.getItem('active_tab_id');
        if (activeTabId && activeTabId !== tabId) {
          const activeTabTimestamp = localStorage.getItem('active_tab_timestamp');
          if (activeTabTimestamp && Date.now() - parseInt(activeTabTimestamp, 10) < 3000) {
            setIsDuplicateTab(true);
            clearInterval(heartbeatInterval);
            return;
          }
        }
        localStorage.setItem('active_tab_id', tabId!);
        localStorage.setItem('active_tab_timestamp', Date.now().toString());
      }, 1000);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'active_tab_timestamp' || e.key === 'active_tab_id') {
        const activeTabId = localStorage.getItem('active_tab_id');
        const activeTabTimestamp = localStorage.getItem('active_tab_timestamp');
        const now = Date.now();
        if (activeTabId && activeTabId !== tabId && activeTabTimestamp) {
          if (now - parseInt(activeTabTimestamp, 10) < 3000) {
            setIsDuplicateTab(true);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const handleUnload = () => {
      const activeTabId = localStorage.getItem('active_tab_id');
      if (activeTabId === tabId) {
        localStorage.removeItem('active_tab_id');
        localStorage.removeItem('active_tab_timestamp');
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // 2. Fetch profile on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, []);

  // 3. Axios Interceptor for Session Expiration (Multi-device login)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401 && error.response.data?.isSessionExpired) {
          // Local logout
          localStorage.removeItem('token');
          setUser(null);
          setRoles([]);
          window.location.href = '/login?expired=true';
        } else if (error.response && error.response.status === 403 && (error.response.data?.isDeactivated || error.response.data?.message?.includes('khóa'))) {
          // Locked user auto logout
          localStorage.removeItem('token');
          setUser(null);
          setRoles([]);
          window.location.href = '/login?locked=true';
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // 4. Periodic API heartbeat when user is logged in
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const interval = setInterval(async () => {
      try {
        await axios.post('http://localhost:5000/api/auth/heartbeat', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Session heartbeat failed:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  const handleLoginSuccess = (token: string, loggedUser: any, userRoles: any[]) => {
    localStorage.setItem('token', token);
    setUser(loggedUser);
    setRoles(userRoles || []);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await axios.post('http://localhost:5000/api/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to notify backend of logout:', err);
      }
    }
    localStorage.removeItem('token');
    setUser(null);
    setRoles([]);
  };

  if (isDuplicateTab) {
    return (
      <div className="min-h-screen bg-[#060a0f] flex items-center justify-center p-4 font-mono text-slate-200">
        <div className="max-w-md w-full glass border border-rose-500/30 p-8 rounded-2xl text-center relative overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.1)]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-amber-500 animate-pulse"></div>
          
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h1 className="text-xl font-bold uppercase tracking-widest text-rose-500 mb-2 font-mono">
            Cảnh báo kết nối
          </h1>
          <p className="text-xs text-rose-300/80 mb-6 uppercase tracking-wider font-semibold">
            Duplicate Session Detected
          </p>
          
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl text-left text-xs space-y-3 mb-6 text-slate-400 font-sans leading-relaxed">
            <p>
              Hệ thống phát hiện ứng dụng SEAL Hackathon đang được mở ở một tab hoặc cửa sổ khác trên trình duyệt này.
            </p>
            <p className="font-semibold text-slate-300">
              Để tránh xung đột dữ liệu và bảo vệ phiên làm việc của bạn:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Vui lòng đóng các tab khác đang chạy ứng dụng này.</li>
              <li>Tải lại trang (F5) trên tab này để tiếp tục sử dụng.</li>
            </ul>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded bg-rose-950/40 border border-rose-500/50 hover:bg-rose-500 hover:text-white transition-all duration-300 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.1)] active:scale-95 text-rose-300"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-cyan-400 text-lg font-semibold animate-pulse">Đang tải Nền tảng SEAL Hackathon...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ConfirmProvider>
        <AppContent 
          user={user} 
          roles={roles} 
          handleLoginSuccess={handleLoginSuccess} 
          handleLogout={handleLogout} 
        />
        <Toaster position="top-right" theme="dark" closeButton richColors />
      </ConfirmProvider>
    </BrowserRouter>
  );
}
