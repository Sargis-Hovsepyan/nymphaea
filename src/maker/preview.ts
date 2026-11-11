// The Studio's live preview: an iframe running the very same book file you download (built by
// buildBookHtml), fed the current book and settings by postMessage. What you see is what you get.
// It can also print the book and hand back snapshots of its pictures (for the EPUB).
import { buildBookHtml, type Pristine } from "../export";
import { PREVIEW_NS, type PreviewMsg } from "../ui/previewChild";
import type { Book, Settings } from "../types";

export type Snapshot = { after: number; cover?: boolean; png: string };

export interface Preview {
  render(book: Book, settings: Settings): void;
  send(msg: PreviewMsg): void;
  /** The AI pictures the book uses (sent only when they change, not with every keystroke). */
  images(map: Record<string, string>): void;
  snapshots(): Promise<Snapshot[]>;
}

export function createPreview(frame: HTMLIFrameElement, p: Pristine, settings: Settings, onPick?: (block: number, fig?: number) => void, onView?: (fig: number) => void, onWhere?: (block: number) => void): Preview {
  let ready = false, pending: PreviewMsg | null = null, timer = 0, seq = 0, imgs: Record<string, string> = {}, imgKey = "";
  const waiting = new Map<number, (s: Snapshot[]) => void>();
  const post = (m: PreviewMsg) => frame.contentWindow?.postMessage({ ns: PREVIEW_NS, ...m }, "*");
  const flush = () => { if (ready && pending) { post(pending); pending = null; } };

  window.addEventListener("message", (e) => {
    if (e.source !== frame.contentWindow) return;
    const d = e.data;
    if (!d || d.ns !== PREVIEW_NS) return;
    if (d.type === "ready") { ready = true; if (imgKey) post({ type: "images", images: imgs }); flush(); }
    if (d.type === "pick" && onPick) onPick(+d.block, typeof d.fig === "number" ? d.fig : -1);
    if (d.type === "view" && onView) onView(typeof d.fig === "number" ? d.fig : -1);
    if (d.type === "where" && onWhere) onWhere(+d.block);
    if (d.type === "snapshots-done") { const f = waiting.get(d.id); if (f) { waiting.delete(d.id); f(d.images || []); } }
  });
  frame.srcdoc = buildBookHtml(p, null, settings, { preview: true });

  return {
    render(book, s) {
      // Clone now: the Studio keeps editing its objects while the message waits.
      // (without the Studio's image prompts, which the book never shows)
      pending = { type: "render", book: JSON.parse(JSON.stringify({ ...book, scenes: book.scenes.map(({ prompt: _p, ...x }) => x) })), settings: { ...s } };
      clearTimeout(timer);
      timer = window.setTimeout(flush, 80);
    },
    images(map) {
      const k = Object.keys(map).sort().join(",");
      if (k === imgKey) return;
      imgKey = k; imgs = map;
      if (ready) post({ type: "images", images: map });
    },
    send(msg) {
      clearTimeout(timer); flush();
      if (ready) post(msg);
    },
    snapshots() {
      clearTimeout(timer); flush();
      if (!ready) return Promise.resolve([]);
      const id = ++seq;
      return new Promise((res) => {
        waiting.set(id, res);
        post({ type: "snapshots", id });
        setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); res([]); } }, 8000);
      });
    },
  };
}
