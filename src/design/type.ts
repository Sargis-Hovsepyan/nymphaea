// Type: nine curated pairings (body + display), and the arithmetic that sets them well: the line
// length is a number of characters, not pixels; sizes are matched by x-height so a switch of face
// keeps the apparent size; leading follows the measure and the face. Called by ui/look.ts, the
// export (only the chosen pair's fonts are loaded) and the Studio's specimen picker.

export type Pairing = "literary" | "classic" | "screen" | "modern" | "storybook" | "humanist" | "oldstyle" | "typewriter" | "clear";
export type Measure = "narrow" | "normal" | "wide";

export interface Pair {
  name: string;
  note: string;
  body: string;
  display: string;
  /** Google Fonts css2 family specs. */
  families: string[];
  /** x-height / em, for size matching. */
  xh: number;
  /** Average advance of English text, in em (refined at runtime by measuring the author's text). */
  cw: number;
  /** Old-style figures etc. */
  features: string;
}

const SERIF = ",Georgia,\"Times New Roman\",serif", SANS = ",system-ui,-apple-system,\"Segoe UI\",sans-serif";

export const PAIRINGS: Record<Pairing, Pair> = {
  literary: { name: "Literary", note: "Newsreader", body: "\"Newsreader\"" + SERIF, display: "\"Newsreader\"" + SERIF,
    families: ["Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400"], xh: 0.46, cw: 0.46, features: "\"kern\",\"liga\",\"onum\"" },
  classic: { name: "Classic", note: "EB Garamond · Cormorant", body: "\"EB Garamond\"" + SERIF, display: "\"Cormorant Garamond\",\"EB Garamond\"" + SERIF,
    families: ["EB+Garamond:ital,wght@0,400;0,500;1,400", "Cormorant+Garamond:ital,wght@0,500;1,500"], xh: 0.4, cw: 0.43, features: "\"kern\",\"liga\",\"onum\",\"dlig\"" },
  screen: { name: "Screen", note: "Literata, made for e-reading", body: "\"Literata\"" + SERIF, display: "\"Literata\"" + SERIF,
    families: ["Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;1,7..72,400"], xh: 0.47, cw: 0.5, features: "\"kern\",\"liga\"" },
  modern: { name: "Modern", note: "Source Serif · Source Sans", body: "\"Source Serif 4\"" + SERIF, display: "\"Source Sans 3\"" + SANS,
    families: ["Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400", "Source+Sans+3:wght@400;600"], xh: 0.475, cw: 0.49, features: "\"kern\",\"liga\"" },
  storybook: { name: "Storybook", note: "Spectral · Fraunces", body: "\"Spectral\"" + SERIF, display: "\"Fraunces\"" + SERIF,
    families: ["Spectral:ital,wght@0,400;0,500;1,400", "Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400"], xh: 0.41, cw: 0.5, features: "\"kern\",\"liga\",\"onum\"" },
  humanist: { name: "Humanist", note: "Alegreya · Alegreya Sans", body: "\"Alegreya\"" + SERIF, display: "\"Alegreya Sans\"" + SANS,
    families: ["Alegreya:ital,wght@0,400;0,500;1,400", "Alegreya+Sans:wght@400;500"], xh: 0.42, cw: 0.44, features: "\"kern\",\"liga\",\"onum\"" },
  oldstyle: { name: "Old Style", note: "Libre Caslon", body: "\"Libre Caslon Text\"" + SERIF, display: "\"Libre Caslon Display\",\"Libre Caslon Text\"" + SERIF,
    families: ["Libre+Caslon+Text:ital,wght@0,400;0,700;1,400", "Libre+Caslon+Display"], xh: 0.43, cw: 0.52, features: "\"kern\",\"liga\"" },
  typewriter: { name: "Typewriter", note: "Courier Prime", body: "\"Courier Prime\",\"Courier New\",monospace", display: "\"Courier Prime\",\"Courier New\",monospace",
    families: ["Courier+Prime:ital,wght@0,400;0,700;1,400"], xh: 0.43, cw: 0.6, features: "normal" },
  clear: { name: "Clear", note: "Atkinson Hyperlegible", body: "\"Atkinson Hyperlegible\"" + SANS, display: "\"Atkinson Hyperlegible\"" + SANS,
    families: ["Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400"], xh: 0.49, cw: 0.52, features: "\"kern\"" },
};

export const PAIRING_LIST = Object.keys(PAIRINGS) as Pairing[];

/** The book's own interface type (labels, the drawer), always loaded. */
const UI_FAMILIES = ["IBM+Plex+Mono:wght@400;500", "Instrument+Sans:wdth,wght@75..100,400..700"];

export function fontsHref(p: Pairing, opts: { text?: string; ui?: boolean } = {}): string {
  const fam = [...(PAIRINGS[p] || PAIRINGS.literary).families, ...(opts.ui === false ? [] : UI_FAMILIES)];
  return "https://fonts.googleapis.com/css2?" + fam.map((f) => "family=" + f).join("&")
    + (opts.text ? "&text=" + encodeURIComponent(opts.text) : "") + "&display=swap";
}

export const MEASURE: Record<Measure, number> = { narrow: 55, normal: 66, wide: 75 };

/** Reference x-height: Newsreader at the size the author picks. */
const XH_REF = 0.46;

/** The author's size, matched by x-height to the chosen face. */
export function normSize(px: number, xh: number): number {
  return Math.round(px * XH_REF / xh * 10) / 10;
}

/** Leading from the measure and the face: longer lines and larger x-heights need more air. */
export function leading(measure: number, xh: number, justified: boolean): number {
  const lh = 1.25 + 0.0045 * measure + 0.6 * (xh - 0.45) + (justified ? 0.03 : 0);
  return Math.round(Math.min(1.85, Math.max(1.35, lh)) * 1000) / 1000;
}

/** Number → chapter numeral in the chosen style. */
export type Numerals = "roman" | "words" | "arabic" | "none";
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
export function roman(n: number): string {
  const r: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let s = "";
  r.forEach(([v, k]) => { while (n >= v) { s += k; n -= v; } });
  return s;
}
export function numeral(n: number, style: Numerals): string {
  if (style === "none" || n < 1) return "";
  if (style === "arabic") return String(n);
  if (style === "roman") return roman(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10].toLowerCase() : "");
  return String(n);
}
