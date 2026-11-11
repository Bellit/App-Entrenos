/**
 * Importar archivos de fuera como ejercicios: TypeScript puro, sin React.
 * Acepta tres formas de archivo .json:
 *  - una jugada suelta de ATO (`.jugada.json`),
 *  - una copia de seguridad de ATO (varias jugadas),
 *  - un ejercicio de esta app o su copia de seguridad (todos los ejercicios).
 * Siempre se crean ejercicios con identificador nuevo: importar nunca pisa lo que ya hay.
 */
import { uid } from './common';
import { EXERCISE_LIMITS, type Exercise, newExercise, parseExercise } from './exercise';
import { parsePlay } from './parse';
import { parseSession, type Session } from './session';
import type { Play } from './types';

export const ATO_BACKUP_FORMAT = 'pizarra-jugadas-copia';
/** Copia de seguridad de esta app: todos los ejercicios en un archivo. */
export const BACKUP_FORMAT = 'entrenos-copia';
export const IMPORT_LIMITS = { fileBytes: 20_000_000, playBytes: 1_000_000, plays: 1000 };

/** Contenido del archivo de copia de seguridad (se convierte a JSON para descargarlo). */
export const backupData = (exercises: Exercise[], sessions: Session[] = []) => ({ format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), exercises, sessions });

/**
 * Sesiones de una copia, con ids nuevos. Sus bloques apuntan a los ejercicios importados con sus
 * ids nuevos (`newIds`: id antiguo → nuevo); si un ejercicio no venía en la copia, se usará la
 * copia de respaldo que guarda el propio bloque.
 */
function sessionsFrom(raw: unknown, newIds: Map<string, string>): Session[] {
  if (!Array.isArray(raw)) return [];
  const out: Session[] = [];
  for (const r of raw.slice(0, IMPORT_LIMITS.plays)) {
    const s = parseSession(r);
    if (!s) continue;
    const now = Date.now();
    out.push({
      ...s,
      id: uid(),
      blocks: s.blocks.map((b) => (b.kind === 'exercise' ? { ...b, id: uid(), exerciseId: newIds.get(b.exerciseId) ?? b.exerciseId } : { ...b, id: uid() })),
      createdAt: now,
      updatedAt: now,
    });
  }
  return out;
}

/** Nombre del archivo de copia, con la fecha: `run-it-copia-2026-11-11.json`. */
export const backupFileName = (d = new Date()) => `run-it-copia-${d.toISOString().slice(0, 10)}.json`;

/** Convierte un ejercicio leído de un archivo en uno nuevo (identificadores y fechas nuevos). */
function freshCopy(raw: Record<string, unknown>): Exercise | null {
  const e = parseExercise({ ...raw, id: typeof raw.id === 'string' && raw.id ? raw.id : uid() });
  if (!e) return null;
  const now = Date.now();
  return { ...e, id: uid(), play: { ...e.play, id: uid() }, createdAt: now, updatedAt: now };
}

/** Envuelve una jugada de ATO en un ejercicio nuevo: el nombre de la jugada pasa a ser el título. */
export function exerciseFromPlay(play: Play): Exercise {
  const base = newExercise((play.name || 'Ejercicio importado').slice(0, EXERCISE_LIMITS.title));
  return { ...base, play: { ...play, id: uid() } };
}

export interface ImportResult {
  exercises: Exercise[];
  /** Solo en copias de seguridad de esta app. */
  sessions: Session[];
  /** Elementos del archivo que no se han podido leer. */
  skipped: number;
}

/** Lee el contenido ya convertido de JSON y devuelve los ejercicios que contiene (o lanza un error claro). */
export function exercisesFromData(data: unknown): ImportResult {
  if (!data || typeof data !== 'object') throw new Error('El archivo no tiene el formato de una jugada ni de un ejercicio.');
  const d = data as Record<string, unknown>;

  // copia de seguridad de ATO: varias jugadas
  if (d.format === ATO_BACKUP_FORMAT && Array.isArray(d.plays)) {
    const exercises: Exercise[] = [];
    let skipped = 0;
    for (const p of d.plays.slice(0, IMPORT_LIMITS.plays)) {
      try {
        if (JSON.stringify(p).length > IMPORT_LIMITS.playBytes) throw new Error('grande');
        exercises.push(exerciseFromPlay(parsePlay(p)));
      } catch {
        skipped++; // se salta la jugada dañada y se sigue con las demás
      }
    }
    if (!exercises.length) throw new Error('La copia no contiene jugadas válidas.');
    return { exercises, sessions: [], skipped };
  }

  // copia de seguridad de esta app: ejercicios y sesiones
  if (d.format === BACKUP_FORMAT && Array.isArray(d.exercises)) {
    const exercises: Exercise[] = [];
    const newIds = new Map<string, string>();
    let skipped = 0;
    for (const raw of d.exercises.slice(0, IMPORT_LIMITS.plays)) {
      const e = raw && typeof raw === 'object' ? freshCopy(raw as Record<string, unknown>) : null;
      if (e) {
        exercises.push(e);
        const oldId = (raw as Record<string, unknown>).id;
        if (typeof oldId === 'string') newIds.set(oldId, e.id);
      } else skipped++;
    }
    const sessions = sessionsFrom(d.sessions, newIds);
    if (!exercises.length && !sessions.length) throw new Error('La copia no contiene ejercicios ni sesiones válidos.');
    return { exercises, sessions, skipped };
  }

  // ejercicio suelto de esta app (tiene `play` dentro)
  if ('play' in d) {
    const e = freshCopy(d);
    if (!e) throw new Error('El ejercicio del archivo está dañado.');
    return { exercises: [e], sessions: [], skipped: 0 };
  }

  // jugada suelta de ATO
  try {
    return { exercises: [exerciseFromPlay(parsePlay(data))], sessions: [], skipped: 0 };
  } catch {
    throw new Error('El archivo no tiene el formato de una jugada ni de un ejercicio.');
  }
}

/** Lee un archivo `.json` del ordenador. Rechaza los que son demasiado grandes antes de leerlos. */
export async function readImportFile(file: File): Promise<ImportResult> {
  if (file.size > IMPORT_LIMITS.fileBytes) throw new Error('El archivo es demasiado grande.');
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es un .json válido.');
  }
  return exercisesFromData(data);
}
