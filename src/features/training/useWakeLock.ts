import { useEffect, useState } from 'react';

export type WakeState = 'on' | 'off' | 'unsupported';

/**
 * Pantalla siempre encendida mientras se está en el modo entreno (Screen Wake Lock API).
 * - El navegador la suelta él solo al cambiar de app o bloquear el móvil; al volver a la página
 *   (`visibilitychange`) se pide otra vez.
 * - Al salir del modo entreno se suelta, para no gastar batería.
 * - Funciona en Chrome, Edge y Safari recientes (iPhone con iOS 16.4 o posterior); donde no existe
 *   se indica para que se sepa que la pantalla puede apagarse.
 */
export function useWakeLock(): WakeState {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [state, setState] = useState<WakeState>(supported ? 'off' : 'unsupported');

  useEffect(() => {
    if (!supported) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (!alive) return void lock.release();
        setState('on');
        lock.addEventListener('release', () => alive && setState('off'));
      } catch {
        setState('off'); // p. ej. modo ahorro de batería
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && void request();
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [supported]);

  return state;
}
