import { describe, expect, it } from 'vitest';
import * as P from './play';
import type { Play } from './types';

/** 5 atacantes; el 1 lleva el balón inicial. */
function setup() {
  const play = P.newPlay('Balones');
  const [a, b, c, d] = play.players.map((p) => p.id);
  const ball0 = play.frames[0].balls[0].id;
  return { play, a, b, c, d, ball0 };
}
const holderOf = (play: Play, k: number, id: string) => P.ballById(play.frames[k], id)?.holder ?? null;

describe('varios balones', () => {
  it('una jugada nueva empieza con un balón en manos del 1', () => {
    const { play, a } = setup();
    expect(play.frames[0].balls).toHaveLength(1);
    expect(play.frames[0].balls[0].holder).toBe(a);
  });

  it('un balón nuevo se da al jugador indicado si no lleva ninguno', () => {
    const { play, a, b } = setup();
    const id = P.addBall(play, 0, b, { x: 0, y: 0 });
    expect(holderOf(play, 0, id)).toBe(b);
    // el 1 ya lleva uno: el nuevo se queda suelto donde se indique
    const id2 = P.addBall(play, 0, a, { x: 10, y: 20 });
    expect(holderOf(play, 0, id2)).toBeNull();
    expect(P.ballById(play.frames[0], id2)!.pos).toEqual({ x: 10, y: 20 });
  });

  it('dos jugadores con balón pueden pasar a la vez, y cada balón llega a su receptor', () => {
    const { play, a, b, c, d } = setup();
    const extra = P.addBall(play, 0, b, { x: 0, y: 0 });
    P.setPass(play, 0, a, c);
    P.setPass(play, 0, b, d);
    expect(play.frames[0].actions.filter((x) => x.type === 'pass')).toHaveLength(2);
    const end = P.endState(play, 0);
    expect(end.balls.find((x) => x.id === play.frames[0].balls[0].id)?.holder).toBe(c);
    expect(end.balls.find((x) => x.id === extra)?.holder).toBe(d);
  });

  it('no se puede pasar a quien ya tiene balón, salvo que lo suelte en el mismo fotograma', () => {
    const { play, a, b, c } = setup();
    P.addBall(play, 0, b, { x: 0, y: 0 });
    P.setPass(play, 0, a, b);
    expect(play.frames[0].actions.some((x) => x.type === 'pass' && x.from === a)).toBe(false);
    // si el 2 pasa a su vez al 3, ya puede recibir el del 1
    P.setPass(play, 0, b, c);
    P.setPass(play, 0, a, b);
    expect(play.frames[0].actions.filter((x) => x.type === 'pass')).toHaveLength(2);
  });

  it('el balón que se pasa sigue en los fotogramas siguientes, y la animación lo lleva por el aire', () => {
    const { play, a, b, c, ball0 } = setup();
    const extra = P.addBall(play, 0, b, { x: 0, y: 0 });
    P.addFrameAfter(play, 0);
    P.setPass(play, 0, b, c);
    expect(holderOf(play, 1, extra)).toBe(c);
    expect(holderOf(play, 1, ball0)).toBe(a);
    // a mitad del vuelo, el balón extra está entre el 2 y el 3 (y algo más grande, en el aire)
    const mid = P.stateAt(play, 0, 0.8).balls.find((x) => x.id === extra)!;
    expect(mid.scale).toBeGreaterThan(1);
  });

  it('quitar un balón borra también sus pases', () => {
    const { play, b, c } = setup();
    const extra = P.addBall(play, 0, b, { x: 0, y: 0 });
    P.setPass(play, 0, b, c);
    P.removeBall(play, extra);
    expect(P.ballById(play.frames[0], extra)).toBeUndefined();
    expect(play.frames[0].actions.some((x) => x.type === 'pass')).toBe(false);
  });

  it('dar un balón suelto a un jugador que ya tiene otro lo deja suelto', () => {
    const { play, a } = setup();
    const extra = P.addBall(play, 0, null, { x: 50, y: 50 });
    P.setBall(play, 0, extra, { holder: a, pos: play.frames[0].positions[a] });
    expect(holderOf(play, 0, extra)).toBeNull();
  });

  it('cada jugador con balón puede tirar', () => {
    const { play, a, b } = setup();
    P.addBall(play, 0, b, { x: 0, y: 0 });
    P.setShot(play, 0, a);
    P.setShot(play, 0, b);
    expect(play.frames[0].actions.filter((x) => x.type === 'shot')).toHaveLength(2);
  });
});

describe('datos antiguos', () => {
  it('una jugada de ATO (un solo «ball») se lee como un balón', () => {
    const { play, a } = setup();
    const raw = JSON.parse(JSON.stringify(play));
    for (const f of raw.frames) {
      f.ball = { holder: f.balls[0].holder, pos: f.balls[0].pos };
      delete f.balls;
    }
    const p = P.parsePlay(raw);
    expect(p.frames[0].balls).toHaveLength(1);
    expect(p.frames[0].balls[0].holder).toBe(a);
  });

  it('los «balones extra» antiguos (jugadores de tipo B) pasan a ser balones de verdad', () => {
    const { play } = setup();
    const raw = JSON.parse(JSON.stringify(play));
    raw.players.push({ id: 'viejo', team: 'B', label: '' });
    raw.frames[0].positions.viejo = { x: 30, y: 40 };
    const p = P.parsePlay(raw);
    expect(p.players.some((x) => x.id === 'viejo')).toBe(false);
    expect(P.ballById(p.frames[0], 'viejo')).toMatchObject({ holder: null, pos: { x: 30, y: 40 } });
  });

  it('dos balones del mismo jugador en un archivo: el segundo queda suelto', () => {
    const { play, a } = setup();
    const raw = JSON.parse(JSON.stringify(play));
    raw.frames[0].balls.push({ id: 'otro', holder: a, pos: { x: 1, y: 1 } });
    const p = P.parsePlay(raw);
    expect(P.ballById(p.frames[0], 'otro')!.holder).toBeNull();
  });
});
