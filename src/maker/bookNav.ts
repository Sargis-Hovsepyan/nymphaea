// Finding your way around the book in the Studio: the thumb index down the fore edge of the live book
// (one tab per chapter, as tall as the chapter is long, with a mark for every picture), and the panel
// on the right for the open picture, which also shows which words drove it.
// Display only: nothing here changes the author's words.
import { namedWords, QUOTE_WINDOW, readQuoteAt, trackSpecs, type Named } from "../compose/read";
import { shown } from "../stage/locate";
import { rowsHtml, rowsOf, rowsOfReading } from "./readout";
import { decode, type Spec } from "../compose/spec";
import { plain } from "../inline";
import { words } from "../stage/keywords";
import type { Block } from "../types";
import { cardBody, composeFor, deselect, follow, openCard, pNumber, stopEditors } from "./pictures";
import { stage } from "./pictureEdit";
import { sceneLabel } from "../compose";
import { checkpoint } from "./undo";
import { $, book, commitScenes, hooks, plural, sess } from "./session";
import { setView } from "./views";
import { esc } from "../text/strings";

export interface Chapter { title: string; start: number; end: number; words: number; pics: number[] }

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

/** The book's chapters: "#" headings, else "##", else the whole book as one. Pure. */
export function chaptersOf(blocks: Block[], scenes: { after: number }[]): Chapter[] {
  const lvl = blocks.some((b) => b.type === "h" && b.level === 1) ? 1 : blocks.some((b) => b.type === "h" && (b.level || 1) <= 2) ? 2 : 0;
  const starts: number[] = [];
  blocks.forEach((b, i) => { if (lvl && b.type === "h" && (b.level || 1) <= lvl) starts.push(i); });
  if (!starts.length || starts[0] > 0 && blocks.slice(0, starts[0]).some((b) => b.type !== "h")) starts.unshift(0);
  return starts.map((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] - 1 : blocks.length - 1;
    const b = blocks[s];
    const title = b && b.type === "h" ? plain(b.text) : k === 0 ? (starts.length > 1 ? "Opening" : "The whole book") : "Part " + (k + 1);
    let w = 0; for (let i = s; i <= end; i++) w += words(blocks[i].text).length;
    const pics: number[] = [];
    scenes.forEach((sc, j) => { if (sc.after >= s && sc.after <= end) pics.push(j); });
    return { title, start: s, end, words: w, pics };
  });
}

let chs: Chapter[] = [], whereBlock = -1;

function goBlock(i: number, picture = false): void {
  setView("book");
  sess.preview.send({ type: "scroll", block: i, picture });
}

/** Where a block sits inside its chapter, 0..1 by words. */
function within(c: Chapter, i: number, blocks: Block[]): number {
  let w = 0; for (let j = c.start; j < i && j <= c.end; j++) w += words(blocks[j].text).length;
  return c.words ? Math.min(0.97, Math.max(0.03, w / c.words)) : 0.5;
}

export function renderNav(): void {
  const B = book();
  chs = chaptersOf(B.blocks, B.scenes);
  const total = B.blocks.reduce((a, b) => a + words(b.text).length, 0);
  const named = B.blocks.some((b) => b.type === "h") ? chs.length : 0;
  $("mkCounts").textContent = total ? plural(total, "word") + (named ? ", " + plural(named, "chapter") : "") + ", " + plural(B.scenes.length, "picture") : "";
  $("mkPicCount").textContent = B.scenes.length ? String(B.scenes.length) : "";

  // Thumb index: tabs as tall as their chapters, a mark per picture.
  const minW = Math.max(1, total * 0.04);
  $("mkThumb").innerHTML = chs.map((c, k) =>
    `<div class="tb" data-k="${k}" style="flex:${Math.max(minW, c.words)} 1 0"><button type="button" class="tb-t" data-k="${k}" aria-label="Chapter ${ROMAN[k] || k + 1}, ${esc(c.title)}">${ROMAN[k] || k + 1}</button>${
      c.pics.map((j) => { const s = B.scenes[j]; return `<button type="button" class="tb-p" data-j="${j}" style="top:${(within(c, s.after, B.blocks) * 100).toFixed(1)}%" aria-label="Picture ${j + 1}: ${esc(s.caption)}" data-tip="${esc(s.caption)}"></button>`; }).join("")}</div>`).join("");
  markWhere();
}

function markWhere(): void {
  const k = whereBlock < 0 ? 0 : chs.findIndex((c) => whereBlock >= c.start && whereBlock <= c.end);
  $("mkThumb").querySelectorAll(".tb").forEach((t) => t.classList.toggle("on", +(t as HTMLElement).dataset.k! === k));
}

/** The preview says which paragraph is at the reading line. */
export function onWhere(block: number): void { whereBlock = block; markWhere(); }
/** The paragraph at the reading line of the Book view (-1 before the text starts). */
export const readingBlock = (): number => whereBlock;

/* ---------------- the open picture, on the right ---------------- */
let inspK = -1, lastSig = "";
const PRONOUNS = new Set(["i", "me", "my", "he", "him", "his", "she", "her", "hers", "we", "us", "our", "they", "them", "their", "you", "your", "it"]);
let stopLib: (() => void) | null = null;
const stopInsp = () => { stopEditors(); stopLib?.(); stopLib = null; };

export function closeInspector(): void {
  const box = $("mkInsp");
  if (inspK < 0 && box.hidden) return;
  inspK = -1; lastSig = ""; box.hidden = true; delete box.dataset.k; stopInsp();
  $("mkWork").dataset.insp = "closed";
  sess.preview.send({ type: "mark", block: -1, words: [] });
  if (!$("mkWords").hidden) return;
  sess.preview.send({ type: "span", from: 0, to: 0, text: "" });
}

/**
 * Show picture k on the right: the picture playing with its tools, its caption and words, and what the
 * text named. Drawn again only when `sig` changes, so typing in the text doesn't restart the picture.
 */
export function inspect(k: number, sig = ""): void {
  const B = book(), s = B.scenes[k], box = $("mkInsp");
  if (!s) return;
  if (sig && sig === lastSig && inspK === k && !box.hidden) return;
  // Keep the keyboard and the scroll where they were through the redraw.
  const ae = document.activeElement as HTMLElement | null, inside = !!ae && box.contains(ae);
  const keep = inside && ae && !/^(INPUT|TEXTAREA)$/.test(ae.tagName) ? ["f", "pe", "field", "v", "a"].map((a) => ae.dataset[a] ? `[data-${a}="${ae.dataset[a]}"]` : "").join("") : "";
  const scroll = box.querySelector(".in-body")?.scrollTop || 0;
  inspK = k; lastSig = sig;
  stopInsp();
  const sp = decode(s.scene);
  let rd: Spec | null = sp;
  if (!rd) { try { rd = trackSpecs(B.blocks)[s.after]; } catch { rd = null; } }
  const passage = [B.blocks[s.after - 1], B.blocks[s.after]].filter((b) => b && b.type !== "h").map((b) => b!.text).join(" ");
  const nw = namedWords(plain(passage));
  // Pronouns count people for the drawing but make poor evidence to show.
  nw.people = nw.people.filter((w) => !PRONOUNS.has(w.toLowerCase()));
  const rq = s.quote && sp ? readQuoteAt(B.blocks, s.after, s.quote) : null;
  const named = rq ? rq.named.words : nw;
  const rows = rowsHtml(rq ? rowsOfReading(rq) : rd ? rowsOf(rd, nw) : [], 3);
  box.dataset.k = String(k);
  box.innerHTML = `<header><b>Picture ${k + 1}</b><span>Paragraph ${pNumber(s.after)}</span><button type="button" class="mk-icon" data-a="close" aria-label="Close the picture"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>` +
    `<div class="in-body"><div class="in-lib"></div>` +
    (sp ? "" : `<div class="in-acts"><button type="button" class="btn primary" data-a="compose" title="Draw this picture from what the passage says, so it can act it out">Compose from the text</button></div>`) +
    `</div>`;
  const body = box.querySelector<HTMLElement>(".in-body")!;
  // A drawn library scene has no editor: show it playing above its tools.
  if (!sp) stopLib = stage(box.querySelector<HTMLElement>(".in-lib")!, s.scene, null, sceneLabel(s.scene), { large: () => hooks.openLarge(k) }).stop;
  body.appendChild(cardBody(s, k));
  if (rows) body.insertAdjacentHTML("beforeend", `<details class="in-why"><summary>What the words named</summary><dl class="in-f layered">${rows}</dl></details>`);
  box.hidden = false;
  $("mkWork").dataset.insp = "open";
  body.scrollTop = scroll;
  if (keep) box.querySelector<HTMLElement>(keep + ":not(:disabled)")?.focus({ preventScroll: true });
  const all = (Object.keys(named) as (keyof Named)[]).flatMap((key) => named[key]).filter((w) => !PRONOUNS.has(w.toLowerCase()));
  sess.preview.send({ type: "mark", block: s.after, words: all });
  if (s.quote) { const parts = s.quote.split("\n"); sess.preview.send({ type: "span", from: Math.max(0, s.after - parts.length + 1 - QUOTE_WINDOW), to: s.after, text: shown(s.quote) }); }
}

function onInspClick(e: Event): void {
  const t = (e.target as HTMLElement).closest("button"); if (!t || inspK < 0 || !t.dataset.a) return;
  const k = inspK;
  if (t.dataset.a === "close") return deselect();
  if (t.dataset.a === "compose") {
    const B = book(), s = B.scenes[k]; if (!s) return;
    checkpoint();
    s.scene = composeFor(s.after, s.quote); delete s.img; delete s.prompt;
    follow(s);
    commitScenes(B.scenes);
  }
}

export function initNav(): void {
  $("mkThumb").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (!b) return;
    if (b.dataset.j) { const j = +b.dataset.j, s = book().scenes[j]; if (s) { goBlock(s.after, true); openCard(j); } return; }
    const c = chs[+b.dataset.k!]; if (c) goBlock(c.start);
  });
  $("mkInsp").addEventListener("click", onInspClick);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || inspK < 0 || document.querySelector("dialog[open]")) return;
    const t = e.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !$("mkInsp").contains(t)) return;
    deselect();
  });
}
