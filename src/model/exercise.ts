/**
 * Modelo de un ejercicio de entrenamiento: TypeScript puro, sin React.
 * Un ejercicio envuelve una `Play` (los fotogramas que dibuja la pizarra copiada de ATO)
 * y le añade lo que necesita un entreno: título, explicación, categoría, etiquetas y minutos.
 */
import { newPlay } from './create';
import { uid } from './common';
import { parsePlay } from './parse';
import type { Play } from './types';

/** Categorías de ejercicio (lista cerrada, sale de la ficha de entrenamiento en papel). */
export const EXERCISE_CATEGORIES = [
  { id: 'calentamiento', name: 'Calentamiento' },
  { id: 'tiro', name: 'Tiro' },
  { id: '1c1', name: '1c1' },
  { id: '2c2', name: '2c2' },
  { id: '3c3', name: '3c3' },
  { id: 'contraataque', name: 'Contraataque' },
  { id: '5c5', name: '5c5' },
  { id: 'defensa', name: 'Defensa' },
  { id: 'fisico', name: 'Físico' },
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number]['id'];
export const isExerciseCategory = (v: unknown): v is ExerciseCategory => EXERCISE_CATEGORIES.some((c) => c.id === v);
export const categoryName = (id: ExerciseCategory | '') => EXERCISE_CATEGORIES.find((c) => c.id === id)?.name ?? 'Sin categoría';

/** Plantillas para la explicación: la corta para lo ya trabajado, la completa para un concepto nuevo. */
export const NOTES_TEMPLATES = [
  { id: 'corta', name: 'Corta', text: 'Objetivo: \nCómo se hace: \n' },
  { id: 'completa', name: 'Completa', text: 'Objetivo:\n\nOrganización:\n\nDesarrollo:\n\nVariantes:\n\nPuntos clave:\n- \n' },
] as const;

export const EXERCISE_LIMITS = { title: 80, notes: 6000, tags: 12, tag: 30, minutes: 180 };

export interface Exercise {
  version: 1;
  id: string;
  title: string;
  /** Vacía si todavía no se ha clasificado. */
  category: ExerciseCategory | '';
  tags: string[];
  /** Explicación del ejercicio en texto sencillo (admite líneas en blanco y listas con «- »). */
  notes: string;
  /** Duración sugerida, en minutos. */
  minutes: number;
  play: Play;
  createdAt: number;
  updatedAt: number;
}

export function newExercise(title = 'Ejercicio nuevo'): Exercise {
  const now = Date.now();
  return {
    version: 1,
    id: uid(),
    title,
    category: '',
    tags: [],
    notes: '',
    minutes: 10,
    play: newPlay(title, 'half'),
    createdAt: now,
    updatedAt: now,
  };
}

/** Quita espacios y mayúsculas de una etiqueta: «  Bloqueo Indirecto » → «bloqueo indirecto». */
export const normalizeTag = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, EXERCISE_LIMITS.tag);

/** Añade una etiqueta si es nueva y cabe. Devuelve la lista nueva (no modifica la original). */
export function addTag(tags: string[], raw: string): string[] {
  const t = normalizeTag(raw);
  if (!t || tags.includes(t) || tags.length >= EXERCISE_LIMITS.tags) return tags;
  return [...tags, t];
}

/** Texto sin tildes ni mayúsculas, para buscar sin fijarse en cómo está escrito. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ¿Encaja el ejercicio con la búsqueda (título, etiquetas y explicación) y los filtros? */
export function matchesFilters(e: Exercise, query: string, category: ExerciseCategory | '', tag: string): boolean {
  if (category && e.category !== category) return false;
  if (tag && !e.tags.includes(tag)) return false;
  const q = fold(query.trim());
  if (!q) return true;
  return fold(`${e.title} ${e.tags.join(' ')} ${e.notes}`).includes(q);
}

/**
 * Convierte datos de fuera (la base de datos o un archivo) en un ejercicio válido, o `null` si no
 * se puede salvar. La pizarra se valida con `parsePlay` de ATO; lo demás se repara o se descarta.
 */
export function parseExercise(raw: unknown): Exercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  let play: Play;
  try {
    play = parsePlay(r.play); // lanza un error si el dibujo no se puede usar
  } catch {
    return null;
  }
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string').map(normalizeTag).filter(Boolean) : [];
  const now = Date.now();
  return {
    version: 1,
    id: r.id.slice(0, 64),
    title: (typeof r.title === 'string' ? r.title : 'Ejercicio').slice(0, EXERCISE_LIMITS.title),
    category: isExerciseCategory(r.category) ? r.category : '',
    tags: [...new Set(tags)].slice(0, EXERCISE_LIMITS.tags),
    notes: (typeof r.notes === 'string' ? r.notes : '').slice(0, EXERCISE_LIMITS.notes),
    minutes: Math.min(EXERCISE_LIMITS.minutes, Math.max(1, Math.round(num(r.minutes, 10)))),
    play,
    createdAt: num(r.createdAt, now),
    updatedAt: num(r.updatedAt, now),
  };
}

/** Copia de un ejercicio con identificador nuevo (para «Duplicar»). */
export function duplicateExercise(e: Exercise): Exercise {
  const now = Date.now();
  const copy = structuredClone(e);
  return { ...copy, id: uid(), title: `${e.title} (copia)`.slice(0, EXERCISE_LIMITS.title), play: { ...copy.play, id: uid() }, createdAt: now, updatedAt: now };
}
