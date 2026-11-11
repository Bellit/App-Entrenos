/**
 * Edición de un fotograma. Las funciones mutan la jugada recibida, que debe ser una copia
 * (el almacén clona antes). Cada cambio se propaga a los fotogramas siguientes que no se han tocado.
 */
import { convertPoint } from './court';
import { clone, LIMITS, uid } from './common';
import { near, round1, stretch, translate } from './geometry';
import { endState, moveOf, sameBall } from './query';
import type { BallState, CourtType, Frame, MoveType, Play, Pt } from './types';
import { isMove } from './types';

/** Propaga un cambio de posición a los fotogramas siguientes mientras conserven la posición antigua. */
export function cascadePos(play: Play, fromK: number, pid: string, oldPos: Pt, newPos: Pt) {
  for (let k = fromK; k < play.frames.length; k++) {
    const f = play.frames[k];
    const cur = f.positions[pid];
    if (!cur || !near(cur, oldPos)) break;
    f.positions[pid] = newPos;
    const m = moveOf(f, pid);
    if (m) {
      m.points = [newPos, ...m.points.slice(1)];
      break;
    }
  }
}



export function cascadeBall(play: Play, fromK: number, oldBall: BallState, newBall: BallState) {
  for (let k = fromK; k < play.frames.length; k++) {
    const f = play.frames[k];
    if (!sameBall(f.ball, oldBall)) break;
    f.ball = clone(newBall);
    sanitizeFrame(f);
  }
}

/** Elimina acciones que ya no tienen sentido con el balón actual. */
export function sanitizeFrame(f: Frame) {
  f.actions = f.actions.filter((a) => {
    if (a.type === 'pass') return a.from === f.ball.holder && a.to !== a.from && !!f.positions[a.to];
    if (a.type === 'shot') return a.playerId === f.ball.holder;
    return !!f.positions[a.playerId];
  });
  for (const a of f.actions) if (a.type === 'dribble' && a.playerId !== f.ball.holder) a.type = 'move';
}

/** Aplica una modificación del fotograma k y propaga sus consecuencias al siguiente. */
function withPropagation(play: Play, k: number, mutate: (f: Frame) => void) {
  const before = endState(play, k);
  mutate(play.frames[k]);
  sanitizeFrame(play.frames[k]);
  const after = endState(play, k);
  for (const p of play.players) {
    const o = before.positions[p.id];
    const n = after.positions[p.id];
    if (o && n && !near(o, n)) cascadePos(play, k + 1, p.id, o, n);
  }
  if (!sameBall(before.ball, after.ball)) cascadeBall(play, k + 1, before.ball, after.ball);
}

export function movePlayer(play: Play, k: number, pid: string, pos: Pt) {
  const f = play.frames[k];
  const old = f.positions[pid];
  if (!old) return;
  pos = round1(pos);
  // si el fotograma anterior terminaba en esta posición, se estira su trayectoria
  const prev = play.frames[k - 1];
  const pm = prev && moveOf(prev, pid);
  if (pm && near(pm.points[pm.points.length - 1], old)) pm.points = stretch(pm.points, pos);

  withPropagation(play, k, (fr) => {
    fr.positions[pid] = pos;
    const m = moveOf(fr, pid);
    if (m) m.points = translate(m.points, { x: pos.x - old.x, y: pos.y - old.y });
  });
}

export function setMove(play: Play, k: number, pid: string, type: MoveType, points: Pt[]) {
  // una trayectoria muy larga se aligera quitando puntos alternos (se conserva el último)
  while (points.length > LIMITS.points) points = [...points.filter((_, i) => i % 2 === 0 && i < points.length - 1), points[points.length - 1]];
  withPropagation(play, k, (f) => {
    f.actions = f.actions.filter((a) => !(isMove(a) && a.playerId === pid));
    f.actions.push({ id: uid(), type, playerId: pid, points: points.map(round1) });
  });
}

export function setActionEnd(play: Play, k: number, actionId: string, end: Pt) {
  withPropagation(play, k, (f) => {
    const a = f.actions.find((x) => x.id === actionId);
    if (a && isMove(a)) a.points = stretch(a.points, round1(end));
  });
}

export function setActionType(play: Play, k: number, actionId: string, type: MoveType) {
  withPropagation(play, k, (f) => {
    const a = f.actions.find((x) => x.id === actionId);
    if (a && isMove(a)) a.type = type;
  });
}

export function setPass(play: Play, k: number, from: string, to: string) {
  withPropagation(play, k, (f) => {
    f.actions = f.actions.filter((a) => a.type !== 'pass' && a.type !== 'shot');
    f.actions.push({ id: uid(), type: 'pass', from, to });
  });
}

export function setShot(play: Play, k: number, pid: string) {
  withPropagation(play, k, (f) => {
    f.actions = f.actions.filter((a) => a.type !== 'pass' && a.type !== 'shot');
    f.actions.push({ id: uid(), type: 'shot', playerId: pid });
  });
}

export function deleteAction(play: Play, k: number, actionId: string) {
  withPropagation(play, k, (f) => {
    f.actions = f.actions.filter((a) => a.id !== actionId);
  });
}

export function setBall(play: Play, k: number, ball: BallState) {
  withPropagation(play, k, (fr) => {
    fr.ball = { holder: ball.holder, pos: round1(ball.pos) };
  });
}

export function setCourt(play: Play, court: CourtType) {
  if (play.court === court) return;
  const from = play.court;
  const conv = (p: Pt) => round1(convertPoint(p, from, court));
  for (const f of play.frames) {
    for (const id of Object.keys(f.positions)) f.positions[id] = conv(f.positions[id]);
    f.ball.pos = conv(f.ball.pos);
    for (const a of f.actions) if (isMove(a)) a.points = a.points.map(conv);
  }
  play.court = court;
}
