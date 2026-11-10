import { DEFAULTS } from "./settings";
import { sampleBook } from "./sample";
import type { Book, Settings } from "./types";

/** The one mutable app state. Modules read and write through this object. */
export const state: { book: Book; settings: Settings } = {
  book: sampleBook(),
  settings: { ...DEFAULTS },
};

const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Motion is on only if the reader wants it AND the system doesn't ask for reduced motion. */
export function moving(): boolean {
  return state.settings.motion && !reduce;
}
