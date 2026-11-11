import { useSyncExternalStore } from 'react';

/**
 * Enrutado mínimo con el «hash» de la dirección (lo que va después de #).
 *   #/                    → biblioteca de ejercicios
 *   #/ejercicio/<id>      → editor de un ejercicio
 * Se usa el hash y no rutas normales porque la app es una web estática: no hace falta configurar
 * el servidor para que cualquier dirección devuelva la misma página.
 */
export type Route = { name: 'library' } | { name: 'exercise'; id: string };

export function parseRoute(hash: string): Route {
  const m = /^#\/ejercicio\/([\w-]{1,64})$/.exec(hash);
  return m ? { name: 'exercise', id: m[1] } : { name: 'library' };
}

export const routeHref = {
  library: '#/',
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
