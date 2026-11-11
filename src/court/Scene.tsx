import { useContext } from 'react';
import { BALL_R, COURT_W, FULL_L, HALF_L, PLAYER_R, RIM_FROM_BASELINE, viewBox } from '../model/court';
import { Polyline, toD, zigzag } from '../model/geometry';
import type { Drawable, SceneState } from '../model/play';
import type { CourtType, Play, Pt, Team } from '../model/types';
import { RotateContext, usePalette } from './theme';

/** Números de los jugadores: fuente del sistema, para que el editor y lo exportado se vean igual. */
const FONT = "'Segoe UI', Roboto, Arial, sans-serif";

/** Líneas de media pista en coordenadas locales: fondo en y=0, ancho de 0 a 150. */
function HalfLines() {
  const C = usePalette();
  const lw = C.lineWidth;
  const cx = COURT_W / 2;
  const r3 = 67.5;
  const cornerX = 9;
  const cornerY = RIM_FROM_BASELINE + Math.sqrt(r3 * r3 - (cx - cornerX) ** 2);
  return (
    <g>
      <rect x={cx - 24.5} y={0} width={49} height={58} fill={C.paint} stroke={C.line} strokeWidth={0.5 * lw} />
      <path d={`M${cx - 18} 58 A18 18 0 0 0 ${cx + 18} 58`} fill="none" stroke={C.line} strokeWidth={0.5 * lw} />
      <path d={`M${cx - 18} 58 A18 18 0 0 1 ${cx + 18} 58`} fill="none" stroke={C.line} strokeWidth={0.5 * lw} strokeDasharray="2 1.6" />
      <path
        d={`M${cornerX} 0 L${cornerX} ${cornerY} A${r3} ${r3} 0 0 0 ${COURT_W - cornerX} ${cornerY} L${COURT_W - cornerX} 0`}
        fill="none"
        stroke={C.line}
        strokeWidth={0.5 * lw}
      />
      <path d={`M${cx - 12.5} 12 L${cx - 12.5} ${RIM_FROM_BASELINE} A12.5 12.5 0 0 0 ${cx + 12.5} ${RIM_FROM_BASELINE} L${cx + 12.5} 12`} fill="none" stroke={C.line} strokeWidth={0.4 * lw} />
      <line x1={cx - 9} y1={12} x2={cx + 9} y2={12} stroke={C.line} strokeWidth={1 * lw} />
      <line x1={cx} y1={12} x2={cx} y2={RIM_FROM_BASELINE - 2.25} stroke={C.line} strokeWidth={0.5 * lw} />
      <circle cx={cx} cy={RIM_FROM_BASELINE} r={2.25} fill="none" stroke={C.rim} strokeWidth={0.6 * lw} />
      <path d={`M${cx - 18} ${HALF_L} A18 18 0 0 1 ${cx + 18} ${HALF_L}`} fill="none" stroke={C.line} strokeWidth={0.5 * lw} />
    </g>
  );
}

export function CourtLines({ court }: { court: CourtType }) {
  const C = usePalette();
  const vb = viewBox(court);
  const w = court === 'half' ? COURT_W : FULL_L;
  const h = court === 'half' ? HALF_L : COURT_W;
  return (
    <g>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={C.outside} />
      <rect x={0} y={0} width={w} height={h} fill={C.floor} />
      {court === 'half' ? (
        <HalfLines />
      ) : (
        <>
          <g transform="matrix(0 1 1 0 0 0)">
            <HalfLines />
          </g>
          <g transform={`matrix(0 1 -1 0 ${FULL_L} 0)`}>
            <HalfLines />
          </g>
          <line x1={FULL_L / 2} y1={0} x2={FULL_L / 2} y2={COURT_W} stroke={C.line} strokeWidth={0.5 * C.lineWidth} />
        </>
      )}
      <rect x={0} y={0} width={w} height={h} fill="none" stroke={C.line} strokeWidth={0.9 * C.lineWidth} />
    </g>
  );
}

function arrowHead(tip: Pt, dir: Pt, size = 3.6): string {
  const bx = tip.x - dir.x * size;
  const by = tip.y - dir.y * size;
  const w = size * 0.55;
  return `M${tip.x} ${tip.y} L${bx - dir.y * w} ${by + dir.x * w} L${bx + dir.y * w} ${by - dir.x * w}Z`;
}

/** Dibuja una acción con el estilo clásico de pizarra. */
export function ActionShape({ d, selected = false, opacity = 1 }: { d: Drawable; selected?: boolean; opacity?: number }) {
  const C = usePalette();
  const color = d.type === 'shot' ? C.shot : d.team === 'D' ? C.lineD : C.lineO;
  const pl = new Polyline(d.pts);
  if (pl.length < 0.5) return null;
  const end = pl.atLen(pl.length);
  const dir = pl.tangentAtLen(pl.length);
  // rotulador y tiza: trazo algo más grueso
  const sw = C.pitch === 'madera' ? 0.85 : 1;

  let body: Pt[] = pl.pts;
  let head: string | null = null;
  let tee: [Pt, Pt] | null = null;
  let dash: string | undefined;

  if (d.type === 'screen') {
    const n = { x: -dir.y, y: dir.x };
    tee = [
      { x: end.x + n.x * 4.2, y: end.y + n.y * 4.2 },
      { x: end.x - n.x * 4.2, y: end.y - n.y * 4.2 },
    ];
  } else {
    // la flecha no se mete dentro del jugador receptor
    const trim = d.type === 'pass' ? PLAYER_R + 0.8 : d.type === 'shot' ? 2.4 : 0;
    const tipLen = Math.max(0, pl.length - trim);
    const tip = pl.atLen(tipLen);
    const bodyEnd = Math.max(0, tipLen - 2.4);
    if (d.type === 'pass' || d.type === 'shot') {
      // líneas rectas que salen del borde del jugador
      body = [pl.atLen(Math.min(PLAYER_R + 0.6, bodyEnd / 2)), pl.atLen(bodyEnd)];
    } else {
      const sub = new Polyline(pl.until(bodyEnd));
      body = d.type === 'dribble' ? zigzag(sub) : sub.pts;
    }
    head = arrowHead(tip, pl.tangentAtLen(tipLen));
    if (d.type === 'pass') dash = '2.6 1.8';
    if (d.type === 'shot') dash = '1.2 1.2';
  }

  return (
    <g opacity={opacity} data-kind="action" data-id={d.id} style={{ cursor: 'pointer' }}>
      {/* zona de clic más ancha */}
      <path d={toD(pl.pts)} stroke="transparent" strokeWidth={5} fill="none" />
      {selected && <path d={toD(pl.pts)} stroke={C.select} strokeOpacity={0.4} strokeWidth={4} fill="none" strokeLinecap="round" />}
      <path d={toD(body)} stroke={color} strokeWidth={sw} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dash} />
      {d.type === 'shot' && <path d={toD(body.map((p) => ({ x: p.x + dir.y * 1.1, y: p.y - dir.x * 1.1 })))} stroke={color} strokeWidth={sw} fill="none" strokeDasharray={dash} />}
      {head && <path d={head} fill={color} />}
      {tee && <line x1={tee[0].x} y1={tee[0].y} x2={tee[1].x} y2={tee[1].y} stroke={color} strokeWidth={1.4} strokeLinecap="round" />}
    </g>
  );
}

/**
 * Anillo alrededor del jugador desde el que se arrastra para dibujar (herramienta Seleccionar):
 * por defecto, radio + 4. Con el dedo se pasa uno mayor (ver `Reach` en gestures.ts).
 */
const HALO = 4;

export function PlayerShape({
  team,
  label,
  pos,
  selected = false,
  ghost = false,
  id,
  halo = false,
  haloR = HALO,
}: {
  team: Team;
  label: string;
  pos: Pt;
  selected?: boolean;
  ghost?: boolean;
  id?: string;
  halo?: boolean;
  /** Ancho del anillo, sumado al radio del jugador. */
  haloR?: number;
}) {
  const C = usePalette();
  const rotate = useContext(RotateContext);
  const look = C.team[team === 'D' ? 'D' : 'O'];
  // en la pizarra blanca, como con rotulador: borde más grueso
  const sw = C.pitch === 'blanca' ? 0.9 : 0.6;
  const fs = label.length > 2 ? 3.4 : label.length > 1 ? 4.2 : 5.2;
  return (
    <g transform={`translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})`} opacity={ghost ? 0.22 : 1} data-kind={ghost ? undefined : 'player'} data-id={id} className={halo ? `player has-halo${selected ? ' is-selected' : ''}` : undefined} style={ghost ? { pointerEvents: 'none' } : { cursor: 'grab' }}>
      {halo && <circle className="halo" r={PLAYER_R + haloR} fill="transparent" stroke="transparent" strokeWidth={0.7} strokeDasharray="1.6 1.2" />}
      {selected && <circle r={PLAYER_R + 1.6} fill="none" stroke={C.select} strokeWidth={0.9} />}
      {team === 'O' && <circle r={PLAYER_R} fill={look.fill} stroke={look.stroke} strokeWidth={sw} />}
      {team === 'D' && <rect x={-PLAYER_R} y={-PLAYER_R} width={PLAYER_R * 2} height={PLAYER_R * 2} rx={1.6} fill={look.fill} stroke={look.stroke} strokeWidth={sw} />}
      {team === 'C' && <ConeShape sw={sw} />}
      {team === 'K' && <circle r={PLAYER_R} fill={COACH.fill} stroke={COACH.stroke} strokeWidth={sw} />}
      {team === 'B' && <ExtraBall />}
      {(team === 'O' || team === 'D' || team === 'K') && (
        <text textAnchor="middle" dy="0.36em" fontFamily={FONT} fontWeight={700} fontSize={fs} fill={team === 'K' ? '#fff' : look.ink} transform={rotate ? `rotate(${-rotate})` : undefined} style={{ userSelect: 'none' }}>
          {label}
        </text>
      )}
    </g>
  );
}

/** Colores del entrenador (no dependen del tema: siempre se distingue de los dos equipos). */
const COACH = { fill: '#475569', stroke: '#e2e8f0' };

/** Cono de entrenamiento: triángulo naranja con base. */
function ConeShape({ sw }: { sw: number }) {
  return (
    <g>
      {/* zona de agarre más grande que el dibujo, para poder cogerlo con el dedo */}
      <circle r={PLAYER_R} fill="transparent" />
      <path d="M0 -3.6 L3 3 H-3 Z" fill="#f59e0b" stroke="#92400e" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M-3.6 3.4 H3.6" stroke="#92400e" strokeWidth={sw + 0.3} strokeLinecap="round" />
    </g>
  );
}

/** Balón suelto adicional (los de reserva en un ejercicio de tiro, por ejemplo). */
function ExtraBall() {
  const C = usePalette();
  const r = BALL_R * 1.5;
  return (
    <g>
      <circle r={PLAYER_R} fill="transparent" />
      <circle r={r} fill={C.ball} stroke={C.ballLine} strokeWidth={0.4} />
      <path d={`M${-r} 0 H${r} M0 ${-r} V${r} M${-r * 0.7} ${-r * 0.7} Q0 0 ${-r * 0.7} ${r * 0.7} M${r * 0.7} ${-r * 0.7} Q0 0 ${r * 0.7} ${r * 0.7}`} stroke={C.ballLine} strokeWidth={0.3} fill="none" />
    </g>
  );
}

function BallShape({ pos, scale = 1, selected = false, interactive = false }: { pos: Pt; scale?: number; selected?: boolean; interactive?: boolean }) {
  const C = usePalette();
  const r = BALL_R * scale;
  return (
    <g transform={`translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})`} data-kind={interactive ? 'ball' : undefined} style={interactive ? { cursor: 'grab' } : undefined}>
      {selected && <circle r={r + 1.4} fill="none" stroke={C.select} strokeWidth={0.7} />}
      <circle r={r} fill={C.ball} stroke={C.ballLine} strokeWidth={0.35} />
      <path d={`M${-r} 0 H${r} M0 ${-r} V${r} M${-r * 0.7} ${-r * 0.7} Q0 0 ${-r * 0.7} ${r * 0.7} M${r * 0.7} ${-r * 0.7} Q0 0 ${r * 0.7} ${r * 0.7}`} stroke={C.ballLine} strokeWidth={0.25} fill="none" />
    </g>
  );
}

interface SceneProps {
  play: Play;
  scene: SceneState;
  actions: Drawable[];
  actionOpacity?: number;
  ghost?: { scene: SceneState; actions: Drawable[] } | null;
  selectedId?: string | null;
  interactive?: boolean;
  /** Ancho del anillo para dibujar (solo con `interactive`). */
  haloR?: number;
  children?: React.ReactNode;
}

/** Contenido completo de la pista. Componente puro: se usa en el editor y para exportar. */
export function SceneContent({ play, scene, actions, actionOpacity = 1, ghost, selectedId, interactive = false, haloR, children }: SceneProps) {
  return (
    <>
      <CourtLines court={play.court} />
      {ghost && (
        <g style={{ pointerEvents: 'none' }}>
          {ghost.actions.map((d) => (
            <ActionShape key={'g' + d.id} d={d} opacity={0.18} />
          ))}
          {play.players.map((p) => ghost.scene.positions[p.id] && <PlayerShape key={'g' + p.id} team={p.team} label={p.label} pos={ghost.scene.positions[p.id]} ghost />)}
        </g>
      )}
      <g style={interactive ? undefined : { pointerEvents: 'none' }}>
        {actions.map((d) => (
          <ActionShape key={d.id} d={d} opacity={actionOpacity} selected={d.id === selectedId} />
        ))}
      </g>
      {play.players.map(
        (p) =>
          scene.positions[p.id] && (
            <PlayerShape key={p.id} id={p.id} team={p.team} label={p.label} pos={scene.positions[p.id]} selected={p.id === selectedId} halo={interactive} haloR={haloR} />
          ),
      )}
      {scene.ball && <BallShape pos={scene.ball.pos} scale={scene.ball.scale} interactive={interactive} selected={selectedId === 'ball'} />}
      {children}
    </>
  );
}

/**
 * Pista completa en un SVG. Con `upright`, la pista entera se dibuja de pie (girada 90°),
 * para el vídeo vertical; los números de los jugadores siguen derechos.
 */
export function SceneSvg({ width, height, upright = false, ...props }: SceneProps & { width?: number; height?: number; upright?: boolean }) {
  const vb = viewBox(props.play.court);
  if (upright)
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${-vb.y - vb.h} ${vb.x} ${vb.h} ${vb.w}`} width={width} height={height}>
        <RotateContext.Provider value={90}>
          <g transform="rotate(90)">
            <SceneContent {...props} />
          </g>
        </RotateContext.Provider>
      </svg>
    );
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} width={width} height={height}>
      <SceneContent {...props} />
    </svg>
  );
}
