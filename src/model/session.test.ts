import { describe, expect, it } from 'vitest';
import { newExercise } from './exercise';
import * as S from './session';

const ex = (title: string, minutes = 10) => ({ ...newExercise(title), minutes });

describe('sesión: bloques', () => {
  it('una sesión nueva está vacía y sin hora', () => {
    const s = S.newSession('Martes', '2026-11-17');
    expect(s.blocks).toEqual([]);
    expect(S.totalMinutes(s)).toBe(0);
    expect(S.endTime(s)).toBe('');
  });

  it('añadir un ejercicio toma sus minutos y guarda una copia', () => {
    const e = ex('Rueda de tiro', 12);
    const s = S.addExerciseBlock(S.newSession(), e);
    const b = s.blocks[0];
    expect(b.kind).toBe('exercise');
    expect(b.minutes).toBe(12);
    if (b.kind === 'exercise') {
      expect(b.exerciseId).toBe(e.id);
      expect(b.snapshot.title).toBe('Rueda de tiro');
      expect(b.snapshot).not.toBe(e); // es una copia, no el mismo objeto
    }
  });

  it('no modifica la sesión original (devuelve una nueva)', () => {
    const s0 = S.newSession();
    const s1 = S.addTextBlock(s0, 'Charla');
    expect(s0.blocks).toHaveLength(0);
    expect(s1.blocks).toHaveLength(1);
  });

  it('se puede insertar en una posición y mover bloques', () => {
    let s = S.newSession();
    s = S.addTextBlock(s, 'A');
    s = S.addTextBlock(s, 'C');
    s = S.addTextBlock(s, 'B', 5, 1);
    const titles = (x: S.Session) => x.blocks.map((b) => (b.kind === 'text' ? b.title : ''));
    expect(titles(s)).toEqual(['A', 'B', 'C']);
    expect(titles(S.moveBlock(s, 0, 2))).toEqual(['B', 'C', 'A']);
    expect(S.moveBlock(s, 0, 9)).toBe(s); // fuera de rango: sin cambios
  });

  it('los minutos se quedan entre 1 y 180', () => {
    let s = S.addTextBlock(S.newSession(), 'Agua');
    const id = s.blocks[0].id;
    s = S.updateBlock(s, id, { minutes: 0 });
    expect(s.blocks[0].minutes).toBe(1);
    s = S.updateBlock(s, id, { minutes: 999 });
    expect(s.blocks[0].minutes).toBe(180);
    s = S.updateBlock(s, id, { minutes: 7.6 });
    expect(s.blocks[0].minutes).toBe(8);
  });

  it('quitar un bloque', () => {
    const s = S.addTextBlock(S.newSession(), 'Agua');
    expect(S.removeBlock(s, s.blocks[0].id).blocks).toHaveLength(0);
  });

  it('no deja pasar del máximo de bloques', () => {
    let s = S.newSession();
    for (let i = 0; i < S.SESSION_LIMITS.blocks + 3; i++) s = S.addTextBlock(s, `B${i}`);
    expect(s.blocks).toHaveLength(S.SESSION_LIMITS.blocks);
  });
});

describe('sesión: ejercicio actual o copia', () => {
  it('usa la versión actual del ejercicio si existe', () => {
    const e = ex('Original');
    const s = S.addExerciseBlock(S.newSession(), e);
    const mejorado = { ...e, title: 'Mejorado', updatedAt: e.updatedAt + 1 };
    const [r] = S.resolveBlocks(s, new Map([[e.id, mejorado]]));
    expect(r.source).toBe('live');
    expect(r.exercise?.title).toBe('Mejorado');
  });

  it('si el ejercicio se borró, usa la copia', () => {
    const e = ex('Borrado');
    const s = S.addExerciseBlock(S.newSession(), e);
    const [r] = S.resolveBlocks(s, new Map());
    expect(r.source).toBe('snapshot');
    expect(r.exercise?.title).toBe('Borrado');
  });

  it('al guardar, las copias se ponen al día solo si el ejercicio cambió', () => {
    const e = ex('V1');
    const s = S.addExerciseBlock(S.newSession(), e);
    expect(S.refreshSnapshots(s, new Map([[e.id, e]]))).toBe(s);
    const v2 = { ...e, title: 'V2', updatedAt: e.updatedAt + 1 };
    const s2 = S.refreshSnapshots(s, new Map([[e.id, v2]]));
    expect(s2.blocks[0].kind === 'exercise' && s2.blocks[0].snapshot.title).toBe('V2');
  });
});

describe('sesión: tiempos', () => {
  it('total, hora de fin y horario de cada bloque', () => {
    let s = { ...S.newSession(), startTime: '18:30' };
    s = S.addExerciseBlock(s, ex('Calentamiento', 15));
    s = S.addTextBlock(s, 'Agua', 5);
    s = S.addExerciseBlock(s, ex('5c5', 75));
    expect(S.totalMinutes(s)).toBe(95);
    expect(S.endTime(s)).toBe('20:05');
    expect(S.blockSchedule(s).map((b) => `${b.clockFrom}-${b.clockTo}`)).toEqual(['18:30-18:45', '18:45-18:50', '18:50-20:05']);
  });

  it('pasa de medianoche', () => {
    expect(S.addMinutes('23:30', 45)).toBe('00:15');
  });

  it('sin hora de inicio no hay horas, pero sí minutos', () => {
    const s = S.addTextBlock(S.newSession(), 'Agua', 5);
    expect(S.blockSchedule(s)[0]).toMatchObject({ from: 0, to: 5, clockFrom: '', clockTo: '' });
  });

  it('formato de duración', () => {
    expect(S.formatDuration(45)).toBe('45 min');
    expect(S.formatDuration(60)).toBe('1 h');
    expect(S.formatDuration(95)).toBe('1 h 35 min');
  });
});

describe('sesión: leer datos de fuera', () => {
  it('una sesión guardada se lee igual', () => {
    let s = { ...S.newSession('Jueves', '2026-11-19'), startTime: '19:00', team: 'Cadete A', goal: 'Bloqueo directo' };
    s = S.addExerciseBlock(s, ex('Pick and roll'));
    s = S.addTextBlock(s, 'Charla');
    expect(S.parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('repara lo que está mal y quita los bloques rotos', () => {
    const raw = {
      id: 'abc',
      title: 'X',
      date: '2026-02-30', // no existe
      startTime: '25:00', // no existe
      blocks: [{ kind: 'text', title: 'Bien', minutes: 500 }, { kind: 'exercise', exerciseId: 'z', snapshot: { basura: 1 } }, { kind: 'raro' }],
    };
    const s = S.parseSession(raw)!;
    expect(s.date).toBe('');
    expect(s.startTime).toBe('');
    expect(s.blocks).toHaveLength(1);
    expect(s.blocks[0].minutes).toBe(180);
  });

  it('sin id válido no es una sesión', () => {
    expect(S.parseSession({ title: 'Sin id' })).toBeNull();
    expect(S.parseSession(null)).toBeNull();
  });

  it('fechas', () => {
    expect(S.isDate('2026-11-17')).toBe(true);
    expect(S.isDate('2026-13-01')).toBe(false);
    expect(S.isDate('17/11/2026')).toBe(false);
  });
});
