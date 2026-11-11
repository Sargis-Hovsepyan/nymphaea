// Playing the acts. For each figure, a function of the play clock gives where it stands, which way
// it faces, its joints and what is in its hand; for each thing, its state (open, lit, arrived,
// fallen, ringing) from the acts that touch it. Postures carry over (she sat down, so she is
// sitting), gestures come and go (a wave), travel moves the figure with its legs in step with the
// ground it covers, and a hand reaches the real point on the thing it acts on (the handle, the
// wick). Pure: the scene (compose/draw.ts) puts the result on the drawing.
import { clamp, ease, lerp } from "../scenes/helpers";
import { ALL, OFF_AHEAD, OFF_BEHIND, PAIR, THING0, UP, DOWN, figOf, thingOf, type Act } from "./acts";
import { HAND, STAND, gait, mixJ, reachIK, restJoints, statureScale, type Joints } from "./figure";
import { ANCHOR, type Item } from "./layout";
import { prog, type Seg, type Timeline } from "./timeline";
import type { Prop } from "./spec";

const TRAVEL = new Set(["go", "run", "enter", "leave", "cross"]);
const POSTURE = new Set(["sit", "rise", "lie", "kneel", "fall"]);
const REACH = new Set(["handle", "open", "close", "light", "snuff", "knock", "take", "put", "point"]);

/** A world point a figure's act is aimed at. */
export type Aim = (to: number, from: Item) => { x: number; y: number } | null;

export interface FigFrame { x: number; y: number; s: number; face: number; j: Joints; alpha: number; hold: Record<string, number> }

/** In and out of a gesture: up over the first quarter, held, down over the last fifth. */
const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : u < 0.25 ? ease(u / 0.25) : u > 0.8 ? ease((1 - u) / 0.2) : 1);
/** Travel at a steady pace with a soft start and stop. */
const pace = (u: number) => (u < 0.12 ? (u * u) / 0.24 : u > 0.88 ? 1 - ((1 - u) * (1 - u)) / 0.24 : (u - 0.06) / 0.88);

/** The world point a figure's acts are aimed at, from the laid-out items. */
export function aimer(items: Item[], props: readonly Prop[]): Aim {
  return (to, from) => {
    const ti = thingOf(to), fi = figOf(to);
    if (ti >= 0) {
      const it = items.find((q) => q.kind === props[ti] && q.i === ti) || items.find((q) => q.kind === props[ti]);
      if (!it) return null;
      if (it.kind === "window" && it.on === "wall") return { x: it.x, y: it.y - it.h * 0.5 };
      const [ax, ay] = ANCHOR[it.kind as Prop] || [0, -it.h / Math.max(0.01, it.s) * 0.5];
      return { x: it.x + ax * it.s * (it.face < 0 ? -1 : 1), y: it.y + ay * it.s };
    }
    if (fi >= 0) {
      const it = items.find((q) => q.kind === "fig" && q.i === fi);
      if (!it) return null;
      // Toward the other's front hand, about chest high.
      return { x: it.x - it.face * 6 * it.s, y: it.y - 52 * it.s };
    }
    if (to === UP) return { x: from.x + from.face * 40 * from.s, y: from.y - 160 * from.s };
    if (to === DOWN) return { x: from.x + from.face * 30 * from.s, y: from.y };
    return null;
  };
}

/** The acts that move figure i, with the segment each sits in. */
export function figSegs(tl: Timeline, i: number): Seg[] {
  return tl.segs.filter((s) => s.act.by === i || s.act.by === ALL || (s.act.by === PAIR && i < 2) || ((s.act.kind === "give" || s.act.kind === "greet") && figOf(s.act.to) === i && s.act.by !== i));
}

/**
 * A figure's performance. `rest` is its pose with no acts, `items` the laid-out scene (for targets,
 * seats and partners), `hold0` what it starts holding, `later` what it may take or be given.
 */
export function figurePlayer(it: Item, b: number, segs: Seg[], items: Item[], aim: Aim, rest: Joints, hold0: Prop | undefined, later: Prop[]): (p: number, tm: number, ph: number) => FigFrame {
  const i = it.i, st = statureScale(b);
  // The posture before the acts: standing, unless the first posture act gets up from something.
  const firstPost = segs.find((s) => POSTURE.has(s.act.kind) && s.act.by !== PAIR);
  const base: Joints = !segs.length ? rest
    : firstPost && firstPost.act.kind === "rise" ? (it.pose === "lie" ? restJoints("lie") : restJoints("sit", !!it.seat))
    : (it.pose === "walk" || it.pose === "run" || (firstPost && firstPost.act.kind !== "rise")) ? STAND : rest;
  // Facing at the start: a figure that turns and then travels starts facing the other way.
  const firstTravel = segs.find((s) => TRAVEL.has(s.act.kind));
  const turnFirst = segs.length && segs[0].act.kind === "turn";
  const seat = items.find((q) => (q.kind === "bench" || q.kind === "chair") && Math.abs(q.x - it.x) < 90 * it.s);
  const partner = items.find((q) => q.kind === "fig" && q.i === 1 - i);
  const W = 320;

  /** Where a travel act goes: from x along the ground to its end, and whether it fades at a door. */
  function route(sg: Seg, x: number, face: number): { xa: number; xb: number; fadeIn: boolean; fadeOut: boolean } {
    const a = sg.act, k = a.kind, s = it.s, off = (dir: number) => (dir > 0 ? W + 30 * s : -30 * s);
    const t = a.to >= 4 && a.to < 8 || (a.to >= 1 && a.to < 4) ? aim(a.to, it) : null;
    const lag = a.by === ALL ? (i - 1) * 16 * s : 0;
    if (k === "enter") {
      if (t) return { xa: t.x, xb: it.x, fadeIn: true, fadeOut: false };
      const from = it.x > 160 ? 1 : -1;
      return { xa: off(from) + lag, xb: x, fadeIn: false, fadeOut: false };
    }
    if (k === "leave") {
      if (t) return { xa: x, xb: t.x, fadeIn: false, fadeOut: true };
      const dir = a.to === OFF_BEHIND ? -Math.sign(face || 1) : Math.sign(face || 1);
      return { xa: x, xb: off(dir) + lag, fadeIn: false, fadeOut: false };
    }
    if (k === "cross") { const dir = Math.sign(face || 1); return { xa: off(-dir) + lag, xb: off(dir) + lag, fadeIn: false, fadeOut: false }; }
    // go and run
    if (t && a.away) { const dir = t.x > x ? -1 : 1; return { xa: x, xb: off(dir) + lag, fadeIn: false, fadeOut: false }; }
    if (t) { const dir = t.x > x ? 1 : -1, stop = (a.to >= 1 && a.to < 4 ? 16 : 20) * s; return { xa: x, xb: Math.abs(t.x - x) > stop ? t.x - dir * stop : x, fadeIn: false, fadeOut: false }; }
    if (a.to === OFF_AHEAD || a.to === OFF_BEHIND) { const dir = (a.to === OFF_BEHIND ? -1 : 1) * Math.sign(face || 1); return { xa: x, xb: off(dir) + lag, fadeIn: false, fadeOut: false }; }
    const dir = Math.sign(face || 1), go = (k === "run" ? 110 : 70) * s;
    return { xa: x, xb: Math.max(14, Math.min(W - 14, x + dir * go)), fadeIn: false, fadeOut: false };
  }

  /** Put the front hand on a world point: the joints for the arm, in this figure's frame now. */
  function reachTo(j: Joints, x: number, y: number, face: number, tx: number, ty: number): [number, number] | null {
    if (Math.abs(face) < 0.25) return null;
    const sc = it.s * st;
    let lx = (tx - x) / (sc * face), ly = (ty - y) / sc - j.drop / st + j.lift;
    // Undo the lean (about the hip).
    const r = -(j.lean) * Math.PI / 180, cx = 0, cy = -46, dx = lx - cx, dy = ly - cy;
    lx = cx + dx * Math.cos(r) - dy * Math.sin(r); ly = cy + dx * Math.sin(r) + dy * Math.cos(r);
    return reachIK(HAND.x, lx, ly);
  }

  return (p, tm, ph) => {
    let x = it.x, y = it.y, face: number = it.face, post = base, alpha = 1, walking: { d: number; run: boolean } | null = null;
    if (turnFirst && firstTravel) {
      const r = route(firstTravel, x, it.face);
      face = -(Math.sign(r.xb - r.xa) || it.face);
    } else if (firstTravel && !turnFirst && firstTravel === segs[0]) {
      const r = route(firstTravel, x, it.face);
      if (r.xb !== r.xa) face = Math.sign(r.xb - r.xa);
    }
    const hold: Record<string, number> = {};
    if (hold0) hold[hold0] = 1;
    later.forEach((q) => { if (hold[q] == null) hold[q] = 0; });
    const overlays: { sg: Seg; u: number }[] = [];
    let jumpY = 0;
    for (const sg of segs) {
      if (p < sg.start) break;
      const a = sg.act, u = prog(sg, p), k = a.kind;
      const mine = a.by === i || a.by === ALL || a.by === PAIR;
      if (!mine) { overlays.push({ sg, u }); if (k === "give") { const q = Object.keys(hold).find((h) => later.includes(h as Prop)); if (q) hold[q] = u > 0.55 ? 1 : 0; } continue; }
      if (TRAVEL.has(k)) {
        const r = route(sg, x, face), m = pace(u);
        const nx = lerp(r.xa, r.xb, m);
        if (r.xb !== r.xa) face = Math.sign(r.xb - r.xa);
        if (u < 1) walking = { d: Math.abs(nx - r.xa) / Math.max(0.01, it.s), run: k === "run" };
        if (r.fadeIn) alpha = Math.min(alpha, clamp(u / 0.25));
        if (r.fadeOut) alpha = Math.min(alpha, clamp((1 - u) / 0.25));
        if (k === "leave" && !r.fadeOut && u >= 1) alpha = 0;
        x = nx;
        post = STAND;
      } else if (k === "turn") {
        face = u >= 1 ? -Math.sign(face || 1) : Math.sign(face || 1) * Math.cos(Math.PI * u);
      } else if (POSTURE.has(k)) {
        const seatHere = k === "sit" && seat;
        if (seatHere && seat) { x = lerp(x, seat.x + (i % 2 ? 6 : -6) * seat.s, ease(clamp(u / 0.5))); y = lerp(it.y, seat.y + 1, ease(clamp(u / 0.5))); }
        const to = k === "rise" ? STAND : k === "fall" ? restJoints("fallen") : k === "kneel" ? restJoints("kneel") : k === "lie" ? restJoints("lie") : restJoints("sit", !!seatHere);
        post = mixJ(post, to, k === "fall" ? Math.min(1, u * u * 1.2) : ease(u));
      } else if (a.by === PAIR && partner) {
        // Come together over the first part, then the act itself.
        const gap = (k === "greet" ? 24 : k === "dance" ? 14 : 9) * it.s, mid = (it.x + partner.x) / 2;
        const goal = mid + (it.x < partner.x ? -gap / 2 : gap / 2), m = pace(clamp(u / 0.45));
        x = lerp(it.x, goal, m);
        face = partner.x > it.x ? 1 : -1;
        if (u < 0.45 && Math.abs(goal - it.x) > 3 * it.s) walking = { d: Math.abs(x - it.x) / it.s, run: false };
        overlays.push({ sg, u });
      } else {
        if (k === "jump") jumpY = -Math.sin(Math.PI * u) * 22;
        overlays.push({ sg, u });
      }
    }
    let j = post;
    if (walking) j = gait(walking.d / (walking.run ? 9 : 6) + ph, walking.run, post);
    else if (!segs.length && (it.pose === "walk" || it.pose === "run")) j = gait(tm * (it.pose === "run" ? 9 : 5.5) + ph, it.pose === "run", rest);
    // Breath.
    j = { ...j, lift: j.lift + Math.sin(tm * 1.4 + ph) * 0.25 };
    // Holding something with nothing else for the hand to do: the arm keeps it where it is held.
    const holding = Object.keys(hold).find((q) => hold[q] > 0.5);
    if (holding && !walking) { const ang = holding === "umbrella" ? -150 : holding === "candle" ? -96 : -62; j = { ...j, sh2: ang + Math.sin(tm * 1.1 + ph) * 1.5, el2: holding === "umbrella" ? 0 : -14 }; }
    else if (holding && walking && holding === "umbrella") j = { ...j, sh2: -150, el2: 0 };

    for (const { sg, u } of overlays) {
      const a = sg.act, k = a.kind, w = bump(u);
      if (w <= 0 && k !== "point" && !(a.by === PAIR && u >= 1)) continue;
      const mine = a.by === i || a.by === ALL || a.by === PAIR;
      if (!mine) {
        // Being handed something, or greeted: the hand goes out to meet it.
        j = mixJ(j, { ...j, sh2: -58, el2: -16 }, w);
        continue;
      }
      const t = aim(a.to, it);
      if (REACH.has(k) || k === "give") {
        const goal = k === "give" && partner ? { x: (x + partner.x) / 2, y: y - 50 * it.s } : t;
        const ik = goal ? reachTo(j, x, y, face, goal.x, goal.y + (k === "knock" ? Math.sin(tm * 18) * 2 * it.s : 0)) : null;
        const arm = ik ? { sh2: ik[0], el2: ik[1] } : { sh2: -70, el2: -12 };
        // Lean toward something low.
        const low = goal && goal.y > y - 40 * it.s ? 14 : 0;
        j = mixJ(j, { ...j, ...arm, lean: j.lean + low }, k === "point" ? clamp(u / 0.25) : w);
        if (k === "give" && hold0) hold[hold0] = u < 0.55 ? 1 : 0;
        if (k === "put") { const q = Object.keys(hold).find((h) => hold[h] > 0.5); if (q && u > 0.6) hold[q] = 0; }
        if (k === "take") later.forEach((q) => { hold[q] = u > 0.5 ? 1 : hold[q]; });
        continue;
      }
      switch (k) {
        case "drop": { const q = Object.keys(hold).find((h) => hold[h] > 0.5); if (q && u > 0.45) hold[q] = 0; j = mixJ(j, { ...j, sh2: -20, el2: 0 }, w); break; }
        case "throw": { const q = Object.keys(hold).find((h) => hold[h] > 0.5); if (q && u > 0.55) hold[q] = 0; const sw = u < 0.45 ? 40 * ease(u / 0.45) : lerp(40, -150, ease(clamp((u - 0.45) / 0.2))); j = mixJ(j, { ...j, sh2: sw, el2: -20, lean: j.lean + (u < 0.45 ? -6 : 8) }, w); break; }
        case "raise": j = mixJ(j, { ...j, sh2: -160, el2: -6, head: -10 }, w); break;
        case "wave": j = mixJ(j, { ...j, sh2: -150, el2: Math.sin(tm * 9) * 28 - 20 }, w); break;
        case "look": {
          const up = a.to === UP || (t && t.y < y - 110 * it.s), down = a.to === DOWN || (t && t.y > y - 20 * it.s);
          if (t && Math.abs(face) > 0.5 && Math.sign(t.x - x) !== Math.sign(face) && Math.abs(t.x - x) > 8 * it.s) face = Math.sign(t.x - x) * Math.max(0.3, 1 - 2 * w) || face;
          j = mixJ(j, { ...j, head: up ? -22 : down ? 18 : -4, lean: j.lean + (up ? -5 : down ? 6 : 0), ...(up && a.to === UP ? { sh2: -120, el2: -100 } : {}) }, w);
          break;
        }
        case "drink": j = mixJ(j, { ...j, sh2: -130, el2: -110, head: -14 }, w); break;
        case "read": j = mixJ(j, { ...j, sh1: -55, el1: -60, sh2: -55, el2: -60, head: 14 }, w); break;
        case "work": j = mixJ(j, { ...j, sh1: -45 + Math.sin(tm * 6) * 8, el1: -40, sh2: -50 + Math.sin(tm * 6 + 2) * 8, el2: -44, head: 12, lean: j.lean + 8 }, w); break;
        case "speak": j = mixJ(j, { ...j, sh2: -38 + Math.sin(tm * 3.1) * 12, el2: -50, head: Math.sin(tm * 5) * 3 }, w); break;
        case "nod": j = mixJ(j, { ...j, head: 10 + Math.sin(u * Math.PI * 4) * 10 }, w); break;
        case "shake": j = mixJ(j, { ...j, head: Math.sin(u * Math.PI * 6) * 9 }, w); break;
        case "bow": j = mixJ(j, { ...j, lean: j.lean + 38, head: 10, sh2: 10, sh1: 6 }, w); break;
        case "weep": j = mixJ(j, { ...j, head: 22, lean: j.lean + 8, sh1: -100, el1: -120, sh2: -104, el2: -126, lift: j.lift + Math.abs(Math.sin(tm * 7)) * 0.8 }, w); break;
        case "laugh": j = mixJ(j, { ...j, head: -16, lean: j.lean - 6, lift: j.lift + Math.abs(Math.sin(tm * 11)) * 1.2, sh2: -20, el2: -70 }, w); break;
        case "jump": j = mixJ(j, { ...j, hip1: -40, knee1: 70, hip2: -50, knee2: 80, sh1: -150, sh2: -160, el1: 0, el2: 0 }, Math.sin(Math.PI * u)); break;
        case "hug": { const v = clamp((u - 0.4) / 0.3); j = mixJ(j, { ...j, sh1: -80, el1: -60, sh2: -84, el2: -64, lean: j.lean + 6, head: 6 }, v); break; }
        case "kiss": { const v = clamp((u - 0.4) / 0.3); j = mixJ(j, { ...j, sh1: -40, el1: -40, sh2: -70, el2: -60, lean: j.lean + 10, head: -8 }, v); break; }
        case "dance": { const v = clamp((u - 0.4) / 0.2) * (u < 0.95 ? 1 : (1 - u) / 0.05); j = mixJ(j, { ...j, sh2: -120, el2: -30, sh1: -40, lean: Math.sin(tm * 4) * 9, lift: Math.abs(Math.sin(tm * 4)) * 3, hip1: Math.sin(tm * 4) * 10, hip2: -Math.sin(tm * 4) * 10 }, v); break; }
        case "greet": { const v = clamp((u - 0.4) / 0.25) * bump(u); j = mixJ(j, { ...j, sh2: -50, el2: -18 + Math.sin(tm * 10) * 6 }, v); break; }
      }
    }
    return { x, y: y + jumpY * it.s, s: it.s, face, j, alpha, hold };
  };
}

/* ---------------- things ---------------- */

export interface Ev { kind: string; a: number; b: number; manner: number; dir: number }

/** The events that touch thing slot j: its own acts, and what hands do to it (in the middle of the hand's act). */
export function thingEvents(tl: Timeline, j: number): Ev[] {
  const out: Ev[] = [];
  tl.segs.forEach((sg) => {
    const a: Act = sg.act, len = sg.end - sg.start;
    if (a.by === THING0 + j) out.push({ kind: a.kind, a: sg.start, b: sg.end, manner: a.manner, dir: a.to === OFF_BEHIND ? -1 : 1 });
    else if (a.by <= PAIR && thingOf(a.to) === j) {
      const map: Record<string, string> = { open: "open", close: "close", light: "light", snuff: "die", take: "take", put: "put", knock: "knock" };
      const k = map[a.kind];
      if (k) out.push({ kind: k, a: sg.start + len * (k === "take" ? 0.45 : 0.4), b: sg.start + len * (k === "take" ? 0.55 : 0.85), manner: a.manner, dir: 1 });
    }
  });
  return out;
}

const has = (ev: Ev[], ...k: string[]) => ev.some((e) => k.includes(e.kind));
const span = (e: Ev, p: number) => clamp((p - e.a) / Math.max(0.01, e.b - e.a));

/** How open (0 shut … 1 open), or null when no act opens or closes it. */
export function openAt(ev: Ev[], p: number): number | null {
  if (!has(ev, "open", "close")) return null;
  let v = ev.find((e) => e.kind === "open" || e.kind === "close")!.kind === "open" ? 0 : 1;
  for (const e of ev) {
    if (e.kind !== "open" && e.kind !== "close" || p < e.a) continue;
    const u = span(e, p), to = e.kind === "open" ? 1 : 0;
    // A slam: fast, with a small bounce at the end.
    const m = e.manner === 2 && to === 0 ? Math.min(1, u * u * 1.4) + (u > 0.75 ? Math.sin((u - 0.75) * 25) * 0.04 * (1 - u) * 4 : 0) : ease(u);
    v = lerp(v, to, m);
  }
  return clamp(v);
}

/** How lit (0 out … 1 burning), or null when no act lights or puts it out. */
export function litAt(ev: Ev[], p: number): number | null {
  if (!has(ev, "light", "die")) return null;
  let v = ev.find((e) => e.kind === "light" || e.kind === "die")!.kind === "light" ? 0 : 1;
  for (const e of ev) {
    if (e.kind !== "light" && e.kind !== "die" || p < e.a) continue;
    const u = span(e, p);
    v = e.kind === "light" ? lerp(v, 1, u < 0.15 ? u / 0.15 * 0.5 : 0.5 + 0.5 * ease((u - 0.15) / 0.85)) : lerp(v, 0, ease(u));
  }
  return clamp(v);
}

/** Smoke after a flame goes out: 0 none … 1 just out, fading over two seconds. */
export function smokeAt(ev: Ev[], p: number): number {
  const d = ev.filter((e) => e.kind === "die" && p >= e.b * 0.9 + e.a * 0.1).pop();
  return d ? clamp(1 - (p - d.b) / 2.2) * clamp((p - (d.a + (d.b - d.a) * 0.6)) / 0.3) : 0;
}

/** Where a moving thing is along its run: −1 far off before, 0 at rest, 1 far off after; null when it does not travel. */
export function travelAt(ev: Ev[], p: number): number | null {
  if (!has(ev, "arrive", "depart", "pass")) return null;
  const first = ev.find((e) => e.kind === "arrive" || e.kind === "depart" || e.kind === "pass")!;
  let v = first.kind === "depart" ? 0 : -1;
  for (const e of ev) {
    if (!["arrive", "depart", "pass"].includes(e.kind) || p < e.a) continue;
    const u = span(e, p);
    // Arriving slows to a stop; leaving pulls away slowly then faster; passing keeps its pace.
    v = e.kind === "arrive" ? -1 + (1 - Math.pow(1 - u, 2.4)) : e.kind === "depart" ? Math.pow(u, 2.2) : -1 + 2 * u;
  }
  return v;
}

/** 0 standing … 1 fallen over (and down to the floor when it fell from a table). */
export function fallAt(ev: Ev[], p: number): number {
  const e = ev.find((x) => x.kind === "fall");
  return e ? clamp(Math.pow(span(e, p), 1.8)) : 0;
}

/** A ring or a knock: how much it shakes now. */
export function ringAt(ev: Ev[], p: number, tm: number): number {
  let r = 0;
  ev.forEach((e) => { if ((e.kind === "ring" || e.kind === "knock") && p >= e.a && p <= e.b + 0.4) r = Math.max(r, Math.sin(tm * 30) * (1 - span(e, p) * 0.7)); });
  return r;
}

/** 1 seen … 0 taken away (or not yet put down). */
export function shownAt(ev: Ev[], p: number): number {
  let v = has(ev, "put") && !has(ev, "take") ? 0 : 1;
  for (const e of ev) {
    if (p < e.a) continue;
    if (e.kind === "take") v = 1 - span(e, p);
    if (e.kind === "put") v = span(e, p);
  }
  return v;
}
