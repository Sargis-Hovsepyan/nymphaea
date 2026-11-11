// The four ways to look at the book in the Studio's centre: the live Book, a Storyboard of every
// picture, the Story line (hour, place, weather and mood across the text), and Compare (two looks
// side by side). Each view registers a renderer; only the visible one is drawn.
import { load, store } from "../store";
import { $ } from "./session";

export type View = "book" | "board" | "line" | "compare";
export const VIEWS: View[] = ["book", "board", "line", "compare"];
const KEY = "nymphaea-studio-view";
const renderers: Partial<Record<View, () => void>> = {};
const listeners: ((v: View) => void)[] = [];
let current: View = "book";

/** A view's renderer, called when it is shown and on every refresh while it is showing. */
export function registerView(v: View, render: () => void): void { renderers[v] = render; if (v === current) render(); }
/** Be told when the view changes. */
export function onViewChange(fn: (v: View) => void): void { listeners.push(fn); }
export const currentView = (): View => current;

export function setView(v: View): void {
  current = v;
  const w = $("mkWork");
  w.dataset.view = v;
  $("mkStage").hidden = v !== "book";
  document.querySelectorAll<HTMLElement>(".wk-view").forEach((el) => { el.hidden = el.dataset.v !== v; });
  document.querySelectorAll<HTMLElement>("#mkViews button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
  if (load<View>(KEY) !== v) store(KEY, v);
  renderers[v]?.();
  listeners.forEach((f) => f(v));
}

/** Redraw the visible view (after the book or the look changed). */
export function refreshView(): void { if (current !== "book") renderers[current]?.(); }

export function initViews(): void {
  $("mkViews").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (b && b.dataset.view) setView(b.dataset.view as View);
  });
  const saved = load<View>(KEY);
  setView(saved && VIEWS.includes(saved) ? saved : "book");
}
