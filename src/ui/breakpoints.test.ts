import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, layoutForSize, MEDIA, MEDIA_WIDTHS } from './breakpoints';

describe('puntos de corte', () => {
  it('cada ancho cae en su maqueta, con los bordes incluidos', () => {
    expect(layoutForSize(360)).toBe('mobile');
    expect(layoutForSize(767)).toBe('mobile');
    expect(layoutForSize(768)).toBe('tablet');
    expect(layoutForSize(1180)).toBe('tablet');
    expect(layoutForSize(1181)).toBe('desktop');
    expect(layoutForSize(1920)).toBe('desktop');
  });

  it('un móvil en horizontal (pantalla muy baja) usa la maqueta de móvil', () => {
    expect(layoutForSize(844, 390)).toBe('mobile');
    expect(layoutForSize(1180, 500)).toBe('mobile');
    expect(layoutForSize(1024, 768)).toBe('tablet');
    expect(layoutForSize(1400, 860)).toBe('desktop');
  });

  it('las consultas para React usan los mismos números', () => {
    expect(MEDIA.mobile).toBe(`(max-width: ${BREAKPOINTS.mobileMax}px), (max-height: ${BREAKPOINTS.shortMax}px)`);
    expect(MEDIA.tablet).toBe('(min-width: 768px) and (max-width: 1180px) and (min-height: 501px)');
  });

  it('ninguna hoja de estilo usa en un @media un ancho que no sea un punto de corte', () => {
    // todas las hojas de estilo del proyecto, como texto
    const sheets = import.meta.glob<string>('/src/**/*.css', { query: '?raw', import: 'default', eager: true });
    const wrong: string[] = [];
    for (const [f, css] of Object.entries(sheets))
      for (const m of css.matchAll(/@media[^{]*\((?:max|min)-width:\s*(\d+)px\)/g))
        if (!(MEDIA_WIDTHS as readonly number[]).includes(Number(m[1]))) wrong.push(`${f}: ${m[0]}`);
    // si Vitest dejara de procesar el CSS (`test.css` en vite.config.ts), las hojas llegarían vacías
    expect(Object.keys(sheets).length).toBeGreaterThan(10);
    expect(Object.values(sheets).every((css) => css.includes('{'))).toBe(true);
    expect(wrong).toEqual([]);
  });
});
