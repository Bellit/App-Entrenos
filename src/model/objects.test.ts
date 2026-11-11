import { describe, expect, it } from 'vitest';
import * as P from './play';
import { holdsBall } from './types';

describe('objetos de pista (cono y entrenador)', () => {
  it('se añaden con posición en todos los fotogramas desde el que se indique', () => {
    const play = P.newPlay();
    P.addFrameAfter(play, 0);
    const cone = P.addPlayer(play, 'C', undefined, 0);
    const coach = P.addPlayer(play, 'K', undefined, 1);
    expect(play.frames.every((f) => f.positions[cone])).toBe(true);
    expect(play.frames[0].positions[coach]).toBeUndefined();
    expect(play.frames[1].positions[coach]).toBeDefined();
  });

  it('los conos no llevan etiqueta; el entrenador es «E»', () => {
    const play = P.newPlay();
    const label = (id: string) => P.playerById(play, id)!.label;
    expect(label(P.addPlayer(play, 'C'))).toBe('');
    expect(label(P.addPlayer(play, 'K'))).toBe('E');
  });

  it('no cuentan como atacantes sin defensor', () => {
    const play = P.newPlay();
    const before = P.unmarked(play).length;
    P.addPlayer(play, 'C');
    expect(P.unmarked(play).length).toBe(before);
  });

  it('solo atacantes y defensores pueden tener el balón', () => {
    expect(['O', 'D'].every((t) => holdsBall(t as 'O' | 'D'))).toBe(true);
    expect(['C', 'K'].some((t) => holdsBall(t as 'C' | 'K'))).toBe(false);
  });

  it('sobreviven a guardar y leer, y un tipo desconocido se vuelve atacante', () => {
    const play = P.newPlay();
    const cone = P.addPlayer(play, 'C');
    const raw = JSON.parse(JSON.stringify(play));
    expect(P.playerById(P.parsePlay(raw), cone)!.team).toBe('C');
    raw.players.find((p: { id: string }) => p.id === cone).team = 'Z';
    expect(P.playerById(P.parsePlay(raw), cone)!.team).toBe('O');
  });

  it('las etiquetas de fila como «2(3)» caben', () => {
    const play = P.newPlay();
    const raw = JSON.parse(JSON.stringify(play));
    raw.players[0].label = '2(3)';
    expect(P.parsePlay(raw).players[0].label).toBe('2(3)');
  });

  it('se pueden quitar como cualquier jugador', () => {
    const play = P.newPlay();
    const cone = P.addPlayer(play, 'C');
    P.removePlayer(play, cone);
    expect(P.playerById(play, cone)).toBeUndefined();
    expect(play.frames[0].positions[cone]).toBeUndefined();
  });
});
