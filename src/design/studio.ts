// The Studio's own palette: jet black (60%), space gray (30%) and forest green (10%), dark first. Not a book theme: it only dresses
// the app around the book. Same token names as a book palette so the shared styles just work,
// plus `raised` (cards, sheets) and `pollen` (the few places that need a second signal).
import { rgb, type Palette } from "./themes";

export interface StudioPalette extends Palette { raised: string; pollen: string }

export const STUDIO: { dark: StudioPalette; light: StudioPalette } = {
  dark: { desk: "#0a0a0b", panel: "#1d1f23", raised: "#272a2f", rule: "#33373d", ink: "#eceef0", muted: "#9aa0a8", accent: "#3f9a6b", accent2: "#7fcfa3", pollen: "#e0a645", hi: "#e6e8ea", lo: "#0a0a0b" },
  light: { desk: "#cfd2d6", panel: "#f3f4f5", raised: "#fbfbfc", rule: "#c3c7cc", ink: "#0c0d0e", muted: "#50565e", accent: "#24603f", accent2: "#1d5a3a", pollen: "#9a6200", hi: "#f3f4f5", lo: "#0c0d0e" },
};

export function studioVars(dark: boolean): Record<string, string> {
  const p = dark ? STUDIO.dark : STUDIO.light;
  return {
    "--desk": p.desk, "--panel": p.panel, "--raised": p.raised, "--ink": p.ink, "--muted": p.muted, "--rule": p.rule,
    "--accent": p.accent, "--accent2": p.accent2, "--pollen": p.pollen, "--hi": p.hi, "--lo": p.lo, "--room-rgb": rgb(p.desk).join(","),
  };
}
