import { useSyncExternalStore } from 'react';
import { notifyRemoteChange, onLocalChange, syncLocal, type Kind } from '../data/db';
import { type Remote, type RemoteRow, syncOnce } from './engine';
import { supabase } from './supabase';

/**
 * Sincronización con Supabase: la cuenta (entrar y salir) y cuándo sincronizar.
 * - Al abrir la app, al volver a ella, al recuperar la conexión y unos segundos después de cada
 *   cambio hecho aquí. Nunca dos a la vez.
 * - La primera vez que se entra con una cuenta en este dispositivo, todo lo que ya había aquí se
 *   sube (para no perder nada).
 * Las pantallas leen el estado con `useSync()`.
 */

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';
interface State {
  /** Correo de la cuenta con la que se ha entrado, o null. */
  email: string | null;
  status: SyncStatus;
  /** Última sincronización completa (ms). */
  lastSync: number | null;
  error: string | null;
}

let state: State = { email: null, status: 'off', lastSync: null, error: null };
let userId: string | null = null;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useSync(): State {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => state,
  );
}

// ---------------------------------------------------------------------------
// Adaptador de la nube para el motor (engine.ts)
// ---------------------------------------------------------------------------

const remote: Remote = {
  async pull(kind: Kind, since: string | null) {
    const out: RemoteRow[] = [];
    for (let from = 0; ; from += 1000) {
      let q = supabase.from(kind).select('id, data, deleted, updated_at, synced_at').order('synced_at').range(from, from + 999);
      if (since) q = q.gt('synced_at', since);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...(data as RemoteRow[]));
      if (data.length < 1000) return out;
    }
  },
  async push(kind, rows) {
    const { error } = await supabase.from(kind).upsert(
      rows.map((r) => ({ ...r, user_id: userId })),
      { onConflict: 'user_id,id' },
    );
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// Cuándo sincronizar
// ---------------------------------------------------------------------------

let running: Promise<void> | null = null;
let again = false;

/** Sincroniza ya. Si ya hay una en marcha, se encadena otra al acabar (para no perder cambios). */
export function syncNow(): Promise<void> {
  if (!userId) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      if (!navigator.onLine) {
        set({ status: 'offline' });
        return;
      }
      set({ status: 'syncing', error: null });
      try {
        const r = await syncOnce(syncLocal, remote);
        if (r.pulled) notifyRemoteChange();
        set({ status: 'idle', lastSync: Date.now() });
      } catch (e) {
        set({ status: navigator.onLine ? 'error' : 'offline', error: e instanceof Error ? e.message : String(e) });
        return;
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Tras un cambio hecho aquí: espera unos segundos (se agrupan varios cambios seguidos). */
const soon = () => {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), 3000);
};

/** La primera vez con esta cuenta en este dispositivo: se sube todo lo que ya había. */
async function adopt(id: string) {
  if ((await syncLocal.getMeta('user')) === id) return;
  await syncLocal.delMeta('cursor.exercises');
  await syncLocal.delMeta('cursor.sessions');
  await syncLocal.markAll();
  await syncLocal.setMeta('user', id);
}

async function onSignedIn(id: string, email: string | null) {
  if (userId === id) return;
  userId = id;
  set({ email, status: 'idle' });
  await adopt(id);
  void syncNow();
}

export function startSync() {
  supabase.auth.onAuthStateChange((event, session) => {
    // dentro de este aviso no se puede llamar a Supabase directamente: se deja para justo después
    setTimeout(() => {
      if (session?.user) void onSignedIn(session.user.id, session.user.email ?? null);
      else if (event === 'SIGNED_OUT') {
        userId = null;
        set({ email: null, status: 'off', lastSync: null, error: null });
      }
    });
  });
  onLocalChange(() => userId && soon());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow());
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => userId && set({ status: 'offline' }));
}

// ---------------------------------------------------------------------------
// Entrar y salir: con un código de 6 cifras (o el enlace) que llega por correo
// ---------------------------------------------------------------------------

/** Manda el correo con el código y el enlace para entrar. */
export async function sendCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Comprueba el código de 6 cifras del correo. */
export async function verifyCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
}

/** Sale de la cuenta. Lo guardado en este dispositivo se queda. */
export async function signOut() {
  await syncNow().catch(() => {});
  await supabase.auth.signOut();
}
