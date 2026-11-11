import { useEffect, useRef, useState } from 'react';
import { SceneSvg } from '../../court/Scene';
import * as P from '../../model/play';
import { loopPlayhead } from '../../model/trainer';
import type { Play } from '../../model/types';

/**
 * Reproductor del dibujo de un ejercicio para el modo entreno: la animación en bucle, sin
 * herramientas de edición. Tocar la pista la pausa o la reanuda. Debajo, la nota del fotograma
 * que se está viendo (si la tiene) y unos puntos que indican en qué fotograma va.
 *
 * No usa el almacén de la pizarra: lleva su propio reloj con requestAnimationFrame y calcula cada
 * instante con `loopPlayhead` y `stateAt` (funciones puras del modelo).
 */
export function PlayPlayer({ play }: { play: Play }) {
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const last = useRef(0);
  const moving = play.frames.length > 1;

  useEffect(() => {
    setElapsed(0);
  }, [play]);

  useEffect(() => {
    if (paused || !moving) return;
    let raf = 0;
    last.current = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last.current) / 1000);
      last.current = now;
      setElapsed((e) => e + dt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused, moving, play]);

  const { k, t } = loopPlayhead(play, elapsed);
  const scene = moving ? P.stateAt(play, k, t) : P.frameScene(play, 0);
  // en la pausa del final se ve la posición del último fotograma
  const shown = moving && t >= 1 ? k + 1 : k;
  const note = play.frames[shown]?.note || '';

  return (
    <figure className="player">
      <button className="player-court" onClick={() => moving && setPaused((p) => !p)} aria-label={paused ? 'Reanudar la animación' : 'Pausar la animación'} disabled={!moving}>
        <SceneSvg play={play} scene={scene} actions={P.drawables(play, moving ? k : 0)} />
        {paused && <span className="player-paused">Pausa · toca para seguir</span>}
      </button>
      {(moving || note) && (
        <figcaption className="player-caption">
          {moving && (
            <span className="player-dots" aria-label={`Fotograma ${shown + 1} de ${play.frames.length}`}>
              {play.frames.map((f, i) => (
                <i key={f.id} className={i === shown ? 'on' : undefined} />
              ))}
            </span>
          )}
          {note && <span className="player-note">{note}</span>}
        </figcaption>
      )}
    </figure>
  );
}
