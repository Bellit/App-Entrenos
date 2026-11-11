import { describe, expect, it } from 'vitest';
import { PLAYER_R } from '../../model/court';
import * as P from '../../model/play';
import type { Play, Pt } from '../../model/types';
import { dragTo, type Effect, type Hit, MOUSE_REACH, pressAt, type Reach, releaseAt, TOUCH_REACH } from './gestures';

/** 5 atacantes, el 1 con balón; devuelve también sus posiciones. */
function setup() {
  const play = P.newPlay('Gestos');
  const [a, b, c] = play.players.map((p) => p.id);
  const pos = (id: string) => play.frames[0].positions[id];
  return { play, a, b, c, pos };
}
const near = (p: Pt, dx = 0, dy = 0): Pt => ({ x: p.x + dx, y: p.y + dy });
const onPlayer = (id: string): Hit => ({ kind: 'player', id });
const nothing: Hit = { kind: null, id: '' };

/** Aplica el cambio con historial de un efecto sobre una copia, como haría el almacén. */
function applied(play: Play, fx: Effect) {
  const copy = P.clone(play);
  fx.edit?.(copy);
  return copy;
}

/** Simula un arrastre completo: pulsar, pasar por `path` y soltar en el último punto. */
function gesture(play: Play, tool: Parameters<typeof pressAt>[2], hit: Hit, from: Pt, path: Pt[]) {
  const down = pressAt(play, 0, tool, hit, from);
  if (!down.drag) return { down, up: down };
  for (const p of path) dragTo(play, 0, down.drag, p);
  return { down, up: releaseAt(play, 0, down.drag, path[path.length - 1]) };
}

describe('Seleccionar', () => {
  it('pulsar en el centro del jugador lo selecciona y empieza a moverlo', () => {
    const { play, b, pos } = setup();
    const fx = pressAt(play, 0, 'select', onPlayer(b), pos(b));
    expect(fx.select).toEqual({ kind: 'player', id: b });
    expect(fx.drag?.mode).toBe('player');
  });

  it('arrastrar desde el anillo dibuja su carrera', () => {
    const { play, b, pos } = setup();
    const { up } = gesture(play, 'select', onPlayer(b), near(pos(b), PLAYER_R + 2), [near(pos(b), 10), near(pos(b), 20, 5)]);
    expect(P.moveOf(applied(play, up).frames[0], b)?.type).toBe('move');
  });

  it('desde el anillo del jugador con balón es bote, y soltar sobre un compañero es pase', () => {
    const { play, a, b, pos } = setup();
    const ring = near(pos(a), PLAYER_R + 2);
    const bote = gesture(play, 'select', onPlayer(a), ring, [near(pos(a), 10), near(pos(a), 20)]);
    expect(P.moveOf(applied(play, bote.up).frames[0], a)?.type).toBe('dribble');
    const pase = gesture(play, 'select', onPlayer(a), ring, [near(pos(a), 5), pos(b)]);
    expect(P.passOf(applied(play, pase.up).frames[0])).toMatchObject({ from: a, to: b });
  });

  it('un clic en el anillo solo selecciona: ni dibuja ni avisa', () => {
    const { play, b, pos } = setup();
    const { down, up } = gesture(play, 'select', onPlayer(b), near(pos(b), PLAYER_R + 2), [near(pos(b), PLAYER_R + 2.5)]);
    expect(down.select).toEqual({ kind: 'player', id: b });
    expect(up.edit).toBeUndefined();
    expect(up.notify).toBeUndefined();
  });

  it('pulsar en vacío quita la selección', () => {
    const { play } = setup();
    expect(pressAt(play, 0, 'select', nothing, { x: 140, y: 130 }).select).toBeNull();
  });

  it('arrastrar el balón hasta un jugador se lo da', () => {
    const { play, c, pos } = setup();
    const ballPos = P.frameScene(play, 0).ball!.pos;
    const down = pressAt(play, 0, 'select', { kind: 'ball', id: '' }, ballPos, ballPos);
    expect(down.select).toBeNull();
    // se pulsó justo sobre el balón, así que se suelta donde queda el puntero: encima del 3
    const up = releaseAt(play, 0, down.drag!, pos(c));
    expect(applied(play, up).frames[0].ball.holder).toBe(c);
  });
});

describe('herramientas', () => {
  it('Correr desde un jugador dibuja su desplazamiento; un trazo muy corto avisa', () => {
    const { play, c, pos } = setup();
    const ok = gesture(play, 'move', nothing, pos(c), [near(pos(c), 8), near(pos(c), 16, 4)]);
    expect(P.moveOf(applied(play, ok.up).frames[0], c)?.type).toBe('move');
    const corto = gesture(play, 'move', nothing, pos(c), [near(pos(c), 1)]);
    expect(corto.up.notify).toBeTruthy();
  });

  it('Botar, Pasar y Tirar solo los hace quien tiene el balón', () => {
    const { play, b, pos } = setup();
    for (const tool of ['dribble', 'pass', 'shot'] as const) expect(pressAt(play, 0, tool, nothing, pos(b)).notify).toMatch(/balón/);
  });

  it('Tirar con el jugador con balón crea el tiro al momento', () => {
    const { play, a, pos } = setup();
    const fx = pressAt(play, 0, 'shot', nothing, pos(a));
    expect(fx.drag).toBeUndefined();
    expect(P.shotOf(applied(play, fx).frames[0])?.playerId).toBe(a);
  });

  it('Pasar: soltar en un compañero crea el pase; en vacío o a un rival, avisa', () => {
    const { play, a, b, pos } = setup();
    expect(P.passOf(applied(play, gesture(play, 'pass', nothing, pos(a), [pos(b)]).up).frames[0])?.to).toBe(b);
    expect(gesture(play, 'pass', nothing, pos(a), [{ x: 140, y: 130 }]).up.notify).toMatch(/compañero/);
    const x = P.addPlayer(play, 'D', { x: 100, y: 100 });
    expect(gesture(play, 'pass', nothing, pos(a), [{ x: 100, y: 100 }]).up.notify).toMatch(/mismo equipo/);
    expect(x).toBeTruthy();
  });

  it('pulsar lejos de cualquier jugador muestra cómo se usa la herramienta', () => {
    const { play } = setup();
    expect(pressAt(play, 0, 'screen', nothing, { x: 140, y: 130 }).notify).toMatch(/bloqueo/);
  });
});

describe('con el dedo (márgenes táctiles)', () => {
  it('cerca del borde del jugador, el ratón dibuja y el dedo mueve', () => {
    const { play, b, pos } = setup();
    const p = near(pos(b), PLAYER_R + 1);
    expect(pressAt(play, 0, 'select', onPlayer(b), p, undefined, MOUSE_REACH).drag?.mode).toBe('draw');
    expect(pressAt(play, 0, 'select', onPlayer(b), p, undefined, TOUCH_REACH).drag?.mode).toBe('player');
  });

  it('un pase que se suelta un poco lejos del compañero vale con el dedo, no con el ratón', () => {
    const { play, a, b, pos } = setup();
    const off = near(pos(b), PLAYER_R + 5);
    const pase = (reach: Reach) => {
      const down = pressAt(play, 0, 'pass', nothing, pos(a), undefined, reach);
      return releaseAt(play, 0, down.drag!, off, reach);
    };
    expect(pase(MOUSE_REACH).notify).toMatch(/compañero/);
    expect(P.passOf(applied(play, pase(TOUCH_REACH)).frames[0])?.to).toBe(b);
  });

  it('un temblor de 5 unidades es una carrera con ratón, pero no con el dedo', () => {
    const { play, c, pos } = setup();
    const trazo = (reach: Reach) => {
      const down = pressAt(play, 0, 'move', nothing, pos(c), undefined, reach);
      const end = near(pos(c), 5);
      dragTo(play, 0, down.drag!, end, reach);
      return releaseAt(play, 0, down.drag!, end, reach);
    };
    expect(trazo(MOUSE_REACH).edit).toBeTruthy();
    expect(trazo(TOUCH_REACH).edit).toBeUndefined();
  });
});
