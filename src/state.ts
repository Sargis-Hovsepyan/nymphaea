import { DEFAULTS } from "./settings";
import { sampleBook } from "./sample";
import type { Book, Settings } from "./types";

/** The one mutable app state. Modules read and write through this object. */
export const state: { book: Book; settings: Settings; images: Record<string, string> } = {
  book: sampleBook(),
  settings: { ...DEFAULTS },
  /** AI pictures by id (SceneRef.img), as data URLs. */
  images: {},
};

const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
let reduce = !!mq && mq.matches;
const motionWatchers: (() => void)[] = [];
// The preference can change while a book is open (a system switch, or a screen reader turning it on).
if (mq && mq.addEventListener) mq.addEventListener("change", (e) => { reduce = e.matches; motionWatchers.forEach((fn) => fn()); });
export function onMotionChange(fn: () => void): void { motionWatchers.push(fn); }

/** Motion is on only if the reader wants it AND the system doesn't ask for reduced motion. */
export function moving(): boolean {
  return state.settings.motion && !reduce;
}

/** Pictures move only when motion is on and the reader has not asked for them still or gone. */
export function pictureMoves(): boolean {
  return moving() && state.settings.pictures === "on";
}
