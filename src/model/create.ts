/** Crear jugadas y fotogramas nuevos. */
import { convertPoint } from './court';
import { clone, DEFAULT_DURATION, uid } from './common';
import { formationById, ZONE_23, type DefenseKind } from './formations';
import { addDefense } from './players';
import type { BallState, CourtType, Frame, Play, Player, Pt } from './types';

/**
 * Crea una jugada con una formación inicial (ver `formations.ts`) y, opcionalmente, defensa:
 * individual (un defensor delante de cada atacante) o zona 2-3.
 */
export function newPlay(name = 'Nueva jugada', court: CourtType = 'half', formationId = 'abierta', defense: DefenseKind = 'none'): Play {
  const offense = formationById(formationId).offense;
  const players: Player[] = offense.map((_, i) => ({ id: uid(), team: 'O', label: String(i + 1) }));
  const positions: Record<string, Pt> = {};
  players.forEach((p, i) => (positions[p.id] = convertPoint(offense[i], 'half', court)));
  if (defense === 'zone23')
    ZONE_23.forEach((pos, i) => {
      const d: Player = { id: uid(), team: 'D', label: `X${i + 1}` };
      players.push(d);
      positions[d.id] = convertPoint(pos, 'half', court);
    });
  const now = Date.now();
  const play: Play = {
    version: 1,
    id: uid(),
    name,
    court,
    players,
    frames: [newFrame(positions, [{ id: uid(), holder: players[0].id, pos: positions[players[0].id] }])],
    createdAt: now,
    updatedAt: now,
  };
  if (defense === 'man') addDefense(play);
  return play;
}

export function newFrame(positions: Record<string, Pt>, balls: BallState[]): Frame {
  return { id: uid(), positions: clone(positions), balls: clone(balls), actions: [], duration: DEFAULT_DURATION, note: '' };
}
