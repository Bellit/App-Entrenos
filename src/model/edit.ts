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



/** Propaga el cambio de un balón (por su id) a los fotogramas siguientes mientras conserven su estado antiguo. */
export function cascadeBall(play: Play, fromK: number, id: string, oldBall: BallState, newBall: BallState) {
  for (let k = fromK; k < play.frames.length; k++) {
    const f = play.frames[k];
    const i = f.balls.findIndex((b) => b.id === id);
    if (i < 0 || !sameBall(f.balls[i], oldBall)) break;
    f.balls[i] = { ...clone(newBall), id };
    sanitizeFrame(f);
  }
}

/**
 * Deja los balones y las acciones del fotograma en un estado válido:
 * - un balón cuyo jugador ya no está, o un segundo balón del mismo jugador, queda suelto;
 * - cada jugador hace como mucho un pase o un tiro, y solo si lleva balón;
 * - cada jugador recibe como mucho un pase, y no puede recibir si ya tiene balón y no lo suelta;
 * - el bote solo es bote si el jugador lleva balón (si no, pasa a carrera).
 */
export function sanitizeFrame(f: Frame) {
  const holders = new Set<string>();
  for (const b of f.balls) {
    if (b.holder && (!f.positions[b.holder] || holders.has(b.holder))) b.holder = null;
    if (b.holder) holders.add(b.holder);
  }
  const releasing = new Set(f.actions.flatMap((a) => (a.type === 'pass' ? [a.from] : a.type === 'shot' ? [a.playerId] : [])).filter((p) => holders.has(p)));
  const acted = new Set<string>();
  const receiving = new Set<string>();
  f.actions = f.actions.filter((a) => {
    if (a.type === 'pass') {
      const ok = holders.has(a.from) && !acted.has(a.from) && a.to !== a.from && !!f.positions[a.to] && !receiving.has(a.to) && (!holders.has(a.to) || releasing.has(a.to));
      if (ok) acted.add(a.from), receiving.add(a.to);
      return ok;
    }
    if (a.type === 'shot') {
      const ok = holders.has(a.playerId) && !acted.has(a.playerId);
      if (ok) acted.add(a.playerId);
      return ok;
    }
    return !!f.positions[a.playerId];
  });
  for (const a of f.actions) if (a.type === 'dribble' && !holders.has(a.playerId)) a.type = 'move';
}

/** ¿Puede `to` recibir un pase en el fotograma? (No si ya tiene balón y no lo pasa ni lo tira.) */
export function canReceive(f: Frame, to: string): boolean {
  if (!f.balls.some((b) => b.holder === to)) return true;
  return f.actions.some((a) => (a.type === 'pass' && a.from === to) || (a.type === 'shot' && a.playerId === to));
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
  for (const n of after.balls) {
    const o = before.balls.find((b) => b.id === n.id);
    if (o && !sameBall(o, n)) cascadeBall(play, k + 1, n.id, o, n);
  }
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

/** Quita el pase o tiro que ya hiciera `pid` (cada jugador hace uno como mucho). */
const withoutBallActionOf = (f: Frame, pid: string) =>
  f.actions.filter((a) => !((a.type === 'pass' && a.from === pid) || (a.type === 'shot' && a.playerId === pid)));

export function setPass(play: Play, k: number, from: string, to: string) {
  withPropagation(play, k, (f) => {
    // sustituye el pase o tiro anterior de `from` y cualquier otro pase hacia `to`
    f.actions = withoutBallActionOf(f, from).filter((a) => !(a.type === 'pass' && a.to === to));
    f.actions.push({ id: uid(), type: 'pass', from, to });
  });
}

export function setShot(play: Play, k: number, pid: string) {
  withPropagation(play, k, (f) => {
    f.actions = withoutBallActionOf(f, pid);
    f.actions.push({ id: uid(), type: 'shot', playerId: pid });
  });
}

export function deleteAction(play: Play, k: number, actionId: string) {
  withPropagation(play, k, (f) => {
    f.actions = f.actions.filter((a) => a.id !== actionId);
  });
}

/**
 * Coloca el balón `id` en el fotograma k: en manos de `holder` o suelto en `pos`.
 * Si ese jugador ya llevaba otro balón, no se le da (el balón queda suelto en `pos`).
 */
export function setBall(play: Play, k: number, id: string, ball: Omit<BallState, 'id'>) {
  withPropagation(play, k, (fr) => {
    const b = fr.balls.find((x) => x.id === id);
    if (!b) return;
    const taken = ball.holder !== null && fr.balls.some((x) => x.id !== id && x.holder === ball.holder);
    b.holder = taken ? null : ball.holder;
    b.pos = round1(ball.pos);
  });
}

export function setCourt(play: Play, court: CourtType) {
  if (play.court === court) return;
  const from = play.court;
  const conv = (p: Pt) => round1(convertPoint(p, from, court));
  for (const f of play.frames) {
    for (const id of Object.keys(f.positions)) f.positions[id] = conv(f.positions[id]);
    for (const b of f.balls) b.pos = conv(b.pos);
    for (const a of f.actions) if (isMove(a)) a.points = a.points.map(conv);
  }
  play.court = court;
}
