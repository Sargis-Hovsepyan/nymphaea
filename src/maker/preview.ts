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
  snapshots(): Promise<Snapshot[]>;
}

export function createPreview(frame: HTMLIFrameElement, p: Pristine, settings: Settings, onPick?: (block: number) => void): Preview {
  let ready = false, pending: PreviewMsg | null = null, timer = 0, seq = 0;
  const waiting = new Map<number, (s: Snapshot[]) => void>();
  const post = (m: PreviewMsg) => frame.contentWindow?.postMessage({ ns: PREVIEW_NS, ...m }, "*");
  const flush = () => { if (ready && pending) { post(pending); pending = null; } };

  window.addEventListener("message", (e) => {
    if (e.source !== frame.contentWindow) return;
    const d = e.data;
    if (!d || d.ns !== PREVIEW_NS) return;
    if (d.type === "ready") { ready = true; flush(); }
    if (d.type === "pick" && onPick) onPick(+d.block);
    if (d.type === "snapshots-done") { const f = waiting.get(d.id); if (f) { waiting.delete(d.id); f(d.images || []); } }
  });
  frame.srcdoc = buildBookHtml(p, null, settings, { preview: true });

  return {
    render(book, s) {
      // Clone now: the Studio keeps editing its objects while the message waits.
      pending = { type: "render", book: JSON.parse(JSON.stringify(book)), settings: { ...s } };
      clearTimeout(timer);
      timer = window.setTimeout(flush, 80);
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
