import { describe, expect, it } from 'vitest';
import { addTag, duplicateExercise, fold, matchesFilters, newExercise, normalizeTag, parseExercise } from './exercise';

describe('etiquetas', () => {
  it('se normalizan (espacios y mayúsculas)', () => {
    expect(normalizeTag('  Bloqueo   Indirecto ')).toBe('bloqueo indirecto');
  });
  it('no se repiten ni se aceptan vacías', () => {
    expect(addTag(['cortes'], 'Cortes')).toEqual(['cortes']);
    expect(addTag(['cortes'], '   ')).toEqual(['cortes']);
    expect(addTag(['cortes'], 'zona 2-3')).toEqual(['cortes', 'zona 2-3']);
  });
});

describe('búsqueda', () => {
  const e = { ...newExercise('Tiro en parejas'), tags: ['bloqueo indirecto'], notes: 'Pasar y cortar', category: 'tiro' as const };
  it('ignora tildes y mayúsculas', () => {
    expect(fold('Bloqueo Indirécto')).toBe('bloqueo indirecto');
    expect(matchesFilters(e, 'PAREJAS', '', '')).toBe(true);
    expect(matchesFilters(e, 'indirecto', '', '')).toBe(true);
  });
  it('filtra por categoría y etiqueta', () => {
    expect(matchesFilters(e, '', 'tiro', '')).toBe(true);
    expect(matchesFilters(e, '', '1c1', '')).toBe(false);
    expect(matchesFilters(e, '', '', 'bloqueo indirecto')).toBe(true);
    expect(matchesFilters(e, '', '', 'zona')).toBe(false);
  });
});

describe('parseExercise', () => {
  it('acepta un ejercicio válido tras guardarlo y leerlo', () => {
    const e = newExercise('Calentamiento');
    expect(parseExercise(JSON.parse(JSON.stringify(e)))?.title).toBe('Calentamiento');
  });
  it('rechaza datos rotos', () => {
    expect(parseExercise(null)).toBeNull();
    expect(parseExercise({ id: 'x' })).toBeNull();
  });
  it('repara categoría, etiquetas y minutos inválidos', () => {
    const raw = { ...JSON.parse(JSON.stringify(newExercise())), category: 'otra', tags: ['A', 'a', 3], minutes: 9999 };
    const p = parseExercise(raw)!;
    expect(p.category).toBe('');
    expect(p.tags).toEqual(['a']);
    expect(p.minutes).toBe(180);
  });
});

describe('duplicar', () => {
  it('crea un ejercicio distinto con el mismo dibujo', () => {
    const e = newExercise('1c1');
    const d = duplicateExercise(e);
    expect(d.id).not.toBe(e.id);
    expect(d.title).toBe('1c1 (copia)');
    expect(d.play.frames.length).toBe(e.play.frames.length);
  });
});
