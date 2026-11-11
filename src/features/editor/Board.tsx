import { useRef, useState } from 'react';
import { usePalette } from '../../court/theme';
import { ActionShape, SceneContent } from '../../court/Scene';
import { viewBox } from '../../model/court';
import { simplify } from '../../model/geometry';
import * as P from '../../model/play';
import type { Drawable } from '../../model/play';
import type { Pt } from '../../model/types';
import { isMove } from '../../model/types';
import { useStore } from '../../store';
import { useLayout } from '../../hooks/layout';
import { type Drag, dragTo, type Effect, type Hit, HINTS, MOUSE_REACH, pressAt, type Reach, releaseAt, TOUCH_REACH } from './gestures';
import './Board.css';

/** Pista interactiva: dibuja la escena y pasa cada gesto del ratón a `gestures.ts`. */
export function Board() {
  const play = useStore((s) => s.play);
  const frame = useStore((s) => s.frame);
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const playhead = useStore((s) => s.playhead);
  const showGhost = useStore((s) => s.showGhost);
  const showLines = useStore((s) => s.showLines);

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  // márgenes del gesto en curso: de dedo si se pulsó con el dedo o un lápiz, de ratón si no
  const reach = useRef<Reach>(MOUSE_REACH);
  // en pantallas táctiles el anillo para dibujar se dibuja más grande
  const haloR = (useLayout().touch ? TOUCH_REACH : MOUSE_REACH).halo;
  const palette = usePalette();
  const [draft, setDraft] = useState<Drawable | null>(null);
  const [ballDrag, setBallDrag] = useState<{ id: string; pos: Pt } | null>(null);

  const vb = viewBox(play.court);
  const f = play.frames[frame];
  const animK = playhead ? playhead.k : frame;
  const scene = playhead ? P.stateAt(play, playhead.k, playhead.t) : P.frameScene(play, frame);
  if (ballDrag) scene.balls = scene.balls.map((b) => (b.id === ballDrag.id ? { ...b, pos: ballDrag.pos } : b));
  const actions = showLines ? P.drawables(play, animK) : [];
  const ghost = !playhead && showGhost && frame > 0 ? { scene: P.frameScene(play, frame - 1), actions: P.drawables(play, frame - 1) } : null;
  const selectedId = selection?.id ?? null;
  const selectedMove = selection?.kind === 'action' ? f.actions.find((a) => a.id === selection.id && isMove(a)) : undefined;

  /** Del ratón a coordenadas de pista. */
  const toSvg = (e: React.PointerEvent): Pt => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const r = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: r.x, y: r.y };
  };

  /** Aplica lo que ha decidido un gesto. */
  const apply = (fx: Effect) => {
    const s = useStore.getState();
    if (fx.select !== undefined) s.select(fx.select);
    if (fx.preview) s.preview(fx.preview.base, fx.preview.fn);
    if (fx.commit) s.commit(fx.commit);
    if (fx.edit) s.edit(fx.edit);
    if (fx.notify) s.notify(fx.notify);
    if (fx.draft !== undefined) setDraft(fx.draft);
    if (fx.ballAt !== undefined) setBallDrag(fx.ballAt);
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // un clic durante la reproducción solo vuelve a la edición
    if (playhead) return useStore.getState().set({ playhead: null, playing: false });
    const el = (e.target as Element).closest('[data-kind]');
    const hit: Hit = { kind: (el?.getAttribute('data-kind') as Hit['kind']) ?? null, id: el?.getAttribute('data-id') ?? '' };
    reach.current = e.pointerType === 'mouse' ? MOUSE_REACH : TOUCH_REACH;
    const fx = pressAt(play, frame, tool, hit, toSvg(e), scene.balls, reach.current);
    drag.current = fx.drag ?? null;
    apply(fx);
    // seguir el puntero aunque salga de la pista; si el navegador no puede (puntero ya soltado), se sigue igual
    if (drag.current)
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* sin captura: el gesto sigue funcionando mientras el puntero esté sobre la pista */
      }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current) apply(dragTo(play, frame, drag.current, toSvg(e), reach.current));
  };

  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    setDraft(null);
    if (d) apply(releaseAt(play, frame, d, toSvg(e), reach.current));
  };

  const draftShape: Drawable | null =
    draft && draft.type !== 'pass' ? { ...draft, pts: P.polylineOf(simplify(draft.pts, 1.1)).pts } : draft;

  return (
    <div className="board">
      <svg
        ref={svgRef}
        className={`court tool-${tool}${playhead ? ' is-playing' : ''}`}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="img"
        aria-label={`Pista de ${play.court === 'half' ? 'media pista' : 'pista completa'}, fotograma ${frame + 1}`}
      >
        <SceneContent play={play} scene={scene} actions={actions} actionOpacity={playhead ? 0.3 : 1} ghost={ghost} selectedId={selectedId} interactive={!playhead && tool === 'select'} haloR={haloR}>
          {draftShape && <ActionShape d={draftShape} opacity={0.85} />}
          {!playhead && selectedMove && isMove(selectedMove) && (
            <circle
              data-kind="handle"
              data-id={selectedMove.id}
              cx={selectedMove.points[selectedMove.points.length - 1].x}
              cy={selectedMove.points[selectedMove.points.length - 1].y}
              r={2.2}
              fill="#fff"
              stroke={palette.select}
              strokeWidth={0.8}
              style={{ cursor: 'move' }}
            />
          )}
        </SceneContent>
      </svg>
      <p className="hint" aria-live="polite">
        {playhead ? 'Reproduciendo. Haz clic en la pista para volver a editar.' : HINTS[tool]}
      </p>
    </div>
  );
}
