import { describe, expect, it } from 'vitest';
import { parseRoute } from './useRoute';

describe('parseRoute', () => {
  it('sin hash: biblioteca', () => {
    expect(parseRoute('')).toEqual({ name: 'library' });
    expect(parseRoute('#/')).toEqual({ name: 'library' });
  });
  it('lee el id del ejercicio', () => {
    expect(parseRoute('#/ejercicio/ab12-cd')).toEqual({ name: 'exercise', id: 'ab12-cd' });
  });
  it('un id raro vuelve a la biblioteca', () => {
    expect(parseRoute('#/ejercicio/../../x')).toEqual({ name: 'library' });
    expect(parseRoute('#/ejercicio/')).toEqual({ name: 'library' });
  });
});
