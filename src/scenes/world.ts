// Places and weather. Each: t = scroll progress into view (0..1), tm = seconds.
import { H, W, circ, ease, g, hash, lerp, lg, person, poly, rg, vignette, wa, type Ctx } from "./helpers";

export function door(c: Ctx, t: number): void {
  const e = ease(t), glow = lerp(0.25, 0.7, e);
  c.fillStyle = g(10); c.fillRect(0, 0, W, H);
  poly(c, [[72, 16], [120, 16], [120, 100], [72, 100]], g(lerp(170, 255, e)));
  c.fillStyle = rg(c, 96, 58, 24, 110, [[0, wa(glow)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  poly(c, [[72, 100], [120, 100], [184, 120], [8, 120]], lg(c, 0, 100, 0, 120, [[0, g(lerp(150, 215, e))], [1, g(60)]]));
  const base = lerp(132, 100, e), h = lerp(96, 44, e), fade = e > 0.86 ? 1 - (e - 0.86) / 0.14 : 1;
  if (fade > 0) {
    c.globalAlpha = fade;
    poly(c, [[96 - h * 0.12, base], [96 + h * 0.12, base], [96 + h * 0.9, 120], [96 - h * 0.5, 120]], "rgba(0,0,0,.55)");
    person(c, 96, base, h, t * 40, g(0));
    c.globalAlpha = 1;
  }
  poly(c, [[0, 104], [40, 104], [46, 120], [0, 120]], g(0)); c.fillStyle = g(255); c.fillRect(12, 106, 2, 2); c.fillRect(26, 108, 2, 2);
  vignette(c, 0.5);
}

export function rain(c: Ctx, t: number, tm: number): void {
  const e = ease(t), wx = 46, wy = 10, ww = 100, wh = 88;
  let i: number, x: number, y: number;
  c.fillStyle = g(8); c.fillRect(0, 0, W, H);
  c.fillStyle = lg(c, 0, wy, 0, wy + wh, [[0, g(lerp(70, 150, e))], [1, g(30)]]); c.fillRect(wx, wy, ww, wh);
  for (i = 0; i < 18; i++) { c.fillStyle = g(150 + (i % 3) * 40); c.fillRect(wx + (i * 37) % ww, wy + wh - 8 - (i * 13) % 26, 1.6, 1.6); }
  c.strokeStyle = wa(0.5); c.lineWidth = 0.8; c.beginPath();
  for (i = 0; i < 30 + ((e * 50) | 0); i++) { x = wx + (i * 53.3) % ww; y = wy + ((i * 29.7) + tm * 95) % wh; c.moveTo(x, y); c.lineTo(x - 2, Math.min(wy + wh, y + 7)); }
  c.stroke();
  for (i = 0; i < 14; i++) { x = wx + 6 + (i * 41) % (ww - 12); y = wy + ((i * 17) + tm * (5 + i % 5)) % wh; circ(c, x, y, 1.3 + (i % 3) * 0.4, wa(0.75)); }
  c.fillStyle = g(4); c.fillRect(wx + ww / 2 - 2, wy, 4, wh); c.fillRect(wx, wy + wh / 2 - 2, ww, 4);
  c.strokeStyle = g(28); c.lineWidth = 4; c.strokeRect(wx, wy, ww, wh);
  c.fillStyle = g(70); c.fillRect(wx - 8, wy + wh + 2, ww + 16, 5);
  c.fillStyle = rg(c, 96, 54, 10, 90, [[0, wa(0.12 * e)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  vignette(c, 0.7);
}

export function sea(c: Ctx, t: number, tm: number): void {
  const e = ease(t), hz = 58, mx = lerp(46, 140, e), my = lerp(52, 22, e);
  let x: number, k: number, row: number;
  c.fillStyle = lg(c, 0, 0, 0, hz, [[0, g(14)], [1, g(120)]]); c.fillRect(0, 0, W, hz);
  c.fillStyle = rg(c, mx, my, 8, 50, [[0, wa(0.4)], [1, wa(0)]]); c.fillRect(0, 0, W, hz);
  circ(c, mx, my, 8, g(250));
  c.fillStyle = g(24); c.fillRect(0, hz, W, H - hz);
  for (row = 0; row < 12; row++) {
    const y = hz + 2 + row * row * 0.36 + row * 2, amp = 0.5 + row * 0.4, sp = 1 + row * 0.12;
    c.beginPath(); c.moveTo(0, H);
    for (x = 0; x <= W; x += 3) c.lineTo(x, y + Math.sin(x * 0.08 / sp + tm * sp * 1.3 + row) * amp);
    c.lineTo(W, H); c.closePath(); c.fillStyle = g(24 + row * 7); c.fill();
  }
  for (k = 0; k < 11; k++) {
    const w = lerp(4, 30, k / 11) * (0.7 + 0.3 * Math.sin(tm * 3 + k));
    c.fillStyle = wa(0.65 - k * 0.045); c.fillRect(mx - w / 2 + Math.sin(tm * 2 + k) * 2, hz + 3 + k * 5.4, w, 1.6);
  }
  const bx = lerp(20, 70, e);
  poly(c, [[bx - 9, hz + 5], [bx + 9, hz + 5], [bx + 6, hz + 8], [bx - 6, hz + 8]], g(0)); poly(c, [[bx, hz - 9], [bx, hz + 4], [bx + 7, hz + 4]], g(0));
  vignette(c, 0.55);
}

export function moon(c: Ctx, t: number, tm: number): void {
  const e = ease(t), my = lerp(96, 34, e);
  c.fillStyle = lg(c, 0, 0, 0, H, [[0, g(4)], [1, g(46)]]); c.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const b = 0.5 + 0.5 * Math.sin(tm * 2.2 + i * 1.7), sz = i % 9 ? 1 : 1.8;
    c.fillStyle = wa(0.25 + 0.75 * b); c.fillRect((i * 71.3) % W, (i * 37.7) % 86, sz, sz);
  }
  c.fillStyle = rg(c, 124, my, 10, 64, [[0, wa(0.42)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  circ(c, 124, my, 15, g(246)); circ(c, 131, my - 5, 13, g(lerp(30, 18, e)));
  poly(c, [[0, 94], [40, 80], [84, 92], [130, 76], [192, 90], [192, 120], [0, 120]], g(16));
  poly(c, [[0, 106], [56, 96], [110, 108], [160, 98], [192, 104], [192, 120], [0, 120]], g(4));
  vignette(c, 0.55);
}

export function city(c: Ctx, t: number, tm: number): void {
  const e = ease(t), pan = lerp(0, -36, e);
  c.fillStyle = lg(c, 0, 0, 0, H, [[0, g(8)], [1, g(80)]]); c.fillRect(0, 0, W, H);
  c.fillStyle = rg(c, 150, 96, 6, 90, [[0, wa(0.3)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  for (let L = 0; L < 2; L++) {
    let x = -20 + pan * (L ? 1 : 0.45);
    for (let i = 0; i < 22; i++) {
      const bw = 9 + (i * 7 + L * 5) % 13, h = (L ? 26 : 44) + ((i * 29 + L * 17) % (L ? 40 : 44));
      c.fillStyle = g(L ? 6 : 30); c.fillRect(x, H - h, bw, h);
      if (L) {
        for (let wy = H - h + 4; wy < H - 4; wy += 5) for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
          if (hash(i * 13 + wx, wy + Math.floor(tm * 0.4 + i)) > 0.72) { c.fillStyle = g(225); c.fillRect(wx, wy, 1.6, 2); }
        }
      }
      x += bw + (L ? 2 : 1);
    }
  }
  vignette(c, 0.55);
}

export function forest(c: Ctx, t: number, tm: number): void {
  const e = ease(t);
  c.fillStyle = lg(c, 0, 0, 0, H, [[0, g(150)], [1, g(40)]]); c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "lighter";
  for (let k = 0; k < 3; k++) { const sx = 60 + k * 40 + Math.sin(tm * 0.3 + k) * 6; poly(c, [[sx, 0], [sx + 10, 0], [sx + 40, H], [sx + 14, H]], wa(0.08 + 0.06 * e)); }
  c.globalCompositeOperation = "source-over";
  const shades = [110, 60, 10], widths = [3, 6, 12], counts = [14, 9, 5], drift = [-6, -16, -34];
  for (let L = 0; L < 3; L++) {
    for (let k = 0; k < counts[L]; k++) {
      const x = ((k * 53 + L * 29) % (W + 40)) - 20 + (t - 0.5) * drift[L];
      c.fillStyle = g(shades[L]); c.fillRect(x, 0, widths[L], H);
      circ(c, x + widths[L] / 2, 6 + (k % 3) * 4, widths[L] * 2.4, g(shades[L]));
    }
    c.fillStyle = lg(c, 0, H * 0.55, 0, H, [[0, wa(0)], [1, wa(0.14)]]); c.fillRect(0, 0, W, H);
  }
  vignette(c, 0.5);
}

export function candle(c: Ctx, t: number, tm: number): void {
  const e = ease(t), fh = lerp(10, 22, e) * (1 + 0.12 * Math.sin(tm * 9) + 0.07 * Math.sin(tm * 23)), sw = Math.sin(tm * 3) * 1.6;
  c.fillStyle = g(6); c.fillRect(0, 0, W, H);
  c.fillStyle = rg(c, 96, 62, 4, 110, [[0, wa(0.55 * e + 0.15)], [1, wa(0)]]); c.fillRect(0, 0, W, H);
  c.fillStyle = g(30); c.fillRect(0, 108, W, 12);
  c.fillStyle = lg(c, 86, 0, 106, 0, [[0, g(235)], [0.6, g(170)], [1, g(70)]]); c.fillRect(87, 72, 18, 38);
  c.beginPath(); c.ellipse(96, 72, 9, 2.4, 0, 0, 7); c.fillStyle = g(245); c.fill();
  c.fillStyle = g(20); c.fillRect(95.4, 66, 1.2, 6);
  c.beginPath(); c.moveTo(96, 66); c.bezierCurveTo(90, 62, 92 + sw * 0.5, 66 - fh * 0.5, 96 + sw, 66 - fh); c.bezierCurveTo(100 + sw * 0.5, 66 - fh * 0.5, 102, 62, 96, 66);
  c.fillStyle = rg(c, 96, 62, 0, fh, [[0, "#fff"], [1, g(200)]]); c.fill();
  poly(c, [[96 - 10, 110], [96 + 10, 110], [150, 120], [42, 120]], "rgba(0,0,0,.45)");
  vignette(c, 0.6);
}

export function road(c: Ctx, t: number, tm: number): void {
  const e = ease(t), hz = 54;
  c.fillStyle = lg(c, 0, 0, 0, hz, [[0, g(20)], [1, g(lerp(110, 200, e))]]); c.fillRect(0, 0, W, hz);
  c.fillStyle = rg(c, 96, hz, 2, 60, [[0, wa(0.5 * e + 0.2)], [1, wa(0)]]); c.fillRect(0, 0, W, hz);
  c.fillStyle = g(26); c.fillRect(0, hz, W, H - hz);
  poly(c, [[94, hz], [98, hz], [160, H], [32, H]], g(60));
  for (let k = 0; k < 9; k++) {
    const s = ((k / 9) + tm * 0.12) % 1, y = hz + (H - hz) * s * s, w = 0.4 + s * 3, len = 1 + s * 9;
    c.fillStyle = g(210); c.fillRect(96 - w / 2, y, w, len);
  }
  const h = lerp(46, 9, e), base = lerp(122, hz + 10, e);
  person(c, lerp(110, 97, e), base, h, tm * 6, g(0));
  vignette(c, 0.55);
}
