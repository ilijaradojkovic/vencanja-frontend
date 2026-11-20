import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppDispatch } from './hooks';
import { restoreSession } from '../features/auth/services/auth.service';
import { ToastContainer } from 'react-toastify';

export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return (
    <>
      <Outlet />
      <ToastContainer />
    </>
  );
}
