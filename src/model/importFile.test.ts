import { describe, expect, it } from 'vitest';
import { newExercise } from './exercise';
import { ATO_BACKUP_FORMAT, backupData, backupFileName, exercisesFromData } from './importFile';
import * as P from './play';
import { addExerciseBlock, newSession } from './session';

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

  it('la copia de seguridad de la app se recupera entera, con identificadores nuevos', () => {
    const a = newExercise('Uno');
    const b = newExercise('Dos');
    const data = JSON.parse(JSON.stringify(backupData([a, b])));
    data.exercises.push({ roto: true });
    const r = exercisesFromData(data);
    expect(r.exercises.map((e) => e.title)).toEqual(['Uno', 'Dos']);
    expect(r.skipped).toBe(1);
    expect(r.exercises.some((e) => e.id === a.id || e.id === b.id)).toBe(false);
  });

  it('la copia trae también las sesiones, apuntando a los ejercicios importados', () => {
    const e = newExercise('Rueda');
    const s = addExerciseBlock(newSession('Martes'), e);
    const r = exercisesFromData(JSON.parse(JSON.stringify(backupData([e], [s]))));
    expect(r.sessions).toHaveLength(1);
    const b = r.sessions[0].blocks[0];
    expect(b.kind === 'exercise' && b.exerciseId).toBe(r.exercises[0].id);
    expect(r.sessions[0].id).not.toBe(s.id);
  });

  it('el archivo de copia lleva la fecha en el nombre', () => {
    expect(backupFileName(new Date('2026-11-11T10:00:00Z'))).toBe('run-it-copia-2026-11-11.json');
  });

  it('rechaza lo que no es una jugada ni un ejercicio', () => {
    expect(() => exercisesFromData(null)).toThrow();
    expect(() => exercisesFromData('hola')).toThrow();
    expect(() => exercisesFromData({ hola: 1 })).toThrow();
  });
});
