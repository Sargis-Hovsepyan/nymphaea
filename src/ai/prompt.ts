// Image prompts written by rules, not by a model: the scene spec read from the passage (place, hour,
// sky, things, figures, mood) plus the chosen picture style, so any image model gets a precise,
// consistent brief. The author can edit the prompt per picture before it is sent. Pure.
import { readSpec } from "../compose/read";
import { LABEL, decode, list, type Spec } from "../compose/spec";
import { plain } from "../inline";
import { SCENE_DESC } from "../stage/keywords";
import type { Style } from "../types";

const STYLE_BRIEF: Record<Style, string> = {
  ink: "fine pen-and-ink line drawing, delicate hatching, warm cream paper",
  cut: "cut-paper collage, layered flat shapes with soft drop shadows",
  glow: "silhouettes against warm lamplight, deep chiaroscuro, glowing edges",
  wash: "sumi ink wash, soft bleeding watercolour, generous white space",
  engrave: "copperplate engraving, fine cross-hatching, nineteenth-century book plate",
  stipple: "pen stipple illustration, dense dots, high contrast",
  riso: "two-colour risograph print, grainy texture, slight misregistration",
  flow: "abstract flowing lines, generative art, quiet palette",
  halftone: "high-contrast black and white illustration, strong shapes, newsprint feel",
  dither: "high-contrast black and white illustration, bold simple shapes",
  ascii: "high-contrast black and white illustration, bold simple shapes, strong silhouette",
  glass: "soft frosted glass, blurred light, muted colour",
  orn: "ornamental engraving",
  none: "book illustration",
};

const FRAMING: Record<Spec["shot"], string> = {
  wide: "wide 16:10 establishing shot, small figures in a large setting, calm negative space",
  mid: "16:10 medium shot at eye level, the figures on one third of the frame, the light on the other",
  close: "16:10 close-up still life of the main object, the setting soft and out of focus behind it",
};

function moodWords(s: Spec): string {
  const w: string[] = [];
  if (s.v < -0.3) w.push("melancholy, hushed"); else if (s.v > 0.3) w.push("warm, hopeful"); else w.push("quiet, contemplative");
  if (s.a > 0.65) w.push("restless, full of movement"); else if (s.a < 0.35) w.push("very still");
  return w.join(", ");
}

/** A short excerpt of the passage, so the model sees the moment itself (cut at a word). */
function excerpt(text: string, words = 34): string {
  const w = plain(text).replace(/\s+/g, " ").trim().split(" ");
  return w.length > words ? w.slice(0, words).join(" ") + "…" : w.join(" ");
}

export interface ImageBrief { prompt: string; negative: string }

export const NEGATIVE = "text, letters, words, captions, watermark, signature, logo, frame, border, blurry, deformed hands, extra limbs, duplicate figures";

/**
 * The brief for one picture. A composed scene gives its spec directly; a library scene is described
 * by its own words and the passage supplies the hour and the sky.
 */
export function imageBrief(scene: string, text: string, style: Style, withText = true): ImageBrief {
  const spec = decode(scene) || readSpec(text);
  const lib = decode(scene) ? "" : SCENE_DESC[scene] || "";
  const who = spec.who ? ["", "one figure", "two figures", "a few figures"][spec.who] + (LABEL.pose[spec.pose] ? " " + LABEL.pose[spec.pose] : "") : "";
  const subject = lib
    ? lib + ", " + LABEL.time[spec.time] + (spec.sky !== "clear" ? " " + LABEL.sky[spec.sky] : "")
    : LABEL.place[spec.place] + " " + LABEL.time[spec.time] + (spec.sky !== "clear" ? " " + LABEL.sky[spec.sky] : "") + (spec.season !== "none" ? " " + LABEL.season[spec.season] : "")
      + ((spec.props.length || who) ? ", with " + list([...spec.props.map((p) => LABEL.prop[p]), who]) : "");
  const parts = [
    "Book illustration of " + subject,
    moodWords(spec),
    ...(spec.fx && spec.fx.length ? ["caught in motion: " + list(spec.fx.map((x) => LABEL.fx[x]))] : []),
    STYLE_BRIEF[style] || STYLE_BRIEF.ink,
    FRAMING[spec.shot],
  ];
  if (withText) parts.push("the moment: “" + excerpt(text) + "”");
  return { prompt: parts.join(". ") + ".", negative: NEGATIVE };
}
