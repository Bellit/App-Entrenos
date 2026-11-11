import { create } from 'zustand';
import { addFrameAfter, clone, LIMITS, newPlay } from './model/play';
import type { Play } from './model/types';
import { readJson, writeJson } from './prefs';
import { type Appearance, parseAppearance } from './court/theme';

const APPEARANCE_KEY = 'entrenos.apariencia';
const loadAppearance = (): Appearance => parseAppearance(readJson(APPEARANCE_KEY, null));

export type Tool = 'select' | 'move' | 'dribble' | 'pass' | 'screen' | 'shot';
export type Selection = { kind: 'player' | 'action'; id: string } | null;
interface Playhead {
  k: number;
  t: number;
}

interface State {
  play: Play;
  past: Play[];
  future: Play[];
  frame: number;
  tool: Tool;
  selection: Selection;
  playing: boolean;
  playhead: Playhead | null;
  speed: number;
  loop: boolean;
  showGhost: boolean;
  showLines: boolean;
  toast: string | null;
  /** Ventana de ayuda y atajos abierta. */
  helpOpen: boolean;
  /** Tema de la pista y colores de los equipos (preferencia de este navegador). */
  appearance: Appearance;
  setAppearance: (a: Partial<Appearance>) => void;

  /**
   * Cambio con historial (deshacer). Con `group`, los cambios seguidos del mismo grupo
   * (escribir una nota letra a letra, arrastrar el deslizador) cuentan como uno solo.
   */
  edit: (fn: (p: Play) => void, group?: string) => void;
  /** Grupo del último cambio, para juntar los cambios seguidos. */
  lastGroup: string | null;
  /** Vista previa durante un arrastre, sin historial, partiendo de `base`. */
  preview: (base: Play, fn: (p: Play) => void) => void;
  /** Cierra un arrastre guardando `base` en el historial. */
  commit: (base: Play) => void;
  undo: () => void;
  redo: () => void;
  load: (p: Play) => void;
  setFrame: (k: number) => void;
  setTool: (t: Tool) => void;
  select: (s: Selection) => void;
  set: (s: Partial<Pick<State, 'playing' | 'playhead' | 'speed' | 'loop' | 'showGhost' | 'showLines' | 'helpOpen'>>) => void;
  notify: (msg: string) => void;
  /** Añade un fotograma tras el actual (a partir de su final) y lo abre. */
  addFrame: () => void;
  /** Reproduce o pausa; si la reproducción había terminado, vuelve a empezar. */
  togglePlay: () => void;
}

const HISTORY = 100;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
/** Pausa (ms) a partir de la cual seguir escribiendo cuenta como un cambio nuevo. */
const GROUP_PAUSE = 2000;
let lastEditAt = 0;

const clampFrame = (p: Play, k: number) => Math.max(0, Math.min(p.frames.length - 1, k));

export const useStore = create<State>((set, get) => ({
  play: newPlay(),
  past: [],
  future: [],
  frame: 0,
  tool: 'select',
  selection: null,
  playing: false,
  playhead: null,
  speed: 1,
  loop: false,
  showGhost: true,
  showLines: true,
  toast: null,
  helpOpen: false,
  appearance: loadAppearance(),
  setAppearance: (a) => {
    const appearance = parseAppearance({ ...get().appearance, ...a });
    set({ appearance });
    writeJson(APPEARANCE_KEY, appearance);
  },
  lastGroup: null,

  edit: (fn, group) => {
    const { play, past, frame, lastGroup } = get();
    const next = clone(play);
    fn(next);
    next.updatedAt = Date.now();
    // se junta con el cambio anterior si es del mismo grupo y llega sin una pausa larga
    const now = Date.now();
    const merge = !!group && group === lastGroup && past.length > 0 && now - lastEditAt < GROUP_PAUSE;
    lastEditAt = now;
    set({
      play: next,
      past: merge ? past : [...past, play].slice(-HISTORY),
      future: [],
      lastGroup: group ?? null,
      frame: clampFrame(next, frame),
      playhead: null,
      playing: false,
    });
  },

  preview: (base, fn) => {
    const next = clone(base);
    fn(next);
    next.updatedAt = Date.now();
    set({ play: next, lastGroup: null });
  },

  commit: (base) => {
    const { play, past } = get();
    if (play === base) return;
    set({ past: [...past, base].slice(-HISTORY), future: [], lastGroup: null });
  },

  undo: () => {
    const { past, play, future, frame } = get();
    if (!past.length) return;
    // con fecha actual: lo deshecho es el último cambio, también al sincronizar con otro ordenador
    const prev = { ...past[past.length - 1], updatedAt: Date.now() };
    set({ play: prev, past: past.slice(0, -1), future: [play, ...future], lastGroup: null, frame: clampFrame(prev, frame), selection: null, playhead: null, playing: false });
  },

  redo: () => {
    const { past, play, future, frame } = get();
    if (!future.length) return;
    const next = { ...future[0], updatedAt: Date.now() };
    set({ play: next, past: [...past, play], future: future.slice(1), lastGroup: null, frame: clampFrame(next, frame), selection: null, playhead: null, playing: false });
  },

  load: (p) => set({ play: p, past: [], future: [], lastGroup: null, frame: 0, selection: null, playhead: null, playing: false }),
  setFrame: (k) => set((s) => ({ lastGroup: null, frame: clampFrame(s.play, k), selection: null, playhead: null, playing: false })),
  setTool: (tool) => set({ tool, selection: null }),
  select: (selection) => set({ selection }),
  set: (s) => set(s),
  addFrame: () => {
    const s = get();
    if (s.play.frames.length >= LIMITS.frames) return s.notify(`Una jugada admite como mucho ${LIMITS.frames} fotogramas.`);
    let next = s.frame;
    s.edit((p) => (next = addFrameAfter(p, s.frame)));
    get().setFrame(next);
  },
  togglePlay: () => {
    const { playing, playhead, play } = get();
    if (playing) return set({ playing: false });
    const finished = !playhead || (playhead.k === play.frames.length - 1 && playhead.t >= 1);
    set({ playing: true, playhead: finished ? { k: 0, t: 0 } : playhead });
  },
  notify: (msg) => {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2800);
  },
}));

/**
 * Las acciones del almacén, para usarlas en componentes. Zustand nunca las cambia (solo cambian
 * los datos), así que se toman una vez y el componente no se suscribe a nada por ellas;
 * para leer datos se usa `useStore(s => s.dato)`.
 */
const { edit, undo, redo, load, setFrame, setTool, select, set, notify, addFrame, togglePlay, setAppearance } = useStore.getState();
const actions = { edit, undo, redo, load, setFrame, setTool, select, set, notify, addFrame, togglePlay, setAppearance };
export const useActions = () => actions;
