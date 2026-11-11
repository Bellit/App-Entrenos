/** Balones: añadir y quitar. Un balón existe desde el fotograma en que se añade hasta el final. */
import { uid } from './common';
import { sanitizeFrame } from './edit';
import { round1 } from './geometry';
import { endState } from './query';
import type { Play, Pt } from './types';

/** Como mucho, balones a la vez en la pista. */
export const MAX_BALLS = 12;

/**
 * Añade un balón a partir del fotograma `fromK`: en manos de `holder` (si no lleva ya uno) o suelto
 * en `pos`. En los fotogramas siguientes sigue lo que pase en cada uno (pases, tiros, carreras).
 * Devuelve su id, o '' si ya hay demasiados.
 */
export function addBall(play: Play, fromK: number, holder: string | null, pos: Pt): string {
  const f0 = play.frames[fromK];
  if (!f0 || f0.balls.length >= MAX_BALLS) return '';
  const id = uid();
  const free = holder && f0.positions[holder] && !f0.balls.some((b) => b.holder === holder);
  f0.balls.push({ id, holder: free ? holder : null, pos: round1(free ? f0.positions[holder] : pos) });
  sanitizeFrame(f0);
  for (let k = fromK + 1; k < play.frames.length; k++) {
    const prev = endState(play, k - 1).balls.find((b) => b.id === id)!;
    const f = play.frames[k];
    f.balls.push({ ...prev });
    sanitizeFrame(f);
  }
  return id;
}

/** Quita un balón de todos los fotogramas (y los pases o tiros que se hacían con él). */
export function removeBall(play: Play, id: string) {
  for (const f of play.frames) {
    f.balls = f.balls.filter((b) => b.id !== id);
    sanitizeFrame(f);
  }
}
