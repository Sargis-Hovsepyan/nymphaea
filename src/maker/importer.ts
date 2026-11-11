// Getting text in: files (dropped or chosen), pasted text, and the report that says what was done.
// A new file always starts a new book. The book being edited goes to the shelf first, untouched.
import { ACCEPT, importFiles } from "../import/files";
import { state } from "../state";
import { $, book, hasText, plural, sess, setMd, setMetaFields } from "./session";
import { newBook, landingOpen, showWork } from "./shelf";
import { rebuildText } from "./rebuild";

export function report(lines: string[], opts: { warn?: boolean; busy?: string; dismiss?: boolean } = {}): void {
  const r = landingOpen() ? $("mkLdReport") : $("mkReport");
  r.hidden = false; r.className = "mk-report" + (opts.warn ? " warn" : ""); r.textContent = "";
  if (opts.busy) {
    const p = document.createElement("div"); const dot = document.createElement("span"); dot.className = "mk-busy";
    p.append(dot, opts.busy); r.appendChild(p); return;
  }
  const [head, ...rest] = lines;
  const h = document.createElement("div"); h.textContent = head; r.appendChild(h);
  if (rest.length) { const ul = document.createElement("ul"); rest.forEach((l) => { const li = document.createElement("li"); li.textContent = l; ul.appendChild(li); }); r.appendChild(ul); }
  if (opts.dismiss) {
    const row = document.createElement("div"); row.className = "row";
    const a = document.createElement("button"); a.type = "button"; a.className = "btn"; a.textContent = "Dismiss"; a.onclick = () => { r.hidden = true; };
    row.appendChild(a); r.appendChild(row);
  }
}

function loadText(text: string, title: string, author = ""): void {
  sess.md = text; sess.userTitle = title; sess.meta = { subtitle: "", author, dedication: "" };
  setMd(sess.md);
  setMetaFields();
  state.book = { title: "", blocks: [], scenes: [], source: "auto" };
  rebuildText(true);
  sess.preview.send({ type: "top" });
}

export async function doImport(files: FileList | File[]): Promise<void> {
  if (!files.length) return;
  report([], { busy: "Reading " + (files.length === 1 ? files[0].name : files.length + " files") + "…" });
  try {
    const r = await importFiles(files, (s) => report([], { busy: s }));
    if (!r.markdown.trim()) {
      report(["No text found in that file.", "If it’s a scanned PDF, it holds pictures of pages rather than text. Copy the text from it and use Paste text instead."], { warn: true });
      return;
    }
    if (hasText()) await newBook();
    loadText(r.markdown, r.title, r.author || "");
    const B = book();
    $("mkLdReport").hidden = true;
    showWork("manuscript", "text");
    report(["Made “" + B.title + "”: " + plural(B.blocks.filter((b) => b.type !== "h").length, "paragraph") + " and " + plural(B.scenes.length, "picture") + ".", ...r.notes], { dismiss: true });
  } catch (e: any) {
    report([e && e.message === "none" ? "Those files aren’t a format Nymphaea reads (PDF, Word, EPUB, HTML, Markdown or text)." : "Couldn’t read that file.", "You can copy its text and use Paste text instead."], { warn: true });
  }
}

/** Wire the file picker, drag and drop. */
export function initImporter(): void {
  const fileIn = $<HTMLInputElement>("mkFiles");
  fileIn.accept = ACCEPT;
  fileIn.addEventListener("change", () => { if (fileIn.files) doImport(Array.from(fileIn.files)); fileIn.value = ""; });
  $("mkPaste").addEventListener("click", () => { showWork("manuscript", "text"); $("mkMd").focus(); });
  let depth = 0;
  const mk = sess.mk;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
  window.addEventListener("dragenter", (e) => { if (hasFiles(e)) { depth++; mk.classList.add("dragging"); } });
  window.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; mk.classList.remove("dragging"); } });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; mk.classList.remove("dragging");
    doImport(Array.from(e.dataTransfer!.files));
  });
}
