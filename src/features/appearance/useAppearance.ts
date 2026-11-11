import { useMemo } from 'react';
import { inkFor, paletteFor } from '../../court/theme';
import { useStore } from '../../store';

/**
 * Paleta de la pista (para `ThemeContext`) y variables CSS con los colores de equipo
 * (para los botones de añadir jugador), según el aspecto elegido.
 */
export function useAppearance() {
  const appearance = useStore((s) => s.appearance);
  const palette = useMemo(() => paletteFor(appearance), [appearance]);
  const style = {
    '--team-o': appearance.offense,
    '--team-o-ink': inkFor(appearance.offense),
    '--team-d': appearance.defense,
    '--team-d-ink': inkFor(appearance.defense),
  } as React.CSSProperties;
  return { palette, style, pitch: appearance.pitch };
}
