// The book as an EPUB 3 for e-readers: a title page, one XHTML file per chapter, a contents page,
// the pictures at their finished frame with their quoted captions, and the theme's light mood as
// the stylesheet. Pure (pictures come in as PNG data URLs); zipped by zip.ts.
import { APP_NAME } from "../brand";
import { beatIndexes, hasOwnNumber } from "../book/structure";
import { PAIRINGS, numeral } from "../design/type";
import { palette } from "../design/themes";
import { isBreak, spans } from "../inline";
import { sceneLabel } from "../compose";
import { LEAD } from "../settings";
import { guardScenes } from "../stage/guard";
import type { Block, Book, Settings } from "../types";
import { zipStore } from "../zip";

export interface Picture { after: number; cover?: boolean; png: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);

function inline(text: string): string {
  return spans(text).map((s) => {
    let h = esc(s.t);
    if (s.em) h = "<em>" + h + "</em>";
    if (s.strong) h = "<strong>" + h + "</strong>";
    return h;
  }).join("");
}
const lines = (t: string) => t.split("\n").map(inline).join("<br/>");

function page(title: string, body: string): string {
  return '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">'
    + '<head><meta charset="utf-8"/><title>' + esc(title) + '</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>' + body + "</body></html>";
}

function dataBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(",") + 1)), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function css(S: Settings): string {
  const p = palette(S.theme, false), P = PAIRINGS[S.pairing] || PAIRINGS.literary, book = S.para === "book";
  return "body{font-family:" + P.body + ";line-height:" + (1.55 * (LEAD[S.leading] || 1)).toFixed(2) + ";color:" + p.ink + ";margin:0 5%}"
    + "h1,h2,h3{font-family:" + P.display + ";font-weight:normal;text-align:center}"
    + "h1{font-size:2em;margin:30% 0 .3em}h2{font-size:1.5em;margin:2.4em 0 1.4em}h3{font-size:1em;letter-spacing:.2em;text-transform:uppercase}"
    + (S.hyphens ? "p,blockquote{hyphens:auto;-epub-hyphens:auto;-webkit-hyphens:auto}" : "")
    + ".num{display:block;font-size:" + (S.chapterStyle === "numeral" ? "3.6em" : S.chapterStyle === "classic" ? "2em" : "1em") + ";color:" + p.accent + ";margin-bottom:.2em"
    + (S.chapterStyle === "minimal" || S.chapterStyle === "ornament" ? ";letter-spacing:.3em;text-transform:uppercase;font-size:.8em;color:" + p.muted : "") + "}"
    + (S.chapterStyle === "minimal" ? "h2{font-size:1.2em;margin:2em 0 1.2em}" : "")
    + (S.chapterStyle === "ornament" ? "h2:before{content:'\\2766';display:block;color:" + p.accent + ";font-size:1.2em;margin-bottom:.4em}" : "")
    + (S.frame === "plate" ? "figure{margin:2.6em auto;padding:.5em;border:1px solid " + p.muted + "}figcaption{text-align:center}" : "")
    + (S.frame === "head" ? "figure.head{margin:0 auto 1em}" : "")
    + ".sub{text-align:center;font-style:italic}.by{text-align:center;font-variant:small-caps;letter-spacing:.12em}"
    + ".ded{text-align:center;font-style:italic;margin-top:30%}"
    + "p{margin:0" + (book ? "" : " 0 .8em") + ";text-indent:" + (book ? "1.4em" : "0") + (S.align === "justify" ? ";text-align:justify" : "") + "}"
    + "p.first,p.beat,p.brk,p.verse,h2+p,h3+p,figure+p,blockquote+p,.brk+p{text-indent:0}"
    + "p.beat{text-align:center;font-style:italic;margin:1em 0}"
    + "p.brk{text-align:center;margin:1.4em 0;color:" + p.accent + "}"
    + "p.verse{margin:1em 0 1em 1.5em;text-align:left}"
    + "blockquote{margin:1.2em 1.5em;font-style:italic}blockquote.epi{text-align:right;margin-left:30%}"
    + "figure{margin:1.6em auto;text-align:center;page-break-inside:avoid}figure img{max-width:100%}"
    + "figcaption{font-size:.8em;letter-spacing:.08em;text-transform:uppercase;color:" + p.muted + "}"
    + (S.cover === "type" ? "h1{font-size:2.8em;margin:25% 0 .3em}" : S.cover === "minimal" ? "h1{font-size:1.6em;margin:12% 0 .3em}" : "")
    + ".cover-img{text-align:center;margin-top:10%}.cover-img img{max-width:80%}"
    + ".colophon{text-align:center;font-style:italic;font-size:.85em;margin-top:40%}";
}

export function buildEpub(book: Book, S: Settings, pictures: Picture[], now = new Date()): Uint8Array {
  const B = book, scenes = guardScenes(B.blocks, B.scenes).scenes;
  const imgs = new Map<number, string>(), files: { name: string; data: Uint8Array | string }[] = [];
  let cover = "";
  pictures.forEach((p, k) => {
    const name = p.cover ? "images/cover.png" : "images/fig-" + (k + 1) + ".png";
    if (p.cover && S.cover !== "picture") return;
    files.push({ name: "OEBPS/" + name, data: dataBytes(p.png) });
    if (p.cover) cover = name; else imgs.set(p.after, name);
  });
  // Chapters: split at level-1 headings (text before the first one is its own section).
  type Ch = { title: string; num: string; blocks: [Block, number][] };
  const chapters: Ch[] = [];
  let cur: Ch = { title: B.title, num: "", blocks: [] }, n = 0;
  B.blocks.forEach((b, i) => {
    if (b.type === "h" && (b.level || 1) === 1) {
      if (cur.blocks.length) chapters.push(cur);
      cur = { title: b.text, num: hasOwnNumber(b.text) ? "" : numeral(++n, S.numerals), blocks: [[b, i]] };
    } else cur.blocks.push([b, i]);
  });
  if (cur.blocks.length) chapters.push(cur);

  const beats = beatIndexes(B.blocks, B.beats);
  const byAfter = new Map<number, typeof scenes>();
  scenes.forEach((s) => byAfter.set(s.after, [...(byAfter.get(s.after) || []), s]));
  const xhtml = chapters.map((c) => {
    let first = true, prev: Block | null = null;
    // Head frame: the chapter's first picture opens the chapter, above its title.
    const idx = new Set(c.blocks.map(([, i]) => i));
    const headS = S.frame === "head" && c.blocks[0] && c.blocks[0][0].type === "h" && (c.blocks[0][0].level || 1) === 1 ? scenes.filter((s) => idx.has(s.after)).sort((a, b) => a.after - b.after)[0] : undefined;
    const fig = (s: typeof scenes[number], i: number, cls = "") => {
      const src = imgs.get(i);
      return "<figure" + (cls ? ' class="' + cls + '"' : "") + ">" + (src ? '<img src="' + src + '" alt="' + esc(sceneLabel(s.scene)) + '"/>' : "") + "<figcaption>" + esc(s.caption) + "</figcaption></figure>";
    };
    return (headS ? fig(headS, headS.after, "head") + "\n" : "") + c.blocks.map(([b, i]) => {
      let h: string;
      if (b.type === "h") { h = (b.level || 1) === 1 ? "<h2>" + (c.num ? '<span class="num">' + esc(c.num) + "</span>" : "") + inline(b.text) + "</h2>" : "<h3>" + inline(b.text) + "</h3>"; first = true; }
      else if (b.type === "quote") h = '<blockquote class="' + (!prev || prev.type === "h" ? "epi" : "q") + '"><p>' + lines(b.text) + "</p></blockquote>";
      else if (b.type === "verse") h = '<p class="verse">' + lines(b.text) + "</p>";
      else if (isBreak(b.text)) { h = '<p class="brk">' + esc(b.text) + "</p>"; first = true; }
      else { h = "<p" + (first ? ' class="first"' : S.beats && beats.has(i) ? ' class="beat"' : "") + ">" + inline(b.text) + "</p>"; first = false; }
      (byAfter.get(i) || []).forEach((s) => { if (s !== headS) h += fig(s, i); });
      prev = b;
      return h;
    }).join("\n");
  });

  const id = "urn:uuid:" + uuidOf(B.title + "|" + B.blocks.length + "|" + (B.blocks[0] ? B.blocks[0].text.slice(0, 80) : ""));
  const titlePage = page(B.title, (cover && S.cover === "picture" ? '<div class="cover-img"><img src="' + cover + '" alt=""/></div>' : "")
    + "<h1>" + esc(B.title) + "</h1>" + (B.subtitle ? '<p class="sub">' + esc(B.subtitle) + "</p>" : "") + (B.author ? '<p class="by">' + esc(B.author) + "</p>" : "")
    + (B.dedication ? '<p class="ded">' + lines(B.dedication) + "</p>" : ""));
  const colophon = page("Colophon", '<p class="colophon">' + esc("Made with " + APP_NAME) + "</p>");
  const clean = (t: string) => t.replace(/\*+/g, "");
  const nav = page("Contents", '<nav epub:type="toc" id="toc"><h2>Contents</h2><ol>'
    + chapters.map((c, k) => '<li><a href="ch' + (k + 1) + '.xhtml">' + esc((c.num ? c.num + ". " : "") + clean(c.title)) + "</a></li>").join("") + "</ol></nav>");
  const modified = now.toISOString().replace(/\.\d+Z$/, "Z");
  const manifest = ['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', '<item id="css" href="style.css" media-type="text/css"/>',
    '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>', '<item id="colophon" href="colophon.xhtml" media-type="application/xhtml+xml"/>',
    ...chapters.map((_, k) => '<item id="ch' + (k + 1) + '" href="ch' + (k + 1) + '.xhtml" media-type="application/xhtml+xml"/>'),
    ...files.map((f, k) => '<item id="img' + k + '" href="' + f.name.replace("OEBPS/", "") + '" media-type="image/png"' + (f.name.endsWith("cover.png") ? ' properties="cover-image"' : "") + "/>")];
  const opf = '<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">'
    + '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">' + id + "</dc:identifier><dc:title>" + esc(B.title) + "</dc:title>"
    + (B.author ? "<dc:creator>" + esc(B.author) + "</dc:creator>" : "") + '<dc:language>en</dc:language><meta property="dcterms:modified">' + modified + "</meta></metadata>"
    + "<manifest>" + manifest.join("") + "</manifest>"
    + '<spine><itemref idref="title"/><itemref idref="nav"/>' + chapters.map((_, k) => '<itemref idref="ch' + (k + 1) + '"/>').join("") + '<itemref idref="colophon"/></spine></package>';
  const container = '<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
  return zipStore([
    { name: "mimetype", data: "application/epub+zip" },
    { name: "META-INF/container.xml", data: container },
    { name: "OEBPS/content.opf", data: opf },
    { name: "OEBPS/nav.xhtml", data: nav },
    { name: "OEBPS/style.css", data: css(S) },
    { name: "OEBPS/title.xhtml", data: titlePage },
    ...xhtml.map((body, k) => ({ name: "OEBPS/ch" + (k + 1) + ".xhtml", data: page(clean(chapters[k].title), body) })),
    { name: "OEBPS/colophon.xhtml", data: colophon },
    ...files,
  ]);
}

/** A stable UUID-shaped id from the book itself, so a re-export updates the same book on a reader. */
function uuidOf(s: string): string {
  const h: number[] = [];
  let x = 2166136261;
  for (let k = 0; k < 16; k++) { for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i) ^ k, 16777619); h.push((x >>> 0) & 255); }
  h[6] = (h[6] & 0x0f) | 0x40; h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}
