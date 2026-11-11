/**
 * Gestos sobre la pista, sin React ni ratón: decide qué hace cada pulsación, arrastre y suelta
 * (mover, dibujar, pasar, tirar, seleccionar). `Board.tsx` solo traduce el ratón a coordenadas
 * de pista y aplica lo que devuelven estas funciones. Así se pueden probar con tests.
 */
import { PLAYER_R } from '../../model/court';
import { dist, Polyline, simplify } from '../../model/geometry';
import * as P from '../../model/play';
import type { Drawable } from '../../model/play';
import type { MoveType, Play, Pt } from '../../model/types';
import { holdsBall } from '../../model/types';
import type { Selection, Tool } from '../../store';

export type Drag =
  | { mode: 'player'; base: Play; pid: string; offset: Pt }
  | { mode: 'ball'; offset: Pt }
  | { mode: 'handle'; base: Play; actionId: string }
  /**
   * `smart`: dibujo empezado desde el anillo del jugador con la herramienta Seleccionar.
   * `from`: dónde se pulsó; el trazo empieza en el jugador, pero lo recorrido se mide desde aquí.
   */
  | { mode: 'draw'; pid: string; type: MoveType; pts: Pt[]; smart?: boolean; from?: Pt }
  | { mode: 'pass'; pid: string; start: Pt };

/** Lo que hay bajo el puntero (atributos `data-kind` y `data-id` del SVG). */
export interface Hit {
  kind: 'player' | 'ball' | 'action' | 'handle' | null;
  id: string;
}

/** Qué hacer tras un gesto. Cada campo es opcional: solo se aplica lo que viene. */
export interface Effect {
  drag?: Drag;
  /** `null` = quitar la selección; sin el campo = no cambiarla. */
  select?: Selection;
  notify?: string;
  /** Cambio con historial (deshacer). */
  edit?: (p: Play) => void;
  /** Vista previa durante un arrastre, partiendo de `base`. */
  preview?: { base: Play; fn: (p: Play) => void };
  /** Cierra un arrastre con vista previa guardando `base` en el historial. */
  commit?: Play;
  /** Línea provisional mientras se dibuja (`null` = quitarla). */
  draft?: Drawable | null;
  /** Posición provisional del balón mientras se arrastra (`null` = soltarlo). */
  ballAt?: Pt | null;
}

export const HINTS: Record<Tool, string> = {
  select: 'Arrastra un jugador para moverlo, o desde su anillo para dibujar su carrera (bote si lleva el balón; suelta sobre un compañero para pasar).',
  move: 'Arrastra desde un jugador para dibujar su desplazamiento.',
  dribble: 'Arrastra desde el jugador con balón para dibujar la conducción.',
  pass: 'Arrastra desde el jugador con balón hasta un compañero.',
  screen: 'Arrastra desde un jugador hasta donde pone el bloqueo.',
  shot: 'Pulsa sobre el jugador con balón para que tire.',
};

/**
 * Márgenes de los gestos, en unidades de pista (1 = 10 cm). Con el dedo son mayores: tapa lo que toca
 * y tiembla más que un ratón.
 * - `ring`: a partir de radio + ring desde el centro del jugador, pulsar dibuja en vez de mover.
 * - `halo`: radio + halo es el anillo desde el que se dibuja (y lo que se puede tocar del jugador).
 * - `near`: radio + near es la distancia a la que se encuentra a un jugador (destino de un pase).
 * - `minStroke`: recorrido mínimo para que un trazo cuente como carrera.
 */
export interface Reach {
  ring: number;
  halo: number;
  near: number;
  minStroke: number;
}
export const MOUSE_REACH: Reach = { ring: 0.3, halo: 4, near: 3, minStroke: 4 };
export const TOUCH_REACH: Reach = { ring: 1.5, halo: 8, near: 6, minStroke: 6 };

const teamOf = (play: Play, id: string) => P.playerById(play, id)?.team ?? 'O';

/** El jugador más cercano al punto, si hay uno a menos de su radio + `near` (sin contar `exclude`). */
function playerNear(play: Play, k: number, p: Pt, near: number, exclude?: string): string | null {
  const f = play.frames[k];
  let best: string | null = null;
  let bd = PLAYER_R + near;
  for (const pl of play.players) {
    const pos = f.positions[pl.id];
    if (pl.id === exclude || !pos || !holdsBall(pl.team)) continue;
    const d = dist(pos, p);
    if (d < bd) {
      bd = d;
      best = pl.id;
    }
  }
  return best;
}

/** En un dibujo inteligente del jugador con balón, el compañero sobre el que se suelta (= pase). */
function smartPassTarget(play: Play, k: number, d: Drag, p: Pt, reach: Reach): string | null {
  if (d.mode !== 'draw' || !d.smart || d.pid !== play.frames[k].ball.holder) return null;
  const to = playerNear(play, k, p, reach.near, d.pid);
  return to && teamOf(play, to) === teamOf(play, d.pid) ? to : null;
}

/** Pulsar sobre la pista. `ballPos`: dónde se dibuja el balón ahora; `reach`: márgenes de ratón o de dedo. */
export function pressAt(play: Play, k: number, tool: Tool, hit: Hit, p: Pt, ballPos?: Pt, reach: Reach = MOUSE_REACH): Effect {
  const f = play.frames[k];
  const holder = f.ball.holder;

  if (tool === 'select') {
    if (hit.kind === 'handle') return { drag: { mode: 'handle', base: play, actionId: hit.id } };
    if (hit.kind === 'ball' && ballPos) return { select: null, drag: { mode: 'ball', offset: { x: ballPos.x - p.x, y: ballPos.y - p.y } } };
    if (hit.kind === 'player') {
      const pos = f.positions[hit.id];
      const select: Selection = { kind: 'player', id: hit.id };
      // desde el anillo: dibujar carrera (o bote si lleva el balón); soltar en un compañero = pase
      if (dist(pos, p) > PLAYER_R + reach.ring) return { select, drag: { mode: 'draw', pid: hit.id, type: hit.id === holder ? 'dribble' : 'move', pts: [pos], smart: true, from: p } };
      return { select, drag: { mode: 'player', base: play, pid: hit.id, offset: { x: pos.x - p.x, y: pos.y - p.y } } };
    }
    if (hit.kind === 'action') return { select: { kind: 'action', id: hit.id } };
    return { select: null };
  }

  const pid = playerNear(play, k, p, reach.near);
  if (!pid) return { notify: HINTS[tool] };
  if ((tool === 'dribble' || tool === 'pass' || tool === 'shot') && pid !== holder)
    return { notify: holder ? 'Esa acción solo la puede hacer el jugador que tiene el balón.' : 'Nadie tiene el balón en este fotograma. Arrástralo a un jugador.' };
  if (tool === 'shot') return { edit: (pl) => P.setShot(pl, k, pid) };
  const start = f.positions[pid];
  if (tool === 'pass') return { drag: { mode: 'pass', pid, start }, draft: { id: 'draft', type: 'pass', team: teamOf(play, pid), pts: [start, p] } };
  return { drag: { mode: 'draw', pid, type: tool, pts: [start] } };
}

/** Mover el puntero durante un arrastre. Puede ir añadiendo puntos al trazo de `d`. */
export function dragTo(play: Play, k: number, d: Drag, p: Pt, reach: Reach = MOUSE_REACH): Effect {
  const f = play.frames[k];
  switch (d.mode) {
    case 'player': {
      const pos = { x: p.x + d.offset.x, y: p.y + d.offset.y };
      return { preview: { base: d.base, fn: (pl) => P.movePlayer(pl, k, d.pid, pos) } };
    }
    case 'ball':
      return { ballAt: { x: p.x + d.offset.x, y: p.y + d.offset.y } };
    case 'handle':
      return { preview: { base: d.base, fn: (pl) => P.setActionEnd(pl, k, d.actionId, p) } };
    case 'draw': {
      const mate = smartPassTarget(play, k, d, p, reach);
      if (mate) return { draft: { id: 'draft', type: 'pass', team: teamOf(play, d.pid), pts: [d.pts[0], f.positions[mate]] } };
      if (dist(d.pts[d.pts.length - 1], p) <= 0.9) return {};
      d.pts.push(p);
      return { draft: { id: 'draft', type: d.type, team: teamOf(play, d.pid), pts: d.pts.slice() } };
    }
    case 'pass': {
      const to = playerNear(play, k, p, reach.near, d.pid);
      return { draft: { id: 'draft', type: 'pass', team: teamOf(play, d.pid), pts: [d.start, to ? f.positions[to] : p] } };
    }
  }
}

/** Soltar al final de un arrastre. */
export function releaseAt(play: Play, k: number, d: Drag, p: Pt, reach: Reach = MOUSE_REACH): Effect {
  const f = play.frames[k];
  switch (d.mode) {
    case 'player':
    case 'handle':
      return { commit: d.base };
    case 'ball': {
      const pos = { x: p.x + d.offset.x, y: p.y + d.offset.y };
      const to = playerNear(play, k, pos, reach.near);
      return { ballAt: null, edit: (pl) => P.setBall(pl, k, to ? { holder: to, pos: f.positions[to] } : { holder: null, pos }) };
    }
    case 'draw': {
      const mate = smartPassTarget(play, k, d, p, reach);
      if (mate) return { edit: (pl) => P.setPass(pl, k, d.pid, mate) };
      // un trazo muy corto no es una carrera; con Seleccionar, un clic en el anillo solo selecciona
      const travelled = new Polyline(d.from ? [d.from, ...d.pts.slice(1)] : d.pts).length;
      if (travelled < reach.minStroke) return d.smart ? {} : { notify: HINTS[d.type] };
      const pts = simplify(d.pts, 1.1);
      return { edit: (pl) => P.setMove(pl, k, d.pid, d.type, pts) };
    }
    case 'pass': {
      const to = playerNear(play, k, p, reach.near, d.pid);
      if (!to) return { notify: 'Suelta el pase encima de un compañero.' };
      if (teamOf(play, to) !== teamOf(play, d.pid)) return { notify: 'Solo se puede pasar a un compañero del mismo equipo.' };
      return { edit: (pl) => P.setPass(pl, k, d.pid, to) };
    }
  }
}
