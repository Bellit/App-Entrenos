/** Consultas sobre una jugada: acciones de un fotograma y estado al acabarlo. No modifican nada. */
import { nearestRim } from './court';
import { near } from './geometry';
import type { BallState, Frame, MoveAction, PassAction, Play, Pt, ShotAction } from './types';
import { isMove } from './types';

export const moveOf = (f: Frame, pid: string) =>
  f.actions.find((a): a is MoveAction => isMove(a) && a.playerId === pid);
/** Pase que hace `from` en este fotograma (cada jugador hace como mucho uno). */
export const passOf = (f: Frame, from: string) => f.actions.find((a): a is PassAction => a.type === 'pass' && a.from === from);
/** Tiro de `pid` en este fotograma. */
export const shotOf = (f: Frame, pid: string) => f.actions.find((a): a is ShotAction => a.type === 'shot' && a.playerId === pid);
export const playerById = (play: Play, id: string) => play.players.find((p) => p.id === id);
/** El balón que lleva un jugador, si lleva alguno. */
export const ballOf = (f: Frame, pid: string) => f.balls.find((b) => b.holder === pid);
export const ballById = (f: Frame, id: string) => f.balls.find((b) => b.id === id);
/** ¿Lleva balón este jugador? */
export const hasBall = (f: Frame, pid: string) => f.balls.some((b) => b.holder === pid);

export interface FrameState {
  positions: Record<string, Pt>;
  balls: BallState[];
}

/** Dónde acaba un balón al terminar las acciones del fotograma: pasado, tirado o con su jugador. */
function ballAfter(play: Play, f: Frame, b: BallState, positions: Record<string, Pt>): BallState {
  if (!b.holder) return { ...b };
  const pass = passOf(f, b.holder);
  if (pass && positions[pass.to]) return { id: b.id, holder: pass.to, pos: positions[pass.to] };
  if (shotOf(f, b.holder)) return { id: b.id, holder: null, pos: nearestRim(play.court, f.positions[b.holder] ?? b.pos) };
  return { ...b, pos: positions[b.holder] ?? b.pos };
}

/** Estado al terminar las acciones del fotograma k. */
export function endState(play: Play, k: number): FrameState {
  const f = play.frames[k];
  const positions = { ...f.positions };
  for (const a of f.actions) if (isMove(a)) positions[a.playerId] = a.points[a.points.length - 1];
  return { positions, balls: f.balls.map((b) => ballAfter(play, f, b, positions)) };
}

/** Estado de destino de la transición k → k+1. */
export function nextState(play: Play, k: number): FrameState {
  const n = play.frames[k + 1];
  return n ? { positions: n.positions, balls: n.balls } : endState(play, k);
}

/** Mismo estado de balón: lo tiene el mismo jugador o, si está suelto, en el mismo sitio. */
export const sameBall = (a: BallState, b: BallState) => a.holder === b.holder && (a.holder !== null || near(a.pos, b.pos));
