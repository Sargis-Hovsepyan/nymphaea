// The Studio's own light and dark, and the little scene thumbnails drawn in its colours.
import { STUDIO, studioVars } from "../design/studio";
import { isDark, type Mode } from "../design/themes";
import { sceneThumb } from "../vscenes/model";
import { load, store } from "../store";

export const STUDIO_MODE = "nymphaea-studio-mode";
/** Light (yellowed paper) unless the author chose otherwise. */
export function studioMode(): Mode { const m = load<Mode>(STUDIO_MODE); return m === "dark" || m === "auto" ? m : "light"; }

const MODE_ICON: Record<Mode, string> = {
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z"/></svg>',
};

const thumbs = new Map<string, string>();
export const clearThumbs = (): void => thumbs.clear();

/** A scene's thumbnail as SVG markup, in the Studio's current colours. */
export function thumb(name: string): string {
  let t = thumbs.get(name);
  if (!t) {
    const p = isDark(studioMode()) ? STUDIO.dark : STUDIO.light;
    t = sceneThumb(name, { bg: p.desk, ink: p.ink, accent: p.accent, light: p.hi, mid: p.rule, dark: p.panel });
    if (thumbs.size > 400) thumbs.clear();
    thumbs.set(name, t);
  }
  return t;
}

export function applyStudio(onChange: () => void): void {
  const m = studioMode(), dark = isDark(m), vars = studioVars(dark), root = document.documentElement;
  Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]));
  root.setAttribute("data-mode", dark ? "dark" : "light");
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelectorAll<HTMLElement>(".mk-mode").forEach((b) => {
    b.setAttribute("aria-label", "Studio colours: " + m); b.title = "Studio colours: " + m + " (click to change)";
    b.dataset.mode = m; b.innerHTML = MODE_ICON[m];
  });
  thumbs.clear();
  onChange();
}

export function initStudioMode(onChange: () => void): void {
  applyStudio(onChange);
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (studioMode() === "auto") applyStudio(onChange); });
  document.querySelectorAll(".mk-mode").forEach((b) => b.addEventListener("click", () => {
    const order: Mode[] = ["light", "dark", "auto"], next = order[(order.indexOf(studioMode()) + 1) % 3];
    store(STUDIO_MODE, next); applyStudio(onChange);
  }));
}
