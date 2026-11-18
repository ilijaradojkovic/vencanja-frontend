import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import AppLayout from '../AppLayout';
import { PageLoading } from '../ui';

/** Pušta dalje samo prijavljenog korisnika (mladence); ostale šalje na /login */
export default function ProtectedRoute() {
  const { user, restored } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!restored) return <PageLoading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <AppLayout />;
}
