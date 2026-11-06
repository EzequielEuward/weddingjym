import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QrGateScreen } from './components/QrGateScreen.js';
import { SessionProvider, useSession } from './context/SessionContext.js';
import { BestOutfitPage } from './pages/BestOutfitPage.js';
import { GalleryPage } from './pages/GalleryPage.js';
import { HomePage } from './pages/HomePage.js';
import { ModeratorPage } from './pages/ModeratorPage.js';
import { SlideshowPage } from './pages/SlideshowPage.js';

function AppRoutes() {
  const { session, loading } = useSession();
  const location = useLocation();

  // Permite acceder siempre a /moderador aunque no haya escaneado el QR físico
  if (!loading && !session.hasGateAccess && location.pathname !== '/moderador') {
    return <QrGateScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/galeria" element={<GalleryPage />} />
      <Route path="/best-outfit" element={<BestOutfitPage />} />
      <Route path="/presentacion" element={<SlideshowPage />} />
      <Route path="/moderador" element={<ModeratorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  );
}
