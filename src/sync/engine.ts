/**
 * Motor de sincronización: TypeScript puro. No sabe nada de Supabase ni de IndexedDB; habla con dos
 * «adaptadores» (`Local` y `Remote`). Así se puede probar con tests usando una nube y un dispositivo
 * de mentira, y si un día se cambia de servicio solo hay que escribir otro adaptador.
 *
 * Una pasada (`syncOnce`) hace, para ejercicios y para sesiones:
 *  1. BAJAR lo que ha cambiado en la nube desde la última vez (cursor = hora del servidor).
 *     - Si aquí no se ha tocado ese documento, se aplica tal cual.
 *     - Si aquí también se ha cambiado (está en la cola de salida), gana el cambio más reciente
 *       (`updatedAt`); si gana la nube, se descarta el cambio local.
 *  2. SUBIR lo que queda en la cola de salida (cambios y borrados hechos aquí).
 *
 * Los borrados viajan como «marca de borrado» (deleted = true): si simplemente se quitara la fila,
 * el otro dispositivo no se enteraría y la volvería a subir.
 */
import type { Kind, OutboxEntry } from '../data/db';

export const KINDS: Kind[] = ['exercises', 'sessions', 'squads'];

export interface RemoteRow {
  id: string;
  data: unknown;
  deleted: boolean;
  /** Cuándo se cambió en el dispositivo que lo subió (ms). Decide quién gana. */
  updated_at: number;
  /** Cuándo llegó al servidor. Sirve de cursor para pedir solo lo nuevo. */
  synced_at: string;
}

export interface Remote {
  /** Filas cambiadas después de `since` (o todas si es null), ordenadas por synced_at. */
  pull(kind: Kind, since: string | null): Promise<RemoteRow[]>;
  /** Crea o reemplaza filas. */
  push(kind: Kind, rows: Omit<RemoteRow, 'synced_at'>[]): Promise<void>;
}

export interface Local {
  get(kind: Kind, id: string): Promise<{ id: string; updatedAt: number } | undefined>;
  outbox(): Promise<OutboxEntry[]>;
  clearOutbox(entries: OutboxEntry[]): Promise<void>;
  dropOutbox(kind: Kind, id: string): Promise<unknown>;
  applyRemote(kind: Kind, id: string, data: unknown, deleted: boolean): Promise<boolean>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<unknown>;
}

export interface SyncResult {
  /** Documentos que han cambiado en este dispositivo por lo bajado. */
  pulled: number;
  pushed: number;
}

const cursorKey = (kind: Kind) => `cursor.${kind}`;

export async function syncOnce(local: Local, remote: Remote): Promise<SyncResult> {
  let pulled = 0;
  let pushed = 0;
  for (const kind of KINDS) {
    // 1 · bajar
    const since = await local.getMeta(cursorKey(kind));
    const rows = await remote.pull(kind, since);
    const pending = new Map((await local.outbox()).filter((e) => e.kind === kind).map((e) => [e.id, e]));
    let cursor = since;
    for (const row of rows) {
      const mine = pending.get(row.id);
      if (mine) {
        const doc = await local.get(kind, row.id);
        const localTime = doc?.updatedAt ?? mine.deletedAt ?? mine.at;
        if (row.updated_at >= localTime) {
          // la nube tiene algo más reciente: gana, y el cambio de aquí se descarta
          if (await local.applyRemote(kind, row.id, row.data, row.deleted)) pulled++;
          await local.dropOutbox(kind, row.id);
          pending.delete(row.id);
        }
        // si gana lo de aquí, no se toca: se subirá en el paso 2
      } else if (await local.applyRemote(kind, row.id, row.data, row.deleted)) pulled++;
      if (!cursor || row.synced_at > cursor) cursor = row.synced_at;
    }
    if (cursor && cursor !== since) await local.setMeta(cursorKey(kind), cursor);

    // 2 · subir
    const entries = [...pending.values()];
    if (!entries.length) continue;
    const out: Omit<RemoteRow, 'synced_at'>[] = [];
    for (const e of entries) {
      const doc = await local.get(kind, e.id);
      out.push(doc ? { id: e.id, data: doc, deleted: false, updated_at: doc.updatedAt } : { id: e.id, data: null, deleted: true, updated_at: e.deletedAt ?? e.at });
    }
    // en tandas, para no mandar una petición enorme
    for (let i = 0; i < out.length; i += 50) await remote.push(kind, out.slice(i, i + 50));
    await local.clearOutbox(entries);
    pushed += out.length;
  }
  return { pulled, pushed };
}
