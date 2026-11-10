// Twelve everyday scenes, so books that aren't about chess or the sea still get pictures that act
// out their moments: window, stairs, letter, train, bird, mountain, house, bridge, field, cup,
// clock, book. Same contract as vscenes/index.ts: role classes in build(), a few parts moved in
// update(a, t, tm). Every canvas style draws them too, through vscenes/model.ts.
import { clamp, ease, lerp } from "../scenes/helpers";
import { P, beamFill, circle, defs, ellipse, f, figure, grain, pool, rect, seg, type Pt } from "./shapes";
import type { VScene, VApi } from "./index";

const tf = (el: SVGElement, v: string) => el.setAttribute("transform", v);
const path = (cls: string, d: string, key = "") => '<path class="s ' + cls + '"' + (key ? ' data-a="' + key + '"' : "") + ' d="' + d + '"/>';
const op = (a: VApi, k: string, v: number) => { (a.a(k) as SVGElement).style.opacity = f(clamp(v)); };

function walk(a: VApi, key: string, x: number, y: number, s: number, step: number): void {
  tf(a.a(key), "translate(" + f(x) + "," + f(y) + ") scale(" + f(s) + ")");
  tf(a.a(key + "1"), "rotate(" + f(step) + " -5 -46)");
  tf(a.a(key + "2"), "rotate(" + f(-step) + " 5 -46)");
}

function rnd(i: number): number { const x = Math.sin(i * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); }

const STEPS = (() => {
  let d = "M30,200 L30,188";
  for (let k = 0; k < 9; k++) { const x = 30 + k * 30, y = 188 - k * 17; d += " L" + (x + 30) + "," + y + " L" + (x + 30) + "," + (y - 17); }
  return d + " L300,200 Z";
})();

const HILLS = "M0,150 L50,128 L110,142 L170,118 L240,138 L320,122 V200 H0 Z";
const PEAKS_FAR = "M0,160 L60,96 L100,128 L150,70 L200,120 L250,88 L320,140 V200 H0 Z";
const PEAKS_NEAR = "M0,180 L70,132 L120,160 L190,118 L260,162 L320,140 V200 H0 Z";

const PAGE_LINES = (x0: number) => Array.from({ length: 7 }, (_, i) => "M" + (x0 + 14) + "," + (82 + i * 12) + " H" + (x0 + 106 - (i === 6 ? 40 : 0))).join(" ");

export const MORE: Record<string, VScene> = {
  window: {
    build: (id) => defs(id) + pool(id, 160, 95, 130)
      + path("edge", rect(96, 24, 128, 140)) + path("bg2", rect(104, 32, 112, 124))
      + path("lit", circle(0, 0, 9), "m")
      + path("far", "M158,32 H162 V156 H158 Z M104,90 H216 V94 H104 Z")
      + path("far", "M0,0", "cur")
      + path("edge", rect(86, 164, 148, 7)) + grain(id),
    update(a, t, tm) {
      const e = ease(t);
      tf(a.a("m"), "translate(" + f(lerp(196, 186, e)) + "," + f(lerp(150, 60, e)) + ")");
      const pts: Pt[] = [[104, 30]];
      for (let y = 30; y <= 160; y += 10) pts.push([104 + 18 + 18 * e + Math.sin(y * 0.06 + tm * 1.3) * 5 * (0.3 + e), y]);
      pts.push([104, 160]);
      a.a("cur").setAttribute("d", P(pts));
      a.light(lerp(0.25, 1, e));
    },
  },

  stairs: {
    build: (id) => defs(id) + pool(id, 290, 20, 150)
      + path("lit", "M272,0 H306 V34 H272 Z")
      + path("edge", STEPS) + path("line", "M30,188 L300,35")
      + figure("w") + grain(id),
    update(a, t, tm) {
      const e = ease(seg(t, 0.05, 1)), x = lerp(52, 262, e), y = 188 - (x - 30) / 30 * 17;
      walk(a, "w", x, y, lerp(0.62, 0.42, e), Math.sin(e * 22 + tm * 0.5) * 16);
      a.light(lerp(0.3, 1, e));
    },
  },

  letter: {
    build: (id) => defs(id) + pool(id, 160, 100, 140)
      + path("far", rect(100, 100, 120, 70))
      + path("bg2", "M0,0", "flap")
      + '<g data-a="lt">' + path("lit", rect(110, 0, 100, 66)) + path("line", "M122,14 H198 M122,26 H198 M122,38 H198 M122,50 H170") + "</g>"
      + path("edge", "M100,100 L160,140 L220,100 V170 H100 Z")
      + path("line", "M100,170 L152,132 M220,170 L168,132") + grain(id),
    update(a, t) {
      const open = ease(seg(t, 0, 0.45)), rise = ease(seg(t, 0.35, 1));
      a.a("flap").setAttribute("d", P([[100, 100], [220, 100], [160, lerp(142, 52, open)]]));
      tf(a.a("lt"), "translate(0," + f(lerp(106, 26, rise)) + ")");
      a.light(lerp(0.3, 1, rise));
    },
  },

  train: {
    build: (id) => defs(id)
      + path("lit", circle(250, 46, 12)) + path("bg2", HILLS)
      + path("line", "M0,172 H320 M0,178 H320")
      + '<g data-a="tr">'
      + path("far", rect(0, 128, 64, 40) + " " + rect(40, 108, 26, 22) + " " + rect(10, 112, 12, 16))
      + path("far", rect(70, 132, 74, 36) + " " + rect(150, 132, 74, 36))
      + path("lit", [80, 98, 116, 160, 178, 196].map((x) => rect(x, 140, 12, 10)).join(" ") + " " + rect(46, 114, 14, 10))
      + path("fig", [12, 34, 54, 84, 128, 164, 208].map((x) => circle(x, 170, 6)).join(" "))
      + path("bg2", "M0,0", "sm") + "</g>"
      + grain(id),
    update(a, t, tm) {
      const e = ease(t), x = lerp(-230, 110, e);
      tf(a.a("tr"), "translate(" + f(x) + ",0)");
      let d = "";
      for (let k = 0; k < 4; k++) { const r = (tm * 0.6 + k / 4) % 1; d += circle(16 - r * 40, 104 - r * 34, 4 + r * 9) + " "; }
      a.a("sm").setAttribute("d", d);
      a.light(lerp(0.3, 1, e));
    },
  },

  bird: {
    build: (id) => defs(id) + pool(id, 230, 60, 120)
      + path("lit", circle(236, 58, 15)) + path("bg2", HILLS)
      + path("line", [40, 70, 280].map((x, i) => "M" + x + "," + (40 + i * 9) + " l5,3 l5,-3").join(" "))
      + '<g data-a="b">' + path("key", "M0,0", "wg") + path("key", ellipse(0, 1, 7, 2.6)) + "</g>" + grain(id),
    update(a, t, tm) {
      const e = ease(t), x = lerp(-10, 250, e), y = lerp(150, 70, e) + Math.sin(e * 6) * 8;
      const w = Math.sin(tm * 9) * 10;
      a.a("wg").setAttribute("d", "M0,0 L-18," + f(-w) + " L-6,2 Z M0,0 L18," + f(-w) + " L6,2 Z");
      tf(a.a("b"), "translate(" + f(x) + "," + f(y) + ") scale(" + f(lerp(0.9, 1.6, e)) + ")");
      a.light(lerp(0.3, 1, e));
    },
  },

  mountain: {
    build: (id) => defs(id) + pool(id, 160, 120, 150, "h")
      + [0, 1, 2, 3, 4].map((k) => '<path class="s beam" data-a="r' + k + '" ' + beamFill(id) + ' d="M0,0 Z"/>').join("")
      + path("lit", circle(0, 0, 18), "sun")
      + path("bg2", PEAKS_FAR) + path("edge", PEAKS_NEAR) + grain(id),
    update(a, t, tm) {
      const e = ease(t), sy = lerp(170, 64, e);
      tf(a.a("sun"), "translate(160," + f(sy) + ")");
      a.a("h").setAttribute("cy", f(sy));
      for (let k = 0; k < 5; k++) {
        const ang = (-0.9 + k * 0.45) + Math.sin(tm * 0.2 + k) * 0.03, c = Math.cos(ang - Math.PI / 2), s = Math.sin(ang - Math.PI / 2);
        a.a("r" + k).setAttribute("d", P([[160 + c * 22 - s * 3, sy + s * 22 + c * 3], [160 + c * 22 + s * 3, sy + s * 22 - c * 3], [160 + c * 160 + s * 18, sy + s * 160 - c * 18], [160 + c * 160 - s * 18, sy + s * 160 + c * 18]]));
      }
      a.light(e);
    },
  },

  house: {
    build: (id) => defs(id) + pool(id, 160, 120, 150)
      + path("lit", circle(64, 40, 10)) + path("line", "M0,176 H320")
      + path("far", rect(100, 98, 120, 78) + " " + rect(186, 52, 14, 34))
      + path("edge", "M90,100 L160,48 L230,100 Z")
      + path("bg2", rect(148, 140, 24, 36))
      + [[112, 112], [196, 112], [112, 146], [196, 146]].map(([x, y], i) => '<path class="s lit" data-a="w' + i + '" d="' + rect(x, y - 6, 16, 14) + '"/>').join("")
      + path("line", "M0,0", "sm") + grain(id),
    update(a, t, tm) {
      const e = ease(t);
      [0.15, 0.4, 0.6, 0.85].forEach((th, i) => op(a, "w" + i, e > th ? 1 : 0.08));
      let d = "M193,52";
      for (let k = 1; k <= 6; k++) d += " L" + f(193 + Math.sin(tm * 1.5 + k) * 3 + k * 2) + "," + f(52 - k * 7);
      a.a("sm").setAttribute("d", d);
      a.light(lerp(0.25, 1, e));
    },
  },

  bridge: {
    build: (id) => defs(id) + pool(id, 160, 120, 150)
      + path("lit", circle(250, 40, 11))
      + path("far", "M0,110 H320 V118 H0 Z M60,118 Q160,40 260,118 L248,118 Q160,58 72,118 Z")
      + path("line", "M0,132 H320")
      + '<g data-a="rf">' + path("bg2", "M60,134 Q160,200 260,134 L248,134 Q160,184 72,134 Z") + "</g>"
      + path("lit", [70, 110, 150, 190, 230, 270].map((x) => circle(x, 104, 2.2)).join(" "), "lt")
      + figure("w") + grain(id),
    update(a, t, tm) {
      const e = ease(t), s = 0.92 + Math.sin(tm * 1.4) * 0.04;
      tf(a.a("rf"), "translate(0," + f(134 * (1 - s)) + ") scale(1," + f(s) + ")");
      op(a, "lt", lerp(0.2, 1, e));
      walk(a, "w", lerp(40, 280, e), 110, 0.3, Math.sin(e * 30) * 14);
      a.light(lerp(0.3, 1, e));
    },
  },

  field: {
    build: (id) => defs(id) + pool(id, 160, 90, 160)
      + path("lit", circle(0, 0, 16), "sun")
      + path("bg2", "M0,140 Q160,118 320,140 V200 H0 Z")
      + path("far", rect(246, 104, 6, 34) + " " + circle(249, 98, 16))
      + path("line", "M0,0", "gr") + grain(id),
    update(a, t, tm) {
      const e = ease(t);
      tf(a.a("sun"), "translate(" + f(lerp(80, 120, e)) + "," + f(lerp(150, 60, e)) + ")");
      let d = "";
      for (let k = 0; k < 46; k++) {
        const x = 4 + k * 7 + rnd(k) * 4, h = 26 + rnd(k + 9) * 26, sw = Math.sin(tm * 1.7 + x * 0.04) * (4 + 6 * e);
        d += "M" + f(x) + ",200 Q" + f(x + sw * 0.4) + "," + f(200 - h * 0.6) + " " + f(x + sw) + "," + f(200 - h) + " ";
      }
      a.a("gr").setAttribute("d", d);
      a.light(lerp(0.3, 1, e));
    },
  },

  cup: {
    build: (id) => defs(id) + pool(id, 160, 110, 140)
      + path("edge", rect(0, 168, 320, 32))
      + path("bg2", ellipse(160, 168, 64, 9))
      + path("far", "M122,108 H198 L190,160 Q160,172 130,160 Z")
      + path("line", "M198,118 C224,118 224,148 192,150")
      + path("lit", ellipse(160, 108, 38, 5))
      + [0, 1, 2].map((k) => path("line", "M0,0", "st" + k)).join("") + grain(id),
    update(a, t, tm) {
      const e = ease(t), h = lerp(10, 60, e);
      for (let k = 0; k < 3; k++) {
        const x0 = 144 + k * 16;
        let d = "M" + x0 + ",100";
        for (let j = 1; j <= 6; j++) d += " L" + f(x0 + Math.sin(tm * 2 + j * 0.9 + k * 2) * 4) + "," + f(100 - (h * j) / 6);
        a.a("st" + k).setAttribute("d", d);
      }
      a.light(lerp(0.3, 1, e));
    },
  },

  clock: {
    build: (id) => defs(id) + pool(id, 160, 100, 120)
      + path("edge", circle(160, 100, 72)) + path("lit", circle(160, 100, 64))
      + path("far", Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, r1 = i % 3 ? 56 : 50; return "M" + f(160 + Math.sin(a) * r1) + "," + f(100 - Math.cos(a) * r1) + " L" + f(160 + Math.sin(a) * 60) + "," + f(100 - Math.cos(a) * 60) + " L" + f(160 + Math.sin(a + 0.02) * 60) + "," + f(100 - Math.cos(a + 0.02) * 60) + " Z"; }).join(" "))
      + '<g data-a="hr">' + path("fig", "M-3,4 L3,4 L1.5,-34 L-1.5,-34 Z") + "</g>"
      + '<g data-a="mn">' + path("key", "M-2,6 L2,6 L1,-52 L-1,-52 Z") + "</g>"
      + path("fig", circle(160, 100, 4)) + grain(id),
    update(a, t, tm) {
      const e = ease(t), m = lerp(0, 330, e) + Math.sin(tm) * 0.5;
      tf(a.a("mn"), "translate(160,100) rotate(" + f(m) + ")");
      tf(a.a("hr"), "translate(160,100) rotate(" + f(300 + m / 12) + ")");
      a.light(lerp(0.4, 1, e));
    },
  },

  book: {
    build: (id) => defs(id) + pool(id, 160, 100, 150)
      + path("edge", "M28,64 L160,74 L292,64 L292,168 L160,178 L28,168 Z")
      + path("lit", "M36,58 L160,68 V172 L36,162 Z M284,58 L160,68 V172 L284,162 Z")
      + path("line", PAGE_LINES(36) + " " + PAGE_LINES(170))
      + path("far", "M0,0", "pg")
      + path("line", "M160,68 V172") + grain(id),
    update(a, t, tm) {
      const p = (tm * 0.18 + t) % 1, k = ease(p), x = 160 + 124 * Math.cos(Math.PI * k), lift = Math.sin(Math.PI * k) * 14;
      a.a("pg").setAttribute("d", P([[160, 68], [x, 58 - lift], [x, 162 - lift], [160, 172]]));
      a.light(lerp(0.35, 1, ease(t)));
    },
  },
};
