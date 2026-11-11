import { createContext, useContext } from 'react';

/**
 * Aspecto de la pista: tema (madera, pizarra blanca, pizarra verde de tiza) y colores de los equipos.
 * Es una preferencia de este navegador, no de cada jugada: se aplica al editor y a lo que se exporta.
 */
type PitchTheme = 'madera' | 'blanca' | 'tiza';

export interface Appearance {
  pitch: PitchTheme;
  /** Color del ataque y de la defensa, en «#rrggbb». */
  offense: string;
  defense: string;
}

export const DEFAULT_APPEARANCE: Appearance = { pitch: 'madera', offense: '#1d4ed8', defense: '#c62828' };

export const PITCHES: { id: PitchTheme; name: string; hint: string }[] = [
  { id: 'madera', name: 'Madera', hint: 'Parqué de pabellón' },
  { id: 'blanca', name: 'Pizarra blanca', hint: 'Trazos de rotulador' },
  { id: 'tiza', name: 'Pizarra verde', hint: 'Trazos de tiza' },
];

export const TEAM_COLORS: { name: string; hex: string }[] = [
  { name: 'Azul', hex: '#1d4ed8' },
  { name: 'Celeste', hex: '#0284c7' },
  { name: 'Rojo', hex: '#c62828' },
  { name: 'Granate', hex: '#7f1d1d' },
  { name: 'Verde', hex: '#15803d' },
  { name: 'Morado', hex: '#7e22ce' },
  { name: 'Amarillo', hex: '#eab308' },
  { name: 'Negro', hex: '#111827' },
  { name: 'Blanco', hex: '#f8fafc' },
];

/** Colores ya resueltos con los que se dibuja la pista. */
export interface Palette {
  pitch: PitchTheme;
  floor: string;
  outside: string;
  paint: string;
  line: string;
  lineWidth: number;
  /** Color de las acciones del ataque y de la defensa. */
  lineO: string;
  lineD: string;
  shot: string;
  rim: string;
  ball: string;
  ballLine: string;
  select: string;
  /** Jugadores: relleno, borde y número de cada equipo. */
  team: Record<'O' | 'D', { fill: string; stroke: string; ink: string }>;
  /** Marco de las imágenes y vídeos exportados. */
  frame: { bg: string; title: string; muted: string; note: string; logo: string };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Luminancia relativa (0 negro, 1 blanco). */
function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const isLight = (hex: string) => luminance(hex) > 0.4;
/** Color de texto legible sobre `hex`. */
export const inkFor = (hex: string) => (isLight(hex) ? '#111827' : '#ffffff');

/** Valida lo guardado: lo que no encaje vuelve al valor por defecto. */
export function parseAppearance(raw: unknown): Appearance {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const color = (v: unknown, def: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : def);
  return {
    pitch: PITCHES.some((p) => p.id === o.pitch) ? (o.pitch as PitchTheme) : DEFAULT_APPEARANCE.pitch,
    offense: color(o.offense, DEFAULT_APPEARANCE.offense),
    defense: color(o.defense, DEFAULT_APPEARANCE.defense),
  };
}

export function paletteFor(a: Appearance): Palette {
  const teamFor = (hex: string, pitch: PitchTheme) => {
    if (pitch === 'blanca')
      // rotulador: círculo hueco con el número del color del equipo (el blanco no se vería: va en negro)
      return isLight(hex) ? { fill: '#ffffff', stroke: '#111827', ink: '#111827' } : { fill: '#ffffff', stroke: hex, ink: hex };
    const light = isLight(hex);
    return { fill: hex, stroke: pitch === 'tiza' ? '#f1f5f9' : light ? '#334155' : '#ffffff', ink: light ? '#111827' : '#ffffff' };
  };
  // en las líneas, un color muy claro no se ve sobre la madera ni sobre la pizarra blanca
  const lineFor = (hex: string, fallback: string) => (isLight(hex) ? fallback : hex);

  if (a.pitch === 'blanca')
    return {
      pitch: 'blanca',
      floor: '#ffffff',
      outside: '#eef1f5',
      paint: '#ffffff',
      line: '#5b6475',
      lineWidth: 0.9,
      lineO: '#111827',
      lineD: lineFor(a.defense, '#111827'),
      shot: '#ea580c',
      rim: '#ea580c',
      ball: '#f97316',
      ballLine: '#7c2d12',
      select: '#f97316',
      team: { O: teamFor(a.offense, 'blanca'), D: teamFor(a.defense, 'blanca') },
      frame: { bg: '#ffffff', title: '#111827', muted: '#64748b', note: '#1f2937', logo: '#111827' },
    };
  if (a.pitch === 'tiza')
    return {
      pitch: 'tiza',
      floor: '#24493a',
      outside: '#1c3a2e',
      paint: '#2a5242',
      line: '#d9e4dc',
      lineWidth: 1,
      lineO: '#f8fafc',
      lineD: '#fecaca',
      shot: '#fdba74',
      rim: '#fdba74',
      ball: '#f97316',
      ballLine: '#7c2d12',
      select: '#fdba74',
      team: { O: teamFor(a.offense, 'tiza'), D: teamFor(a.defense, 'tiza') },
      frame: { bg: '#14261d', title: '#f8fafc', muted: '#a7bfb2', note: '#e2ece5', logo: '#f8fafc' },
    };
  return {
    pitch: 'madera',
    floor: '#f7f1e3',
    outside: '#e9dfc9',
    paint: '#efe2c4',
    line: '#3b4252',
    lineWidth: 1,
    lineO: '#1f2937',
    lineD: lineFor(a.defense, '#1f2937'),
    shot: '#ea580c',
    rim: '#ea580c',
    ball: '#f97316',
    ballLine: '#7c2d12',
    select: '#f97316',
    team: { O: teamFor(a.offense, 'madera'), D: teamFor(a.defense, 'madera') },
    frame: { bg: '#1e293b', title: '#ffffff', muted: '#94a3b8', note: '#e2e8f0', logo: '#ffffff' },
  };
}

export const ThemeContext = createContext<Palette>(paletteFor(DEFAULT_APPEARANCE));
export const usePalette = () => useContext(ThemeContext);

/**
 * Giro de la pista para el vídeo vertical: la pista entera se pone de pie y los números
 * de los jugadores se giran al revés para que se sigan leyendo derechos.
 */
export const RotateContext = createContext(0);
