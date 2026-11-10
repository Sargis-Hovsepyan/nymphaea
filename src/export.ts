// One HTML file = the book shell + the CSS + the engine + this book's data. The same builder makes
// the downloaded book and the Studio's live preview, so the preview is exactly what you download.
import { fontsHref } from "./design/type";
import type { Book, Settings } from "./types";


/** The lotus mark, so a downloaded book has its own tab icon. */
const FAVICON = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%23141210%22/%3E%3Cpath d=%22M16 7c3 4 3 9 0 15-3-6-3-11 0-15zM16 22c-4-1-8-4-9-9 4 0 7 3 9 9zm0 0c4-1 8-4 9-9-4 0-7 3-9 9z%22 fill=%22%23e0a645%22/%3E%3C/svg%3E";

export interface Pristine {
  /** The book shell markup (#shell), captured before anything touched it. */
  shell: string;
  css: string;
  /** The inlined engine (built single file only). */
  engine: string;
  /** Dev server only: the engine's module URL, used for the preview. */
  engineSrc?: string;
}

const BS = String.fromCharCode(92); // a backslash, spelled out so no tool rewrites the escape
const LINE_SEPS = new RegExp("[" + String.fromCharCode(0x2028, 0x2029) + "]", "g");

/** JSON that is safe inside a <script>: no "<" survives, so text can never close the tag. */
export function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, BS + "u003c").replace(LINE_SEPS, (c) => BS + "u" + c.charCodeAt(0).toString(16));
}

const SC = ["<", "/script>"].join(""); // built at runtime: the app file must contain exactly one closing script tag

export function canExport(p: Pristine): boolean { return !!p.engine; }

export function buildBookHtml(p: Pristine, book: Book | null, settings: Settings, opts: { preview?: boolean } = {}): string {
  const title = (book ? book.title : "Preview").replace(/[<>&"]/g, "");
  const data = opts.preview
    ? "window.__PREVIEW=true;window.__SETTINGS=" + scriptJson(settings) + ";"
    : "window.__BOOK=" + scriptJson(book) + ";window.__SETTINGS=" + scriptJson(settings) + ";";
  const engine = p.engine
    ? "<script type=\"module\">" + p.engine + SC
    : p.engineSrc ? "<script type=\"module\" src=\"" + p.engineSrc + "\">" + SC : "";
  return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
    + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
    + "<title>" + title + "</title>"
    + "<link rel=\"icon\" href=\"" + FAVICON + "\">"
    + "<link rel=\"stylesheet\" id=\"nyFonts\" href=\"" + fontsHref(settings.pairing) + "\">"
    + "<style>" + p.css + "</style></head><body>" + p.shell
    + "<script>" + data + SC + engine + "</body></html>";
}
