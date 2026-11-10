// The staging algorithms: stemming, TF-IDF, TextTiling segmentation, placement by dynamic
// programming, beats and mood. Deterministic, and every caption still a quote.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseText } from "../src/parse";
import { autoStage } from "../src/stage/auto";
import { autoBeats } from "../src/stage/beats";
import { captionIsQuoted } from "../src/stage/guard";
import { scoreOf } from "../src/stage/keywords";
import { hash, moodOf } from "../src/stage/mood";
import { placeK, type Cand } from "../src/stage/place";
import { segment } from "../src/stage/segment";
import { docModel, idf, stem } from "../src/stage/stem";
import type { Block } from "../src/types";

const EPISODE = readFileSync(new URL("../episodes/01-the-lesson-i-refused-to-learn.md", import.meta.url), "utf8");
const P = (text: string): Block => ({ type: "p", text });

describe("stems and weights", () => {
  it("inflections meet at one stem", () => {
    expect(new Set(["walk", "walked", "walking", "walks"].map(stem)).size).toBe(1);
    expect(new Set(["candle", "candles"].map(stem)).size).toBe(1);
    expect(stem("glass")).toBe(stem("glass"));
  });
  it("stop words don't match scenes ('not' is not 'note')", () => {
    expect(scoreOf("It was not the time.")).toEqual({ clock: 1 });
    expect(scoreOf("She wrote me a note.")).toEqual({ letter: 2 });
  });
  it("a word on every page weighs less than a rare one", () => {
    const m = docModel(["the lamp glowed", "the lamp hummed", "the lamp again", "a single train"]);
    expect(idf(m, stem("train"))).toBeGreaterThan(idf(m, stem("lamp")));
  });
});

describe("segmentation (TextTiling)", () => {
  const sea = Array.from({ length: 10 }, (_, i) => P("The sea rolled grey under the boat, waves breaking on the shore while the tide pulled at the hull and the gulls called over the water " + i + "."));
  const city = Array.from({ length: 10 }, (_, i) => P("The city streets were loud with traffic, buildings stacked against the sky, towers lit window by window as architects argued over blueprints " + i + "."));
  it("finds the change of scene between two very different passages", () => {
    const s = segment([...sea, ...city]);
    expect([...s.after].some((i) => Math.abs(i - 9) <= 1)).toBe(true);
  });
  it("a heading or a scene break is always a boundary", () => {
    const s = segment([P("One."), P("Two."), P("* * *"), P("Three."), { type: "h", text: "Next", level: 1 }, P("Four.")]);
    expect(s.after.has(1)).toBe(true);
    expect(s.after.has(3)).toBe(true);
  });
});

describe("placement (dynamic programming)", () => {
  const cands: Cand[] = Array.from({ length: 40 }, (_, i) => ({ i, cw: (i + 1) * 50, sal: i === 13 || i === 27 ? 1 : 0.1 }));
  it("is deterministic, ordered, spaced, and takes the vivid paragraphs", () => {
    const a = placeK(cands, 2000, 3);
    expect(a).toEqual(placeK(cands, 2000, 3));
    expect(a.length).toBe(3);
    expect(a).toEqual([...a].sort((x, y) => x - y));
    for (let k = 1; k < a.length; k++) expect(a[k] - a[k - 1]).toBeGreaterThanOrEqual(2);
    expect(a).toContain(13); expect(a).toContain(27);
  });
  it("asks for fewer pictures when there are too few paragraphs", () => {
    expect(placeK(cands.slice(0, 3), 150, 5).length).toBeLessThanOrEqual(2);
    expect(placeK([], 0, 3)).toEqual([]);
  });
  it("the whole plan on episode 01: one per N words, captions quoted, never the same scene twice running", () => {
    const { blocks } = parseText(EPISODE);
    (["few", "some", "many"] as const).forEach((d) => {
      const plan = autoStage(blocks, d);
      plan.forEach((s, k) => {
        expect(captionIsQuoted(s.caption, blocks, s.after)).toBe(true);
        if (k) expect(s.scene).not.toBe(plan[k - 1].scene);
      });
    });
  });
});

describe("beats and mood", () => {
  it("very short lines are beats; so is a short line among long ones", () => {
    const long = "word ".repeat(60).trim() + ".";
    const b = autoBeats([P(long), P(long), P("No."), P(long), P("He stood, and that was all."), P(long), P(long)]);
    expect(b.has(2)).toBe(true);
    expect(b.has(4)).toBe(true);
    expect(b.has(0)).toBe(false);
  });
  it("mood reads dark and bright, still and stirring", () => {
    expect(moodOf("dark cold fear, alone in the night").v).toBeLessThan(0);
    expect(moodOf("warm light and laughter, a gentle morning").v).toBeGreaterThan(0);
    expect(moodOf("they ran and shouted, a sudden crash").a).toBeGreaterThan(0.5);
    expect(hash("a")).toBe(hash("a")); expect(hash("a")).not.toBe(hash("b"));
  });
});
