// Drawing helpers for the 192×120 greyscale scene canvas.
export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];
export type Stop = [number, string];

export const W = 192, H = 120;

/** 8×8 Bayer matrix for ordered dithering. */
export const BAY: number[][] = (() => {
  let m: number[][] = [[0]];
  for (let n = 1; n < 8; n *= 2) {
    const s = m.length, o: number[][] = [];
    for (let y = 0; y < s * 2; y++) {
      o[y] = [];
      for (let x = 0; x < s * 2; x++) o[y][x] = m[y % s][x % s] * 4 + [0, 2, 3, 1][(y < s ? 0 : 1) * 2 + (x < s ? 0 : 1)];
    }
    m = o;
  }
  return m;
})();

export function clamp(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function ease(t: number): number { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function g(v: number): string { v = Math.max(0, Math.min(255, v | 0)); return "rgb(" + v + "," + v + "," + v + ")"; }
export function wa(a: number): string { return "rgba(255,255,255," + Math.max(0, a).toFixed(3) + ")"; }

export function poly(c: Ctx, pts: Pt[], f: string | CanvasGradient): void {
  c.beginPath();
  for (let i = 0; i < pts.length; i++) { if (i) c.lineTo(pts[i][0], pts[i][1]); else c.moveTo(pts[i][0], pts[i][1]); }
  c.closePath(); c.fillStyle = f; c.fill();
}
export function circ(c: Ctx, x: number, y: number, r: number, f: string | CanvasGradient): void {
  c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 7); c.fillStyle = f; c.fill();
}
export function lg(c: Ctx, x0: number, y0: number, x1: number, y1: number, st: Stop[]): CanvasGradient {
  const q = c.createLinearGradient(x0, y0, x1, y1); st.forEach((s) => q.addColorStop(s[0], s[1])); return q;
}
export function rg(c: Ctx, x: number, y: number, r0: number, r1: number, st: Stop[]): CanvasGradient {
  const q = c.createRadialGradient(x, y, r0, x, y, r1); st.forEach((s) => q.addColorStop(s[0], s[1])); return q;
}
export function vignette(c: Ctx, k: number): void {
  c.fillStyle = rg(c, W / 2, H / 2, 20, 115, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0," + k + ")"]]); c.fillRect(0, 0, W, H);
}
export function flicker(tm: number): number {
  const n = Math.sin(tm * 13.1) * 0.5 + Math.sin(tm * 7.3 + 1) * 0.3 + Math.sin(tm * 23.7) * 0.2;
  return Math.max(0, n - 0.55) * 0.55;
}
export function hash(a: number, b: number): number { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }

export interface BoardOpts { cx: number; yt: number; yb: number; wt: number; wb: number; light: (x: number, y: number) => number }

export function board(c: Ctx, o: BoardOpts): void {
  for (let r = 0; r < 8; r++) {
    const ya = o.yt + (o.yb - o.yt) * r / 8, yb = o.yt + (o.yb - o.yt) * (r + 1) / 8;
    const wa_ = o.wt + (o.wb - o.wt) * r / 8, wb = o.wt + (o.wb - o.wt) * (r + 1) / 8;
    for (let q = 0; q < 8; q++) {
      const pts: Pt[] = [[o.cx - wa_ / 2 + wa_ * q / 8, ya], [o.cx - wa_ / 2 + wa_ * (q + 1) / 8, ya], [o.cx - wb / 2 + wb * (q + 1) / 8, yb], [o.cx - wb / 2 + wb * q / 8, yb]];
      const f = g(((r + q) % 2 ? 44 : 228) * o.light((pts[0][0] + pts[2][0]) / 2, (ya + yb) / 2));
      poly(c, pts, f); c.strokeStyle = f; c.lineWidth = 0.7; c.stroke();
    }
  }
}

export type PieceKind = "pawn" | "king" | "queen" | "knight";

export function piece(c: Ctx, kind: PieceKind, x: number, y: number, s: number, f: string | CanvasGradient): void {
  const Q = (pts: Pt[]) => poly(c, pts.map((p): Pt => [x + p[0] * s, y - p[1] * s]), f);
  Q([[-0.26, 0], [0.26, 0], [0.24, 0.07], [-0.24, 0.07]]); Q([[-0.2, 0.07], [0.2, 0.07], [0.17, 0.12], [-0.17, 0.12]]);
  if (kind === "pawn") {
    Q([[-0.17, 0.12], [0.17, 0.12], [0.07, 0.5], [-0.07, 0.5]]); Q([[-0.13, 0.5], [0.13, 0.5], [0.13, 0.55], [-0.13, 0.55]]); circ(c, x, y - 0.67 * s, 0.12 * s, f);
  } else if (kind === "king" || kind === "queen") {
    Q([[-0.2, 0.12], [0.2, 0.12], [0.09, 0.7], [-0.09, 0.7]]); Q([[-0.15, 0.7], [0.15, 0.7], [0.15, 0.76], [-0.15, 0.76]]);
    if (kind === "king") {
      Q([[-0.14, 0.76], [0.14, 0.76], [0.18, 0.9], [-0.18, 0.9]]); Q([[-0.025, 0.9], [0.025, 0.9], [0.025, 1.1], [-0.025, 1.1]]); Q([[-0.07, 0.99], [0.07, 0.99], [0.07, 1.04], [-0.07, 1.04]]);
    } else {
      Q([[-0.2, 0.76], [0.2, 0.76], [0.2, 0.9], [-0.2, 0.9]]);
      Q([[-0.2, 0.9], [-0.17, 1.02], [-0.1, 0.93], [-0.05, 1.06], [0, 0.94], [0.05, 1.06], [0.1, 0.93], [0.17, 1.02], [0.2, 0.9]]);
      ([[-0.17, 1.04], [-0.05, 1.08], [0.05, 1.08], [0.17, 1.04]] as Pt[]).forEach((p) => circ(c, x + p[0] * s, y - p[1] * s, 0.028 * s, f));
    }
  } else if (kind === "knight") {
    Q([[-0.2, 0.1], [0.2, 0.1], [0.18, 0.3], [0.15, 0.5], [0.2, 0.7], [0.12, 0.9], [0.05, 1], [0, 0.96], [-0.04, 1.02], [-0.12, 0.9], [-0.28, 0.7], [-0.32, 0.62], [-0.26, 0.56], [-0.14, 0.6], [-0.04, 0.55], [-0.14, 0.3]]);
  }
}

export function shade(c: Ctx, x: number, s: number): CanvasGradient {
  return lg(c, x - 0.3 * s, 0, x + 0.3 * s, 0, [[0, "#fff"], [0.5, "#b0b0b0"], [1, "#2c2c2c"]]);
}
export function shadow(c: Ctx, kind: PieceKind, x: number, y: number, s: number, k: number): void {
  c.save(); c.translate(x, y); c.transform(1, 0, -k, 0.22, 0, 0); piece(c, kind, 0, 0, s, "#060606"); c.restore();
}
export function person(c: Ctx, x: number, base: number, h: number, step: number, f: string): void {
  const sw = Math.sin(step) * h * 0.07;
  circ(c, x, base - h * 0.9, h * 0.075, f);
  poly(c, [[x - h * 0.1, base - h * 0.8], [x + h * 0.1, base - h * 0.8], [x + h * 0.11, base - h * 0.44], [x - h * 0.11, base - h * 0.44]], f);
  poly(c, [[x - h * 0.09, base - h * 0.45], [x - h * 0.01, base - h * 0.45], [x - h * 0.03 + sw, base], [x - h * 0.09 + sw, base]], f);
  poly(c, [[x + h * 0.01, base - h * 0.45], [x + h * 0.09, base - h * 0.45], [x + h * 0.09 - sw, base], [x + h * 0.03 - sw, base]], f);
}
