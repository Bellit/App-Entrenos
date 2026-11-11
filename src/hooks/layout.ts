import { useSyncExternalStore } from 'react';
import { type Layout, MEDIA } from '../ui/breakpoints';

/** Escucha una consulta `@media` y avisa cuando cambia (al girar el móvil o estrechar la ventana). */
function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof matchMedia === 'undefined') return () => {};
      const m = matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
    () => false,
  );
}

/**
 * Qué maqueta toca ahora (`mobile`, `tablet` o `desktop`, por el tamaño de pantalla), si se usa
 * con el dedo (`touch`) y si la pantalla es más ancha que alta (`landscape`). Nunca se mira qué
 * aparato es: solo el tamaño, la orientación y el tipo de puntero.
 */
export function useLayout(): { layout: Layout; touch: boolean; landscape: boolean } {
  const mobile = useMedia(MEDIA.mobile);
  const tablet = useMedia(MEDIA.tablet);
  const touch = useMedia(MEDIA.touch);
  const landscape = useMedia(MEDIA.landscape);
  return { layout: mobile ? 'mobile' : tablet ? 'tablet' : 'desktop', touch, landscape };
}
