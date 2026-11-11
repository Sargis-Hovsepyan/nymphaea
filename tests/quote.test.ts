// Pictures drawn from chosen words: read in layers (the words, their paragraph, the chapter), kept
// as an exact quote of the manuscript by the Guard, and found again after the author mends a word.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readQuoteAt, readSpec, trackSpecs } from "../src/compose/read";
import { layout } from "../src/compose/layout";
import { decode } from "../src/compose/spec";
import { parseText } from "../src/parse";
import { autoStage, captionOf, momentOf, sentences } from "../src/stage/auto";
import { captionIsQuoted, guardScenes, quoteFor } from "../src/stage/guard";
import { movePicture } from "../src/maker/pictureMove";

const md = [
  "# The Book",
  "# One",
  "Mara and Mara's brother lived above the harbour. Mara was the elder.",
  "The kitchen was warm at dusk. She remembered the summer at the sea, the waves and the gulls, and then she set the cup on the table.",
  "Outside the rain had started. She sat by the window with the letter.",
].join("\n\n");
const blocks = parseText(md).blocks;

describe("reading chosen words", () => {
  it("the words decide what is in the picture, the paragraph does not", () => {
    const whole = trackSpecs(blocks)[2]!;
    const r = readQuoteAt(blocks, 2, "she set the cup on the table")!;
    expect(r.spec.props.slice(0, 2).sort()).toEqual(["cup", "table"]);
    expect(r.spec.props).not.toContain("bird");
    expect(r.from.props).toBe("words");
    // The paragraph still sets the place (the kitchen) and the hour (dusk).
    expect(r.spec.place).toBe("kitchen");
    expect(r.spec.time).toBe("dusk");
    expect(r.from.place).toBe("paragraph");
    expect(whole).toBeTruthy();
  });
  it("the words override the paragraph's setting when they name their own", () => {
    const r = readQuoteAt(blocks, 2, "the summer at the sea, the waves and the gulls")!;
    expect(r.spec.place).toBe("sea");
    expect(r.from.place).toBe("words");
    expect(r.spec.season).toBe("summer");
  });
  it("a pronoun takes the last name before it, so the cast keeps its silhouette", () => {
    const named = readQuoteAt(blocks, 1, "Mara was the elder")!;
    const r = readQuoteAt(blocks, 3, "She sat by the window with the letter")!;
    expect(r.spec.who).toBe(1);
    expect(r.spec.pose).toBe("sit");
    expect(r.spec.cast[0]).toBe(named.spec.cast[0]);
  });
  it("a short quote of someone setting down a small thing is seen nearer, with the act", () => {
    const r = readQuoteAt(blocks, 2, "she set the cup on the table")!;
    expect(r.spec.shot).toBe("mid");
    expect(r.spec.acts?.map((a) => a.kind)).toEqual(["put"]);
  });
  it("words not near the paragraph give nothing", () => {
    expect(readQuoteAt(blocks, 3, "lived above the harbour")).not.toBeNull();
    expect(readQuoteAt(blocks, 3, "a horse in the snow")).toBeNull();
  });
});

describe("the Guard keeps quotes exact", () => {
  const q = "She sat by the window with the letter.";
  it("keeps an exact quote and takes the manuscript's characters", () => {
    const g = guardScenes(blocks, [{ after: 3, scene: "lamp", caption: "the rain had started", quote: "she sat by the window with the letter." }]);
    expect(g.scenes[0].quote).toBe(q);
    expect(g.unquoted).toBe(0);
  });
  it("finds the words again after a word in them is mended", () => {
    const edited = blocks.map((b, i) => (i === 3 ? { ...b, text: b.text.replace("window", "windows") } : b));
    expect(quoteFor(q, edited, 3)).toBe("She sat by the windows with the letter.");
  });
  it("drops a quote whose words are gone, or that was never in the text", () => {
    const edited = blocks.map((b, i) => (i === 3 ? { ...b, text: "Nothing else happened." } : b));
    const g = guardScenes(edited, [{ after: 3, scene: "lamp", caption: "Nothing else happened", quote: q }]);
    expect(g.scenes[0].quote).toBeUndefined();
    expect(g.unquoted).toBe(1);
    expect(guardScenes(blocks, [{ after: 3, scene: "lamp", caption: "the rain had started", quote: "A dragon flew over the castle at noon." }]).scenes[0].quote).toBeUndefined();
  });
  it("keeps the quote when the picture moves within reach of it", () => {
    const scenes = guardScenes(blocks, [{ after: 2, scene: "lamp", caption: "The kitchen was warm at dusk", quote: "The kitchen was warm at dusk." }]).scenes;
    const m = movePicture(blocks, scenes, 0, 1)!;
    expect(m.scenes[m.index].after).toBe(3);
    expect(m.scenes[m.index].quote).toBe("The kitchen was warm at dusk.");
  });
});

describe("moments and captions", () => {
  it("splits sentences as written", () => {
    expect(sentences("One here. Two “there!” Three")).toEqual(["One here.", "Two “there!”", "Three"]);
  });
  it("picks the most concrete moment of a paragraph", () => {
    expect(momentOf(blocks[2].text)).toContain("the cup on the table");
    expect(momentOf("Only one sentence here.")).toBeNull();
  });
  it("a caption from a quote is inside the quote and quotes the text", () => {
    const c = captionOf("She remembered the summer at the sea, the waves and the gulls, and then she set the cup on the table.", "lamp");
    expect(captionIsQuoted(c, blocks, 2)).toBe(true);
    expect(captionOf("She sat down.", "lamp")).toBe("She sat down.");
  });
  it("automatic composed pictures carry their moment, and it is an exact quote", () => {
    const ep = parseText(readFileSync(new URL("../episodes/01-the-lesson-i-refused-to-learn.md", import.meta.url), "utf8")).blocks;
    const scenes = autoStage(ep, "many", "composed");
    const withQ = scenes.filter((s) => s.quote);
    expect(withQ.length).toBeGreaterThan(0);
    const g = guardScenes(ep, scenes);
    expect(g.unquoted).toBe(0);
    g.scenes.forEach((s) => { expect(captionIsQuoted(s.caption, ep, s.after)).toBe(true); expect(decode(s.scene) || s.scene).toBeTruthy(); });
  });
});

describe("the drawing follows the words", () => {
  const items = (t: string) => layout(readSpec(t)).items;
  it("a figure holds the umbrella it is said to hold", () => {
    const f = items("She held the umbrella over her head in the street.").find((x) => x.kind === "fig")!;
    expect(f.hold).toBe("umbrella");
    expect(items("She held the umbrella over her head in the street.").some((x) => x.kind === "umbrella")).toBe(false);
  });
  it("someone on a lake with a boat sits in the boat", () => {
    const its = items("He rowed the boat across the lake at dusk.");
    const boat = its.find((x) => x.kind === "boat")!, f = its.find((x) => x.kind === "fig")!;
    expect(f.on).toBe("boat");
    expect(Math.abs(f.x - boat.x)).toBeLessThan(boat.w);
  });
  it("people on a bridge stand on its deck", () => {
    const its = items("They kissed on the bridge over the river at dawn.");
    const br = its.find((x) => x.kind === "bridge")!;
    its.filter((x) => x.kind === "fig").forEach((f) => { expect(f.on).toBe("bridge"); expect(f.y).toBeLessThan(br.y); });
  });
  it("people said to sit on a bench sit on it, seen nearer", () => {
    const sp = readSpec("We sat on the bench in the garden and watched the birds.");
    expect(sp.shot).toBe("mid");
    layout(sp).items.filter((x) => x.kind === "fig").forEach((f) => expect(f.on).toBe("bench"));
  });
  it("neighbouring automatic pictures never repeat the same view", () => {
    const ep = parseText(readFileSync(new URL("../episodes/01-the-lesson-i-refused-to-learn.md", import.meta.url), "utf8")).blocks;
    const sc = autoStage(ep, "many", "composed").map((x) => decode(x.scene)).filter((x): x is NonNullable<typeof x> => !!x);
    for (let i = 1; i < sc.length; i++) {
      const a = sc[i - 1], b = sc[i];
      expect(a.place === b.place && a.time === b.time && a.shot === b.shot && a.seed === b.seed).toBe(false);
    }
  });
});
