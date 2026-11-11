// Picture suggestions and the Story line model: deterministic, pure, and never touching the words.
import { describe, expect, it } from "vitest";
import { trackSpecs } from "../src/compose/read";
import { parseText } from "../src/parse";
import { SEED_TEXT } from "../src/seed";
import { lineModel } from "../src/maker/lineModel";
import { MIN_GAP, chapterBlocks, countWords, groupByChapter, offsets, strengthOf, suggest } from "../src/maker/suggest";
import type { SceneRef } from "../src/types";

const filler = (n: number) => Array.from({ length: n }, () => "He said nothing and waited for the answer to come.").join(" ");
const vivid = "The kitchen lamp burned at midnight while the rain beat on the window and the fire cracked in the stove.";
const doc = (parts: string[]) => parseText(["# Title page", ...parts].join("\n\n")).blocks;

describe("suggest", () => {
  const blocks = doc(["# One", filler(30), vivid, filler(40), "# Two", filler(40), vivid, filler(10)]);
  const specs = trackSpecs(blocks);

  it("is deterministic", () => {
    expect(suggest(blocks, [], specs)).toEqual(suggest(blocks, [], specs));
  });
  it("picks concrete passages and ignores plain ones", () => {
    const s = suggest(blocks, [], specs);
    expect(s.length).toBeGreaterThan(0);
    s.forEach((x) => { expect(blocks[x.block].text).toContain("lamp"); expect(x.strength).toBeGreaterThan(0); expect(x.strength).toBeLessThan(1); });
  });
  it("skips a passage that has a picture near it", () => {
    const at = blocks.findIndex((b) => b.text === vivid);
    const near: SceneRef = { after: at, scene: "room", caption: "kitchen lamp" };
    expect(suggest(blocks, [near], specs).some((x) => x.block === at)).toBe(false);
    const far: SceneRef = { after: 0, scene: "room", caption: "x" };
    expect(suggest(blocks, [far], specs).some((x) => x.block === at)).toBe(true);
  });
  it("keeps suggestions apart and in reading order", () => {
    const many = doc(["# A", ...Array.from({ length: 12 }, () => vivid)]);
    const s = suggest(many, [], trackSpecs(many));
    const { starts } = offsets(many);
    for (let i = 1; i < s.length; i++) {
      expect(s[i].block).toBeGreaterThan(s[i - 1].block);
      expect(starts[s[i].block] - starts[s[i - 1].block]).toBeGreaterThanOrEqual(MIN_GAP - countWords(vivid));
    }
  });
  it("never suggests headings or short lines", () => {
    const b = doc(["# The kitchen lamp at midnight", "The kitchen lamp."]);
    expect(suggest(b, [], trackSpecs(b))).toEqual([]);
  });
  it("strength rises with the score and stays under 1", () => {
    expect(strengthOf(3)).toBeLessThan(strengthOf(8));
    expect(strengthOf(100)).toBeLessThanOrEqual(1);
  });
  it("finds something in the sample story", () => {
    const b = parseText(SEED_TEXT.join("\n\n")).blocks;
    const s = suggest(b, [], trackSpecs(b));
    expect(s.length).toBeGreaterThan(0);
  });
});

describe("chapters", () => {
  it("uses the highest heading level as the chapter", () => {
    const b = doc(["# One", "text here", "## Part", "more", "# Two", "end"]);
    expect(chapterBlocks(b)).toEqual([0, 4]);
    expect(chapterBlocks(doc(["## Only", "x"]))).toEqual([0]);
    expect(chapterBlocks(doc(["No headings at all here."]))).toEqual([]);
  });
  it("groups items into the chapter they fall in", () => {
    const b = doc(["Prelude words.", "# One", "a", "b", "# Two", "c"]);
    const g = groupByChapter(b, chapterBlocks(b), [0, 2, 3, 5], (n) => n);
    expect(g.map((x) => x.items)).toEqual([[0], [2, 3], [5]]);
  });
});

describe("story line model", () => {
  const blocks = doc(["# One", filler(60), vivid, filler(80), "# Two", filler(10)]);
  const specs = trackSpecs(blocks);
  it("sizes bands by words and covers the whole text", () => {
    const m = lineModel(blocks, [], specs, [], "some", () => "");
    const { total } = offsets(blocks);
    expect(m.total).toBe(total);
    m.bands.forEach((b) => { expect(b.segs.reduce((a, s) => a + s.words, 0)).toBe(total); expect(b.segs[0].start).toBe(0); });
    expect(m.stations.map((s) => s.title)).toEqual(["One", "Two"]);
  });
  it("marks a stretch over 2.5 times the density", () => {
    const m = lineModel(blocks, [], specs, [], "many", () => "");
    expect(m.limit).toBe(600);
    const long = doc(["# One", ...Array.from({ length: 80 }, () => filler(1))]);
    const lm = lineModel(long, [], trackSpecs(long), [], "many", () => "");
    expect(lm.gaps.length).toBe(1);
    expect(lm.gaps[0].words).toBeGreaterThan(600);
    const pic: SceneRef = { after: 40, scene: "room", caption: "x" };
    const split = lineModel(long, [pic], trackSpecs(long), [], "many", () => "");
    expect(split.gaps.every((g) => g.words > 600)).toBe(true);
    expect(split.stops.length).toBe(1);
  });
});
