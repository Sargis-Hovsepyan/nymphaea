// Where everything goes in a composed scene, before anything is drawn. A pinhole camera gives the
// scene a horizon and a sense of scale: a thing standing on the ground at height y is drawn
// `ratio × (y − horizon) × its real height` tall, so far things are small and high, near things big
// and low, and a figure's head meets the horizon when the camera is at eye level. The camera's shot
// (wide, mid, close) sets the horizon and the ratio. The focus (the figures, or the main thing in a
// close shot) sits on one third and the light on the other. Water is never stood on. The result is
// a list of boxes, so it can be tested without drawing. Pure.
import { rng } from "./noise";
import { statureScale } from "./figure";
import { ON_WATER, OUTDOOR_ONLY, SMALL, isIndoor, isWater, type Place, type Pose, type Prop, type Shot, type Spec } from "./spec";
import { ALL, PAIR, PAIR_KINDS, figOf, thingOf, type Act } from "./acts";

/** Native size of each drawing at scale 1 (compose/things.ts) and its real height in figure units (an adult is 1). */
export const SIZE: Record<Prop, { w: number; h: number; real: number }> = {
  tree: { w: 44, h: 62, real: 3.4 }, house: { w: 58, h: 48, real: 3 }, lamp: { w: 10, h: 64, real: 2.3 }, boat: { w: 46, h: 40, real: 1.7 },
  bird: { w: 30, h: 10, real: 0 }, car: { w: 40, h: 16, real: 0.85 }, tower: { w: 20, h: 92, real: 7 }, fire: { w: 30, h: 24, real: 0.45 },
  table: { w: 64, h: 27, real: 0.44 }, cup: { w: 14, h: 12, real: 0.07 }, book: { w: 26, h: 7, real: 0.04 }, candle: { w: 8, h: 24, real: 0.15 },
  door: { w: 30, h: 46, real: 1.2 }, flower: { w: 34, h: 20, real: 0.3 }, bench: { w: 40, h: 21, real: 0.5 }, dog: { w: 36, h: 17, real: 0.36 },
  cat: { w: 22, h: 17, real: 0.2 }, horse: { w: 48, h: 34, real: 0.95 }, bridge: { w: 200, h: 30, real: 0.9 }, window: { w: 54, h: 64, real: 0.62 },
  bed: { w: 86, h: 30, real: 0.5 }, chair: { w: 20, h: 40, real: 0.55 }, shelf: { w: 42, h: 72, real: 1.15 }, clock: { w: 18, h: 18, real: 0.22 },
  mirror: { w: 24, h: 38, real: 0.55 }, stairs: { w: 70, h: 80, real: 1.7 }, piano: { w: 60, h: 42, real: 0.75 }, letter: { w: 16, h: 3, real: 0.01 },
  glass: { w: 8, h: 13, real: 0.08 }, umbrella: { w: 40, h: 42, real: 0.75 }, suitcase: { w: 26, h: 19, real: 0.36 }, bicycle: { w: 46, h: 26, real: 0.6 },
  train: { w: 240, h: 40, real: 2.2 }, ship: { w: 120, h: 62, real: 6 }, fence: { w: 340, h: 14, real: 0.6 }, gate: { w: 36, h: 40, real: 0.9 },
  well: { w: 36, h: 40, real: 0.75 }, grave: { w: 16, h: 24, real: 0.5 }, rock: { w: 36, h: 18, real: 0.45 }, tent: { w: 52, h: 36, real: 1.1 },
};

/** Things a figure can hold, the most telling first. */
export const HELD: readonly Prop[] = ["umbrella", "candle", "letter", "book", "cup", "glass"];
/** Acts done with something already in the hand, and acts that pick something up. */
const WITH_HELD = new Set(["put", "drop", "throw", "raise", "drink", "read", "give"]);
/** Acts a hand does to a thing where it stands: the figure is placed within reach of it. */
const AT_HAND = new Set(["handle", "open", "close", "light", "snuff", "knock", "take", "point", "look"]);
/** Where a hand acts on each thing, in its own drawing units (x toward its facing side). */
export const ANCHOR: Partial<Record<Prop, [number, number]>> = {
  door: [8, -22], gate: [0, -24], candle: [0, -15], fire: [0, -8], lamp: [0, -52], cup: [0, -7], glass: [0, -7], letter: [0, -2], book: [0, -3],
  clock: [0, -9], umbrella: [0, -22], suitcase: [0, -18], piano: [0, -22], table: [0, -27], bench: [0, -11], chair: [0, -22], bed: [0, -14],
  tree: [0, -34], horse: [0, -24], dog: [0, -10], cat: [0, -8], bicycle: [0, -20], flower: [0, -14], mirror: [0, -19], shelf: [0, -40],
  fence: [0, -11], well: [0, -14], grave: [0, -16], rock: [0, -12], window: [0, -32], house: [0, -10], tent: [0, -14],
};
/** The acts of figure i (its own, everyone's, the pair's). */
export const actsOf = (acts: readonly Act[] | undefined, i: number): Act[] => (acts || []).filter((a) => a.by === i || a.by === ALL || (a.by === PAIR && i < 2) || ((a.kind === "give" || a.kind === "greet") && figOf(a.to) === i));

/** Adult figure: native 100 tall, about 26 wide. */
export const FIG_H = 100, FIG_W = 26;

/** Things that sit on a wall rather than the floor. */
const ON_WALL: readonly Prop[] = ["window", "clock", "mirror"];
/** Things kept back, against the wall or far in the land. */
const BIG: readonly Prop[] = ["house", "tower", "tree", "tent", "well", "shelf", "piano", "bed", "stairs", "door"];

export interface Cam { shot: Shot; hy: number; ratio: number }

export interface Item {
  kind: Prop | "fig";
  /** Figure number, or the thing's index in spec.props. */
  i: number;
  /** Base centre (feet, or the bottom of the thing). */
  x: number; y: number;
  /** Drawing scale, and the drawn box. */
  s: number; w: number; h: number;
  face: 1 | -1;
  /** What it stands on. */
  on: "ground" | "water" | "wall" | "ceiling" | "sky" | "table" | "bench" | "bed" | "chair" | "span" | "edge" | "boat" | "bridge";
  pose?: Pose;
  /** A figure holding a thing in its hand: it is drawn with the arm, not stood on the ground. */
  hold?: Prop;
  /** Sitting on something (not the ground). */
  seat?: boolean;
  /** Things this figure takes into its hand during the picture (drawn there, hidden until then). */
  later?: Prop[];
}

export interface Layout {
  cam: Cam;
  indoor: boolean;
  /** Bands of y that are ground (can be stood on), near band last. */
  land: [number, number][];
  /** A band of y that is water, if any. */
  water: [number, number] | null;
  /** Indoors: where the back wall meets the floor. */
  wall: number;
  /** The light (sun, moon, window) and the third the focus sits on. */
  light: { x: number; y: number };
  focusX: number;
  /** A close shot's surface line (a table top, a ledge). */
  surface: number;
  items: Item[];
  /** The props that were dropped because they do not belong here. */
  dropped: Prop[];
}

const BASE_HY: Record<Place, number> = {
  room: 104, kitchen: 104, bedroom: 106, study: 104, hall: 98, cafe: 104, church: 92,
  city: 140, station: 128, village: 138, garden: 142, road: 104, field: 128, hill: 138, forest: 150, mountain: 146,
  river: 122, lake: 116, sea: 108, shore: 104, harbour: 110, desert: 132, graveyard: 136, inner: 100,
};

export function camera(s: Spec): Cam {
  const r = rng(s.seed * 3 + 11), jit = (r() - 0.5) * 14;
  const indoor = isIndoor(s.place);
  if (s.shot === "mid") return { shot: "mid", hy: 92 + jit * 0.6, ratio: 1 };
  if (s.shot === "close") return { shot: "close", hy: 88 + jit, ratio: 1.5 };
  if (staged(s)) return { shot: "wide", hy: 112 + jit * 0.5, ratio: 0.8 };
  return { shot: "wide", hy: BASE_HY[s.place] + jit, ratio: indoor ? 1 : s.place === "road" ? 0.8 : 0.62 };
}

/** The effective shot: a close shot needs a thing to look at, a mid shot works best with people. */
export function effectiveShot(s: Spec): Shot {
  if (s.place === "inner" && !staged(s)) return "wide";
  if (s.shot === "close" && !s.props.some((p) => keep(s.place, p))) return s.who ? "mid" : "wide";
  return s.shot;
}

/** A picture with acts and no place is played on a bare stage. */
export const staged = (s: Pick<Spec, "place" | "acts">): boolean => s.place === "inner" && !!s.acts && s.acts.length > 0;

/** Does this thing belong in this place? On the bare stage anything does, except what needs water. */
export function keep(place: Place, p: Prop, stage = false): boolean {
  if (place === "inner") return stage && !ON_WATER.includes(p) && p !== "bridge";
  const indoor = isIndoor(place);
  if (indoor) return !OUTDOOR_ONLY.includes(p) && p !== "train";
  if (ON_WATER.includes(p)) return isWater(place);
  if (p === "bridge") return place === "river" || place === "lake" || place === "mountain" || place === "harbour" || place === "garden";
  if (p === "train") return ["station", "field", "road", "mountain", "city", "hill", "desert"].includes(place);
  if (p === "bed" || p === "shelf" || p === "mirror" || p === "piano" || p === "window" || p === "stairs" || p === "clock") return false;
  return true;
}

function bands(place: Place, cam: Cam, wantShore: boolean): { land: [number, number][]; water: [number, number] | null; wall: number } {
  const hy = cam.hy, H = 200, d = (k: number) => hy + (H - hy) * k;
  if (place === "inner") return { land: [[hy + 2, H - 2]], water: null, wall: 0 };
  if (isIndoor(place)) { const wall = d(cam.shot === "wide" ? 0.46 : 0.34); return { land: [[wall + 4, H - 2]], water: null, wall }; }
  switch (place) {
    case "sea": { const sh = wantShore ? d(cam.shot === "wide" ? 0.7 : 0.55) : H + 6; return { land: wantShore ? [[sh + 3, H - 2]] : [], water: [hy, sh], wall: 0 }; }
    case "shore": { const sh = d(0.36); return { land: [[sh + 4, H - 2]], water: [hy, sh], wall: 0 }; }
    case "harbour": { const q = d(0.5); return { land: [[q + 3, H - 2]], water: [hy, q], wall: 0 }; }
    case "lake": { const sh = d(0.48); return { land: [[sh + 4, H - 2]], water: [hy + 3, sh], wall: 0 }; }
    case "river": { const a = d(0.16), b = d(0.46); return { land: [[hy + 1, a - 1], [b + 3, H - 2]], water: [a, b], wall: 0 }; }
    default: return { land: [[hy + 2, H - 2]], water: null, wall: 0 };
  }
}

const span = (it: Item) => [it.x - it.w / 2, it.x + it.w / 2];
function overlap(a: Item, b: Item): number {
  const [a0, a1] = span(a), [b0, b1] = span(b);
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

export function layout(spec: Spec): Layout {
  const shot = effectiveShot(spec);
  const s: Spec = { ...spec, shot };
  const cam = camera(s), indoor = isIndoor(s.place);
  const rL = rng(s.seed + 7), rM = rng(s.moment * 131 + s.seed + 3);
  const stage = staged(s);
  const kept = s.props.filter((p) => keep(s.place, p, stage));
  const dropped = s.props.filter((p) => !kept.includes(p));
  const { land, water, wall } = bands(s.place, cam, s.who > 0 || kept.some((p) => !ON_WATER.includes(p) && p !== "bird"));
  // The light: a window on the back wall indoors, the sun or moon outside; the focus on the other third.
  const lightLeft = rL() < 0.5;
  const light = indoor ? { x: lightLeft ? 50 + rL() * 40 : 190 + rL() * 40, y: wall - (wall - cam.hy) * 0.85 }
    : { x: lightLeft ? 60 + rL() * 50 : 210 + rL() * 50, y: cam.hy * 0.42 };
  const focusX = (light.x < 160 ? 213 : 107) + (rM() - 0.5) * 18;
  const near = land.length ? land[land.length - 1] : null;
  const yAt = (z: number, band = near) => band ? band[0] + (band[1] - band[0]) * z : 196;
  const px = (y: number, real: number) => Math.max(0.5, cam.ratio * (y - cam.hy)) * real;
  const items: Item[] = [];
  const out: Layout = { cam, indoor, land, water, wall, light, focusX, surface: 150, items, dropped };

  if (s.place === "inner" && !stage) return out;

  /* close shot: a still life of the main thing on a surface, the place soft behind it */
  if (shot === "close") {
    const surf = 138 + rL() * 18;
    out.surface = surf;
    const main = kept[0], sz = SIZE[main];
    const sc = Math.min(96 / sz.h, 150 / sz.w, 3.4);
    items.push({ kind: main, i: s.props.indexOf(main), x: focusX, y: surf + 14, s: sc, w: sz.w * sc, h: sz.h * sc, face: light.x < focusX ? -1 : 1, on: "edge" });
    kept.slice(1).forEach((p, k) => {
      const z = SIZE[p], c = Math.min(sc * 0.75, 60 / z.h, 90 / z.w);
      const x = focusX + (focusX > 160 ? -1 : 1) * (70 + k * 46);
      if (x < 10 || x > 310) return;
      items.push({ kind: p, i: s.props.indexOf(p), x, y: surf + 8 + k * 4, s: c, w: z.w * c, h: z.h * c, face: 1, on: "edge" });
    });
    // someone just out of frame: a large shoulder and head at the edge, framing the still life
    if (s.who > 0) {
      const sc2 = 2.3 * statureScale(s.cast[0] ?? 0);
      items.push({ kind: "fig", i: 0, x: light.x < 160 ? 26 : 294, y: 200 + 120 * sc2 * 0.42, s: sc2, w: FIG_W * sc2, h: FIG_H * sc2, face: light.x < 160 ? 1 : -1, on: "ground", pose: "stand" });
    }
    return out;
  }

  /* figures */
  const figs: Item[] = [];
  const n = s.who;
  if (n > 0 && near) {
    const zf = shot === "mid" ? 0.86 + rM() * 0.08 : 0.5 + rM() * 0.3;
    const y = yAt(zf);
    const sc = px(y, 1) / FIG_H;
    const gap = FIG_W * sc * (s.pose === "pair" ? 0.7 : 1.25);
    const toLight: 1 | -1 = light.x > focusX ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap, st = statureScale(s.cast[i] ?? 0);
      const face: 1 | -1 = s.pose === "pair" && n >= 2 ? (i < n / 2 ? 1 : -1) : s.pose === "walk" || s.pose === "run" ? toLight : (i % 2 && n > 2 ? (-toLight as 1 | -1) : toLight);
      figs.push({ kind: "fig", i, x: focusX + off, y: y + (i % 2) * 3 * sc, s: sc, w: FIG_W * sc * st, h: FIG_H * sc * st, face, on: "ground", pose: s.pose === "pair" && n < 2 ? "stand" : s.pose });
    }
  }

  /* what the figure holds: an umbrella always, a light, a letter, a book or a cup when the words
     say it is held, or when there is nothing to set it on */
  let held: Prop | null = null;
  const acts = s.acts || [];
  const taken = new Set(acts.filter((a) => a.kind === "take").map((a) => s.props[thingOf(a.to)]).filter(Boolean));
  if (figs.length) {
    const surface = kept.some((p) => p === "table" || p === "bench" || p === "rock") || indoor;
    // What the acts need in a hand: the cup that is drunk from, the letter that is read or given.
    const needs = (i: number) => actsOf(acts, i).filter((a) => a.by !== PAIR && WITH_HELD.has(a.kind) && figOf(a.to) !== i);
    figs.forEach((fg, i) => {
      const want = needs(i);
      if (!want.length) return;
      const named = want.map((a) => s.props[thingOf(a.to)]).find((p) => p && HELD.includes(p) && kept.includes(p) && !taken.has(p));
      const p = named || HELD.find((q) => kept.includes(q) && !taken.has(q) && q !== held);
      if (p) { fg.hold = p; if (i === 0) held = p; }
    });
    const hands = HELD.filter((p) => kept.includes(p) && !taken.has(p) && (p === "umbrella" || s.pose === "reach" || !surface));
    if (!held && hands.length && !figs[0].hold) { held = hands[0]; const f0 = figs[0]; f0.hold = held; if (f0.pose === "stand" || f0.pose === "look") f0.pose = "reach"; }
    // Things taken, and things handed over, are drawn in the hand that ends up with them.
    acts.forEach((a) => {
      if (a.kind === "take") { const p = s.props[thingOf(a.to)]; const tg = a.by <= 2 ? figs[a.by] : figs[0]; if (p && tg && HELD.concat(["suitcase", "flower"] as Prop[]).includes(p)) (tg.later = tg.later || []).push(p); }
      if (a.kind === "give") { const to = figs[figOf(a.to)], from = figs[a.by]; if (to && from && from.hold) (to.later = to.later || []).push(from.hold); }
    });
  }

  /* things */
  const place = (p: Prop, idx: number) => {
    const sz = SIZE[p];
    if (p === "bird") { items.push({ kind: p, i: idx, x: 0, y: 0, s: 1, w: 0, h: 0, face: 1, on: "sky" }); return; }
    if (indoor && (ON_WALL.includes(p) || p === "fire" || p === "lamp")) {
      // On the back wall, away from the main window: u is one figure height at the wall's distance.
      const u = wall - cam.hy, x = p === "lamp" ? (items.find((q) => q.kind === "table")?.x ?? focusX) : light.x < 160 ? 190 + rL() * 80 : 50 + rL() * 80;
      if (p === "lamp") { items.push({ kind: p, i: idx, x, y: cam.hy - u * 0.55, s: Math.max(0.5, u / 46), w: 30, h: 50, face: 1, on: "ceiling" }); return; }
      const base = p === "window" ? wall - 0.45 * u : p === "clock" ? wall - 0.95 * u : p === "fire" ? wall + 1 : wall - 0.5 * u;
      const sc = p === "fire" ? u * 0.42 / sz.h : sz.real * u / sz.h;
      items.push({ kind: p, i: idx, x, y: base, s: sc, w: sz.w * sc, h: sz.h * sc, face: 1, on: "wall" });
      return;
    }
    if (ON_WATER.includes(p) && water) {
      const z = p === "ship" ? 0.2 + rL() * 0.2 : 0.45 + rM() * 0.35, y = water[0] + (water[1] - water[0]) * z;
      const sc = px(y, sz.real) / sz.h, x = p === "ship" ? (light.x < 160 ? 230 : 90) : focusX + (focusX > 160 ? -90 : 90) * (0.5 + rM() * 0.5);
      items.push({ kind: p, i: idx, x, y, s: sc, w: sz.w * sc, h: sz.h * sc, face: rM() < 0.5 ? 1 : -1, on: "water" });
      return;
    }
    if (p === "bridge") {
      const y = water ? water[0] + (water[1] - water[0]) * 0.55 : cam.hy + (200 - cam.hy) * 0.35, sc = px(y, sz.real) / sz.h * 1.6;
      items.push({ kind: p, i: idx, x: 160, y, s: Math.max(0.6, sc), w: 340, h: sz.h * sc, face: 1, on: "span" });
      return;
    }
    if (p === "train" || p === "fence") {
      const y = p === "fence" ? yAt(0.78) : yAt(indoor ? 0.2 : 0.18), sc = px(y, sz.real) / sz.h;
      items.push({ kind: p, i: idx, x: 160, y, s: sc, w: p === "fence" ? 340 : sz.w * sc, h: sz.h * sc, face: light.x < 160 ? 1 : -1, on: "span" });
      return;
    }
    if (!near) return;
    // Depth: big things stand back, animals keep near the people, the rest in between.
    const z = BIG.includes(p) ? (indoor ? 0.02 + rL() * 0.12 : 0.04 + rL() * 0.3)
      : p === "dog" || p === "cat" ? (figs[0] ? Math.min(1, (figs[0].y - near[0]) / (near[1] - near[0]) + 0.04) : 0.6 + rM() * 0.3)
      : p === "table" ? 0.38 + rL() * 0.2 : 0.3 + rM() * 0.5;
    const y = yAt(z), sc = px(y, sz.real) / sz.h;
    const it: Item = { kind: p, i: idx, x: 0, y, s: sc, w: sz.w * sc, h: sz.h * sc, face: rM() < 0.5 ? 1 : -1, on: "ground" };
    // Candidate x positions: keep clear of the figures (when nearer than them) and of each other.
    let best = 160, bestV = -Infinity;
    for (let k = 0; k < 28; k++) {
      const x = 16 + (288 * k) / 27 + (rL() - 0.5) * 6;
      const cand = { ...it, x };
      if (x - cand.w / 2 < -cand.w * 0.3 || x + cand.w / 2 > 320 + cand.w * 0.3) continue;
      let v = -Math.abs(x - (BIG.includes(p) ? (focusX > 160 ? 80 : 240) : (p === "table" ? focusX : 160))) * 0.05;
      figs.forEach((fg) => { const o = overlap(cand, fg); if (o > 0) v -= (cand.y > fg.y - 2 && cand.h > fg.h * 0.3 ? 400 : 20) * o / fg.w; });
      items.forEach((q) => { if (q.on === "ground" || q.on === "wall") v -= 6 * overlap(cand, q) / Math.max(4, Math.min(cand.w, q.w)); });
      if (p === "dog" || p === "cat") v += figs[0] ? -Math.abs(x - (figs[0].x + figs[0].face * figs[0].w * 1.4)) * 0.4 : 0;
      v += rM() * 0.6;
      if (v > bestV) { bestV = v; best = x; }
    }
    it.x = best;
    items.push(it);
  };
  kept.filter((p) => !SMALL.includes(p) && p !== held).sort((a, b) => (a === "lamp" ? 1 : 0) - (b === "lamp" ? 1 : 0)).forEach((p) => place(p, s.props.indexOf(p)));

  // Small things need a surface: a table indoors (one is set if needed), a bench outside, else nothing.
  const smalls = kept.filter((p) => SMALL.includes(p) && p !== held);
  let table = items.find((q) => q.kind === "table");
  if (smalls.length && indoor && !table) { place("table", -1); table = items.find((q) => q.kind === "table"); }
  const top = table || items.find((q) => q.kind === "bench" || q.kind === "rock");
  smalls.forEach((p, k) => {
    if (!top) { out.dropped.push(p); return; }
    const sz = SIZE[p], sc = top.s, x = top.x + (k - (smalls.length - 1) / 2) * Math.min(top.w / Math.max(1, smalls.length), 26 * sc);
    items.push({ kind: p, i: s.props.indexOf(p), x, y: top.y - top.h * (top.kind === "table" ? 0.96 : top.kind === "bench" ? 0.5 : 0.85), s: sc, w: sz.w * sc, h: sz.h * sc, face: 1, on: top.kind === "table" ? "table" : "bench" });
  });

  // Sitting and lying figures use what is there: chairs at a table, a bench, a bed; else the ground.
  const seatOf = items.find((q) => q.kind === "bench" || q.kind === "bed" || q.kind === "chair");
  figs.forEach((fg, k) => {
    if (fg.pose === "sit") {
      if (table && indoor) {
        const side = k % 2 ? 1 : -1;
        fg.x = Math.max(12, Math.min(308, table.x + side * (table.w / 2 + FIG_W * table.s * 0.6 + Math.floor(k / 2) * FIG_W * table.s * 1.4))); fg.y = table.y + 2 + Math.floor(k / 2) * 4; fg.s = table.s * SIZE.table.h / (SIZE.table.real * FIG_H); fg.h = FIG_H * fg.s; fg.w = FIG_W * fg.s;
        fg.face = side > 0 ? -1 : 1; fg.seat = true; fg.on = "chair";
      } else if (seatOf && seatOf.kind !== "bed") {
        fg.x = seatOf.x + (k - (figs.length - 1) / 2) * seatOf.w * 0.34; fg.y = seatOf.y + 1; fg.s = px(seatOf.y, 1) / FIG_H; fg.h = FIG_H * fg.s; fg.w = FIG_W * fg.s; fg.seat = true; fg.on = "bench";
      }
    } else if (fg.pose === "lie") {
      const bed = items.find((q) => q.kind === "bed");
      if (bed) { fg.x = bed.x + (k - (figs.length - 1) / 2) * 20 * bed.s; fg.y = bed.y - bed.h * 0.5; fg.s = bed.s * SIZE.bed.h / (SIZE.bed.real * FIG_H) * 1; fg.on = "bed"; }
      fg.h = FIG_W * fg.s; fg.w = FIG_H * fg.s;
    }
  });
  // In the boat, on the bridge: where the words put the people.
  const boat = items.find((q) => q.kind === "boat" && q.on === "water");
  const bridge = items.find((q) => q.kind === "bridge");
  figs.forEach((fg, k) => {
    if (fg.on !== "ground") return;
    if (boat && k === 0 && fg.pose !== "walk" && fg.pose !== "run") {
      fg.s = boat.s * SIZE.boat.h / (SIZE.boat.real * FIG_H); fg.w = FIG_W * fg.s; fg.h = FIG_H * fg.s;
      fg.x = boat.x - boat.face * 5 * boat.s; fg.y = boat.y - 3 * boat.s; fg.pose = fg.hold ? fg.pose : "sit"; fg.seat = true; fg.on = "boat";
    } else if (bridge && fg.pose !== "sit" && fg.pose !== "lie" && water) {
      const sc = px(bridge.y, 1) / FIG_H, gap = FIG_W * sc * (fg.pose === "pair" ? 0.7 : 1.3);
      fg.s = sc; fg.w = FIG_W * sc; fg.h = FIG_H * sc;
      fg.x = 160 + (focusX > 160 ? 40 : -40) + (k - (figs.length - 1) / 2) * gap; fg.y = bridge.y - 16 * bridge.s; fg.on = "bridge";
    }
  });
  if (acts.length) block(figs, items, acts, s, px, near, shot);
  items.push(...figs);
  // Far things first.
  items.sort((a, b) => order(a) - order(b));
  return out;
}

/**
 * Stage the figures for what they do: a figure whose first act is with its hands on a thing stands
 * within reach of it, facing it; two who will meet stand apart, facing each other. Figures already
 * seated, in a boat or on a bridge stay where the words put them.
 */
function block(figs: Item[], items: Item[], acts: readonly Act[], s: Spec, px: (y: number, r: number) => number, near: [number, number] | null, shot: Shot): void {
  figs.forEach((fg, i) => {
    if (fg.on !== "ground") return;
    const mine = actsOf(acts, i);
    const first = mine.find((a) => a.kind !== "turn");
    if (!first) return;
    const ti = thingOf(first.to);
    const th = ti >= 0 ? items.find((q) => q.kind === s.props[ti]) : undefined;
    if (th && AT_HAND.has(first.kind) && th.on !== "sky") {
      // Stand at the thing's depth (in front of a wall or a table), an arm's length to its side.
      const y = th.on === "wall" ? Math.max(fg.y, (near ? near[0] : th.y) + 4) : th.on === "table" || th.on === "bench" ? (items.find((q) => q.kind === "table" || q.kind === "bench")?.y ?? th.y) + 3 : th.on === "ceiling" ? fg.y : th.y + 2;
      const sc = Math.max(0.2, px(y, 1) / FIG_H), side = th.x > 160 ? -1 : 1;
      const reach = (first.kind === "look" || first.kind === "point" ? 60 : 24) * sc + th.w * 0.3;
      fg.s = sc; fg.w = FIG_W * sc; fg.h = FIG_H * sc; fg.y = y;
      fg.x = Math.max(14, Math.min(306, th.x + side * reach)); fg.face = (th.x > fg.x ? 1 : -1);
      return;
    }
    if (first.by === PAIR && (PAIR_KINDS as readonly string[]).includes(first.kind) && i < 2 && figs[1 - i]) {
      // Two who will meet: apart, facing each other, so the picture can bring them together.
      const gap = FIG_W * fg.s * (shot === "mid" ? 2.4 : 3.2), mid = (figs[0].x + figs[1].x) / 2;
      fg.x = mid + (i === 0 ? -gap / 2 : gap / 2); fg.face = i === 0 ? 1 : -1;
      return;
    }
    if (first.kind === "give" || first.kind === "greet") {
      // Giver and taker an arm's length apart, facing each other.
      const oi = figOf(first.to) >= 0 && figOf(first.to) !== i ? figOf(first.to) : first.by, other = figs[oi];
      if (!other || other === fg) return;
      const mid = (fg.x + other.x) / 2, gap = FIG_W * fg.s * 1.9, left = i < oi;
      fg.x = mid + (left ? -gap / 2 : gap / 2); fg.face = left ? 1 : -1;
    }
  });
}

function order(it: Item): number {
  if (it.on === "sky") return -1000;
  if (it.on === "wall") return -500 + it.y * 0.01;
  if (it.on === "ceiling") return -400;
  if (it.kind === "bridge") return it.y - 0.5;
  if (it.on === "table" || it.on === "bench") return it.y + 0.5;
  if (it.kind === "fig" && (it.on === "chair" || it.on === "bed")) return it.y + 0.2;
  return it.y;
}
