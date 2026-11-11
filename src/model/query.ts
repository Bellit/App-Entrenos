/** Consultas sobre una jugada: acciones de un fotograma y estado al acabarlo. No modifican nada. */
import { nearestRim } from './court';
import { near } from './geometry';
import type { BallState, Frame, MoveAction, PassAction, Play, Pt, ShotAction } from './types';
import { isMove } from './types';

export const moveOf = (f: Frame, pid: string) =>
  f.actions.find((a): a is MoveAction => isMove(a) && a.playerId === pid);
export const passOf = (f: Frame) => f.actions.find((a): a is PassAction => a.type === 'pass');
export const shotOf = (f: Frame) => f.actions.find((a): a is ShotAction => a.type === 'shot');
export const playerById = (play: Play, id: string) => play.players.find((p) => p.id === id);

interface FrameState {
  positions: Record<string, Pt>;
  ball: BallState;
}

/** Estado al terminar las acciones del fotograma k. */
export function endState(play: Play, k: number): FrameState {
  const f = play.frames[k];
  const positions = { ...f.positions };
  for (const a of f.actions) if (isMove(a)) positions[a.playerId] = a.points[a.points.length - 1];
  let ball: BallState = { ...f.ball };
  const pass = passOf(f);
  const shot = shotOf(f);
  if (pass) ball = { holder: pass.to, pos: positions[pass.to] };
  else if (shot) ball = { holder: null, pos: nearestRim(play.court, f.positions[shot.playerId]) };
  else if (ball.holder) ball.pos = positions[ball.holder] ?? ball.pos;
  return { positions, ball };
}

/** Estado de destino de la transición k → k+1. */
export function nextState(play: Play, k: number): FrameState {
  const n = play.frames[k + 1];
  return n ? { positions: n.positions, ball: n.ball } : endState(play, k);
}

/** Mismo balón: lo tiene el mismo jugador o, si está suelto, en el mismo sitio. */
export const sameBall = (a: BallState, b: BallState) => a.holder === b.holder && (a.holder !== null || near(a.pos, b.pos));

