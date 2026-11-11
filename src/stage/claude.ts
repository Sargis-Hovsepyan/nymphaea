// Staging with an AI (Claude on claude.ai, a local model, or any API the author connects). The prompt
// and JSON contract are pure functions, so every model gets the same brief and every reply goes
// through the Guard. A model may pick a drawn library scene or describe a composed one.
import { encode, fromLoose, PLACES, POSES, PROPS, SEASONS, SHOTS, SKIES, TIMES } from "../compose/spec";
import { hash } from "./mood";
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
    + "- When no listed scene fits, compose one instead of \"scene\": give \"compose\": {\"place\", \"time\", \"weather\", \"season\", \"props\", \"figures\", \"pose\", \"shot\"} using only these words:"
    + " place " + PLACES.join("|") + "; time " + TIMES.join("|") + "; weather " + SKIES.join("|") + "; season " + SEASONS.join("|") + "; props (up to 4, the first is the focus of a close shot) " + PROPS.join("|") + "; figures 0-3; pose " + POSES.join("|") + "; shot " + SHOTS.join("|") + ". Vary the shot when two pictures in a row share a place.\n"
    + "- \"caption\" is 2 to 7 words quoted exactly from that paragraph.\n"
    + "- \"beats\" lists the numbers of short paragraphs that are dramatic one-line beats and should stand alone on the page.\n"
    + "- \"cover\" is the scene id that best represents the whole piece.\n"
    + "Reply with only JSON like {\"cover\":\"lamp\",\"scenes\":[{\"after\":12,\"scene\":\"knight\",\"caption\":\"I captured his knight\"},{\"after\":30,\"compose\":{\"place\":\"sea\",\"time\":\"dusk\",\"weather\":\"wind\",\"props\":[\"boat\",\"bird\"],\"figures\":1,\"pose\":\"look\",\"shot\":\"wide\"},\"caption\":\"the boat leaned into the wind\"}],\"beats\":[38,64]}\n\n"
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
  // A composed scene arrives as loose data: turn it into an id (seeded from its paragraph).
  const raw = (Array.isArray(r.scenes) ? r.scenes : []).map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (o.compose && typeof o.compose === "object") {
      const spec = fromLoose(o.compose, hash(String(o.after) + ":" + String(o.caption || "")));
      if (spec) return { ...o, scene: encode(spec) };
    }
    return o;
  });
  const g = guardScenes(book.blocks, raw);
  return {
    scenes: g.scenes,
    beats: guardBeats(book.blocks, r.beats),
    cover: isScene(r.cover) ? r.cover : undefined,
    rejected: g.rejected,
    recaptioned: g.recaptioned,
  };
}
