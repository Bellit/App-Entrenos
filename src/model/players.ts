/** Jugadores: añadir, quitar y poner defensa. */
import { nearestRim } from './court';
import { LABEL_MAX, LIMITS, uid } from './common';
import { sanitizeFrame } from './edit';
import { lerp, round1 } from './geometry';
import { playerById } from './query';
import type { Play, Player, Pt, Team } from './types';

const DEFENSE_LABELS = (n: number) => `X${n}`;

/**
 * Añade un jugador a partir del fotograma `fromK` (en los anteriores no aparece: entra en ese momento).
 * Devuelve su id.
 */
export function addPlayer(play: Play, team: Team, at?: Pt, fromK = 0): string {
  if (play.players.length >= LIMITS.players) return '';
  const label = nextLabel(play, team);
  const p: Player = { id: uid(), team, label };
  play.players.push(p);
  const n = play.players.filter((x) => x.team === team).length;
  const half = play.court === 'half';
  // sitio de salida: cada tipo en su zona de la pista, desplazado según cuántos haya ya
  const base =
    at ??
    (team === 'O'
      ? { x: 20 + n * 12, y: 120 }
      : team === 'D'
        ? { x: 20 + n * 12, y: half ? 105 : 30 }
        : team === 'C'
          ? { x: 15 + n * 9, y: half ? 132 : 134 }
          : team === 'K'
            ? { x: 130, y: half ? 120 : 134 }
            : { x: 125 - n * 8, y: half ? 132 : 134 });
  play.frames.forEach((f, k) => {
    if (k >= fromK) f.positions[p.id] = round1(base);
  });
  return p.id;
}

/** Etiqueta nueva y sin repetir: 1, 2, 3… para atacantes; X1, X2… para defensores; «E» para el entrenador. */
function nextLabel(play: Play, team: Team): string {
  if (team === 'C' || team === 'B') return '';
  if (team === 'K') return 'E';
  const used = new Set(play.players.map((p) => p.label));
  let n = 1;
  const make = (i: number) => (team === 'O' ? String(i) : DEFENSE_LABELS(i)).slice(0, LABEL_MAX);
  while (used.has(make(n))) n++;
  return make(n);
}

/** Atacantes sin defensor: los que no tienen un defensor con etiqueta «X<su etiqueta>». */
export function unmarked(play: Play): Player[] {
  const marks = new Set(play.players.filter((p) => p.team === 'D').map((p) => p.label));
  return play.players.filter((p) => p.team === 'O' && !marks.has(`X${p.label}`));
}

/** Añade un defensor a cada atacante sin marca, entre el atacante y la canasta. */
export function addDefense(play: Play) {
  for (const o of unmarked(play)) {
    // desde el primer fotograma en que está el atacante
    const k0 = play.frames.findIndex((f) => f.positions[o.id]);
    if (k0 < 0) continue;
    const id = addPlayer(play, 'D', undefined, k0);
    if (!id) return; // límite de jugadores
    playerById(play, id)!.label = `X${o.label}`.slice(0, 3);
    // en cada fotograma, el defensor se coloca junto a su par
    play.frames.forEach((f) => {
      const p = f.positions[o.id];
      if (p && f.positions[id]) f.positions[id] = round1(lerp(p, nearestRim(play.court, p), 0.22));
    });
  }
}

export function removePlayer(play: Play, pid: string) {
  play.players = play.players.filter((p) => p.id !== pid);
  for (const f of play.frames) {
    const pos = f.positions[pid];
    delete f.positions[pid];
    if (f.ball.holder === pid) f.ball = { holder: null, pos: pos ?? f.ball.pos };
    f.actions = f.actions.filter((a) =>
      a.type === 'pass' ? a.from !== pid && a.to !== pid : a.playerId !== pid,
    );
    sanitizeFrame(f);
  }
}
