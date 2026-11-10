// The Nymphaea mark: a water lily on dark water. t = how open the flower is (0 bud … 1 open).
import { H, W, circ, ease, g, lerp, lg, rg, vignette, wa, type Ctx } from "./helpers";

function petal(c: Ctx, x: number, y: number, len: number, wid: number, ang: number, f: string | CanvasGradient): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0);
  c.quadraticCurveTo(wid, -len * 0.55, 0, -len);
  c.quadraticCurveTo(-wid, -len * 0.55, 0, 0);
  c.fillStyle = f; c.fill(); c.restore();
}

function pad(c: Ctx, x: number, y: number, rx: number, ry: number, notch: number, f: string): void {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, notch + 0.35, notch - 0.35 + Math.PI * 2); c.lineTo(x, y); c.closePath();
  c.fillStyle = f; c.fill();
}

function flower(c: Ctx, cx: number, cy: number, open: number): void {
  const spread = lerp(0.12, 1.3, open);
  for (let i = 0; i < 7; i++) {
    const k = i / 6 - 0.5;
    petal(c, cx, cy, lerp(40, 46, open), 12, k * spread * 2, g(lerp(150, 200, open)));
  }
  const front = lg(c, cx - 20, 0, cx + 20, 0, [[0, "#fff"], [0.5, g(235)], [1, g(140)]]);
  for (let i = 0; i < 5; i++) {
    const k = i / 4 - 0.5;
    petal(c, cx, cy + 3, lerp(33, 36, open), 11, k * spread * 1.5, front);
  }
  if (open > 0.55) circ(c, cx, cy - 9, 4.5 * (open - 0.55) / 0.45, g(255));
}

export function lotus(c: Ctx, t: number, tm: number): void {
  const e = ease(t), wl = 84, cx = 96, cy = 84;
  c.fillStyle = lg(c, 0, 0, 0, wl, [[0, g(4)], [1, g(34)]]); c.fillRect(0, 0, W, wl);
  c.fillStyle = lg(c, 0, wl, 0, H, [[0, g(22)], [1, g(6)]]); c.fillRect(0, wl, W, H - wl);
  c.fillStyle = rg(c, cx, cy - 14, 4, 80, [[0, wa(0.08 + 0.32 * e)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  // ripples spreading from the stem
  c.strokeStyle = wa(0.18); c.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) {
    const r = ((tm * 0.18 + k / 3) % 1);
    c.globalAlpha = 1 - r;
    c.beginPath(); c.ellipse(cx, wl + 6, 10 + r * 80, 2 + r * 9, 0, 0, 7); c.stroke();
  }
  c.globalAlpha = 1;
  pad(c, 46, wl + 12, 26, 6, 0.4, g(52));
  pad(c, 150, wl + 20, 30, 7, 2.6, g(44));
  pad(c, 118, wl + 8, 16, 4, 4.4, g(60));
  // reflection
  // reflection: mirror about the waterline, squashed
  c.save(); c.globalAlpha = 0.22; c.translate(0, wl); c.scale(1, -0.4); c.translate(0, -wl); flower(c, cx, cy, e); c.restore();
  flower(c, cx, cy, e);
  vignette(c, 0.45);
}
