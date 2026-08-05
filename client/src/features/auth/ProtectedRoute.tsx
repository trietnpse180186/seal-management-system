import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  user: any;
  roles: any[];
  allowedRoles?: string[];
  children: ReactNode;
}

export default function ProtectedRoute({
  user,
  roles,
  allowedRoles,
  children
}: ProtectedRouteProps) {
  // If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If role restrictions are specified, check if user satisfies at least one
  if (allowedRoles && allowedRoles.length > 0) {
    const isSystemAdmin = user.isSystemAdmin;
    const isCoordinator = isSystemAdmin;
    const isAdminView = roles.some(r => r.role === 'admin_view');
    const isJudge = roles.some(r => r.role === 'judge') || isSystemAdmin;
    const isMentor = roles.some(r => r.role === 'mentor') || isSystemAdmin;
    
    const hasAllowedRole = allowedRoles.some(allowedRole => {
      if (allowedRole === 'coordinator') return isCoordinator || isAdminView;
      if (allowedRole === 'admin_view') return isAdminView || isSystemAdmin;
      if (allowedRole === 'judge') return isJudge;
      if (allowedRole === 'mentor') return isMentor;
      if (allowedRole === 'participant') {
        return roles.some(r => r.role === 'participant') || (!isSystemAdmin && !isCoordinator && !isAdminView && !isJudge && !isMentor);
      }
      return roles.some(r => r.role === allowedRole);
    });

    // If no permission, redirect to landing page
    if (!hasAllowedRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
