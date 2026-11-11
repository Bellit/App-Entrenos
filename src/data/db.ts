/**
 * Base de datos local (IndexedDB, con Dexie). Guarda los ejercicios en el propio dispositivo,
 * así la app funciona sin conexión. Todo lo que se lee pasa por `parseExercise`, que descarta o
 * repara lo dañado: un dato roto nunca tumba la pantalla.
 */
import Dexie, { type EntityTable } from 'dexie';
import { type Exercise, parseExercise } from '../model/exercise';

class EntrenosDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  constructor() {
    super('entrenos-bsk');
    // «&id» = clave primaria; «updatedAt» = índice para ordenar por lo último modificado
    this.version(1).stores({ exercises: '&id, updatedAt' });
  }
}

const db = new EntrenosDb();

/** Todos los ejercicios válidos, del más reciente al más antiguo. */
export async function listExercises(): Promise<Exercise[]> {
  const rows = await db.exercises.orderBy('updatedAt').reverse().toArray();
  return rows.map(parseExercise).filter((e): e is Exercise => e !== null);
}

export async function getExercise(id: string): Promise<Exercise | null> {
  return parseExercise(await db.exercises.get(id));
}

export async function saveExercise(e: Exercise): Promise<void> {
  await db.exercises.put(e);
}

export async function deleteExercise(id: string): Promise<void> {
  await db.exercises.delete(id);
}
