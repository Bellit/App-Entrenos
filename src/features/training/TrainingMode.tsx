import { useEffect, useRef, useState } from 'react';
import { routeHref } from '../../app/useRoute';
import { getSession, listExercises, saveSession } from '../../data/db';
import { categoryName } from '../../model/exercise';
import * as S from '../../model/session';
import { formatTimer } from '../../model/trainer';
import { getItem, setItem } from '../../prefs';
import { IconNext, IconPause, IconPlay, IconPrev, IconUndo } from '../../ui/Icons';
import { NotesText } from './NotesText';
import { REVIEW_FOCUS_KEY } from '../sessions/SessionReviewCard';
import { PlayPlayer } from './PlayPlayer';
import { useBlockTimer } from './useBlockTimer';
import { useWakeLock } from './useWakeLock';
import { AttendanceCard } from '../sessions/AttendanceCard';
import { useSquads } from '../teams/useSquads';
import { Dialog } from '../../ui/Dialog';
import './Training.css';

/** Bloque en el que se quedó cada sesión, para seguir ahí si se recarga la página sin querer. */
const posKey = (id: string) => `entrenos.entreno.${id}`;

/**
 * Modo entreno (2.8 a 2.10): la sesión pantalla a pantalla, pensada para el móvil en la pista.
 * - Cada pantalla es un bloque: el dibujo animado en bucle y la explicación, o el bloque libre.
 * - «Anterior» y «Siguiente» abajo, al alcance del pulgar; también deslizando el dedo o con las
 *   flechas del teclado. Arriba, la tira de bloques para saltar a cualquiera.
 * - Cronómetro del bloque con aviso al acabar (useBlockTimer).
 * - La pantalla no se apaga mientras se está aquí (useWakeLock).
 * Solo lee la sesión: no cambia nada de lo guardado.
 */
export function TrainingMode({ id }: { id: string }) {
  const [blocks, setBlocks] = useState<S.ResolvedBlock[] | null>(null);
  const [session, setSession] = useState<S.Session | null>(null);
  const [missing, setMissing] = useState(false);
  const [index, setIndex] = useState(() => Math.max(0, Number(getItem(posKey(id))) || 0));
  const wake = useWakeLock();
  const { squads } = useSquads();
  const [roll, setRoll] = useState(false);

  useEffect(() => {
    Promise.all([getSession(id), listExercises()])
      .then(([s, exercises]) => {
        if (!s || !s.blocks.length) return setMissing(true);
        setSession(s);
        setBlocks(S.resolveBlocks(s, new Map(exercises.map((e) => [e.id, e]))));
        setIndex((i) => Math.min(i, s.blocks.length - 1));
      })
      .catch(() => setMissing(true));
  }, [id]);

  const n = blocks?.length ?? 0;
  const current = blocks?.[index];
  const timer = useBlockTimer(current?.block.minutes ?? 10, current?.block.id ?? '');
  const go = (i: number) => {
    const next = Math.max(0, Math.min(n - 1, i));
    setIndex(next);
    setItem(posKey(id), String(next));
  };

  // teclado: flechas para cambiar de bloque, espacio para el cronómetro
  const keys = useRef({ go, index, toggle: timer.toggle });
  keys.current = { go, index, toggle: timer.toggle };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') keys.current.go(keys.current.index + 1);
      else if (e.key === 'ArrowLeft') keys.current.go(keys.current.index - 1);
      else if (e.key === ' ') {
        e.preventDefault();
        keys.current.toggle();
      } else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // deslizar el dedo a izquierda o derecha cambia de bloque
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => (swipe.current = { x: e.clientX, y: e.clientY });
  const onUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(e.clientY - s.y)) go(index + (dx < 0 ? 1 : -1));
  };

  if (missing)
    return (
      <div className="train train-state">
        <h1>No se puede empezar</h1>
        <p className="muted">La sesión no existe o todavía no tiene bloques.</p>
        <a className="btn primary big" href={routeHref.sessions}>
          Volver a las sesiones
        </a>
      </div>
    );
  if (!blocks || !current || !session)
    return (
      <div className="train train-state">
        <p className="muted">Preparando el entreno…</p>
      </div>
    );

  const squad = squads?.find((t) => t.id === session.teamId);
  /** Pasar lista desde aquí: cada marca se guarda al momento. */
  const updateSession = (fn: (x: S.Session) => S.Session) => {
    const next = { ...fn(session), updatedAt: Date.now() };
    setSession(next);
    void saveSession(next);
  };
  const marked = squad ? squad.players.filter((p) => session.attendance[p.id]).length : 0;
  const schedule = S.blockSchedule(session)[index];
  const b = current.block;
  const e = current.exercise;
  const title = b.kind === 'exercise' ? e?.title || 'Ejercicio' : b.title || 'Bloque';
  const over = timer.remaining <= 0;
  const last = index === n - 1;

  return (
    <div className={`train${over ? ' over' : ''}`}>
      <header className="train-top">
        <a className="btn ghost icon" href={routeHref.session(id)} aria-label="Salir del modo entreno" title="Salir">
          ✕
        </a>
        <div className="train-where">
          <strong>
            {index + 1} / {n}
          </strong>
          <span>{schedule.clockFrom ? `${schedule.clockFrom}–${schedule.clockTo}` : session.title}</span>
        </div>
        {squad && squad.players.length > 0 && (
          <button className="btn roll-btn" onClick={() => setRoll(true)} title="Pasar lista">
            Lista {marked}/{squad.players.length}
          </button>
        )}
        <span className={`wake ${wake}`} title={wake === 'on' ? 'La pantalla no se apagará' : 'La pantalla puede apagarse sola'}>
          {wake === 'on' ? 'Pantalla encendida' : wake === 'unsupported' ? 'La pantalla puede apagarse' : ''}
        </span>
      </header>

      <nav className="train-steps" aria-label="Bloques de la sesión">
        {blocks.map((r, i) => (
          <button
            key={r.block.id}
            className={`${r.block.kind}${i === index ? ' on' : ''}${i < index ? ' done' : ''}`}
            style={{ flexGrow: r.block.minutes }}
            onClick={() => go(i)}
            aria-label={`Ir al bloque ${i + 1}`}
            aria-current={i === index ? 'step' : undefined}
          />
        ))}
      </nav>

      <main className={`train-main ${b.kind}`} onPointerDown={onDown} onPointerUp={onUp} key={b.id}>
        {b.kind === 'exercise' && e ? (
          <>
            <div className="train-court">
              <PlayPlayer play={e.play} />
            </div>
            <div className="train-info">
              <p className="train-kicker">
                <span className="pill">{categoryName(e.category)}</span> {b.minutes} min
              </p>
              <h1>{title}</h1>
              {b.note && (
                <p className="train-today">
                  <strong>Hoy:</strong> {b.note}
                </p>
              )}
              <NotesText text={e.notes} />
            </div>
          </>
        ) : (
          <div className="train-free">
            <p className="train-kicker">{b.minutes} min</p>
            <h1>{title}</h1>
            {b.kind === 'text' && b.text && <NotesText text={b.text} />}
          </div>
        )}
      </main>

      <footer className="train-bar">
        <button className="btn big nav" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Bloque anterior">
          <IconPrev /> <span className="nav-text">Anterior</span>
        </button>

        <div className="timer" role="timer" aria-live="off">
          <button className={`timer-main${timer.running ? ' running' : ''}`} onClick={timer.toggle} aria-label={timer.running ? 'Pausar el cronómetro' : 'Empezar el cronómetro'}>
            {timer.running ? <IconPause /> : <IconPlay />}
            <span className="timer-value">{formatTimer(timer.remaining)}</span>
          </button>
          <div className="timer-tools">
            <button className="btn ghost" onClick={() => timer.add(60)} aria-label="Un minuto más">
              +1′
            </button>
            <button className="btn ghost icon" onClick={timer.reset} aria-label="Volver a empezar el cronómetro" title="Reiniciar">
              <IconUndo />
            </button>
          </div>
        </div>

        {last ? (
          <a
            className="btn big nav primary"
            href={routeHref.session(id)}
            onClick={() => {
              // al llegar a la sesión, se abre directamente «Después del entreno» para apuntar cómo ha ido
              try {
                sessionStorage.setItem(REVIEW_FOCUS_KEY, id);
              } catch {
                /* sin almacenamiento: se llega a la sesión igual */
              }
            }}
          >
            <span className="nav-text">Terminar</span> ✓
          </a>
        ) : (
          <button className="btn big nav primary" onClick={() => go(index + 1)} aria-label="Bloque siguiente">
            <span className="nav-text">Siguiente</span> <IconNext />
          </button>
        )}
      </footer>
      {squad && (
        <Dialog open={roll} onClose={() => setRoll(false)} title={`Pasar lista · ${squad.name}`}>
          <AttendanceCard session={session} squad={squad} update={updateSession} />
        </Dialog>
      )}
      {over && (
        <div className="train-alert" role="alert">
          ¡Tiempo! {last ? 'Último bloque' : 'Pasa al siguiente'}
        </div>
      )}
    </div>
  );
}
