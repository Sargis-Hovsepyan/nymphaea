// People in composed scenes: a small parametric silhouette with a head, a body, two arms and two
// legs, 100 units tall for an adult, its feet at 0,0. A build (0–35) sets stature (adult, child,
// elder), garment (coat, dress, plain, cloak) and head (bare, hair, hat), so the same person keeps
// the same silhouette from picture to picture. A pose sets what the limbs do; the walk cycle and
// the breath are driven each frame by poseFrame(). Pure markup and transforms.
import { f } from "../vscenes/shapes";
import type { VApi } from "../vscenes";
import type { Pose } from "./spec";

export interface Build { stature: 0 | 1 | 2; garment: 0 | 1 | 2 | 3; head: 0 | 1 | 2 }

export function build(b: number): Build {
  const n = ((b % 36) + 36) % 36;
  return { stature: Math.floor(n / 12) as Build["stature"], garment: (Math.floor(n / 3) % 4) as Build["garment"], head: (n % 3) as Build["head"] };
}

/** How tall a build stands, as a share of an adult. */
export const statureScale = (b: number): number => [1, 0.64, 0.95][build(b).stature];

const fig = (d: string, key = "") => '<path class="s fig"' + (key ? ' data-a="' + key + '"' : "") + ' d="' + d + '"/>';

const GARMENT = [
  // coat: shoulders to the knee, a little flared
  "M-10,-82 L10,-82 L12,-60 L14,-33 L-14,-33 L-12,-60 Z",
  // dress: a fitted top and a skirt to below the knee
  "M-9,-82 L9,-82 L8,-58 L17,-22 L-17,-22 L-8,-58 Z",
  // plain: shirt and trousers start at the hip
  "M-10,-82 L10,-82 L10.5,-45 L-10.5,-45 Z",
  // cloak: a long shape falling from the neck
  "M-7,-85 L7,-85 L17,-28 L-17,-28 Z",
];

function headSvg(b: Build, k: string): string {
  const r = b.stature === 1 ? 8.6 : 7;
  let d = "M" + f(-r) + ",-91 a" + r + "," + r + " 0 1,0 " + 2 * r + ",0 a" + r + "," + r + " 0 1,0 " + -2 * r + ",0 M-3,-85 L3,-85 L3,-81 L-3,-81 Z";
  if (b.head === 1) d += " M-7.5,-93 C-9,-80 -8,-76 -4,-74 L-3,-86 C-1,-95 6,-97 7.6,-91 C8,-99 -6,-101 -7.5,-93 Z";
  if (b.head === 2) d += " M-12,-95.5 L12,-95.5 L12,-93 L-12,-93 Z M-6.5,-104 L6.5,-104 L7,-95 L-7,-95 Z";
  return fig(d, k);
}

/** Legs for a pose (two paths, pivoting at the hip). */
function legs(p: Pose, seat: boolean): [string, string] {
  if (p === "sit" && seat) return [
    "M-9,-50 L20,-50 L21,-41 L13,-41 L13,0 L6,0 L6,-41 L-9,-41 Z",
    "M-4,-50 L24,-50 L25,-42 L18,-42 L18,0 L11,0 L11,-42 L-4,-42 Z",
  ];
  if (p === "sit") return [
    "M-9,-50 L34,-48 L34,-41 L-9,-41 Z",
    "M-4,-49 L36,-46 L36,-40 L-4,-41 Z",
  ];
  return ["M-10,-48 L-1,-48 L-2,0 L-9,0 Z", "M1,-48 L10,-48 L9,0 L2,0 Z"];
}

const ARM = (x: number) => "M" + f(x - 2.6) + ",-82 L" + f(x + 2.6) + ",-82 L" + f(x + 2.2) + ",-48 L" + f(x - 2.2) + ",-48 Z";

/**
 * A figure's markup. Keys: k (placed by the scene), k1 k2 (legs), ka kb (arms), kt (the body, for
 * lean and breath). face 1 looks right, −1 left. seat: sitting on something rather than the ground.
 */
export function figureSvg(k: string, b: number, pose: Pose, face: 1 | -1, seat = false): string {
  const B = build(b), [l1, l2] = legs(pose, seat), sc = statureScale(b);
  const body = fig(GARMENT[B.garment]) + headSvg(B, "") + fig(ARM(-11), k + "a") + fig(ARM(11), k + "b");
  return '<g class="fig-g" data-a="' + k + '"><g transform="scale(' + f(face * sc) + "," + f(sc) + ')">'
    + fig(l1, k + "1") + fig(l2, k + "2") + '<g data-a="' + k + 't">' + body + "</g></g></g>";
}

/** How far down a sitting figure's base sits below its seat line (feet on the floor). */
export const SEAT_DROP = 0;
/** Sitting on the ground: the hips are at −46, so the whole figure drops by this much. */
export const GROUND_SIT_DROP = 44;

/**
 * Move the limbs for this frame. t is the beat (scroll), tm seconds, ph a per-figure phase.
 * inward: for "pair", which way the partner stands (1 right, −1 left, in the figure's own frame).
 */
export function poseFrame(a: VApi, k: string, pose: Pose, b: number, t: number, tm: number, ph: number, inward = 1): void {
  const rot = (key: string, deg: number, cx: number, cy: number) => a.a(key).setAttribute("transform", "rotate(" + f(deg) + " " + cx + " " + cy + ")");
  const breath = Math.sin(tm * 1.4 + ph) * 0.6;
  const elder = build(b).stature === 2 ? 7 : 0;
  let l = 0, armA = 4, armB = -4, lean = elder, lift = breath * 0.4;
  const e = Math.min(1, Math.max(0, t));
  if (pose === "walk" || pose === "run") {
    const amp = pose === "run" ? 30 : 13, rate = pose === "run" ? 22 : 14;
    const settle = 1 - Math.max(0, (e - 0.92) / 0.08);
    l = Math.sin(e * rate + ph) * amp * settle;
    armA = -l * 0.9; armB = l * 0.9;
    lean += pose === "run" ? 12 : 2;
    lift = Math.abs(Math.cos(e * rate + ph)) * (pose === "run" ? 3 : 1);
  } else if (pose === "reach") {
    armB = -60 - 40 * e; armA = 6;
  } else if (pose === "look") {
    lean -= 6 * e; armB = -150 * Math.min(1, e * 1.3); armA = 3;
  } else if (pose === "pair") {
    armA = inward > 0 ? 6 : -70 * e; armB = inward > 0 ? -70 * e : -6;
  } else if (pose === "sit") {
    armA = -25; armB = -30; lean += 2;
  } else if (pose === "lie") {
    armA = 8; armB = -8;
  }
  rot(k + "1", pose === "sit" || pose === "lie" ? 0 : l, -5, -47);
  rot(k + "2", pose === "sit" || pose === "lie" ? 0 : -l, 5, -47);
  rot(k + "a", armA, -11, -80);
  rot(k + "b", armB, 11, -80);
  a.a(k + "t").setAttribute("transform", "translate(0," + f(-lift) + ") rotate(" + f(lean) + " 0 -46)");
}
