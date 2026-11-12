import { describe, expect, it } from 'vitest';
import type { Kind, OutboxEntry } from '../data/db';
import { type Local, type Remote, type RemoteRow, syncOnce } from './engine';

/** Una nube de mentira: guarda filas por tipo y les pone la «hora del servidor» al llegar. */
function fakeCloud() {
  const rows: Record<Kind, Map<string, RemoteRow>> = { exercises: new Map(), sessions: new Map(), squads: new Map() };
  let clock = 0;
  const remote: Remote = {
    async pull(kind, since) {
      return [...rows[kind].values()].filter((r) => !since || r.synced_at > since).sort((a, b) => a.synced_at.localeCompare(b.synced_at));
    },
    async push(kind, list) {
      for (const r of list) rows[kind].set(r.id, { ...structuredClone(r), synced_at: String(++clock).padStart(6, '0') });
    },
  };
  return { rows, remote };
}

/** Un dispositivo de mentira, con las mismas reglas que db.ts (cola de salida, aplicar sin anotar). */
function fakeDevice() {
  const docs: Record<Kind, Map<string, { id: string; updatedAt: number; title: string }>> = { exercises: new Map(), sessions: new Map(), squads: new Map() };
  const outbox = new Map<string, OutboxEntry>();
  const meta = new Map<string, string>();
  let t = 1000;
  const local: Local = {
    async get(kind, id) {
      return docs[kind].get(id);
    },
    async outbox() {
      return [...outbox.values()];
    },
    async clearOutbox(entries) {
      for (const e of entries) if (outbox.get(e.key)?.at === e.at) outbox.delete(e.key);
    },
    async dropOutbox(kind, id) {
      outbox.delete(`${kind}:${id}`);
    },
    async applyRemote(kind, id, data, deleted) {
      if (deleted) return docs[kind].delete(id);
      const d = data as { id: string; updatedAt: number; title: string };
      if (docs[kind].get(id)?.updatedAt === d.updatedAt) return false;
      docs[kind].set(id, structuredClone(d));
      return true;
    },
    async getMeta(k) {
      return meta.get(k) ?? null;
    },
    async setMeta(k, v) {
      meta.set(k, v);
    },
  };
  const at = () => (t += 10);
  return {
    local,
    docs,
    outbox,
    /** Como saveExercise: guarda y anota para subir. */
    save(kind: Kind, id: string, title: string) {
      const now = at();
      docs[kind].set(id, { id, updatedAt: now, title });
      outbox.set(`${kind}:${id}`, { key: `${kind}:${id}`, kind, id, at: now });
    },
    remove(kind: Kind, id: string) {
      const now = at();
      docs[kind].delete(id);
      outbox.set(`${kind}:${id}`, { key: `${kind}:${id}`, kind, id, at: now, deletedAt: now });
    },
    /** Para simular relojes: el siguiente cambio será posterior a `ms`. */
    setClock(ms: number) {
      t = ms;
    },
  };
}

describe('sincronización', () => {
  it('lo creado en un dispositivo llega al otro', async () => {
    const { remote } = fakeCloud();
    const pc = fakeDevice();
    const movil = fakeDevice();
    pc.save('exercises', 'e1', 'Rueda de tiro');
    pc.save('sessions', 's1', 'Martes');
    expect(await syncOnce(pc.local, remote)).toEqual({ pulled: 0, pushed: 2 });
    expect(pc.outbox.size).toBe(0);
    await syncOnce(movil.local, remote);
    expect(movil.docs.exercises.get('e1')?.title).toBe('Rueda de tiro');
    expect(movil.docs.sessions.get('s1')?.title).toBe('Martes');
    expect(movil.outbox.size).toBe(0); // lo bajado no se vuelve a subir
  });

  it('los cambios siguientes también viajan, y solo se baja lo nuevo', async () => {
    const { remote } = fakeCloud();
    const pc = fakeDevice();
    const movil = fakeDevice();
    pc.save('exercises', 'e1', 'v1');
    await syncOnce(pc.local, remote);
    await syncOnce(movil.local, remote);
    movil.setClock(5000);
    movil.save('exercises', 'e1', 'v2 desde el móvil');
    await syncOnce(movil.local, remote);
    const r = await syncOnce(pc.local, remote);
    expect(r.pulled).toBe(1);
    expect(pc.docs.exercises.get('e1')?.title).toBe('v2 desde el móvil');
  });

  it('un borrado llega al otro dispositivo y no reaparece', async () => {
    const { remote, rows } = fakeCloud();
    const pc = fakeDevice();
    const movil = fakeDevice();
    pc.save('exercises', 'e1', 'Para borrar');
    await syncOnce(pc.local, remote);
    await syncOnce(movil.local, remote);
    movil.setClock(5000);
    movil.remove('exercises', 'e1');
    await syncOnce(movil.local, remote);
    expect(rows.exercises.get('e1')?.deleted).toBe(true);
    await syncOnce(pc.local, remote);
    expect(pc.docs.exercises.has('e1')).toBe(false);
    await syncOnce(pc.local, remote);
    expect(rows.exercises.get('e1')?.deleted).toBe(true);
  });

  it('si se cambia lo mismo en los dos, gana el cambio más reciente', async () => {
    const { remote } = fakeCloud();
    const pc = fakeDevice();
    const movil = fakeDevice();
    pc.save('exercises', 'e1', 'original');
    await syncOnce(pc.local, remote);
    await syncOnce(movil.local, remote);
    // los dos lo cambian sin sincronizar; el del móvil es posterior
    pc.setClock(5000);
    pc.save('exercises', 'e1', 'del ordenador');
    movil.setClock(6000);
    movil.save('exercises', 'e1', 'del móvil');
    await syncOnce(movil.local, remote);
    await syncOnce(pc.local, remote); // baja el del móvil, que es más reciente: gana
    expect(pc.docs.exercises.get('e1')?.title).toBe('del móvil');
    expect(pc.outbox.size).toBe(0); // su cambio, más antiguo, se descarta
  });

  it('si lo de aquí es más reciente que lo de la nube, se sube lo de aquí', async () => {
    const { remote, rows } = fakeCloud();
    const pc = fakeDevice();
    const movil = fakeDevice();
    pc.save('exercises', 'e1', 'original');
    await syncOnce(pc.local, remote);
    await syncOnce(movil.local, remote);
    movil.setClock(5000);
    movil.save('exercises', 'e1', 'del móvil');
    await syncOnce(movil.local, remote);
    pc.setClock(9000);
    pc.save('exercises', 'e1', 'del ordenador, más tarde');
    await syncOnce(pc.local, remote);
    expect(pc.docs.exercises.get('e1')?.title).toBe('del ordenador, más tarde');
    expect((rows.exercises.get('e1')?.data as { title: string }).title).toBe('del ordenador, más tarde');
  });

  it('un cambio hecho mientras se subía no se pierde de la cola', async () => {
    const { remote } = fakeCloud();
    const pc = fakeDevice();
    pc.save('exercises', 'e1', 'v1');
    const slow: Remote = {
      pull: remote.pull,
      async push(kind, list) {
        await remote.push(kind, list);
        pc.save('exercises', 'e1', 'v2 escrito durante la subida');
      },
    };
    await syncOnce(pc.local, slow);
    expect(pc.outbox.has('exercises:e1')).toBe(true);
  });
});
