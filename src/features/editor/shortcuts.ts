import { useEffect } from 'react';
import { TOOLS } from './Toolbar';
import { exitPresenting, toggleFullscreen } from '../../hooks/fullscreen';
import * as P from '../../model/play';
import { useStore } from '../../store';

type Store = ReturnType<typeof useStore.getState>;

interface Shortcut {
  /** Cómo se muestra en la ayuda. */
  keys: string;
  help: string;
  /** Teclas (`e.key` en minúsculas) que lo activan. */
  match: string[];
  /** Con Ctrl (o Cmd en Mac). */
  ctrl?: boolean;
  /** Condición extra sobre la tecla pulsada (por ejemplo, con o sin mayúsculas). */
  when?: (e: KeyboardEvent) => boolean;
  run: (s: Store, e: KeyboardEvent) => void;
}

function deleteSelection(s: Store) {
  const sel = s.selection;
  if (!sel) return;
  if (sel.kind === 'player') s.edit((p) => P.removePlayer(p, sel.id));
  else if (sel.kind === 'ball') s.edit((p) => P.removeBall(p, sel.id));
  else s.edit((p) => P.deleteAction(p, s.frame, sel.id));
  s.select(null);
}

/**
 * Todos los atajos de teclado en un solo sitio: de aquí salen tanto lo que hace cada tecla
 * como la lista de la ventana de ayuda.
 */
export const SHORTCUTS: Shortcut[] = [
  ...TOOLS.map((t) => ({ keys: t.key, help: t.help, match: [t.key.toLowerCase()], run: (s: Store) => s.setTool(t.id) })),
  { keys: 'N', help: 'Nuevo fotograma a partir del actual', match: ['n'], run: (s) => s.addFrame() },
  { keys: '← →', help: 'Fotograma anterior / siguiente', match: ['arrowleft', 'arrowright'], run: (s, e) => s.setFrame(s.frame + (e.key === 'ArrowLeft' ? -1 : 1)) },
  { keys: 'Espacio', help: 'Reproducir / pausar', match: [' '], run: (s) => s.togglePlay() },
  { keys: 'F', help: 'Pantalla completa para enseñar la jugada', match: ['f'], run: () => toggleFullscreen() },
  { keys: 'Supr', help: 'Borrar lo seleccionado', match: ['delete', 'backspace'], run: deleteSelection },
  { keys: 'Esc', help: 'Quitar la selección o salir de la reproducción', match: ['escape'], run: (s) => {
    exitPresenting();
    if (s.playhead) s.set({ playhead: null, playing: false });
    else s.select(null);
  } },
  { keys: 'Ctrl+Z', help: 'Deshacer', match: ['z'], ctrl: true, when: (e) => !e.shiftKey, run: (s) => s.undo() },
  { keys: 'Ctrl+Y', help: 'Rehacer (también Ctrl+Mayús+Z)', match: ['y', 'z'], ctrl: true, when: (e) => e.key.toLowerCase() === 'y' || e.shiftKey, run: (s) => s.redo() },
];

/** Atiende los atajos mientras no se esté escribiendo en un campo ni haya un diálogo abierto. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, select, dialog[open]')) return;
      if (e.altKey) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const sc = SHORTCUTS.find((x) => x.match.includes(key) && !!x.ctrl === ctrl && (!x.when || x.when(e)));
      if (!sc) return;
      e.preventDefault();
      sc.run(useStore.getState(), e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
