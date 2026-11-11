// The room's light. Off · Lamp (a pool of light around the line being read) · Candle (narrower,
// warmer, it gutters) · Focus (every paragraph but the one being read falls back) · Story (the
// room takes the hour and weather of the passage: night dims and cools, dawn lifts, dusk warms).
// The lamp follows the pointer on desktop.
import type { Spec } from "../compose/spec";
import { flicker } from "../scenes/helpers";
import { moving, state } from "../state";
import { STORY_NEUTRAL, storyTarget, type Story } from "./place";

const docEl = document.documentElement;
let lx = 0.5, ly = 0.42, tx = 0.5, ty = 0.42;
export const finePointer = typeof matchMedia === "function" && matchMedia("(pointer:fine)").matches;
let isPanelOpen: () => boolean = () => false;
let wakeLoop: () => void = () => {};
let storyOf: () => Pick<Spec, "time" | "sky"> | null = () => null;
let cur: Element | null = null, lastFocus = 0, tinted = false;
const sc: Story = { ...STORY_NEUTRAL, rgb: [...STORY_NEUTRAL.rgb] };

/** The hour and weather at the reading point (set by the reader; read once per frame, never computed here). */
export function setStorySource(fn: () => Pick<Spec, "time" | "sky"> | null): void { storyOf = fn; }

export function initLight(panelOpen: () => boolean, wake: () => void = () => {}): void {
  isPanelOpen = panelOpen; wakeLoop = wake;
  window.addEventListener("pointermove", (e) => {
    if (!state.settings.follow || !finePointer) return;
    tx = e.clientX / window.innerWidth;
    ty = Math.min(0.85, Math.max(0.15, e.clientY / window.innerHeight));
    wakeLoop();
  }, { passive: true });
}

/** One frame of light. Returns true while it still has somewhere to go (so the loop keeps asking). */
export function lightStep(s: number): boolean {
  const S = state.settings;
  if (S.light === "off") {
    if (cur) { cur.classList.remove("cur"); cur = null; }
    if (tinted) { docEl.style.setProperty("--tm", "0"); tinted = false; }
    return false;
  }
  if (!S.follow || !finePointer) {
    tx = isPanelOpen() && window.innerWidth > 700 ? (window.innerWidth - 360) / 2 / window.innerWidth : 0.5;
    ty = 0.42;
  }
  lx += (tx - lx) * 0.06; ly += (ty - ly) * 0.06;
  let busy = moving() || Math.abs(tx - lx) > 0.0005 || Math.abs(ty - ly) > 0.0005;
  const sway = moving() ? Math.sin(s * 0.8) * 0.025 : 0;
  docEl.style.setProperty("--lx", ((lx + sway) * 100).toFixed(2) + "%");
  docEl.style.setProperty("--ly", (ly * 100).toFixed(2) + "%");
  const fl = moving() && S.flicker ? flicker(s) : 0;
  let dark = 0.82;
  if (S.light === "candle") dark = 0.88 + fl * 0.5 + (moving() ? Math.sin(s * 7.3) * 0.015 : 0);
  else if (S.light === "focus") dark = 0.4;
  else if (S.light === "story") {
    const t = storyTarget(storyOf());
    sc.dark += (t.dark - sc.dark) * 0.05; sc.tm += (t.tm - sc.tm) * 0.05;
    for (let k = 0; k < 3; k++) sc.rgb[k] += (t.rgb[k] - sc.rgb[k]) * 0.05;
    if (Math.abs(t.dark - sc.dark) > 0.002 || Math.abs(t.tm - sc.tm) > 0.002 || sc.rgb.some((c, k) => Math.abs(c - t.rgb[k]) > 1)) busy = true;
    docEl.style.setProperty("--tint", "rgb(" + sc.rgb.map(Math.round).join(",") + ")");
    docEl.style.setProperty("--tm", sc.tm.toFixed(3)); tinted = true;
    dark = sc.dark + fl * 0.3;
  }
  else dark += fl * 0.3;
  if (S.light !== "story" && tinted) { docEl.style.setProperty("--tm", "0"); tinted = false; }
  docEl.style.setProperty("--dark", Math.min(0.96, dark).toFixed(3));
  if (S.light === "focus" && s - lastFocus > 0.12) { lastFocus = s; focusAt(lx * window.innerWidth, ly * window.innerHeight); }
  else if (S.light !== "focus" && cur) { cur.classList.remove("cur"); cur = null; }
  return busy;
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
