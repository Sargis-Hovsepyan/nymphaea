// The room's light. Off · Lamp (a pool of light around the line being read) · Candle (narrower,
// warmer, it gutters) · Focus (every paragraph but the one being read falls back) · Dawn (the dark
// around the lamp lifts as each chapter goes on). The lamp follows the pointer on desktop.
import { flicker } from "../scenes/helpers";
import { moving, state } from "../state";

const docEl = document.documentElement;
let lx = 0.5, ly = 0.42, tx = 0.5, ty = 0.42;
export const finePointer = typeof matchMedia === "function" && matchMedia("(pointer:fine)").matches;
let isPanelOpen: () => boolean = () => false;
let progressOf: () => number = () => 0;
let cur: Element | null = null, lastFocus = 0;

/** How far through the current chapter the reader is, 0..1 (for Dawn). Set by the reader/pager. */
export function setProgressSource(fn: () => number): void { progressOf = fn; }

export function initLight(panelOpen: () => boolean): void {
  isPanelOpen = panelOpen;
  window.addEventListener("pointermove", (e) => {
    if (!state.settings.follow || !finePointer) return;
    tx = e.clientX / window.innerWidth;
    ty = Math.min(0.85, Math.max(0.15, e.clientY / window.innerHeight));
  }, { passive: true });
}

export function lightStep(s: number): void {
  const S = state.settings;
  if (S.light === "off") { if (cur) { cur.classList.remove("cur"); cur = null; } return; }
  if (!S.follow || !finePointer) {
    tx = isPanelOpen() && window.innerWidth > 700 ? (window.innerWidth - 360) / 2 / window.innerWidth : 0.5;
    ty = 0.42;
  }
  lx += (tx - lx) * 0.06; ly += (ty - ly) * 0.06;
  const sway = moving() ? Math.sin(s * 0.8) * 0.025 : 0;
  docEl.style.setProperty("--lx", ((lx + sway) * 100).toFixed(2) + "%");
  docEl.style.setProperty("--ly", (ly * 100).toFixed(2) + "%");
  const fl = moving() && S.flicker ? flicker(s) : 0;
  let dark = 0.82;
  if (S.light === "candle") dark = 0.88 + fl * 0.5 + (moving() ? Math.sin(s * 7.3) * 0.015 : 0);
  else if (S.light === "focus") dark = 0.4;
  else if (S.light === "dawn") dark = 0.05 + 0.8 * Math.pow(1 - Math.max(0, Math.min(1, progressOf())), 1.3) + fl * 0.2;
  else dark += fl * 0.3;
  docEl.style.setProperty("--dark", Math.min(0.96, dark).toFixed(3));
  if (S.light === "focus" && s - lastFocus > 0.12) { lastFocus = s; focusAt(lx * window.innerWidth, ly * window.innerHeight); }
  else if (S.light !== "focus" && cur) { cur.classList.remove("cur"); cur = null; }
}

/** Focus: the block at the reading point is the current one. */
function focusAt(x: number, y: number): void {
  const hit = document.elementFromPoint(Math.max(1, x), Math.max(1, y));
  let el: Element | null = hit && hit.closest(".text > [data-b], .ch");
  if (!el) {
    // Over a picture or a margin: the nearest block above or below the reading point.
    let best = Infinity;
    document.querySelectorAll(".text > [data-b], .text .ch").forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < best) { best = d; el = b; }
    });
  }
  if (!el || el === cur) return;
  if (cur) cur.classList.remove("cur");
  el.classList.add("cur"); cur = el;
}
