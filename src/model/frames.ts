/** Fotogramas: añadir, borrar, reordenar y duplicar, manteniendo la jugada encadenada. */
import { clone, LIMITS, uid } from './common';
import { newFrame } from './create';
import { cascadeBall, cascadePos, sanitizeFrame } from './edit';
import { near, translate } from './geometry';
import { endState, moveOf, sameBall } from './query';
import type { Play } from './types';

export function addFrameAfter(play: Play, k: number): number {
  if (play.frames.length >= LIMITS.frames) return k;
  const end = endState(play, k);
  const f = newFrame(end.positions, end.balls);
  f.duration = play.frames[k].duration;
  play.frames.splice(k + 1, 0, f);
  return k + 1;
}

/**
 * Borra el fotograma k. Si era intermedio, el siguiente pasa a empezar donde termina el anterior
 * (y lo mismo los posteriores que conservaban esas posiciones), para que la animación no salte.
 */
export function deleteFrame(play: Play, k: number) {
  if (play.frames.length <= 1) return;
  play.frames.splice(k, 1);
  if (k === 0 || k >= play.frames.length) return;
  const end = endState(play, k - 1);
  const next = play.frames[k];
  for (const p of play.players) {
    const o = next.positions[p.id];
    const n = end.positions[p.id];
    if (o && n && !near(o, n)) cascadePos(play, k, p.id, o, n);
  }
  for (const e of end.balls) {
    const o = next.balls.find((b) => b.id === e.id);
    if (o && !sameBall(o, e)) cascadeBall(play, k, e.id, clone(o), e);
  }
}

/**
 * Vuelve a encadenar los fotogramas desde `fromK`: cada uno empieza donde acaba el anterior.
 * Las trayectorias se desplazan con su jugador (conservan la forma) y cada balón pasa a quien lo
 * tenga al final del fotograma anterior. Devuelve cuántas acciones se han tenido que quitar
 * (pases o tiros de alguien que ya no tiene el balón).
 */
function rechain(play: Play, fromK = 1): number {
  let removed = 0;
  for (let k = Math.max(1, fromK); k < play.frames.length; k++) {
    const end = endState(play, k - 1);
    const f = play.frames[k];
    for (const p of play.players) {
      const s = f.positions[p.id];
      const e = end.positions[p.id];
      if (!e) continue; // jugador que entra en este fotograma: se queda donde está
      if (s && near(s, e)) continue;
      f.positions[p.id] = e;
      const m = moveOf(f, p.id);
      if (m && s) m.points = translate(m.points, { x: e.x - s.x, y: e.y - s.y });
      else if (m) m.points = [e, ...m.points.slice(1)];
    }
    // los balones siguen donde acabaron; los que entran en este fotograma se quedan como están
    f.balls = [...clone(end.balls), ...f.balls.filter((b) => !end.balls.some((e) => e.id === b.id))];
    const before = f.actions.length;
    sanitizeFrame(f);
    removed += before - f.actions.length;
  }
  return removed;
}

/** Mueve el fotograma `from` a la posición `to` y vuelve a encadenar. Devuelve las acciones quitadas. */
export function moveFrame(play: Play, from: number, to: number): number {
  const n = play.frames.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return 0;
  const [f] = play.frames.splice(from, 1);
  play.frames.splice(to, 0, f);
  return rechain(play, Math.min(from, to));
}

/**
 * Duplica el fotograma k justo detrás: la copia repite las mismas acciones empezando donde acaba
 * el original. Devuelve el índice de la copia (o k si se ha llegado al límite) y cuántas acciones
 * se han tenido que quitar al encadenar.
 */
export function duplicateFrame(play: Play, k: number): { index: number; removed: number } {
  if (play.frames.length >= LIMITS.frames) return { index: k, removed: 0 };
  const copy = clone(play.frames[k]);
  copy.id = uid();
  for (const a of copy.actions) a.id = uid();
  play.frames.splice(k + 1, 0, copy);
  return { index: k + 1, removed: rechain(play, k + 1) };
}
