import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'cashier' | 'manager' | 'admin';
  blockedRoles?: ('cashier' | 'manager' | 'admin')[];
}

export default function ProtectedRoute({
  children,
  requiredRole,
  blockedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="login" replace />;
  }

  // Check if user's role is blocked
  if (blockedRoles && user && blockedRoles.includes(user.role)) {
    return <Navigate to="sales" replace />;
  }

  if (requiredRole && user && user.role !== requiredRole) {
    // Check role hierarchy: admin > manager > cashier
    const roleHierarchy: Record<string, number> = {
      cashier: 1,
      manager: 2,
      admin: 3,
    };

    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      // Redirect cashiers to sales page instead of dashboard
      const redirectPath = user.role === 'cashier' ? 'sales' : 'dashboard';
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
}

