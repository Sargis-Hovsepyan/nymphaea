// The Studio's own palette: night water (dark) and mist (light). Not a book theme: it only dresses
// the app around the book. Same token names as a book palette so the shared styles just work,
// plus `raised` (cards, sheets) and `pollen` (the few places that need a second signal).
import { rgb, type Palette } from "./themes";

export interface StudioPalette extends Palette { raised: string; pollen: string }

export const STUDIO: { dark: StudioPalette; light: StudioPalette } = {
  dark: { desk: "#0d1618", panel: "#121e21", raised: "#18272b", rule: "#223438", ink: "#e2ebe8", muted: "#8ea4a0", accent: "#a194ff", accent2: "#e6c158", pollen: "#e6c158", hi: "#dbe6e3", lo: "#0d1618" },
  light: { desk: "#e9efee", panel: "#f3f6f5", raised: "#fafbfb", rule: "#d3dddb", ink: "#122020", muted: "#4c5f5c", accent: "#5543d0", accent2: "#9a6f0c", pollen: "#9a6f0c", hi: "#f3f6f5", lo: "#122020" },
};

export function studioVars(dark: boolean): Record<string, string> {
  const p = dark ? STUDIO.dark : STUDIO.light;
  return {
    "--desk": p.desk, "--panel": p.panel, "--raised": p.raised, "--ink": p.ink, "--muted": p.muted, "--rule": p.rule,
    "--accent": p.accent, "--accent2": p.accent2, "--pollen": p.pollen, "--hi": p.hi, "--lo": p.lo, "--room-rgb": rgb(p.desk).join(","),
  };
}
