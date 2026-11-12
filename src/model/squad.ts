/**
 * Equipos (los que entrenas: «Cadete A», «Senior femenino»…). TypeScript puro.
 *
 * En el código se llaman «squad» porque `Team` ya es otra cosa en el modelo de la pizarra
 * (atacante, defensor, cono…). En la pantalla siempre se dice «equipo».
 *
 * Cada sesión puede pertenecer a un equipo (`Session.teamId`): así, si entrenas a varios equipos
 * o en varios clubs, las sesiones no se mezclan. Los jugadores ya se guardan aquí, pensando en
 * el control de asistencia (tarea 3.8).
 */
import { uid } from './common';
import type { Session } from './session';

export const SQUAD_LIMITS = { name: 60, club: 60, players: 40, player: 60, number: 3 };

/** Colores para distinguir los equipos de un vistazo (contrastan con el fondo oscuro). */
export const SQUAD_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#14b8a6', '#ef4444'] as const;

export interface SquadPlayer {
  id: string;
  name: string;
  /** Dorsal (texto, para admitir «00»), opcional. */
  number: string;
}

export interface Squad {
  version: 1;
  id: string;
  name: string;
  club: string;
  color: string;
  players: SquadPlayer[];
  createdAt: number;
  updatedAt: number;
}

export function newSquad(name = 'Equipo nuevo', club = '', taken: string[] = []): Squad {
  const now = Date.now();
  // el primer color que aún no use otro equipo
  const color = SQUAD_COLORS.find((c) => !taken.includes(c)) ?? SQUAD_COLORS[taken.length % SQUAD_COLORS.length];
  return { version: 1, id: uid(), name: name.slice(0, SQUAD_LIMITS.name), club: club.slice(0, SQUAD_LIMITS.club), color, players: [], createdAt: now, updatedAt: now };
}

/** «Cadete A · CB Sant Josep» o solo el nombre si no tiene club. */
export const squadLabel = (s: Pick<Squad, 'name' | 'club'>) => (s.club ? `${s.name} · ${s.club}` : s.name);

/** Ordena por club y luego por nombre (los equipos sin club, al final). */
export const sortSquads = (list: Squad[]) =>
  [...list].sort((a, b) => (a.club ? 0 : 1) - (b.club ? 0 : 1) || a.club.localeCompare(b.club, 'es') || a.name.localeCompare(b.name, 'es'));

// ---------------------------------------------------------------------------
// Jugadores
// ---------------------------------------------------------------------------

/**
 * Añade jugadores a partir de un texto: uno por línea. Si una línea empieza por un número, es el
 * dorsal («7 Marta» o «7. Marta» → dorsal 7, Marta). Se saltan las líneas vacías y los nombres
 * que ya están.
 */
export function addPlayers(t: Squad, text: string): Squad {
  const players = [...t.players];
  const known = new Set(players.map((p) => p.name.trim().toLowerCase()));
  for (const raw of text.split('\n')) {
    if (players.length >= SQUAD_LIMITS.players) break;
    const m = /^\s*(\d{1,3})[\s.\-)]+(.+)$/.exec(raw);
    const name = (m ? m[2] : raw).trim().slice(0, SQUAD_LIMITS.player);
    if (!name || known.has(name.toLowerCase())) continue;
    known.add(name.toLowerCase());
    players.push({ id: uid(), name, number: m ? m[1] : '' });
  }
  return { ...t, players };
}

export const updatePlayer = (t: Squad, id: string, patch: Partial<Pick<SquadPlayer, 'name' | 'number'>>): Squad => ({
  ...t,
  players: t.players.map((p) => (p.id === id ? { ...p, name: (patch.name ?? p.name).slice(0, SQUAD_LIMITS.player), number: (patch.number ?? p.number).slice(0, SQUAD_LIMITS.number) } : p)),
});

export const removePlayer = (t: Squad, id: string): Squad => ({ ...t, players: t.players.filter((p) => p.id !== id) });

/** Ordena por dorsal (los que no tienen, al final) y luego por nombre. */
export const sortPlayers = (list: SquadPlayer[]) =>
  [...list].sort((a, b) => (a.number ? 0 : 1) - (b.number ? 0 : 1) || Number(a.number) - Number(b.number) || a.name.localeCompare(b.name, 'es'));

// ---------------------------------------------------------------------------
// Resumen de asistencia
// ---------------------------------------------------------------------------

export interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Sesiones en las que se pasó lista y este jugador tiene marca. */
  total: number;
  /** % de asistencia (viene + tarde) sobre `total`; null si aún no hay datos. */
  pct: number | null;
}

/** Asistencia de cada jugador del equipo, contando las sesiones de ese equipo en las que se pasó lista. */
export function attendanceStats(t: Squad, sessions: Session[]): Map<string, AttendanceStats> {
  const stats = new Map<string, AttendanceStats>(t.players.map((p) => [p.id, { present: 0, late: 0, absent: 0, excused: 0, total: 0, pct: null }]));
  for (const s of sessions) {
    if (s.teamId !== t.id || s.template) continue;
    for (const [pid, mark] of Object.entries(s.attendance)) {
      const st = stats.get(pid);
      if (!st) continue; // jugador que ya no está en el equipo
      st[mark]++;
      st.total++;
    }
  }
  for (const st of stats.values()) st.pct = st.total ? Math.round(((st.present + st.late) / st.total) * 100) : null;
  return stats;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v : fallback).slice(0, max);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const ID_RE = /^[\w-]{1,64}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Lee un equipo de fuera (base de datos, nube); repara lo que puede, o null. */
export function parseSquad(raw: unknown): Squad | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return null;
  const now = Date.now();
  const players = (Array.isArray(raw.players) ? raw.players : [])
    .slice(0, SQUAD_LIMITS.players)
    .filter(isObj)
    .map((p) => ({ id: typeof p.id === 'string' && ID_RE.test(p.id) ? p.id : uid(), name: text(p.name, SQUAD_LIMITS.player), number: text(p.number, SQUAD_LIMITS.number) }))
    .filter((p) => p.name.trim());
  return {
    version: 1,
    id: raw.id,
    name: text(raw.name, SQUAD_LIMITS.name, 'Equipo') || 'Equipo',
    club: text(raw.club, SQUAD_LIMITS.club),
    color: typeof raw.color === 'string' && COLOR_RE.test(raw.color) ? raw.color : SQUAD_COLORS[0],
    players,
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
  };
}
