import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { UserRole } from '../../app/config/enums';
import AdminLayout from '../AdminLayout';
import { PageLoading } from '../ui';

export default function AdminRoute() {
  const { user, restored } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!restored) return <PageLoading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== UserRole.SUPERADMIN) return <Navigate to="/app" replace />;
  return <AdminLayout />;
}
