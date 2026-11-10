// The Studio's guarantees: inline Markdown never changes the stored words, pictures follow their
// paragraphs through edits, episodes join losslessly, and an exported book can't be broken by its text.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBookHtml, scriptJson, type Pristine } from "../src/export";
import { joinEpisodes, prettyName } from "../src/import/files";
import { isBreak, plain, spans } from "../src/inline";
import { parseDraft, parseText } from "../src/parse";
import { sampleBook } from "../src/sample";
import { DEFAULTS } from "../src/settings";
import { captionIsQuoted } from "../src/stage/guard";
import { remapBeats, remapScenes } from "../src/stage/remap";
import type { Book } from "../src/types";

const EPISODE = readFileSync(new URL("../episodes/01-the-lesson-i-refused-to-learn.md", import.meta.url), "utf8");

describe("inline Markdown", () => {
  it("reads *em*, _em_ and **strong** without touching the text", () => {
    expect(spans("He said *no* and **meant** it.")).toEqual([
      { t: "He said " }, { t: "no", em: true }, { t: " and " }, { t: "meant", strong: true }, { t: " it." },
    ]);
    expect(plain("_quietly_, then **very** *quietly*")).toBe("quietly, then very quietly");
  });
  it("leaves lone stars, snake_case and maths alone", () => {
    ["5 * 3 = 15", "a snake_case_name", "* not a list", "a * b"].forEach((t) => expect(plain(t)).toBe(t));
  });
  it("keeps every character of episode 01 (it has no markup)", () => {
    parseText(EPISODE).blocks.forEach((b) => expect(plain(b.text)).toBe(b.text));
  });
  it("knows a scene break", () => {
    ["* * *", "***", "---", "⁂", "#", "~ ~ ~"].forEach((t) => expect(isBreak(t)).toBe(true));
    ["No.", "Check.", "—", "e4", "--"].forEach((t) => expect(isBreak(t)).toBe(false));
  });
});

describe("pictures follow their paragraphs through edits", () => {
  const book = sampleBook();

  it("survive a new paragraph added at the top", () => {
    const next = parseText("A new opening line.\n\n" + book.blocks.map((b) => b.text).join("\n\n"), "T").blocks;
    const r = remapScenes(book.blocks, next, book.scenes);
    expect(r.lost).toBe(0);
    expect(r.scenes.map((s) => s.after)).toEqual(book.scenes.map((s) => s.after + 1));
    expect(r.scenes.map((s) => s.caption)).toEqual(book.scenes.map((s) => s.caption));
  });

  it("drop out when their paragraph is rewritten, and the rest stay quoted", () => {
    const blocks = book.blocks.map((b, i) => (i === book.scenes[1].after ? { ...b, text: "Rewritten by the author." } : b));
    const r = remapScenes(book.blocks, blocks, book.scenes);
    expect(r.lost).toBe(1);
    r.scenes.forEach((s) => expect(captionIsQuoted(s.caption, blocks, s.after)).toBe(true));
  });

  it("beats move the same way", () => {
    const next = [{ type: "p" as const, text: "Inserted." }, ...book.blocks];
    expect(remapBeats(book.blocks, next, [4, 12])).toEqual([5, 13]);
  });
});

describe("parseDraft (the Studio's title field)", () => {
  it("takes the title from an opening heading when the field is empty", () => {
    const r = parseDraft(EPISODE, "");
    expect(r.title).toBe("The Lesson I Refused to Learn");
    expect(r.blocks[0].type).toBe("p");
  });
  it("a typed title wins, and a heading that repeats it isn't doubled", () => {
    const r = parseDraft(EPISODE, "The Lesson I Refused to Learn");
    expect(r.blocks).toEqual(parseText(EPISODE).blocks);
  });
  it("a typed title never eats a first line that is the author's text", () => {
    const r = parseDraft("Chapter One\n\nIt began.", "My Book");
    expect(r.title).toBe("My Book");
    expect(r.blocks.map((b) => b.text)).toEqual(["Chapter One", "It began."]);
  });
});

describe("joining episodes", () => {
  it("gives each episode a heading and keeps every paragraph", () => {
    const { markdown, title } = joinEpisodes([
      { name: "01-the-first-night.md", markdown: "It began.\n\nIt rained." },
      { name: "02-the-second-night.md", markdown: "# The Second Night\n\nIt ended." },
    ]);
    expect(parseText(markdown, title || "x").blocks).toEqual([
      { type: "h", text: "The first night", level: 1 }, { type: "p", text: "It began." }, { type: "p", text: "It rained." },
      { type: "h", text: "The Second Night", level: 1 }, { type: "p", text: "It ended." },
    ]);
    expect(title).toBe("The");
  });
  it("a single file with a heading is left exactly as it is", () => {
    const r = joinEpisodes([{ name: "x.md", markdown: EPISODE }]);
    expect(r.markdown).toBe(EPISODE.trim());
    expect(r.title).toBe("");
  });
  it("names files nicely", () => {
    expect(prettyName("01-the-lesson-i-refused-to-learn.md")).toBe("The lesson i refused to learn");
  });
});

describe("export", () => {
  const p: Pristine = { shell: "<div id=\"shell\"></div>", css: "body{}", engine: "console.log(1)" };
  const close = ["<", "/script>"].join("");

  it("text can never close the script tag it is embedded in", () => {
    const evil: Book = { title: "A </title><script>x()" + close, blocks: [{ type: "p", text: "Hi " + close + "<script>alert(1)" + close }], scenes: [], source: "auto" };
    const html = buildBookHtml(p, evil, DEFAULTS);
    expect(html.split(close).length - 1).toBe(2); // the data script and the engine, nothing else
    expect(html).not.toContain("<script>alert");
    expect(JSON.parse(scriptJson(evil.blocks))).toEqual(evil.blocks);
  });
  it("embeds the book, the settings and the engine", () => {
    const b = sampleBook(), html = buildBookHtml(p, b, { ...DEFAULTS, theme: "vellum" });
    expect(html).toContain("window.__BOOK=");
    expect(html).toContain("\"theme\":\"vellum\"");
    expect(html).toContain("console.log(1)");
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });
  it("a preview carries no book, only the flag", () => {
    const html = buildBookHtml(p, null, DEFAULTS, { preview: true });
    expect(html).toContain("window.__PREVIEW=true");
    expect(html).not.toContain("__BOOK");
  });
});
