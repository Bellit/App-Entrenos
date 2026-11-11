import { useEffect, useState, useSyncExternalStore } from 'react';
import { useStore } from '../store';

/**
 * Modo «presentar» cuando el navegador no tiene pantalla completa (Safari en iPhone): la app oculta
 * igualmente todo menos la pista y la reproducción, aunque la barra del navegador siga a la vista.
 */
let pseudo = false;
const listeners = new Set<() => void>();
const setPseudo = (v: boolean) => {
  pseudo = v;
  listeners.forEach((l) => l());
};
const usePseudo = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pseudo,
  );

/** Si el navegador permite poner la página a pantalla completa. */
const canFullscreen = () => typeof document !== 'undefined' && !!document.fullscreenEnabled && !!document.documentElement.requestFullscreen;

/** Pantalla completa de la app (para enseñar la jugada): solo pista y reproducción. */
export function toggleFullscreen() {
  if (pseudo) return setPseudo(false);
  if (document.fullscreenElement) return void document.exitFullscreen().catch(() => {});
  if (!canFullscreen()) return setPseudo(true);
  // si el navegador la rechaza, se usa el modo propio
  document.documentElement.requestFullscreen().catch(() => {
    setPseudo(true);
    useStore.getState().notify('Este navegador no permite la pantalla completa: se ocultan los controles.');
  });
}

/** Sale del modo presentar (Esc en el teclado; la pantalla completa real ya sale sola con Esc). */
export const exitPresenting = () => setPseudo(false);

/** true mientras la app está en pantalla completa o en el modo presentar propio. */
export function useFullscreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const presentingWithoutFullscreen = usePseudo();
  return on || presentingWithoutFullscreen;
}
