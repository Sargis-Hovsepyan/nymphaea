// Settings → the page: palette tokens (theme × light/dark), the chosen type pairing and its fonts,
// the measure and leading, and body classes for every switch. No storage, no controls.
import { isDark, palette, paletteVars } from "../design/themes";
import { MEASURE, PAIRINGS, fontsHref, leading, normSize } from "../design/type";
import { FIGW, LEAD } from "../settings";
import { cueSupported } from "./place";
import { moving, state } from "../state";
import type { Settings } from "../types";

let forceLight = false;
/** Print always uses the light mood of the theme. */
export function setForceLight(v: boolean): void { forceLight = v; }

export function darkNow(S: Settings = state.settings): boolean {
  return !forceLight && isDark(S.mode);
}

const measured: Record<string, number> = {};

export function applyLook(S: Settings = state.settings): void {
  const docEl = document.documentElement, body = document.body, dark = darkNow(S);
  const vars = paletteVars(palette(S.theme, dark));
  Object.keys(vars).forEach((k) => docEl.style.setProperty(k, vars[k]));
  docEl.setAttribute("data-mode", dark ? "dark" : "light");
  docEl.style.colorScheme = dark ? "dark" : "light";

  const P = PAIRINGS[S.pairing] || PAIRINGS.literary, m = MEASURE[S.measure] || 66;
  docEl.style.setProperty("--font-text", P.body);
  docEl.style.setProperty("--font-display", P.display);
  docEl.style.setProperty("--feat", P.features);
  docEl.style.setProperty("--size", normSize(S.fontSize, P.xh) + "px");
  docEl.style.setProperty("--measure", String(m));
  docEl.style.setProperty("--cw", String(measured[S.pairing] || P.cw));
  docEl.style.setProperty("--lh", String(Math.round(leading(m, P.xh, S.align === "justify") * (LEAD[S.leading] || 1) * 1000) / 1000));
  docEl.style.setProperty("--fig", FIGW[S.size] || "290px");
  setFonts(S);

  const cls: Record<string, boolean> = {
    lit: S.light !== "off", motion: moving(), "cue-ok": cueSupported(), justify: S.align === "justify", "para-book": S.para === "book",
    paged: S.layout === "paged", hy: S.hyphens,
  };
  Object.keys(cls).forEach((c) => body.classList.toggle(c, cls[c]));
  const groups: [string, string][] = [["lt", S.light], ["rv", S.reveal], ["op", S.opening], ["layout", S.layout], ["orn", S.ornament], ["st", S.style], ["pic", S.pictures], ["cp", captionMode(S)],
    ["fr", S.frame], ["sz", S.size], ["pp", S.paper], ["chs", S.chapterStyle], ["pr", S.progress], ["cv", S.cover]];
  groups.forEach(([g, v]) => {
    Array.from(body.classList).forEach((c) => { if (c.startsWith(g + "-") && c !== g + "-" + v) body.classList.remove(c); });
    body.classList.add(g + "-" + v);
  });
  docEl.classList.toggle("snap", S.layout === "cards");
}

/** Cue needs the Custom Highlight API; without it the printed caption stands in. */
function captionMode(S: Settings): Settings["captions"] {
  return (S.captions === "cue" || S.captions === "both") && !cueSupported() ? "caption" : S.captions;
}

/** Load only the chosen pairing's fonts (one stylesheet link, swapped when the pairing changes). */
function setFonts(S: Settings): void {
  let link = document.getElementById("nyFonts") as HTMLLinkElement | null;
  if (!link) {
    link = document.querySelector('link[href^="https://fonts.googleapis.com"]') as HTMLLinkElement | null;
    if (link) link.id = "nyFonts";
  }
  const href = fontsHref(S.pairing);
  if (link && link.href !== href) link.href = href;
}

/**
 * Measure the real average advance of the chosen face on the author's own text, once its font has
 * loaded, so the measure (characters per line) holds for every face. Returns true if it changed.
 */
export async function refineMeasure(sample: string, S: Settings = state.settings): Promise<boolean> {
  const P = PAIRINGS[S.pairing] || PAIRINGS.literary, fam = P.body.split(",")[0];
  if (measured[S.pairing] || !sample || typeof document === "undefined" || !document.fonts) return false;
  try {
    await document.fonts.load("100px " + fam, sample.slice(0, 200));
    if (!document.fonts.check("100px " + fam)) return false;
    const c = document.createElement("canvas").getContext("2d");
    if (!c) return false;
    c.font = "100px " + P.body;
    const s = sample.slice(0, 3000), cw = c.measureText(s).width / s.length / 100;
    if (!(cw > 0.3 && cw < 0.8)) return false;
    measured[S.pairing] = Math.round(cw * 1000) / 1000;
    if (state.settings.pairing === S.pairing) document.documentElement.style.setProperty("--cw", String(measured[S.pairing]));
    return true;
  } catch { return false; }
}
