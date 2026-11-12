/**
 * Modelo de una sesión de entrenamiento: TypeScript puro, sin React ni base de datos.
 *
 * Una sesión es una cabecera (fecha, hora, equipo, objetivo) y una lista ordenada de bloques.
 * Cada bloque dura unos minutos y puede ser:
 *  - de ejercicio: apunta a un ejercicio de la biblioteca (`exerciseId`) y además guarda una copia
 *    (`snapshot`). Se usa siempre la versión actual del ejercicio; la copia solo se usa si el
 *    ejercicio se ha borrado. Así, mejorar un ejercicio mejora todas las sesiones que lo usan,
 *    y borrarlo no rompe las sesiones pasadas.
 *  - de texto libre: algo que no está en la biblioteca («Charla», «Estiramientos», «Agua»…).
 *
 * Todas las funciones devuelven una sesión nueva y no modifican la que reciben (como `addTag`
 * en exercise.ts). Así React detecta los cambios comparando referencias.
 */
import { uid } from './common';
import { type Exercise, parseExercise } from './exercise';

export const SESSION_LIMITS = { title: 80, team: 60, goal: 300, notes: 4000, blocks: 40, blockTitle: 80, blockText: 2000, minutes: 180 };

export interface ExerciseBlock {
  id: string;
  kind: 'exercise';
  exerciseId: string;
  /** Copia del ejercicio al añadirlo o al guardar la sesión por última vez. */
  snapshot: Exercise;
  minutes: number;
  /** Nota solo para esta sesión (p. ej. «hoy, con defensa pasiva»). */
  note: string;
}

export interface TextBlock {
  id: string;
  kind: 'text';
  title: string;
  text: string;
  minutes: number;
}

export type SessionBlock = ExerciseBlock | TextBlock;

export interface Session {
  version: 1;
  id: string;
  title: string;
  /** Fecha `AAAA-MM-DD`, o vacía si aún no se ha puesto. */
  date: string;
  /** Hora de inicio `HH:MM`, o vacía. */
  startTime: string;
  /** Equipo de la sesión (id de un Squad, ver squad.ts), o vacío. */
  teamId: string;
  /** Texto libre de antes de existir los equipos (se conserva para no perderlo). */
  team: string;
  /** Objetivo de la sesión. */
  goal: string;
  notes: string;
  blocks: SessionBlock[];
  /** Plantilla: un modelo para crear sesiones (no tiene fecha ni sale entre las próximas o pasadas). */
  template: boolean;
  /** Lo que se apunta después del entreno. */
  review: SessionReview;
  createdAt: number;
  updatedAt: number;
}

/** Después del entreno: si se hizo, cómo fue (1-5; 0 = sin valorar) y notas. */
export interface SessionReview {
  done: boolean;
  rating: number;
  notes: string;
}

export const EMPTY_REVIEW: SessionReview = { done: false, rating: 0, notes: '' };

// ---------------------------------------------------------------------------
// Crear y editar
// ---------------------------------------------------------------------------

export function newSession(title = 'Sesión nueva', date = '', teamId = ''): Session {
  const now = Date.now();
  return { version: 1, id: uid(), title, date, startTime: '', teamId, team: '', goal: '', notes: '', blocks: [], template: false, review: { ...EMPTY_REVIEW }, createdAt: now, updatedAt: now };
}

/** Cambia lo de después del entreno. Escribir notas o valorar marca la sesión como hecha. */
export function updateReview(s: Session, patch: Partial<SessionReview>): Session {
  const review = { ...s.review, ...patch };
  review.rating = Math.max(0, Math.min(5, Math.round(review.rating)));
  review.notes = review.notes.slice(0, SESSION_LIMITS.notes);
  if (patch.done === undefined && (patch.rating || patch.notes?.trim())) review.done = true;
  return { ...s, review };
}

/** Copia nueva con ids nuevos (también los de los bloques). */
function copyOf(s: Session, patch: Partial<Session>): Session {
  const now = Date.now();
  return { ...structuredClone(s), id: uid(), blocks: s.blocks.map((b) => ({ ...structuredClone(b), id: uid() })), review: { ...EMPTY_REVIEW }, createdAt: now, updatedAt: now, ...patch };
}

/** Guarda una sesión como plantilla: la misma estructura, sin fecha ni notas del entreno. */
export const toTemplate = (s: Session): Session => copyOf(s, { template: true, date: '' });

/** Crea una sesión a partir de una plantilla, para la fecha indicada. */
export const fromTemplate = (t: Session, date: string): Session => copyOf(t, { template: false, date });

/** Minutos válidos: enteros entre 1 y 180. */
export const clampMinutes = (m: number) => Math.min(SESSION_LIMITS.minutes, Math.max(1, Math.round(Number.isFinite(m) ? m : 10)));

/** Inserta un bloque en la posición `at` (por defecto, al final). Sin hueco, la sesión no cambia. */
function insert(s: Session, block: SessionBlock, at = s.blocks.length): Session {
  if (s.blocks.length >= SESSION_LIMITS.blocks) return s;
  const blocks = [...s.blocks];
  blocks.splice(Math.max(0, Math.min(at, blocks.length)), 0, block);
  return { ...s, blocks };
}

/** Añade un ejercicio de la biblioteca. Los minutos salen del propio ejercicio. */
export function addExerciseBlock(s: Session, e: Exercise, at?: number): Session {
  return insert(s, { id: uid(), kind: 'exercise', exerciseId: e.id, snapshot: structuredClone(e), minutes: clampMinutes(e.minutes), note: '' }, at);
}

/** Añade un bloque de texto libre. */
export function addTextBlock(s: Session, title: string, minutes = 5, at?: number): Session {
  return insert(s, { id: uid(), kind: 'text', title: title.slice(0, SESSION_LIMITS.blockTitle), text: '', minutes: clampMinutes(minutes) }, at);
}

export function removeBlock(s: Session, blockId: string): Session {
  return { ...s, blocks: s.blocks.filter((b) => b.id !== blockId) };
}

/** Mueve el bloque de la posición `from` a la `to`. */
export function moveBlock(s: Session, from: number, to: number): Session {
  const n = s.blocks.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return s;
  const blocks = [...s.blocks];
  const [b] = blocks.splice(from, 1);
  blocks.splice(to, 0, b);
  return { ...s, blocks };
}

/** Cambia campos de un bloque (minutos, nota, título o texto). Los minutos se ajustan a 1-180. */
export function updateBlock(s: Session, blockId: string, patch: Partial<Pick<ExerciseBlock, 'minutes' | 'note'> & Pick<TextBlock, 'minutes' | 'title' | 'text'>>): Session {
  return {
    ...s,
    blocks: s.blocks.map((b) => {
      if (b.id !== blockId) return b;
      const minutes = patch.minutes === undefined ? b.minutes : clampMinutes(patch.minutes);
      if (b.kind === 'exercise') return { ...b, minutes, note: (patch.note ?? b.note).slice(0, SESSION_LIMITS.blockText) };
      return { ...b, minutes, title: (patch.title ?? b.title).slice(0, SESSION_LIMITS.blockTitle), text: (patch.text ?? b.text).slice(0, SESSION_LIMITS.blockText) };
    }),
  };
}

// ---------------------------------------------------------------------------
// Ejercicios: versión actual o copia de respaldo
// ---------------------------------------------------------------------------

export interface ResolvedBlock {
  block: SessionBlock;
  /** El ejercicio a mostrar (solo en bloques de ejercicio). */
  exercise?: Exercise;
  /** `live`: el de la biblioteca; `snapshot`: la copia (el original ya no existe). */
  source?: 'live' | 'snapshot';
}

/**
 * Para mostrar la sesión: cada bloque con su ejercicio. `library` son los ejercicios guardados
 * ahora mismo, indexados por id.
 */
export function resolveBlocks(s: Session, library: ReadonlyMap<string, Exercise>): ResolvedBlock[] {
  return s.blocks.map((block) => {
    if (block.kind === 'text') return { block };
    const live = library.get(block.exerciseId);
    return live ? { block, exercise: live, source: 'live' } : { block, exercise: block.snapshot, source: 'snapshot' };
  });
}

/** Actualiza las copias con la versión actual de cada ejercicio (se llama al guardar la sesión). */
export function refreshSnapshots(s: Session, library: ReadonlyMap<string, Exercise>): Session {
  let changed = false;
  const blocks = s.blocks.map((b) => {
    if (b.kind !== 'exercise') return b;
    const live = library.get(b.exerciseId);
    if (!live || live.updatedAt === b.snapshot.updatedAt) return b;
    changed = true;
    return { ...b, snapshot: structuredClone(live) };
  });
  return changed ? { ...s, blocks } : s;
}

// ---------------------------------------------------------------------------
// Tiempos
// ---------------------------------------------------------------------------

export const totalMinutes = (s: Session) => s.blocks.reduce((t, b) => t + b.minutes, 0);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isTime = (v: unknown): v is string => typeof v === 'string' && TIME_RE.test(v);

/** «18:30» + 95 minutos → «20:05». Da la vuelta a medianoche («23:30» + 45 → «00:15»). */
export function addMinutes(time: string, minutes: number): string {
  const m = TIME_RE.exec(time);
  if (!m) return '';
  const t = (((Number(m[1]) * 60 + Number(m[2]) + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Hora de fin, o vacía si no hay hora de inicio. */
export const endTime = (s: Session) => (isTime(s.startTime) ? addMinutes(s.startTime, totalMinutes(s)) : '');

/**
 * Cuándo empieza y acaba cada bloque, en minutos desde el inicio y, si hay hora de inicio, en reloj.
 * Sirve para la lista de la sesión y para el cronómetro del modo entreno.
 */
export function blockSchedule(s: Session): { id: string; from: number; to: number; clockFrom: string; clockTo: string }[] {
  let t = 0;
  return s.blocks.map((b) => {
    const from = t;
    t += b.minutes;
    return { id: b.id, from, to: t, clockFrom: addMinutes(s.startTime, from), clockTo: addMinutes(s.startTime, t) };
  });
}

/** «95 min» → «1 h 35 min». */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

// ---------------------------------------------------------------------------
// Lista de sesiones: fechas y grupos
// ---------------------------------------------------------------------------

/** Fecha de hoy `AAAA-MM-DD` en la hora local (no en UTC: a las 00:30 en España sigue siendo hoy). */
export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Partes de una fecha para mostrarla: «mar», «17», «nov» y «martes, 17 de noviembre de 2026». */
export function dateParts(iso: string): { weekday: string; day: string; month: string; long: string } | null {
  if (!isDate(iso)) return null;
  // a mediodía UTC y mostrada en UTC: así el día no cambia por la zona horaria
  const d = new Date(`${iso}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', ...o }).format(d).replace('.', '');
  return { weekday: f({ weekday: 'short' }), day: f({ day: 'numeric' }), month: f({ month: 'short' }), long: f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
}

/**
 * Agrupa las sesiones para la lista: próximas (de hoy en adelante, la más cercana primero),
 * sin fecha (la última modificada primero) y pasadas (la más reciente primero).
 */
export function groupSessions(list: Session[], today: string) {
  const byDate = (a: Session, b: Session) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
  const real = list.filter((s) => !s.template);
  return {
    upcoming: real.filter((s) => s.date && s.date >= today).sort(byDate),
    undated: real.filter((s) => !s.date).sort((a, b) => b.updatedAt - a.updatedAt),
    past: real.filter((s) => s.date && s.date < today).sort((a, b) => byDate(b, a)),
    templates: list.filter((s) => s.template).sort((a, b) => a.title.localeCompare(b.title, 'es')),
  };
}

/**
 * Filtro de la lista por equipo: '' = todas, 'none' = sin equipo, o el id de un equipo.
 * Las plantillas sin equipo se ven siempre (sirven para cualquiera).
 */
export function filterByTeam(list: Session[], filter: string): Session[] {
  if (!filter) return list;
  if (filter === 'none') return list.filter((s) => !s.teamId);
  return list.filter((s) => s.teamId === filter || (s.template && !s.teamId));
}

/** Copia de una sesión con id nuevo (para «Duplicar»): misma estructura, sin fecha ni notas del entreno. */
export const duplicateSession = (s: Session): Session => copyOf(s, { title: `${s.title} (copia)`.slice(0, SESSION_LIMITS.title), date: '' });

// ---------------------------------------------------------------------------
// Leer datos de fuera (base de datos o archivo)
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Fecha `AAAA-MM-DD` que existe de verdad (no vale 2026-02-30). */
export function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v : fallback).slice(0, max);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const ID_RE = /^[\w-]{1,64}$/;

function parseBlock(raw: unknown): SessionBlock | null {
  if (!isObj(raw)) return null;
  const id = typeof raw.id === 'string' && ID_RE.test(raw.id) ? raw.id : uid();
  const minutes = clampMinutes(num(raw.minutes, 10));
  if (raw.kind === 'text') return { id, kind: 'text', title: text(raw.title, SESSION_LIMITS.blockTitle, 'Bloque'), text: text(raw.text, SESSION_LIMITS.blockText), minutes };
  if (raw.kind === 'exercise' && typeof raw.exerciseId === 'string' && raw.exerciseId) {
    const snapshot = parseExercise(raw.snapshot);
    if (!snapshot) return null; // sin copia válida no hay nada que mostrar si el ejercicio falta
    return { id, kind: 'exercise', exerciseId: raw.exerciseId.slice(0, 64), snapshot, minutes, note: text(raw.note, SESSION_LIMITS.blockText) };
  }
  return null;
}

function parseReview(raw: unknown): SessionReview {
  if (!isObj(raw)) return { ...EMPTY_REVIEW };
  return { done: raw.done === true, rating: Math.max(0, Math.min(5, Math.round(num(raw.rating, 0)))), notes: text(raw.notes, SESSION_LIMITS.notes) };
}

/**
 * Convierte datos de fuera en una sesión válida, o `null` si no se puede salvar.
 * Lo que está mal se repara o se descarta (un bloque roto se quita, una fecha imposible se vacía).
 */
export function parseSession(raw: unknown): Session | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return null;
  const now = Date.now();
  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : [])
    .slice(0, SESSION_LIMITS.blocks)
    .map(parseBlock)
    .filter((b): b is SessionBlock => b !== null);
  return {
    version: 1,
    id: raw.id,
    title: text(raw.title, SESSION_LIMITS.title, 'Sesión'),
    date: isDate(raw.date) ? raw.date : '',
    startTime: isTime(raw.startTime) ? raw.startTime : '',
    teamId: typeof raw.teamId === 'string' && ID_RE.test(raw.teamId) ? raw.teamId : '',
    team: text(raw.team, SESSION_LIMITS.team),
    goal: text(raw.goal, SESSION_LIMITS.goal),
    notes: text(raw.notes, SESSION_LIMITS.notes),
    blocks,
    // las sesiones guardadas antes de existir plantillas y notas del entreno no los tienen
    template: raw.template === true,
    review: parseReview(raw.review),
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
  };
}
