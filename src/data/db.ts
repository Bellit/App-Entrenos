/**
 * Base de datos local (IndexedDB, con Dexie). Guarda ejercicios y sesiones en el propio dispositivo,
 * así la app funciona sin conexión. Todo lo que se lee pasa por `parseExercise` / `parseSession`,
 * que descartan o reparan lo dañado: un dato roto nunca tumba la pantalla.
 *
 * Sincronización (ver `src/sync/`): cada cambio que se hace en este dispositivo se anota en una
 * «cola de salida» (`outbox`) para subirlo a la nube. Los cambios que bajan de la nube se aplican
 * con `applyRemote*`, que NO se anotan (si no, se volverían a subir sin fin).
 */
import Dexie, { type EntityTable } from 'dexie';
import { type Exercise, parseExercise } from '../model/exercise';
import { parseSession, type Session } from '../model/session';

export type Kind = 'exercises' | 'sessions';

/** Un cambio pendiente de subir. `at` = cuándo se anotó (para no borrar uno anotado de nuevo mientras se subía). */
export interface OutboxEntry {
  key: string; // «exercises:abc123»
  kind: Kind;
  id: string;
  at: number;
  /** Si es un borrado: cuándo se borró. */
  deletedAt?: number;
}

class EntrenosDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'key'>;
  meta!: EntityTable<{ key: string; value: string }, 'key'>;
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
    // versión 3: sincronización. `outbox` = cambios pendientes de subir; `meta` = datos de la
    // sincronización (hasta dónde se ha bajado de la nube, con qué cuenta).
    this.version(3).stores({ exercises: '&id, updatedAt', sessions: '&id, updatedAt, date', outbox: '&key, kind', meta: '&key' });
  }
}

const db = new EntrenosDb();

// ---------------------------------------------------------------------------
// Avisos: «algo ha cambiado aquí» (para programar una sincronización) y «ha llegado algo de la
// nube» (para que las listas se vuelvan a leer)
// ---------------------------------------------------------------------------

const localListeners = new Set<() => void>();
const remoteListeners = new Set<() => void>();
export const onLocalChange = (fn: () => void) => (localListeners.add(fn), () => void localListeners.delete(fn));
export const onRemoteChange = (fn: () => void) => (remoteListeners.add(fn), () => void remoteListeners.delete(fn));
export const notifyRemoteChange = () => remoteListeners.forEach((fn) => fn());

const outboxKey = (kind: Kind, id: string) => `${kind}:${id}`;
/** Anota un cambio hecho en este dispositivo para subirlo. */
async function mark(kind: Kind, id: string, deleted = false) {
  const now = Date.now();
  await db.outbox.put({ key: outboxKey(kind, id), kind, id, at: now, ...(deleted ? { deletedAt: now } : {}) });
}
const changed = () => localListeners.forEach((fn) => fn());

// ---------------------------------------------------------------------------
// Ejercicios
// ---------------------------------------------------------------------------

/** Todos los ejercicios válidos, del más reciente al más antiguo. */
export async function listExercises(): Promise<Exercise[]> {
  const rows = await db.exercises.orderBy('updatedAt').reverse().toArray();
  return rows.map(parseExercise).filter((e): e is Exercise => e !== null);
}

export async function getExercise(id: string): Promise<Exercise | null> {
  return parseExercise(await db.exercises.get(id));
}

export async function saveExercise(e: Exercise): Promise<void> {
  await db.transaction('rw', db.exercises, db.outbox, async () => {
    await db.exercises.put(e);
    await mark('exercises', e.id);
  });
  changed();
}

export async function deleteExercise(id: string): Promise<void> {
  await db.transaction('rw', db.exercises, db.outbox, async () => {
    await db.exercises.delete(id);
    await mark('exercises', id, true);
  });
  changed();
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
  await db.transaction('rw', db.sessions, db.outbox, async () => {
    await db.sessions.put(s);
    await mark('sessions', s.id);
  });
  changed();
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.outbox, async () => {
    await db.sessions.delete(id);
    await mark('sessions', id, true);
  });
  changed();
}

// ---------------------------------------------------------------------------
// Para el motor de sincronización (src/sync/engine.ts)
// ---------------------------------------------------------------------------

const table = (kind: Kind) => (kind === 'exercises' ? db.exercises : db.sessions);
const parse = (kind: Kind, raw: unknown) => (kind === 'exercises' ? parseExercise(raw) : parseSession(raw));

export const syncLocal = {
  /** El documento guardado aquí (sin validar: se sube tal cual está). */
  get: (kind: Kind, id: string) => table(kind).get(id) as Promise<(Exercise | Session) | undefined>,
  outbox: () => db.outbox.toArray(),
  /** Quita de la cola lo ya subido, salvo lo que se haya vuelto a cambiar mientras tanto. */
  async clearOutbox(entries: OutboxEntry[]) {
    await db.transaction('rw', db.outbox, async () => {
      for (const e of entries) {
        const now = await db.outbox.get(e.key);
        if (now && now.at === e.at) await db.outbox.delete(e.key);
      }
    });
  },
  dropOutbox: (kind: Kind, id: string) => db.outbox.delete(outboxKey(kind, id)),
  /** Aplica lo que llega de la nube, sin anotarlo para subir. Devuelve si ha cambiado algo aquí. */
  async applyRemote(kind: Kind, id: string, data: unknown, deleted: boolean): Promise<boolean> {
    const t = table(kind);
    const current = (await t.get(id)) as { updatedAt?: number } | undefined;
    if (deleted || data == null) {
      if (!current) return false;
      await t.delete(id);
      return true;
    }
    const doc = parse(kind, data);
    if (!doc || doc.id !== id) return false; // dañado o manipulado: se ignora
    if (current?.updatedAt === doc.updatedAt) return false; // es lo mismo que ya hay
    await (t as EntityTable<Exercise | Session, 'id'>).put(doc);
    return true;
  },
  /** Anota TODO lo que hay en este dispositivo para subirlo (la primera vez que se entra). */
  async markAll() {
    for (const kind of ['exercises', 'sessions'] as Kind[]) {
      const ids = (await table(kind).toCollection().primaryKeys()) as string[];
      for (const id of ids) await mark(kind, id);
    }
  },
  getMeta: async (key: string) => (await db.meta.get(key))?.value ?? null,
  setMeta: (key: string, value: string) => db.meta.put({ key, value }),
  delMeta: (key: string) => db.meta.delete(key),
};
