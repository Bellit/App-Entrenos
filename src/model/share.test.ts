import { describe, expect, it } from 'vitest';
import { newExercise } from './exercise';
import * as S from './session';
import { adoptShared, exercisePayload, isEmail, isShareId, newShareId, parseShared, sessionPayload } from './share';

const roundTrip = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('compartir', () => {
  it('un ejercicio compartido se recibe y se guarda como copia nueva', () => {
    const e = newExercise('Rueda de tiro');
    const p = roundTrip(exercisePayload(e));
    const shared = parseShared(p.kind, p.data)!;
    expect(shared.kind).toBe('exercise');
    const { exercises } = adoptShared(shared);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].title).toBe('Rueda de tiro');
    expect(exercises[0].id).not.toBe(e.id);
  });

  it('una sesión lleva sus ejercicios, y al guardarla los bloques apuntan a las copias nuevas', () => {
    const a = newExercise('A');
    const b = newExercise('B');
    let s = S.newSession('Martes');
    s = S.addExerciseBlock(s, a);
    s = S.addTextBlock(s, 'Agua');
    s = S.addExerciseBlock(s, b);
    s = S.addExerciseBlock(s, a); // el mismo ejercicio dos veces
    const p = roundTrip(sessionPayload(s, new Map([[a.id, a], [b.id, b]])));
    expect(p.data.exercises).toHaveLength(2);
    const got = adoptShared(parseShared(p.kind, p.data)!);
    expect(got.exercises).toHaveLength(2);
    const ids = new Set(got.exercises.map((e) => e.id));
    const exBlocks = got.session!.blocks.filter((x) => x.kind === 'exercise');
    expect(exBlocks.every((x) => x.kind === 'exercise' && ids.has(x.exerciseId))).toBe(true);
    expect(got.session!.id).not.toBe(s.id);
    // los dos bloques del mismo ejercicio apuntan a la misma copia
    expect(exBlocks[0].kind === 'exercise' && exBlocks[2].kind === 'exercise' && exBlocks[0].exerciseId === exBlocks[2].exerciseId).toBe(true);
  });

  it('si un ejercicio no venía, se rehace con la copia que guarda el bloque', () => {
    const a = newExercise('Borrado');
    const s = S.addExerciseBlock(S.newSession(), a);
    const p = roundTrip(sessionPayload(s, new Map()));
    const got = adoptShared(parseShared('session', { ...p.data, exercises: [] })!);
    expect(got.exercises).toHaveLength(1);
    expect(got.exercises[0].title).toBe('Borrado');
  });

  it('rechaza lo que no es un ejercicio ni una sesión', () => {
    expect(parseShared('exercise', { exercise: { hola: 1 } })).toBeNull();
    expect(parseShared('otra-cosa', {})).toBeNull();
    expect(parseShared('session', null)).toBeNull();
  });

  it('códigos de enlace y correos', () => {
    const id = newShareId();
    expect(id).toHaveLength(12);
    expect(isShareId(id)).toBe(true);
    expect(isShareId('../x')).toBe(false);
    expect(newShareId()).not.toBe(id);
    expect(isEmail('entrenador@club.es')).toBe(true);
    expect(isEmail('no es un correo')).toBe(false);
  });
});
