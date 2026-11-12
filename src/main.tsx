import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
// la base va antes que la app, para que la hoja de cada componente pueda ajustarla
import './styles/base.css';
import App from './app/App';
import { startPwa } from './pwa/pwa';
import { startSync } from './sync/sync';
import { UpdateBanner } from './pwa/UpdateBanner';
import { ErrorBoundary } from './ui/ErrorBoundary';

// instalable y sin conexión (el service worker solo se registra en la versión compilada)
startPwa();
// cuenta y sincronización con Supabase (si se ha entrado con una cuenta)
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <UpdateBanner />
    </ErrorBoundary>
  </StrictMode>,
);
