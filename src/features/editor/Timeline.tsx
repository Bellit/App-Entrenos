import { memo, useState } from 'react';
import * as P from '../../model/play';
import type { Play } from '../../model/types';
import { useActions, useStore } from '../../store';
import { IconDuplicate, IconMore, IconNext, IconPause, IconPlay, IconPlus, IconPrev, IconTrash } from '../../ui/Icons';
import { Menu } from '../../ui/Menu';
import { SceneSvg } from '../../court/Scene';
import { useLayout } from '../../hooks/layout';
import { SPEEDS, SpeedSelect } from '../../ui/SpeedSelect';
import './Timeline.css';

/**
 * Miniatura de un fotograma. Solo se vuelve a dibujar si cambia lo que muestra (`sig`): la pista,
 * los jugadores, ese fotograma o el siguiente (de él salen los pases). Así, al arrastrar un jugador
 * no se redibujan todas.
 */
const Thumb = memo(
  function Thumb({ play, k }: { play: Play; k: number; sig: string }) {
    return <SceneSvg play={play} scene={P.frameScene(play, k)} actions={P.drawables(play, k)} />;
  },
  (a, b) => a.k === b.k && a.sig === b.sig,
);

const thumbSig = (play: Play, k: number) => JSON.stringify([play.court, play.players, play.frames[k], play.frames[k + 1]?.positions, play.frames[k + 1]?.ball]);

/** Barra de progreso: además de informar, se puede pulsar o arrastrar para ir a un instante. */
function Progress({ play, elapsed, total }: { play: Play; elapsed: number; total: number }) {
  const { set } = useActions();
  /** Va al instante `secs` (en segundos de la jugada) recorriendo los fotogramas. */
  const seekAt = (secs: number) => {
    let left = Math.max(0, Math.min(total, secs));
    for (let k = 0; k < play.frames.length; k++) {
      const d = play.frames[k].duration;
      if (left <= d || k === play.frames.length - 1) return set({ playing: false, playhead: { k, t: Math.min(1, left / d) } });
      left -= d;
    }
  };
  const fromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seekAt(((e.clientX - r.left) / r.width) * total);
  };
  return (
    <div
      className="progress"
      role="slider"
      tabIndex={0}
      aria-label="Posición de la reproducción"
      aria-valuemin={0}
      aria-valuemax={Number(total.toFixed(1))}
      aria-valuenow={Number(elapsed.toFixed(1))}
      aria-valuetext={`${elapsed.toFixed(1)} de ${total.toFixed(1)} segundos`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && fromPointer(e)}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowRight' ? 0.2 : e.key === 'ArrowLeft' ? -0.2 : e.key === 'Home' ? -Infinity : e.key === 'End' ? Infinity : 0;
        if (!step) return;
        e.preventDefault();
        e.stopPropagation();
        seekAt(elapsed + step);
      }}
    >
      <div className="progress-bar" style={{ width: `${(elapsed / total) * 100}%` }} />
    </div>
  );
}

/** Línea de tiempo. `compact` (móvil): una sola fila; velocidad y bucle van en el menú «⋯». */
export function Timeline({ compact = false }: { compact?: boolean }) {
  const { touch } = useLayout();
  const play = useStore((s) => s.play);
  const frame = useStore((s) => s.frame);
  const playing = useStore((s) => s.playing);
  const playhead = useStore((s) => s.playhead);
  const speed = useStore((s) => s.speed);
  const loop = useStore((s) => s.loop);
  const { setFrame, edit, set, notify, addFrame } = useActions();

  const n = play.frames.length;
  const total = play.frames.reduce((a, f) => a + f.duration, 0);
  const elapsed = playhead ? play.frames.slice(0, playhead.k).reduce((a, f) => a + f.duration, 0) + play.frames[playhead.k].duration * playhead.t : 0;
  const activeK = playhead ? playhead.k : frame;

  // arrastrar miniaturas para cambiar el orden
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const warnRemoved = (removed: number) => {
    if (removed) notify(`Se ha quitado ${removed === 1 ? '1 pase o tiro que ya no encajaba' : `${removed} pases o tiros que ya no encajaban`} con quién tiene el balón.`);
  };
  /** Mueve un fotograma y vuelve a encadenar: cada uno empieza donde acaba el anterior. */
  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= n) return;
    let removed = 0;
    edit((p) => (removed = P.moveFrame(p, from, to)));
    setFrame(to);
    warnRemoved(removed);
  };
  const duplicate = () => {
    if (n >= P.LIMITS.frames) return notify(`Una jugada admite como mucho ${P.LIMITS.frames} fotogramas.`);
    let r = { index: frame, removed: 0 };
    edit((p) => (r = P.duplicateFrame(p, frame)));
    setFrame(r.index);
    warnRemoved(r.removed);
  };

  const togglePlay = useStore((s) => s.togglePlay);

  return (
    <section className={`timeline${compact ? ' compact' : ''}`} aria-label="Fotogramas">
      {/* Franja 1: opciones de reproducción y barra de progreso (en compacto, solo la barra) */}
      {compact ? (
        <div className="transport">
          <Progress play={play} elapsed={elapsed} total={total} />
          <span className="time">{(elapsed / speed).toFixed(1)} s</span>
        </div>
      ) : (
      <div className="transport">
        <label className="speed">
          <span className="sr-only">Velocidad</span>
          <SpeedSelect value={speed} onChange={(v) => set({ speed: v })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={loop} onChange={(e) => set({ loop: e.target.checked })} /> Bucle
        </label>
        <Progress play={play} elapsed={elapsed} total={total} />
        <span className="time">{(elapsed / speed).toFixed(1)} / {(total / speed).toFixed(1)} s</span>
      </div>
      )}

      {/* Franja 2: controles de fotograma y miniaturas */}
      <div className="frames-row">
        <div className="frame-nav">
          <button className="btn ghost icon" onClick={() => setFrame(activeK - 1)} disabled={activeK <= 0} aria-label="Fotograma anterior" title="Fotograma anterior (←)">
            <IconPrev />
          </button>
          <button className="btn primary play" onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir jugada'} title="Reproducir / pausar (Espacio)">
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button className="btn ghost icon" onClick={() => setFrame(activeK + 1)} disabled={activeK >= n - 1} aria-label="Fotograma siguiente" title="Fotograma siguiente (→)">
            <IconNext />
          </button>
        </div>

        <ol className="frames">
          {play.frames.map((f, k) => (
            <li
              key={f.id}
              // con el dedo, arrastrar miniaturas no funciona en casi ningún navegador: se reordena con el menú «⋯»
              draggable={!playing && n > 1 && !touch}
              className={dropAt === k && dragFrom !== null && dragFrom !== k ? `drop-${dragFrom < k ? 'after' : 'before'}` : undefined}
              onDragStart={(e) => {
                setDragFrom(k);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(k));
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDropAt(k);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDropAt(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) reorder(dragFrom, k);
                setDragFrom(null);
                setDropAt(null);
              }}
            >
              <button
                className={`frame${k === activeK ? ' active' : ''}`}
                onClick={() => setFrame(k)}
                aria-label={`Fotograma ${k + 1}${f.note ? `: ${f.note}` : ''}`}
                aria-current={k === activeK}
                title={n > 1 && !touch ? 'Arrastra para cambiar el orden' : undefined}
              >
                <Thumb play={play} k={k} sig={thumbSig(play, k)} />
                <span className="frame-n">{k + 1}</span>
              </button>
            </li>
          ))}
          <li>
            <button className="frame add-frame" onClick={addFrame} title="Nuevo fotograma a partir del actual (N)">
              <IconPlus />
              <span>Nuevo</span>
            </button>
          </li>
        </ol>

        <Menu
          label={`Acciones del fotograma ${frame + 1}`}
          title={`Acciones del fotograma ${frame + 1}`}
          icon={<IconMore />}
          iconOnly
          up
          items={[
            { label: 'Duplicar fotograma', hint: 'Repite sus acciones desde donde acaba', icon: <IconDuplicate />, onSelect: duplicate },
            { label: 'Mover a la izquierda', hint: 'Antes en la jugada', icon: <IconPrev />, onSelect: () => reorder(frame, frame - 1), disabled: frame <= 0 },
            { label: 'Mover a la derecha', hint: 'Después en la jugada', icon: <IconNext />, onSelect: () => reorder(frame, frame + 1), disabled: frame >= n - 1 },
            ...(compact
              ? [
                  { label: `Velocidad: ${String(speed).replace('.', ',')}×`, hint: 'Toca para cambiarla', onSelect: () => set({ speed: SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] }) },
                  { label: loop ? 'Bucle: sí' : 'Bucle: no', hint: 'Repetir la jugada al acabar', onSelect: () => set({ loop: !loop }) },
                ]
              : []),
          ]}
        />
        <button
          className="btn ghost icon frame-delete"
          disabled={n <= 1}
          onClick={() => edit((p) => P.deleteFrame(p, frame))}
          aria-label={`Borrar fotograma ${frame + 1}`}
          title={`Borrar fotograma ${frame + 1}`}
        >
          <IconTrash />
        </button>
      </div>
    </section>
  );
}
