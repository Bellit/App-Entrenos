/**
 * Importar archivos de fuera como ejercicios: TypeScript puro, sin React.
 * Acepta tres formas de archivo .json:
 *  - una jugada suelta de ATO (`.jugada.json`),
 *  - una copia de seguridad de ATO (varias jugadas),
 *  - un ejercicio de esta app.
 * Siempre se crean ejercicios con identificador nuevo: importar nunca pisa lo que ya hay.
 */
import { uid } from './common';
import { EXERCISE_LIMITS, type Exercise, newExercise, parseExercise } from './exercise';
import { parsePlay } from './parse';
import type { Play } from './types';

export const ATO_BACKUP_FORMAT = 'pizarra-jugadas-copia';
export const IMPORT_LIMITS = { fileBytes: 20_000_000, playBytes: 1_000_000, plays: 1000 };

/** Envuelve una jugada de ATO en un ejercicio nuevo: el nombre de la jugada pasa a ser el título. */
export function exerciseFromPlay(play: Play): Exercise {
  const base = newExercise((play.name || 'Ejercicio importado').slice(0, EXERCISE_LIMITS.title));
  return { ...base, play: { ...play, id: uid() } };
}

export interface ImportResult {
  exercises: Exercise[];
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
    return { exercises, skipped };
  }

  // ejercicio de esta app (tiene `play` dentro)
  if ('play' in d) {
    const e = parseExercise({ ...d, id: typeof d.id === 'string' && d.id ? d.id : uid() });
    if (!e) throw new Error('El ejercicio del archivo está dañado.');
    const now = Date.now();
    return { exercises: [{ ...e, id: uid(), play: { ...e.play, id: uid() }, createdAt: now, updatedAt: now }], skipped: 0 };
  }

  // jugada suelta de ATO
  try {
    return { exercises: [exerciseFromPlay(parsePlay(data))], skipped: 0 };
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
