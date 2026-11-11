import * as P from '../../model/play';
import type { Team } from '../../model/types';
import { useStore, type Tool } from '../../store';
import { IconDribble, IconMove, IconPass, IconPlus, IconScreen, IconSelect, IconShot } from '../../ui/Icons';
import { Menu } from '../../ui/Menu';
import './Toolbar.css';

/** `short`: nombre bajo el icono; `label`: descripción (tooltip); `help`: explicación en la ayuda. */
export const TOOLS: { id: Tool; short: string; label: string; help: string; key: string; icon: () => React.ReactElement }[] = [
  { id: 'select', short: 'Seleccionar', label: 'Seleccionar y mover', help: 'Seleccionar: mover jugadores y balón; desde el anillo de un jugador, dibujar carrera, bote o pase', key: 'V', icon: IconSelect },
  { id: 'move', short: 'Correr', label: 'Correr (desplazamiento)', help: 'Correr: dibujar un desplazamiento', key: 'M', icon: IconMove },
  { id: 'dribble', short: 'Botar', label: 'Botar (conducción de balón)', help: 'Botar: conducción del jugador con balón', key: 'C', icon: IconDribble },
  { id: 'pass', short: 'Pasar', label: 'Pasar', help: 'Pasar: del jugador con balón a un compañero', key: 'P', icon: IconPass },
  { id: 'screen', short: 'Bloquear', label: 'Bloquear', help: 'Bloquear', key: 'B', icon: IconScreen },
  { id: 'shot', short: 'Tirar', label: 'Tirar', help: 'Tirar', key: 'T', icon: IconShot },
];

/**
 * Herramientas y botones para añadir jugadores. `variant="bar"` (móvil): una fila abajo, al alcance
 * del pulgar, con los botones de añadir reunidos en un menú «+».
 */
export function Toolbar({ variant = 'column' }: { variant?: 'column' | 'bar' }) {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const edit = useStore((s) => s.edit);
  const select = useStore((s) => s.select);
  const play = useStore((s) => s.play);
  const frame = useStore((s) => s.frame);
  const notify = useStore((s) => s.notify);
  const free = P.unmarked(play).length;

  const add = (team: Team) => {
    let id = '';
    if (play.players.length >= P.LIMITS.players) return notify(`Un ejercicio admite como mucho ${P.LIMITS.players} jugadores y objetos.`);
    edit((p) => (id = P.addPlayer(p, team, undefined, frame)));
    select({ kind: 'player', id });
    if (frame > 0) notify(`El jugador entra en el fotograma ${frame + 1}; en los anteriores no aparece.`);
  };

  if (variant === 'bar')
    return (
      <nav className="toolbar bar" aria-label="Herramientas">
        <div className="tool-group" role="radiogroup" aria-label="Acción a dibujar">
          {TOOLS.map((t) => (
            <button key={t.id} className={`tool${tool === t.id ? ' active' : ''}`} role="radio" aria-checked={tool === t.id} onClick={() => setTool(t.id)} title={t.label}>
              <t.icon />
              <span className="tool-label">{t.short}</span>
            </button>
          ))}
        </div>
        <Menu
          label="Añadir jugadores"
          title="Añadir jugadores"
          icon={<IconPlus />}
          iconOnly
          up
          items={[
            { label: 'Atacante', hint: 'Entra en el fotograma actual', onSelect: () => add('O') },
            { label: 'Defensor', hint: 'Entra en el fotograma actual', onSelect: () => add('D') },
            { label: 'Cono', hint: 'Material de pista', onSelect: () => add('C') },
            { label: 'Entrenador', onSelect: () => add('K') },
            { label: 'Balón extra', hint: 'Un balón más, suelto en la pista', onSelect: () => add('B') },
            { label: 'Defensa', hint: free ? `Un defensor para cada atacante sin marca (${free})` : 'Todos los atacantes tienen defensor', onSelect: () => edit((p) => P.addDefense(p)), disabled: free === 0 },
          ]}
        />
      </nav>
    );

  return (
    <aside className="toolbar" aria-label="Herramientas">
      <div className="tool-group" role="radiogroup" aria-label="Acción a dibujar">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool${tool === t.id ? ' active' : ''}`}
            role="radio"
            aria-checked={tool === t.id}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.key})`}
          >
            <t.icon />
            <span className="tool-label">{t.short}</span>
            <kbd>{t.key}</kbd>
          </button>
        ))}
      </div>

      <div className="tool-sep" />

      <div className="tool-group" aria-label="Jugadores">
        <button className="tool add" onClick={() => add('O')} title="Añadir atacante (entra en el fotograma actual)">
          <span className="chip chip-o">+</span>
          <span className="tool-label">Atacante</span>
        </button>
        <button className="tool add" onClick={() => add('D')} title="Añadir defensor (entra en el fotograma actual)">
          <span className="chip chip-d">+</span>
          <span className="tool-label">Defensor</span>
        </button>
        {free > 0 && (
          <button className="tool add" onClick={() => edit((p) => P.addDefense(p))} title={`Añade un defensor a cada atacante sin marca (${free})`}>
            <span className="chip chip-d">X</span>
            <span className="tool-label">Defensa</span>
          </button>
        )}
      </div>

      <div className="tool-sep" />

      <div className="tool-group" aria-label="Material">
        <button className="tool add" onClick={() => add('C')} title="Añadir un cono">
          <span className="chip chip-c" aria-hidden="true" />
          <span className="tool-label">Cono</span>
        </button>
        <button className="tool add" onClick={() => add('K')} title="Añadir al entrenador">
          <span className="chip chip-k">E</span>
          <span className="tool-label">Entrenador</span>
        </button>
        <button className="tool add" onClick={() => add('B')} title="Añadir un balón extra">
          <span className="chip chip-b" aria-hidden="true" />
          <span className="tool-label">Balón</span>
        </button>
      </div>
    </aside>
  );
}
