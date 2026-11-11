/**
 * Base de datos local (IndexedDB, con Dexie). Guarda los ejercicios en el propio dispositivo,
 * así la app funciona sin conexión. Todo lo que se lee pasa por `parseExercise`, que descarta o
 * repara lo dañado: un dato roto nunca tumba la pantalla.
 */
import Dexie, { type EntityTable } from 'dexie';
import { type Exercise, parseExercise } from '../model/exercise';
import { parseSession, type Session } from '../model/session';

class EntrenosDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  constructor() {
    // El nombre interno sigue siendo «entrenos» aunque la app se llame Run it: si cambiara, cada
    // navegador abriría una base de datos vacía y no encontraría lo ya guardado. Lo mismo pasa con
    // las claves «entrenos.*» de localStorage y con el formato «entrenos-copia» de las copias.
    super('entrenos-bsk');
    // «&id» = clave primaria; «updatedAt» = índice para ordenar por lo último modificado
    this.version(1).stores({ exercises: '&id, updatedAt' });
    // versión 2: se añade la tabla de sesiones (con índice por fecha). Dexie actualiza la base
    // de datos de cada navegador sola al abrirla, sin tocar los ejercicios ya guardados.
    this.version(2).stores({ exercises: '&id, updatedAt', sessions: '&id, updatedAt, date' });
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

// ---------------------------------------------------------------------------
// Sesiones (igual que los ejercicios: todo lo leído pasa por `parseSession`)
// ---------------------------------------------------------------------------

/** Todas las sesiones válidas (el orden por fecha lo decide la pantalla). */
export async function listSessions(): Promise<Session[]> {
  const rows = await db.sessions.toArray();
  return rows.map(parseSession).filter((s): s is Session => s !== null);
}

export async function getSession(id: string): Promise<Session | null> {
  return parseSession(await db.sessions.get(id));
}

export async function saveSession(s: Session): Promise<void> {
  await db.sessions.put(s);
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id);
}
