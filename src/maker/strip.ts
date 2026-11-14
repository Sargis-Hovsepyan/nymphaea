// The strip along the foot of the Studio: every picture in the book's order, chapter by chapter, with a
// bud wherever a strong passage has no picture yet. Selecting a frame opens that picture on the right.
// Display and navigation only: every change still goes through the picture functions and the Guard.
import type { SceneRef } from "../types";
import { chaptersOf } from "./bookNav";
import { showInBook } from "./goto";
import { $, book, hasText, painting, pkey, sess } from "./session";
import { currentSuggestions } from "./suggest";
import { thumb } from "./studio";
import { NUM } from "../settings";

export interface StripActions {
  select: (k: number, scrollBook: boolean) => void;
  add: (block: number) => void;
  remove: (k: number) => void;
  move: (k: number, dir: -1 | 1) => void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e;
};
const button = (cls: string, label: string): HTMLButtonElement => { const b = el("button", cls); b.type = "button"; b.setAttribute("aria-label", label); return b; };

function frame(s: SceneRef, k: number, sel: number, here: number, cover: boolean): HTMLButtonElement {
  const f = button("sp-f", "Picture " + (k + 1) + ": " + (s.caption || "no caption"));
  f.dataset.k = String(k);
  f.setAttribute("aria-pressed", String(k === sel));
  if (k === here) f.classList.add("here");
  if (cover) f.classList.add("is-cover");
  if (painting.has(pkey(s))) f.classList.add("busy");
  const th = el("span", "sp-th"), src = s.img && sess.images[s.img];
  if (src) { const im = document.createElement("img"); im.src = src; im.alt = ""; th.appendChild(im); }
  else th.innerHTML = thumb(s.scene);
  th.appendChild(el("i", "", String(k + 1)));
  // The pad (masked into its shape) sits in a wrapper, so the selection glow can follow that shape.
  const pad = el("span", "sp-pad"); pad.appendChild(th);
  f.append(pad, el("span", "sp-cap", s.caption || "No caption"));
  return f;
}

/** Draw the strip. `sel` is the picture being worked on, `here` the one the reader of the preview is at. */
export function renderStrip(sel: number, here: number, isCover: (s: SceneRef) => boolean): void {
  const row = $("mkStrip"), B = book();
  const had = row.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
  const focusK = had?.dataset.k, scroll = row.scrollLeft;
  row.textContent = "";
  if (!hasText()) { row.appendChild(el("p", "sp-empty", "Pictures float here once there is text.")); return; }
  const sugg = new Map(currentSuggestions().map((g) => [g.block, g]));
  if (!B.scenes.length) {
    const box = el("div", "sp-empty");
    box.append(el("p", "", "No pictures yet."));
    const ask = el("button", "btn primary", "✦ Stage with AI"); ask.type = "button"; ask.dataset.act = "ask";
    const auto = el("button", "btn", "Place automatically"); auto.type = "button"; auto.dataset.act = "auto";
    box.append(ask, auto);
    row.appendChild(box);
  }
  chaptersOf(B.blocks, B.scenes).forEach((c, ci) => {
    const ch = el("div", "sp-ch");
    const head = button("sp-cht", "Chapter " + (NUM[ci] || ci + 1) + ": " + c.title + ", show it in the book");
    head.dataset.b = String(c.start);
    head.append(el("i", "", NUM[ci] || String(ci + 1)), el("span", "", c.title));
    ch.appendChild(head);
    // Pictures and buds in the order of the text.
    const items: { at: number; node: HTMLElement }[] = c.pics.map((k) => ({ at: B.scenes[k].after, node: frame(B.scenes[k], k, sel, here, isCover(B.scenes[k])) }));
    for (let b = c.start; b <= c.end; b++) {
      if (!sugg.has(b)) continue;
      const g = button("sp-g", "Add a picture after paragraph " + (b + 1) + (sugg.get(b)!.strength >= 0.75 ? ", a strong moment" : ""));
      g.dataset.b = String(b); g.title = "A strong passage with no picture yet: add one";
      g.appendChild(el("span", "", "+"));
      items.push({ at: b + 0.5, node: g });
    }
    items.sort((x, y) => x.at - y.at).forEach((x) => ch.appendChild(x.node));
    row.appendChild(ch);
  });
  // One tab stop: the selected frame, else the first. Arrow keys move between the rest.
  const all = Array.from(row.querySelectorAll<HTMLElement>("button"));
  all.forEach((b) => { b.tabIndex = -1; });
  const stop = row.querySelector<HTMLElement>('.sp-f[aria-pressed="true"]') || row.querySelector<HTMLElement>(".sp-f") || all[0];
  if (stop) stop.tabIndex = 0;
  row.scrollLeft = scroll;
  if (focusK != null) row.querySelector<HTMLElement>('.sp-f[data-k="' + focusK + '"]')?.focus({ preventScroll: true });
  const on = row.querySelector<HTMLElement>('.sp-f[aria-pressed="true"]');
  if (on) on.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** The reading point in the preview is at picture k (-1 for none): mark its frame without redrawing. */
export function markHere(k: number): void {
  const row = $("mkStrip");
  row.querySelectorAll(".sp-f.here").forEach((f) => f.classList.remove("here"));
  const f = k >= 0 ? row.querySelector<HTMLElement>('.sp-f[data-k="' + k + '"]') : null;
  if (!f) return;
  f.classList.add("here");
  if (!row.contains(document.activeElement) && !row.querySelector('.sp-f[aria-pressed="true"]')) f.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function initStrip(act: StripActions): void {
  const row = $("mkStrip");
  const focusFrame = (k: number) => row.querySelector<HTMLElement>('.sp-f[data-k="' + k + '"]')?.focus();
  row.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button"); if (!b) return;
    if (b.dataset.act === "ask") $("mkAsk").click();
    else if (b.dataset.act === "auto") $("mkAuto").click();
    else if (b.classList.contains("sp-f")) act.select(+b.dataset.k!, true);
    else if (b.classList.contains("sp-g")) act.add(+b.dataset.b!);
    else if (b.classList.contains("sp-cht")) showInBook(+b.dataset.b!);
  });
  row.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement, list = Array.from(row.querySelectorAll<HTMLElement>("button")), i = list.indexOf(t);
    if (i < 0) return;
    const k = t.classList.contains("sp-f") ? +t.dataset.k! : -1;
    if (k >= 0 && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); act.move(k, e.key === "ArrowLeft" ? -1 : 1); return; }
    if (k >= 0 && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault(); act.remove(k);
      const n = book().scenes.length; if (n) focusFrame(Math.min(k, n - 1));
      return;
    }
    if (k >= 0 && e.key === "Enter") { e.preventDefault(); act.select(k, true); $("mkInsp").querySelector<HTMLElement>("button, select, input")?.focus(); return; }
    const to = e.key === "ArrowRight" ? Math.min(list.length - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    const n = list[to];
    if (n.classList.contains("sp-f")) { act.select(+n.dataset.k!, true); focusFrame(+n.dataset.k!); }
    else n.focus();
  });
}
