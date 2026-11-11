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
// (far first, each with its shadow), framing foreground, weather, motion, grain.
//
// Motion (spec.fx, read from the passage's verbs) is acted out from where things really stand:
// smoke leaves the chimney, the fire or the cup that is in the picture, sparks rise from the flame,
// leaves or petals or ash fall by the season and what is burning, a flock crosses the sky away from
// the light, waves roll in across the water band, a star falls only in a night sky. The beat (t)
// brings each one in, so a picture settles into its motion as the reader reaches it.
import { ease, lerp } from "../scenes/helpers";
import { P, circle, defs, ellipse, f, grain, pool, rect, seg } from "../vscenes/shapes";
import type { VScene } from "../vscenes";
import { HAND, STAND, figureSvg, leanOf, mixJ, restJoints, setJoints } from "./figure";
import { SIZE, effectiveShot, layout, staged, type Item } from "./layout";
import { SKY } from "./acts";
import { aimer, fallAt, figSegs, figurePlayer, ringAt, shownAt, thingEvents, travelAt } from "./perform";
import { looped, prog, timeline, type Seg, type Timeline } from "./timeline";
import { fbm, rng, smooth, type Rng } from "./noise";
import { backdrop } from "./places";
import { group, op, path, shadow, tf, thing, type Ctx, type Mover } from "./things";
import type { Spec } from "./spec";

interface Plan { markup: (id: string) => string; movers: Mover[]; tl: Timeline; clock: { dip: number } }

function cloudShape(r: Rng, cx: number, cy: number, w: number): string {
  // The base is an ellipse, wound like the puffs: a rectangle winds the other way and cuts holes where they overlap.
  let d = ellipse(cx, cy + 0.5, w / 2, 3.2) + " ";
  const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) { const x = cx - w / 2 + (w * (k + 0.5)) / n, rr = w * (0.12 + r() * 0.12) * (k === Math.floor(n / 2) ? 1.4 : 1); d += circle(x, cy - rr * 0.35, rr) + " "; }
  return d;
}

function plan(spec: Spec): Plan {
  // "The branches swayed" under a clear sky: the wind is drawn, as it would be for a windy sky.
  const fxs = spec.fx || [];
  const s: Spec = { ...spec, shot: effectiveShot(spec), sky: fxs.includes("sway") && spec.sky === "clear" ? "wind" : spec.sky, a: fxs.includes("sway") ? Math.max(spec.a, 0.8) : spec.a };
  const L = layout(s);
  const tl = timeline(s.acts || []), clock = { dip: 1 };
  const skySegs = tl.segs.filter((g) => g.act.by === SKY);
  const skySeg = (...k: string[]) => skySegs.find((g) => k.includes(g.act.kind));
  /** How much of a weather there is now: 1 with no act, rising as it begins, falling as it stops. */
  const amount = (kind: string, p: number) => { const g = skySegs.find((x) => x.act.kind === kind); if (!g) return 1; const u = ease(prog(g, p)); return g.act.away ? 1 - u : u; };
  const rL = rng(s.seed + 101), rM = rng(s.moment * 31 + s.seed + 5);
  const night = s.time === "night", low = s.time === "dawn" || s.time === "dusk";
  const indoor = L.indoor, hy = L.cam.hy;
  const dim = ["cloud", "storm", "fog", "rain", "snow"].includes(s.sky);
  const c: Ctx = { night, low, season: s.season, place: s.place, r: rM, a: s.a, indoor };
  const mv: Mover[] = [];
  const parts: ((id: string) => string)[] = [];
  const add = (fn: string | ((id: string) => string)) => parts.push(typeof fn === "string" ? () => fn : fn);

  if (s.place === "inner" && !staged(s)) return { ...inner(s, rM), tl, clock };

  /* the setting, built first so the window is known */
  const bd = backdrop(s, L, "§", c, rL);
  const idFix = (str: string, id: string) => str.split("§").join(id);
  const win = bd.win;
  const box = win ? { x: win.x, y: win.y, w: win.w, h: win.h } : { x: 0, y: 0, w: 320, h: hy };

  /* sky */
  if (staged(s)) {
    // The bare stage: a soft backdrop in the hour's colour, a floor, a horizon line.
    add((id) => path("sky", rect(-5, -5, 330, 210), "", 'fill="url(#sk' + id + ')" data-h="' + s.time + '" data-y="' + f(hy) + '" opacity=".55"'));
    add(path("bg2", rect(-5, hy, 330, 210 - hy), "", 'opacity=".55"') + path("line", "M-5," + f(hy) + " H325", "", 'opacity=".5"'));
  } else if (!indoor) add((id) => path("sky", rect(-5, -5, 330, hy + 10), "", 'fill="url(#sk' + id + ')" data-h="' + s.time + '" data-y="' + f(hy) + '"'));
  else add((id) => idFix(bd.back, id));
  if (indoor) add(path("sky", "M0,0", "", 'data-h="' + s.time + '" data-y="' + f(hy) + '"'));
  add((id) => pool(id, Math.round(L.light.x), Math.round(L.light.y), indoor ? 80 : 70, "pl"));
  const starAct = skySeg("stars");
  if ((night && !dim) || (starAct && !indoor)) {
    let st = "";
    for (let i = 0; i < (indoor ? 10 : 50); i++) st += circle(box.x + rL() * box.w, box.y + rL() * box.h * 0.8, rL() < 0.15 ? 1.1 : 0.55) + " ";
    add(path("lit", st, "st"));
    mv.push((a, _t, tm, _e, p) => op(a, "st", (0.65 + 0.35 * Math.sin(tm * 1.7)) * (starAct ? ease(prog(starAct, p)) : 1)));
  }
  /* sun or moon: they share the light's place, rising at dawn and night, setting at dusk */
  const cr = indoor ? Math.max(4, box.w * 0.1) : night ? 10 : low ? 15 : 12;
  const full = rM() < 0.4;
  const moon = night ? (full ? path("lit", circle(0, 0, cr)) : path("lit", "M0," + f(-cr) + " A" + f(cr) + "," + f(cr) + " 0 1,0 0," + f(cr) + " A" + f(cr * 1.3) + "," + f(cr * 1.3) + " 0 0,1 0," + f(-cr) + " Z", "", 'transform="rotate(' + f(-20 + rM() * 40) + ')"')) : path("lit", circle(0, 0, cr));
  add(group(path("lit", circle(0, 0, cr * 2.3), "", 'opacity=".14"') + path("lit", circle(0, 0, cr * 1.5), "", 'opacity=".18"') + moon, "cel"));
  const cx0 = indoor ? box.x + box.w * 0.3 : L.light.x - 36, cx1 = indoor ? box.x + box.w * 0.6 : L.light.x;
  const cyLow = indoor ? box.y + box.h - cr - 2 : hy + cr * 0.4, cyHigh = indoor ? box.y + box.h * 0.32 : L.light.y;
  // The sun or moon that rises or sets in the words follows the act, not the beat.
  const celAct = skySeg("sunrise", "sunset", "moonrise", "daybreak", "nightfall");
  const sinks = celAct && (celAct.act.kind === "sunset" || celAct.act.kind === "nightfall");
  mv.push((a, t, _tm, _e, p) => {
    const e = celAct ? ease(prog(celAct, p)) : ease(t);
    const below = cyLow + cr * 3.2;
    const k = s.time === "dusk" ? 1 - e * 0.8 : s.time === "day" ? 0.85 + 0.15 * Math.sin(e * Math.PI) : 0.25 + e * 0.75;
    const x = lerp(cx0, cx1, e), y = celAct ? (sinks ? lerp(cyHigh, below, e) : lerp(below, cyHigh, e)) : lerp(cyLow, cyHigh, k);
    tf(a, "cel", "translate(" + f(x) + "," + f(y) + ")");
    op(a, "cel", dim ? 0.3 : 1);
    if (!indoor) { a.a("pl").setAttribute("cx", f(x)); a.a("pl").setAttribute("cy", f(y)); }
  });
  /* clouds: weather sets how many, the mood how fast they go */
  const cloudAct = skySeg("cloud", "storm", "rain");
  const nCl0 = s.sky === "storm" || s.sky === "rain" ? 6 : s.sky === "cloud" ? 5 : s.sky === "snow" || s.sky === "wind" ? 3 : s.sky === "fog" ? 0 : s.v < -0.3 ? 2 : rL() < 0.4 ? 1 + Math.floor(rL() * 2) : 0;
  const nCl = cloudAct ? Math.max(nCl0, 4) : nCl0;
  if (nCl && !indoor) {
    let cl = "";
    for (let k = 0; k < nCl; k++) cl += cloudShape(rL, box.x + rL() * (box.w + 60) - 30, box.y + 8 + rL() * Math.min(40, box.h * 0.4), (indoor ? 0.4 : 1) * (30 + rL() * 40)) + " ";
    add(group(path("haze", cl, "", s.sky === "storm" || s.sky === "rain" ? 'data-dark="1"' : ""), "cl"));
    const drift = 3 + s.a * 14 + (s.sky === "wind" || s.sky === "storm" ? 10 : 0);
    mv.push((a, _t, tm, _e, p) => {
      // Clouds that gather slide in from the side; clouds that part slide away and thin.
      const k = cloudAct ? amount(cloudAct.act.kind, p) : 1;
      tf(a, "cl", "translate(" + f(((tm * drift) % (box.w + 80)) - 40 - (1 - k) * 160) + ",0)");
      if (cloudAct) op(a, "cl", k);
    });
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
  const aim = aimer(L.items, s.props);
  placed.forEach((it, n) => {
    if (it.kind === "fig") {
      const k = "fg" + it.i, b = s.cast[it.i] ?? 0, pose = it.pose || "stand";
      const ph = it.i * 1.3 + rM() * 2;
      const segs = figSegs(tl, it.i);
      // What the figure holds, or will: each in its own group in the hand, shown when it is held, kept upright.
      const heldList = [it.hold, ...(it.later || [])].filter((p, q, all): p is NonNullable<typeof p> => !!p && all.indexOf(p) === q);
      let held = "";
      heldList.forEach((p, hn) => {
        const z = SIZE[p], sc = p === "letter" || p === "book" ? 14 / z.w : z.real * 100 / z.h;
        const hb = thing(p, 90 + n * 4 + hn, "§", { ...c, r: rng(s.seed * 17 + n + hn), ev: thingEvents(tl, s.props.indexOf(p)) });
        mv.push(...hb.movers);
        held += group(group(hb.svg, "", "scale(" + f(sc) + ") translate(0," + (p === "umbrella" ? 14 : 1) + ")"), k + "o" + hn, "translate(" + HAND.x + "," + HAND.y + ")", it.hold === p ? "" : 'style="opacity:0"');
      });
      const svg = figureSvg(k, b, held);
      const big = it.s > 1.6;
      add((id) => idFix((big ? "" : group(shadow(26, L.light.x - it.x, 60), k + "s", "translate(" + f(it.x) + "," + f(it.y) + ") scale(" + f(it.s) + ")")) + svg, id));
      const walking = !segs.length && (pose === "walk" || pose === "run");
      const road = walking && s.place === "road";
      const rest = walking ? STAND : restJoints(pose, !!it.seat);
      const play = figurePlayer(it, b, segs, L.items, aim, rest, it.hold, it.later || []);
      const armPose = !segs.length && (pose === "reach" || pose === "look" || pose === "pair");
      // In a boat that sails: the figure goes with it.
      const boatIt = it.on === "boat" ? placed.find((q) => q.kind === "boat" && q.on === "water") : undefined;
      const boatEv = boatIt ? thingEvents(tl, boatIt.i) : [];
      mv.push((a, _t, tm, e, p) => {
        const fr = play(p, tm, ph);
        let x = fr.x, y = fr.y, sc = fr.s, j = fr.j;
        if (!segs.length) {
          // No acts: the old pictures, but the walk never freezes: legs on the clock, a little way with the beat.
          if (road) { const yy = lerp(it.y, hy + (it.y - hy) * 0.35, e); sc = it.s * (yy - hy) / Math.max(1, it.y - hy); x = lerp(it.x, 160, e * 0.5); y = yy; }
          else if (walking) x = Math.max(-10, Math.min(330, it.x + it.face * lerp(-34, 10, e) * it.s * (pose === "run" ? 1.6 : 1)));
          else if (pose !== "lie") x += Math.sin(tm * 0.5 + ph) * 0.3;
          if (armPose) j = mixJ(STAND, j, Math.max(e, 0.5));
        }
        if (boatIt) { const v = travelAt(boatEv, p); if (v != null) x += v * (330 + boatIt.w) * boatIt.face; }
        const face = fr.face || 1e-3, rot = j.rot ? -Math.sign(face) * j.rot : 0;
        tf(a, k, "translate(" + f(x) + "," + f(y) + ") scale(" + f(sc) + ")" + (j.drop || rot ? " translate(0," + f(j.drop) + ") rotate(" + f(rot) + ")" : ""));
        if (segs.length) op(a, k, fr.alpha);
        setJoints(a, k, b, j, face);
        heldList.forEach((p, hn) => {
          tf(a, k + "o" + hn, "translate(" + HAND.x + "," + HAND.y + ") rotate(" + f(-(j.sh2 + j.el2 + leanOf(b, j)) - rot * Math.sign(face)) + ")");
          op(a, k + "o" + hn, fr.hold[p] ?? (it.hold === p ? 1 : 0));
        });
        if (!big) { tf(a, k + "s", "translate(" + f(x) + "," + f(segs.length ? fr.y - (fr.y - it.y) : y) + ") scale(" + f(sc) + ")"); if (segs.length) op(a, k + "s", fr.alpha * (j.rot ? 0.6 : 1)); }
      });
      return;
    }
    const seed = s.seed * 31 + n * 7 + it.i;
    const ev = it.i >= 0 ? thingEvents(tl, it.i) : [];
    const built = thing(it.kind, n, "§", { ...c, r: rng(seed), ev });
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
    const moving = ev.length > 0 && it.on !== "sky";
    const tr0 = "translate(" + f(it.x) + "," + f(it.y) + ") scale(" + f(it.s) + ")" + flip;
    add((id) => group(idFix(sh, id) + idFix(built.svg, id), moving ? "it" + n : "", tr0));
    mv.push(...built.movers);
    if (moving) {
      // A thing that arrives, leaves, falls, rings or is taken: the whole thing moves.
      const under = it.on === "table" || it.on === "bench" ? placed.find((q) => q.kind === (it.on === "table" ? "table" : "bench")) : undefined;
      const drop = under ? under.y - it.y : 0;
      const dir = it.kind === "car" || it.kind === "train" ? 1 : it.face;
      const dist = 330 + it.w;
      mv.push((a, _t, tm, _e, p) => {
        const tv = travelAt(ev, p), fa = fallAt(ev, p), rg = ringAt(ev, p, tm);
        const dx = tv == null ? 0 : tv * dist * dir, dy = drop * fa;
        tf(a, "it" + n, "translate(" + f(it.x + dx) + "," + f(it.y + dy) + ") scale(" + f(it.s) + ")" + flip + (fa || rg ? " rotate(" + f(fa * 90 * (it.face || 1) + rg * 4) + ")" : ""));
        op(a, "it" + n, shownAt(ev, p));
      });
    }
  });

  /* foreground framing, then weather */
  add((id) => idFix(bd.front, id));
  const inBox = (x: number, y: number) => ({ x: box.x + ((x % box.w) + box.w) % box.w, y: box.y + ((y % box.h) + box.h) % box.h });
  const H = indoor ? box.h : 205;
  const wrap = (x: number, y: number) => indoor ? inBox(x, y) : { x: ((x % 330) + 330) % 330 - 5, y: ((y % 210) + 210) % 210 - 5 };
  const rainAct = skySeg("rain", "storm");
  if (s.sky === "rain" || s.sky === "storm" || rainAct) {
    add(path("line", "M0,0", "rn"));
    const heavy = (s.sky === "storm" || rainAct?.act.kind === "storm" ? 1.6 : 1) * (0.7 + s.a * 0.6);
    mv.push((a, t, tm, _e, p) => {
      const amt = rainAct ? amount(rainAct.act.kind, p) : 1;
      if (amt <= 0.01) { a.a("rn").setAttribute("d", "M0,0"); return; }
      const n = Math.round(((indoor ? 10 : 36) * heavy * lerp(0.5, 1, t) + 6) * amt);
      let d = "";
      for (let i = 0; i < n; i++) { const p = wrap(i * 53.3 + Math.sin(i) * 7, i * 29.7 + tm * 120 * heavy), yb = Math.min(p.y + 8, indoor ? box.y + H : 205); d += "M" + f(p.x) + "," + f(p.y) + " L" + f(p.x - 3 * heavy) + "," + f(yb) + " "; }
      a.a("rn").setAttribute("d", d);
    });
  }
  const flashAct = skySeg("flash", "storm");
  if (s.sky === "storm" || flashAct) {
    const bx = box.x + box.w * (0.3 + rL() * 0.4), bh = indoor ? box.h : hy;
    add(path("lit", P([[bx, box.y], [bx + 6, box.y + bh * 0.35], [bx - 2, box.y + bh * 0.38], [bx + 8, box.y + bh * 0.8], [bx - 4, box.y + bh * 0.42], [bx + 3, box.y + bh * 0.4]]), "lt"));
    mv.push((a, _t, tm, _e, p) => {
      if (flashAct && flashAct.act.kind === "flash") { const u = prog(flashAct, p); op(a, "lt", (u > 0 && u < 0.08) || (u > 0.14 && u < 0.2) ? 1 : 0); return; }
      const cyc = (tm * 0.45) % 1; op(a, "lt", cyc < 0.04 || (cyc > 0.07 && cyc < 0.09) ? 1 : 0);
    });
  }
  const snowAct = skySeg("snow");
  if (s.sky === "snow" || (s.season === "winter" && s.sky === "cloud") || snowAct) {
    add(path("lit", "M0,0", "sn"));
    mv.push((a, t, tm, _e, p) => {
      const n = (indoor ? 16 : 46) * lerp(0.5, 1, t) * (snowAct ? amount("snow", p) : 1);
      let d = "";
      for (let i = 0; i < n; i++) { const p = wrap(i * 47.1 + Math.sin(tm * 0.7 + i) * 6, i * 23.3 + tm * 14 * (0.6 + (i % 3) * 0.3)); d += circle(p.x, p.y, i % 4 ? 0.8 : 1.3) + " "; }
      a.a("sn").setAttribute("d", d || "M0,0");
    });
  }
  if (s.season === "autumn" && !indoor) {
    add(path("key", "M0,0", "lv"));
    mv.push((a, _t, tm) => { let d = ""; for (let i = 0; i < 9; i++) { const p = wrap(i * 61 + tm * (10 + s.a * 20), i * 37 + tm * 16); const r = Math.sin(tm * 2 + i); d += "M" + f(p.x) + "," + f(p.y) + " q" + f(2 * r) + ",-2 " + f(4) + ",0 q" + f(-2 * r) + ",2 -4,0 "; } a.a("lv").setAttribute("d", d); });
  }
  const fogAct = skySeg("fog");
  if ((s.sky === "fog" || fogAct) && !indoor) {
    let d = "";
    for (let k = 0; k < 4; k++) { const y = hy - 8 + k * 14; d += ellipse(40 + k * 90 + rL() * 40, y, 150 + rL() * 60, 8 + k * 2) + " "; }
    add(group(path("haze", d), "fog", "", 'opacity=".7"'));
    mv.push((a, t, tm, _e, p) => { tf(a, "fog", "translate(" + f(Math.sin(tm * 0.15) * 20) + ",0)"); op(a, "fog", lerp(0.8, 0.5, t) * (fogAct ? amount("fog", p) : 1)); });
  }
  const windAct = skySeg("wind");
  if ((s.sky === "wind" || windAct) && !indoor) {
    add(path("line", "M0,0", "wd"));
    mv.push((a, _t, tm, _e, p) => { let d = ""; const m = Math.round(6 * (windAct ? amount("wind", p) : 1)); for (let i = 0; i < m; i++) { const x = ((i * 71 + tm * (60 + s.a * 60)) % 420) - 60, y = 20 + (i * 37) % Math.max(20, hy - 10); d += "M" + f(x) + "," + f(y) + " q14,-5 28,0 t28,0 "; } a.a("wd").setAttribute("d", d); });
  }

  /* motion read from the text */
  const fl = motion(s, L, box, add, mv, rM);

  /* light: the hour and the mood set how far the scene brightens with the beat; a flicker shakes it */
  const top = night ? 0.85 : low ? 0.95 : 1, bottom = night ? 0.15 : 0.32 + 0.15 * s.v;
  const nz = fbm(s.moment + 17, 2);
  // Night falling or the sun rising carries the light with it; a dark veil deepens or lifts.
  if (celAct) add(path("shade", rect(-5, -5, 330, 210), "dk", 'style="opacity:0"'));
  mv.push((a, t, tm, _e, p) => {
    let k = 1;
    if (celAct) { const u = ease(prog(celAct, p)); k = sinks ? lerp(1, 0.45, u) : lerp(0.5, 1, u); op(a, "dk", sinks ? u * (celAct.act.kind === "nightfall" ? 0.55 : 0.35) : (1 - u) * 0.45); }
    const flash = flashAct && flashAct.act.kind === "flash" ? (prog(flashAct, p) > 0 && prog(flashAct, p) < 0.2 ? 1.4 : 1) : 1;
    a.light(lerp(bottom, top, ease(seg(t, 0, 0.8))) * (fl ? 0.86 + 0.14 * nz(tm * 7) : 1) * k * clock.dip * flash);
  });

  const cls = "hz t-" + s.time;
  return {
    markup: (id) => defs(id) + group(skyDefs(id) + group(parts.map((p) => p(id)).join(""), "", "", 'class="w-' + s.sky + (s.season !== "none" ? " se-" + s.season : "") + '"'), "", "", 'class="' + cls + '"') + grain(id),
    movers: mv, tl, clock,
  };
}

type Box = { x: number; y: number; w: number; h: number };
type Add = (fn: string | ((id: string) => string)) => void;

/** Where smoke, steam or sparks come from: the things in the picture that burn or steam. */
function sources(L: ReturnType<typeof layout>, kinds: readonly string[]): { x: number; y: number; s: number; kind: string }[] {
  const top: Record<string, [number, number]> = { fire: [0, -18], candle: [0, -25], cup: [0, -12], house: [13, -50], tent: [0, -36], lamp: [0, -62] };
  return L.items.filter((it) => kinds.includes(it.kind) && it.on !== "ceiling").slice(0, 3).map((it) => {
    const [dx, dy] = top[it.kind] || [0, -it.h / Math.max(0.01, it.s)];
    return { x: it.x + dx * it.s * (it.face < 0 ? -1 : 1), y: it.y + dy * it.s, s: it.s, kind: it.kind };
  });
}

/** The passage's motion, as layers and movers. Returns whether the light should flicker. */
function motion(s: Spec, L: ReturnType<typeof layout>, box: Box, add: Add, mv: Mover[], r: Rng): boolean {
  const fx = s.fx || [];
  if (!fx.length) return false;
  const indoor = L.indoor, hy = L.cam.hy, night = s.time === "night", low = s.time === "dawn" || s.time === "dusk";
  const k = (t: number) => lerp(0.35, 1, ease(seg(t, 0, 0.7)));
  const ph = r() * 10;

  if (fx.includes("rise")) {
    let src = sources(L, ["fire", "candle", "cup", "house", "tent"]);
    if (!src.length) src = indoor ? [{ x: L.focusX, y: L.cam.shot === "close" ? L.surface : L.wall + 6, s: 1, kind: "air" }]
      : [{ x: 300 - L.light.x * 0.6, y: hy + 3, s: 0.6, kind: "far" }, { x: 330 - L.light.x * 0.9, y: hy + 2, s: 0.45, kind: "far" }];
    const lean = (L.light.x < 160 ? 1 : -1) * (s.sky === "wind" || s.sky === "storm" ? 2.6 : 0.7);
    src.forEach((p, i) => {
      for (let j = 0; j < 3; j++) add(path("line", "M0,0", "rs" + i + j, 'fill="none"'));
      const tall = (p.kind === "cup" || p.kind === "candle" ? 26 : p.kind === "air" ? 60 : 70) * Math.max(0.5, Math.min(2.2, p.s));
      mv.push((a, t, tm) => {
        for (let j = 0; j < 3; j++) {
          const q = ((tm * 0.18 + j / 3 + i * 0.27) % 1), y0 = p.y - q * tall * 0.5, len = tall * (0.3 + 0.4 * q);
          const pts: [number, number][] = [];
          for (let n = 0; n <= 5; n++) { const u = n / 5, y = y0 - u * len; pts.push([p.x + Math.sin(tm * 1.4 + n * 0.9 + j * 2 + ph) * (1 + u * 4 + q * 4) + lean * (q + u) * 6, y]); }
          const el = a.a("rs" + i + j);
          el.setAttribute("d", smooth(pts));
          (el as SVGElement).style.opacity = f(Math.sin(Math.PI * q) * 0.75 * k(t));
        }
      });
    });
  }

  if (fx.includes("flicker")) {
    const src = sources(L, ["fire", "candle", "lamp"]).filter((p) => p.kind !== "lamp" || !indoor);
    if (src.length) {
      add(path("lit", "M0,0", "spk"));
      mv.push((a, t, tm) => {
        let d = "";
        src.forEach((p, i) => {
          const n = p.kind === "fire" ? 9 : 3, rise = (p.kind === "fire" ? 46 : 16) * Math.max(0.6, p.s);
          for (let j = 0; j < n * k(t); j++) {
            const q = (tm * (0.45 + (j % 3) * 0.12) + j / n + i * 0.3) % 1;
            d += circle(p.x + Math.sin(tm * 3 + j * 1.7) * (2 + q * 7) * p.s, p.y - q * rise, (1 - q) * (p.kind === "fire" ? 1.3 : 0.7)) + " ";
          }
        });
        a.a("spk").setAttribute("d", d || "M0,0");
      });
    }
  }

  if (fx.includes("fall")) {
    const tree = L.items.some((it) => it.kind === "tree");
    const kind = s.season === "autumn" || (tree && s.season !== "spring" && s.season !== "winter") ? "leaf"
      : s.season === "spring" || s.props.includes("flower") ? "petal" : s.props.includes("fire") ? "ash" : indoor ? "dust" : "leaf";
    const role = kind === "leaf" ? "key" : "lit";
    add(path(role, "M0,0", "fal", kind === "ash" || kind === "dust" ? 'opacity=".7"' : ""));
    const n = Math.round((kind === "dust" ? 22 : 16) + s.a * 14), B = indoor ? box : { x: -5, y: -5, w: 330, h: 210 };
    const speed = kind === "dust" ? 4 : kind === "ash" ? 9 : kind === "petal" ? 13 : 18;
    mv.push((a, t, tm) => {
      let d = "";
      const m = Math.round(n * k(t));
      for (let i = 0; i < m; i++) {
        const sp = speed * (0.7 + ((i * 37) % 10) / 16), y = B.y + (((i * 41.3 + tm * sp) % B.h) + B.h) % B.h;
        const x = B.x + ((((i * 67.9 + Math.sin(tm * 0.9 + i) * (kind === "dust" ? 4 : 10) + tm * (s.sky === "wind" ? 16 : 3)) % B.w) + B.w) % B.w);
        if (kind === "leaf") { const r2 = Math.sin(tm * 2.2 + i) * 2.4; d += "M" + f(x) + "," + f(y) + " q" + f(r2) + ",-2.4 4.4,0 q" + f(-r2) + ",2.4 -4.4,0 "; }
        else if (kind === "petal") d += ellipse(x, y, 1.6 + Math.abs(Math.sin(tm * 2 + i)) * 0.9, 1) + " ";
        else d += circle(x, y, kind === "dust" ? 0.55 : 0.8) + " ";
      }
      a.a("fal").setAttribute("d", d || "M0,0");
    });
  }

  if (fx.includes("fly")) {
    const B = indoor ? box : { x: 0, y: 6, w: 320, h: Math.max(30, hy - 24) };
    const n = 5 + Math.floor(r() * 4), dir = L.light.x < 160 ? 1 : -1, y0 = B.y + B.h * (0.25 + r() * 0.35), sc = indoor ? 0.5 : 1;
    add(path("line", "M0,0", "fly", 'fill="none"'));
    mv.push((a, t, tm) => {
      const span = B.w + 140, lead = ((tm * 16 * (0.8 + s.a * 0.6) + ph * 20) % span) - 70;
      let d = "";
      for (let i = 0; i < n; i++) {
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const x = B.x + (dir > 0 ? lead - row * 9 * sc : B.w - lead + row * 9 * sc), y = y0 + side * row * 5 * sc + Math.sin(tm * 0.8 + i) * 2 - (1 - k(t)) * 10;
        const fl = Math.sin(tm * 9 + i * 1.3) * 2.6 * sc, w = 5 * sc;
        d += "M" + f(x - w) + "," + f(y - fl) + " Q" + f(x - w * 0.4) + "," + f(y - 1) + " " + f(x) + "," + f(y) + " Q" + f(x + w * 0.4) + "," + f(y - 1) + " " + f(x + w) + "," + f(y - fl) + " ";
      }
      a.a("fly").setAttribute("d", d);
    });
  }

  if (fx.includes("glow")) {
    if (indoor) {
      add((id) => pool(id, Math.round(L.light.x), Math.round(L.wall - 10), 110, "gw"));
      mv.push((a, t, tm) => op(a, "gw", (0.35 + 0.25 * Math.sin(tm * 1.3)) * k(t)));
    } else {
      const pts: [number, number, number][] = [];
      const lit = night || low;
      for (let i = 0; i < 26; i++) pts.push([10 + r() * 300, hy + 1 + r() * (lit ? 10 : 4), r()]);
      const bugs = lit && ["garden", "field", "forest", "hill", "lake", "river", "graveyard", "village"].includes(s.place);
      add(path("lit", "M0,0", "glw"));
      mv.push((a, t, tm) => {
        let d = "";
        if (lit) pts.forEach(([x, y, q], i) => { if (Math.sin(tm * (0.6 + q) + i * 2.1) > 0.2 - k(t)) d += rect(x, y, 1.6, 1.6) + " "; });
        else pts.slice(0, 8).forEach(([x, y, q], i) => { const g = Math.sin(tm * 1.8 + i * 1.7 + q * 6); if (g > 0.75) { const r2 = (g - 0.75) * 10; d += P([[x - r2, y], [x, y - 0.6], [x + r2, y], [x, y + 0.6]]) + " " + P([[x, y - r2], [x + 0.6, y], [x, y + r2], [x - 0.6, y]]) + " "; } });
        if (bugs) for (let i = 0; i < 12 * k(t); i++) { const x = 20 + ((i * 53 + Math.sin(tm * 0.4 + i) * 24) % 290), y = hy + (200 - hy) * (0.3 + ((i * 29) % 60) / 100) + Math.sin(tm * 0.9 + i * 3) * 6; if (Math.sin(tm * 1.6 + i * 2.3) > 0) d += circle(x, y, 1.1) + " "; }
        a.a("glw").setAttribute("d", d || "M0,0");
      });
    }
  }

  if (fx.includes("swell") && L.water) {
    // Crests roll in from the horizon: thin and faint far out, fuller and brighter near, spray as they break.
    const [w0, w1] = L.water, n = 4;
    for (let j = 0; j < n; j++) add(path("lit", "M0,0", "swl" + j));
    mv.push((a, t, tm) => {
      const amp = 0.5 + s.a * 0.9 + (s.sky === "storm" ? 1 : 0);
      for (let j = 0; j < n; j++) {
        const q = ((j / n + tm * 0.07) % 1), y = w0 + (w1 - w0) * Math.pow(q, 1.5), h = 0.3 + q * 1.8 * amp, up: [number, number][] = [], dn: [number, number][] = [];
        for (let x = -10; x <= 330; x += 30) { const yy = y + Math.sin(x * 0.03 + j * 2 + tm * 0.6) * q * 3 * amp; up.push([x, yy]); dn.unshift([x, yy + h]); }
        let d = smooth(up) + " L" + smooth(dn).slice(1) + " Z ";
        if (q > 0.82) for (let i = 0; i < 8; i++) d += circle(((i * 41 + j * 13) % 320), y - (q - 0.82) * 40 * (0.4 + (i % 3) * 0.3), 0.8) + " ";
        a.a("swl" + j).setAttribute("d", d);
        op(a, "swl" + j, Math.pow(q, 1.3) * Math.min(1, (1 - q) * 6) * 0.7 * k(t));
      }
    });
  }

  if (fx.includes("star") && night && !indoor) {
    const x0 = L.light.x < 160 ? 210 + r() * 60 : 50 + r() * 60, y0 = 10 + r() * 20, dx = (L.light.x < 160 ? -1 : 1) * 90, dy = Math.min(50, hy * 0.5);
    add(path("lit", "M0,0", "sht"));
    mv.push((a, _t, tm) => {
      const c = (tm * 0.14 + ph) % 1, el = a.a("sht");
      if (c > 0.14) { el.setAttribute("d", "M0,0"); return; }
      const p = c / 0.14, hx = x0 + dx * p, hy2 = y0 + dy * p, tx = x0 + dx * Math.max(0, p - 0.35), ty = y0 + dy * Math.max(0, p - 0.35);
      const nx = -(hy2 - ty), ny = hx - tx, l = Math.hypot(nx, ny) || 1, w = 1.1 / l;
      el.setAttribute("d", P([[tx, ty], [hx + nx * w, hy2 + ny * w], [hx - nx * w, hy2 - ny * w]]) + " " + circle(hx, hy2, 1.3));
      (el as SVGElement).style.opacity = f(Math.sin(Math.PI * p));
    });
  }
  return fx.includes("flicker");
}

/** The sky's gradient: its two stops are coloured by the style's CSS for the hour. */
function skyDefs(id: string): string {
  return '<defs><linearGradient id="sk' + id + '" x1="0" y1="0" x2="0" y2="1"><stop class="sk0" offset="0" stop-color="#456"/><stop class="sk1" offset="1" stop-color="#9ab"/></linearGradient></defs>';
}

/** No place named: a quiet motif grown from the passage's mood, drawn small and centred. */
function inner(s: Spec, r: Rng): Pick<Plan, "markup" | "movers"> {
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

const cache = new Map<string, VScene & { tl: Timeline }>();

/**
 * The vector scene for a spec (cached by id: the same spec is the same picture). update() takes the
 * play clock p (seconds since the picture began to play); without it the picture shows its still,
 * the telling moment of what happens.
 */
export function composeScene(s: Spec, id: string): VScene & { tl: Timeline } {
  const hit = cache.get(id);
  if (hit) return hit;
  const pl = plan(s);
  const vs = {
    tl: pl.tl,
    build: (uid: string) => pl.markup(uid),
    update(a: Parameters<VScene["update"]>[0], t: number, tm: number, p?: number) {
      const e = ease(t), q = looped(pl.tl, p);
      pl.clock.dip = q.dip;
      for (const m of pl.movers) m(a, t, tm, e, q.p);
    },
  };
  if (cache.size > 300) cache.clear();
  cache.set(id, vs);
  return vs;
}

/** For tests: the boxes a spec lays out. */
export { layout as layoutOf };
export type { Item };
