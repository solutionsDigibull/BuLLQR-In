import { Navigate } from 'react-router-dom';
import { useAdminAccess } from '../context/AdminAccessContext.tsx';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { isAdminUnlocked } = useAdminAccess();

  if (!isAdminUnlocked) {
    return <Navigate to="/scan" replace />;
  }

  return <>{children}</>;
}
