// The Studio's own palette: yellowed paper and sepia ink by default, or jet black, space gray and forest green in the dark. Not a book theme: it only dresses
// the app around the book. Same token names as a book palette so the shared styles just work,
// plus `raised` (cards, sheets) and `pollen` (the few places that need a second signal).
import { rgb, type Palette } from "./themes";

export interface StudioPalette extends Palette { raised: string; pollen: string }

export const STUDIO: { dark: StudioPalette; light: StudioPalette } = {
  dark: { desk: "#0a0a0b", panel: "#1d1f23", raised: "#272a2f", rule: "#33373d", ink: "#eceef0", muted: "#9aa0a8", accent: "#3f9a6b", accent2: "#7fcfa3", pollen: "#e0a645", hi: "#e6e8ea", lo: "#0a0a0b" },
  light: { desk: "#e8d9b0", panel: "#f3e7c6", raised: "#f9f0d8", rule: "#d3be8c", ink: "#2a1f12", muted: "#5a4628", accent: "#7a3a16", accent2: "#6b3414", pollen: "#8a5200", hi: "#f3e7c6", lo: "#2a1f12" },
};

export function studioVars(dark: boolean): Record<string, string> {
  const p = dark ? STUDIO.dark : STUDIO.light;
  return {
    "--desk": p.desk, "--panel": p.panel, "--raised": p.raised, "--ink": p.ink, "--muted": p.muted, "--rule": p.rule,
    "--accent": p.accent, "--accent2": p.accent2, "--pollen": p.pollen, "--hi": p.hi, "--lo": p.lo, "--room-rgb": rgb(p.desk).join(","),
  };
}
