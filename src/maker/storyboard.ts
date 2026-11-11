// The Storyboard: every picture as a frame, grouped by chapter, with ghost frames where a strong
// passage has no picture. Click a frame to open its card, double-click to see it in the book.
import { decode } from "../compose/spec";
import { plain } from "../inline";
import { NUM } from "../settings";
import { captionFor } from "../stage/auto";
import type { SceneRef } from "../types";
import { showInBook } from "./goto";
import { addPictureAfter, composeFor, openCard, pNumber } from "./pictures";
import { $, book, hasText, plural, sess } from "./session";
import { chapterBlocks, currentSuggestions, groupByChapter, tagsOf, type Suggestion } from "./suggest";
import { thumb } from "./studio";
import { setPane } from "./ui";
import { registerView } from "./views";

type Item = { kind: "pic"; k: number; s: SceneRef } | { kind: "sugg"; s: Suggestion };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e;
};
const tag = (t: string): HTMLElement => el("span", "tag", t);
const roman = (n: number): string => NUM[n - 1] || String(n);

function thumbBox(s: SceneRef | null): HTMLElement {
  const th = el("span", "bd-th");
  const src = s && s.img && sess.images[s.img];
  if (src) { const im = document.createElement("img"); im.src = src; im.alt = ""; th.appendChild(im); }
  else if (s) th.innerHTML = thumb(s.scene);
  return th;
}

function picFrame(s: SceneRef, k: number): HTMLElement {
  const f = el("div", "bd-frame"); f.dataset.k = String(k);
  const open = el("button", "bd-open"); open.type = "button"; open.dataset.act = "open";
  open.setAttribute("aria-label", "Open picture " + (k + 1) + ": " + (s.caption || "no caption"));
  const sp = decode(s.scene);
  const tags = el("span", "bd-tags");
  tags.append(tag("¶ " + pNumber(s.after)), ...tagsOf(sp).map(tag));
  if (s.img && sess.images[s.img]) tags.append(tag("painted"));
  open.append(thumbBox(s), el("q", "bd-cap", s.caption || "No caption"), tags);
  const show = el("button", "bd-show", "Show in book"); show.type = "button"; show.dataset.act = "show";
  f.append(open, show);
  return f;
}

function ghostFrame(g: Suggestion): HTMLElement {
  const f = el("div", "bd-frame ghost"); f.dataset.b = String(g.block);
  const th = el("span", "bd-th");
  const add = el("button", "bd-add", "Add picture"); add.type = "button"; add.dataset.act = "add";
  add.setAttribute("aria-label", "Add a picture after paragraph " + pNumber(g.block));
  th.appendChild(add);
  let cap = "";
  try { cap = captionFor(book().blocks[g.block].text, composeFor(g.block)); } catch { /* no caption */ }
  const tags = el("span", "bd-tags");
  tags.append(el("span", "score", "strength " + g.strength.toFixed(2)), tag("¶ " + pNumber(g.block)), ...tagsOf(g.spec).slice(0, 3).map(tag));
  const body = el("div", "bd-body");
  body.append(el("q", "bd-cap", cap || plain(book().blocks[g.block].text).slice(0, 60)), tags);
  const show = el("button", "bd-show", "Show in book"); show.type = "button"; show.dataset.act = "show";
  f.append(th, body, show);
  return f;
}

function render(): void {
  const root = $("viewBoard"), B = book();
  root.textContent = "";
  root.classList.add("bd");
  if (!hasText()) {
    const e = el("div", "vw-empty");
    e.append(el("h3", "", "The storyboard shows every picture in order"), el("p", "", "Add a story first. Then place pictures, and each one appears here as a frame with its caption, grouped by chapter. Strong passages that have no picture show up as dashed frames you can add with one click."));
    root.appendChild(e); return;
  }
  const sugg = currentSuggestions();
  const items: Item[] = [...B.scenes.map((s, k): Item => ({ kind: "pic", k, s })), ...sugg.map((s): Item => ({ kind: "sugg", s }))];
  const at = (t: Item) => (t.kind === "pic" ? t.s.after : t.s.block);
  items.sort((a, b) => at(a) - at(b));
  const chapters = chapterBlocks(B.blocks);
  const groups = groupByChapter(B.blocks, chapters, items, at);
  const top = el("div", "bd-top");
  top.append(el("p", "bd-sum", plural(B.scenes.length, "picture") + (sugg.length ? ", " + sugg.length + " suggested" : "") + "."));
  if (!B.scenes.length) {
    const e = el("div", "vw-empty inline");
    e.append(el("h3", "", "No pictures yet"), el("p", "", "Place them automatically, or add one at a strong passage below. Click a frame to edit it, double-click to see it in the book."));
    const b = el("button", "btn", "Place automatically"); b.type = "button"; b.dataset.act = "auto";
    e.appendChild(b); top.appendChild(e);
  }
  root.appendChild(top);
  groups.forEach((g) => {
    if (!g.items.length && g.block < 0) return;
    const sec = el("section", "bd-sec");
    const h = el("div", "bd-h");
    const n = g.block < 0 ? "" : roman(chapters.indexOf(g.block) + 1);
    const h4 = el("h4"); if (n) h4.append(el("i", "", n)); h4.append(g.block < 0 ? (groups.length > 1 ? "Before the first chapter" : "The whole book") : g.title || "Untitled");
    const np = g.items.filter((t) => t.kind === "pic").length, ns = g.items.length - np;
    h.append(h4, el("span", "", plural(np, "picture") + (ns ? " · " + ns + " suggested" : "")));
    const grid = el("div", "bd-grid");
    if (!g.items.length) grid.appendChild(el("p", "bd-none", "No picture in this chapter yet."));
    g.items.forEach((t) => grid.appendChild(t.kind === "pic" ? picFrame(t.s, t.k) : ghostFrame(t.s)));
    sec.append(h, grid); root.appendChild(sec);
  });
}

export function initStoryboard(): void {
  const root = $("viewBoard");
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!b) return;
    const f = b.closest<HTMLElement>(".bd-frame"), act = b.dataset.act;
    if (act === "auto") { $("mkAuto").click(); return; }
    if (!f) return;
    if (act === "open") { const k = +(f.dataset.k || -1); if (e.detail > 1) return; setPane("manuscript", "pictures"); openCard(k); }
    else if (act === "show") { const s = f.dataset.k != null ? book().scenes[+f.dataset.k] : null; showInBook(s ? s.after : +(f.dataset.b || 0), !!s); }
    else if (act === "add") addPictureAfter(+(f.dataset.b || 0));
  });
  root.addEventListener("dblclick", (e) => {
    const f = (e.target as HTMLElement).closest<HTMLElement>(".bd-frame[data-k]");
    if (f) { const s = book().scenes[+(f.dataset.k || -1)]; if (s) showInBook(s.after, true); }
  });
  registerView("board", render);
}
