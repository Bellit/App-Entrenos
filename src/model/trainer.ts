/**
 * Modo entreno: lógica pura (sin React), para poder probarla con tests.
 * - `loopPlayhead`: en qué fotograma y en qué punto de su transición va la animación en bucle.
 * - `formatTimer`: el cronómetro del bloque, «4:59» o «+0:35» cuando ya se ha pasado.
 * - `parseNotes`: la explicación del ejercicio en párrafos, etiquetas («Objetivo:») y listas («- »).
 */
import type { Play } from './types';

/** Pausa al final de cada vuelta de la animación, en segundos (para ver la posición final). */
export const LOOP_PAUSE = 1.2;

/**
 * Posición de la animación tras `elapsed` segundos, repitiéndose en bucle con una pausa al final.
 * Devuelve el fotograma `k` y el avance `t` (0-1) de su transición; en la pausa se queda en el
 * último fotograma con t = 1.
 */
export function loopPlayhead(play: Play, elapsed: number): { k: number; t: number } {
  const n = play.frames.length;
  if (n <= 1) return { k: 0, t: 0 };
  // el último fotograma no tiene transición en una animación cerrada: se anima hasta el penúltimo
  const durations = play.frames.slice(0, n - 1).map((f) => f.duration);
  const total = durations.reduce((a, d) => a + d, 0);
  let left = ((elapsed % (total + LOOP_PAUSE)) + total + LOOP_PAUSE) % (total + LOOP_PAUSE);
  for (let k = 0; k < durations.length; k++) {
    if (left < durations[k]) return { k, t: left / durations[k] };
    left -= durations[k];
  }
  return { k: n - 2, t: 1 };
}

/** «4:59», «0:07», y cuando se ha pasado del tiempo «+0:35». `seconds` = segundos que quedan. */
export function formatTimer(seconds: number): string {
  const over = seconds < 0;
  const s = Math.abs(over ? Math.floor(seconds) : Math.ceil(seconds));
  const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return over ? `+${txt}` : txt;
}

export type NotesPart = { kind: 'p'; label?: string; text: string } | { kind: 'ul'; items: string[] };

/**
 * Convierte la explicación (texto sencillo) en partes para mostrarla grande y clara:
 * - una línea que empieza por «- » o «• » es un punto de una lista;
 * - «Objetivo: algo» o «Objetivo:» sola se muestran con la etiqueta en negrita;
 * - las etiquetas vacías («Variantes:» sin nada debajo) se omiten.
 */
export function parseNotes(text: string): NotesPart[] {
  const out: NotesPart[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let pendingLabel: string | undefined;
  const flushLabel = () => {
    pendingLabel = undefined;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-•]\s*(.*)$/.exec(line);
    if (bullet) {
      if (!bullet[1]) continue;
      if (pendingLabel) out.push({ kind: 'p', label: pendingLabel, text: '' });
      flushLabel();
      const last = out[out.length - 1];
      if (last?.kind === 'ul') last.items.push(bullet[1]);
      else out.push({ kind: 'ul', items: [bullet[1]] });
      continue;
    }
    const labelled = /^([^:]{1,30}):\s*(.*)$/.exec(line);
    if (labelled && !/https?$/i.test(labelled[1])) {
      if (pendingLabel) flushLabel(); // etiqueta anterior sin contenido: se omite
      if (labelled[2]) out.push({ kind: 'p', label: labelled[1], text: labelled[2] });
      else pendingLabel = labelled[1];
      continue;
    }
    out.push({ kind: 'p', label: pendingLabel, text: line });
    flushLabel();
  }
  return out;
}
