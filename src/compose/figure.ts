// People in composed scenes: a small parametric silhouette, 100 units tall for an adult, its feet at
// 0,0. A build (0–35) sets stature (adult, child, elder), garment (coat, dress, plain, cloak) and head
// (bare, hair, hat), so the same person keeps the same silhouette from picture to picture.
//
// The rig: each leg is a thigh and a shin (hip at −47, knee at −23.5), each arm an upper arm and a
// forearm (shoulder at −80, elbow at −63.5, hand at −45.5), the head turns at the neck (−84), the
// body leans and lifts at the hip, and the facing is a scale that can pass through zero, so a
// figure turns round. A pose is a set of joint angles (Joints); restJoints gives each still pose,
// gait the walk and the run, reachIK the arm that puts a hand on a point. Every frame is a handful
// of transforms on fixed shapes. Pure markup and transforms.
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
const g = (inner: string, key: string, tr = "") => '<g data-a="' + key + '"' + (tr ? ' transform="' + tr + '"' : "") + ">" + inner + "</g>";

const GARMENT = [
  // coat: sloped shoulders to the knee, a little flared, a collar
  "M-8.5,-82.5 C-11.5,-81.5 -12.8,-78.5 -12.3,-73 L-13.6,-34 Q0,-31.5 13.6,-34 L12.3,-73 C12.8,-78.5 11.5,-81.5 8.5,-82.5 L3.2,-84.5 L0,-79.5 L-3.2,-84.5 Z",
  // dress: a fitted top and a skirt to below the knee
  "M-8,-82.5 C-10.6,-81.5 -11.4,-78 -10.6,-72.5 C-9.8,-66 -8.6,-61 -8.2,-57.5 C-11.5,-48 -15.5,-34 -17.5,-22.5 Q0,-19.5 17.5,-22.5 C15.5,-34 11.5,-48 8.2,-57.5 C8.6,-61 9.8,-66 10.6,-72.5 C11.4,-78 10.6,-81.5 8,-82.5 Q0,-84.5 -8,-82.5 Z",
  // plain: a shirt to the hip
  "M-8.8,-82.5 C-11.6,-81.5 -12.2,-78 -11.6,-72 L-10.8,-46 Q0,-43.8 10.8,-46 L11.6,-72 C12.2,-78 11.6,-81.5 8.8,-82.5 Q0,-84.5 -8.8,-82.5 Z",
  // cloak: a long shape falling from the neck
  "M-5.5,-85.5 Q-9.5,-84.5 -10.5,-80 C-13.5,-62 -16.5,-42 -18.5,-27.5 Q0,-23.5 18.5,-27.5 C16.5,-42 13.5,-62 10.5,-80 Q9.5,-84.5 5.5,-85.5 Z",
];

/** The head, turned a little toward where the figure looks (a nose and a chin on the facing side), and its hair or hat. */
function headSvg(b: Build): string {
  const r = b.stature === 1 ? 8.6 : 7;
  let d = "M" + f(-r) + ",-91 a" + r + "," + r + " 0 1,0 " + 2 * r + ",0 a" + r + "," + r + " 0 1,0 " + -2 * r + ",0"
    + " M" + f(r - 1) + ",-92.5 L" + f(r + 1.6) + ",-89.8 L" + f(r - 0.6) + ",-88.6 Z";
  if (b.head === 1) d += " M-7.5,-93 C-9,-80 -8,-76 -4,-74 L-3,-86 C-1,-95 6,-97 7.6,-91 C8,-99 -6,-101 -7.5,-93 Z";
  if (b.head === 2) d += " M-12,-95.5 L12,-95.5 L12,-93 L-12,-93 Z M-6.5,-104 L6.5,-104 L7,-95 L-7,-95 Z";
  return d;
}
const NECK = "M-2.6,-86 L2.6,-86 L3,-81 Q0,-80 -3,-81 Z";

/** Joint centres. */
export const HIP_Y = -47, KNEE_Y = -23.5, SHOULDER_Y = -80, ELBOW_Y = -63.5, HAND_Y = -45.5, NECK_Y = -84;
/** Upper arm and forearm lengths. */
export const UPPER = ELBOW_Y - SHOULDER_Y, FORE = HAND_Y - ELBOW_Y;
/** Where the hand is, at rest, in the front arm's frame. */
export const HAND = { x: 11, y: -46 };
/** Sitting on the ground: the hips come down nearly to it. */
export const GROUND_SIT_DROP = 42;
/** Sitting on a seat (or kneeling): the thighs level, the root drops by a shin's length. */
export const SEAT_DROP = 23.5;

/** A thigh and a shin with its foot, for the leg at x0 (−5 back, 5 front). */
function leg(x0: number, k: string, n: 1 | 2): string {
  const thigh = "M" + f(x0 - 4.8) + ",-49 L" + f(x0 + 4.8) + ",-49 L" + f(x0 + 3.9) + ",-23.5 Q" + x0 + ",-21.6 " + f(x0 - 3.9) + ",-23.5 Z";
  const shin = "M" + f(x0 - 3.9) + ",-25.5 Q" + x0 + ",-27 " + f(x0 + 3.9) + ",-25.5 L" + f(x0 + 2.6) + ",-4 L" + f(x0 + 8.6) + ",-3.2 Q" + f(x0 + 10) + ",0 " + f(x0 + 6.6) + ",0 L" + f(x0 - 3.6) + ",0 Z";
  return g(fig(thigh) + g(fig(shin), k + (n + 2)), k + n);
}
/** An upper arm and a forearm with its hand, for the arm at x (−11 back, 11 front). */
function arm(x: number, k: string, sh: string, el: string, held = ""): string {
  const upper = "M" + f(x - 3) + ",-81 Q" + x + ",-84 " + f(x + 3) + ",-81 L" + f(x + 2.6) + ",-63 Q" + x + ",-61.4 " + f(x - 2.6) + ",-63 Z";
  const fore = "M" + f(x - 2.6) + ",-65 Q" + x + ",-66.2 " + f(x + 2.6) + ",-65 L" + f(x + 2.1) + ",-51 Q" + f(x + 2.9) + ",-46 " + x + ",-45.5 Q" + f(x - 2.9) + ",-46 " + f(x - 2.1) + ",-51 Z";
  return g(fig(upper) + g(fig(fore) + held, k + el), k + sh);
}

/**
 * A figure's markup. Keys: k (placed by the scene), kf (facing and stature), k1 k2 (hips), k3 k4
 * (knees), kt (the body: lean and breath), ka kb (shoulders), kc kd (elbows), kh (head). `held` is
 * markup for things in the front hand, each in its own keyed group (see draw.ts), kept upright there.
 */
export function figureSvg(k: string, b: number, held = ""): string {
  const B = build(b), sc = statureScale(b);
  const body = arm(-11, k, "a", "c") + fig(GARMENT[B.garment]) + fig(NECK) + g(fig(headSvg(B)), k + "h") + arm(11, k, "b", "d", held);
  return '<g class="fig-g" data-a="' + k + '">' + g(leg(-5, k, 1) + leg(5, k, 2) + g(body, k + "t"), k + "f", "scale(" + f(sc) + "," + f(sc) + ")") + "</g>";
}

/** Joint angles in degrees (positive turns clockwise on screen: a limb hanging down swings back), plus the body. */
export interface Joints {
  hip1: number; knee1: number; hip2: number; knee2: number;
  sh1: number; el1: number; sh2: number; el2: number;
  head: number; lean: number; lift: number;
  /** The root: dropped (sitting) and turned (lying), in the figure's own units. */
  drop: number; rot: number;
}

export const STAND: Joints = { hip1: 0, knee1: 0, hip2: 0, knee2: 0, sh1: 4, el1: -4, sh2: -4, el2: -6, head: 0, lean: 0, lift: 0, drop: 0, rot: 0 };

/** The still poses, as joints. seat: on a bench or chair (else the ground). */
export function restJoints(pose: Pose | "kneel" | "fallen", seat = false): Joints {
  const j = { ...STAND };
  switch (pose) {
    case "sit":
      if (seat) return { ...j, hip1: -84, knee1: 84, hip2: -80, knee2: 80, sh1: -20, el1: -42, sh2: -24, el2: -46, lean: 4, drop: SEAT_DROP };
      return { ...j, hip1: -88, knee1: 12, hip2: -82, knee2: 32, sh1: -18, el1: -12, sh2: -24, el2: -20, lean: 6, drop: GROUND_SIT_DROP };
    case "kneel": return { ...j, hip1: 0, knee1: 90, hip2: -86, knee2: 86, sh1: -8, el1: -20, sh2: -14, el2: -30, lean: 6, head: 8, drop: SEAT_DROP };
    case "lie": return { ...j, sh1: 8, sh2: -8, rot: 90, drop: -11 };
    case "fallen": return { ...j, hip1: -14, knee1: 30, hip2: 10, knee2: 12, sh1: -120, el1: -10, sh2: -60, el2: -20, rot: 88, drop: -9 };
    case "reach": return { ...j, sh1: 6, sh2: -80, el2: -10 };
    case "look": return { ...j, sh1: 3, sh2: -150, el2: -8, lean: -6, head: -12 };
    case "pair": return { ...j, sh1: 6, sh2: -70, el2: -16 };
    default: return j;
  }
}

/** Walk and run: the legs swing, the knee bends as the foot comes through, the arms swing against them. */
export function gait(phase: number, run: boolean, into: Joints = STAND): Joints {
  const amp = run ? 30 : 15, l = Math.sin(phase) * amp, kn = run ? 70 : 26;
  return {
    ...into, hip1: l, hip2: -l, knee1: Math.max(0, Math.sin(phase + 1.3)) * kn + 3, knee2: Math.max(0, -Math.sin(phase + 1.3)) * kn + 3,
    sh1: -l * 0.9, sh2: l * 0.9, el1: run ? -70 : -12, el2: run ? -70 : -12, lean: into.lean + (run ? 12 : 2),
    lift: Math.abs(Math.cos(phase)) * (run ? 3 : 1), drop: 0, rot: 0,
  };
}

export const mixJ = (a: Joints, b: Joints, u: number): Joints => {
  const o = { ...a };
  (Object.keys(a) as (keyof Joints)[]).forEach((k) => { o[k] = a[k] + (b[k] - a[k]) * u; });
  return o;
};

/**
 * The shoulder and elbow angles that put the hand on (tx, ty), in the figure's own frame (the
 * shoulder at sx, −80). Out of reach, the arm points straight at it. Never NaN.
 */
export function reachIK(sx: number, tx: number, ty: number): [number, number] {
  const dx = tx - sx, dy = ty - SHOULDER_Y, d = Math.max(0.5, Math.min(UPPER + FORE - 0.01, Math.hypot(dx, dy)));
  const aim = Math.atan2(-dx, dy);
  const cosA = (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), cosB = (UPPER * UPPER + FORE * FORE - d * d) / (2 * UPPER * FORE);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA))), B = Math.acos(Math.max(-1, Math.min(1, cosB)));
  // The elbow bends down and back, as an arm does reaching forward.
  const sh = aim + A, el = -(Math.PI - B);
  return [sh * 180 / Math.PI, el * 180 / Math.PI];
}

/** Where the hand of an arm (shoulder at sx) is for these angles: the check on reachIK. */
export function handAt(sx: number, sh: number, el: number): [number, number] {
  const r1 = sh * Math.PI / 180, r2 = (sh + el) * Math.PI / 180;
  return [sx - Math.sin(r1) * UPPER - Math.sin(r2) * FORE, SHOULDER_Y + Math.cos(r1) * UPPER + Math.cos(r2) * FORE];
}

/** Put the joints on a figure's parts. face: 1 right, −1 left, anything between while turning. */
export function setJoints(a: VApi, k: string, b: number, j: Joints, face: number): void {
  const rot = (key: string, deg: number, cx: number, cy: number) => a.a(key).setAttribute("transform", "rotate(" + f(deg) + " " + cx + " " + cy + ")");
  const st = statureScale(b), elder = build(b).stature === 2 ? 7 : 0;
  rot(k + "1", j.hip1, -5, HIP_Y); rot(k + "3", j.knee1, -5, KNEE_Y);
  rot(k + "2", j.hip2, 5, HIP_Y); rot(k + "4", j.knee2, 5, KNEE_Y);
  rot(k + "a", j.sh1, -11, SHOULDER_Y); rot(k + "c", j.el1, -11, ELBOW_Y);
  rot(k + "b", j.sh2, 11, SHOULDER_Y); rot(k + "d", j.el2, 11, ELBOW_Y);
  rot(k + "h", j.head, 0, NECK_Y);
  a.a(k + "t").setAttribute("transform", "translate(0," + f(-j.lift) + ") rotate(" + f(j.lean + elder) + " 0 -46)");
  a.a(k + "f").setAttribute("transform", "scale(" + f(face * st) + "," + f(st) + ")");
}

/** The whole lean of a figure's body for these joints (an elder stoops), for keeping a held thing upright. */
export const leanOf = (b: number, j: Joints): number => j.lean + (build(b).stature === 2 ? 7 : 0);

/** The front arm's shoulder angle when holding a thing: lifted above the head for an umbrella, else forward. */
export const holdAngle = (p: string): number => (p === "umbrella" ? -150 : p === "candle" ? -96 : -62);
