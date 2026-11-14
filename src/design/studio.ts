// The Studio's own palette, "Night pond": deep pond water, lily-pad green for what is chosen and a blue
// lotus for the actions, with a misty daylight version. Not a book theme: it only dresses
// the app around the book. Same token names as a book palette so the shared styles just work,
// plus `raised` (cards, sheets) and `pollen` (the few places that need a second signal).
import { rgb, type Palette } from "./themes";

export interface StudioPalette extends Palette { raised: string; pollen: string }

export const STUDIO: { dark: StudioPalette; light: StudioPalette } = {
  dark: { desk: "#0e1a24", panel: "#16262f", raised: "#1f3440", rule: "#2c4552", ink: "#e6eef0", muted: "#8fa6ad", accent: "#9cc4ff", accent2: "#7fb38a", pollen: "#e3b866", hi: "#e6eef0", lo: "#0e1a24" },
  light: { desk: "#dce5e9", panel: "#e9eff1", raised: "#f3f6f7", rule: "#bccbd1", ink: "#0f2431", muted: "#46606b", accent: "#2a5596", accent2: "#2f6b3d", pollen: "#8a5a00", hi: "#f3f6f7", lo: "#0f2431" },
};

export function studioVars(dark: boolean): Record<string, string> {
  const p = dark ? STUDIO.dark : STUDIO.light;
  return {
    "--desk": p.desk, "--panel": p.panel, "--raised": p.raised, "--ink": p.ink, "--muted": p.muted, "--rule": p.rule,
    "--accent": p.accent, "--accent2": p.accent2, "--pollen": p.pollen, "--hi": p.hi, "--lo": p.lo, "--room-rgb": rgb(p.desk).join(","),
  };
}
