import { describe, expect, it } from 'vitest';
import { newExercise } from './exercise';
import { ATO_BACKUP_FORMAT, exercisesFromData } from './importFile';
import * as P from './play';

const atoPlay = (name = 'Mi jugada') => JSON.parse(JSON.stringify(P.newPlay(name)));

describe('importar archivos como ejercicios', () => {
  it('una jugada suelta de ATO pasa a ser un ejercicio con su nombre como título', () => {
    const play = atoPlay('Bloqueo directo');
    const { exercises, skipped } = exercisesFromData(play);
    expect(skipped).toBe(0);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].title).toBe('Bloqueo directo');
    expect(exercises[0].play.frames.length).toBe(play.frames.length);
    expect(exercises[0].play.id).not.toBe(play.id);
  });

  it('una copia de ATO trae varios ejercicios y se salta las jugadas dañadas', () => {
    const data = { format: ATO_BACKUP_FORMAT, version: 1, plays: [atoPlay('A'), { basura: true }, atoPlay('B')] };
    const r = exercisesFromData(data);
    expect(r.exercises.map((e) => e.title)).toEqual(['A', 'B']);
    expect(r.skipped).toBe(1);
  });

  it('una copia sin jugadas válidas da error', () => {
    expect(() => exercisesFromData({ format: ATO_BACKUP_FORMAT, plays: [{}] })).toThrow();
  });

  it('un ejercicio de esta app conserva sus datos pero con identificadores nuevos', () => {
    const e = newExercise('Rueda de tiro');
    e.tags = ['tiro'];
    e.minutes = 12;
    const r = exercisesFromData(JSON.parse(JSON.stringify(e)));
    expect(r.exercises[0].title).toBe('Rueda de tiro');
    expect(r.exercises[0].tags).toEqual(['tiro']);
    expect(r.exercises[0].minutes).toBe(12);
    expect(r.exercises[0].id).not.toBe(e.id);
  });

  it('rechaza lo que no es una jugada ni un ejercicio', () => {
    expect(() => exercisesFromData(null)).toThrow();
    expect(() => exercisesFromData('hola')).toThrow();
    expect(() => exercisesFromData({ hola: 1 })).toThrow();
  });
});
