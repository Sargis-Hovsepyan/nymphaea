// Vector scenes (320×200 SVG). Each scene acts out one story beat:
//   build(id) → SVG markup whose shapes carry a ROLE class (pool, edge, board, far, key, lit, beam, line, fig, bg2)
//   update(a, t, tm, p?) → moves the few parts that matter. t = the beat (0..1, from scroll), tm = seconds,
//   p = seconds since the picture began to play what happens (composed scenes; none means its still).
// The style (Ink / Cut paper / Glow) is pure CSS on those roles, so one scene serves every look.
import { ease, lerp } from "../scenes/helpers";
import { MORE } from "./more";
import { KING, KNIGHT, PAWN, P, QUEEN, beamFill, board, boardSvg, circle, defs, ellipse, f, figure, grain, pool, rect, seg, type Pt } from "./shapes";

export interface VApi {
  a(key: string): SVGElement;
  light(v: number): void;
}
export interface VScene {
  build(id: string): string;
  update(a: VApi, t: number, tm: number, p?: number): void;
}

const tf = (el: SVGElement, v: string) => el.setAttribute("transform", v);
const piece = (cls: string, d: string, key = "", transform = "") =>
  '<path class="s ' + cls + '"' + (key ? ' data-a="' + key + '"' : "") + (transform ? ' transform="' + transform + '"' : "") + ' d="' + d + '"/>';

function walk(a: VApi, key: string, x: number, y: number, s: number, step: number): void {
  tf(a.a(key), "translate(" + f(x) + "," + f(y) + ") scale(" + f(s) + ")");
  tf(a.a(key + "1"), "rotate(" + f(step) + " -5 -46)");
  tf(a.a(key + "2"), "rotate(" + f(-step) + " 5 -46)");
}

const B1 = board(160, 118, 198, 150, 320), B2 = board(160, 128, 198, 140, 300);

// deterministic pseudo-random for layouts
function rnd(i: number): number { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

const STARS = Array.from({ length: 40 }, (_, i) => circle(rnd(i) * 320, rnd(i + 99) * 120, i % 7 ? 0.7 : 1.3)).join(" ");

const BACK = Array.from({ length: 22 }, (_, i) => ({ w: 14 + rnd(i) * 16, h: 50 + rnd(i + 7) * 70 }));
const FRONT = Array.from({ length: 18 }, (_, i) => ({ w: 16 + rnd(i + 40) * 20, h: 34 + rnd(i + 50) * 56 }));
function skyline(list: { w: number; h: number }[], gap: number): { d: string; boxes: [number, number, number, number][] } {
  let x = -10, d = "";
  const boxes: [number, number, number, number][] = [];
  list.forEach((b) => { d += rect(x, 200 - b.h, b.w, b.h) + " "; boxes.push([x, 200 - b.h, b.w, b.h]); x += b.w + gap; });
  return { d, boxes };
}
const SKY_B = skyline(BACK, 1), SKY_F = skyline(FRONT, 4);
const WINDOWS: { x: number; y: number; r: number }[] = [];
SKY_F.boxes.forEach(([x, y, w, h], bi) => {
  for (let wy = y + 6; wy < 196; wy += 9) for (let wx = x + 4; wx < x + w - 5; wx += 7) WINDOWS.push({ x: wx, y: wy, r: rnd(bi * 31 + wx * 7 + wy) });
});

function trees(layer: number): string {
  const n = [9, 7, 5][layer], w = [10, 18, 30][layer], h = [120, 150, 190][layer];
  let d = "";
  for (let k = 0; k < n; k++) {
    const x = ((k * 53 + layer * 29) % 360) - 20;
    d += rect(x + w * 0.42, 200 - h * 0.45, w * 0.16, h * 0.45) + " " + P([[x - w * 0.4, 200 - h * 0.35], [x + w / 2, 200 - h], [x + w * 1.4, 200 - h * 0.35]]) + " ";
  }
  return d;
}
const TREES = [trees(0), trees(1), trees(2)];

const PETAL = "M0,0 Q11,-24 0,-46 Q-11,-24 0,0 Z", PETAL_S = "M0,0 Q10,-20 0,-37 Q-10,-20 0,0 Z";

export const VSCENES: Record<string, VScene> = {
  lamp: {
    build: (id) => defs(id)
      + '<path class="s beam" data-a="cone" ' + beamFill(id) + ' d="M0,0 Z"/>'
      + boardSvg(B2)
      + piece("far", KING, "", "translate(118,170) scale(1.1)") + piece("key", PAWN, "", "translate(200,184) scale(1.3)")
      + '<g data-a="lamp"><path class="s line" d="M0,-4 V36"/><path class="s far" d="M-13,36 H13 L28,56 H-28 Z"/><path class="s lit" d="' + ellipse(0, 56, 15, 3.6) + '"/></g>'
      + grain(id),
    update(a, t, tm) {
      const e = ease(t), ang = 16 * (1 - e) * Math.cos(e * 9) + Math.sin(tm * 0.8) * 1.2, r = ang * Math.PI / 180;
      tf(a.a("lamp"), "translate(160,0) rotate(" + f(ang) + ")");
      const bx = 160 - 56 * Math.sin(r), by = 56 * Math.cos(r);
      a.a("cone").setAttribute("d", P([[bx - 14, by], [bx + 14, by], [bx + 120, 200], [bx - 120, 200]]));
      a.light(lerp(0.15, 1, ease(seg(t, 0, 0.7))));
    },
  },

  pawn: {
    build: (id) => defs(id) + pool(id, 90, 40, 160) + boardSvg(B1)
      + piece("far", PAWN, "", "translate(84,150) scale(.85)") + piece("far", PAWN, "", "translate(246,150) scale(.85)")
      + piece("key", PAWN, "p") + grain(id),
    update(a, t) {
      const e = ease(t), lift = Math.sin(e * Math.PI) * 10;
      tf(a.a("p"), "translate(" + f(lerp(178, 160, e)) + "," + f(lerp(150, 192, e) - lift) + ") scale(" + f(lerp(0.85, 1.7, e)) + ")");
      a.light(lerp(0.4, 1, e));
    },
  },

  knight: {
    build: (id) => defs(id) + pool(id, 190, 70, 150) + boardSvg(B1)
      + piece("far", PAWN, "", "translate(92,162) scale(1.05)") + piece("far", PAWN, "", "translate(118,138) scale(.7)")
      + piece("key", KNIGHT, "k") + grain(id),
    update(a, t) {
      const e = ease(seg(t, 0.3, 0.9)), b = t > 0.9 ? Math.sin(seg(t, 0.9, 1) * Math.PI) * 5 : 0;
      tf(a.a("k"), "translate(" + f(168 + e * 18) + ",178) scale(1.45) rotate(" + f(84 * e * e - b) + ")");
      a.light(lerp(0.35, 1, ease(seg(t, 0, 0.5))));
    },
  },

  queen: {
    build: (id) => defs(id) + boardSvg(B1)
      + [1, 2, 3].map((i) => '<path class="s beam" data-a="b' + i + '" ' + beamFill(id) + ' d="M0,0 Z"/>').join("")
      + piece("far", KING, "kg") + piece("key", QUEEN, "q") + grain(id),
    update(a, t, tm) {
      const e = ease(t), x = lerp(-20, 100, e), pulse = 0.8 + 0.2 * Math.sin(tm * 2.4);
      tf(a.a("q"), "translate(" + f(x) + ",192) scale(1.6)");
      tf(a.a("kg"), "translate(" + f(250 + Math.max(0, e - 0.6) * 40) + ",168) scale(1.05)");
      [1, 2, 3].forEach((i) => a.a("b" + i).setAttribute("d", P([[x + 4, 112 + i * 4], [320, 70 + i * 34], [320, 92 + i * 34]])));
      a.light(Math.max(0, (e - 0.35) / 0.65) * pulse);
    },
  },

  king: {
    build: (id) => defs(id) + pool(id, 160, 0, 170) + boardSvg(B1)
      + piece("far", KING, "gh", "translate(160,198) scale(1.9)") + piece("key", KING, "k") + grain(id),
    update(a, t) {
      const e = ease(t), lift = Math.sin(e * Math.PI) * 12;
      tf(a.a("k"), "translate(160," + f(lerp(198, 166, e) - lift) + ") scale(" + f(lerp(1.9, 1.2, e)) + ")");
      (a.a("gh") as SVGElement).style.opacity = f(0.3 * e);
      a.light(lerp(0.4, 1, e));
    },
  },

  door: {
    build: (id) => defs(id)
      + '<path class="s beam" ' + beamFill(id) + ' d="M136,150 L184,150 L262,200 L58,200 Z"/>'
      + '<path class="s line" d="M0,150 H320 M136,150 L40,200 M184,150 L280,200"/>'
      + '<path class="s lit" d="M136,34 H184 V150 H136 Z"/>'
      + figure("w") + grain(id),
    update(a, t) {
      const e = ease(seg(t, 0.12, 1));
      walk(a, "w", 160, lerp(214, 151, e), lerp(1.3, 0.42, e), Math.sin(e * 16) * 13);
      (a.a("w") as SVGElement).style.opacity = t > 0.9 ? f(1 - seg(t, 0.9, 1)) : "1";
      a.light(lerp(0.45, 1, e));
    },
  },

  rain: {
    build: (id) => defs(id) + pool(id, 160, 80, 120)
      + '<path class="s edge" d="' + rect(90, 20, 140, 120) + '"/>'
      + '<path class="s bg2" d="' + rect(98, 28, 124, 104) + '"/>'
      + '<path class="s lit" d="' + [circle(120, 120, 1.6), circle(150, 112, 1.3), circle(196, 118, 1.8), circle(208, 104, 1.2)].join(" ") + '"/>'
      + '<path class="s line" data-a="rain" d="M0,0"/>'
      + '<path class="s far" d="M158,28 H162 V132 H158 Z M98,78 H222 V82 H98 Z"/>'
      + '<path class="s edge" d="' + rect(80, 140, 160, 8) + '"/>' + grain(id),
    update(a, t, tm) {
      const e = ease(t), n = 8 + Math.round(18 * e);
      let d = "";
      for (let i = 0; i < n; i++) {
        const x = 102 + (i * 53.3) % 116, y = 30 + ((i * 29.7) + tm * 60) % 92;
        d += "M" + f(x) + "," + f(y) + " l-3,9 ";
      }
      a.a("rain").setAttribute("d", d);
      a.light(lerp(0.3, 1, e));
    },
  },

  sea: {
    build: (id) => defs(id)
      + '<path class="s beam" data-a="ref" ' + beamFill(id) + ' d="M0,0 Z"/>'
      + '<path class="s lit" data-a="m" d="' + circle(0, 0, 11) + '"/>'
      + '<path class="s line" d="M0,110 H320"/>'
      + '<path class="s line" data-a="w" d="M0,0"/>'
      + '<g data-a="bt"><path class="s fig" d="M-14,0 L14,0 L9,6 L-9,6 Z M0,-16 L0,-1 L11,-1 Z"/></g>' + grain(id),
    update(a, t, tm) {
      const e = ease(t), mx = lerp(80, 220, e), my = lerp(100, 42, e);
      tf(a.a("m"), "translate(" + f(mx) + "," + f(my) + ")");
      a.a("ref").setAttribute("d", P([[mx - 6, 111], [mx + 6, 111], [mx + 28, 200], [mx - 28, 200]]));
      let d = "";
      for (let row = 0; row < 4; row++) {
        const y = 128 + row * 20, amp = 1.5 + row;
        d += "M0," + f(y);
        for (let x = 16; x <= 320; x += 16) d += " L" + x + "," + f(y + Math.sin(x * 0.05 + tm * (1 + row * 0.3) + row) * amp);
        d += " ";
      }
      a.a("w").setAttribute("d", d);
      tf(a.a("bt"), "translate(" + f(lerp(40, 110, e)) + ",108)");
      a.light(lerp(0.3, 1, e));
    },
  },

  moon: {
    build: (id) => defs(id) + pool(id, 230, 60, 70, "h")
      + '<path class="s far" d="' + STARS + '"/>'
      + '<path class="s lit" data-a="m" d="' + circle(0, 0, 16) + '"/>'
      + '<path class="s bg2" d="M0,150 L60,122 L130,140 L200,112 L320,135 V200 H0 Z"/>'
      + '<path class="s edge" d="M0,172 L90,150 L170,168 L250,148 L320,160 V200 H0 Z"/>' + grain(id),
    update(a, t) {
      const e = ease(t), my = lerp(170, 55, e);
      tf(a.a("m"), "translate(230," + f(my) + ")");
      a.a("h").setAttribute("cy", f(my));
      a.light(e);
    },
  },

  city: {
    build: (id) => defs(id) + pool(id, 230, 200, 160)
      + '<g data-a="b"><path class="s bg2" d="' + SKY_B.d + '"/></g>'
      + '<g data-a="fr"><path class="s far" d="' + SKY_F.d + '"/><path class="s lit" data-a="win" d="M0,0"/></g>' + grain(id),
    update(a, t) {
      const e = ease(t);
      tf(a.a("b"), "translate(" + f(lerp(0, -20, e)) + ",0)");
      tf(a.a("fr"), "translate(" + f(lerp(0, -44, e)) + ",0)");
      const lit = 0.1 + 0.55 * e;
      a.a("win").setAttribute("d", WINDOWS.filter((w) => w.r < lit).map((w) => rect(w.x, w.y, 2.5, 3.5)).join(" ") || "M0,0");
      a.light(lerp(0.3, 1, e));
    },
  },

  forest: {
    build: (id) => defs(id)
      + [0, 1, 2].map((k) => '<path class="s beam" data-a="sh' + k + '" ' + beamFill(id) + ' d="M0,0 Z"/>').join("")
      + '<g data-a="L0"><path class="s bg2" d="' + TREES[0] + '"/></g>'
      + '<g data-a="L1"><path class="s far" d="' + TREES[1] + '"/></g>'
      + '<g data-a="L2"><path class="s fig" d="' + TREES[2] + '"/></g>' + grain(id),
    update(a, t, tm) {
      const e = ease(t);
      [-6, -16, -34].forEach((drift, L) => tf(a.a("L" + L), "translate(" + f((t - 0.5) * drift) + ",0)"));
      [0, 1, 2].forEach((k) => { const sx = 80 + k * 60 + Math.sin(tm * 0.3 + k) * 6; a.a("sh" + k).setAttribute("d", P([[sx, 0], [sx + 14, 0], [sx + 54, 200], [sx + 20, 200]])); });
      a.light(lerp(0.3, 1, e));
    },
  },

  candle: {
    build: (id) => defs(id) + pool(id, 160, 110, 150)
      + '<path class="s edge" d="' + rect(0, 172, 320, 28) + '"/>'
      + '<path class="s far" d="' + rect(148, 120, 24, 52) + '"/>'
      + '<path class="s line" d="M160,114 V120"/>'
      + '<path class="s lit" data-a="fl" d="M0,0"/>' + grain(id),
    update(a, t, tm) {
      const e = ease(t), fh = lerp(10, 26, e) * (1 + 0.12 * Math.sin(tm * 9) + 0.07 * Math.sin(tm * 23)), sw = Math.sin(tm * 3) * 2;
      a.a("fl").setAttribute("d", "M160,116 C153,111 " + f(155 + sw * 0.5) + "," + f(116 - fh * 0.5) + " " + f(160 + sw) + "," + f(116 - fh) + " C" + f(165 + sw * 0.5) + "," + f(116 - fh * 0.5) + " 167,111 160,116 Z");
      a.light(lerp(0.3, 1, e));
    },
  },

  road: {
    build: (id) => defs(id) + pool(id, 160, 95, 170)
      + '<path class="s line" d="M0,95 H320"/>'
      + '<path class="s edge" d="M156,95 L164,95 L280,200 L40,200 Z"/>'
      + '<path class="s lit" data-a="ds" d="M0,0"/>'
      + figure("w") + grain(id),
    update(a, t, tm) {
      const e = ease(t);
      let d = "";
      for (let k = 0; k < 7; k++) {
        const s = ((k / 7) + tm * 0.12) % 1, y = 95 + 105 * s * s, w = 0.6 + s * 4, len = 2 + s * 12;
        d += rect(160 - w / 2, y, w, len) + " ";
      }
      a.a("ds").setAttribute("d", d);
      walk(a, "w", lerp(176, 161, e), lerp(205, 112, e), lerp(1.3, 0.16, e), Math.sin(tm * 6) * 12);
      a.light(lerp(0.3, 1, e));
    },
  },

  lotus: {
    build: (id) => defs(id) + pool(id, 160, 110, 120)
      + '<path class="s line" d="M0,132 H320"/>'
      + '<path class="s line" data-a="rp" d="M0,0"/>'
      + '<path class="s far" d="' + [ellipse(84, 146, 34, 7), ellipse(246, 156, 40, 8), ellipse(206, 140, 20, 4.5)].join(" ") + '"/>'
      + Array.from({ length: 7 }, (_, i) => '<path class="s far" data-a="bk' + i + '" d="' + PETAL + '"/>').join("")
      + Array.from({ length: 5 }, (_, i) => '<path class="s key" data-a="fr' + i + '" d="' + PETAL_S + '"/>').join("")
      + grain(id),
    update(a, t, tm) {
      const e = ease(t), spread = lerp(0.12, 1.3, e) * 180 / Math.PI;
      for (let i = 0; i < 7; i++) tf(a.a("bk" + i), "translate(160,130) rotate(" + f((i / 6 - 0.5) * spread * 2) + ")");
      for (let i = 0; i < 5; i++) tf(a.a("fr" + i), "translate(160,133) rotate(" + f((i / 4 - 0.5) * spread * 1.5) + ")");
      let d = "";
      for (let k = 0; k < 2; k++) { const r = (tm * 0.18 + k / 2) % 1; d += ellipse(160, 136, 14 + r * 110, 2 + r * 10) + " "; }
      a.a("rp").setAttribute("d", d);
      a.light(lerp(0.2, 1, e));
    },
  },

  ...MORE,
};

export type { Pt };
