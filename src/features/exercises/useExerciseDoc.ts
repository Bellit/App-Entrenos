import { useCallback, useEffect, useRef, useState } from 'react';
import { getExercise, saveExercise } from '../../data/db';
import type { Exercise } from '../../model/exercise';
import type { Play } from '../../model/types';
import { useStore } from '../../store';

/** Lo que el editor cambia además del dibujo (que vive en el almacén de la pizarra). */
export type Meta = Pick<Exercise, 'title' | 'category' | 'tags' | 'notes' | 'minutes'>;
export type SaveState = 'saved' | 'saving' | 'error';

const pickMeta = (e: Exercise): Meta => ({ title: e.title, category: e.category, tags: e.tags, notes: e.notes, minutes: e.minutes });

/**
 * Abre un ejercicio en el editor y lo guarda solo (autoguardado) en IndexedDB.
 *
 * - El dibujo (`play`) lo edita la pizarra de ATO, que usa el almacén `useStore`.
 * - El resto de datos (título, texto, etiquetas…) viven aquí en `meta`.
 * - «Sucio» = el dibujo o `meta` ya no son los mismos objetos que se guardaron la última vez.
 *   Se compara por referencia: es barato y no hace falta recorrer los datos.
 * - Al salir de la pantalla se guarda al instante lo pendiente, sin esperar a la pausa.
 */
export function useExerciseDoc(id: string) {
  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [meta, setMetaState] = useState<Meta | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const play = useStore((s) => s.play);

  // lo último guardado: sirve para saber si hay cambios y para conservar id y fechas
  const base = useRef<{ exercise: Exercise; play: Play; meta: Meta } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    getExercise(id)
      .then((exercise) => {
        if (cancelled) return;
        if (!exercise) return setStatus('missing');
        const m = pickMeta(exercise);
        base.current = { exercise, play: exercise.play, meta: m };
        useStore.getState().load(exercise.play);
        setMetaState(m);
        setSaveState('saved');
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Guarda ya, si hay algo pendiente. Devuelve la promesa para poder esperarla. */
  const save = useCallback(async (p: Play, m: Meta | null) => {
    const b = base.current;
    if (!b || !m || (p === b.play && m === b.meta)) return;
    const exercise: Exercise = { ...b.exercise, ...m, play: { ...p, name: m.title }, updatedAt: Date.now() };
    try {
      await saveExercise(exercise);
      base.current = { exercise, play: p, meta: m };
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  // autoguardado con pausa: espera 600 ms sin cambios antes de guardar
  useEffect(() => {
    const b = base.current;
    if (status !== 'ready' || !b || !meta || (play === b.play && meta === b.meta)) return;
    setSaveState('saving');
    const t = setTimeout(() => save(play, meta), 600);
    return () => clearTimeout(t);
  }, [play, meta, status, save]);

  // al salir (cambio de pantalla o cierre de la pestaña) se guarda lo pendiente
  const latest = useRef({ play, meta });
  latest.current = { play, meta };
  useEffect(() => {
    const flush = () => void save(latest.current.play, latest.current.meta);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [save]);

  const setMeta = useCallback((patch: Partial<Meta>) => setMetaState((m) => (m ? { ...m, ...patch } : m)), []);

  return { status, meta, setMeta, saveState };
}
