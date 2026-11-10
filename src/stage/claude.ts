// Staging with Claude. The prompt and JSON contract from v0, split into pure functions so the
// same contract can later be sent through the Anthropic API or a local model.
import { DENS } from "../settings";
import type { Book, Density, SceneRef } from "../types";
import { guardBeats, guardScenes } from "./guard";
import { SCENE_DESC, SCENE_LIST, isScene, words } from "./keywords";

export function buildStagingPrompt(book: Book, density: Density): { prompt: string; cut: boolean } {
  const ps: string[] = [], budget = 180000;
  let used = 0, cut = false;
  book.blocks.forEach((b, i) => {
    if (b.type !== "p" || cut) return;
    const t = b.text.length > 420 ? b.text.slice(0, 420) + "…" : b.text;
    used += t.length + 8;
    if (used > budget) { cut = true; return; }
    ps.push("[" + i + "] " + t);
  });
  const w = book.blocks.reduce((a, b) => a + words(b.text).length, 0);
  const k = Math.max(2, Math.round(w / (DENS[density] || 450)));
  const prompt = "You are staging a piece of writing for an illustrated reading page. The paragraphs are numbered below.\n"
    + "Choose where small animated illustrations go and which scene each one shows. Available scenes (use these ids only):\n"
    + SCENE_LIST.map((s) => "- " + s + ": " + SCENE_DESC[s]).join("\n")
    + "\n\nRules:\n- Place about " + k + " illustrations, spread through the text, each right after the paragraph it belongs to (\"after\" is that paragraph's number).\n"
    + "- Pick the scene that best fits the moment; avoid the same scene twice in a row unless the story clearly returns to it.\n"
    + "- \"caption\" is 2 to 7 words quoted exactly from that paragraph.\n"
    + "- \"beats\" lists the numbers of short paragraphs that are dramatic one-line beats and should stand alone on the page.\n"
    + "- \"cover\" is the scene id that best represents the whole piece.\n"
    + "Reply with only JSON like {\"cover\":\"lamp\",\"scenes\":[{\"after\":12,\"scene\":\"knight\",\"caption\":\"I captured his knight\"}],\"beats\":[38,64]}\n\n"
    + "Title: " + book.title + "\n\nParagraphs:\n" + ps.join("\n");
  return { prompt, cut };
}

export interface StagingReply {
  scenes: SceneRef[];
  beats: number[];
  cover?: string;
  rejected: number;
  recaptioned: number;
}

/** Turn any model reply into a plan the Guard has approved. */
export function readStagingReply(book: Book, res: unknown): StagingReply {
  const r = (res && typeof res === "object" ? res : {}) as { scenes?: unknown; beats?: unknown; cover?: unknown };
  const g = guardScenes(book.blocks, Array.isArray(r.scenes) ? r.scenes : []);
  return {
    scenes: g.scenes,
    beats: guardBeats(book.blocks, r.beats),
    cover: isScene(r.cover) ? r.cover : undefined,
    rejected: g.rejected,
    recaptioned: g.recaptioned,
  };
}
