import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession, listExercises, listSessions, saveSession } from '../../data/db';
import type { Exercise } from '../../model/exercise';
import { refreshSnapshots, type Session } from '../../model/session';
import type { SaveState } from '../../ui/SaveState';

/**
 * Abre una sesión y la guarda sola (autoguardado), igual que `useExerciseDoc` con los ejercicios:
 * - «sucio» = la sesión ya no es el mismo objeto que se guardó (las funciones del modelo devuelven
 *   siempre una sesión nueva, así que basta comparar referencias);
 * - se guarda tras 600 ms sin cambios, en fila (uno detrás de otro), y al instante al salir o al
 *   ocultarse la página; si falla, se reintenta a los 5 s y se ofrece «Reintentar».
 * Además carga la biblioteca (para elegir ejercicios y mostrar su versión actual) y los equipos ya
 * usados en otras sesiones (para sugerirlos).
 */
export function useSessionDoc(id: string) {
  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [session, setSessionState] = useState<Session | null>(null);
  const [library, setLibrary] = useState<Map<string, Exercise>>(new Map());
  const [teams, setTeams] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const base = useRef<Session | null>(null);
  const libRef = useRef(library);
  libRef.current = library;

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSession(id), listExercises(), listSessions()])
      .then(([s, exercises, all]) => {
        if (cancelled) return;
        setLibrary(new Map(exercises.map((e) => [e.id, e])));
        setTeams([...new Set(all.map((x) => x.team.trim()).filter(Boolean))].sort());
        if (!s) return setStatus('missing');
        base.current = s;
        setSessionState(s);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const queue = useRef<Promise<void>>(Promise.resolve());
  const save = useCallback((s: Session | null) => {
    queue.current = queue.current.then(async () => {
      if (!s || s === base.current) return;
      // al guardar, las copias de respaldo de los ejercicios se ponen al día
      const toSave = { ...refreshSnapshots(s, libRef.current), updatedAt: Date.now() };
      try {
        await saveSession(toSave);
        base.current = s;
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    });
    return queue.current;
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !session || session === base.current) return;
    setSaveState('saving');
    const t = setTimeout(() => save(session), 600);
    return () => clearTimeout(t);
  }, [session, status, save]);

  const latest = useRef(session);
  latest.current = session;
  const flush = useCallback(() => save(latest.current), [save]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      void flush();
    };
  }, [flush]);

  useEffect(() => {
    if (saveState !== 'error') return;
    const t = setTimeout(flush, 5000);
    return () => clearTimeout(t);
  }, [saveState, flush]);

  /** Cambia la sesión con una función del modelo, p. ej. `update((s) => addTextBlock(s, 'Agua'))`. */
  const update = useCallback((fn: (s: Session) => Session) => setSessionState((s) => (s ? fn(s) : s)), []);

  return { status, session, update, library, teams, saveState, retry: flush };
}
