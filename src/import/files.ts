// Files in → one Markdown text. PDF, Word (.docx), EPUB, HTML, Markdown or plain text; one file, or
// a whole series (sorted by name, so "02" follows "01"): each episode that doesn't open with a
// "# Heading" gets its file name as one.
import { readDocx } from "./docx";
import { readEpub } from "./epub";
import { htmlToMarkdown } from "./html";
import { describeReport } from "./pdfmd";
import { pdfToMarkdown } from "./pdf";

export interface Imported { markdown: string; title: string; author?: string; notes: string[] }

export const ACCEPT = ".pdf,.docx,.epub,.html,.htm,.md,.markdown,.txt,text/plain,text/markdown,text/html,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function prettyName(file: string): string {
  return file.replace(/\.[^.]+$/, "").replace(/^\d+[\s._-]*/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^./, (c) => c.toUpperCase());
}

const isPdf = (f: File) => /\.pdf$/i.test(f.name) || f.type === "application/pdf";
const isDocx = (f: File) => /\.docx$/i.test(f.name);
const isEpub = (f: File) => /\.epub$/i.test(f.name) || f.type === "application/epub+zip";
const isHtml = (f: File) => /\.html?$/i.test(f.name) || f.type === "text/html";
const isText = (f: File) => isPdf(f) || isDocx(f) || isEpub(f) || isHtml(f) || /\.(md|markdown|txt|text)$/i.test(f.name) || /^text\//.test(f.type);

/** Pure: join episode texts into one Markdown book. */
export function joinEpisodes(eps: { name: string; markdown: string }[]): { markdown: string; title: string } {
  if (eps.length === 1) {
    const md = eps[0].markdown.trim();
    // An opening "# Heading" is the title (parseText picks it up); otherwise use the file name.
    return { markdown: md, title: /^#\s/.test(md) ? "" : prettyName(eps[0].name) };
  }
  const parts = eps.map((e) => {
    const md = e.markdown.trim();
    return /^#{1,3}\s/.test(md) ? md : "# " + prettyName(e.name) + "\n\n" + md;
  });
  return { markdown: parts.join("\n\n"), title: commonTitle(eps.map((e) => prettyName(e.name))) };
}

function commonTitle(names: string[]): string {
  let p = names[0] || "";
  names.forEach((n) => { while (p && !n.startsWith(p)) p = p.slice(0, -1); });
  p = p.replace(/[\s\d:.,-]+$/, "").trim();
  return p.length >= 3 ? p : "Collected episodes";
}

export async function importFiles(list: FileList | File[], onStatus?: (s: string) => void): Promise<Imported> {
  const files = Array.from(list).filter(isText).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const skipped = Array.from(list).length - files.length;
  if (!files.length) throw new Error("none");
  const notes: string[] = [], eps: { name: string; markdown: string }[] = [];
  let docTitle = "", author = "";
  for (const f of files) {
    if (isDocx(f)) {
      onStatus?.("Reading " + f.name + "…");
      const r = await readDocx(await f.arrayBuffer());
      eps.push({ name: f.name, markdown: (r.title && files.length > 1 ? "# " + r.title + "\n\n" : "") + r.markdown });
      if (r.title && !docTitle) docTitle = r.title;
      notes.push(f.name + ": read as a Word document" + (r.notes.length ? "; " + r.notes.join("; ") : "") + ".");
    } else if (isEpub(f)) {
      onStatus?.("Reading " + f.name + "…");
      const r = await readEpub(await f.arrayBuffer());
      eps.push({ name: f.name, markdown: r.markdown });
      if (r.title && !docTitle) docTitle = r.title;
      if (r.author && !author) author = r.author;
      notes.push(f.name + ": read as an EPUB; " + r.notes.join("; ") + ".");
    } else if (isHtml(f)) {
      onStatus?.("Reading " + f.name + "…");
      eps.push({ name: f.name, markdown: htmlToMarkdown(await f.text()) });
      notes.push(f.name + ": read as a web page; italics, headings and quotes kept.");
    } else if (isPdf(f)) {
      const { markdown, report } = await pdfToMarkdown(f, (p, n) => onStatus?.("Reading " + f.name + ", page " + p + " of " + n + "…"));
      eps.push({ name: f.name, markdown });
      notes.push(describeReport(f.name, report));
    } else {
      onStatus?.("Reading " + f.name + "…");
      eps.push({ name: f.name, markdown: (await f.text()).replace(/^﻿/, "") });
      notes.push(f.name + ": read as " + (/\.txt$/i.test(f.name) ? "plain text" : "Markdown") + ".");
    }
  }
  if (skipped) notes.push(skipped + " file" + (skipped === 1 ? " wasn’t" : "s weren’t") + " a format Nymphaea reads, so " + (skipped === 1 ? "it was" : "they were") + " skipped.");
  const { markdown, title } = joinEpisodes(eps);
  return { markdown, title: files.length === 1 && docTitle ? docTitle : title, author, notes };
}
