import { Routes, Route } from 'react-router-dom';

import App from '../app';
import ProtectedRoute from '../../components/navigation/protected-route';
import LandingPage from '../../features/common/pages/landing.page';
import NotFoundPage from '../../features/common/pages/not-found.page';
import LoginPage from '../../features/auth/pages/login.page';
import RegisterPage from '../../features/auth/pages/register.page';
import GuestInvitationPage from '../../features/invite/pages/guest-invitation.page';
import GuestUploadPage from '../../features/invite/pages/guest-upload.page';
import InvitationEditorPage from '../../features/invite/pages/invitation-editor.page';
import DashboardPage from '../../features/dashboard/pages/dashboard.page';
import GuestsPage from '../../features/guests/pages/guests.page';
import PhotosPage from '../../features/photos/pages/photos.page';
import BigAlbumPage from '../../features/big-album/pages/big-album.page';
import DesignRequestsPage from '../../features/requests/pages/design-requests.page';
import SettingsPage from '../../features/wedding/pages/settings.page';

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        {/* PUBLIC */}
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="registracija" element={<RegisterPage />} />

        {/* gost – lični link */}
        <Route path="i/:token" element={<GuestInvitationPage />} />
        <Route path="i/:token/upload" element={<GuestUploadPage />} />
        {/* opšti link venčanja (QR kod na stolovima) */}
        <Route path="w/:slug/upload" element={<GuestUploadPage />} />

        {/* PROTECTED – mladenci */}
        <Route path="app" element={<ProtectedRoute />}>
          <Route index element={<DashboardPage />} />
          <Route path="gosti" element={<GuestsPage />} />
          <Route path="pozivnica" element={<InvitationEditorPage />} />
          <Route path="fotografije" element={<PhotosPage />} />
          <Route path="veliki-album" element={<BigAlbumPage />} />
          <Route path="custom-dizajn" element={<DesignRequestsPage />} />
          <Route path="podesavanja" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
