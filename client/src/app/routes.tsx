import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import ProtectedRoute from '../features/auth/ProtectedRoute';

// Lazy loaded page components for Code-Splitting
const LandingPage = lazy(() => import('../features/landing/LandingPage'));
const Login = lazy(() => import('../features/auth/Login'));
const ForgotPassword = lazy(() => import('../features/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../features/auth/ResetPassword'));
const GuestPortal = lazy(() => import('../features/landing/GuestPortal'));
const TeamArea = lazy(() => import('../features/teams/TeamArea'));
const MyAchievements = lazy(() => import('../features/teams/MyAchievements'));
const ConfirmSurvey = lazy(() => import('../features/teams/ConfirmSurvey'));
const Gallery = lazy(() => import('../features/landing/Gallery'));
const Leaderboard = lazy(() => import('../features/leaderboard/Leaderboard'));

// Admin pages
const AdminLayout = lazy(() => import('../features/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('../features/admin/AdminDashboard'));
const AdminEvents = lazy(() => import('../features/admin/AdminEvents'));
const AdminUsersView = lazy(() => import('../features/admin/AdminUsersView'));
const AdminLiveInteraction = lazy(() => import('../features/admin/AdminLiveInteraction'));
const AdminGradesView = lazy(() => import('../features/admin/AdminGradesView'));

// Expert / Judge / Mentor pages
const ExpertLayout = lazy(() => import('../features/shared/ExpertLayout'));
const ExpertDashboard = lazy(() => import('../features/shared/ExpertDashboard'));
const JudgeProjects = lazy(() => import('../features/judge/JudgeProjects'));
const JudgeScoring = lazy(() => import('../features/judge/JudgeScoring'));
const JudgeTeamActivity = lazy(() => import('../features/judge/JudgeTeamActivity'));
const MentorDashboard = lazy(() => import('../features/mentor/MentorDashboard'));
const MentorTeamDetail = lazy(() => import('../features/mentor/MentorTeamDetail'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
    </div>
  );
}

function RedirectToExpertScore() {
  const { teamId } = useParams();
  const location = useLocation();
  return <Navigate to={`/expert/score/${teamId}${location.search}`} replace />;
}

function RedirectToExpertActivity() {
  const { teamId } = useParams();
  return <Navigate to={`/expert/activity/${teamId}`} replace />;
}

function RedirectToExpertMentorTeam() {
  const { teamId } = useParams();
  return <Navigate to={`/expert/mentored-team/${teamId}`} replace />;
}

interface AppRoutesProps {
  user: any;
  roles: any[];
  handleLoginSuccess: (token: string, loggedUser: any, userRoles: any[]) => void;
  handleLogout: () => void;
}

export default function AppRoutes({ user, roles, handleLoginSuccess, handleLogout }: AppRoutesProps) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={
          user ? (
            (user.isSystemAdmin || roles.some((r: any) => r.role === 'coordinator' || r.role === 'admin_view' || r.role === 'student_assistant')) ? (
              <Navigate to="/admin" />
            ) : (roles.some((r: any) => r.role === 'judge') || roles.some((r: any) => r.role === 'mentor')) ? (
              <Navigate to="/expert/dashboard" />
            ) : (
              <Navigate to="/guest-portal" />
            )
          ) : (
            <LandingPage user={user} roles={roles} />
          )
        } />
        <Route path="/login" element={!user ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute user={user} roles={roles} allowedRoles={['coordinator', 'student_assistant']}>
            <AdminLayout user={user} roles={roles} onLogout={handleLogout} />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="users" element={<AdminUsersView />} />
          <Route path="live" element={<AdminLiveInteraction />} />
          <Route path="grades" element={<AdminGradesView user={user} roles={roles} />} />
          <Route path="leaderboard" element={<Leaderboard user={user} roles={roles} />} />
          <Route path="album" element={<Gallery user={user} roles={roles} />} />
        </Route>
        
        {/* Expert Sub-Routes */}
        <Route path="/expert" element={
          <ProtectedRoute user={user} roles={roles} allowedRoles={['judge', 'mentor']}>
            <ExpertLayout user={user} roles={roles} onLogout={handleLogout} />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ExpertDashboard user={user} roles={roles} />} />
          <Route path="projects" element={<JudgeProjects />} />
          <Route path="score/:teamId" element={<JudgeScoring />} />
          <Route path="activity/:teamId" element={<JudgeTeamActivity />} />
          <Route path="mentored-teams" element={<MentorDashboard user={user} roles={roles} />} />
          <Route path="mentored-team/:teamId" element={<MentorTeamDetail />} />
          <Route path="album" element={<Gallery user={user} roles={roles} />} />
        </Route>

        {/* Fallbacks */}
        <Route path="/judge" element={<Navigate to="/expert/dashboard" replace />} />
        <Route path="/judge/dashboard" element={<Navigate to="/expert/dashboard" replace />} />
        <Route path="/judge/projects" element={<Navigate to="/expert/projects" replace />} />
        <Route path="/judge/score/:teamId" element={<RedirectToExpertScore />} />
        <Route path="/judge/activity/:teamId" element={<RedirectToExpertActivity />} />
        <Route path="/mentor/dashboard" element={<Navigate to="/expert/mentored-teams" replace />} />
        <Route path="/mentor/team/:teamId" element={<RedirectToExpertMentorTeam />} />
        
        <Route path="/leaderboard" element={<Leaderboard user={user} roles={roles} />} />
        <Route path="/album" element={<Gallery user={user} roles={roles} />} />
        <Route path="/confirm-survey" element={<ConfirmSurvey />} />
      </Routes>
    </Suspense>
  );
}
