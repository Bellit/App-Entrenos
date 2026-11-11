import type { Pt } from './types';

/**
 * Formaciones iniciales en coordenadas de media pista (canasta arriba, fondo en y = 0,
 * línea de tiros libres en y = 58, centro del campo en y = 140). Valores negativos = fuera de la pista
 * (el sacador de un saque de fondo o de banda). El primer jugador de la lista (el «1») lleva el balón.
 */
interface Formation {
  id: string;
  name: string;
  hint: string;
  offense: Pt[];
}

export const FORMATIONS: Formation[] = [
  {
    id: 'abierta',
    name: '5 abiertos',
    hint: 'Base arriba, aleros y un interior',
    offense: [
      { x: 75, y: 95 },
      { x: 128, y: 62 },
      { x: 22, y: 62 },
      { x: 138, y: 12 },
      { x: 50, y: 26 },
    ],
  },
  {
    id: '1-4-alto',
    name: '1-4 alto',
    hint: 'Base arriba y cuatro en línea a la altura del tiro libre',
    offense: [
      { x: 75, y: 96 },
      { x: 131, y: 58 },
      { x: 19, y: 58 },
      { x: 99, y: 58 },
      { x: 51, y: 58 },
    ],
  },
  {
    id: 'horns',
    name: 'Horns',
    hint: 'Interiores en los codos y tiradores en las esquinas',
    offense: [
      { x: 75, y: 96 },
      { x: 139, y: 9 },
      { x: 11, y: 9 },
      { x: 97, y: 58 },
      { x: 53, y: 58 },
    ],
  },
  {
    id: '1-3-1',
    name: '1-3-1',
    hint: 'Base, dos aleros, poste alto y un jugador en la línea de fondo',
    offense: [
      { x: 75, y: 96 },
      { x: 127, y: 58 },
      { x: 23, y: 58 },
      { x: 105, y: 8 },
      { x: 75, y: 56 },
    ],
  },
  {
    id: 'saque-fondo',
    name: 'Saque de fondo',
    hint: 'Sacador fuera de la línea de fondo y caja en la zona',
    offense: [
      { x: 52, y: -5 },
      { x: 95, y: 52 },
      { x: 55, y: 52 },
      { x: 92, y: 20 },
      { x: 58, y: 20 },
    ],
  },
  {
    id: 'saque-banda',
    name: 'Saque de banda',
    hint: 'Sacador fuera de la banda y jugadores escalonados',
    offense: [
      { x: -5, y: 100 },
      { x: 28, y: 92 },
      { x: 60, y: 78 },
      { x: 92, y: 64 },
      { x: 75, y: 118 },
    ],
  },
];

export type DefenseKind = 'none' | 'man' | 'zone23';

/** Defensa en zona 2-3: dos arriba y tres abajo, delante de la canasta. */
export const ZONE_23: Pt[] = [
  { x: 56, y: 66 },
  { x: 94, y: 66 },
  { x: 28, y: 32 },
  { x: 122, y: 32 },
  { x: 75, y: 24 },
];

export const formationById = (id: string) => FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
