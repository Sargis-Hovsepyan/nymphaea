// Staging with an AI (Claude on claude.ai, a local model, or any API the author connects). The prompt
// and JSON contract are pure functions, so every model gets the same brief and every reply goes
// through the Guard. A model may pick a drawn library scene or describe a composed one.
import { encode, fromLoose, FX, PLACES, POSES, PROPS, SEASONS, SHOTS, SKIES, TIMES } from "../compose/spec";
import { FIG_KINDS, PAIR_KINDS, SKY_KINDS, THING_KINDS } from "../compose/acts";
import { hash } from "./mood";
import { DENS } from "../settings";
import type { Art, Book, Density, SceneRef } from "../types";
import { guardBeats, guardScenes } from "./guard";
import { SCENE_DESC, SCENE_LIST, isScene, words } from "./keywords";

// How the author's "pictures from" choice steers the model between drawn scenes and composed ones.
const ART_RULE: Record<Art, string> = {
  library: "- Use the listed scene ids; compose a scene only when none of them fits at all.\n",
  mixed: "- Prefer composing a scene, with its acts, whenever the passage names a place or something happening, so the picture acts out this very moment. Use a listed scene id only when it fits the passage clearly.\n",
  composed: "- Compose every picture, with its acts.\n",
};

// The closed vocabulary a composed scene and its acts are written in, shared by both prompts.
const COMPOSE_RULES = "A composed scene is \"compose\": {\"place\", \"time\", \"weather\", \"season\", \"props\", \"figures\", \"pose\", \"shot\", \"motion\", \"acts\"} using only these words:"
  + " place " + PLACES.join("|") + "; time " + TIMES.join("|") + "; weather " + SKIES.join("|") + "; season " + SEASONS.join("|") + "; props (up to 4, the first is the focus of a close shot) " + PROPS.join("|") + "; figures 0-3; pose " + POSES.join("|") + "; shot " + SHOTS.join("|") + "; motion (up to 3, only what the passage says moves) " + FX.join("|") + "."
  + " \"acts\" says what happens, in order (up to 6, only what the words say happens now): each {\"who\", \"do\", \"to\", \"how\", \"with\", \"away\"}."
  + " who: a figure number (0, 1, 2), \"all\", \"pair\" (figures 0 and 1 together), a prop from the scene's props, or \"sky\"."
  + " do for a figure: " + FIG_KINDS.join("|") + "; for the pair: " + PAIR_KINDS.join("|") + "; for a prop: " + THING_KINDS.join("|") + "; for the sky: " + SKY_KINDS.join("|") + "."
  + " to (optional): a figure number, a prop from the scene's props, \"up\", \"down\", \"off\". how: \"slow\" or \"sudden\". with: true when it starts together with the act before. away: true for away from \"to\", or for weather that stops.";

/**
 * One picture, drawn again by a model that reads its paragraph in context: the chapter it is in, the
 * paragraphs before (the setting carries over) and the one after. The reply is one composed scene.
 */
export function buildRedrawPrompt(book: Book, s: SceneRef): string {
  const at = s.after;
  let head = "";
  for (let i = at; i >= 0; i--) { const b = book.blocks[i]; if (b && b.type === "h") { head = b.text; break; } }
  const near = (from: number, to: number) => book.blocks.slice(Math.max(0, from), to).filter((b) => b.type === "p").map((b) => b.text.slice(0, 600)).join("\n");
  return "You are drawing one small animated illustration for a passage of a book. Read the context so the place, hour, weather and people carry over, but show what happens in the passage itself.\n"
    + COMPOSE_RULES + "\n"
    + "- \"caption\" is 2 to 7 words quoted exactly from the passage.\n"
    + "Reply with only JSON like {\"compose\":{\"place\":\"sea\",\"time\":\"dusk\",\"weather\":\"wind\",\"props\":[\"boat\"],\"figures\":1,\"pose\":\"look\",\"shot\":\"wide\",\"acts\":[{\"who\":\"sky\",\"do\":\"wind\"},{\"who\":0,\"do\":\"look\",\"to\":\"boat\",\"with\":true}]},\"caption\":\"the boat leaned into the wind\"}\n\n"
    + "Book: " + book.title + (head ? "\nChapter: " + head : "")
    + "\n\nBefore:\n" + (near(at - 3, at) || "(the start)")
    + "\n\nThe passage:\n" + (s.quote || book.blocks[at]?.text || "")
    + "\n\nAfter:\n" + (near(at + 1, at + 2) || "(the end)");
}

/** `budget` caps the characters of text sent, for models with a small request limit. */
export function buildStagingPrompt(book: Book, density: Density, art: Art = "mixed", budget = 180000): { prompt: string; cut: boolean } {
  const ps: string[] = [];
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
  const lib = art !== "composed"; // "Read from the text" hides the drawn library, or models reach for it anyway
  const example = (lib ? "{\"after\":12,\"scene\":\"knight\",\"caption\":\"I captured his knight\"}," : "")
    + "{\"after\":30,\"compose\":{\"place\":\"sea\",\"time\":\"dusk\",\"weather\":\"wind\",\"props\":[\"boat\",\"bird\"],\"figures\":1,\"pose\":\"look\",\"shot\":\"wide\","
    + "\"acts\":[{\"who\":\"sky\",\"do\":\"wind\"},{\"who\":0,\"do\":\"look\",\"to\":\"boat\",\"with\":true}]},\"caption\":\"the boat leaned into the wind\"}";
  const prompt = "You are staging a piece of writing for an illustrated reading page. The paragraphs are numbered below.\n"
    + (lib ? "Choose where small animated illustrations go and which scene each one shows. Available scenes (use these ids only):\n"
      + SCENE_LIST.map((s) => "- " + s + ": " + SCENE_DESC[s]).join("\n") : "Choose where small animated illustrations go and compose what each one shows.")
    + "\n\nRules:\n- Place about " + k + " illustrations, spread through the text, each right after the paragraph it belongs to (\"after\" is that paragraph's number).\n"
    + "- Pick the scene that best fits the moment; avoid the same scene twice in a row unless the story clearly returns to it.\n"
    + ART_RULE[art]
    + "- When no listed scene fits, compose one instead of \"scene\". " + COMPOSE_RULES + " Vary the shot when two pictures in a row share a place.\n"
    + "- \"caption\" is 2 to 7 words quoted exactly from that paragraph.\n"
    + "- \"quote\" (optional) is the one or two sentences, quoted exactly from that paragraph or the one before, that the picture shows. Pick the moment, not the whole paragraph.\n"
    + "- \"beats\" lists the numbers of short paragraphs that are dramatic one-line beats and should stand alone on the page.\n"
    + "- \"cover\" is the scene id that best represents the whole piece.\n"
    + "Reply with only JSON like {" + (lib ? "\"cover\":\"lamp\"," : "") + "\"scenes\":[" + example + "],\"beats\":[38,64]}\n\n"
    + "Title: " + book.title + "\n\nParagraphs:\n" + ps.join("\n");
  return { prompt, cut };
}

export interface StagingReply {
  scenes: SceneRef[];
  beats: number[];
  cover?: string;
  rejected: number;
  recaptioned: number;
  /** Quotes that were not in the text, so those pictures show their whole paragraph. */
  unquoted: number;
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
    unquoted: g.unquoted,
  };
}
