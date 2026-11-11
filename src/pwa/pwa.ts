import { useSyncExternalStore } from 'react';

/**
 * La parte de la PWA que vive en la página:
 * - registra el service worker (solo en la versión compilada: en desarrollo molestaría, porque
 *   guardaría en caché el código que estamos cambiando);
 * - detecta cuándo hay una versión nueva esperando, para ofrecer «Actualizar»;
 * - guarda el aviso de instalación del navegador (Chrome, Edge, Android) para ofrecer «Instalar la app».
 *   Safari no tiene ese aviso: allí se instala con Compartir → «Añadir a pantalla de inicio».
 * Las pantallas lo leen con el hook `usePwa()`.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let registration: ServiceWorkerRegistration | null = null;
let state = { updateReady: false, canInstall: false };
let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = (patch: Partial<typeof state>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

/** ¿Se está usando ya como app instalada (sin barra del navegador)? */
export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function startPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // en vez del aviso del navegador, lo ofrecemos nosotros en el menú
    installEvent = e as InstallPromptEvent;
    emit({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    emit({ canInstall: false });
  });

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        registration = reg;
        const check = () => reg.waiting && navigator.serviceWorker.controller && emit({ updateReady: true });
        check();
        reg.addEventListener('updatefound', () => {
          reg.installing?.addEventListener('statechange', check);
        });
        // al volver a la app (p. ej. al día siguiente) se mira si hay versión nueva
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void reg.update().catch(() => {}));
      })
      .catch(() => {
        /* sin service worker la app sigue funcionando, solo que no sin conexión */
      });
    // cuando la versión nueva toma el relevo, se recarga una sola vez
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
}

/** Pasa a la versión nueva (la página se recargará). */
export function applyUpdate() {
  registration?.waiting?.postMessage('SKIP_WAITING');
}

/** Muestra el aviso de instalación del navegador. */
export async function installApp() {
  if (!installEvent) return;
  await installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  emit({ canInstall: false });
}

export function usePwa() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
