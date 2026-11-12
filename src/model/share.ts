/**
 * Compartir ejercicios y sesiones: TypeScript puro (sin red ni pantallas), para poder probarlo.
 *
 * Lo que se comparte es una COPIA, tal como está al compartirla:
 *  - un ejercicio: el ejercicio entero;
 *  - una sesión: la sesión y los ejercicios que usa (si no, en la app de quien la recibe faltarían).
 * Quien lo recibe y lo guarda obtiene copias nuevas (ids nuevos): son suyas y no cambian si el
 * original cambia (ni al revés).
 */
import { uid } from './common';
import { type Exercise, parseExercise } from './exercise';
import { parseSession, resolveBlocks, type Session } from './session';

export type ShareKind = 'exercise' | 'session';

export interface SharePayload {
  kind: ShareKind;
  title: string;
  data: { version: 1; exercise?: Exercise; session?: Session; exercises?: Exercise[] };
}

export type Shared = { kind: 'exercise'; exercise: Exercise } | { kind: 'session'; session: Session; exercises: Exercise[] };

export const exercisePayload = (e: Exercise): SharePayload => ({ kind: 'exercise', title: e.title.slice(0, 120), data: { version: 1, exercise: e } });

/** La sesión y sus ejercicios (la versión actual de la biblioteca o, si se borró, la copia del bloque). */
export function sessionPayload(s: Session, library: ReadonlyMap<string, Exercise>): SharePayload {
  const exercises = new Map<string, Exercise>();
  for (const r of resolveBlocks(s, library)) if (r.block.kind === 'exercise' && r.exercise) exercises.set(r.block.exerciseId, { ...r.exercise, id: r.block.exerciseId });
  return { kind: 'session', title: s.title.slice(0, 120), data: { version: 1, session: s, exercises: [...exercises.values()] } };
}

/** Lee lo que llega de fuera (otra persona, la red): todo pasa por los mismos `parse*` que la base de datos. */
export function parseShared(kind: unknown, data: unknown): Shared | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (kind === 'exercise') {
    const exercise = parseExercise(d.exercise);
    return exercise ? { kind, exercise } : null;
  }
  if (kind === 'session') {
    const session = parseSession(d.session);
    if (!session) return null;
    const exercises = (Array.isArray(d.exercises) ? d.exercises : []).slice(0, 100).map(parseExercise).filter((e): e is Exercise => !!e);
    return { kind, session, exercises };
  }
  return null;
}

/**
 * Prepara lo recibido para guardarlo como propio: ids nuevos para todo y, en una sesión, cada
 * bloque apuntando a la copia nueva de su ejercicio (y con esa copia como respaldo).
 */
export function adoptShared(s: Shared): { exercises: Exercise[]; session?: Session } {
  const now = Date.now();
  const copy = (e: Exercise): Exercise => ({ ...structuredClone(e), id: uid(), play: { ...structuredClone(e.play), id: uid() }, createdAt: now, updatedAt: now });
  if (s.kind === 'exercise') return { exercises: [copy(s.exercise)] };
  const newIds = new Map<string, Exercise>();
  for (const e of s.exercises) newIds.set(e.id, copy(e));
  const blocks = s.session.blocks.map((b) => {
    if (b.kind !== 'exercise') return { ...b, id: uid() };
    const mine = newIds.get(b.exerciseId);
    // si no venía el ejercicio, se crea a partir de la copia que guarda el propio bloque
    const ex = mine ?? copy(b.snapshot);
    if (!mine) newIds.set(b.exerciseId, ex);
    return { ...b, id: uid(), exerciseId: ex.id, snapshot: structuredClone(ex) };
  });
  return { exercises: [...newIds.values()], session: { ...structuredClone(s.session), id: uid(), blocks, createdAt: now, updatedAt: now } };
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
/** Código del enlace: 12 caracteres al azar (más de 10^20 combinaciones: no se puede adivinar). */
export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const isShareId = (v: string) => /^[A-Za-z0-9]{8,32}$/.test(v);

/** Correo con forma de correo (la comprobación de verdad la hace quien lo recibe al entrar). */
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
