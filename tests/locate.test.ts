import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseText } from "../src/parse";
import { locate, normalize, shown, within } from "../src/stage/locate";
import type { Block } from "../src/types";

const P = (text: string): Block => ({ type: "p", text });
const BOOK: Block[] = [
  { type: "h", text: "One", level: 1 },
  P("Mara waited in the kitchen while the kettle began to sing."),
  P("“Don’t go,” she said. The rain had *already* started against the window."),
  P("She took the letter from the table and read it twice."),
  P("Out on the quay the gulls rose all at once."),
];

describe("normalize", () => {
  it("folds quotes, dashes, case, accents, soft hyphens and Markdown marks, keeping a map back", () => {
    const n = normalize("“Café” — *won’t* re­turn");
    expect(n.s).toBe('"cafe" - won\'t return');
    expect(n.map.length).toBe(n.s.length);
    expect("“Café” — *won’t* re­turn"[n.map[n.s.indexOf("won")]]).toBe("w");
  });
  it("bounded edit distance", () => {
    expect(within("kitchen", "kichen", 1)).toBe(true);
    expect(within("kitchen", "chicken", 1)).toBe(false);
  });
});

describe("locate", () => {
  it("finds plain words and gives back the manuscript's own characters", () => {
    const [h] = locate(BOOK, "the kettle began");
    expect(h.startBlock).toBe(1);
    expect(h.exact).toBe("the kettle began");
    expect(h.fuzzy).toBe(false);
  });
  it("matches straight quotes against curly ones, and ignores Markdown stars", () => {
    const [h] = locate(BOOK, '"Don\'t go," she said. The rain had already started');
    expect(h.startBlock).toBe(2);
    expect(h.exact).toContain("Don’t go,” she said");
    expect(h.exact).toContain("*already*");
  });
  it("widens a cut-off selection to whole words", () => {
    const [h] = locate(BOOK, "etter from the tab");
    expect(h.exact).toBe("letter from the table");
  });
  it("crosses paragraphs", () => {
    const [h] = locate(BOOK, "read it twice. Out on the quay");
    expect([h.startBlock, h.endBlock]).toEqual([3, 4]);
    expect(h.exact).toBe("read it twice.\nOut on the quay");
  });
  it("finds a passage with a typo, a missing word and an extra one", () => {
    const [h] = locate(BOOK, "she took the leter from table and read it");
    expect(h.fuzzy).toBe(true);
    expect(h.startBlock).toBe(3);
    expect(h.exact.startsWith("She took the letter from the table")).toBe(true);
    const [g] = locate(BOOK, "Mara waited in the kitchen whilst the kettle began to sing");
    expect(g.startBlock).toBe(1);
  });
  it("gives no hit for unrelated words", () => {
    expect(locate(BOOK, "the horse galloped across the moor at noon")).toEqual([]);
  });
  it("searches only the blocks it is asked to", () => {
    expect(locate(BOOK, "she", { from: 3, to: 3 }).every((h) => h.startBlock === 3)).toBe(true);
  });
  it("shown() drops Markdown for display", () => {
    expect(shown("had *already*\nstarted")).toBe("had already started");
  });
  it("every hit in a real episode is a quote of the text", () => {
    const md = readFileSync(new URL("../episodes/01-the-lesson-i-refused-to-learn.md", import.meta.url), "utf8");
    const blocks = parseText(md).blocks;
    const prose = blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.type === "p" && b.text.split(" ").length > 12).slice(0, 25);
    prose.forEach(({ b, i }) => {
      const words = b.text.replace(/[*_]/g, "").split(/\s+/);
      const q = words.slice(2, 9).join(" ").toLowerCase().replace(/[“”]/g, '"').replace(/’/g, "'");
      const [h] = locate(blocks, q);
      expect(h, q).toBeTruthy();
      expect(blocks[h.startBlock].text.includes(h.exact.split("\n")[0])).toBe(true);
      if (h.startBlock === i) expect(h.fuzzy).toBe(false);
    });
  });
});
