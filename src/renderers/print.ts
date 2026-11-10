// Print-shop picture styles, each a pure function of the scene's greyscale source:
//   Engraving — cross-hatched lines whose layers appear as the tone darkens, like an etching.
//   Stipple   — ink dots on a jittered grid, kept with probability rising with darkness
//               (a seeded, stable blue-noise-like stipple: the dots never swim between frames).
//   Riso      — two inks (the theme's accent and second ink) printed slightly out of register,
//               with grain, multiplied onto the paper.
// And one style that needs no scene at all:
//   Flow      — a flow field grown from a hash of the passage's own words, tinted by its mood.
import { H, W, clamp } from "../scenes/helpers";
import { tok, type ArtItem } from "./index";

const SC = 3;
const css = (c: number[], a = 1) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Darkness 0..1 of the source at (x, y) in source pixels. */
function darkAt(d: Uint8ClampedArray, x: number, y: number): number {
  const xi = Math.max(0, Math.min(W - 1, x | 0)), yi = Math.max(0, Math.min(H - 1, y | 0)), i = (yi * W + xi) * 4;
  return 1 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
}

const LAYERS: [number, number, number, number][] = [
  // angle, darkness threshold, spacing (px), width
  [Math.PI / 4, 0.18, 5, 0.9], [-Math.PI / 4, 0.45, 5, 1], [0, 0.7, 4, 1.15], [Math.PI / 2, 0.88, 4, 1.2],
];

export function engrave(it: ArtItem, img: ImageData): void {
  const d = img.data, o = it.out!, OW = W * SC, OH = H * SC, diag = Math.hypot(OW, OH);
  o.fillStyle = css(tok.hi); o.fillRect(0, 0, OW, OH);
  o.strokeStyle = css(tok.lo); o.lineCap = "round";
  LAYERS.forEach(([ang, th, sp, lw]) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    o.lineWidth = lw; o.beginPath();
    for (let off = -diag / 2; off < diag / 2; off += sp) {
      let on = false;
      for (let s = -diag / 2; s <= diag / 2; s += 3) {
        const x = OW / 2 - off * sa + s * ca, y = OH / 2 + off * ca + s * sa;
        if (x < 0 || y < 0 || x >= OW || y >= OH) { on = false; continue; }
        if (darkAt(d, x / SC, y / SC) > th) { if (on) o.lineTo(x, y); else { o.moveTo(x, y); on = true; } }
        else on = false;
      }
    }
    o.stroke();
  });
}

export function stipple(it: ArtItem, img: ImageData): void {
  const d = img.data, o = it.out!, OW = W * SC, OH = H * SC, cell = 4.2, rnd = mulberry(Math.round(it.seed * 1000) + 7);
  o.fillStyle = css(tok.hi); o.fillRect(0, 0, OW, OH);
  o.fillStyle = css(tok.lo); o.beginPath();
  for (let gy = 0; gy < OH; gy += cell) for (let gx = 0; gx < OW; gx += cell) {
    const x = gx + rnd() * cell, y = gy + rnd() * cell, keep = rnd(), dk = darkAt(d, x / SC, y / SC);
    if (keep < Math.pow(dk, 1.35) * 1.05) { const r = 0.9 + dk * 0.9; o.moveTo(x + r, y); o.arc(x, y, r, 0, 6.2832); }
  }
  o.fill();
}

const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function riso(it: ArtItem, img: ImageData): void {
  const d = img.data, o = it.out!, OW = W * 2, OH = H * 2, out = o.createImageData(OW, OH), q = out.data;
  const P = tok.hi, A = tok.acc, B = tok.acc2, seed = Math.round(it.seed * 977) + 3;
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
    const sx = x / 2, sy = y / 2;
    // Pulled like a night print: the lights carry the ink, the dark is bare paper.
    const a = smooth(0.5, 0.92, 1 - darkAt(d, sx, sy)), b = smooth(0.18, 0.6, 1 - darkAt(d, sx - 1.3, sy - 0.9)) * (1 - 0.35 * a);
    // grain: a fixed hash per pixel, so the texture stays put
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); const n = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    const ia = a > n * 0.9 + 0.05 ? 0.92 : a * 0.25, ib = b > n * 0.8 + 0.1 ? 0.85 : b * 0.2;
    const i = (y * OW + x) * 4;
    for (let c = 0; c < 3; c++) q[i + c] = P[c] * (1 - ia * (1 - A[c] / 255)) * (1 - ib * (1 - B[c] / 255));
    q[i + 3] = 255;
  }
  o.putImageData(out, 0, 0);
}

/** 2-D value noise on a hashed lattice, smoothly interpolated. */
function noise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (i: number, j: number) => { let v = (i * 374761393 + j * 668265263 + s * 1442695041) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), e = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
}

export function flow(it: ArtItem, t: number, tm: number, moving: boolean): void {
  const o = it.out!, OW = W * SC, OH = H * SC, g = it.gen || { h: 1, v: 0, a: 0.5 }, rnd = mulberry(g.h);
  o.clearRect(0, 0, OW, OH);
  const warm = clamp(0.5 + g.v * 0.5), N = Math.round(70 + g.a * 90), L = 60, step = 3.2 + g.a * 2;
  const freq = 0.004 + rnd() * 0.004, turn = 1.2 + rnd() * 1.6, drift = moving ? Math.sin(tm * 0.15) * 0.25 : 0;
  const grow = clamp(t * 1.25), steps = Math.max(2, Math.round(L * grow));
  o.lineCap = "round";
  for (let k = 0; k < N; k++) {
    let x = rnd() * OW, y = rnd() * OH;
    const col = rnd() < warm ? tok.acc : tok.acc2, w = 0.6 + rnd() * 1.4;
    o.strokeStyle = css(col, 0.35 + 0.45 * rnd()); o.lineWidth = w;
    o.beginPath(); o.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      const ang = noise(x * freq, y * freq, g.h & 0xffff) * Math.PI * 2 * turn + drift;
      x += Math.cos(ang) * step; y += Math.sin(ang) * step;
      if (x < -10 || y < -10 || x > OW + 10 || y > OH + 10) break;
      o.lineTo(x, y);
    }
    o.stroke();
  }
}
