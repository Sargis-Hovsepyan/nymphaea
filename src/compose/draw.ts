// Drawing a composed scene. A spec (compose/spec.ts) is laid out (compose/layout.ts) and becomes a
// 320×200 vector scene with the same contract as the hand-drawn library (vscenes/index.ts): shapes
// carry ROLE classes, parts that move carry data-a keys, and update(a, t, tm) moves them. So every
// picture style (Ink, Cut paper, Glow, Ink wash, and through vscenes/model.ts all the canvas
// styles) draws composed scenes too, and the EPUB export can save them.
//
// New roles here: sky (a gradient that is always present, coloured by the hour), haze (clouds and
// fog, in the sky's own colour), shade (shadows cast away from the light). The whole scene sits in
// a group classed t-<hour> w-<sky>, which the styles use to tint it by the hour.
//
// Layers, back to front: sky, stars, sun or moon, clouds, far land, near land, things and people
// (far first, each with its shadow), framing foreground, weather, grain.
import { clamp, ease, lerp } from "../scenes/helpers";
import { P, circle, defs, ellipse, f, grain, pool, rect, seg } from "../vscenes/shapes";
import type { VApi, VScene } from "../vscenes";
import { GROUND_SIT_DROP, figureSvg, poseFrame } from "./figure";
import { SIZE, effectiveShot, layout, type Item } from "./layout";
import { fbm, rng, smooth, type Rng } from "./noise";
import { backdrop } from "./places";
import { group, op, path, shadow, tf, thing, type Ctx, type Mover } from "./things";
import type { Spec } from "./spec";

interface Plan { markup: (id: string) => string; movers: Mover[] }

function cloudShape(r: Rng, cx: number, cy: number, w: number): string {
  let d = rect(cx - w / 2, cy - 2, w, 5) + " ";
  const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) { const x = cx - w / 2 + (w * (k + 0.5)) / n, rr = w * (0.12 + r() * 0.12) * (k === Math.floor(n / 2) ? 1.4 : 1); d += circle(x, cy - rr * 0.35, rr) + " "; }
  return d;
}

function plan(spec: Spec): Plan {
  const s: Spec = { ...spec, shot: effectiveShot(spec) };
  const L = layout(s);
  const rL = rng(s.seed + 101), rM = rng(s.moment * 31 + s.seed + 5);
  const night = s.time === "night", low = s.time === "dawn" || s.time === "dusk";
  const indoor = L.indoor, hy = L.cam.hy;
  const dim = ["cloud", "storm", "fog", "rain", "snow"].includes(s.sky);
  const c: Ctx = { night, low, season: s.season, place: s.place, r: rM, a: s.a, indoor };
  const mv: Mover[] = [];
  const parts: ((id: string) => string)[] = [];
  const add = (fn: string | ((id: string) => string)) => parts.push(typeof fn === "string" ? () => fn : fn);

  if (s.place === "inner") return inner(s, rM);

  /* the setting, built first so the window is known */
  const bd = backdrop(s, L, "§", c, rL);
  const idFix = (str: string, id: string) => str.split("§").join(id);
  const win = bd.win;
  const box = win ? { x: win.x, y: win.y, w: win.w, h: win.h } : { x: 0, y: 0, w: 320, h: hy };

  /* sky */
  if (!indoor) add((id) => path("sky", rect(-5, -5, 330, hy + 10), "", 'fill="url(#sk' + id + ')" data-h="' + s.time + '" data-y="' + f(hy) + '"'));
  else add((id) => idFix(bd.back, id));
  if (indoor) add(path("sky", "M0,0", "", 'data-h="' + s.time + '" data-y="' + f(hy) + '"'));
  add((id) => pool(id, Math.round(L.light.x), Math.round(L.light.y), indoor ? 80 : 70, "pl"));
  if (night && !dim) {
    let st = "";
    for (let i = 0; i < (indoor ? 10 : 50); i++) st += circle(box.x + rL() * box.w, box.y + rL() * box.h * 0.8, rL() < 0.15 ? 1.1 : 0.55) + " ";
    add(path("lit", st, "st"));
    mv.push((a, _t, tm) => op(a, "st", 0.65 + 0.35 * Math.sin(tm * 1.7)));
  }
  /* sun or moon: they share the light's place, rising at dawn and night, setting at dusk */
  const cr = indoor ? Math.max(4, box.w * 0.1) : night ? 10 : low ? 15 : 12;
  const full = rM() < 0.4;
  const moon = night ? (full ? path("lit", circle(0, 0, cr)) : path("lit", "M0," + f(-cr) + " A" + f(cr) + "," + f(cr) + " 0 1,0 0," + f(cr) + " A" + f(cr * 1.3) + "," + f(cr * 1.3) + " 0 0,1 0," + f(-cr) + " Z", "", 'transform="rotate(' + f(-20 + rM() * 40) + ')"')) : path("lit", circle(0, 0, cr));
  add(group(path("lit", circle(0, 0, cr * 2.3), "", 'opacity=".14"') + path("lit", circle(0, 0, cr * 1.5), "", 'opacity=".18"') + moon, "cel"));
  const cx0 = indoor ? box.x + box.w * 0.3 : L.light.x - 36, cx1 = indoor ? box.x + box.w * 0.6 : L.light.x;
  const cyLow = indoor ? box.y + box.h - cr - 2 : hy + cr * 0.4, cyHigh = indoor ? box.y + box.h * 0.32 : L.light.y;
  mv.push((a, t) => {
    const e = ease(t);
    const k = s.time === "dusk" ? 1 - e * 0.8 : s.time === "day" ? 0.85 + 0.15 * Math.sin(e * Math.PI) : 0.25 + e * 0.75;
    const x = lerp(cx0, cx1, e), y = lerp(cyLow, cyHigh, k);
    tf(a, "cel", "translate(" + f(x) + "," + f(y) + ")");
    op(a, "cel", dim ? 0.3 : 1);
    if (!indoor) { a.a("pl").setAttribute("cx", f(x)); a.a("pl").setAttribute("cy", f(y)); }
  });
  /* clouds: weather sets how many, the mood how fast they go */
  const nCl = s.sky === "storm" || s.sky === "rain" ? 6 : s.sky === "cloud" ? 5 : s.sky === "snow" || s.sky === "wind" ? 3 : s.sky === "fog" ? 0 : s.v < -0.3 ? 2 : rL() < 0.4 ? 1 + Math.floor(rL() * 2) : 0;
  if (nCl && !indoor) {
    let cl = "";
    for (let k = 0; k < nCl; k++) cl += cloudShape(rL, box.x + rL() * (box.w + 60) - 30, box.y + 8 + rL() * Math.min(40, box.h * 0.4), (indoor ? 0.4 : 1) * (30 + rL() * 40)) + " ";
    add(group(path("haze", cl, "", s.sky === "storm" || s.sky === "rain" ? 'data-dark="1"' : ""), "cl"));
    const drift = 3 + s.a * 14 + (s.sky === "wind" || s.sky === "storm" ? 10 : 0);
    mv.push((a, _t, tm) => tf(a, "cl", "translate(" + f(((tm * drift) % (box.w + 80)) - 40) + ",0)"));
  }

  if (indoor && win) {
    // the window's frame over the sky: mullions, a sill
    add(path("edge", win.shape, "", 'fill="none" stroke-width="3"') + path("edge", rect(win.x + win.w / 2 - 1.2, win.y, 2.4, win.h) + " " + rect(win.x, win.y + win.h * 0.45, win.w, 2.4) + " " + rect(win.x - 5, win.y + win.h, win.w + 10, 4)));
  } else add((id) => idFix(bd.back, id));
  add((id) => idFix(bd.ground, id));
  mv.push(...bd.movers);
  if (L.cam.shot === "close") {
    // the still life rests on something: a table top inside, a stone ledge outside
    const y = L.surface;
    add(path(indoor ? "far" : "edge", P([[-5, y], [325, y], [325, 206], [-5, 206]])) + path("lit", rect(-5, y, 330, 1.4), "", 'opacity=".45"') + path("shade", rect(-5, y + 1.4, 330, 6)));
  }

  /* things and people, far first */
  const placed = L.items;
  let fi = 0;
  placed.forEach((it, n) => {
    if (it.kind === "fig") {
      const k = "fg" + it.i, b = s.cast[it.i] ?? 0, pose = it.pose || "stand";
      const ph = it.i * 1.3 + rM() * 2, seatOnGround = pose === "sit" && !it.seat;
      const svg = figureSvg(k, b, pose, it.face, !!it.seat);
      const big = it.s > 1.6;
      add((big ? "" : group(shadow(26, L.light.x - it.x, 60), "", "translate(" + f(it.x) + "," + f(it.y) + ") scale(" + f(it.s) + ")")) + svg);
      const lie = pose === "lie";
      const walking = pose === "walk" || pose === "run";
      const road = walking && s.place === "road";
      mv.push((a, t, tm, e) => {
        let x = it.x, y = it.y + (seatOnGround ? GROUND_SIT_DROP * it.s : 0), sc = it.s;
        if (road) { const yy = lerp(it.y, hy + (it.y - hy) * 0.35, e); sc = it.s * (yy - hy) / Math.max(1, it.y - hy); x = lerp(it.x, 160, e * 0.5); y = yy; }
        else if (walking) x = Math.max(-10, Math.min(330, it.x + it.face * lerp(-34, 10, e) * it.s * (pose === "run" ? 1.6 : 1)));
        else if (!lie) x += Math.sin(tm * 0.5 + ph) * 0.3;
        tf(a, k, "translate(" + f(x) + "," + f(y) + ") scale(" + f(sc) + ")" + (lie ? " translate(0,-11) rotate(" + (it.face > 0 ? -90 : 90) + ")" : ""));
        poseFrame(a, k, pose, b, walking ? t : Math.max(t, 0.5), tm, ph, 1);
      });
      fi++;
      return;
    }
    const seed = s.seed * 31 + n * 7 + it.i;
    const built = thing(it.kind, n, "§", { ...c, r: rng(seed) });
    const flip = it.face < 0 && it.kind !== "car" && it.kind !== "train" && it.kind !== "bridge" && it.kind !== "fence" ? " scale(-1,1)" : "";
    const sh = it.on === "ground" && it.kind !== "fence" && it.kind !== "bridge" && it.kind !== "train" ? shadow(SIZE[it.kind].w, L.light.x - it.x, SIZE[it.kind].h) : "";
    if (it.kind === "fire" && indoor) {
      // a hearth in the back wall: the fire burns inside it
      const w = it.w * 1.6, h = it.h * 1.7;
      add(path("far", rect(it.x - w / 2 - 6, it.y - h - 6, w + 12, 6) + " " + rect(it.x - w / 2, it.y - h, 6, h) + " " + rect(it.x + w / 2 - 6, it.y - h, 6, h)) + path("fig", rect(it.x - w / 2 + 6, it.y - h, w - 12, h)));
    }
    if (it.kind === "lamp" && it.on === "ceiling") {
      const lx = it.x, sc = it.s;
      add((id) => group(path("beam", P([[-12, 46], [12, 46], [80, 210], [-80, 210]]), "hb", 'fill="url(#bm' + id + ')"') + path("line", "M0,-60 V34") + path("far", P([[-12, 34], [12, 34], [22, 48], [-22, 48]])) + path("lit", ellipse(0, 48, 12, 3)), "hl"));
      mv.push((a, t, tm) => { const ang = 10 * (1 - ease(t)) * Math.cos(ease(t) * 8) + Math.sin(tm * 0.8) * 0.8 * (0.5 + s.a); tf(a, "hl", "translate(" + f(lx) + "," + f(L.cam.hy - (L.wall - L.cam.hy) * 0.55) + ") scale(" + f(sc) + ") rotate(" + f(ang) + ")"); op(a, "hb", lerp(0.2, 1, t)); });
      return;
    }
    if (it.kind === "window" && indoor) {
      add((id) => path("sky", rect(it.x - it.w / 2, it.y - it.h, it.w, it.h), "", 'fill="url(#sk' + id + ')"') + path("edge", rect(it.x - it.w / 2 - 3, it.y - it.h - 3, it.w + 6, 3) + " " + rect(it.x - it.w / 2 - 3, it.y, it.w + 6, 3) + " " + rect(it.x - 1, it.y - it.h, 2, it.h) + " " + rect(it.x - it.w / 2 - 3, it.y - it.h, 3, it.h) + " " + rect(it.x + it.w / 2, it.y - it.h, 3, it.h)));
      return;
    }
    add((id) => group(idFix(sh, id) + idFix(built.svg, id), "", "translate(" + f(it.x) + "," + f(it.y) + ") scale(" + f(it.s) + ")" + flip));
    mv.push(...built.movers);
  });
  void fi;

  /* foreground framing, then weather */
  add((id) => idFix(bd.front, id));
  const inBox = (x: number, y: number) => ({ x: box.x + ((x % box.w) + box.w) % box.w, y: box.y + ((y % box.h) + box.h) % box.h });
  const H = indoor ? box.h : 205;
  const wrap = (x: number, y: number) => indoor ? inBox(x, y) : { x: ((x % 330) + 330) % 330 - 5, y: ((y % 210) + 210) % 210 - 5 };
  if (s.sky === "rain" || s.sky === "storm") {
    add(path("line", "M0,0", "rn"));
    const heavy = (s.sky === "storm" ? 1.6 : 1) * (0.7 + s.a * 0.6);
    mv.push((a, t, tm) => {
      const n = Math.round((indoor ? 10 : 36) * heavy * lerp(0.5, 1, t)) + 6;
      let d = "";
      for (let i = 0; i < n; i++) { const p = wrap(i * 53.3 + Math.sin(i) * 7, i * 29.7 + tm * 120 * heavy), yb = Math.min(p.y + 8, indoor ? box.y + H : 205); d += "M" + f(p.x) + "," + f(p.y) + " L" + f(p.x - 3 * heavy) + "," + f(yb) + " "; }
      a.a("rn").setAttribute("d", d);
    });
  }
  if (s.sky === "storm") {
    const bx = box.x + box.w * (0.3 + rL() * 0.4), bh = indoor ? box.h : hy;
    add(path("lit", P([[bx, box.y], [bx + 6, box.y + bh * 0.35], [bx - 2, box.y + bh * 0.38], [bx + 8, box.y + bh * 0.8], [bx - 4, box.y + bh * 0.42], [bx + 3, box.y + bh * 0.4]]), "lt"));
    mv.push((a, _t, tm) => { const cyc = (tm * 0.45) % 1; op(a, "lt", cyc < 0.04 || (cyc > 0.07 && cyc < 0.09) ? 1 : 0); });
  }
  if (s.sky === "snow" || (s.season === "winter" && s.sky === "cloud")) {
    add(path("lit", "M0,0", "sn"));
    mv.push((a, t, tm) => {
      const n = (indoor ? 16 : 46) * lerp(0.5, 1, t);
      let d = "";
      for (let i = 0; i < n; i++) { const p = wrap(i * 47.1 + Math.sin(tm * 0.7 + i) * 6, i * 23.3 + tm * 14 * (0.6 + (i % 3) * 0.3)); d += circle(p.x, p.y, i % 4 ? 0.8 : 1.3) + " "; }
      a.a("sn").setAttribute("d", d || "M0,0");
    });
  }
  if (s.season === "autumn" && !indoor) {
    add(path("key", "M0,0", "lv"));
    mv.push((a, _t, tm) => { let d = ""; for (let i = 0; i < 9; i++) { const p = wrap(i * 61 + tm * (10 + s.a * 20), i * 37 + tm * 16); const r = Math.sin(tm * 2 + i); d += "M" + f(p.x) + "," + f(p.y) + " q" + f(2 * r) + ",-2 " + f(4) + ",0 q" + f(-2 * r) + ",2 -4,0 "; } a.a("lv").setAttribute("d", d); });
  }
  if (s.sky === "fog" && !indoor) {
    let d = "";
    for (let k = 0; k < 4; k++) { const y = hy - 8 + k * 14; d += ellipse(40 + k * 90 + rL() * 40, y, 150 + rL() * 60, 8 + k * 2) + " "; }
    add(group(path("haze", d), "fog", "", 'opacity=".7"'));
    mv.push((a, t, tm) => { tf(a, "fog", "translate(" + f(Math.sin(tm * 0.15) * 20) + ",0)"); op(a, "fog", lerp(0.8, 0.5, t)); });
  }
  if (s.sky === "wind" && !indoor) {
    add(path("line", "M0,0", "wd"));
    mv.push((a, _t, tm) => { let d = ""; for (let i = 0; i < 6; i++) { const x = ((i * 71 + tm * (60 + s.a * 60)) % 420) - 60, y = 20 + (i * 37) % Math.max(20, hy - 10); d += "M" + f(x) + "," + f(y) + " q14,-5 28,0 t28,0 "; } a.a("wd").setAttribute("d", d); });
  }

  /* light: the hour and the mood set how far the scene brightens with the beat */
  const top = night ? 0.85 : low ? 0.95 : 1, bottom = night ? 0.15 : 0.32 + 0.15 * s.v;
  mv.push((a, t) => a.light(lerp(bottom, top, ease(seg(t, 0, 0.8)))));

  const cls = "hz t-" + s.time;
  return {
    markup: (id) => defs(id) + group(skyDefs(id) + group(parts.map((p) => p(id)).join(""), "", "", 'class="w-' + s.sky + (s.season !== "none" ? " se-" + s.season : "") + '"'), "", "", 'class="' + cls + '"') + grain(id),
    movers: mv,
  };
}

/** The sky's gradient: its two stops are coloured by the style's CSS for the hour. */
function skyDefs(id: string): string {
  return '<defs><linearGradient id="sk' + id + '" x1="0" y1="0" x2="0" y2="1"><stop class="sk0" offset="0" stop-color="#456"/><stop class="sk1" offset="1" stop-color="#9ab"/></linearGradient></defs>';
}

/** No place named: a quiet motif grown from the passage's mood, drawn small and centred. */
function inner(s: Spec, r: Rng): Plan {
  const mv: Mover[] = [], parts: string[] = [];
  const cx = 160, cy = 100, n = fbm(s.seed + 3, 3);
  const kind = s.v > 0.25 ? "rise" : s.v < -0.25 ? (s.a > 0.5 ? "strata" : "settle") : s.a < 0.45 ? "ripple" : "drift";
  parts.push(path("sky", rect(-5, -5, 330, 210), "", 'fill="url(#sk§)" data-h="' + s.time + '" data-y="200" opacity=".5"'));
  parts.push(pool("§", cx, cy, 90, ""));
  parts.push(path("line", "M0,0", "m1") + path("lit", "M0,0", "m2"));
  mv.push((a, t, tm) => {
    const e = ease(t);
    let d = "", d2 = "";
    if (kind === "ripple") {
      for (let k = 0; k < 6; k++) { const q = ((k / 6) + tm * 0.05) % 1, rr = 8 + q * 100 * (0.5 + e * 0.5); d += ellipse(cx, cy, rr, rr * 0.36) + " "; }
      d2 = circle(cx, cy, 2 + e * 2);
    } else if (kind === "rise") {
      for (let k = 0; k < 13; k++) {
        const x = 60 + k * 16.6, len = (40 + n(k * 0.7) * 30 + 40) * (0.3 + 0.7 * e), sw = Math.sin(tm * 0.6 + k) * 6;
        const pts: [number, number][] = [[x, 170], [x + sw * 0.3, 170 - len * 0.35], [x + sw, 170 - len * 0.7], [x + sw * 1.3, 170 - len]];
        d += smooth(pts) + " "; d2 += circle(x + sw * 1.3, 170 - len, 1.6) + " ";
      }
    } else if (kind === "strata") {
      for (let k = 0; k < 9; k++) {
        const y0 = 50 + k * (12 - 4 * e);
        const pts: [number, number][] = [];
        for (let x = 40; x <= 280; x += 16) pts.push([x, y0 + n(x * 0.03 + k * 1.7) * 10 + Math.sin(tm * 0.8 + k + x * 0.04) * 1.2]);
        d += smooth(pts) + " ";
      }
    } else if (kind === "settle") {
      for (let k = 0; k < 40; k++) { const x = 60 + ((k * 37) % 200), fall = ((tm * 6 + k * 13) % 120) * (1 - e * 0.6), y = Math.min(160 - Math.abs(x - 160) * 0.15, 40 + fall + e * 60); d2 += circle(x, y, 1.1) + " "; }
      d = smooth([[50, 165], [110, 158], [160, 152], [210, 158], [270, 165]]);
    } else {
      for (let k = 0; k < 22; k++) { const x = ((k * 53 + tm * (8 + s.a * 16)) % 260) + 30, y = 40 + ((k * 29) % 120) + Math.sin(tm + k) * 4; d += "M" + f(x) + "," + f(y) + " q6,-3 12,0 "; }
      d2 = circle(cx + Math.sin(tm * 0.3) * 30, cy, 2.4);
    }
    a.a("m1").setAttribute("d", d || "M0,0"); a.a("m2").setAttribute("d", d2 || "M0,0");
  });
  mv.push((a, t) => a.light(lerp(0.3, 0.9, ease(t))));
  void r;
  return {
    markup: (id) => defs(id) + group(skyDefs(id) + group(parts.join("").split("§").join(id), "", "", 'class="w-' + s.sky + '"'), "", "", 'class="hz t-' + s.time + '"') + grain(id),
    movers: mv,
  };
}

const cache = new Map<string, VScene>();

/** The vector scene for a spec (cached by id: the same spec is the same picture). */
export function composeScene(s: Spec, id: string): VScene {
  const hit = cache.get(id);
  if (hit) return hit;
  const p = plan(s);
  const vs: VScene = {
    build: (uid) => p.markup(uid),
    update(a, t, tm) { const e = ease(t); for (const m of p.movers) m(a, t, tm, e); },
  };
  if (cache.size > 300) cache.clear();
  cache.set(id, vs);
  return vs;
}

/** For tests: the boxes a spec lays out. */
export { layout as layoutOf };
export type { Item };
