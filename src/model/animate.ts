/** Animación: dónde está cada jugador y cada balón en cada instante, y qué líneas dibujar. */
import { BALL_OFFSET, nearestRim } from './court';
import { RELEASE_T } from './common';
import { easeInOut, lerp, pathFor, Polyline } from './geometry';
import { moveOf, nextState, passOf, playerById, sameBall, shotOf } from './query';
import type { Action, BallState, Play, Pt, Team } from './types';
import { isMove } from './types';

/** Un balón dibujado: dónde está y su tamaño (crece un poco en el aire, en pases y tiros). */
export interface SceneBall {
  id: string;
  pos: Pt;
  scale: number;
}

export interface SceneState {
  positions: Record<string, Pt>;
  balls: SceneBall[];
}

const withOffset = (p: Pt): Pt => ({ x: p.x + BALL_OFFSET.x, y: p.y + BALL_OFFSET.y });

const pathCache = new WeakMap<Pt[], Polyline>();
export function polylineOf(points: Pt[]): Polyline {
  let pl = pathCache.get(points);
  if (!pl) {
    pl = pathFor(points);
    pathCache.set(points, pl);
  }
  return pl;
}

/** Posición de un jugador en el instante t (0-1) de la transición k. */
function playerAt(play: Play, k: number, pid: string, t: number, ns = nextState(play, k)): Pt | undefined {
  const f = play.frames[k];
  const start = f.positions[pid];
  if (!start) return undefined;
  const target = ns.positions[pid] ?? start;
  const e = easeInOut(t);
  const m = moveOf(f, pid);
  if (m) {
    const pl = polylineOf(m.points);
    const p = pl.at(e);
    const end = m.points[m.points.length - 1];
    return { x: p.x + (target.x - end.x) * e, y: p.y + (target.y - end.y) * e };
  }
  return lerp(start, target, e);
}

function ballPosOf(ball: BallState, positions: Record<string, Pt>): Pt {
  if (ball.holder && positions[ball.holder]) return withOffset(positions[ball.holder]);
  return ball.pos;
}

/** Estado de la escena en el instante t (0-1) de la transición del fotograma k. Cada balón va por su cuenta. */
export function stateAt(play: Play, k: number, t: number): SceneState {
  const f = play.frames[k];
  const ns = nextState(play, k);
  const positions: Record<string, Pt> = {};
  for (const p of play.players) {
    const pos = playerAt(play, k, p.id, t, ns);
    if (pos) positions[p.id] = pos;
  }
  const u = (t - RELEASE_T) / (1 - RELEASE_T); // avance del balón en el aire, tras soltarlo

  const balls = f.balls.map((b): SceneBall => {
    const pass = b.holder ? passOf(f, b.holder) : undefined;
    const shot = b.holder ? shotOf(f, b.holder) : undefined;
    if (pass && positions[pass.from] && positions[pass.to]) {
      if (t < RELEASE_T) return { id: b.id, pos: withOffset(positions[pass.from]), scale: 1 };
      const from = withOffset(playerAt(play, k, pass.from, RELEASE_T, ns)!);
      return { id: b.id, pos: lerp(from, withOffset(positions[pass.to]), u), scale: 1 + 0.15 * Math.sin(Math.PI * u) };
    }
    if (shot && positions[shot.playerId]) {
      if (t < RELEASE_T) return { id: b.id, pos: withOffset(positions[shot.playerId]), scale: 1 };
      const from = withOffset(playerAt(play, k, shot.playerId, RELEASE_T, ns)!);
      const rim = nearestRim(play.court, f.positions[shot.playerId]);
      return { id: b.id, pos: lerp(from, rim, u), scale: 1 + 0.7 * Math.sin(Math.PI * u) };
    }
    // sin pase ni tiro: sigue a su jugador o, si cambia de sitio entre fotogramas, se desliza
    const nb = ns.balls.find((x) => x.id === b.id);
    if (!nb || sameBall(b, nb)) return { id: b.id, pos: ballPosOf(b, positions), scale: 1 };
    return { id: b.id, pos: lerp(ballPosOf(b, f.positions), ballPosOf(nb, ns.positions), easeInOut(t)), scale: 1 };
  });
  return { positions, balls };
}

/** Estado estático al inicio del fotograma k (para edición). */
export function frameScene(play: Play, k: number): SceneState {
  const f = play.frames[k];
  return { positions: f.positions, balls: f.balls.map((b) => ({ id: b.id, pos: ballPosOf(b, f.positions), scale: 1 })) };
}

// ---------------------------------------------------------------------------
// Geometría de las acciones para dibujar
// ---------------------------------------------------------------------------

export interface Drawable {
  id: string;
  type: Action['type'];
  team: Team;
  pts: Pt[];
}

export function drawables(play: Play, k: number): Drawable[] {
  const f = play.frames[k];
  if (!f) return [];
  const ns = nextState(play, k);
  const teamOf = (id: string) => playerById(play, id)?.team ?? 'O';
  const out: Drawable[] = [];
  for (const a of f.actions) {
    if (isMove(a)) {
      out.push({ id: a.id, type: a.type, team: teamOf(a.playerId), pts: polylineOf(a.points).pts });
    } else if (a.type === 'pass') {
      const from = playerAt(play, k, a.from, RELEASE_T, ns);
      const to = ns.positions[a.to] ?? f.positions[a.to];
      if (from && to) out.push({ id: a.id, type: 'pass', team: teamOf(a.from), pts: [from, to] });
    } else if (a.type === 'shot') {
      const from = playerAt(play, k, a.playerId, RELEASE_T, ns);
      if (from) out.push({ id: a.id, type: 'shot', team: teamOf(a.playerId), pts: [from, nearestRim(play.court, f.positions[a.playerId])] });
    }
  }
  return out;
}
