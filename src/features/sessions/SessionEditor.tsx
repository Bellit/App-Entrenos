import { useEffect, useMemo, useState } from 'react';
import { routeHref } from '../../app/useRoute';
import * as S from '../../model/session';
import { IconPlay, IconPlus, IconPrev } from '../../ui/Icons';
import { SaveIndicator } from '../../ui/SaveState';
import { ExercisePicker } from './ExercisePicker';
import { SessionBlocks } from './SessionBlocks';
import { useSessionDoc } from './useSessionDoc';
import '../../ui/Page.css';
import './SessionEditor.css';

/** Barra con la duración de cada bloque a escala: de un vistazo se ve cómo se reparte el entreno. */
function TimeBar({ session }: { session: S.Session }) {
  const total = S.totalMinutes(session);
  if (!total) return null;
  return (
    <div className="timebar" aria-hidden="true">
      {session.blocks.map((b, i) => (
        <span key={b.id} className={b.kind} style={{ flexGrow: b.minutes }} title={`${i + 1}. ${b.minutes}'`} />
      ))}
    </div>
  );
}

/**
 * Editor de una sesión: a la izquierda la cabecera (fecha, hora, equipo, objetivo) y los bloques
 * en orden con su horario; a la derecha, el selector para añadir bloques. En móvil el selector se
 * abre a pantalla completa con el botón «Añadir». Todo se guarda solo.
 */
export function SessionEditor({ id }: { id: string }) {
  const { status, session: s, update, library, teams, saveState, retry } = useSessionDoc(id);
  const [picking, setPicking] = useState(false);
  /** Aviso corto abajo («Añadido…», «Bloque quitado» con «Deshacer»). */
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const exercises = useMemo(() => [...library.values()].sort((a, b) => b.updatedAt - a.updatedAt), [library]);
  const inSession = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of s?.blocks ?? []) if (b.kind === 'exercise') m.set(b.exerciseId, (m.get(b.exerciseId) ?? 0) + 1);
    return m;
  }, [s]);

  if (status === 'loading')
    return (
      <div className="page">
        <main className="page-main">
          <p className="muted">Abriendo la sesión…</p>
        </main>
      </div>
    );
  if (status === 'missing' || !s)
    return (
      <div className="page">
        <main className="page-main">
          <section className="empty" role="alert">
            <h2>No encuentro esta sesión</h2>
            <p className="muted">Puede que se haya eliminado o que se guardara en otro dispositivo.</p>
            <a className="btn primary big" href={routeHref.sessions}>
              Volver a las sesiones
            </a>
          </section>
        </main>
      </div>
    );

  const full = s.blocks.length >= S.SESSION_LIMITS.blocks;
  const tooMany = () => setToast({ text: `Una sesión admite como mucho ${S.SESSION_LIMITS.blocks} bloques.` });
  const addExercise = (e: Parameters<typeof S.addExerciseBlock>[1]) => {
    if (full) return tooMany();
    update((x) => S.addExerciseBlock(x, e));
    setToast({ text: `Añadido «${e.title}» (${e.minutes}')` });
  };
  const addText = (title: string, minutes: number) => {
    if (full) return tooMany();
    update((x) => S.addTextBlock(x, title, minutes));
    setToast({ text: `Añadido «${title}» (${minutes}')` });
  };
  const remove = (block: S.SessionBlock, index: number) => {
    update((x) => S.removeBlock(x, block.id));
    setToast({
      text: 'Bloque quitado.',
      undo: () => {
        // se vuelve a poner en el mismo sitio, tal cual estaba
        update((x) => {
          const blocks = [...x.blocks];
          blocks.splice(index, 0, block);
          return { ...x, blocks };
        });
        setToast(null);
      },
    });
  };
  const field = <K extends 'title' | 'date' | 'startTime' | 'team' | 'goal' | 'notes'>(k: K) => (v: string) => update((x) => ({ ...x, [k]: v }));

  const total = S.totalMinutes(s);
  const end = S.endTime(s);
  const d = S.dateParts(s.date);

  return (
    <div className={`page session-editor${picking ? ' picking' : ''}`}>
      <header className="page-head sess-head">
        <a className="btn ghost back" href={routeHref.sessions} aria-label="Volver a las sesiones" title="Volver a las sesiones">
          <IconPrev /> <span className="back-text">Sesiones</span>
        </a>
        <h1 className="sr-only">Sesión: {s.title || 'sin título'}</h1>
        <input className="sess-title" value={s.title} maxLength={S.SESSION_LIMITS.title} onChange={(e) => field('title')(e.target.value)} aria-label="Título de la sesión" placeholder="Título de la sesión" />
        <div className="head-actions">
          <SaveIndicator state={saveState} onRetry={retry} />
          {s.blocks.length > 0 && (
            <a className="btn primary big train-btn" href={routeHref.training(s.id)} title="Seguir la sesión pantalla a pantalla">
              <IconPlay /> <span className="train-text">Entrenar</span>
            </a>
          )}
        </div>
      </header>

      <div className="sess-layout">
        <main className="sess-main">
          {/* 2.4 · Cabecera de la sesión */}
          <section className="sess-card sess-fields" aria-label="Datos de la sesión">
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={s.date} onChange={(e) => field('date')(e.target.value)} />
            </label>
            <label className="field">
              <span>Hora de inicio</span>
              <input type="time" value={s.startTime} onChange={(e) => field('startTime')(e.target.value)} />
            </label>
            <label className="field">
              <span>Equipo</span>
              <input value={s.team} maxLength={S.SESSION_LIMITS.team} list="equipos" placeholder="Ej.: Cadete A" onChange={(e) => field('team')(e.target.value)} />
              <datalist id="equipos">
                {teams.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="field wide">
              <span>Objetivo</span>
              <input value={s.goal} maxLength={S.SESSION_LIMITS.goal} placeholder="Qué queremos trabajar hoy" onChange={(e) => field('goal')(e.target.value)} />
            </label>
            <details className="field wide sess-notes" open={!!s.notes}>
              <summary>Notas</summary>
              <textarea rows={3} value={s.notes} maxLength={S.SESSION_LIMITS.notes} placeholder="Material, ausencias, recordatorios…" onChange={(e) => field('notes')(e.target.value)} aria-label="Notas de la sesión" />
            </details>
          </section>

          {/* 2.7 · Total y hora de fin */}
          <section className="sess-summary" aria-label="Resumen de tiempos">
            <div className="sum-item">
              <span className="sum-label">Total</span>
              <strong>{total ? S.formatDuration(total) : '0 min'}</strong>
            </div>
            <div className="sum-item">
              <span className="sum-label">Horario</span>
              <strong>{s.startTime ? `${s.startTime} → ${end}` : '—'}</strong>
            </div>
            <div className="sum-item">
              <span className="sum-label">Bloques</span>
              <strong>{s.blocks.length}</strong>
            </div>
            {!s.startTime && total > 0 && <p className="sum-hint muted">Pon la hora de inicio para ver a qué hora empieza cada bloque y a qué hora acabas.</p>}
            <TimeBar session={s} />
          </section>

          {/* 2.5 y 2.6 · Bloques */}
          {s.blocks.length === 0 ? (
            <section className="sess-card sess-empty">
              <h2>Sesión vacía</h2>
              <p className="muted">Añade ejercicios de tu biblioteca o bloques libres (charla, agua…). Luego ordénalos y ajusta los minutos.</p>
              <button className="btn primary big only-mobile" onClick={() => setPicking(true)}>
                <IconPlus /> Añadir bloques
              </button>
            </section>
          ) : (
            <SessionBlocks session={s} library={library} update={update} onRemove={remove} />
          )}
          {d && <p className="sess-date-long muted">{d.long}</p>}
        </main>

        <aside className="sess-picker" aria-label="Añadir bloques">
          <ExercisePicker exercises={exercises} inSession={inSession} onAddExercise={addExercise} onAddText={addText} onClose={picking ? () => setPicking(false) : undefined} />
        </aside>
      </div>

      {/* en móvil: botón fijo abajo para abrir el selector */}
      {!picking && s.blocks.length > 0 && (
        <button className="btn primary big fab only-mobile" onClick={() => setPicking(true)}>
          <IconPlus /> Añadir
        </button>
      )}

      {toast && (
        <div className="sess-toast" role="status">
          {toast.text}
          {toast.undo && (
            <button className="link" onClick={toast.undo}>
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
