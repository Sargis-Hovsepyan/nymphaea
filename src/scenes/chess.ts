// Chess scenes. Each: t = how far it has scrolled into view (0..1, the story beat), tm = seconds.
import { H, W, board, ease, g, lerp, lg, piece, poly, rg, shade, shadow, vignette, wa, type Ctx } from "./helpers";

export function lamp(c: Ctx, t: number, tm: number): void {
  const a = Math.sin(tm * 0.8) * 0.09 * (0.4 + 0.6 * t), lx = 96 + Math.sin(a) * 34, ly = 6 + Math.cos(a) * 22;
  c.fillStyle = g(6); c.fillRect(0, 0, W, H);
  poly(c, [[lx - 11, ly + 6], [lx + 11, ly + 6], [lx + 92, 120], [lx - 92, 120]], lg(c, 0, ly, 0, 120, [[0, wa(0.55)], [1, wa(0.1)]]));
  board(c, { cx: 96, yt: 64, yb: 110, wt: 82, wb: 156, light: (x, y) => Math.max(0.1, 1 - Math.hypot(x - lx, (y - 92) * 1.5) / 88) });
  c.fillStyle = g(20); c.fillRect(0, 110, W, 10);
  const k = (96 - lx) * 0.045;
  shadow(c, "king", 70, 78, 16, k + 0.3); piece(c, "king", 70, 78, 16, g(110));
  shadow(c, "pawn", 112, 90, 24, k - 0.2); piece(c, "pawn", 112, 90, 24, shade(c, 112, 24));
  c.fillStyle = rg(c, lx, ly + 6, 2, 70, [[0, wa(0.7)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  c.strokeStyle = g(140); c.lineWidth = 1.2; c.beginPath(); c.moveTo(96, 0); c.lineTo(lx, ly - 10); c.stroke();
  poly(c, [[lx - 10, ly - 10], [lx + 10, ly - 10], [lx + 24, ly + 6], [lx - 24, ly + 6]], g(225));
  c.beginPath(); c.ellipse(lx, ly + 6, 13, 3.4, 0, 0, 7); c.fillStyle = g(255); c.fill();
  vignette(c, 0.75);
}

export function pawn(c: Ctx, t: number): void {
  const e = ease(t);
  c.fillStyle = lg(c, 0, 0, 0, H, [[0, g(12)], [1, g(90)]]); c.fillRect(0, 0, W, H);
  c.fillStyle = rg(c, 38, 0, 4, 130, [[0, wa(0.55)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  board(c, { cx: 96, yt: 70, yb: 120, wt: 120, wb: 260, light: (x, y) => Math.max(0.14, 1 - Math.hypot(x - 60, (y - 60) * 1.2) / 150) });
  piece(c, "pawn", 150, 82, 30, g(70)); piece(c, "pawn", 40, 82, 30, g(85));
  const y = lerp(84, 108, e), s = lerp(40, 82, e), x = lerp(104, 96, e), lift = Math.sin(e * Math.PI) * 8;
  shadow(c, "pawn", x, y, s, 1.15); piece(c, "pawn", x, y - lift, s, shade(c, x, s));
  vignette(c, 0.6);
}

export function knight(c: Ctx, t: number): void {
  const e = ease(t), fall = e < 0.82 ? e / 0.82 : 1, bounce = e > 0.82 ? Math.sin((e - 0.82) / 0.18 * Math.PI) * 0.08 : 0;
  const rot = -1.38 * Math.pow(fall, 2.2) + bounce;
  c.fillStyle = g(8); c.fillRect(0, 0, W, H);
  c.fillStyle = rg(c, 100, 30, 2, 120, [[0, wa(0.6)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  board(c, { cx: 96, yt: 66, yb: 120, wt: 130, wb: 270, light: (x, y) => Math.max(0.1, 0.8 - Math.hypot(x - 100, (y - 85) * 1.3) / 120) });
  piece(c, "pawn", 34, 84, 40, g(80)); piece(c, "pawn", 160, 80, 34, g(70));
  c.save(); c.translate(108, 106);
  c.save(); c.transform(1, 0, -1.1 * (1 - fall) + 0.1, 0.22 + fall * 0.1, 0, 0); c.rotate(rot * 0.5); piece(c, "knight", 0, 0, 70, "#050505"); c.restore();
  c.rotate(rot); piece(c, "knight", 0, 0, 72, lg(c, -30, 0, 30, 0, [[0, "#fff"], [0.5, "#bdbdbd"], [1, "#3a3a3a"]]));
  c.restore(); vignette(c, 0.65);
}

export function queen(c: Ctx, t: number, tm: number): void {
  const e = ease(t), x = lerp(-26, 64, e), pulse = 0.75 + 0.25 * Math.sin(tm * 2.4);
  c.fillStyle = g(6); c.fillRect(0, 0, W, H);
  board(c, { cx: 110, yt: 56, yb: 120, wt: 150, wb: 270, light: () => 0.5 });
  c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(0, 0, W, H);
  const a = Math.max(0, (e - 0.35) / 0.65) * pulse;
  c.globalCompositeOperation = "lighter";
  poly(c, [[x, 34], [192, 48], [192, 70]], wa(0.36 * a)); poly(c, [[x, 40], [192, 82], [192, 104]], wa(0.24 * a)); poly(c, [[x, 46], [192, 112], [192, 124]], wa(0.15 * a));
  c.globalCompositeOperation = "source-over";
  piece(c, "king", 158 + Math.max(0, e - 0.6) * 20, 100, 44, g(lerp(90, 55, e)));
  shadow(c, "queen", x, 116, 100, 0.8); piece(c, "queen", x, 116, 100, shade(c, x, 100));
  vignette(c, 0.55);
}

export function king(c: Ctx, t: number): void {
  const e = ease(t);
  c.fillStyle = g(6); c.fillRect(0, 0, W, H);
  board(c, { cx: 96, yt: 56, yb: 120, wt: 130, wb: 250, light: (x, y) => Math.max(0.08, 0.9 - Math.hypot(x - 96, (y - 96) * 1.4) / 84) });
  c.fillStyle = rg(c, 96, 0, 10, 120, [[0, wa(0.4)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  const y = lerp(112, 88, e), s = lerp(92, 62, e), lift = Math.sin(e * Math.PI) * 10;
  shadow(c, "king", 96, y, s, 0.7); piece(c, "king", 96, y - lift, s, shade(c, 96, s));
  c.globalAlpha = 0.28 * e; piece(c, "king", 96, 112, 92, g(235)); c.globalAlpha = 1;
  vignette(c, 0.65);
}
