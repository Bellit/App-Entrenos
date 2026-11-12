import { describe, expect, it } from 'vitest';
import * as S from './session';
import { newExercise } from './exercise';
import { adoptShared, parseShared, sessionPayload } from './share';
import { newSquad, parseSquad, SQUAD_COLORS, sortSquads, squadLabel } from './squad';

describe('equipos', () => {
  it('cada equipo nuevo coge un color que no esté usado', () => {
    const a = newSquad('Cadete A');
    const b = newSquad('Infantil', '', [a.color]);
    expect(a.color).toBe(SQUAD_COLORS[0]);
    expect(b.color).not.toBe(a.color);
  });

  it('nombre con club y orden por club', () => {
    expect(squadLabel({ name: 'Cadete A', club: 'CB Sant Josep' })).toBe('Cadete A · CB Sant Josep');
    expect(squadLabel({ name: 'Senior', club: '' })).toBe('Senior');
    const list = [newSquad('Senior'), newSquad('Junior', 'Club B'), newSquad('Cadete', 'Club A')];
    expect(sortSquads(list).map((x) => x.name)).toEqual(['Cadete', 'Junior', 'Senior']);
  });

  it('se lee igual que se guarda, y repara lo roto', () => {
    const t = { ...newSquad('Cadete A', 'CB'), players: [{ id: 'p1', name: 'Marta', number: '7' }] };
    expect(parseSquad(JSON.parse(JSON.stringify(t)))).toEqual(t);
    const roto = parseSquad({ id: 'x1', name: '', color: 'rojo', players: [{ name: '' }, { name: 'Pau', number: 12345 }] })!;
    expect(roto.name).toBe('Equipo');
    expect(roto.color).toBe(SQUAD_COLORS[0]);
    expect(roto.players).toEqual([{ id: roto.players[0].id, name: 'Pau', number: '' }]);
    expect(parseSquad({ name: 'sin id' })).toBeNull();
  });
});

describe('sesiones por equipo', () => {
  const a = 'equipoA';
  const b = 'equipoB';
  const list = [
    S.newSession('de A', '2026-11-17', a),
    S.newSession('de B', '2026-11-18', b),
    S.newSession('sin equipo', '2026-11-19'),
    S.toTemplate(S.newSession('plantilla de A', '', a)),
    S.toTemplate(S.newSession('plantilla general')),
  ];
  const titles = (f: string) => S.filterByTeam(list, f).map((s) => s.title);

  it('todas, las de un equipo (y las plantillas generales) o las que no tienen equipo', () => {
    expect(titles('')).toHaveLength(5);
    expect(titles(a)).toEqual(['de A', 'plantilla de A', 'plantilla general']);
    expect(titles('none')).toEqual(['sin equipo', 'plantilla general']);
  });

  it('una sesión creada desde la plantilla de un equipo queda en ese equipo', () => {
    expect(S.fromTemplate(list[3], '2026-11-24').teamId).toBe(a);
  });

  it('las sesiones de antes se leen sin equipo', () => {
    const old = JSON.parse(JSON.stringify(S.newSession('vieja')));
    delete old.teamId;
    expect(S.parseSession(old)!.teamId).toBe('');
  });

  it('una sesión compartida llega sin equipo (el equipo es de quien la compartió)', () => {
    const e = newExercise('A');
    const s = S.addExerciseBlock(S.newSession('de A', '', a), e);
    const p = JSON.parse(JSON.stringify(sessionPayload(s, new Map([[e.id, e]]))));
    expect(adoptShared(parseShared(p.kind, p.data)!).session!.teamId).toBe('');
  });
});
