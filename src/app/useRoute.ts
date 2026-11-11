import { useSyncExternalStore } from 'react';

/**
 * Enrutado mínimo con el «hash» de la dirección (lo que va después de #).
 *   #/                    → lista de sesiones (la portada)
 *   #/sesion/<id>         → una sesión
 *   #/ejercicios          → biblioteca de ejercicios
 *   #/ejercicio/<id>      → editor de un ejercicio
 * Se usa el hash y no rutas normales porque la app es una web estática: no hace falta configurar
 * el servidor para que cualquier dirección devuelva la misma página.
 */
export type Route = { name: 'sessions' } | { name: 'session'; id: string } | { name: 'library' } | { name: 'exercise'; id: string };

export function parseRoute(hash: string): Route {
  if (hash === '#/ejercicios') return { name: 'library' };
  const m = /^#\/(ejercicio|sesion)\/([\w-]{1,64})$/.exec(hash);
  if (m) return m[1] === 'ejercicio' ? { name: 'exercise', id: m[2] } : { name: 'session', id: m[2] };
  return { name: 'sessions' };
}

export const routeHref = {
  sessions: '#/',
  session: (id: string) => `#/sesion/${id}`,
  library: '#/ejercicios',
  exercise: (id: string) => `#/ejercicio/${id}`,
};

export const navigate = (hash: string) => {
  location.hash = hash;
};

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** La ruta actual; la pantalla se redibuja sola cuando cambia la dirección. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => '');
  return parseRoute(hash);
}
