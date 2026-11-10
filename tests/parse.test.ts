// The one rule: every import path round-trips every paragraph, unchanged and in order.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blocksToText, parseText } from "../src/parse";
import { SEED_TEXT } from "../src/seed";

const EPISODE = readFileSync(new URL("../episodes/01-the-lesson-i-refused-to-learn.md", import.meta.url), "utf8");

/** What a reader of the source file sees as paragraphs (whitespace inside a paragraph normalised). */
function sourceParagraphs(md: string): string[] {
  return md.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
}

describe("parseText round-trip", () => {
  it("keeps every paragraph of episode 01, in order, word for word", () => {
    const { title, blocks } = parseText(EPISODE);
    const src = sourceParagraphs(EPISODE);
    // The opening "# Heading" becomes the book's title (shown on the cover), so it is kept, not lost.
    expect(title).toBe("The Lesson I Refused to Learn");
    expect(["# " + title, ...blocks.map((b) => (b.type === "h" ? "# " + b.text : b.text))]).toEqual(src);
  });

  it("the built-in sample is exactly episode 01", () => {
    const body = sourceParagraphs(EPISODE).slice(1); // drop the "# Title" line
    expect([...SEED_TEXT]).toEqual(body);
  });

  it("blocksToText → parseText is lossless", () => {
    const first = parseText(EPISODE);
    const again = parseText(blocksToText(first.blocks), first.title);
    expect(again.blocks).toEqual(first.blocks);
  });

  it("handles CRLF, non-breaking spaces and hard-wrapped lines without losing words", () => {
    const raw = "Chapter One\r\n\r\nThe first line\r\nwraps here.\r\n\r\nA second   paragraph.\r\n\r\nNo.";
    const { blocks } = parseText(raw, "T");
    expect(blocks).toEqual([
      { type: "h", text: "Chapter One", level: 1 },
      { type: "p", text: "The first line wraps here." },
      { type: "p", text: "A second paragraph." },
      { type: "p", text: "No." },
    ]);
  });

  it("takes a short unpunctuated first line as the title", () => {
    const { title, blocks } = parseText("My Story\n\nIt began.\n\nIt ended.");
    expect(title).toBe("My Story");
    expect(blocks.map((b) => b.text)).toEqual(["It began.", "It ended."]);
  });
});
