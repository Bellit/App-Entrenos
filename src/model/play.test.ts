import { describe, expect, it } from 'vitest';
import * as P from './play';
import type { Play } from './types';

/** Una jugada de prueba: 5 atacantes, el 1 con balón, media pista. */
const fresh = () => P.newPlay('Prueba', 'half');
const ids = (p: Play) => p.players.map((x) => x.id);

/** Cada fotograma empieza exactamente donde acaba el anterior (posiciones y balón). */
function expectChained(play: Play) {
  for (let k = 1; k < play.frames.length; k++) {
    const end = P.endState(play, k - 1);
    for (const [id, pos] of Object.entries(play.frames[k].positions)) {
      if (!end.positions[id]) continue;
      expect(pos.x).toBeCloseTo(end.positions[id].x, 1);
      expect(pos.y).toBeCloseTo(end.positions[id].y, 1);
    }
    expect(play.frames[k].ball.holder).toBe(end.ball.holder);
  }
}

describe('crear jugada', () => {
  it('5 atacantes, el primero con balón y sin guardar todavía', () => {
    const p = fresh();
    expect(p.players).toHaveLength(5);
    expect(p.players.every((x) => x.team === 'O')).toBe(true);
    expect(p.frames[0].ball.holder).toBe(p.players[0].id);
    expect(p.createdAt).toBe(p.updatedAt);
  });

  it('defensa individual: un X<n> por atacante', () => {
    const p = P.newPlay('Prueba', 'half', 'horns', 'man');
    const labels = p.players.filter((x) => x.team === 'D').map((x) => x.label);
    expect(labels.sort()).toEqual(['X1', 'X2', 'X3', 'X4', 'X5']);
    expect(P.unmarked(p)).toHaveLength(0);
  });

  it('zona 2-3: cinco defensores', () => {
    const p = P.newPlay('Prueba', 'full', 'abierta', 'zone23');
    expect(p.players.filter((x) => x.team === 'D')).toHaveLength(5);
  });
});

describe('editar con cascada', () => {
  it('mover un jugador mueve también los fotogramas siguientes que no se han tocado', () => {
    const p = fresh();
    P.addFrameAfter(p, 0);
    P.addFrameAfter(p, 1);
    const [a] = ids(p);
    P.movePlayer(p, 0, a, { x: 10, y: 10 });
    expect(p.frames[1].positions[a]).toEqual({ x: 10, y: 10 });
    expect(p.frames[2].positions[a]).toEqual({ x: 10, y: 10 });
  });

  it('la cascada se para en el primer fotograma donde el jugador tiene su propia carrera', () => {
    const p = fresh();
    P.addFrameAfter(p, 0);
    P.addFrameAfter(p, 1);
    const [, b] = ids(p);
    const start = p.frames[1].positions[b];
    P.setMove(p, 1, b, 'move', [start, { x: 100, y: 30 }]);
    P.movePlayer(p, 0, b, { x: 20, y: 20 });
    // el fotograma 1 empieza en la nueva posición y su carrera sale de ahí
    expect(p.frames[1].positions[b]).toEqual({ x: 20, y: 20 });
    expect(P.moveOf(p.frames[1], b)!.points[0]).toEqual({ x: 20, y: 20 });
    // el 2 sigue empezando donde acaba la carrera, que no ha cambiado
    expect(p.frames[2].positions[b]).toEqual({ x: 100, y: 30 });
  });

  it('un fotograma nuevo empieza donde acaba la carrera del anterior', () => {
    const p = fresh();
    const [, b] = ids(p);
    P.setMove(p, 0, b, 'move', [p.frames[0].positions[b], { x: 40, y: 60 }]);
    const k = P.addFrameAfter(p, 0);
    expect(p.frames[k].positions[b]).toEqual({ x: 40, y: 60 });
  });

  it('tras un pase, el balón lo tiene el receptor', () => {
    const p = fresh();
    const [a, b] = ids(p);
    P.setPass(p, 0, a, b);
    expect(P.endState(p, 0).ball.holder).toBe(b);
    P.addFrameAfter(p, 0);
    expect(p.frames[1].ball.holder).toBe(b);
  });

  it('solo el jugador con balón puede pasar o botar', () => {
    const p = fresh();
    const [, b, c] = ids(p);
    P.setPass(p, 0, b, c); // b no tiene el balón
    expect(P.passOf(p.frames[0])).toBeUndefined();
    P.setMove(p, 0, b, 'dribble', [p.frames[0].positions[b], { x: 50, y: 50 }]);
    expect(P.moveOf(p.frames[0], b)!.type).toBe('move');
  });

  it('una trayectoria con más de 600 puntos se aligera', () => {
    const p = fresh();
    const [a] = ids(p);
    const pts = Array.from({ length: 2000 }, (_, i) => ({ x: i / 20, y: 50 }));
    P.setMove(p, 0, a, 'dribble', pts);
    const m = P.moveOf(p.frames[0], a)!;
    expect(m.points.length).toBeLessThanOrEqual(P.LIMITS.points);
    expect(m.points.at(-1)).toEqual({ x: 100, y: 50 }); // se conserva el último (redondeado a 0,1)
  });
});

describe('fotogramas: reordenar, duplicar y borrar', () => {
  /** Tres fotogramas: 1 bota, pasa a 2, y 2 corta. */
  function threeFrames() {
    const p = fresh();
    const [a, b] = ids(p);
    P.setMove(p, 0, a, 'dribble', [p.frames[0].positions[a], { x: 60, y: 60 }]);
    P.addFrameAfter(p, 0);
    P.setPass(p, 1, a, b);
    P.addFrameAfter(p, 1);
    P.setMove(p, 2, b, 'move', [p.frames[2].positions[b], { x: 75, y: 20 }]);
    return { p, a, b };
  }

  it('reordenar vuelve a encadenar: cada fotograma empieza donde acaba el anterior', () => {
    const { p } = threeFrames();
    // el corte del 2 (que ya tiene el balón) pasa al principio: el pase del 1 deja de encajar
    expect(P.moveFrame(p, 2, 0)).toBe(1);
    expectChained(p);
  });

  it('reordenar quita el pase de quien ya no tiene el balón y lo cuenta', () => {
    const { p, b } = threeFrames();
    const c = p.players[2].id;
    P.addFrameAfter(p, 2);
    P.setPass(p, 3, b, c); // fotograma 4: el 2 pasa al 3
    // si ese pase va justo después del bote, el balón aún lo tiene el 1: el pase sobra
    expect(P.moveFrame(p, 3, 1)).toBe(1);
    expect(P.passOf(p.frames[1])).toBeUndefined();
    expectChained(p);
  });

  it('duplicar repite las acciones con ids nuevos, empezando donde acaba el original', () => {
    const { p } = threeFrames();
    const { index } = P.duplicateFrame(p, 2);
    expect(index).toBe(3);
    expect(p.frames).toHaveLength(4);
    const orig = p.frames[2].actions.map((x) => x.id);
    const copy = p.frames[3].actions.map((x) => x.id);
    expect(copy.some((id) => orig.includes(id))).toBe(false);
    expectChained(p);
  });

  it('borrar un fotograma intermedio mantiene la continuidad', () => {
    const { p } = threeFrames();
    P.deleteFrame(p, 1);
    expect(p.frames).toHaveLength(2);
    expectChained(p);
  });

  it('no se puede borrar el único fotograma', () => {
    const p = fresh();
    P.deleteFrame(p, 0);
    expect(p.frames).toHaveLength(1);
  });

  it('no pasa del límite de fotogramas', () => {
    const p = fresh();
    for (let i = 0; i < P.LIMITS.frames + 5; i++) P.addFrameAfter(p, p.frames.length - 1);
    expect(p.frames).toHaveLength(P.LIMITS.frames);
  });
});

describe('animación', () => {
  it('en t=0 están al inicio y en t=1 al final de la carrera', () => {
    const p = fresh();
    const [, b] = ids(p);
    const start = p.frames[0].positions[b];
    P.setMove(p, 0, b, 'move', [start, { x: 30, y: 30 }]);
    const s0 = P.stateAt(p, 0, 0).positions[b];
    const s1 = P.stateAt(p, 0, 1).positions[b];
    expect(s0.x).toBeCloseTo(start.x, 3);
    expect(s1.x).toBeCloseTo(30, 3);
    expect(s1.y).toBeCloseTo(30, 3);
  });
});

describe('jugadores', () => {
  it('quitar al que lleva el balón deja el balón suelto y borra sus acciones', () => {
    const p = fresh();
    const [a, b] = ids(p);
    P.setPass(p, 0, a, b);
    P.removePlayer(p, a);
    expect(p.frames[0].ball.holder).toBeNull();
    expect(p.frames[0].actions).toHaveLength(0);
  });

  it('las etiquetas nuevas rellenan el primer número libre y hay un límite', () => {
    const p = fresh();
    P.removePlayer(p, p.players[1].id); // queda libre el 2
    const id = P.addPlayer(p, 'O');
    expect(P.playerById(p, id)!.label).toBe('2');
    while (p.players.length < P.LIMITS.players) P.addPlayer(p, 'D');
    expect(P.addPlayer(p, 'O')).toBe('');
  });

  it('cambiar de media pista a pista entera y volver deja a los jugadores donde estaban', () => {
    const p = fresh();
    const before = P.clone(p.frames[0].positions);
    P.setCourt(p, 'full');
    P.setCourt(p, 'half');
    for (const [id, pos] of Object.entries(before)) {
      expect(p.frames[0].positions[id].x).toBeCloseTo(pos.x, 1);
      expect(p.frames[0].positions[id].y).toBeCloseTo(pos.y, 1);
    }
  });
});

describe('validar archivos (parsePlay)', () => {
  it('una jugada válida vuelve igual', () => {
    const p = fresh();
    P.setPass(p, 0, p.players[0].id, p.players[1].id);
    p.category = 'ato';
    p.updatedAt = p.createdAt + 1;
    expect(P.parsePlay(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('rechaza formatos desconocidos y archivos demasiado grandes', () => {
    expect(() => P.parsePlay(null)).toThrow();
    expect(() => P.parsePlay({ ...fresh(), version: 2 })).toThrow();
    expect(() => P.parsePlay({ ...fresh(), court: 'luna' })).toThrow();
    const big = fresh();
    big.frames = Array.from({ length: P.LIMITS.frames + 1 }, () => P.clone(big.frames[0]));
    expect(() => P.parsePlay(big)).toThrow(/fotogramas/);
  });

  it('rechaza ids peligrosos', () => {
    expect(() => P.parsePlay({ ...fresh(), id: '__proto__' })).toThrow();
    expect(P.isSafeId('abc_12-3')).toBe(true);
    expect(P.isSafeId('constructor')).toBe(false);
    expect(P.isSafeId('a/b')).toBe(false);
    expect(P.isSafeId('x'.repeat(65))).toBe(false);
  });

  it('repara lo que puede: textos largos, duraciones, categorías y acciones raras', () => {
    const p = fresh() as unknown as Record<string, any>;
    p.name = 'n'.repeat(200);
    p.category = 'inventada';
    p.frames[0].note = 'x'.repeat(500);
    p.frames[0].duration = 99;
    p.frames[0].actions = [{ type: 'teletransporte' }, 'basura', { type: 'pass', from: p.players[0].id, to: p.players[1].id }];
    const out = P.parsePlay(p);
    expect(out.name).toHaveLength(80);
    expect(out.category).toBeUndefined();
    expect(out.frames[0].note).toHaveLength(120);
    expect(out.frames[0].duration).toBe(4);
    expect(out.frames[0].actions).toHaveLength(1);
  });

  it('una fecha en el futuro no gana la sincronización', () => {
    const now = Date.now();
    const p = { ...fresh(), updatedAt: now + 365 * 864e5 };
    expect(P.parsePlay(p).updatedAt).toBeLessThanOrEqual(Date.now());
    expect(P.safeTime(now + 10 * 60e3, now)).toBe(now + 10 * 60e3); // 10 min de desfase: se acepta
    expect(P.safeTime(now + 2 * 3600e3, now)).toBe(0);
    expect(P.safeTime('ayer', now)).toBe(0);
  });
});
