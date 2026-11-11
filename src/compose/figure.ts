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
  // coat: sloped shoulders to the knee, a little flared, a collar
  "M-8.5,-82.5 C-11.5,-81.5 -12.8,-78.5 -12.3,-73 L-13.6,-34 Q0,-31.5 13.6,-34 L12.3,-73 C12.8,-78.5 11.5,-81.5 8.5,-82.5 L3.2,-84.5 L0,-79.5 L-3.2,-84.5 Z",
  // dress: a fitted top and a skirt to below the knee
  "M-8,-82.5 C-10.6,-81.5 -11.4,-78 -10.6,-72.5 C-9.8,-66 -8.6,-61 -8.2,-57.5 C-11.5,-48 -15.5,-34 -17.5,-22.5 Q0,-19.5 17.5,-22.5 C15.5,-34 11.5,-48 8.2,-57.5 C8.6,-61 9.8,-66 10.6,-72.5 C11.4,-78 10.6,-81.5 8,-82.5 Q0,-84.5 -8,-82.5 Z",
  // plain: a shirt to the hip
  "M-8.8,-82.5 C-11.6,-81.5 -12.2,-78 -11.6,-72 L-10.8,-46 Q0,-43.8 10.8,-46 L11.6,-72 C12.2,-78 11.6,-81.5 8.8,-82.5 Q0,-84.5 -8.8,-82.5 Z",
  // cloak: a long shape falling from the neck
  "M-5.5,-85.5 Q-9.5,-84.5 -10.5,-80 C-13.5,-62 -16.5,-42 -18.5,-27.5 Q0,-23.5 18.5,-27.5 C16.5,-42 13.5,-62 10.5,-80 Q9.5,-84.5 5.5,-85.5 Z",
];

function headSvg(b: Build, k: string): string {
  const r = b.stature === 1 ? 8.6 : 7;
  // the head, turned a little toward where the figure looks (a nose and a chin on the facing side), and a neck
  let d = "M" + f(-r) + ",-91 a" + r + "," + r + " 0 1,0 " + 2 * r + ",0 a" + r + "," + r + " 0 1,0 " + -2 * r + ",0"
    + " M" + f(r - 1) + ",-92.5 L" + f(r + 1.6) + ",-89.8 L" + f(r - 0.6) + ",-88.6 Z M-2.6,-85.5 L2.6,-85.5 L3,-81 Q0,-80 -3,-81 Z";
  if (b.head === 1) d += " M-7.5,-93 C-9,-80 -8,-76 -4,-74 L-3,-86 C-1,-95 6,-97 7.6,-91 C8,-99 -6,-101 -7.5,-93 Z";
  if (b.head === 2) d += " M-12,-95.5 L12,-95.5 L12,-93 L-12,-93 Z M-6.5,-104 L6.5,-104 L7,-95 L-7,-95 Z";
  return fig(d, k);
}

/** Legs for a pose (two paths, pivoting at the hip), tapered, with feet toward the facing side. */
function legs(p: Pose, seat: boolean): [string, string] {
  if (p === "sit" && seat) return [
    "M-9,-50.5 L19,-50.5 Q22,-50 21.5,-46 L21,-41 L14,-41 L13.6,-4 L19,-3 Q20.4,0 17,0 L6.4,0 L6.6,-41 L-9,-41 Z",
    "M-4,-50.5 L23,-50.5 Q26,-50 25.5,-46 L25,-42 L18.6,-42 L18.3,-4 L23.4,-3 Q24.8,0 21.4,0 L11.2,0 L11.4,-42 L-4,-42 Z",
  ];
  if (p === "sit") return [
    "M-9,-50 Q12,-50 33,-48 Q36.5,-47 36,-43 L35.5,-40.5 L-9,-41 Z",
    "M-4,-49 Q15,-48.5 35,-46 Q38.5,-45 38,-41.5 L37.5,-39.5 L-4,-41 Z",
  ];
  return ["M-10.2,-48 L-0.8,-48 L-2.4,-4 L3.6,-3.2 Q5,0 1.6,0 L-8.6,0 Z", "M0.8,-48 L10.2,-48 L8.6,-4 L14.6,-3.2 Q16,0 12.6,0 L2.4,0 Z"];
}

/** An arm hanging from the shoulder at x, tapered, with a rounded hand at −46. */
const ARM = (x: number) => "M" + f(x - 3) + ",-81 Q" + f(x) + ",-84 " + f(x + 3) + ",-81 L" + f(x + 2.1) + ",-51 Q" + f(x + 2.9) + ",-46 " + f(x) + ",-45.5 Q" + f(x - 2.9) + ",-46 " + f(x - 2.1) + ",-51 Z";

/** The front arm's angle when holding a thing: lifted above the head for an umbrella, else forward. */
export const holdAngle = (p: string): number => (p === "umbrella" ? -150 : p === "candle" ? -96 : -62);
/** Where the hand is, in the arm's own frame (rotated with it). */
export const HAND = { x: 11, y: -46 };

/**
 * A figure's markup. Keys: k (placed by the scene), k1 k2 (legs), ka kb (arms), kt (the body, for
 * lean and breath). face 1 looks right, −1 left. seat: sitting on something rather than the ground.
 */
export function figureSvg(k: string, b: number, pose: Pose, face: 1 | -1, seat = false, held = ""): string {
  const B = build(b), [l1, l2] = legs(pose, seat), sc = statureScale(b);
  // A held thing goes with the front arm, so it stays in the hand as the arm moves.
  const front = held ? '<g data-a="' + k + 'b">' + fig(ARM(11)) + held + "</g>" : fig(ARM(11), k + "b");
  const body = fig(ARM(-11), k + "a") + fig(GARMENT[B.garment]) + headSvg(B, "") + front;
  return '<g class="fig-g" data-a="' + k + '"><g transform="scale(' + f(face * sc) + "," + f(sc) + ')">'
    + fig(l1, k + "1") + fig(l2, k + "2") + '<g data-a="' + k + 't">' + body + "</g></g></g>";
}

/** Sitting on the ground: the hips are at −46, so the whole figure drops by this much. */
export const GROUND_SIT_DROP = 44;

/**
 * Move the limbs for this frame. t is the beat (scroll), tm seconds, ph a per-figure phase.
 * inward: for "pair", which way the partner stands (1 right, −1 left, in the figure's own frame).
 */
export function poseFrame(a: VApi, k: string, pose: Pose, b: number, t: number, tm: number, ph: number, inward = 1, hold = ""): void {
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
  // Holding a thing: the front arm keeps it where it is held, whatever the rest of the body does.
  if (hold) armB = holdAngle(hold) + Math.sin(tm * 1.1 + ph) * 1.5;
  rot(k + "1", pose === "sit" || pose === "lie" ? 0 : l, -5, -47);
  rot(k + "2", pose === "sit" || pose === "lie" ? 0 : -l, 5, -47);
  rot(k + "a", armA, -11, -80);
  rot(k + "b", armB, 11, -80);
  a.a(k + "t").setAttribute("transform", "translate(0," + f(-lift) + ") rotate(" + f(lean) + " 0 -46)");
}
