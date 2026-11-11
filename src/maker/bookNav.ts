// Finding your way around the book in the Studio: the chapter list in the left panel, the thumb
// index down the fore edge of the live book (one tab per chapter, as tall as the chapter is long,
// with a mark for every picture), and the picture inspector that shows which words drove a picture.
// Display only: nothing here changes the author's words.
import { namedWords, QUOTE_WINDOW, readQuoteAt, trackSpecs, type Named } from "../compose/read";
import { shown } from "../stage/locate";
import { rowsHtml, rowsOf, rowsOfReading } from "./readout";
import { decode, type Spec } from "../compose/spec";
import { plain } from "../inline";
import { words } from "../stage/keywords";
import type { Block } from "../types";
import { composeFor, editSpec, moveCard, openCard, pNumber, removePicture } from "./pictures";
import { pictureEditor, stage } from "./pictureEdit";
import { canMove } from "./pictureMove";
import { sceneLabel } from "../compose";
import { checkpoint } from "./undo";
import { $, book, commitScenes, hooks, narrow, plural, sess } from "./session";
import { setPane } from "./ui";
import { setView } from "./views";
import { cap, clip, esc } from "../text/strings";

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

let chs: Chapter[] = [], whereBlock = -1, lastSig = "", keepInsp = false;

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
  // The inspector points at a picture by number: close it when the pictures change under it.
  const sig = B.scenes.map((x) => x.after + "|" + x.scene).join(",");
  if (sig !== lastSig) { if (lastSig && inspK >= 0 && !keepInsp) closeInspector(); lastSig = sig; }
  keepInsp = false;
  const total = B.blocks.reduce((a, b) => a + words(b.text).length, 0);
  const named = B.blocks.some((b) => b.type === "h") ? chs.length : 0;
  $("mkCounts").textContent = total ? plural(total, "word") + (named ? " · " + plural(named, "chapter") : "") + " · " + plural(B.scenes.length, "picture") : "";
  $("mkChCount").textContent = String(chs.length);
  $("mkPicCount").textContent = B.scenes.length ? String(B.scenes.length) : "";

  // Chapter list: number, title, one pip per picture.
  $("mkChapters").innerHTML = chs.map((c, k) =>
    `<li><button type="button" data-k="${k}" aria-label="${esc(c.title)}, ${plural(c.pics.length, "picture")}"><i>${ROMAN[k] || k + 1}</i><span>${esc(c.title)}</span><b class="pips" aria-hidden="true">${c.pics.slice(0, 8).map(() => "<u></u>").join("")}${c.pics.length > 8 ? "+" : ""}</b></button></li>`).join("");

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
  $("mkChapters").querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(+b.dataset.k! === k)));
}

/** The preview says which paragraph is at the reading line. */
export function onWhere(block: number): void { whereBlock = block; markWhere(); }
/** The paragraph at the reading line of the Book view (-1 before the text starts). */
export const readingBlock = (): number => whereBlock;

/* ---------------- the picture inspector ---------------- */
let inspK = -1;
const PRONOUNS = new Set(["i", "me", "my", "he", "him", "his", "she", "her", "hers", "we", "us", "our", "they", "them", "their", "you", "your", "it"]);

export function closeInspector(): void {
  if (inspK < 0) return;
  inspK = -1; $("mkInsp").hidden = true; stopInsp();
  sess.preview.send({ type: "mark", block: -1, words: [] });
  if (!$("mkWords").hidden) return;
  sess.preview.send({ type: "span", from: 0, to: 0, text: "" });
}

/** Open the inspector for picture k: the picture playing, what the text named, and the same editor as its card. */
export function inspect(k: number): void {
  const B = book(), s = B.scenes[k];
  if (!s || narrow()) return;
  inspK = k;
  stopInsp();
  const sp = decode(s.scene);
  let rd: Spec | null = sp;
  if (!rd) { try { rd = trackSpecs(B.blocks)[s.after]; } catch { rd = null; } }
  const passage = [B.blocks[s.after - 1], B.blocks[s.after]].filter((b) => b && b.type !== "h").map((b) => b!.text).join(" ");
  const nw = namedWords(plain(passage));
  // Pronouns count people for the drawing but make poor evidence to show.
  nw.people = nw.people.filter((w) => !PRONOUNS.has(w.toLowerCase()));
  // The staged reading (place, hour, weather, season, things, figures, motion, acts), each with the words that named it.
  const rq = s.quote && sp ? readQuoteAt(B.blocks, s.after, s.quote) : null;
  const named = rq ? rq.named.words : nw;
  const list = rq ? rowsOfReading(rq) : rd ? rowsOf(rd, nw) : [];
  const rows = rowsHtml(list, 3);
  const box = $("mkInsp");
  const mv = canMove(B.blocks, s);
  box.innerHTML = `<header><b>Picture ${k + 1}</b><span>Paragraph ${pNumber(s.after)}</span><button type="button" class="mk-icon" data-a="close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>` +
    `<div class="in-body">` +
    (s.quote ? `<blockquote class="in-q">${esc(clip(shown(s.quote), 180))}</blockquote>` : "") +
    `<div class="in-ed"></div>` +
    (rows ? `<details class="in-why"><summary>What the words named</summary><dl class="in-f layered">${rows}</dl></details>` : "") +
    `<div class="in-acts">${sp ? "" : `<button type="button" class="btn primary" data-a="compose" title="Draw this picture from what the passage says">Compose from the text</button>`}` +
    `<button type="button" class="btn" data-a="words" title="Select the words in the book this picture should show">${s.quote ? "Other words" : "Choose words"}</button>` +
    `<button type="button" class="btn quiet" data-a="up"${mv.up ? "" : " disabled"} title="Move up one paragraph">Up</button><button type="button" class="btn quiet" data-a="down"${mv.down ? "" : " disabled"} title="Move down one paragraph">Down</button>` +
    `<button type="button" class="btn quiet" data-a="remove">Remove</button><button type="button" class="btn quiet" data-a="card">In the list</button></div></div>`;
  const host = box.querySelector<HTMLElement>(".in-ed")!;
  if (sp) {
    const ed = pictureEditor(s.scene, sp, {
      edit: (fn) => { keepInsp = true; editSpec(k, fn); inspect(k); },
      reread: () => decode(composeFor(s.after, s.quote)),
      large: () => hooks.openLarge(k),
      mark: () => sess.preview.send({ type: "mark", block: s.after, words: named.act }),
    });
    host.appendChild(ed.el); stopEd = ed.stop;
  } else {
    stopEd = stage(host, s.scene, null, sceneLabel(s.scene), { large: () => hooks.openLarge(k) }).stop;
  }
  box.hidden = false;
  const all = (Object.keys(named) as (keyof Named)[]).flatMap((key) => named[key]).filter((w) => !PRONOUNS.has(w.toLowerCase()));
  sess.preview.send({ type: "mark", block: s.after, words: all });
  if (s.quote) { const parts = s.quote.split("\n"); sess.preview.send({ type: "span", from: Math.max(0, s.after - parts.length + 1 - QUOTE_WINDOW), to: s.after, text: shown(s.quote) }); }
}

let stopEd: (() => void) | null = null;
const stopInsp = () => { stopEd?.(); stopEd = null; };

function onInspClick(e: Event): void {
  const t = (e.target as HTMLElement).closest("button"); if (!t || inspK < 0 || !t.dataset.a) return;
  const k = inspK;
  if (t.dataset.a === "close") return closeInspector();
  if (t.dataset.a === "compose") {
    const B = book(), s = B.scenes[k]; if (!s) return;
    checkpoint(); keepInsp = true;
    s.scene = composeFor(s.after, s.quote); delete s.img; delete s.prompt;
    commitScenes(B.scenes); inspect(k); return;
  }
  if (t.dataset.a === "card") { setPane("manuscript", "pictures"); openCard(k, true); return; }
  if (t.dataset.a === "words") { closeInspector(); hooks.armWords(k); return; }
  if (t.dataset.a === "remove") { closeInspector(); removePicture(k); return; }
  if (t.dataset.a === "up" || t.dataset.a === "down") {
    const id = book().scenes[k].scene;
    keepInsp = true; moveCard(k, t.dataset.a === "up" ? -1 : 1);
    const n = book().scenes.findIndex((x) => x.scene === id);
    inspect(n >= 0 ? n : k);
  }
}

export function initNav(): void {
  $("mkChapters").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (!b) return;
    const c = chs[+b.dataset.k!]; if (c) goBlock(c.start);
  });
  $("mkThumb").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (!b) return;
    if (b.dataset.j) { const s = book().scenes[+b.dataset.j]; if (s) { goBlock(s.after, true); inspect(+b.dataset.j); } return; }
    const c = chs[+b.dataset.k!]; if (c) goBlock(c.start);
  });
  $("mkInsp").addEventListener("click", onInspClick);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && inspK >= 0) closeInspector(); });
}
