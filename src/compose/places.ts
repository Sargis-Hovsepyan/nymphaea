// The setting of a composed scene: the land and water outside, or the walls, floor and fixtures
// inside. Far layers are drawn fainter (atmospheric perspective) and slide a little with the beat
// (parallax). Ridges are smooth noise, so hills roll, mountains have lit and shaded faces and snow,
// and dunes have a shadow side. The layout seed shapes the place, so it looks the same each time
// the story returns to it. Pure markup and movers.
import { lerp } from "../scenes/helpers";
import { P, circle, ellipse, f, rect, type Pt } from "../vscenes/shapes";
import type { Layout } from "./layout";
import { peaks, ridgeAt, ridgeFill, ridgePts, smooth, type Rng } from "./noise";
import type { Spec } from "./spec";
import { group, path, tf, thing, tree, speciesFor, type Ctx, type Mover } from "./things";

export interface Backdrop { back: string; ground: string; front: string; movers: Mover[]; win?: WinBox }

const layer = (k: string, inner: string, opacity = 1) => group(inner, k, "", opacity < 1 ? 'opacity="' + f(opacity) + '"' : "");

function grass(r: Rng, n: number, y0: number, y1: number, key: string, sky: string, a: number): { svg: string; mv: Mover } {
  const blades: [number, number, number][] = Array.from({ length: n }, () => { const y = y0 + r() * (y1 - y0), k = (y - y0) / Math.max(1, y1 - y0); return [r() * 330 - 5, y, (3 + r() * 5) * (0.5 + k)]; });
  const wind = (sky === "wind" || sky === "storm" ? 2.6 : 1) * (0.6 + a);
  return {
    svg: path("line", "M0,0", key),
    mv: (A, _t, tm) => A.a(key).setAttribute("d", blades.map(([x, y, h], i) => { const s = Math.sin(tm * 1.6 + i + x * 0.02) * wind; return "M" + f(x) + "," + f(y) + " q" + f(s * 0.5) + "," + f(-h / 2) + " " + f(s * 1.1) + "," + f(-h); }).join(" ")),
  };
}

/** A row of buildings across the frame with varied roofs; windows listed for lighting. */
function skyline(r: Rng, base: number, hMin: number, hMax: number, wMin: number, wMax: number, gap: number, wins: [number, number, number][] | null): string {
  let d = "", x = -10;
  while (x < 330) {
    const w = wMin + r() * (wMax - wMin), h = hMin + r() * (hMax - hMin), top = base - h, kind = r();
    d += rect(x, top, w, h + 40) + " ";
    if (kind < 0.18) d += P([[x - 1, top], [x + w / 2, top - w * 0.45], [x + w + 1, top]]) + " ";
    else if (kind < 0.26) d += "M" + f(x + w * 0.2) + "," + f(top) + " A" + f(w * 0.3) + "," + f(w * 0.3) + " 0 0,1 " + f(x + w * 0.8) + "," + f(top) + " Z ";
    else if (kind < 0.4) d += rect(x + w * 0.6, top - 7, w * 0.25, 7) + " " + rect(x + w * 0.62, top - 9, w * 0.21, 2) + " ";
    else if (kind < 0.52) d += rect(x + w * 0.45, top - 14, 1.2, 14) + " ";
    if (wins) for (let wy = top + 5; wy < base - 4; wy += 7) for (let wx = x + 3; wx < x + w - 4; wx += 6) wins.push([wx, wy, r()]);
    x += w + gap * (0.5 + r());
  }
  return d;
}

export function backdrop(s: Spec, L: Layout, id: string, c: Ctx, rL: Rng): Backdrop {
  const hy = L.cam.hy, mv: Mover[] = [];
  const back: string[] = [], grd: string[] = [], front: string[] = [];
  const winter = s.season === "winter" || s.sky === "snow";
  const parallax = (k: string, amt: number) => mv.push((a, t) => tf(a, k, "translate(" + f((t - 0.5) * -amt) + ",0)"));

  if (L.indoor) return interior(s, L, id, c, rL);

  if (s.place === "inner") return { back: "", ground: "", front: "", movers: [] };

  // Far land: soft ridges, fainter with distance.
  const far = (seed: number, y0: number, amp: number, op: number, cls: string, k: string, sharp = false, scale = 1) => {
    const pts = ridgePts(seed, y0, amp, { sharp, scale });
    back.push(layer(k, path(cls, ridgeFill(pts)), op)); parallax(k, sharp ? 4 : 6);
    return pts;
  };
  const S = s.seed;
  switch (s.place) {
    case "city": case "station": {
      const wins: [number, number, number][] = [];
      back.push(layer("L0", path("bg2", skyline(rL, hy, 30, 80, 12, 30, 1, null)), 0.55));
      back.push(layer("L1", path("far", skyline(rL, hy + 2, 18, 56, 18, 40, 5, wins)) + path("lit", "M0,0", "win"), 0.9));
      parallax("L0", 4); parallax("L1", 9);
      mv.push((a, _t, _tm, e) => { const on = c.night ? 0.15 + 0.55 * e : c.low ? 0.1 + 0.3 * e : 0.03; a.a("win").setAttribute("d", wins.filter((w) => w[2] < on).map((w) => rect(w[0], w[1], 2.4, 3.4)).join(" ") || "M0,0"); });
      if (s.place === "station") {
        // platform, rails to the vanishing point, a canopy on columns with a clock
        const py = hy + (200 - hy) * 0.45, vx = 160 + (rL() - 0.5) * 80;
        grd.push(path("edge", rect(-5, hy, 330, 210 - hy)));
        grd.push(path("bg2", P([[-10, py], [330, py], [330, py + 4], [-10, py + 4]])));
        grd.push(path("line", "M" + f(vx) + "," + f(hy) + " L-60,200 M" + f(vx) + "," + f(hy) + " L40,200 M" + f(vx) + "," + f(hy) + " L-10,200"));
        let cols = "";
        for (let k = 0; k < 6; k++) { const x = 30 + k * 56; cols += rect(x, 18, 2.5, py - 18) + " "; }
        front.push(layer("L2", path("far", rect(-10, 6, 340, 12) + " " + cols) + path("edge", circle(250, 30, 8)) + path("lit", circle(250, 30, 6.5)), 1));
        parallax("L2", 14);
      } else {
        grd.push(path("edge", rect(-5, hy, 330, 210 - hy)));
        grd.push(path("bg2", P([[-10, hy + 14], [330, hy + 14], [330, hy + 17], [-10, hy + 17]])));
      }
      break;
    }
    case "village": case "graveyard": {
      far(S, hy - 6, 26, 0.5, "bg2", "L0", false, 1.4);
      if (s.place === "village") {
        let d = "";
        const ws: [number, number][] = [];
        for (let x = -6; x < 330;) {
          const w = 16 + rL() * 16, h = 12 + rL() * 10, kind = rL();
          d += rect(x, hy - h, w, h + 4) + " " + (kind < 0.7 ? P([[x - 3, hy - h], [x + w / 2, hy - h - 11], [x + w + 3, hy - h]]) : P([[x - 2, hy - h], [x + 3, hy - h - 8], [x + w - 3, hy - h - 8], [x + w + 2, hy - h]])) + " ";
          if (rL() < 0.15) d += rect(x + w / 2 - 3, hy - h - 30, 6, 22) + " " + P([[x + w / 2 - 4, hy - h - 30], [x + w / 2, hy - h - 42], [x + w / 2 + 4, hy - h - 30]]) + " ";
          ws.push([x + w / 2 - 2, hy - h + 4]); x += w + 5 + rL() * 14;
        }
        back.push(layer("L1", path("far", d) + path("lit", "M0,0", "win"), 0.85)); parallax("L1", 9);
        mv.push((a, _t, _tm, e) => a.a("win").setAttribute("d", ws.filter((_, i) => (c.night || c.low) && (i * 0.37) % 1 < 0.2 + 0.7 * e).map(([x, y]) => rect(x, y, 3.6, 3.6)).join(" ") || "M0,0"));
      } else {
        // a church on the rise and rows of graves coming forward
        const cx = 60 + rL() * 200;
        back.push(layer("L1", path("far", rect(cx - 22, hy - 24, 44, 26) + " " + P([[cx - 25, hy - 24], [cx, hy - 40], [cx + 25, hy - 24]]) + " " + rect(cx + 14, hy - 56, 10, 34) + " " + P([[cx + 12, hy - 56], [cx + 19, hy - 74], [cx + 26, hy - 56]])), 0.8));
        parallax("L1", 8);
        let g = "";
        for (let row = 0; row < 4; row++) {
          const y = hy + 10 + row * row * 9 + row * 6, sc = 0.25 + row * 0.22;
          for (let k = 0; k < 7; k++) { const x = 20 + k * 46 + (row % 2) * 20 + (rL() - 0.5) * 10; if (Math.abs(x - L.focusX) < 20 * sc + 8 && row > 1) continue; g += group(thing("grave", row * 10 + k, id, { ...c, r: rL }).svg, "", "translate(" + f(x) + "," + f(y) + ") scale(" + f(sc) + ")"); }
        }
        grd.push(path("edge", rect(-5, hy, 330, 210 - hy)) + g);
        const t = tree("bare", 80, rL, "gtr", s.season);
        front.push(group(t.svg, "", "translate(" + f(L.focusX > 160 ? 30 : 290) + ",206) scale(1.3)"));
      }
      if (s.place === "village") grd.push(path("edge", rect(-5, hy + 2, 330, 210 - hy)));
      break;
    }
    case "garden": case "field": case "hill": case "road": {
      if (s.place === "hill") {
        for (let k = 0; k < 4; k++) {
          const pts = ridgePts(S + k * 17, hy + k * 14, 26 - k * 3, { scale: 1.6 - k * 0.2 });
          back.push(layer(k < 2 ? "L" + k : k === 3 ? "L2" : "", path(k < 2 ? "bg2" : "edge", ridgeFill(pts)), 0.45 + k * 0.18));
          if (k === 1 && !winter) {
            const x = 60 + rL() * 200, y = ridgeAt(pts, x), t = tree(speciesFor("field", s.season, rL), 30, rL, "htr", s.season);
            back.push(group(t.svg, "", "translate(" + f(x) + "," + f(y + 1) + ")"));
          }
        }
        parallax("L0", 4); parallax("L1", 8);
      } else {
        far(S, hy - 2, s.place === "road" ? 16 : 24, 0.5, "bg2", "L0", false, 1.3);
        if (s.place === "field" || s.place === "garden") {
          // a hedgerow of small trees along the far edge
          let d = "";
          for (let x = -10; x < 330; x += 10 + rL() * 14) d += circle(x, hy - 3 - rL() * 4, 4 + rL() * 5) + " ";
          // The band is wound like the circles (counter-clockwise), so where they overlap there is no hole.
          back.push(layer("L1", path("far", d + P([[-10, hy + 2], [330, hy + 2], [330, hy - 4], [-10, hy - 4]])), 0.8)); parallax("L1", 8);
        }
      }
      grd.push(path("edge", rect(-5, hy + 1, 330, 210 - hy)));
      if (s.place === "field") {
        const vx = 160 + (rL() - 0.5) * 200;
        let fu = "";
        for (let k = -8; k <= 8; k++) fu += "M" + f(vx + k * 6) + "," + f(hy + 3) + " L" + f(vx + k * 70) + ",204 ";
        grd.push(layer("", path("line", fu), 0.2));
      }
      if (s.place === "garden") {
        const px0 = L.focusX;
        grd.push(path("bg2", P([[px0 - 3, hy + 3], [px0 + 3, hy + 3], [px0 + 60, 204], [px0 - 60, 204]])));
        let hedge = "";
        for (let x = -10; x < 330; x += 18 + rL() * 8) if (Math.abs(x - px0) > 30) hedge += circle(x, hy + 4, 7 + rL() * 3) + " ";
        grd.push(path("far", hedge));
      }
      if (s.place === "road") {
        const vx = 160 + (rL() - 0.5) * 60;
        grd.push(path("bg2", P([[vx - 2, hy + 1], [vx + 2, hy + 1], [300, 204], [20, 204]])));
        grd.push(path("lit", "M0,0", "ds"));
        mv.push((a, _t, tm) => { let d = ""; for (let k = 0; k < 7; k++) { const q = ((k / 7) + tm * 0.1) % 1, y = hy + (204 - hy) * q * q, w = 0.4 + q * 3.6, l = 1 + q * 12; d += rect(lerp(vx, 160, q) - w / 2, y, w, l) + " "; } a.a("ds").setAttribute("d", d); });
        let poles = "", wire = "M" + f(vx + 6) + "," + f(hy - 3);
        for (let k = 1; k <= 6; k++) { const q = k / 6, x = vx + 6 + (330 - vx) * q * q * 0.9, y = hy + (204 - hy) * q * q, h = 4 + q * q * 70; poles += rect(x - 0.4 - q, y - h, 0.8 + q * 2, h) + " "; wire += " L" + f(x) + "," + f(y - h + 2); }
        grd.push(path("far", poles) + path("line", wire));
      }
      if (s.place !== "road") { const gr = grass(rL, s.place === "hill" ? 26 : 40, hy + (200 - hy) * 0.35, 202, "gr", s.sky, s.a); grd.push(gr.svg); mv.push(gr.mv); }
      break;
    }
    case "forest": {
      far(S, hy - 4, 30, 0.45, "bg2", "L0", false, 0.5);
      const sp = speciesFor("forest", s.season, rL);
      let mid = "";
      for (let k = 0; k < 11; k++) { const x = -20 + k * 34 + rL() * 14, h = 50 + rL() * 30; mid += group(tree(sp === "bare" ? "bare" : rL() < 0.6 ? "pine" : sp, h, rL, "", s.season).svg, "", "translate(" + f(x) + "," + f(hy + 6) + ")"); }
      back.push(layer("L1", mid, 0.75)); parallax("L1", 9);
      grd.push(path("edge", rect(-5, hy + 4, 330, 210 - hy)));
      const gr = grass(rL, 26, hy + 16, 202, "gr", s.sky, s.a); grd.push(gr.svg); mv.push(gr.mv);
      // two near trunks framing the picture
      const left = L.focusX > 160;
      front.push(layer("L2", path("fig", P([[left ? -10 : 300, -5], [left ? 16 : 330, -5], [left ? 22 : 330, 205], [left ? -10 : 294, 205]]) + " " + P([[left ? 270 : 6, -5], [left ? 278 : 13, -5], [left ? 281 : 15, 205], [left ? 266 : 3, 205]])), 1));
      parallax("L2", 18);
      // light through the canopy
      if (!c.night && s.sky !== "rain" && s.sky !== "storm") back.push(layer("", path("beam", P([[L.light.x - 10, 0], [L.light.x + 6, 0], [L.light.x - 40, 205], [L.light.x - 90, 205]]), "", 'fill="url(#bm' + id + ')"'), 0.5));
      break;
    }
    case "mountain": {
      const pts0 = ridgePts(S, hy - 34, 90, { sharp: true, scale: 1.1 }), pts1 = ridgePts(S + 9, hy + 2, 50, { sharp: true, scale: 0.8 });
      back.push(layer("L0", path("bg2", ridgeFill(pts0)) + caps(pts0, L.light.x) , 0.55));
      back.push(layer("L1", path("far", ridgeFill(pts1)) + faces(pts1, L.light.x), 0.9));
      parallax("L0", 4); parallax("L1", 9);
      grd.push(path("edge", rect(-5, hy + 6, 330, 210 - hy)));
      let pines = "";
      for (let k = 0; k < 9; k++) { const x = rL() * 330, y = hy + 10 + rL() * 30; if (Math.abs(x - L.focusX) > 24) pines += group(tree("pine", 18 + (y - hy) * 0.8, rL, "", s.season).svg, "", "translate(" + f(x) + "," + f(y) + ")"); }
      grd.push(pines);
      break;
    }
    case "desert": {
      const d0 = ridgePts(S, hy - 4, 26, { scale: 2 }), d1 = ridgePts(S + 5, hy + 26, 30, { scale: 1.6 }), d2 = ridgePts(S + 11, hy + 60, 26, { scale: 1.3 });
      back.push(layer("L0", path("bg2", ridgeFill(d0)), 0.6));
      back.push(layer("L1", path("far", ridgeFill(d1)) + duneShade(d1, L.light.x), 0.85));
      grd.push(path("edge", ridgeFill(d2)) + duneShade(d2, L.light.x));
      parallax("L0", 4); parallax("L1", 9);
      break;
    }
    case "river": case "lake": case "sea": case "shore": case "harbour": {
      const [w0, w1] = L.water || [hy, 200];
      if (s.place === "lake" || s.place === "river") {
        const pts = far(S, hy - 2, s.place === "lake" ? 22 : 28, 0.6, "bg2", "L0", false, 0.7);
        // the far shore's reflection, faint and flipped
        const mirror: Pt[] = pts.map(([x, y]) => [x, w0 + (w0 - y) * 0.6]);
        back.push(path("edge", rect(-5, hy - 1, 330, w0 - hy + 2)));
        back.push(path("bg2", rect(-5, w0, 330, w1 - w0)));
        back.push(layer("", path("bg2", smooth(mirror) + " L332," + f(w0) + " L-12," + f(w0) + " Z"), 0.4));
      } else {
        back.push(path("line", "M-5," + f(hy) + " H330"));
        if (rL() < 0.6) { const left = L.light.x > 160; back.push(layer("L0", path("bg2", left ? "M-10," + f(hy) + " C30," + f(hy - 22) + " 70," + f(hy - 12) + " 110," + f(hy) + " Z" : "M330," + f(hy) + " C290," + f(hy - 22) + " 250," + f(hy - 12) + " 210," + f(hy) + " Z"), 0.6)); parallax("L0", 4); }
        if (s.place === "harbour") {
          const wins: [number, number, number][] = [];
          back.push(layer("L1", path("far", skyline(rL, hy, 10, 30, 22, 44, 8, wins) + " " + P([[60, hy - 30], [62, hy - 60], [110, hy - 60], [110, hy - 57], [65, hy - 57], [64, hy - 30]])), 0.7));
          parallax("L1", 7);
        }
        back.push(path("bg2", rect(-5, hy, 330, w1 - hy)));
      }
      // the light's road on the water
      back.push(path("beam", "M0,0", "ref", 'fill="url(#bm' + id + ')"'));
      const dim = s.sky !== "clear" && s.sky !== "wind";
      mv.push((a, t) => { const x = L.light.x + (t - 0.5) * 30; a.a("ref").setAttribute("d", dim || L.light.y > w0 ? "M0,0" : P([[x - 5, w0 + 1], [x + 5, w0 + 1], [x + 34, w1], [x - 34, w1]])); });
      back.push(path("line", "M0,0", "wv", 'opacity=".6"'));
      const calm = s.place === "lake" ? 0.4 : 1, rows = Math.max(3, Math.round((w1 - w0) / 14));
      mv.push((a, _t, tm) => {
        let d = "";
        for (let row = 0; row < rows; row++) {
          const k = row / rows, y = w0 + 6 + (w1 - w0 - 8) * k * k, amp = (0.4 + k * 2.4) * calm * (0.6 + s.a + (s.sky === "storm" || s.sky === "wind" ? 1 : 0)), seg = 12 + k * 20;
          if (s.place === "river" || s.place === "lake") { for (let q = 0; q < 4; q++) { const x = ((q * 97 + row * 41 + tm * (8 + row * 3)) % 380) - 30; d += "M" + f(x) + "," + f(y) + " h" + f(10 + k * 16) + " "; } continue; }
          // Broken strokes, short and sparse far out, longer near: a full-width line reads as a stripe.
          const n = 3 + Math.round(k * 3), len = 18 + k * 60;
          for (let q = 0; q < n; q++) {
            const x0 = ((q * 131 + row * 57 + tm * (3 + row * 1.5) * (row % 2 ? 1 : -1)) % 420 + 420) % 420 - 50;
            d += "M" + f(x0) + "," + f(y + Math.sin(x0 * 0.05 + tm + row) * amp);
            for (let x = x0 + seg; x <= x0 + len; x += seg) d += " L" + f(x) + "," + f(y + Math.sin(x * 0.05 + tm * (1 + row * 0.2) + row) * amp);
            d += " ";
          }
        }
        a.a("wv").setAttribute("d", d);
      });
      // the near land
      if (L.land.length && L.land[L.land.length - 1][0] < 200) {
        const y0 = w1;
        if (s.place === "harbour") {
          let bol = "";
          for (let x = 20; x < 320; x += 60 + rL() * 20) bol += rect(x, y0 - 5, 5, 6) + " " + rect(x - 1, y0 - 6, 7, 1.6) + " ";
          grd.push(path("edge", rect(-5, y0, 330, 210 - y0)) + path("far", rect(-5, y0, 330, 3) + " " + bol));
        } else {
          const sh = ridgePts(S + 3, y0 + 4, 6, { scale: 1.4 });
          grd.push(path(s.place === "river" || s.place === "lake" ? "edge" : "board", ridgeFill(sh)));
          if (s.place === "sea" || s.place === "shore") {
            grd.push(path("lit", "M0,0", "foam", 'opacity=".55"'));
            mv.push((a, _t, tm) => { const k = 0.5 + 0.5 * Math.sin(tm * 0.8); a.a("foam").setAttribute("d", smooth(sh.map(([x, y]): Pt => [x, y - 2 - k * 3])) + " " + smooth(sh.slice().reverse().map(([x, y]): Pt => [x, y - 0.6 - k * 2.4])) + " Z"); });
            if (s.place === "shore") { let gs = ""; for (let k = 0; k < 14; k++) { const x = rL() * 330, y = 186 + rL() * 14; gs += "M" + f(x) + "," + f(y) + " q-2,-6 -4,-10 M" + f(x) + "," + f(y) + " q2,-7 5,-9 "; } grd.push(path("line", gs)); }
          }
          if (s.place === "lake") { let rd = ""; for (let k = 0; k < 18; k++) { const x = (L.focusX > 160 ? 0 : 230) + rL() * 90, y = 200; rd += "M" + f(x) + "," + f(y) + " q" + f((rL() - 0.5) * 6) + "," + f(-20 - rL() * 16) + " " + f((rL() - 0.5) * 8) + "," + f(-30 - rL() * 18) + " "; } front.push(path("line", rd)); }
        }
      }
      if (s.place === "harbour") {
        let boats = "";
        for (let k = 0; k < 3; k++) { const x = 30 + k * 110 + rL() * 30, y = w0 + (w1 - w0) * (0.3 + rL() * 0.5), sc = 0.25 + (y - hy) / 100; if (Math.abs(x - L.focusX) < 30) continue; boats += group(path("far", P([[-22, -4], [22, -4], [15, 4], [-15, 4]])) + path("line", "M0,-4 V-30"), "", "translate(" + f(x) + "," + f(y) + ") scale(" + f(sc) + ")"); }
        back.push(group(boats, "hb")); mv.push((a, _t, tm) => tf(a, "hb", "translate(0," + f(Math.sin(tm * 1.1) * 0.8) + ")"));
      }
      break;
    }
  }
  if (winter && !["sea", "harbour"].includes(s.place)) grd.push(layer("", path("lit", P([[-5, hy + 2], [330, hy + 2], [330, 210], [-5, 210]])), 0.18));
  return { back: back.join(""), ground: grd.join(""), front: front.join(""), movers: mv };
}

/** Snow on the highest peaks, on the far range. */
function caps(pts: Pt[], _lx: number): string {
  let d = "";
  const top = Math.min(...pts.map((p) => p[1]));
  peaks(pts).forEach((i) => {
    const [x, y] = pts[i];
    if (y > top + 24) return;
    d += P([[x, y], [x + 9, y + 10], [x + 4, y + 8], [x, y + 12], [x - 4, y + 8], [x - 9, y + 10]]) + " ";
  });
  return d ? path("lit", d, "", 'opacity=".75"') : "";
}

/** The shaded side of each peak: from the summit down the side away from the light. */
function faces(pts: Pt[], lx: number): string {
  let d = "";
  peaks(pts).forEach((i) => {
    const [x, y] = pts[i], dir = lx < x ? 1 : -1, j = Math.min(pts.length - 1, Math.max(0, i + dir * 2));
    d += P([[x, y], [pts[j][0], pts[j][1]], [pts[j][0], 206], [x + dir * 4, 206]]) + " ";
  });
  return d ? path("shade", d) : "";
}

/** The shadow side of dunes: the slope after each crest, away from the light. */
function duneShade(pts: Pt[], lx: number): string {
  let d = "";
  peaks(pts).forEach((i) => {
    const [x, y] = pts[i], dir = lx < x ? 1 : -1, j = Math.min(pts.length - 1, Math.max(0, i + dir * 3));
    d += "M" + f(x) + "," + f(y) + " Q" + f((x + pts[j][0]) / 2) + "," + f(y + 3) + " " + f(pts[j][0]) + "," + f(pts[j][1]) + " L" + f(pts[j][0]) + "," + f(pts[j][1] + 18) + " Q" + f(x + dir * 6) + "," + f(y + 22) + " " + f(x) + "," + f(y) + " Z ";
  });
  return d ? path("shade", d) : "";
}

/* ---------------- inside ---------------- */

function interior(s: Spec, L: Layout, id: string, c: Ctx, rL: Rng): Backdrop {
  const hy = L.cam.hy, wall = L.wall, u = wall - hy, ceil = hy - u * 0.55, vx = 160 + (rL() - 0.5) * 40;
  const mv: Mover[] = [], back: string[] = [], grd: string[] = [], front: string[] = [];
  // ceiling, back wall, floor, all converging on the vanishing point
  back.push(path("edge", P([[-5, -5], [330, -5], [330, ceil], [-5, ceil]])));
  let beams = "";
  for (let k = 0; k < 7; k++) { const x = -40 + k * 66; beams += "M" + f(vx + (x - vx) * 0.25) + "," + f(ceil) + " L" + f(x) + ",-5 "; }
  back.push(layer("", path("line", beams), 0.08));
  back.push(path("bg2", rect(-5, ceil, 335, wall - ceil)));
  back.push(layer("", path("line", "M-5," + f(wall) + " H330 M-5," + f(ceil) + " H330"), 0.5));
  const floorCls = s.place === "hall" || s.place === "church" ? "board" : "edge";
  grd.push(path(floorCls, rect(-5, wall, 335, 210 - wall)));
  let boards = "";
  for (let k = 0; k < 11; k++) { const x = -120 + k * 56; boards += "M" + f(vx + (x - vx) * 0.25) + "," + f(wall) + " L" + f(x) + ",205 "; }
  if (s.place === "hall") for (let k = 1; k < 5; k++) { const y = wall + (205 - wall) * (k * k) / 25; boards += "M-5," + f(y) + " H330 "; }
  grd.push(layer("", path("line", boards), 0.1));

  // the main window, the light of the scene
  const ww = u * (s.place === "church" ? 0.7 : 1.05), wh = Math.min(u * (s.place === "church" ? 1.6 : 1.05), wall - u * 0.3 - ceil - 6), wx = L.light.x - ww / 2, wy = wall - u * 0.3 - wh;
  const winShape = s.place === "church" ? "M" + f(wx) + "," + f(wy + wh) + " V" + f(wy + ww * 0.5) + " Q" + f(wx) + "," + f(wy) + " " + f(wx + ww / 2) + "," + f(wy - ww * 0.15) + " Q" + f(wx + ww) + "," + f(wy) + " " + f(wx + ww) + "," + f(wy + ww * 0.5) + " V" + f(wy + wh) + " Z" : rect(wx, wy, ww, wh);
  if (s.place === "cafe") {
    // a wide shop window onto the street
    const sx = 20, sw = 280, sy = ceil + u * 0.12, sh = wall - u * 0.3 - sy;
    back.push(path("sky", rect(sx, sy, sw, sh), "", 'fill="url(#sk' + id + ')"'));
    back.push(layer("", path("far", skyline(rL, sy + sh, 10, sh * 0.7, 14, 30, 3, null)), 0.45));
    back.push(path("edge", rect(sx - 3, sy - 3, sw + 6, 3) + " " + rect(sx - 3, sy + sh, sw + 6, 4) + " " + rect(sx + sw / 3, sy, 2, sh) + " " + rect(sx + (sw * 2) / 3, sy, 2, sh)));
    let tables = "";
    for (let k = 0; k < 3; k++) { const x = 50 + k * 110, sc = 0.7 + rL() * 0.1; if (Math.abs(x - L.focusX) < 30) continue; tables += group(path("far", "M-14,-22 H14 V-20 H-14 Z M-1,-20 H1 V0 H-1 Z M-7,0 H7") + thing("chair", 90 + k, id, c).svg, "", "translate(" + f(x) + "," + f(wall + 6) + ") scale(" + f(sc) + ")"); }
    grd.push(tables);
    let pend = "";
    for (let k = 0; k < 4; k++) { const x = 40 + k * 80; pend += "M" + f(x) + "," + f(ceil) + " V" + f(ceil + 16) + " " + P([[x - 6, ceil + 22], [x + 6, ceil + 22], [x + 3, ceil + 16], [x - 3, ceil + 16]]) + " "; }
    back.push(path("far", pend));
  } else {
    back.push(path("sky", winShape, "", 'fill="url(#sk' + id + ')"'));
  }
  const win = { x: wx, y: wy, w: ww, h: wh, shape: winShape };

  switch (s.place) {
    case "kitchen": {
      const left = L.light.x > 160, cx0 = left ? 0 : 200, cx1 = left ? 120 : 330;
      back.push(path("far", rect(cx0, wall - u * 0.5, cx1 - cx0, u * 0.5) + " " + rect(cx0, ceil + 6, cx1 - cx0, u * 0.35)));
      let cab = "";
      for (let x = cx0 + 4; x < cx1 - 10; x += 26) cab += rect(x, wall - u * 0.44, 22, u * 0.4) + " " + rect(x, ceil + 9, 22, u * 0.29) + " ";
      back.push(path("line", cab) + path("lit", rect(cx0, wall - u * 0.52, cx1 - cx0, 2)));
      back.push(group(thing("cup", 80, id, c).svg, "", "translate(" + f((cx0 + cx1) / 2) + "," + f(wall - u * 0.52) + ") scale(" + f(u / 46) + ")"));
      break;
    }
    case "bedroom": {
      const dr = (x: number) => path("key", "M" + f(x) + "," + f(wy - 6) + " q" + f(-6) + "," + f(wh * 0.5) + " 2," + f(wh + 10) + " h7 q-5,-" + f(wh * 0.6) + " 0,-" + f(wh + 16) + " Z", "", 'opacity=".8"');
      front.push(dr(wx - 6) + dr(wx + ww - 1));
      if (!s.props.includes("bed")) { const x = L.light.x > 160 ? 70 : 250, sc = u * 0.5 / 30; grd.push(group(thing("bed", 81, id, c).svg, "", "translate(" + f(x) + "," + f(wall + 4) + ") scale(" + f(sc) + ")")); }
      break;
    }
    case "study": {
      const x0 = L.light.x > 160 ? 6 : 214, sc = u * 1.15 / 72;
      let sh = "";
      for (let k = 0; k < 2; k++) sh += group(thing("shelf", 82 + k, id, { ...c, r: rL }).svg, "", "translate(" + f(x0 + 21 * sc + k * 44 * sc) + "," + f(wall + 1) + ") scale(" + f(sc) + ")");
      back.push(sh);
      break;
    }
    case "hall": {
      const sc = u * 1.6 / 80, x = L.light.x > 160 ? 60 : 260;
      back.push(group(thing("stairs", 84, id, c).svg, "", "translate(" + f(x) + "," + f(wall + 1) + ") scale(" + f(L.light.x > 160 ? -sc : sc) + "," + f(sc) + ")"));
      back.push(group(thing("door", 85, id, c).svg.replace(/data-a="[^"]*"/g, ""), "", "translate(" + f(L.focusX) + "," + f(wall) + ") scale(" + f(u * 1.3 / 46) + ")"));
      front.push(path("far", "M" + f(160) + ",-5 V" + f(ceil + 10)) + path("lit", ellipse(160, ceil + 14, 14, 3) + " " + circle(150, ceil + 18, 1.6) + " " + circle(160, ceil + 19, 1.6) + " " + circle(170, ceil + 18, 1.6), "chand"));
      mv.push((a, t) => (a.a("chand") as SVGElement).style.opacity = f(c.night ? 0.5 + 0.5 * t : 0.4));
      break;
    }
    case "church": {
      let pews = "";
      for (let k = 0; k < 6; k++) {
        const q = (k + 1) / 7, y = wall + (205 - wall) * q * q * 1.05, h = 6 + q * 22, w = 40 + q * 110;
        pews += rect(vx - 14 - w * (1 + q * 0.4), y - h, w, h * 0.35) + " " + rect(vx + 14 + w * q * 0.4, y - h, w, h * 0.35) + " ";
      }
      grd.push(path("key", P([[vx - 6, wall], [vx + 6, wall], [vx + 40, 205], [vx - 40, 205]]), "", 'opacity=".35"') + path("far", pews));
      let alt = "";
      for (let k = -2; k <= 2; k++) alt += rect(vx + k * 8 - 1, wall - 12, 2, 8) + " ";
      back.push(path("far", rect(vx - 22, wall - 6, 44, 7)) + path("lit", alt));
      // a second tall window on the other side
      const w2x = 320 - L.light.x - ww / 2;
      back.push(path("sky", winShape, "", 'fill="url(#sk' + id + ')" transform="translate(' + f(w2x - wx) + ',0)"'));
      break;
    }
    case "room": {
      back.push(path("edge", rect(L.light.x > 160 ? 60 : 220, wall - u * 1.05, u * 0.38, u * 0.28)) + path("far", rect(L.light.x > 160 ? 63 : 223, wall - u * 1.02, u * 0.38 - 6, u * 0.28 - 6)));
      grd.push(layer("", path("bg2", ellipse(L.focusX, wall + (205 - wall) * 0.6, 90, 16)), 0.6));
      break;
    }
  }
  return { back: back.join(""), ground: grd.join(""), front: front.join(""), movers: mv, win };
}

export interface WinBox { x: number; y: number; w: number; h: number; shape: string }
