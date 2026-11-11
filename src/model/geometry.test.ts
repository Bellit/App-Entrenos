import { describe, expect, it } from 'vitest';
import { easeInOut, pathFor, Polyline, simplify, stretch, translate, zigzag } from './geometry';

const line = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i, y: 0 }));

describe('geometría', () => {
  it('una polilínea mide su longitud y da puntos y tangentes a lo largo', () => {
    const pl = new Polyline([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }]);
    expect(pl.length).toBe(11);
    expect(pl.atLen(5)).toEqual({ x: 3, y: 4 });
    expect(pl.at(1)).toEqual({ x: 3, y: 10 });
    expect(pl.atLen(99)).toEqual({ x: 3, y: 10 }); // fuera de rango: se queda en el final
    expect(pl.tangentAtLen(8)).toEqual({ x: 0, y: 1 });
    expect(pl.until(5).at(-1)).toEqual({ x: 3, y: 4 });
  });

  it('una polilínea vacía o de un punto no rompe', () => {
    expect(new Polyline([]).length).toBe(0);
    expect(new Polyline([{ x: 2, y: 2 }]).atLen(3)).toEqual({ x: 2, y: 2 });
    expect(new Polyline([{ x: 2, y: 2 }]).tangentAtLen(0)).toEqual({ x: 1, y: 0 });
  });

  it('simplificar deja una recta en sus dos extremos y conserva las esquinas', () => {
    expect(simplify(line(50), 0.5)).toEqual([{ x: 0, y: 0 }, { x: 49, y: 0 }]);
    const ele = [...line(10), ...Array.from({ length: 10 }, (_, i) => ({ x: 9, y: i + 1 }))];
    expect(simplify(ele, 0.5)).toEqual([{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 10 }]);
  });

  it('la curva suave pasa por los puntos de control', () => {
    const ctrl = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }];
    const pl = pathFor(ctrl);
    expect(pl.pts[0]).toEqual(ctrl[0]);
    expect(pl.pts.at(-1)).toEqual(ctrl[2]);
    expect(pl.pts.some((p) => Math.abs(p.x - 10) < 1e-9 && Math.abs(p.y - 10) < 1e-9)).toBe(true);
  });

  it('el zigzag del bote empieza y acaba en la trayectoria y oscila a los lados', () => {
    const pl = new Polyline([{ x: 0, y: 0 }, { x: 30, y: 0 }]);
    const z = zigzag(pl);
    expect(z[0]).toEqual({ x: 0, y: 0 });
    expect(z.at(-1)).toEqual({ x: 30, y: 0 });
    expect(z.some((p) => p.y > 1) && z.some((p) => p.y < -1)).toBe(true);
  });

  it('estirar mueve el final, deja el inicio y reparte el cambio', () => {
    const s = stretch([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], { x: 10, y: 10 });
    expect(s).toEqual([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]);
    expect(translate([{ x: 1.04, y: 2 }], { x: 1, y: 1 })).toEqual([{ x: 2, y: 3 }]);
  });

  it('el suavizado de la animación va de 0 a 1 pasando por la mitad', () => {
    expect([easeInOut(0), easeInOut(0.5), easeInOut(1)]).toEqual([0, 0.5, 1]);
  });
});
