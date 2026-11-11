// Export: the summary sheet and the files it makes (HTML book, EPUB, print, Markdown, a new tab).
import { exportFileName, slug } from "../brand";
import { buildEpub } from "../epub/book";
import { buildBookHtml, canExport } from "../export";
import { PAIRINGS } from "../design/type";
import { THEMES } from "../design/themes";
import { state } from "../state";
import type { Book } from "../types";
import { LAYOUT_NAME, STYLE_NAME } from "./design";
import { $, book, hasText, hooks, plural, sess, usedImages } from "./session";
import { closeExport, closeOnBackdrop, openExport, toast } from "./ui";

export function renderSummary(ps: number, w: number): void {
  const B = book(), S = state.settings, dl = $("mkSum");
  dl.textContent = "";
  const P = PAIRINGS[S.pairing];
  const rows: [string, string][] = hasText() ? [
    ["Title", B.title + (B.author ? " · " + B.author : "")],
    ["File", exportFileName(B.title)],
    ["Text", plural(ps, "paragraph") + ", " + plural(w, "word")],
    ["Form", LAYOUT_NAME[S.layout] + (S.para === "book" ? ", indented" : "") + (S.align === "justify" ? ", justified" : "")],
    ["Colour", THEMES[S.theme].name + ", " + (S.mode === "auto" ? "light or dark with the reader’s device" : S.mode)],
    ["Type", P.name + " (" + P.note + "), " + S.fontSize + "px, " + ({ narrow: 55, normal: 66, wide: 75 } as Record<string, number>)[S.measure] + " characters a line"],
    ["Light", S.light === "off" ? "Even" : S.light[0].toUpperCase() + S.light.slice(1) + (S.flicker && S.light !== "focus" ? ", flickering" : "")],
    ["Pictures", S.style === "none" ? "None" : plural(B.scenes.length, "picture") + ", " + STYLE_NAME[S.style] + (S.motion ? ", animated" : ", still")],
    ["Readers", S.readerControls ? "Can adjust the page, light and type" : "See your look only"],
  ] : [["Book", "Nothing to export yet. Add some text first."]];
  rows.forEach(([k, v]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
  if (!canExport(sess.pristine)) $("mkDlNote").textContent = "Downloads work in the built app: run npm run build, then open index.html.";
}

async function save(name: string, data: string | Uint8Array, type: string): Promise<void> {
  const d = sess.downloads;
  if (d) {
    try {
      await d.save({ filename: name, data: typeof data === "string" ? data : new Blob([data as BlobPart], { type }) });
      toast("Saved " + name + "."); return;
    } catch (e: any) {
      if (e && e.code === "declined") { toast("Download cancelled."); return; }
      if (typeof data === "string") { toast("Couldn’t save the file here.", true); return; }
    }
  }
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast("Saved " + name + ".");
}

/** The book with the AI pictures its scenes use folded in (the export is one self-contained file). */
function bookHtml(): string {
  const imgs = usedImages(), B = book();
  // Prompts are working notes for the Studio, not part of the book.
  const out: Book = { ...B, scenes: B.scenes.map(({ prompt: _p, ...s }) => s) };
  if (Object.keys(imgs).length) out.images = imgs;
  return buildBookHtml(sess.pristine, out, state.settings);
}

export function downloadBook(): void {
  if (!hasText() || !canExport(sess.pristine)) return;
  save(exportFileName(book().title), bookHtml(), "text/html");
  if (($("mkExport") as HTMLDialogElement).open) closeExport();
}
const EXPORT_BUTTONS = ["mkDownload", "mkEpub", "mkMdDl", "mkPrint"];
async function downloadEpub(): Promise<void> {
  if (!hasText()) return;
  const note = $("mkDlNote");
  note.classList.remove("warn");
  note.textContent = "Making the EPUB: drawing each picture…";
  EXPORT_BUTTONS.forEach((id) => { ($(id) as HTMLButtonElement).disabled = true; });
  try {
    const pics = state.settings.style === "none" || state.settings.style === "orn" ? [] : await sess.preview.snapshots();
    const data = buildEpub(book(), state.settings, pics);
    await save(exportFileName(book().title).replace(/\.html$/, ".epub"), data, "application/epub+zip");
    note.textContent = "";
    closeExport();
  } catch (e) {
    note.classList.add("warn");
    note.textContent = "Couldn’t make the EPUB" + (e instanceof Error && e.message ? ": " + e.message : ".") + " The HTML book still works.";
  } finally {
    EXPORT_BUTTONS.forEach((id) => { ($(id) as HTMLButtonElement).disabled = false; });
    hooks.refresh();
  }
}
function downloadMd(): void {
  if (!hasText()) return;
  const { md, userTitle } = sess;
  const t = userTitle && !/^#\s/.test(md.trim()) ? "# " + userTitle + "\n\n" + md.trim() + "\n" : md.trim() + "\n";
  save(slug(book().title) + ".md", t, "text/markdown");
}

export function initExport(): void {
  const sheet = $<HTMLDialogElement>("mkExport");
  $("mkExportBtn").addEventListener("click", () => { $("mkDlNote").textContent = ""; hooks.refresh(); openExport(); });
  $("mkExClose").addEventListener("click", closeExport);
  closeOnBackdrop(sheet, closeExport);
  $("mkDownload").addEventListener("click", downloadBook);
  $("mkEpub").addEventListener("click", downloadEpub);
  $("mkMdDl").addEventListener("click", downloadMd);
  $("mkPrint").addEventListener("click", () => { closeExport(); sess.preview.send({ type: "print" }); });
  $("mkOpenTab").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([bookHtml()], { type: "text/html" }));
    if (!window.open(url, "_blank")) toast("The browser blocked the new tab. Use Export instead.", true);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}
