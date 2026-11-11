// Seven themes, each in a dark dim and a light dim mood. Nothing is pure white or pure black: warm
// greys, one accent (plus a second ink for two-colour styles) and hairline rules. Every palette is
// contrast-tested (tests/design.test.ts): body ≥ 7:1, muted ≥ 4.5:1, accent ≥ 3:1 on the page.

export type Theme = "parchment" | "lamplight" | "nocturne" | "vellum" | "sumi" | "moss" | "riso";
export type Mode = "auto" | "light" | "dark";

export interface Palette {
  /** The page. */ desk: string;
  /** Drawers and cards. */ panel: string;
  /** Body text. */ ink: string;
  /** Labels and captions. */ muted: string;
  /** Hairlines. */ rule: string;
  /** The one colour. */ accent: string;
  /** A second ink for two-colour styles (Riso, Generative). */ accent2: string;
  /** Picture highlight and shadow (the canvas renderers' two inks). */ hi: string; lo: string;
}

export const THEME_LIST: readonly Theme[] = ["parchment", "lamplight", "nocturne", "vellum", "sumi", "moss", "riso"];

export const THEMES: Record<Theme, { name: string; note: string; dark: Palette; light: Palette }> = {
  parchment: {
    name: "Parchment", note: "yellowed paper, sepia ink",
    dark: { desk: "#1e1810", panel: "#272015", ink: "#ecdfbd", muted: "#b0a07c", rule: "#3d3322", accent: "#d8a24c", accent2: "#a9b46e", hi: "#ecdfbd", lo: "#1e1810" },
    light: { desk: "#eedfb8", panel: "#f4e8c6", ink: "#2f2414", muted: "#5e4a2c", rule: "#d8c495", accent: "#8c3f17", accent2: "#5f6a2a", hi: "#f4e8c6", lo: "#2f2414" },
  },
  lamplight: {
    name: "Lamplight", note: "amber lamp, warm charcoal",
    dark: { desk: "#141210", panel: "#1b1916", ink: "#e6dfd0", muted: "#9d9686", rule: "#2f2b26", accent: "#e0a645", accent2: "#7f9cc9", hi: "#ece4d2", lo: "#141210" },
    light: { desk: "#ece6da", panel: "#f3eee4", ink: "#2a2620", muted: "#645c4f", rule: "#d5cdbd", accent: "#9a5418", accent2: "#3f5f8f", hi: "#f3eee4", lo: "#2a2620" },
  },
  nocturne: {
    name: "Nocturne", note: "moonlight, blue hour",
    dark: { desk: "#0e1424", panel: "#131b2e", ink: "#d9e2f2", muted: "#8b98b1", rule: "#232e47", accent: "#8fb4ff", accent2: "#d7b46a", hi: "#dfe8f8", lo: "#0e1424" },
    light: { desk: "#e3e7ee", panel: "#edf0f5", ink: "#1c2333", muted: "#565f73", rule: "#c8cfdb", accent: "#2f5cb0", accent2: "#8a6420", hi: "#edf0f5", lo: "#1c2333" },
  },
  vellum: {
    name: "Vellum", note: "cream and oxblood, a first edition",
    dark: { desk: "#1c1512", panel: "#241b17", ink: "#eadfcd", muted: "#a69683", rule: "#3a2e27", accent: "#df8a72", accent2: "#c9a85c", hi: "#eadfcd", lo: "#1c1512" },
    light: { desk: "#efe5d0", panel: "#f6eedc", ink: "#2e221a", muted: "#6a5947", rule: "#dccfb4", accent: "#8a2b22", accent2: "#7a5a1c", hi: "#f6eedc", lo: "#2e221a" },
  },
  sumi: {
    name: "Sumi", note: "ink wash and a red seal",
    dark: { desk: "#17181a", panel: "#1e2023", ink: "#e4e2dc", muted: "#9a9993", rule: "#2f3135", accent: "#e46d5f", accent2: "#9fb0a6", hi: "#e4e2dc", lo: "#17181a" },
    light: { desk: "#e9e6df", panel: "#f2efe9", ink: "#222220", muted: "#5f5d57", rule: "#d2cec5", accent: "#b23a2c", accent2: "#4c5e55", hi: "#f2efe9", lo: "#222220" },
  },
  moss: {
    name: "Moss", note: "forest night, lichen and ochre",
    dark: { desk: "#121713", panel: "#182019", ink: "#dfe5d6", muted: "#93a08c", rule: "#283228", accent: "#d4a84c", accent2: "#8fb59a", hi: "#e3e8da", lo: "#121713" },
    light: { desk: "#e6e8dc", panel: "#eff0e6", ink: "#232a22", muted: "#58624f", rule: "#cdd2c0", accent: "#7e5d12", accent2: "#3d6b4c", hi: "#eff0e6", lo: "#232a22" },
  },
  riso: {
    name: "Riso", note: "two inks on newsprint",
    dark: { desk: "#141a33", panel: "#1a2140", ink: "#ede6d8", muted: "#a0a6bf", rule: "#2b3358", accent: "#ff74ab", accent2: "#64abff", hi: "#ede6d8", lo: "#141a33" },
    light: { desk: "#ede8dc", panel: "#f5f1e6", ink: "#1f2340", muted: "#585d7b", rule: "#d5cfbf", accent: "#c81f63", accent2: "#1d5bcc", hi: "#f5f1e6", lo: "#1f2340" },
  },
};

export function palette(theme: Theme, dark: boolean): Palette {
  const t = THEMES[theme] || THEMES.lamplight;
  return dark ? t.dark : t.light;
}

/** Auto follows the system; outside a browser it is dark. */
export function isDark(mode: Mode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return !(typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches);
}

export function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2 relative luminance and contrast ratio. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Palette → CSS custom properties. */
export function paletteVars(p: Palette): Record<string, string> {
  return {
    "--desk": p.desk, "--panel": p.panel, "--ink": p.ink, "--muted": p.muted, "--rule": p.rule,
    "--accent": p.accent, "--accent2": p.accent2, "--hi": p.hi, "--lo": p.lo, "--room-rgb": rgb(p.desk).join(","),
  };
}
