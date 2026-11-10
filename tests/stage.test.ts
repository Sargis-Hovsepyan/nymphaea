import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseText } from "../src/parse";
import { SEED_SCENES, sampleBook } from "../src/sample";
import { autoStage } from "../src/stage/auto";
import { buildStagingPrompt, readStagingReply } from "../src/stage/claude";
import { captionIsQuoted, guardScenes, sameBlocks } from "../src/stage/guard";
import type { Density } from "../src/types";

const EPISODE = readFileSync(new URL("../episodes/01-the-lesson-i-refused-to-learn.md", import.meta.url), "utf8");
const DENSITIES: Density[] = ["few", "some", "many"];

describe("autoStage", () => {
  const { blocks } = parseText(EPISODE);

  it("is deterministic", () => {
    DENSITIES.forEach((d) => expect(autoStage(blocks, d)).toEqual(autoStage(blocks, d)));
  });

  it("places more pictures at higher density, in reading order", () => {
    const n = DENSITIES.map((d) => autoStage(blocks, d).length);
    expect(n[0]).toBeLessThanOrEqual(n[1]);
    expect(n[1]).toBeLessThanOrEqual(n[2]);
    DENSITIES.forEach((d) => {
      const afters = autoStage(blocks, d).map((s) => s.after);
      expect(afters).toEqual([...afters].sort((a, b) => a - b));
    });
  });

  it("every caption is an exact quote from the text", () => {
    DENSITIES.forEach((d) => autoStage(blocks, d).forEach((s) => {
      expect(captionIsQuoted(s.caption, blocks, s.after), JSON.stringify(s)).toBe(true);
    }));
  });

  it("never changes the blocks it reads", () => {
    const copy = blocks.map((b) => ({ ...b }));
    DENSITIES.forEach((d) => autoStage(blocks, d));
    expect(sameBlocks(blocks, copy)).toBe(true);
  });
});

describe("Guard", () => {
  const book = sampleBook();

  it("accepts the hand-placed sample scenes unchanged", () => {
    const g = guardScenes(book.blocks, SEED_SCENES);
    expect(g).toEqual({ scenes: SEED_SCENES, rejected: 0, recaptioned: 0 });
  });

  it("replaces an invented caption with a quoted one", () => {
    const g = guardScenes(book.blocks, [{ after: 12, scene: "knight", caption: "His knight leaves the board" }]);
    expect(g.recaptioned).toBe(1);
    expect(captionIsQuoted(g.scenes[0].caption, book.blocks, 12)).toBe(true);
    expect(g.scenes[0].caption).not.toBe("His knight leaves the board");
  });

  it("is case-sensitive: a quote must match the author's exact letters", () => {
    expect(captionIsQuoted("One small, humble square", book.blocks, 69)).toBe(false);
    expect(captionIsQuoted("one small, humble square", book.blocks, 69)).toBe(true);
  });

  it("drops scenes with bad indexes, headings or unknown scene ids", () => {
    const blocks = [{ type: "h" as const, text: "Chapter" }, { type: "p" as const, text: "The lamp glowed." }];
    const g = guardScenes(blocks, [
      { after: 0, scene: "lamp", caption: "" },
      { after: 9, scene: "lamp", caption: "" },
      { after: 1, scene: "dragon", caption: "" },
      { after: 1.5, scene: "lamp", caption: "" },
      null,
      { after: 1, scene: "lamp", caption: "The lamp glowed" },
    ]);
    expect(g.rejected).toBe(5);
    expect(g.scenes).toEqual([{ after: 1, scene: "lamp", caption: "The lamp glowed" }]);
  });

  it("accepts the shortened “…” captions autoStage makes", () => {
    const blocks = [{ type: "p" as const, text: "He looked down at the abandoned board and then away." }];
    expect(captionIsQuoted("He looked down at the abandoned…", blocks, 0)).toBe(true);
  });
});

describe("Claude staging contract", () => {
  const book = sampleBook();

  it("numbers paragraphs and lists every scene id in the prompt", () => {
    const { prompt, cut } = buildStagingPrompt(book, "some");
    expect(cut).toBe(false);
    expect(prompt).toContain("[0] " + book.blocks[0].text);
    expect(prompt).toContain("- lotus:");
  });

  it("turns any reply into a guarded plan", () => {
    const r = readStagingReply(book, {
      cover: "lamp",
      scenes: [
        { after: 34, scene: "queen", caption: "My queen sliced across the board" },
        { after: 50, scene: "king", caption: "words nobody wrote" },
        { after: 3, scene: "nope", caption: "x" },
      ],
      beats: [38, "64", -1, 999],
    });
    expect(r.cover).toBe("lamp");
    expect(r.rejected).toBe(1);
    expect(r.recaptioned).toBe(1);
    expect(r.beats).toEqual([38, 64]);
    r.scenes.forEach((s) => expect(captionIsQuoted(s.caption, book.blocks, s.after)).toBe(true));
  });

  it("survives a garbage reply", () => {
    expect(readStagingReply(book, "not json").scenes).toEqual([]);
    expect(readStagingReply(book, null).beats).toEqual([]);
  });
});
