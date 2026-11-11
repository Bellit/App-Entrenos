export interface Pt {
  x: number;
  y: number;
}

/**
 * Qué es cada elemento de la pista. O = atacante, D = defensor; los demás son «objetos»:
 * C = cono, K = entrenador, B = balón extra. Todos tienen posición en cada fotograma y se
 * pueden mover y arrastrar igual que un jugador, pero solo O y D pueden tener el balón o pasarlo.
 */
export type Team = 'O' | 'D' | 'C' | 'K' | 'B';
export const TEAMS: readonly Team[] = ['O', 'D', 'C', 'K', 'B'];
export const isTeam = (v: unknown): v is Team => TEAMS.includes(v as Team);
/** ¿Puede tener el balón (y por tanto botar, pasar o tirar)? */
export const holdsBall = (t: Team) => t === 'O' || t === 'D';
export type CourtType = 'half' | 'full';

export interface Player {
  id: string;
  team: Team;
  label: string;
}

export type MoveType = 'move' | 'dribble' | 'screen';

export interface MoveAction {
  id: string;
  type: MoveType;
  playerId: string;
  /** Puntos de control de la trayectoria; el primero es la posición inicial del jugador. */
  points: Pt[];
}

export interface PassAction {
  id: string;
  type: 'pass';
  from: string;
  to: string;
}

export interface ShotAction {
  id: string;
  type: 'shot';
  playerId: string;
}

export type Action = MoveAction | PassAction | ShotAction;

export interface BallState {
  /** Jugador que tiene el balón, o null si está suelto. */
  holder: string | null;
  /** Posición del balón cuando está suelto. */
  pos: Pt;
}

export interface Frame {
  id: string;
  /** Posiciones al inicio del fotograma. */
  positions: Record<string, Pt>;
  ball: BallState;
  /** Acciones que llevan de este fotograma al siguiente. */
  actions: Action[];
  /** Duración de la transición en segundos. */
  duration: number;
  note: string;
}

/** Tipos de jugada para ordenar «Mis jugadas». */
export const CATEGORIES = [
  { id: 'ato', name: 'ATO' },
  { id: 'saque-fondo', name: 'Saque de fondo' },
  { id: 'saque-banda', name: 'Saque de banda' },
  { id: 'estatico', name: 'Ataque estático' },
  { id: 'transicion', name: 'Transición' },
] as const;
export type Category = (typeof CATEGORIES)[number]['id'];
export const isCategory = (v: unknown): v is Category => CATEGORIES.some((c) => c.id === v);

export interface Play {
  version: 1;
  id: string;
  name: string;
  /** Opcional: las jugadas guardadas antes no la tienen. */
  category?: Category;
  court: CourtType;
  players: Player[];
  frames: Frame[];
  createdAt: number;
  updatedAt: number;
}

export const isMove = (a: Action): a is MoveAction =>
  a.type === 'move' || a.type === 'dribble' || a.type === 'screen';
