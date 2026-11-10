// Formats in and out: richer Markdown round-trips, Word / EPUB / HTML come in as Markdown with
// every word kept, the EPUB we write is a valid package that reads back, and the PDF reader keeps
// italics, rejoins drop caps, spells out ligatures and reads two columns in order.
import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEpub } from "../src/epub/book";
import { docxToMarkdown, styleNames } from "../src/import/docx";
import { epubToMarkdown } from "../src/import/epub";
import { htmlToMarkdown } from "../src/import/html";
import { itemsToLines, pagesToMarkdown, type PdfLine } from "../src/import/pdfmd";
import { plain } from "../src/inline";
import { blocksToText, parseText } from "../src/parse";
import { sampleBook } from "../src/sample";
import { DEFAULTS } from "../src/settings";
import { applyFix, findIssues } from "../src/text/check";
import { crc32, text, unzip, utf8, zipStore } from "../src/zip";

const EPISODE = readFileSync(new URL("../episodes/01-the-lesson-i-refused-to-learn.md", import.meta.url), "utf8");

describe("richer Markdown", () => {
  const md = [
    "# Part One", "> Some lines are\\", "> kept apart.", "> — An Author",
    "## The First Night", "It began *quietly*.", "The rain came down\\", "on the roof\\", "all night",
    "> A plain quote that runs on.", "* * *", "### Later", "It ended.",
  ].join("\n\n").replace("\\\n\n> kept", "\\\n> kept").replace("apart.\n\n> — An", "apart.\n> — An").replace("down\\\n\non the roof\\\n\nall", "down\\\non the roof\\\nall");
  it("reads chapters, sections, epigraphs, verse and quotes", () => {
    const { blocks } = parseText(md, "T");
    expect(blocks.map((b) => b.type + (b.level || ""))).toEqual(["h1", "quote", "h2", "p", "verse", "quote", "p", "h3", "p"]);
    expect(blocks[1].text).toBe("Some lines are\nkept apart.\n— An Author");
    expect(blocks[4].text).toBe("The rain came down\non the roof\nall night");
  });
  it("blocks → Markdown → blocks is a fixed point", () => {
    const a = parseText(md, "T").blocks, b = parseText(blocksToText(a), "T").blocks;
    expect(b).toEqual(a);
    const e = parseText(EPISODE);
    expect(parseText(blocksToText(e.blocks), e.title).blocks).toEqual(e.blocks);
  });
});

describe("HTML → Markdown (rich paste, EPUB chapters)", () => {
  it("keeps italics, bold, headings, quotes, breaks and every word", () => {
    const html = "<h1>The Night</h1><p>It was <i>very</i> late, and <b>cold</b>.</p><p><span style=\"font-style:italic\">Google</span> Docs italics.</p>"
      + "<blockquote><p>Said once.</p></blockquote><hr><p>Line one<br>line two</p><p>A&nbsp;&amp;&#8212;&rsquo;s</p>";
    expect(htmlToMarkdown(html).split("\n\n")).toEqual([
      "# The Night", "It was *very* late, and **cold**.", "*Google* Docs italics.", "> Said once.", "* * *", "Line one\\\nline two", "A &—’s",
    ]);
  });
  it("moves spaces outside the markers", () => {
    expect(htmlToMarkdown("<p>a<i> word </i>b</p>")).toBe("a *word* b");
    expect(htmlToMarkdown("<p>empty<i></i> here</p>")).toBe("empty here");
  });
});

describe("Word (.docx)", () => {
  const doc = '<w:document><w:body>'
    + '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>My Book</w:t></w:r></w:p>'
    + '<w:p><w:pPr><w:pStyle w:val="berschrift1"/></w:pPr><w:r><w:t>Chapter One</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t xml:space="preserve">It was </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>very</w:t></w:r><w:r><w:t xml:space="preserve"> late</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:t>.</w:t></w:r></w:p>'
    + '<w:p><w:r><w:rPr><w:i w:val="0"/></w:rPr><w:t>Not italic &amp; fine.</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t>Roses</w:t><w:br/><w:t>are red</w:t></w:r></w:p>'
    + '<w:p/></w:body></w:document>';
  const styles = '<w:styles><w:style w:type="paragraph" w:styleId="berschrift1"><w:name w:val="heading 1"/></w:style></w:styles>';
  it("reads the title, localised headings, italics, breaks and footnote marks", () => {
    const r = docxToMarkdown(doc, styleNames(styles));
    expect(r.title).toBe("My Book");
    expect(r.markdown.split("\n\n")).toEqual(["# Chapter One", "It was *very* late.", "Not italic & fine.", "Roses\\\nare red"]);
    expect(r.notes.join(" ")).toContain("1 footnote mark");
  });
  it("unzips a real deflated .docx", async () => {
    const z = zipStore([{ name: "word/document.xml", data: "x" }]);
    // Build a deflated entry by hand: same zip, method 8.
    const deflated = deflateRawSync(Buffer.from(doc));
    const entries = await unzip(rezip([{ name: "word/document.xml", raw: new Uint8Array(deflated), size: Buffer.byteLength(doc), crc: crc32(utf8(doc)) }]));
    expect(text(entries.get("word/document.xml"))).toBe(doc);
    expect((await unzip(z)).get("word/document.xml")!.length).toBe(1);
  });
});

/** A minimal ZIP writer for deflated test entries. */
function rezip(files: { name: string; raw: Uint8Array; size: number; crc: number }[]): Uint8Array {
  const parts: number[] = [], central: number[] = [];
  const u16 = (a: number[], v: number) => a.push(v & 255, (v >> 8) & 255), u32 = (a: number[], v: number) => { u16(a, v & 0xffff); u16(a, v >>> 16); };
  files.forEach((f) => {
    const off = parts.length, name = Array.from(utf8(f.name));
    u32(parts, 0x04034b50); u16(parts, 20); u16(parts, 0); u16(parts, 8); u16(parts, 0); u16(parts, 0); u32(parts, f.crc); u32(parts, f.raw.length); u32(parts, f.size); u16(parts, name.length); u16(parts, 0);
    parts.push(...name, ...f.raw);
    u32(central, 0x02014b50); u16(central, 20); u16(central, 20); u16(central, 0); u16(central, 8); u16(central, 0); u16(central, 0); u32(central, f.crc); u32(central, f.raw.length); u32(central, f.size);
    u16(central, name.length); u16(central, 0); u16(central, 0); u16(central, 0); u16(central, 0); u32(central, 0); u32(central, off); central.push(...name);
  });
  const end: number[] = []; u32(end, 0x06054b50); u16(end, 0); u16(end, 0); u16(end, files.length); u16(end, files.length); u32(end, central.length); u32(end, parts.length); u16(end, 0);
  return new Uint8Array([...parts, ...central, ...end]);
}

describe("EPUB", () => {
  it("writes a valid package that reads back with every paragraph", async () => {
    const b = { ...sampleBook(), author: "A. Writer", blocks: [{ type: "h" as const, text: "One", level: 1 as const }, ...sampleBook().blocks] };
    b.scenes = b.scenes.map((s) => ({ ...s, after: s.after + 1 }));
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const bytes = buildEpub(b, DEFAULTS, [{ after: -1, cover: true, png }, { after: 5, png }], new Date("2026-11-10T12:00:00Z"));
    // mimetype first, stored, exactly
    expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe("mimetype");
    expect(new TextDecoder().decode(bytes.subarray(38, 58))).toBe("application/epub+zip");
    const files = await unzip(bytes), strings = new Map<string, string>();
    files.forEach((v, k) => { if (!k.endsWith(".png")) strings.set(k, text(v)); });
    expect([...files.keys()]).toEqual(expect.arrayContaining(["META-INF/container.xml", "OEBPS/content.opf", "OEBPS/nav.xhtml", "OEBPS/ch1.xhtml", "OEBPS/images/cover.png", "OEBPS/images/fig-2.png"]));
    const opf = strings.get("OEBPS/content.opf")!;
    expect(opf).toContain("<dc:creator>A. Writer</dc:creator>");
    expect(opf).toContain('properties="cover-image"');
    expect(opf).toContain("2026-11-10T12:00:00Z");
    const back = epubToMarkdown(strings);
    expect(back.title).toBe(b.title);
    const got = parseText(back.markdown, "x").blocks.filter((x) => x.type === "p").map((x) => plain(x.text));
    sampleBook().blocks.forEach((x) => expect(got).toContain(x.text));
  });
});

describe("typography check", () => {
  it("finds typewriter habits and fixes only on request, leaving structure alone", () => {
    const md = "> \"Hello,\" she said -- it's late...\n\n* * *\n\nTwo  spaces.";
    const kinds = findIssues(md).map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(["quotes", "dashes", "ellipses", "spaces"]));
    let out = md;
    (["quotes", "dashes", "ellipses", "spaces"] as const).forEach((k) => { out = applyFix(out, k); });
    expect(out).toBe("> “Hello,” she said — it’s late…\n\n* * *\n\nTwo spaces.");
    expect(findIssues(EPISODE).filter((i) => i.kind === "quotes")).toEqual([]);
  });
});

describe("PDF extras", () => {
  const L = (s: string, y: number, x = 72, h = 11): PdfLine => ({ s, x, y, h });
  it("keeps italic and bold runs as Markdown", () => {
    const lines = itemsToLines([
      { str: "It was ", x: 72, y: 700, w: 30, h: 11 }, { str: "very", x: 102, y: 700, w: 20, h: 11, it: true }, { str: " late, ", x: 122, y: 700, w: 28, h: 11 },
      { str: "truly", x: 150, y: 700, w: 22, h: 11, b: true }, { str: ".", x: 172, y: 700, w: 3, h: 11 },
    ]);
    expect(lines[0].s).toBe("It was *very* late, **truly**.");
  });
  it("joins an italic run across a line end", () => {
    const { markdown } = pagesToMarkdown([[L("He whispered *the words he never*", 700), L("*said aloud* to anyone in that house.", 686)]]);
    expect(markdown).toBe("He whispered *the words he never said aloud* to anyone in that house.");
  });
  it("puts a drop cap back on its word, and keeps a one-letter word apart", () => {
    const page = [L("T", 690, 72, 34), L("he lamp above the table buzzed quietly over the board.", 700, 100), L("Its yellow glow pooled like a spotlight on the squares.", 686, 100), L("The rest of the room was darker than it needed to be then.", 672)];
    const { markdown, report } = pagesToMarkdown([page]);
    expect(markdown.startsWith("The lamp above the table")).toBe(true);
    expect(report.dropCaps).toBe(1);
    const a = pagesToMarkdown([[L("A", 690, 72, 34), L("lamp hung above the table and the lamp buzzed all night.", 700, 100), L("It was the only lamp in the house and the only light.", 686)]]);
    expect(a.markdown.startsWith("A lamp hung")).toBe(true);
  });
  it("spells out ligature characters", () => {
    const fi = String.fromCharCode(0xfb01), fl = String.fromCharCode(0xfb02);
    const { markdown, report } = pagesToMarkdown([[L("The " + fi + "nal " + fl + "ame.", 700)]]);
    expect(markdown).toBe("The final flame.");
    expect(report.ligatures).toBe(2);
  });
  it("reads a two-column page left column first", () => {
    const left = ["The first column begins the story of the", "night they met, and carries it down the", "page line by line until it ends here."];
    const right = ["The second column picks the story up and", "carries it on to the end of the page for", "the reader who has followed it this far."];
    const items = [0, 1, 2].flatMap((k) => [
      { str: left[k], x: 72, y: 700 - k * 14, w: 200, h: 11 }, { str: right[k], x: 320, y: 700 - k * 14, w: 200, h: 11 },
    ]);
    const page = itemsToLines(items).concat(itemsToLines([0, 1, 2].flatMap((k) => [
      { str: left[k], x: 72, y: 640 - k * 14, w: 200, h: 11 }, { str: right[k], x: 320, y: 640 - k * 14, w: 200, h: 11 },
    ])));
    const { markdown, report } = pagesToMarkdown([page]);
    expect(report.twoColumn).toBe(1);
    expect(markdown.indexOf("The first column")).toBeLessThan(markdown.indexOf("The second column"));
    expect(markdown.indexOf("ends here.")).toBeLessThan(markdown.indexOf("The second column"));
  });
});
