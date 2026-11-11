// The landing page's drawing desk: a sentence in, a moving picture out. It uses the same reading
// (compose/read.ts) and drawing (compose/draw.ts) as every book, so what a visitor sees here is what
// their manuscript will get. Until the visitor types, a few lines write themselves to show the range.
// One player (renderers/player.ts): it stops whenever the landing is hidden or off screen.
import { namedWords, readSpec } from "../compose/read";
import { describe, encode, type Spec } from "../compose/spec";
import { rowsHtml, rowsOf } from "./readout";
import { player, reducedMotion, type Player } from "../renderers/player";
import type { Style } from "../types";
import { cap } from "../text/strings";

const LINES = [
  "She opened the door and stepped out into the rain.",
  "The train pulled into the station as the snow came down at dusk.",
  "A bird flew up from the fence as he walked along the road.",
  "The candle went out on the kitchen table.",
  "He gave her the letter, and she read it by the window.",
  "The sun rose over the sea and the gulls flew off the harbour wall.",
  "They embraced on the platform as the train left.",
];

let mounted = false, style: Style = "ink", scene = "", line = "", typed = false;
let pl: Player | null = null;
let auto = { i: 0, pos: 0, wait: 0, timer: 0 };
const still = reducedMotion;
const $ = (id: string) => document.getElementById(id)!;

function draw(text: string): void {
  line = text;
  const s = readSpec(text), id = encode(s);
  readout(text, s);
  if (id === scene) return;
  scene = id;
  pl = pl || player($("ldPlate"), { beatMs: 2600, className: "ld-art" });
  pl.set(style, id, cap(describe(s)));
}

/** What the sentence named, kind by kind, with the words that named it. */
function readout(text: string, s: Spec): void {
  $("ldRead").innerHTML = text.trim() ? rowsHtml(rowsOf(s, namedWords(text))) : "";
}


/* The lines that write themselves, until the visitor writes their own. */
function tick(): void {
  if (typed || $("mkLanding").hidden) { auto.timer = 0; return; }
  const input = $("ldLine") as HTMLInputElement, target = LINES[auto.i % LINES.length];
  if (auto.pos < target.length) {
    auto.pos = Math.min(target.length, auto.pos + 1 + (Math.random() < 0.3 ? 1 : 0));
    input.value = target.slice(0, auto.pos);
    // Redraw at each word, so the picture builds as the sentence does.
    if (/[\s,.]$/.test(input.value) || auto.pos === target.length) draw(input.value);
    auto.timer = window.setTimeout(tick, 34 + Math.random() * 40);
  } else {
    auto = { ...auto, i: auto.i + 1, pos: 0 };
    auto.timer = window.setTimeout(() => { if (!typed) { input.value = ""; tick(); } }, 5200);
  }
}

function setStyle(s: Style): void {
  style = s;
  $("ldStyles").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.style === s)));
  scene = ""; draw(line);
}

export function mountLanding(): void {
  if (mounted) { if (!typed && !auto.timer) tick(); return; }
  mounted = true;
  const input = $("ldLine") as HTMLInputElement;
  let deb = 0;
  const own = () => { if (!typed) { typed = true; clearTimeout(auto.timer); auto.timer = 0; input.value = ""; draw(""); } };
  input.addEventListener("pointerdown", own);
  input.addEventListener("keydown", (e) => { if (!typed && e.key !== "Tab" && e.key !== "Shift") own(); });
  input.addEventListener("input", () => { clearTimeout(deb); deb = window.setTimeout(() => draw(input.value), 220); });
  $("ldStyles").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-style]");
    if (b) setStyle(b.dataset.style as Style);
  });
  // A click on the picture plays it again.
  $("ldPlate").addEventListener("click", () => pl?.replay());
  if (still()) { input.value = LINES[0]; draw(LINES[0]); return; }
  draw("");
  auto.timer = window.setTimeout(tick, 700);
}
