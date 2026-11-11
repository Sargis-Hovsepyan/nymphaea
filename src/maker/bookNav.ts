// Finding your way around the book in the Studio: the chapter list in the left panel, the thumb
// index down the fore edge of the live book (one tab per chapter, as tall as the chapter is long,
// with a mark for every picture), and the picture inspector that shows which words drove a picture.
// Display only: nothing here changes the author's words.
import { namedWords, trackSpecs, type Named } from "../compose/read";
import { decode, describe, LABEL, SHOTS, type Spec } from "../compose/spec";
import { plain } from "../inline";
import { words } from "../stage/keywords";
import type { Block } from "../types";
import { composeFor, editSpec, GEN_ACTIONS, openCard, pNumber } from "./pictures";
import { checkpoint } from "./undo";
import { $, book, commitScenes, narrow, plural, sess } from "./session";
import { setPane } from "./ui";
import { setView } from "./views";

export interface Chapter { title: string; start: number; end: number; words: number; pics: number[] }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
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
const SHOT_NAME: Record<string, string> = { wide: "Wide", mid: "Nearer", close: "Close" };
const PRONOUNS = new Set(["i", "me", "my", "he", "him", "his", "she", "her", "hers", "we", "us", "our", "they", "them", "their", "you", "your", "it"]);
const KIND: [keyof Named, string][] = [["place", "Place"], ["props", "Things"], ["time", "Hour"], ["sky", "Weather"], ["season", "Season"], ["people", "People"], ["pose", "Doing"]];

export function closeInspector(): void {
  if (inspK < 0) return;
  inspK = -1; $("mkInsp").hidden = true;
  sess.preview.send({ type: "mark", block: -1, words: [] });
}

/** Open the inspector for picture k: what the text named, the shot, and quick changes. */
export function inspect(k: number): void {
  const B = book(), s = B.scenes[k];
  if (!s || narrow()) return;
  inspK = k;
  const sp = decode(s.scene);
  let rd: Spec | null = sp;
  if (!rd) { try { rd = trackSpecs(B.blocks)[s.after]; } catch { rd = null; } }
  const passage = [B.blocks[s.after - 1], B.blocks[s.after]].filter((b) => b && b.type !== "h").map((b) => b!.text).join(" ");
  const nw = namedWords(plain(passage));
  // Pronouns count people for the drawing but make poor evidence to show.
  nw.people = nw.people.filter((w) => !PRONOUNS.has(w.toLowerCase()));
  // The staged reading (place, hour, weather, season, things, figures), each with the words that named it.
  const val: Partial<Record<keyof Named, string>> = rd ? {
    place: rd.place === "inner" ? "" : LABEL.place[rd.place].replace(/^(a|an|the) /, ""), time: rd.time, sky: rd.sky === "clear" ? "" : rd.sky,
    season: rd.season === "none" ? "" : rd.season, props: rd.props.map((p) => LABEL.prop[p].replace(/^(a|an) /, "")).join(", "),
    people: rd.who ? String(rd.who) + (rd.who === 1 ? " figure" : " figures") : "", pose: rd.who && rd.pose !== "stand" ? LABEL.pose[rd.pose] : "",
  } : {};
  const rows = KIND.filter(([key]) => val[key] || nw[key].length).map(([key, label]) =>
    `<dt>${label}</dt><dd>${val[key] ? `<span class="v">${esc(val[key]!)}</span>` : ""}${nw[key].slice(0, 3).map((w) => `<span class="w">${esc(w)}</span>`).join("")}</dd>`).join("");
  const box = $("mkInsp");
  box.innerHTML = `<header><b>Picture ${k + 1}</b><span>¶ ${pNumber(s.after)}</span><button type="button" class="mk-icon" data-a="close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>` +
    (sp ? `<p class="in-d">${esc(cap(describe(sp)))}</p>` : `<p class="in-d">A drawn scene from the library.</p>`) +
    (rows ? `<dl class="in-f">${rows}</dl><p class="in-why">${KIND.some(([key]) => nw[key].length) ? "Green words are marked in the book. The rest is carried from the chapter around it." : "The passage names little, so the setting is carried from the chapter around it."}</p>` : "") +
    (sp ? `<div class="seg in-shot" role="group" aria-label="Shot">${SHOTS.map((v) => `<button type="button" data-shot="${v}" aria-pressed="${sp.shot === v}">${SHOT_NAME[v]}</button>`).join("")}</div>` : "") +
    `<div class="in-acts">${sp ? "" : `<button type="button" class="btn primary" data-a="compose" title="Draw this picture from what the passage says, with shot, vary and shuffle">Compose from the text</button>`}${sp ? GEN_ACTIONS.map((a) => `<button type="button" class="btn" data-g="${a.id}" title="${esc(a.title)}">${a.label}</button>`).join("") : ""}<button type="button" class="btn" data-a="card">Edit</button></div>`;
  box.hidden = false;
  const all = KIND.flatMap(([key]) => nw[key]);
  sess.preview.send({ type: "mark", block: s.after, words: all });
}
const cap = (t: string) => t ? t[0].toUpperCase() + t.slice(1) : t;

function onInspClick(e: Event): void {
  const t = (e.target as HTMLElement).closest("button"); if (!t || inspK < 0) return;
  const k = inspK;
  if (t.dataset.a === "close") return closeInspector();
  if (t.dataset.a === "compose") {
    const B = book(), s = B.scenes[k]; if (!s) return;
    checkpoint(); keepInsp = true;
    s.scene = composeFor(s.after); delete s.img; delete s.prompt;
    commitScenes(B.scenes); inspect(k); return;
  }
  if (t.dataset.a === "card") { setPane("manuscript", "pictures"); openCard(k, true); return; }
  keepInsp = true;
  if (t.dataset.shot) { editSpec(k, (sp: Spec) => ({ ...sp, shot: t.dataset.shot as Spec["shot"] })); inspect(k); return; }
  const g = GEN_ACTIONS.find((a) => a.id === t.dataset.g);
  if (g) { editSpec(k, g.run); inspect(k); }
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
