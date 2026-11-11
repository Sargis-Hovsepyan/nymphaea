// Things in composed scenes. Each is drawn around its base centre (0,0), up is negative, at the
// native size listed in compose/layout.ts SIZE, with ROLE classes so every picture style can draw
// it. Parts that move carry data-a keys, and a mover animates them. Trees grow by species and
// season. Pure markup.
import { clamp, ease, lerp } from "../scenes/helpers";
import { P, beamFill, circle, ellipse, f, pool, rect, seg } from "../vscenes/shapes";
import type { VApi } from "../vscenes";
import type { Rng } from "./noise";
import type { Place, Prop, Season } from "./spec";
import { litAt, openAt, ringAt, smokeAt, travelAt, type Ev } from "./perform";

/** A part's motion for one frame: t the beat (scroll), tm seconds, e the eased beat, p the play clock (seconds into what happens). */
export type Mover = (a: VApi, t: number, tm: number, e: number, p: number) => void;
export interface Built { svg: string; movers: Mover[] }
export interface Ctx { night: boolean; low: boolean; season: Season; place: Place; r: Rng; a: number; indoor: boolean; /** What the acts do to this thing (compose/perform.ts). */ ev?: Ev[] }

export const tf = (a: VApi, k: string, v: string) => a.a(k).setAttribute("transform", v);
export const op = (a: VApi, k: string, v: number) => { (a.a(k) as SVGElement).style.opacity = f(clamp(v)); };
export const path = (cls: string, d: string, key = "", extra = "") =>
  '<path class="' + (cls === "sky" || cls === "shade" || cls === "haze" ? cls : "s " + cls) + '"' + (key ? ' data-a="' + key + '"' : "") + (extra ? " " + extra : "") + ' d="' + d + '"/>';
export const group = (inner: string, key = "", transform = "", extra = "") =>
  "<g" + (key ? ' data-a="' + key + '"' : "") + (transform ? ' transform="' + transform + '"' : "") + (extra ? " " + extra : "") + ">" + inner + "</g>";

export type Species = "pine" | "round" | "poplar" | "bare" | "palm";

export function speciesFor(place: Place, season: Season, r: Rng): Species {
  if (place === "desert" || place === "shore") return "palm";
  if (place === "graveyard") return r() < 0.7 ? "bare" : "pine";
  if (place === "mountain") return "pine";
  if (place === "forest") return r() < 0.6 ? "pine" : season === "winter" ? "bare" : "round";
  if (season === "winter") return r() < 0.75 ? "bare" : "pine";
  return r() < 0.3 ? "poplar" : "round";
}

/** A tree of a species, its base at 0,0, about h tall. Crown key (if any) sways. */
export function tree(sp: Species, h: number, r: Rng, key: string, season: Season): { svg: string; crown: string } {
  const trunk = (w: number, th: number) => P([[-w, 0], [w, 0], [w * 0.6, -th], [-w * 0.6, -th]]);
  let crown = "", extra = "", d = "";
  switch (sp) {
    case "pine": {
      const tiers = 3 + Math.floor(r() * 2);
      for (let k = 0; k < tiers; k++) {
        const y0 = -h * (0.18 + (k * 0.7) / tiers), w = h * 0.3 * (1 - k / (tiers + 0.6)), y1 = y0 - h * 0.34;
        crown += P([[-w, y0], [w, y0], [w * 0.15, y1], [-w * 0.15, y1]]) + " ";
      }
      d = trunk(h * 0.04, h * 0.2);
      if (season === "winter") extra = path("lit", P([[-h * 0.12, -h * 0.62], [h * 0.12, -h * 0.62], [0, -h * 0.9]]), "", 'opacity=".7"');
      break;
    }
    case "round": {
      d = trunk(h * 0.05, h * 0.45);
      const n = 4 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, rr = h * (0.17 + r() * 0.08); crown += circle(Math.cos(a) * h * 0.15, -h * 0.66 + Math.sin(a) * h * 0.1, rr) + " "; }
      crown += circle(0, -h * 0.68, h * 0.22);
      if (season === "spring") { let b = ""; for (let k = 0; k < 9; k++) b += circle((r() - 0.5) * h * 0.5, -h * (0.5 + r() * 0.35), h * 0.025) + " "; extra = path("lit", b); }
      if (season === "autumn") { let b = ""; for (let k = 0; k < 7; k++) b += circle((r() - 0.5) * h * 0.5, -h * (0.5 + r() * 0.35), h * 0.04) + " "; extra = path("key", b); }
      break;
    }
    case "poplar":
      d = trunk(h * 0.035, h * 0.2);
      crown = "M0," + f(-h) + " C" + f(h * 0.15) + "," + f(-h * 0.8) + " " + f(h * 0.14) + "," + f(-h * 0.3) + " 0," + f(-h * 0.16) + " C" + f(-h * 0.14) + "," + f(-h * 0.3) + " " + f(-h * 0.15) + "," + f(-h * 0.8) + " 0," + f(-h) + " Z";
      break;
    case "bare": {
      d = trunk(h * 0.05, h * 0.5);
      let br = "";
      const limb = (x: number, y: number, ang: number, len: number, depth: number) => {
        const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len, w = Math.max(0.5, depth * h * 0.012);
        br += P([[x - w, y], [x + w, y], [x2 + w * 0.5, y2], [x2 - w * 0.5, y2]]) + " ";
        if (depth > 1) { limb(x2, y2, ang - 0.45 - r() * 0.2, len * 0.7, depth - 1); limb(x2, y2, ang + 0.4 + r() * 0.2, len * 0.66, depth - 1); }
      };
      limb(0, -h * 0.48, -0.1, h * 0.26, 3);
      crown = br;
      if (season === "winter") extra = path("lit", ellipse(0, 0, h * 0.18, h * 0.02));
      break;
    }
    case "palm": {
      d = "M-2,0 C-1," + f(-h * 0.4) + " 3," + f(-h * 0.7) + " 6," + f(-h * 0.9) + " L8," + f(-h * 0.88) + " C5," + f(-h * 0.68) + " 2," + f(-h * 0.4) + " 2,0 Z";
      const cx = 7, cy = -h * 0.9;
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.55, L = h * (0.32 + r() * 0.08), ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.6 + L * 0.25;
        crown += "M" + f(cx) + "," + f(cy) + " Q" + f(cx + Math.cos(a) * L * 0.5) + "," + f(cy - h * 0.12) + " " + f(ex) + "," + f(ey) + " Q" + f(cx + Math.cos(a) * L * 0.5) + "," + f(cy - h * 0.06) + " " + f(cx) + "," + f(cy + 2) + " Z ";
      }
      break;
    }
  }
  return { svg: path("far", d) + group(path("far", crown) + extra, key), crown: key };
}

const lit = (night: boolean, low: boolean) => (night ? 1 : low ? 0.6 : 0.2);

/** One thing. k numbers it within the scene so keys stay unique. */
export function thing(p: Prop, k: number, id: string, c: Ctx): Built {
  const key = (s: string) => p + k + s;
  const mv: Mover[] = [];
  const r = c.r, wind = 0.6 + c.a * 1.2;
  const ev = c.ev || [];
  /** It travels by an act (arrives, leaves, passes): the scene moves the whole thing, so it does not drift with the beat. */
  const travels = travelAt(ev, 0) !== null;
  let svg = "";
  switch (p) {
    case "tree": {
      const h = 52 + r() * 14, t = tree(speciesFor(c.place, c.season, r), h, r, key("c"), c.season), ph = r() * 6;
      svg = t.svg;
      mv.push((a, _t, tm) => tf(a, key("c"), "rotate(" + f(Math.sin(tm * 0.9 + ph) * 1.4 * wind) + " 0 " + f(-h * 0.45) + ")"));
      break;
    }
    case "house": {
      const roof = r(), w = 50 + r() * 10, wh = 26 + r() * 6, hw = w / 2;
      const top = roof < 0.6 ? P([[-hw - 5, -wh + 1], [0, -wh - 20], [hw + 5, -wh + 1]]) : P([[-hw - 4, -wh + 1], [-hw + 6, -wh - 14], [hw - 6, -wh - 14], [hw + 4, -wh + 1]]);
      svg = path("far", rect(-hw, -wh, w, wh)) + path("shade", rect(hw * 0.25, -wh, hw * 0.75, wh)) + path("edge", top) + path("far", rect(hw * 0.4, -wh - 22, 5, 12))
        + path("bg2", rect(-5, -14, 10, 14)) + path("lit", rect(hw * 0.45, -wh + 7, 8, 7), key("w")) + path("lit", rect(-hw * 0.75, -wh + 7, 8, 7), key("v"))
        + path("line", "M0,0", key("s"));
      const cx = hw * 0.4 + 2.5;
      mv.push((a, t, tm, e) => {
        op(a, key("w"), c.night || c.low ? lerp(0.2, 1, e) : 0.15); op(a, key("v"), c.night ? lerp(0, 0.9, seg(t, 0.4, 1)) : 0.12);
        let d = "";
        for (let i = 0; i < 3; i++) { const s = ((tm * 0.25 + i / 3) % 1); d += "M" + f(cx + Math.sin(s * 6 + i) * 3) + "," + f(-wh - 23 - s * 26) + " l" + f(Math.sin(s * 9) * 2 * wind) + ",-4 "; }
        a.a(key("s")).setAttribute("d", d);
      });
      break;
    }
    case "lamp": {
      svg = path("beam", P([[-3, -55], [3, -55], [26, 0], [-26, 0]]), key("b"), beamFill(id)) + path("far", rect(-1.3, -58, 2.6, 58) + " " + P([[-5, -58], [5, -58], [3, -64], [-3, -64]]))
        + path("lit", circle(0, -55.5, 2.6), key("l"));
      mv.push((a, t, tm, _e, p) => { const lt = litAt(ev, p) ?? 1, fl = (0.85 + 0.15 * Math.sin(tm * 7 + k) * c.a) * lt; op(a, key("l"), lerp(0.4, 1, t) * fl); op(a, key("b"), (c.night ? 0.9 : 0.3) * lerp(0.3, 1, t) * fl); });
      break;
    }
    case "boat": {
      svg = group(path("far", P([[-22, -4], [22, -4], [15, 4], [-15, 4]])) + path("line", "M0,-4 V-36") + path("key", P([[1, -6], [1, -35], [19, -8]])) + path("bg2", P([[-1, -8], [-1, -30], [-14, -8]])), key("g"));
      const ph = r() * 5;
      mv.push((a, t, tm) => tf(a, key("g"), "translate(" + f(travels ? 0 : lerp(-10, 10, ease(t))) + "," + f(Math.sin(tm * 1.4 + ph) * 1.4 * wind) + ") rotate(" + f(Math.sin(tm * 1.1 + ph) * 2.5 * wind) + ")"));
      break;
    }
    case "ship": {
      svg = group(path("far", P([[-60, -12], [60, -12], [52, 2], [-52, 2]]) + " " + rect(-36, -22, 60, 10) + " " + rect(-8, -34, 14, 12))
        + path("lit", rect(-30, -19, 3, 3) + " " + rect(-20, -19, 3, 3) + " " + rect(-10, -19, 3, 3) + " " + rect(0, -19, 3, 3) + " " + rect(10, -19, 3, 3), key("w"))
        + path("line", "M-1,-34 V-62 M-30,-22 V-46"), key("g"));
      mv.push((a, t, tm) => { tf(a, key("g"), "translate(" + f(travels ? 0 : lerp(-6, 6, t)) + "," + f(Math.sin(tm * 0.6) * 0.8) + ")"); op(a, key("w"), c.night || c.low ? 1 : 0.2); });
      break;
    }
    case "bird": {
      const one = (x: number, y: number, s: number) => "M" + f(x - 5 * s) + "," + f(y) + " Q" + f(x - 2.5 * s) + "," + f(y - 3.5 * s) + " " + f(x) + "," + f(y) + " Q" + f(x + 2.5 * s) + "," + f(y - 3.5 * s) + " " + f(x + 5 * s) + "," + f(y) + " Q" + f(x) + "," + f(y - 1.2 * s) + " " + f(x - 5 * s) + "," + f(y) + " Z ";
      svg = group(path("fig", one(0, 0, 1.2) + one(-14, 6, 0.9) + one(11, 9, 0.8)), key("g"));
      const y0 = 26 + r() * 30;
      const perch = 150 + r() * 40;
      mv.push((a, t, tm, _e, p) => {
        const v = travelAt(ev, p);
        if (v == null) { tf(a, key("g"), "translate(" + f(lerp(-40, 220, ease(t))) + "," + f(y0 + Math.sin(tm * 2) * 3 - t * 12) + ") scale(1," + f(0.7 + 0.3 * Math.abs(Math.sin(tm * 7))) + ")"); return; }
        // Flying off: up and away from where they were; landing is the same run backwards. Wings beat only in the air.
        const air = Math.abs(v) > 0.01, x = perch + v * 230, y = y0 + 40 - Math.abs(v) * 70 + (air ? Math.sin(tm * 2) * 3 : 0);
        tf(a, key("g"), "translate(" + f(x) + "," + f(y) + ") scale(1," + f(air ? 0.7 + 0.3 * Math.abs(Math.sin(tm * 9)) : 0.85) + ")");
      });
      break;
    }
    case "car": {
      svg = group(path("beam", P([[18, -6], [70, -14], [70, 3]]), key("b"), beamFill(id))
        + path("far", P([[-19, 0], [19, 0], [19, -8], [10, -8], [5, -15], [-9, -15], [-13, -8], [-19, -8]]))
        + path("bg2", P([[4, -9], [8, -9], [5, -13], [4, -13]]) + " " + P([[-8, -9], [2, -9], [2, -13], [-6, -13]]))
        + path("lit", rect(16, -7, 3, 2.4)) + path("fig", circle(-11, 0, 3.6) + " " + circle(11, 0, 3.6)), key("g"));
      mv.push((a, t) => { tf(a, key("g"), "translate(" + f(travels ? 0 : lerp(-60, 30, ease(t))) + ",0)"); op(a, key("b"), c.night ? 0.9 : 0.2); });
      break;
    }
    case "tower": {
      svg = path("far", P([[-8, 0], [8, 0], [5, -78], [-5, -78]])) + path("shade", P([[1, 0], [8, 0], [5, -78], [1, -78]])) + path("edge", P([[-9, -78], [9, -78], [0, -92]])) + path("lit", circle(0, -82, 2.8), key("l"))
        + path("beam", "M0,0", key("b"), beamFill(id)) + (ev.length ? path("line", "M0,0", key("r"), 'fill="none"') : "");
      // A bell that rings: rings of sound spread from the belfry.
      if (ev.length) mv.push((a, _t, tm, _e, p) => { const on = Math.abs(ringAt(ev, p, tm)) > 0; let d = ""; if (on) for (let i = 0; i < 3; i++) { const q = (tm * 0.9 + i / 3) % 1, rr = 6 + q * 22; d += "M" + f(-rr) + "," + f(-84 - rr * 0.2) + " Q0," + f(-84 - rr * 0.9) + " " + f(rr) + "," + f(-84 - rr * 0.2) + " "; } a.a(key("r")).setAttribute("d", d || "M0,0"); });
      mv.push((a, _t, tm) => {
        const ang = tm * 0.9, x = Math.cos(ang) * 150, w = 10;
        a.a(key("b")).setAttribute("d", c.night || c.low ? P([[0, -82], [x, -82 - w + Math.sin(ang) * 6], [x, -82 + w + Math.sin(ang) * 6]]) : "M0,0");
        op(a, key("l"), c.night ? 0.6 + 0.4 * Math.abs(Math.cos(ang)) : 0.5);
      });
      break;
    }
    case "fire": {
      svg = pool(id, 0, -10, 46, key("p")) + path("fig", P([[-14, 0], [12, -6], [14, -3], [-12, 3]]) + " " + P([[14, 0], [-12, -6], [-14, -3], [12, 3]])) + path("lit", "M0,0", key("f")) + path("key", "M0,0", key("k"));
      mv.push((a, t, tm, _e, p) => {
        const lt = litAt(ev, p);
        const h = (lt == null ? lerp(10, 24, t) : lerp(0, 24, lt)) * (1 + (0.1 + 0.15 * c.a) * Math.sin(tm * 11) + 0.08 * Math.sin(tm * 23)), sw = Math.sin(tm * 4) * 2.5;
        if (lt != null) op(a, key("p"), lt);
        a.a(key("f")).setAttribute("d", "M-8,-2 C-10,-10 " + f(-3 + sw) + "," + f(-h * 0.6) + " " + f(sw) + "," + f(-h) + " C" + f(4 + sw) + "," + f(-h * 0.6) + " 10,-10 8,-2 Z");
        let sp = "";
        for (let i = 0; i < 4; i++) { const s = (tm * 0.7 + i / 4) % 1; sp += circle(Math.sin(i * 3 + tm) * 6, -h - s * 30, 0.8) + " "; }
        a.a(key("k")).setAttribute("d", h > 1 ? sp : "M0,0");
        a.a(key("p")).setAttribute("r", f(40 + 8 * Math.sin(tm * 9)));
      });
      break;
    }
    case "table": svg = path("far", rect(-32, -27, 64, 4) + " " + rect(-28, -23, 3, 23) + " " + rect(25, -23, 3, 23)) + path("shade", rect(-32, -23, 64, 2)); break;
    case "chair": svg = path("far", rect(-8, -22, 16, 3) + " " + rect(-8, -19, 2.4, 19) + " " + rect(5.6, -19, 2.4, 19) + " " + rect(5.6, -40, 2.4, 18) + " " + rect(-8, -40, 2.4, 18) + " " + rect(-8, -38, 16, 3)); break;
    case "cup": {
      svg = path("key", P([[-5, 0], [5, 0], [6.5, -10], [-6.5, -10]])) + path("line", "M6,-8 q5,1 0,6") + path("line", "M0,0", key("s"));
      mv.push((a, _t, tm) => {
        let d = "";
        for (let i = 0; i < 2; i++) { const s = (tm * 0.4 + i / 2) % 1; d += "M" + f(-2 + i * 4) + "," + f(-12 - s * 4) + " q" + f(Math.sin(tm * 2 + i) * 3) + ",-4 0,-8 "; }
        a.a(key("s")).setAttribute("d", d);
      });
      break;
    }
    case "glass": svg = path("lit", P([[-3.5, 0], [3.5, 0], [4, -13], [-4, -13]]), "", 'opacity=".55"') + path("key", P([[-3.6, -1], [3.6, -1], [3.9, -6], [-3.9, -6]])); break;
    case "book": {
      svg = path("lit", P([[-13, 0], [0, -2.5], [13, 0], [13, -3.5], [0, -6], [-13, -3.5]])) + path("line", "M0,-2.5 V-6") + path("far", "M0,0", key("p"));
      mv.push((a, t, tm) => { const s = (tm * 0.3) % 1, x = lerp(12, -12, s); a.a(key("p")).setAttribute("d", t > 0.3 ? P([[0, -2.5], [x, -2.5 - 6 * Math.sin(s * Math.PI)], [x, -6 - 6 * Math.sin(s * Math.PI)], [0, -6]]) : "M0,0"); });
      break;
    }
    case "letter": svg = group(path("lit", P([[-8, 0], [8, -1], [8, -3], [-8, -2]])) + path("line", "M-5,-1.6 L5,-2.2"), key("g"));
      mv.push((a, _t, tm) => tf(a, key("g"), "rotate(" + f(Math.sin(tm * 0.5) * 1.5 * wind) + ")")); break;
    case "candle": {
      const lights = litAt(ev, 0) !== null;
      svg = pool(id, 0, -16, 34, key("p")) + path("far", rect(-2.2, -13, 4.4, 13)) + path("line", "M0,-13 v-2.4", "", 'fill="none"') + path("lit", "M0,0", key("f")) + (lights ? path("line", "M0,0", key("w"), 'fill="none"') : "");
      mv.push((a, t, tm, _e, p) => {
        const lt = litAt(ev, p);
        const h = (lt == null ? lerp(5, 10, t) : 10 * lt) * (1 + (0.08 + 0.1 * c.a) * Math.sin(tm * 9)), sw = Math.sin(tm * 3) * 1;
        a.a(key("f")).setAttribute("d", h < 0.3 ? "M0,0" : "M0,-13 C-2.5,-15 " + f(-1 + sw) + "," + f(-13 - h * 0.6) + " " + f(sw) + "," + f(-13 - h) + " C" + f(1 + sw) + "," + f(-13 - h * 0.6) + " 2.5,-15 0,-13 Z");
        if (lt != null) {
          op(a, key("p"), lt);
          // A thread of smoke from the wick once it is out.
          const sm = smokeAt(ev, p);
          let d = "M0,0";
          if (sm > 0) { const pts: string[] = []; for (let n = 0; n <= 6; n++) { const q = n / 6; pts.push(f(Math.sin(tm * 2 + q * 5) * q * 4) + "," + f(-15 - q * 26)); } d = "M" + pts.join(" L"); }
          a.a(key("w")).setAttribute("d", d);
          op(a, key("w"), sm * 0.8);
        }
      });
      break;
    }
    case "cigarette": {
      // Paper, a filter, an ember at the tip and a thread of smoke. Lit unless the acts say otherwise;
      // burning out shortens it, the ember dies and the last smoke drifts off.
      svg = path("lit", "M0,0", key("b")) + path("key", rect(-6, -2, 2.2, 2)) + path("key", "M0,0", key("e")) + path("line", "M0,0", key("w"), 'fill="none"');
      const ph = r() * 6;
      mv.push((a, t, tm, _e, p) => {
        const lt = litAt(ev, p), dying = ev.some((x) => x.kind === "die"), on = lt == null ? clamp(t * 2) : lt;
        const tip = dying && lt != null ? lerp(-2.5, 6, lt) : 6;
        a.a(key("b")).setAttribute("d", rect(-3.8, -2, tip + 3.8, 2));
        const glow = on * (0.75 + 0.25 * Math.sin(tm * 2.3 + ph));
        a.a(key("e")).setAttribute("d", on > 0.02 ? ellipse(tip, -1, 1.1 + glow * 0.5, 1.1) : "M0,0");
        op(a, key("e"), glow);
        const sm = Math.max(on * 0.7, smokeAt(ev, p) * 0.8);
        let d = "M0,0";
        if (sm > 0.02) { const pts: string[] = []; for (let n = 0; n <= 7; n++) { const q = n / 7; pts.push(f(tip + Math.sin(tm * 1.7 + q * 5 + ph) * q * 5) + "," + f(-2 - q * 30)); } d = "M" + pts.join(" L"); }
        a.a(key("w")).setAttribute("d", d);
        op(a, key("w"), sm);
      });
      break;
    }
    case "clock": {
      svg = path("edge", circle(0, -9, 9)) + path("lit", circle(0, -9, 7.5)) + path("line", "M0,0", key("h"));
      mv.push((a, _t, tm) => { const m = tm * 0.5, h = tm * 0.04; a.a(key("h")).setAttribute("d", "M0,-9 L" + f(Math.sin(m) * 6) + "," + f(-9 - Math.cos(m) * 6) + " M0,-9 L" + f(Math.sin(h) * 4) + "," + f(-9 - Math.cos(h) * 4)); });
      break;
    }
    case "mirror": svg = path("edge", ellipse(0, -19, 12, 19)) + path("bg2", ellipse(0, -19, 9.5, 16.5)) + path("lit", P([[-5, -26], [-2, -30], [3, -12], [0, -9]]), "", 'opacity=".4"'); break;
    case "window": svg = ""; break;
    case "door": {
      svg = path("edge", rect(-15, -46, 30, 46)) + path("lit", rect(-12, -43, 24, 43), key("l")) + path("far", "M0,0", key("d"));
      mv.push((a, t, _tm, _e, p) => { const o = openAt(ev, p), e = o ?? ease(seg(t, 0.15, 0.9)), w = lerp(24, 4, e); a.a(key("d")).setAttribute("d", P([[-12, -43], [-12 + w, -43 - e * 3], [-12 + w, e * 3], [-12, 0]])); op(a, key("l"), lerp(0.3, 1, e)); });
      break;
    }
    case "gate": {
      let bars = "";
      for (let i = 0; i < 6; i++) bars += rect(-15 + i * 6, -34, 1.6, 34) + " ";
      svg = path("far", rect(-19, -40, 4, 40) + " " + rect(15, -40, 4, 40)) + group(path("line", "M-15,-30 H15 M-15,-8 H15") + path("far", bars), key("g"));
      mv.push((a, t, _tm, _e, p) => tf(a, key("g"), "translate(-15,0) scale(" + f(1 - (openAt(ev, p) ?? ease(seg(t, 0.3, 1))) * 0.6) + ",1) translate(15,0)"));
      break;
    }
    case "flower": {
      let st = "", hd = "";
      for (let i = 0; i < 5; i++) { const x = -16 + i * 8 + r() * 3, h = 9 + r() * 9; st += "M" + f(x) + ",0 L" + f(x) + "," + f(-h) + " "; hd += circle(x, -h - 1.5, 2.4) + " "; }
      svg = group(path("line", st) + path("key", hd), key("g"));
      mv.push((a, _t, tm) => tf(a, key("g"), "skewX(" + f(Math.sin(tm * 1.3 + k) * 4 * wind) + ")"));
      break;
    }
    case "bench": svg = path("far", rect(-20, -11, 40, 3) + " " + rect(-20, -21, 40, 3) + " " + rect(-18, -8, 2.5, 8) + " " + rect(15.5, -8, 2.5, 8) + " " + rect(-18, -21, 2.5, 13) + " " + rect(15.5, -21, 2.5, 13)); break;
    case "bed": svg = path("far", rect(-43, -14, 86, 10) + " " + rect(-43, -30, 5, 30) + " " + rect(38, -20, 5, 20)) + path("lit", P([[-37, -14], [-24, -14], [-24, -19], [-37, -19]])) + path("bg2", P([[-20, -14], [37, -14], [37, -17], [-20, -18]])); break;
    case "shelf": {
      let b = "";
      for (let row = 0; row < 4; row++) for (let x = -18; x < 17;) { const w = 2.2 + r() * 2.6, h = 9 + r() * 6; if (r() > 0.12) b += rect(x, -6 - row * 17 - h, w, h) + " "; x += w + 0.6; }
      svg = path("edge", rect(-21, -72, 42, 72)) + path("far", b) + path("line", "M-21,-6 H21 M-21,-23 H21 M-21,-40 H21 M-21,-57 H21");
      break;
    }
    case "piano": svg = path("far", rect(-30, -42, 60, 22) + " " + rect(-30, -20, 60, 4) + " " + rect(-27, -16, 3, 16) + " " + rect(24, -16, 3, 16)) + path("lit", rect(-27, -22, 54, 3)) + path("line", "M-20,-22 v3 M-12,-22 v3 M-4,-22 v3 M4,-22 v3 M12,-22 v3 M20,-22 v3"); break;
    case "stairs": {
      let d = "";
      for (let i = 0; i < 8; i++) d += rect(-35 + i * 8, -10 * (i + 1), 70 - i * 8, 10) + " ";
      svg = path("edge", d) + path("line", "M-35,-6 L29,-78 M-35,-18 L29,-90");
      break;
    }
    case "umbrella":
      svg = group(path("key", "M-20,-28 Q0,-46 20,-28 Q15,-31 10,-28 Q5,-31 0,-28 Q-5,-31 -10,-28 Q-15,-31 -20,-28 Z"), key("c")) + path("line", "M0,-38 V-2 q0,3 -3,3");
      if (ev.length) mv.push((a, _t, _tm, _e, p) => { const o = openAt(ev, p) ?? 1; tf(a, key("c"), "translate(0,-38) scale(" + f(0.18 + 0.82 * o) + "," + f(0.6 + 0.4 * o) + ") translate(0,38)"); });
      break;
    case "suitcase": svg = path("far", rect(-13, -17, 26, 17)) + path("line", "M-4,-17 v-3 h8 v3") + path("bg2", rect(-13, -10, 26, 1.6)); break;
    case "bicycle": svg = path("line", circle(-14, -9, 9) + " " + circle(14, -9, 9) + " M-14,-9 L-4,-20 L10,-20 L14,-9 M-4,-20 L0,-9 L10,-20 M-6,-24 h5 M10,-20 L9,-25 h4"); break;
    case "train": {
      let cars = "", wins = "";
      for (let i = 0; i < 4; i++) { const x = -120 + i * 60; cars += rect(x, -36, 56, 30) + " "; for (let w = 0; w < 5; w++) wins += rect(x + 5 + w * 10, -30, 6, 7) + " "; }
      svg = group(path("far", cars + P([[120, -36], [130, -30], [130, -6], [116, -6]])) + path("lit", wins, key("w")) + path("fig", circle(-110, -4, 4) + " " + circle(-60, -4, 4) + " " + circle(-10, -4, 4) + " " + circle(40, -4, 4) + " " + circle(90, -4, 4)), key("g"))
        + path("line", "M-180,0 H180");
      mv.push((a, t) => { tf(a, key("g"), "translate(" + f(travels ? 0 : lerp(-140, 20, ease(t))) + ",0)"); op(a, key("w"), c.night || c.low ? 1 : 0.25); });
      break;
    }
    case "fence": {
      let posts = "";
      for (let x = -170; x <= 170; x += 14) posts += rect(x - 1, -14, 2, 14) + " ";
      svg = path("far", posts) + path("line", "M-170,-11 H170 M-170,-5 H170");
      break;
    }
    case "well": svg = path("far", rect(-14, -14, 28, 14)) + path("shade", rect(2, -14, 12, 14)) + path("far", rect(-12, -38, 2.5, 24) + " " + rect(9.5, -38, 2.5, 24)) + path("edge", P([[-18, -36], [0, -46], [18, -36]])) + path("line", "M0,-36 V-20"); break;
    case "grave": {
      const kind = r();
      svg = kind < 0.5 ? path("far", "M-7,0 V-16 Q-7,-24 0,-24 Q7,-24 7,-16 V0 Z") : kind < 0.8 ? path("far", rect(-1.6, -24, 3.2, 24) + " " + rect(-7, -18, 14, 3)) : path("far", rect(-8, -14, 16, 14));
      svg += path("shade", ellipse(4, 0, 9, 1.6));
      break;
    }
    case "rock": svg = path("far", "M-18,0 C-17,-9 -9,-17 0,-17 C9,-16 16,-9 18,0 Z") + path("shade", "M2,0 C6,-6 9,-12 4,-16 C12,-13 16,-7 18,0 Z"); break;
    case "tent": svg = path("far", P([[-26, 0], [0, -36], [26, 0]])) + path("shade", P([[0, -36], [26, 0], [6, 0]])) + path("lit", P([[-5, 0], [0, -14], [5, 0]]), key("l"));
      mv.push((a) => op(a, key("l"), lit(c.night, c.low))); break;
    case "bridge": svg = path("far", "M-170,-16 L170,-16 L170,-11 L120,-11 Q60,-2 0,-11 Q-60,-2 -120,-11 L-170,-11 Z M-4,-11 L-4,10 L4,10 L4,-11 Z M-124,-11 L-124,10 L-116,10 L-116,-11 Z M116,-11 L116,10 L124,10 L124,-11 Z") + path("line", "M-170,-22 H170 M-150,-16 v-6 M-100,-16 v-6 M-50,-16 v-6 M0,-16 v-6 M50,-16 v-6 M100,-16 v-6 M150,-16 v-6"); break;
    case "dog": svg = group(path("fig", "M-14,-10 L8,-10 L12,-16 L17,-16 L18,-11 L14,-9 L12,0 L9,0 L8,-6 L-8,-6 L-9,0 L-12,0 L-13,-7 L-18,-14 Z"), key("g"));
      mv.push((a, _t, tm) => tf(a, key("g"), "translate(0," + f(-Math.abs(Math.sin(tm * 3)) * 0.8) + ")")); break;
    case "cat": svg = path("fig", "M-8,0 C-10,-6 -8,-12 -2,-12 L-1,-17 L2,-13 L5,-17 L6,-11 C9,-8 8,-2 6,0 Z") + path("line", "M0,0", key("t"));
      mv.push((a, _t, tm) => { const s = Math.sin(tm * 1.5) * 3; a.a(key("t")).setAttribute("d", "M-8,-1 C-14,-2 " + f(-16 + s) + ",-8 " + f(-13 + s) + ",-12"); }); break;
    case "horse": svg = group(path("fig", "M-20,-22 L10,-22 L16,-34 L22,-34 L24,-28 L18,-26 L16,-14 L15,0 L12,0 L11,-12 L-12,-12 L-14,0 L-17,0 L-18,-14 L-24,-12 L-22,-20 Z"), key("g"));
      mv.push((a, t, tm, _e, p) => { const run = travels && Math.abs((travelAt(ev, p) ?? 0) % 1) > 0.01; tf(a, key("g"), "translate(" + f(travels ? 0 : lerp(-10, 10, t)) + "," + f(-Math.abs(Math.sin(tm * (run ? 9 : 1.2))) * (run ? 2.5 : 0.6)) + ")"); }); break;
  }
  return { svg, movers: mv };
}

/** A soft ground shadow for a thing of width w, cast away from the light. */
export function shadow(w: number, lightDx: number, h: number): string {
  const dx = Math.max(-1, Math.min(1, -lightDx / 160)) * h * 0.35;
  return path("shade", ellipse(dx * 0.5, 0, w * 0.5 + Math.abs(dx) * 0.6, Math.max(1, w * 0.07)));
}

