// Inside the Studio's preview iframe: wait for the Studio to send a book and settings, then render
// them with the normal reader. Nothing is stored; the reading position survives every update.
// It can also print the book and hand back finished-frame snapshots of the pictures (for EPUB).
import { goToPage } from "../layout/paged";
import { printBook } from "../layout/print";
import { STRUCTURAL, withDefaults } from "../settings";
import { isImageData } from "../ai/store";
import { guardScenes } from "../stage/guard";
import { state } from "../state";
import type { Book, Settings } from "../types";
import { applyLook } from "./look";
import { finishAll, redrawAll, renderBook, scrollToBlock, settingsChanged } from "./reader";
import { syncReaderPanel } from "./readerPanel";

export const PREVIEW_NS = "nymphaea-preview";

export type PreviewMsg =
  | { type: "ready" }
  | { type: "render"; book: Book; settings: Settings }
  | { type: "images"; images: Record<string, string> }
  | { type: "scroll"; block: number; picture?: boolean }
  | { type: "top" }
  | { type: "print" }
  | { type: "pick"; block: number; fig?: number }
  | { type: "view"; fig: number }
  | { type: "where"; block: number }
  | { type: "mark"; block: number; words: string[] }
  | { type: "snapshots"; id: number }
  | { type: "snapshots-done"; id: number; images: { after: number; cover?: boolean; png: string }[] };

/** Every picture as a PNG at its finished frame (canvas styles directly; vector styles rasterised). */
async function snapshots(): Promise<{ after: number; cover?: boolean; png: string }[]> {
  finishAll();
  const out: { after: number; cover?: boolean; png: string }[] = [];
  const nodes: [Element, number, boolean][] = [];
  const cover = document.querySelector("#coverArt");
  if (cover && !(cover as HTMLElement).hidden) nodes.push([cover, -1, true]);
  document.querySelectorAll("figure[data-after]").forEach((f) => nodes.push([f, +(f.getAttribute("data-after") || 0), false]));
  for (const [n, after, isCover] of nodes) {
    const cv = n.querySelector("canvas"), svg = n.querySelector("svg.vart") as SVGSVGElement | null, ph = n.querySelector("img.aiart") as HTMLImageElement | null;
    try {
      if (cv) out.push({ after, cover: isCover, png: cv.toDataURL("image/png") });
      else if (ph && ph.complete && ph.naturalWidth) {
        const c = document.createElement("canvas"); c.width = 960; c.height = 600;
        c.getContext("2d")!.drawImage(ph, 0, 0, 960, 600); out.push({ after, cover: isCover, png: c.toDataURL("image/png") });
      }
      else if (svg) out.push({ after, cover: isCover, png: await rasterise(svg) });
    } catch { /* skip a picture that can't be captured */ }
  }
  return out;
}

/** A live, CSS-styled SVG → PNG: copy computed paint onto each shape, then draw it. */
function rasterise(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement, src = svg.querySelectorAll("*"), dst = clone.querySelectorAll("*");
  src.forEach((s, i) => {
    const cs = getComputedStyle(s), d = dst[i] as SVGElement;
    ["fill", "stroke", "stroke-width", "opacity", "stroke-dasharray", "stroke-dashoffset", "display"].forEach((p) => d.setAttribute(p, cs.getPropertyValue(p)));
  });
  const bg = getComputedStyle(svg).backgroundColor;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg"); clone.setAttribute("width", "960"); clone.setAttribute("height", "600");
  clone.style.background = bg;
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = 960; c.height = 600;
      const x = c.getContext("2d")!; x.fillStyle = bg && bg !== "rgba(0, 0, 0, 0)" ? bg : getComputedStyle(document.body).backgroundColor; x.fillRect(0, 0, 960, 600);
      x.drawImage(img, 0, 0, 960, 600); res(c.toDataURL("image/png"));
    };
    img.onerror = () => rej(new Error("svg"));
    img.src = url;
  });
}

/** The Studio's "why this picture" marks: the words in a paragraph that the picture was read from.
 *  A CSS highlight over the text, so the words and the DOM stay exactly as they are. */
function markWords(block: number, list: string[]): void {
  const H = (globalThis as any).Highlight, reg = (CSS as any).highlights;
  if (!H || !reg) return;
  if (!document.getElementById("nyEvStyle")) {
    const st = document.createElement("style"); st.id = "nyEvStyle";
    st.textContent = "::highlight(ny-ev){background-color:rgba(63,154,107,.28);color:inherit}";
    document.head.appendChild(st);
  }
  const hl = new H();
  const want = list.map((w) => w.toLowerCase()).filter(Boolean);
  if (want.length) {
    const re = new RegExp("\\b(" + want.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\w{0,3}\\b", "gi");
    document.querySelectorAll(`[data-b="${block}"], [data-b="${block - 1}"]`).forEach((el) => {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const t = n.textContent || ""; re.lastIndex = 0;
        for (let m = re.exec(t); m; m = re.exec(t)) { const r = new Range(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); hl.add(r); }
      }
    });
  }
  reg.set("ny-ev", hl);
}

export function initPreviewChild(relayout: () => void): void {
  let lastBook = "", last: Settings | null = null;
  // Click a paragraph to tell the Studio which one (it jumps the editor there). Display-only.
  document.body.classList.add("pv-pick");
  document.addEventListener("click", (e) => {
    const t = e.target as Element | null;
    if (!t || !t.closest || t.closest("button, a, input, select, .studio, .bar, .scrim")) return;
    if (state.settings.layout === "paged") { const f = e.clientX / window.innerWidth; if (f > 0.8 || f < 0.2) return; }
    const fg = t.closest("figure[data-after]");
    if (fg) { window.parent.postMessage({ ns: PREVIEW_NS, type: "pick", block: +(fg.getAttribute("data-after") || 0), fig: Array.from(document.querySelectorAll("figure[data-after]")).indexOf(fg) }, "*"); return; }
    const el = t.closest("[data-b]");
    if (el) window.parent.postMessage({ ns: PREVIEW_NS, type: "pick", block: +(el.getAttribute("data-b") || 0) }, "*");
  });
  // Tell the Studio which picture is at the reading point (the one nearest the middle, else the last passed).
  let viewRaf = 0, viewed = -2;
  const reportView = () => {
    viewRaf = 0;
    const figs = Array.from(document.querySelectorAll("figure[data-after]")), H = window.innerHeight;
    let best = -1, bd = Infinity, passed = -1;
    figs.forEach((f, i) => {
      const r = f.getBoundingClientRect();
      if (r.bottom > 0 && r.top < H) { const d = Math.abs((r.top + r.bottom) / 2 - H / 2); if (d < bd) { bd = d; best = i; } }
      else if (r.bottom <= 0) passed = i;
    });
    const fig = best >= 0 ? best : passed;
    if (fig !== viewed) { viewed = fig; window.parent.postMessage({ ns: PREVIEW_NS, type: "view", fig }, "*"); }
    // and which paragraph sits at the reading line, for the Studio's chapter tabs
    const at = document.elementFromPoint(window.innerWidth / 2, H * 0.35)?.closest?.("[data-b]");
    const blk = at ? +(at.getAttribute("data-b") || 0) : -1;
    if (blk >= 0 && blk !== whereB) { whereB = blk; window.parent.postMessage({ ns: PREVIEW_NS, type: "where", block: blk }, "*"); }
  };
  let whereB = -1;
  const queueView = () => { if (!viewRaf) viewRaf = requestAnimationFrame(reportView); };
  window.addEventListener("scroll", queueView, { passive: true });
  window.addEventListener("resize", queueView);
  window.addEventListener("message", async (e) => {
    if (e.source !== window.parent) return;
    const d = e.data as ({ ns?: string } & PreviewMsg) | null;
    if (!d || d.ns !== PREVIEW_NS) return;
    if (d.type === "render") {
      const S = withDefaults(d.settings);
      const json = JSON.stringify(d.book);
      const structural = !last || (Object.keys(STRUCTURAL) as (keyof Settings)[]).some((k) => last![k] !== S[k]);
      const typeChanged = !last || last.pairing !== S.pairing || last.fontSize !== S.fontSize || last.measure !== S.measure || last.para !== S.para || last.align !== S.align;
      state.settings = S;
      applyLook(); syncReaderPanel();
      if (json !== lastBook || structural) {
        const y = window.scrollY, b = d.book;
        b.scenes = guardScenes(b.blocks, b.scenes || []).scenes;
        state.book = b;
        renderBook();
        window.scrollTo(0, y);
      } else {
        redrawAll(true);
        if (typeChanged) relayout();
        if (last) settingsChanged(last);
      }
      lastBook = json; last = { ...S };
    } else if (d.type === "images") {
      state.images = {};
      Object.keys(d.images || {}).forEach((k) => { if (isImageData(d.images[k])) state.images[k] = d.images[k]; });
      if (last) { const y = window.scrollY; renderBook(); window.scrollTo(0, y); }
    } else if (d.type === "scroll") scrollToBlock(d.block, d.picture);
    else if (d.type === "mark") markWords(d.block, d.words || []);
    else if (d.type === "top") { window.scrollTo(0, 0); if (state.settings.layout === "paged") goToPage(0); }
    else if (d.type === "print") printBook();
    else if (d.type === "snapshots") {
      const images = await snapshots();
      redrawAll(true);
      window.parent.postMessage({ ns: PREVIEW_NS, type: "snapshots-done", id: d.id, images }, "*");
    }
  });
  window.parent.postMessage({ ns: PREVIEW_NS, type: "ready" }, "*");
}
