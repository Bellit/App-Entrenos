import type { Pt } from './types';

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const near = (a: Pt, b: Pt, eps = 0.01) => Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round1 = (p: Pt): Pt => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });

/** Simplificación Ramer–Douglas–Peucker. */
export function simplify(points: Pt[], eps: number): Pt[] {
  if (points.length < 3) return points.slice();
  const first = points[0];
  const last = points[points.length - 1];
  let maxD = -1;
  let idx = 0;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > eps) {
    const a = simplify(points.slice(0, idx + 1), eps);
    const b = simplify(points.slice(idx), eps);
    return a.slice(0, -1).concat(b);
  }
  return [first, last];
}

/** Curva Catmull-Rom que pasa por los puntos de control, devuelta como polilínea densa. */
function smooth(points: Pt[], segs = 10): Pt[] {
  if (points.length < 3) return points.slice();
  const out: Pt[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
}

/** Polilínea con parametrización por longitud de arco. */
export class Polyline {
  readonly pts: Pt[];
  readonly cum: number[];
  readonly length: number;

  constructor(pts: Pt[]) {
    this.pts = pts.length ? pts : [{ x: 0, y: 0 }];
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + dist(this.pts[i - 1], this.pts[i]));
    this.length = this.cum[this.cum.length - 1];
  }

  private seg(s: number): number {
    const c = this.cum;
    let lo = 0;
    let hi = c.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (c[mid] <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  atLen(s: number): Pt {
    if (this.pts.length === 1 || this.length === 0) return this.pts[0];
    s = clamp(s, 0, this.length);
    const i = this.seg(s);
    const segLen = this.cum[i + 1] - this.cum[i] || 1;
    return lerp(this.pts[i], this.pts[i + 1], (s - this.cum[i]) / segLen);
  }

  at(u: number): Pt {
    return this.atLen(u * this.length);
  }

  /** Vector unitario tangente en la longitud s. */
  tangentAtLen(s: number): Pt {
    if (this.pts.length < 2 || this.length === 0) return { x: 1, y: 0 };
    s = clamp(s, 0, this.length);
    const i = Math.min(this.seg(s), this.pts.length - 2);
    const a = this.pts[i];
    const b = this.pts[i + 1];
    const l = dist(a, b) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  }

  /** Recorta la polilínea a [0, s]. */
  until(s: number): Pt[] {
    if (s >= this.length) return this.pts.slice();
    const i = this.seg(s);
    return this.pts.slice(0, i + 1).concat([this.atLen(s)]);
  }
}

export const pathFor = (control: Pt[]) => new Polyline(smooth(control));

export const toD = (pts: Pt[]) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('');

/** Línea en zigzag (conducción) siguiendo la polilínea, con un tramo final recto para la flecha. */
export function zigzag(pl: Polyline, amp = 1.7, step = 2.6, tail = 5): Pt[] {
  const L = pl.length;
  const end = Math.max(0, L - tail);
  const out: Pt[] = [pl.atLen(0)];
  let sign = 1;
  for (let s = step; s < end; s += step) {
    const p = pl.atLen(s);
    const t = pl.tangentAtLen(s);
    out.push({ x: p.x - t.y * amp * sign, y: p.y + t.x * amp * sign });
    sign = -sign;
  }
  out.push(pl.atLen(end));
  out.push(pl.atLen(L));
  return out;
}

/** Desplaza el final de una trayectoria manteniendo fijo el inicio (repartiendo el cambio a lo largo). */
export function stretch(points: Pt[], newEnd: Pt): Pt[] {
  if (points.length < 2) return [points[0], newEnd];
  const last = points[points.length - 1];
  const d = { x: newEnd.x - last.x, y: newEnd.y - last.y };
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  const total = cum[cum.length - 1] || 1;
  return points.map((p, i) => round1({ x: p.x + d.x * (cum[i] / total), y: p.y + d.y * (cum[i] / total) }));
}

export const translate = (points: Pt[], d: Pt) => points.map((p) => round1({ x: p.x + d.x, y: p.y + d.y }));
