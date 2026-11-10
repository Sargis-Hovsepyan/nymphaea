// PDF → Markdown in the browser. pdf.js (loaded on demand from cdnjs) reads the text items; the
// pure logic in pdfmd.ts turns them into Markdown and a report of what it did.
import { itemsToLines, pagesToMarkdown, type PdfItem, type PdfLine, type PdfReport } from "./pdfmd";

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";

export function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("load"));
    document.head.appendChild(s);
  });
}

export async function pdfToMarkdown(file: File, onPage?: (p: number, n: number) => void): Promise<{ markdown: string; report: PdfReport }> {
  if (!window.pdfjsLib) await loadScript(PDFJS + "pdf.min.js");
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
  const pdf = await lib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  const pages: PdfLine[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    onPage?.(p, pdf.numPages);
    const page = await pdf.getPage(p), tc = await page.getTextContent();
    // Real font names (e.g. "ABCDEF+Garamond-Italic") are known once the page operators are loaded.
    const faces: Record<string, { it: boolean; b: boolean }> = {};
    try { await page.getOperatorList(); } catch { /* style detection is best effort */ }
    const face = (fn: string) => {
      if (faces[fn]) return faces[fn];
      let name = "";
      try { const f = page.commonObjs.get(fn); name = (f && (f.name || f.loadedName)) || ""; } catch { /* not loaded */ }
      const fam = String((tc.styles && tc.styles[fn] && tc.styles[fn].fontFamily) || "");
      const all = name + " " + fam;
      return (faces[fn] = { it: /italic|oblique|-it|ital/i.test(all), b: /bold|black|heavy|semibold|demi|-bd/i.test(all) });
    };
    const items: PdfItem[] = [];
    tc.items.forEach((it: any) => {
      if (!("str" in it)) return;
      const f = it.fontName ? face(it.fontName) : { it: false, b: false };
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: it.height || Math.abs(it.transform[3]) || 10, it: f.it, b: f.b });
    });
    pages.push(itemsToLines(items));
  }
  return pagesToMarkdown(pages);
}
