import { describe, expect, it } from 'vitest';
import { buildPrompt, exerciseFromAi, extractJson, SPOTS } from './aiExercise';
import { parseExercise } from './exercise';
import { endState } from './query';

const json = (o: unknown) => JSON.stringify(o);
const base = {
  titulo: 'Pasar y cortar',
  categoria: 'Tiro',
  minutos: 12,
  etiquetas: ['Pase y corte'],
  explicacion: 'Objetivo: cortar.',
  jugadores: [
    { id: '1', tipo: 'ataque', en: 'arriba' },
    { id: '2', tipo: 'ataque', en: 'Ala derecha' },
    { id: 'X1', tipo: 'defensa', marca: '1' },
  ],
  balones: ['1'],
  pasos: [
    { nota: '1 pasa a 2 y corta', acciones: [{ tipo: 'pase', de: '1', a: '2' }, { tipo: 'correr', jugador: '1', a: 'canasta', por: ['codo-der'] }] },
    { nota: '2 devuelve', acciones: [{ tipo: 'pase', de: '2', a: '1' }] },
  ],
};

describe('extractJson', () => {
  it('saca el bloque aunque venga entre texto y ```json', () => {
    expect(extractJson('Aquí lo tienes:\n```json\n{"a": 1}\n```\n¡Suerte!')).toEqual({ a: 1 });
  });
  it('corrige comas finales y comillas tipográficas', () => {
    expect(extractJson('{“a”: [1, 2,],}')).toEqual({ a: [1, 2] });
  });
  it('explica qué falla si no hay JSON', () => {
    expect(() => extractJson('no sé hacerlo')).toThrow(/«\{»/);
    expect(() => extractJson('{"a": ')).toThrow();
  });
});

describe('exerciseFromAi', () => {
  it('crea un ejercicio válido con su ficha', () => {
    const { exercise: e, warnings } = exerciseFromAi(json(base));
    expect(warnings).toEqual([]);
    expect(e.title).toBe('Pasar y cortar');
    expect(e.category).toBe('tiro'); // por el nombre, sin mayúsculas
    expect(e.minutes).toBe(12);
    expect(e.tags).toEqual(['ia', 'pase y corte']);
    // pasa la misma validación que un archivo importado
    expect(parseExercise(JSON.parse(JSON.stringify(e)))).not.toBeNull();
  });

  it('coloca por nombre de posición (con tildes y palabras enteras) y al defensor junto a su atacante', () => {
    const { exercise: e } = exerciseFromAi(json(base));
    const [p1, p2, x1] = e.play.players;
    const f0 = e.play.frames[0];
    expect(f0.positions[p1.id]).toEqual({ x: SPOTS.arriba.x, y: SPOTS.arriba.y });
    expect(f0.positions[p2.id]).toEqual({ x: SPOTS['ala-der'].x, y: SPOTS['ala-der'].y });
    expect(x1.team).toBe('D');
    expect(f0.positions[x1.id].y).toBeLessThan(SPOTS.arriba.y); // entre el atacante y la canasta
    expect(f0.balls[0].holder).toBe(p1.id);
  });

  it('cada paso es un fotograma encadenado y el balón viaja con los pases', () => {
    const { exercise: e } = exerciseFromAi(json(base));
    const [p1, p2] = e.play.players;
    expect(e.play.frames).toHaveLength(2);
    expect(e.play.frames[0].note).toBe('1 pasa a 2 y corta');
    expect(e.play.frames[1].balls[0].holder).toBe(p2.id);
    expect(e.play.frames[1].positions[p1.id]).toEqual({ x: SPOTS.canasta.x, y: SPOTS.canasta.y });
    expect(endState(e.play, 1).balls[0].holder).toBe(p1.id);
  });

  it('reparte en dos fotogramas lo que no puede ir a la vez (recibe y tira)', () => {
    const one = { ...base, pasos: [{ nota: '1 pasa a 2 y 2 tira', acciones: [{ tipo: 'pase', de: '1', a: '2' }, { tipo: 'tiro', jugador: '2' }] }] };
    const { exercise: e, warnings } = exerciseFromAi(json(one));
    expect(warnings).toEqual([]);
    expect(e.play.frames).toHaveLength(2);
    expect(e.play.frames[1].actions[0].type).toBe('shot');
  });

  it('pone en fila a los que comparten posición', () => {
    const fila = { ...base, jugadores: [{ id: '1', en: 'arriba' }, { id: '2', en: 'arriba' }, { id: '3', en: 'arriba' }], balones: [], pasos: [] };
    const { exercise: e } = exerciseFromAi(json(fila));
    const ys = e.play.players.map((p) => e.play.frames[0].positions[p.id].y);
    expect(new Set(ys).size).toBe(3);
    expect(ys[1]).toBeGreaterThan(ys[0]); // detrás = más lejos de la canasta
  });

  it('acepta coordenadas en metros', () => {
    const m = { ...base, jugadores: [{ id: '1', en: [7.5, 9] }], balones: [], pasos: [] };
    const { exercise: e } = exerciseFromAi(json(m));
    expect(e.play.frames[0].positions[e.play.players[0].id]).toEqual({ x: 75, y: 90 });
  });

  it('avisa de lo que no puede dibujar en lugar de fallar', () => {
    const bad = {
      ...base,
      pasos: [{ nota: '', acciones: [{ tipo: 'pase', de: '2', a: '1' }, { tipo: 'volar', jugador: '1' }, { tipo: 'correr', jugador: '1', a: 'luna' }] }],
    };
    const { warnings } = exerciseFromAi(json(bad));
    expect(warnings.join(' ')).toMatch(/sin tener el balón/);
    expect(warnings.join(' ')).toMatch(/volar/);
    expect(warnings.join(' ')).toMatch(/luna/);
  });

  it('bloqueo sobre un jugador: se coloca pegado a él', () => {
    const b = {
      ...base,
      jugadores: [...base.jugadores, { id: '5', tipo: 'ataque', en: 'poste-bajo-izq' }],
      pasos: [{ nota: '5 bloquea a X1', acciones: [{ tipo: 'bloqueo', jugador: '5', sobre: 'X1' }] }],
    };
    const { exercise: e, warnings } = exerciseFromAi(json(b));
    expect(warnings).toEqual([]);
    const x1 = e.play.players[2];
    const move = e.play.frames[0].actions[0];
    expect(move.type).toBe('screen');
    const end = move.type === 'screen' ? move.points.at(-1)! : { x: 0, y: 0 };
    const at = e.play.frames[0].positions[x1.id];
    expect(Math.hypot(end.x - at.x, end.y - at.y)).toBeCloseTo(7, 0);
  });

  it('rechaza lo que no es un ejercicio, con un mensaje claro', () => {
    expect(() => exerciseFromAi('{"titulo": "x"}')).toThrow(/jugadores/);
  });
});

describe('buildPrompt', () => {
  it('incluye las posiciones, el ejemplo y la descripción', () => {
    const p = buildPrompt('2c1 desde el ala');
    expect(p).toContain('codo-izq');
    expect(p).toContain('"tipo": "pase"');
    expect(p.trim().endsWith('2c1 desde el ala')).toBe(true);
  });
  it('el ejemplo del prompt se convierte sin avisos', () => {
    const p = buildPrompt('');
    const ex = p.slice(p.indexOf('```json') + 7, p.lastIndexOf('```'));
    const { warnings, exercise } = exerciseFromAi(ex);
    expect(warnings).toEqual([]);
    expect(exercise.play.frames).toHaveLength(3);
  });
});
