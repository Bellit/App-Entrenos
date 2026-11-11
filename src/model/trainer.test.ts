import { describe, expect, it } from 'vitest';
import * as P from './play';
import { formatTimer, LOOP_PAUSE, loopPlayhead, parseNotes } from './trainer';

describe('animación en bucle', () => {
  const threeFrames = () => {
    const play = P.newPlay();
    P.addFrameAfter(play, 0);
    P.addFrameAfter(play, 1);
    play.frames.forEach((f) => (f.duration = 2));
    return play; // se anima 0→1 y 1→2: 4 s, más la pausa
  };

  it('un solo fotograma: siempre quieto', () => {
    expect(loopPlayhead(P.newPlay(), 10)).toEqual({ k: 0, t: 0 });
  });

  it('avanza por los fotogramas', () => {
    const play = threeFrames();
    const a = loopPlayhead(play, 1);
    const b = loopPlayhead(play, 3);
    expect(a.k).toBe(0);
    expect(a.t).toBeCloseTo(0.5);
    expect(b.k).toBe(1);
    expect(b.t).toBeCloseTo(0.5);
  });

  it('se para un momento al final y vuelve a empezar', () => {
    const play = threeFrames();
    expect(loopPlayhead(play, 4 + LOOP_PAUSE / 2)).toEqual({ k: 1, t: 1 });
    const again = loopPlayhead(play, 4 + LOOP_PAUSE + 1);
    expect(again.k).toBe(0);
    expect(again.t).toBeCloseTo(0.5);
  });
});

describe('cronómetro', () => {
  it('cuenta hacia atrás en minutos y segundos', () => {
    expect(formatTimer(300)).toBe('5:00');
    expect(formatTimer(299.2)).toBe('5:00');
    expect(formatTimer(7)).toBe('0:07');
    expect(formatTimer(0)).toBe('0:00');
  });
  it('si se pasa, lo indica con +', () => {
    expect(formatTimer(-35)).toBe('+0:35');
    expect(formatTimer(-0.4)).toBe('+0:01');
  });
});

describe('explicación del ejercicio', () => {
  it('etiquetas, listas y párrafos', () => {
    const parts = parseNotes('Objetivo: leer el bloqueo\n\nCómo se hace:\nEl 1 bota hacia el bloqueo.\n- Hombro con hombro\n- Pasar tras dos botes\nVariantes:\n');
    expect(parts).toEqual([
      { kind: 'p', label: 'Objetivo', text: 'leer el bloqueo' },
      { kind: 'p', label: 'Cómo se hace', text: 'El 1 bota hacia el bloqueo.' },
      { kind: 'ul', items: ['Hombro con hombro', 'Pasar tras dos botes'] },
    ]);
  });
  it('la plantilla vacía no muestra nada', () => {
    expect(parseNotes('Objetivo:\n\nOrganización:\n\nPuntos clave:\n- \n')).toEqual([]);
  });
  it('un enlace no se confunde con una etiqueta', () => {
    expect(parseNotes('https://ejemplo.com')).toEqual([{ kind: 'p', label: undefined, text: 'https://ejemplo.com' }]);
  });
});
