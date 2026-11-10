// PDF → Markdown: typeset episode 01 the way real PDFs lay it out (running heads, page numbers,
// indented or spaced paragraphs, words hyphenated at line ends, paragraphs across page breaks),
// convert it back, and require every paragraph, word for word.
import { describe, expect, it } from "vitest";
import { itemsToLines, joinLine, pagesToMarkdown, type PdfLine } from "../src/import/pdfmd";
import { parseText } from "../src/parse";
import { SEED_TEXT, SEED_TITLE } from "../src/seed";

interface Opts { style: "indent" | "gap"; perPage: number; width: number; hyphenate: boolean; centerBeats: boolean }

/** Wrap a paragraph into lines of at most `width` characters, optionally hyphenating long words. */
function wrap(p: string, width: number, hyphenate: boolean): string[] {
  const out: string[] = [];
  let line = "";
  p.split(" ").forEach((w) => {
    if (!line) { line = w; return; }
    if (line.length + 1 + w.length <= width) { line += " " + w; return; }
    const room = width - line.length - 2;
    if (hyphenate && /^[a-z]{9,}$/.test(w) && room >= 4) { out.push(line + " " + w.slice(0, room) + "-"); line = w.slice(room); return; }
    out.push(line); line = w;
  });
  if (line) out.push(line);
  return out;
}

function typeset(title: string, paras: readonly string[], o: Opts): PdfLine[][] {
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [], y = 0, n = 0;
  const newPage = () => {
    if (page.length) { page.push({ s: String(++n), x: 300, y: 40, h: 10 }); pages.push(page); }
    page = pages.length ? [{ s: "THE LESSON I REFUSED TO LEARN", x: 200, y: 780, h: 9 }] : [];
    y = 740;
  };
  newPage();
  page.push({ s: title, x: 150, y, h: 24 }); y -= 40;
  paras.forEach((p) => {
    const short = p.length <= 18;
    wrap(p, o.width, o.hyphenate).forEach((s, i) => {
      if (page.length >= o.perPage) newPage();
      const x = short && o.centerBeats ? 280 : o.style === "indent" && i === 0 ? 86 : 72;
      page.push({ s, x, y, h: 11 }); y -= 14;
    });
    if (o.style === "gap") y -= 10;
  });
  newPage();
  return pages;
}

const BODY = [...SEED_TEXT];

describe("pagesToMarkdown", () => {
  const variants: [string, Opts][] = [
    ["indented paragraphs", { style: "indent", perPage: 38, width: 72, hyphenate: false, centerBeats: false }],
    ["spaced paragraphs", { style: "gap", perPage: 34, width: 66, hyphenate: false, centerBeats: false }],
    ["hyphenated, centred beats", { style: "indent", perPage: 41, width: 70, hyphenate: true, centerBeats: true }],
  ];
  variants.forEach(([name, o]) => it("round-trips episode 01 (" + name + ")", () => {
    const { markdown, report } = pagesToMarkdown(typeset(SEED_TITLE, BODY, o));
    const { title, blocks } = parseText(markdown);
    expect(title).toBe(SEED_TITLE);
    const got = blocks.map((b) => b.text), at = got.findIndex((t, i) => t !== BODY[i]);
    expect(at < 0 ? null : { at, got: got[at], want: BODY[at] }).toBeNull();
    expect(got).toEqual(BODY);
    expect(blocks.every((b) => b.type === "p")).toBe(true);
    expect(report.runningHeads).toBeGreaterThan(0);
    expect(report.pageNumbers).toBeGreaterThan(0);
    expect(report.headings).toBe(1);
  }));

  it("round-trips at every page length and measure (where the page breaks fall must not matter)", () => {
    const fails: string[] = [];
    (["indent", "gap"] as const).forEach((style) => [52, 60, 66, 72, 80].forEach((width) => {
      for (let perPage = 14; perPage <= 46; perPage += 2) {
        const { markdown, report } = pagesToMarkdown(typeset(SEED_TITLE, BODY, { style, perPage, width, hyphenate: width <= 66, centerBeats: perPage % 4 === 0 }));
        const got = parseText(markdown).blocks.map((b) => b.text);
        const tag = style + " w" + width + " p" + perPage;
        // The words, in order, always survive.
        if (got.join(" ") !== BODY.join(" ")) { fails.push(tag + ": words differ"); continue; }
        // Paragraphs: exact, except a split at a page break the report told the author to check.
        let i = 0, j = 0;
        while (i < BODY.length && j < got.length) {
          if (got[j] === BODY[i]) { i++; j++; continue; }
          const flagged = report.unsure.some((u) => BODY[i].slice(got[j].length + 1).startsWith(u));
          if (!flagged || !BODY[i].startsWith(got[j] + " ")) { fails.push(tag + " @" + i + ": " + got[j].slice(0, 60)); break; }
          { j++; const rest = BODY[i].slice(got[j - 1].length + 1); if (got[j] === rest) { i++; j++; } else { fails.push(tag + " @" + i + " split twice"); break; } }
        }
      }
    }));
    expect(fails).toEqual([]);
  });

  it("joins a paragraph split by a page break", () => {
    const o: Opts = { style: "indent", perPage: 9, width: 60, hyphenate: false, centerBeats: false };
    const { report } = pagesToMarkdown(typeset(SEED_TITLE, BODY.slice(0, 12), o));
    expect(report.joinedAcrossPages).toBeGreaterThan(0);
  });

  it("keeps scene breaks as their own paragraph", () => {
    const L = (s: string, y: number, x = 72): PdfLine => ({ s, x, y, h: 11 });
    const { markdown } = pagesToMarkdown([[L("The lamp went out and the room was dark at last.", 700), L("* * *", 686, 280), L("Morning came grey and slow over the roofs of the city.", 672)]]);
    expect(markdown.split("\n\n")).toEqual(["The lamp went out and the room was dark at last.", "* * *", "Morning came grey and slow over the roofs of the city."]);
  });
});

describe("line-end hyphens", () => {
  const page = (lines: string[]) => [lines.map((s, i) => ({ s, x: 72, y: 700 - i * 14, h: 11 }))];

  it("mends a typesetting hyphen", () => {
    expect(pagesToMarkdown(page(["I tried hard to remem-", "ber every move he made that night."])).markdown).toBe("I tried hard to remember every move he made that night.");
  });
  it("keeps a real compound the document uses (half-shadows)", () => {
    const md = pagesToMarkdown(page(["He preferred the half-", "shadows of the room. The half-shadows hid him."])).markdown;
    expect(md).toContain("preferred the half-shadows of");
  });
  it("keeps a compound of two words the document uses on their own", () => {
    const md = pagesToMarkdown(page(["It was almost a lesson, almost-", "lesson enough. A lesson is a lesson."])).markdown;
    expect(md).toContain("almost-lesson enough");
  });
  it("joins dashes the way the document spaces them", () => {
    expect(joinLine("dark—", "and still", false)).toBe("dark—and still");
    expect(joinLine("dark —", "and still", true)).toBe("dark — and still");
  });
});

describe("itemsToLines", () => {
  it("joins items on one baseline and adds a missing word gap", () => {
    const lines = itemsToLines([
      { str: "The lamp", x: 72, y: 700, w: 40, h: 11 },
      { str: "buzzed", x: 116, y: 700, w: 30, h: 11 },
      { str: "quietly.", x: 72, y: 686, w: 36, h: 11 },
    ]);
    expect(lines.map((l) => l.s)).toEqual(["The lamp buzzed", "quietly."]);
  });
  it("does not split a word pdf.js cut into two items", () => {
    const lines = itemsToLines([{ str: "chess", x: 72, y: 700, w: 25, h: 11 }, { str: "board", x: 97, y: 700, w: 25, h: 11 }]);
    expect(lines[0].s).toBe("chessboard");
  });
});
