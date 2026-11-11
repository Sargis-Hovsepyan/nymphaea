// Clicking in the preview. A paragraph shows "Add a picture after this paragraph"; a picture opens
// its card. Scrolling the preview marks the card for the picture being read.
import { plain } from "../inline";
import { inReach, readQuote } from "../compose/read";
import { describe, encode } from "../compose/spec";
import { NUM } from "../settings";
import { locate, shown, type Hit } from "../stage/locate";
import { state } from "../state";
import { drawVector, isVector, makeVector, type VecHandle } from "../renderers/vector";
import { $, book, hooks, narrow, sess } from "./session";
import { addPictureAfter, addPictureFrom, openCard, pNumber, redrawFrom, setHere } from "./pictures";
import { rowsHtml, rowsOfReading } from "./readout";
import { toast } from "./ui";
import { jumpEditor } from "./textPane";
import { closeInspector, inspect } from "./bookNav";
import { setPane } from "./ui";
import { cap, clip, esc } from "../text/strings";

let at = -1, snippet = "";

const hide = (): void => { at = -1; $("mkPick").hidden = true; };

/** Drop the bar if the paragraph it pointed at has changed or gone. */
export function checkPick(): void {
  if (at < 0) return;
  const b = book().blocks[at];
  if (!b || plain(b.text).slice(0, 60) !== snippet) hide();
}

function show(i: number, fig: number): void {
  const B = book(), b = B.blocks[i];
  if (!b) return;
  at = i; snippet = plain(b.text).slice(0, 60);
  const isFig = fig >= 0, heading = b.type === "h";
  $("mkPickText").textContent = isFig ? "Picture " + (fig + 1) + ", after paragraph " + pNumber(i)
    : heading ? "That’s a heading. Pictures go after a paragraph."
    : "Paragraph " + pNumber(i) + (B.scenes.some((s) => s.after === i) ? ", which has a picture" : "") + ": “" + (snippet.length > 44 ? snippet.slice(0, 44) + "…" : snippet) + "”";
  $("mkPickAdd").hidden = isFig || heading;
  $("mkPickEdit").hidden = false;
  $("mkPickEdit").textContent = isFig ? "Edit picture" : "Edit text";
  $("mkPickEdit").dataset.fig = String(fig);
  $("mkPick").hidden = false;
}

/** A click in the book: paragraph `block`, or picture number `fig` (-1 when it was a paragraph). */
export function onPick(block: number, fig = -1): void {
  const b = book().blocks[block];
  if (!b) return;
  show(block, fig);
  if (narrow()) return;
  if (fig >= 0) { hide(); setPane("manuscript", "pictures"); openCard(fig); inspect(fig); return; }
  closeInspector();
  if ($("mkWork").dataset.tab === "text" && b.type !== "h") jumpEditor(b.text);
}

export function onView(fig: number): void { setHere(fig); }

/* ---------------- a picture from chosen words ---------------- */
/** The words on offer: found in the manuscript, never the selection's own (re-typeset) characters. */
let words: { hit: Hit; after: number } | null = null;
/** "Choose other words" on picture k arms the bar: the next selection redraws that picture. */
let armed = -1;
let vec: VecHandle | null = null, raf = 0;

function closeWords(clearSel = true): void {
  if (!words && $("mkWords").hidden) return;
  words = null; cancelAnimationFrame(raf); raf = 0; vec = null;
  $("mkWords").hidden = true; $("mkWords").textContent = "";
  if (clearSel) sess.preview.send({ type: "span", from: 0, to: 0, text: "" });
}

/** The selection in the book changed: find those words in the manuscript and offer their picture. */
export function onSelect(from: number, to: number, text: string): void {
  if (!text || from < 0) { if (words && armed < 0) closeWords(false); return; }
  const B = book();
  let [h] = locate(B.blocks, text, { from: Math.max(0, from - 1), to: Math.min(B.blocks.length - 1, to + 1), limit: 1 });
  if (!h) [h] = locate(B.blocks, text, { limit: 1 });
  if (!h) return;
  hide();
  showWords(h);
}

/** Offer a picture of the words in `h` (from a selection or the find box). */
export function showWords(h: Hit): void {
  const B = book();
  const after = h.endBlock;
  if (!B.blocks[after]) return;
  words = { hit: h, after };
  const r = readQuote(B.blocks, h);
  const id = encode(r.spec);
  // The picture that already sits nearest after these words (its caption window reaches them).
  const near = armed >= 0 ? armed : B.scenes.findIndex((s) => inReach(h.startBlock, h.endBlock, s.after));
  const box = $("mkWords");
  const sty = isVector(state.settings.style) ? state.settings.style : "cut";
  box.innerHTML =
    `<header><b>${armed >= 0 ? "New words for picture " + (NUM[armed] || armed + 1) : "A picture of these words"}</b><span>¶ ${pNumber(h.startBlock)}${h.endBlock !== h.startBlock ? "–" + pNumber(h.endBlock) : ""}</span>` +
    `<button type="button" class="mk-icon" data-w="x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>` +
    `<div class="wd-b"><div class="wd-art"></div><div class="wd-t"><blockquote>${esc(clip(shown(h.exact), 160))}</blockquote>` +
    `<p class="wd-d">${esc(cap(describe(r.spec)))}.</p></div></div>` +
    `<dl class="wd-read">${rowsHtml(rowsOfReading(r))}</dl>` +
    `<div class="wd-acts">` +
    (armed >= 0 ? `<button type="button" class="btn primary" data-w="redraw" data-k="${armed}">Draw picture ${NUM[armed] || armed + 1} from these words</button>`
      : `<button type="button" class="btn primary" data-w="add">Add this picture after ¶ ${pNumber(after)}</button>` +
        (near >= 0 ? `<button type="button" class="btn" data-w="redraw" data-k="${near}">Redraw picture ${NUM[near] || near + 1} instead</button>` : "")) +
    `</div>`;
  const { wrap, vec: v } = makeVector(sty, id, cap(describe(r.spec)));
  box.querySelector(".wd-art")!.appendChild(wrap);
  vec = v;
  box.hidden = false;
  sess.preview.send({ type: "span", from: h.startBlock, to: h.endBlock, text: shown(h.exact) });
  const born = performance.now(), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  cancelAnimationFrame(raf);
  if (still) drawVector(v, sty, id, 1, 4);
  else {
    const frame = (now: number) => {
      if (!vec || vec !== v || box.hidden) { raf = 0; return; }
      drawVector(v, sty, id, Math.min(1, (now - born) / 1800), now / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
}

/** Picture k should be drawn from other words: wait for a selection. */
function armWords(k: number): void {
  armed = k;
  closeWords();
  const s = book().scenes[k];
  if (!s) { armed = -1; return; }
  sess.preview.send({ type: "scroll", block: s.after, picture: false });
  if (narrow()) return;
  toast("Select the words in the book that picture " + (NUM[k] || k + 1) + " should show.");
}

export function initPick(): void {
  hooks.armWords = armWords;
  $("mkWords").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-w]");
    if (!b || !words) return;
    const w = words;
    if (b.dataset.w === "x") { armed = -1; closeWords(); return; }
    if (b.dataset.w === "add") { closeWords(); addPictureFrom(w.after, w.hit.exact); }
    if (b.dataset.w === "redraw") {
      const k = +(b.dataset.k || -1), s = book().scenes[k];
      armed = -1; closeWords();
      if (!s) return;
      redrawFrom(k, w.hit);
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && words) { armed = -1; closeWords(); } });
  $("mkPickAdd").addEventListener("click", () => { if (at >= 0) { const i = at; hide(); addPictureAfter(i); } });
  $("mkPickEdit").addEventListener("click", () => {
    const fig = +($("mkPickEdit").dataset.fig || "-1"), b = book().blocks[at];
    if (fig >= 0) { setPane("manuscript", "pictures"); openCard(fig, true); }
    else if (b) jumpEditor(b.text);
  });
  $("mkPickX").addEventListener("click", hide);
}
