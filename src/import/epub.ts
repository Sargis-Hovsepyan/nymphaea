// EPUB → Markdown: the container points at the package, the package's spine gives the reading
// order, and each chapter's XHTML goes through the same HTML → Markdown as a rich paste.
import { decode, htmlToMarkdown } from "./html";
import { text, unzip } from "../zip";

export interface EpubResult { markdown: string; title: string; author: string; notes: string[] }

function resolve(base: string, href: string): string {
  const parts = (base.includes("/") ? base.slice(0, base.lastIndexOf("/") + 1) : "").concat(decodeURIComponent(href.split("#")[0])).split("/");
  const out: string[] = [];
  parts.forEach((p) => { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); });
  return out.join("/");
}

/** Pure: an unzipped EPUB → Markdown. */
export function epubToMarkdown(files: Map<string, string>): EpubResult {
  const container = files.get("META-INF/container.xml") || "";
  const opfPath = (container.match(/full-path="([^"]+)"/) || [])[1];
  const opf = opfPath ? files.get(opfPath) || "" : "";
  if (!opf) throw new Error("epub");
  const title = decode((opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/) || [, ""])[1] as string).trim();
  const author = decode((opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/) || [, ""])[1] as string).trim();
  const manifest: Record<string, { href: string; type: string; props: string }> = {};
  for (const m of opf.matchAll(/<item\b([^>]*)\/?>/g)) {
    const a = m[1], id = (a.match(/\bid="([^"]+)"/) || [])[1], href = (a.match(/\bhref="([^"]+)"/) || [])[1];
    if (id && href) manifest[id] = { href, type: (a.match(/media-type="([^"]+)"/) || [])[1] || "", props: (a.match(/properties="([^"]+)"/) || [])[1] || "" };
  }
  const spine = Array.from(opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"[^>]*>/g)).filter((m) => !/linear="no"/.test(m[0])).map((m) => m[1]);
  const parts: string[] = [];
  let skipped = 0;
  spine.forEach((id) => {
    const it = manifest[id];
    if (!it || it.props.includes("nav")) return;
    const html = files.get(resolve(opfPath!, it.href));
    if (!html) { skipped++; return; }
    const md = htmlToMarkdown(html).trim();
    if (md) parts.push(md);
  });
  // The title page usually repeats the title; drop a leading heading that is exactly the title.
  let markdown = parts.join("\n\n");
  if (title) markdown = markdown.replace(new RegExp("^#{1,3} " + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\n+"), "");
  const notes = [spine.length + " section" + (spine.length === 1 ? "" : "s") + " in reading order"];
  if (skipped) notes.push(skipped + " missing from the file");
  return { markdown, title, author, notes };
}

export async function readEpub(buf: ArrayBuffer): Promise<EpubResult> {
  const z = await unzip(buf), files = new Map<string, string>();
  z.forEach((v, k) => { if (/\.(xml|opf|x?html?|ncx)$/i.test(k)) files.set(k, text(v)); });
  return epubToMarkdown(files);
}
