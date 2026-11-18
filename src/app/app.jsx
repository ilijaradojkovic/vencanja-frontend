import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppDispatch } from './hooks';
import { restoreSession } from '../features/auth/services/auth.service';
import { Toasts } from '../components/ui';

/** Koren aplikacije – vraća sesiju iz localStorage-a i prikazuje toast poruke */
export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return (
    <>
      <Outlet />
      <Toasts />
    </>
  );
}
