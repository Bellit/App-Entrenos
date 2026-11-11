/** Utilidades y constantes compartidas por todo el modelo. */

export const uid = () => Math.random().toString(36).slice(2, 10);
export const clone = <T,>(v: T): T => structuredClone(v);

/** Momento (0-1) de la transición en que sale el pase o el tiro. */
export const RELEASE_T = 0.5;
export const DEFAULT_DURATION = 1.6;

/** Límites para que un archivo malicioso o roto no bloquee la app ni llene el almacenamiento. */
export const LIMITS = { frames: 200, players: 40, points: 600, fileBytes: 1_000_000 };

/** Máximo de letras de la etiqueta de un jugador (cabe «2(3)», como en las filas de la ficha). */
export const LABEL_MAX = 4;
