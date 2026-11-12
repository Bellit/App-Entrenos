import { describe, expect, it } from 'vitest';
import { parseRoute, routeHref } from './useRoute';

describe('parseRoute', () => {
  it('sin hash: la portada son las sesiones', () => {
    expect(parseRoute('')).toEqual({ name: 'sessions' });
    expect(parseRoute('#/')).toEqual({ name: 'sessions' });
  });
  it('biblioteca de ejercicios', () => {
    expect(parseRoute('#/ejercicios')).toEqual({ name: 'library' });
  });
  it('lee el id del ejercicio y de la sesión', () => {
    expect(parseRoute('#/ejercicio/ab12-cd')).toEqual({ name: 'exercise', id: 'ab12-cd' });
    expect(parseRoute('#/sesion/xy_9')).toEqual({ name: 'session', id: 'xy_9' });
    expect(parseRoute('#/entreno/xy_9')).toEqual({ name: 'training', id: 'xy_9' });
  });
  it('compartidos', () => {
    expect(parseRoute('#/c/k7Qx2mPaAbCd')).toEqual({ name: 'shared', id: 'k7Qx2mPaAbCd' });
    expect(parseRoute('#/compartido')).toEqual({ name: 'inbox' });
    expect(parseRoute('#/c/a.b')).toEqual({ name: 'sessions' });
  });
  it('un id raro vuelve a la portada', () => {
    expect(parseRoute('#/ejercicio/../../x')).toEqual({ name: 'sessions' });
    expect(parseRoute('#/sesion/')).toEqual({ name: 'sessions' });
  });
  it('los enlaces y la lectura coinciden', () => {
    expect(parseRoute(routeHref.session('a1'))).toEqual({ name: 'session', id: 'a1' });
    expect(parseRoute(routeHref.library)).toEqual({ name: 'library' });
  });
});
