import type { CourtType, Pt } from './types';

/**
 * Unidades: 1 unidad = 10 cm (medidas FIBA).
 * Media pista: x de 0 a 150 (ancho), y de 0 a 140 (fondo), canasta arriba.
 * Pista entera: x de 0 a 280 (largo), y de 0 a 150 (ancho), canastas a izquierda y derecha.
 */
export const COURT_W = 150;
export const HALF_L = 140;
export const FULL_L = 280;
export const RIM_FROM_BASELINE = 15.75;
const MARGIN = 10;

export const PLAYER_R = 4.6;
export const BALL_R = 2.3;
export const BALL_OFFSET: Pt = { x: 3.9, y: 3.6 };

function courtSize(court: CourtType) {
  return court === 'half' ? { w: COURT_W, h: HALF_L } : { w: FULL_L, h: COURT_W };
}

export function viewBox(court: CourtType) {
  const { w, h } = courtSize(court);
  return { x: -MARGIN, y: -MARGIN, w: w + MARGIN * 2, h: h + MARGIN * 2 };
}

function rims(court: CourtType): Pt[] {
  if (court === 'half') return [{ x: COURT_W / 2, y: RIM_FROM_BASELINE }];
  return [
    { x: RIM_FROM_BASELINE, y: COURT_W / 2 },
    { x: FULL_L - RIM_FROM_BASELINE, y: COURT_W / 2 },
  ];
}

export function nearestRim(court: CourtType, p: Pt): Pt {
  const rs = rims(court);
  return rs.reduce((best, r) => (Math.hypot(r.x - p.x, r.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? r : best), rs[0]);
}

/** Convierte una posición entre media pista y pista entera (se usa la canasta izquierda). */
export function convertPoint(p: Pt, from: CourtType, to: CourtType): Pt {
  if (from === to) return p;
  if (from === 'half') return { x: p.y, y: p.x };
  // pista entera -> media pista: lo que esté en la mitad derecha se refleja
  const x = p.x > FULL_L / 2 ? FULL_L - p.x : p.x;
  return { x: p.y, y: x };
}
