// Seeded randomness and smooth shapes for composed scenes: a small generator, 1D value noise and
// its fractal sum (for ridgelines, dunes, shorelines), and Catmull-Rom curves so the ground is
// drawn as smooth Bézier paths rather than zigzags. Pure.
import { f, type Pt } from "../vscenes/shapes";

export type Rng = () => number;

/** mulberry32: a small, good, seedable generator. */
export function rng(seed: number): Rng {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in −1..1, period 64. */
export function noise1(seed: number): (x: number) => number {
  const r = rng(seed), v = Array.from({ length: 64 }, () => r() * 2 - 1);
  return (x) => {
    const i = Math.floor(x), t = x - i, u = t * t * (3 - 2 * t);
    const a = v[((i % 64) + 64) % 64], b = v[(((i + 1) % 64) + 64) % 64];
    return a + (b - a) * u;
  };
}

/** Fractal noise: octaves of value noise, each half as strong and twice as fine. */
export function fbm(seed: number, octaves = 4): (x: number) => number {
  const ns = Array.from({ length: octaves }, (_, k) => noise1(seed * 31 + k * 977 + 1));
  return (x) => {
    let s = 0, a = 1, fq = 1, n = 0;
    for (let k = 0; k < octaves; k++) { s += ns[k](x * fq) * a; n += a; a *= 0.5; fq *= 2.03; }
    return s / n;
  };
}

/** A smooth open curve through points (Catmull-Rom as cubic Béziers). */
export function smooth(pts: Pt[]): string {
  if (pts.length < 2) return "M0,0";
  let d = "M" + f(pts[0][0]) + "," + f(pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += " C" + f(c1[0]) + "," + f(c1[1]) + " " + f(c2[0]) + "," + f(c2[1]) + " " + f(p2[0]) + "," + f(p2[1]);
  }
  return d;
}

export interface RidgeOpts {
  /** Horizontal scale of the features (bigger is broader). */
  scale?: number;
  /** Sharpen peaks (mountains): fold the noise. */
  sharp?: boolean;
  /** Points across the frame. */
  n?: number;
}

/** Points of a ridgeline across the frame, its base at y0 and its peaks up to amp above. */
export function ridgePts(seed: number, y0: number, amp: number, o: RidgeOpts = {}): Pt[] {
  const n = o.n || 24, sc = o.scale || 1, fn = fbm(seed, 4), off = (seed % 97) * 0.37;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = -12 + (344 * i) / n;
    let h = fn(off + (x / 90) / sc) * 0.5 + 0.5;
    if (o.sharp) h = 1 - Math.abs(fn(off + (x / 70) / sc) * 1.6);
    pts.push([x, y0 - amp * Math.max(0, Math.min(1.1, h))]);
  }
  return pts;
}

/** The height of a ridge at x (linear between its points). */
export function ridgeAt(pts: Pt[], x: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * ((x - a[0]) / (b[0] - a[0] || 1));
  }
  return pts[pts.length - 1][1];
}

/** A filled ridge: the smooth line, closed down to the bottom of the frame. */
export function ridgeFill(pts: Pt[], bottom = 206): string {
  return smooth(pts) + " L" + f(pts[pts.length - 1][0]) + "," + bottom + " L" + f(pts[0][0]) + "," + bottom + " Z";
}

/** Peaks of a ridge (local minima of y), for snow caps and lit faces. */
export function peaks(pts: Pt[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] < pts[i - 1][1] && pts[i][1] <= pts[i + 1][1]) out.push(i);
  return out;
}
