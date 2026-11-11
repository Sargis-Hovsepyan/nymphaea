// Which stored paintings are no longer used by anything: not the current draft, not a shelved book,
// not a step the undo stack could bring back. Pure, so it can be tested without a browser.
import type { SceneRef } from "../types";

/** Ids younger than this are never removed: a painting is stored a moment before a scene takes it. */
export const GRACE_MS = 2 * 60_000;

/** The time an image id was made (see newImageId in ai/store.ts), or 0 if it does not say. */
export function imageAge(id: string): number {
  const m = /^i([0-9a-z]{8})[0-9a-z]*$/.exec(id);
  const t = m ? parseInt(m[1], 36) : 0;
  return t > 1e12 && t < 1e14 ? t : 0;
}

export function referenced(...lists: (SceneRef[] | undefined)[]): Set<string> {
  const out = new Set<string>();
  lists.forEach((l) => (l || []).forEach((s) => { if (s && s.img) out.add(s.img); }));
  return out;
}

/** Stored ids to delete. */
export function unreferenced(stored: string[], keep: Set<string>, now = Date.now(), grace = GRACE_MS): string[] {
  // An id that does not say when it was made is left alone: it may not be ours.
  return stored.filter((id) => { const t = imageAge(id); return !keep.has(id) && t > 0 && now - t > grace; });
}
