// Re-read the Markdown into a book. Pictures follow their paragraphs; an automatic plan is redone.
import { autoStage } from "../stage/auto";
import { guardScenes } from "../stage/guard";
import { remapBeats, remapScenes } from "../stage/remap";
import { state } from "../state";
import { parseDraft } from "../parse";
import type { Book } from "../types";
import { book, hooks, plural, sceneNote, sess, withMeta } from "./session";

export function rebuildText(restage: boolean, opts: { samePositions?: (caption: string) => string } = {}): void {
  const old = book(), parsed = parseDraft(sess.md, sess.userTitle);
  const next: Book = withMeta({ title: parsed.title, blocks: parsed.blocks, scenes: [], source: restage ? "auto" : old.source, cover: old.cover });
  let lost = 0;
  if (next.source === "auto") next.scenes = autoStage(next.blocks, state.settings.density, state.settings.art);
  else if (opts.samePositions && old.blocks.length === next.blocks.length) {
    // A typography fix changes characters in place, not the order: pictures keep their places.
    next.scenes = guardScenes(next.blocks, old.scenes.map((s) => ({ ...s, caption: opts.samePositions!(s.caption) }))).scenes;
    next.beats = old.beats;
  } else {
    const r = remapScenes(old.blocks, next.blocks, old.scenes);
    next.scenes = r.scenes; lost = r.lost;
    next.beats = remapBeats(old.blocks, next.blocks, old.beats);
  }
  state.book = next;
  hooks.refresh();
  if (lost) sceneNote(plural(lost, "picture") + " came out because " + (lost === 1 ? "its paragraph" : "their paragraphs") + " changed.", true);
}
