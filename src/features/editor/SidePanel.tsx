import { useRef } from 'react';
import * as P from '../../model/play';
import type { CourtType, MoveType, Team } from '../../model/types';
import { isMove } from '../../model/types';
import { useActions, useStore } from '../../store';
import { usePalette } from '../../court/theme';
import { IconTrash } from '../../ui/Icons';
import { PanelSection as Section } from '../../ui/PanelSection';
import './SidePanel.css';

const TEAM_NAMES: Record<Team, string> = { O: 'Atacante', D: 'Defensor', C: 'Cono', K: 'Entrenador', B: 'Balón extra' };

const ACTION_NAMES: Record<string, string> = {
  move: 'Desplazamiento',
  dribble: 'Conducción',
  screen: 'Bloqueo',
  pass: 'Pase',
  shot: 'Tiro',
};

function Legend() {
  const row = (label: string, el: React.ReactNode) => (
    <li>
      <svg width="54" height="14" viewBox="0 0 54 14" aria-hidden="true">
        {el}
      </svg>
      {label}
    </li>
  );
  const C = usePalette();
  const c = C.lineO;
  return (
    <ul className="legend" style={{ background: C.floor, color: C.lineO }}>
      {row('Desplazamiento', <><path d="M2 7H44" stroke={c} strokeWidth="2" /><path d="M52 7l-9 -4.5v9z" fill={c} /></>)}
      {row('Conducción', <><path d="M2 7l3-4 3 8 3-8 3 8 3-8 3 8 3-8 3 8 3-8 3 8 3-4H44" stroke={c} strokeWidth="1.6" fill="none" /><path d="M52 7l-9 -4.5v9z" fill={c} /></>)}
      {row('Pase', <><path d="M2 7H44" stroke={c} strokeWidth="2" strokeDasharray="5 3.5" /><path d="M52 7l-9 -4.5v9z" fill={c} /></>)}
      {row('Bloqueo', <><path d="M2 7H48" stroke={c} strokeWidth="2" /><path d="M49 1V13" stroke={c} strokeWidth="3" strokeLinecap="round" /></>)}
      {row('Tiro', <><path d="M2 5H44M2 9H44" stroke={C.shot} strokeWidth="1.5" strokeDasharray="2.5 2.5" /><path d="M52 7l-9 -4.5v9z" fill={C.shot} /></>)}
    </ul>
  );
}

/**
 * Panel lateral: lo seleccionado, los datos del ejercicio (`head`, que monta la pantalla del editor), la pista,
 * el fotograma y la vista. `extra` son secciones de otras funcionalidades (el aspecto).
 */
export function SidePanel({ head, extra, onClose }: { head?: React.ReactNode; extra?: React.ReactNode; onClose?: () => void }) {
  const play = useStore((s) => s.play);
  const frame = useStore((s) => s.frame);
  const selection = useStore((s) => s.selection);
  const showGhost = useStore((s) => s.showGhost);
  const showLines = useStore((s) => s.showLines);
  const { edit, select, set } = useActions();
  const f = play.frames[frame];
  const labelBefore = useRef('');

  const player = selection?.kind === 'player' ? P.playerById(play, selection.id) : undefined;
  const action = selection?.kind === 'action' ? f.actions.find((a) => a.id === selection.id) : undefined;
  const actor = action ? P.playerById(play, action.type === 'pass' ? action.from : action.playerId) : undefined;

  return (
    <aside className="side" id="panel-lateral" aria-label="Propiedades">
      {/* en tablet y móvil el panel se pliega: cabecera para cerrarlo */}
      {onClose && (
        <div className="side-head">
          <span>Propiedades</span>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar el panel de propiedades">
            ✕
          </button>
        </div>
      )}
      {/* Lo seleccionado va arriba del todo, siempre abierto */}
      {player && (
        <section className="panel selected">
          <h2>{TEAM_NAMES[player.team]}</h2>
          <div className="panel-body">
            {player.team !== 'C' && player.team !== 'B' && (
            <label className="field">
              <span>Etiqueta</span>
              <input
                value={player.label}
                maxLength={P.LABEL_MAX}
                onFocus={() => (labelBefore.current = player.label)}
                onBlur={() => {
                  // una etiqueta vacía no se deja: se recupera la que tenía
                  if (player.label.trim() || !labelBefore.current) return;
                  const prev = labelBefore.current;
                  edit((p) => {
                    const pl = P.playerById(p, player.id);
                    if (pl) pl.label = prev;
                  }, `label:${player.id}`);
                }}
                onChange={(e) =>
                  edit((p) => {
                    const pl = P.playerById(p, player.id);
                    if (pl) pl.label = e.target.value;
                  }, `label:${player.id}`)
                }
              />
            </label>
            )}
            <button className="btn danger" onClick={() => { edit((p) => P.removePlayer(p, player.id)); select(null); }}>
              <IconTrash /> {player.team === 'C' || player.team === 'B' || player.team === 'K' ? 'Quitar' : 'Quitar jugador'}
            </button>
          </div>
        </section>
      )}

      {action && (
        <section className="panel selected">
          <h2>
            {ACTION_NAMES[action.type]} {actor && <small>de {actor.label}</small>}
          </h2>
          <div className="panel-body">
            {isMove(action) && (
              <label className="field">
                <span>Tipo</span>
                <select value={action.type} onChange={(e) => edit((p) => P.setActionType(p, frame, action.id, e.target.value as MoveType))}>
                  <option value="move">Desplazamiento</option>
                  <option value="dribble" disabled={f.ball.holder !== action.playerId}>Conducción</option>
                  <option value="screen">Bloqueo</option>
                </select>
              </label>
            )}
            {isMove(action) && <p className="muted">Arrastra el punto blanco del final para ajustar el destino.</p>}
            <button className="btn danger" onClick={() => { edit((p) => P.deleteAction(p, frame, action.id)); select(null); }}>
              <IconTrash /> Borrar acción
            </button>
          </div>
        </section>
      )}

      {head}
      <Section id="pista" title="Pista">
        <div className="field">
          <span id="court-label">Pista</span>
          <div className="segmented" role="radiogroup" aria-labelledby="court-label">
            {(['half', 'full'] as CourtType[]).map((c) => (
              <button key={c} role="radio" aria-checked={play.court === c} className={play.court === c ? 'on' : ''} onClick={() => edit((p) => P.setCourt(p, c))}>
                {c === 'half' ? 'Media pista' : 'Pista entera'}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section id="fotograma" title={`Fotograma ${frame + 1}`}>
        <label className="field">
          <span>
            Duración <output>{f.duration.toFixed(1)} s</output>
          </span>
          <input type="range" min={0.6} max={4} step={0.1} value={f.duration} onChange={(e) => edit((p) => (p.frames[frame].duration = Number(e.target.value)), `duration:${f.id}`)} />
        </label>
        <label className="field">
          <span>Nota (sale en el vídeo)</span>
          <textarea
            rows={2}
            maxLength={120}
            placeholder="Ej.: 1 pasa a 2 y corta por dentro"
            value={f.note}
            onChange={(e) => edit((p) => (p.frames[frame].note = e.target.value), `note:${f.id}`)}
          />
        </label>
      </Section>

      <Section id="vista" title="Vista">
        <label className="check">
          <input type="checkbox" checked={showGhost} onChange={(e) => set({ showGhost: e.target.checked })} /> Ver fotograma anterior en gris
        </label>
        <label className="check">
          <input type="checkbox" checked={showLines} onChange={(e) => set({ showLines: e.target.checked })} /> Ver líneas de acciones
        </label>
      </Section>

      {extra}

      <Section id="leyenda" title="Leyenda" defaultOpen={false}>
        <Legend />
      </Section>
    </aside>
  );
}
