// The landing page's drawing desk: a sentence in, a moving picture out. It uses the same reading
// (compose/read.ts) and drawing (compose/draw.ts) as every book, so what a visitor sees here is what
// their manuscript will get. Until the visitor types, a few lines write themselves to show the range.
// One animation loop, stopped whenever the landing is hidden or off screen.
import { namedWords, readSpec } from "../compose/read";
import { describe, encode, type Spec } from "../compose/spec";
import { rowsHtml, rowsOf } from "./readout";
import { drawVector, makeVector, type VecHandle } from "../renderers/vector";
import type { Style } from "../types";
import { cap } from "../text/strings";

const LINES = [
  "Smoke rose from the cottage chimney as the snow came down at dusk.",
  "She waited on the quay at night while the waves crashed against the harbour wall.",
  "A shooting star fell over the field, and the dog looked up.",
  "The candle flickered on the kitchen table beside the unopened letter.",
  "Gulls flew up from the beach as he ran along the shore in the wind.",
  "In the autumn garden the leaves were falling around the old bench.",
];

const BEAT_MS = 2600;

let mounted = false, style: Style = "cut", scene = "", line = "";
let vec: VecHandle | null = null, born = 0, raf = 0, visible = true, typed = false;
let auto = { i: 0, pos: 0, wait: 0, timer: 0 };
const still = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id: string) => document.getElementById(id)!;

function draw(text: string): void {
  line = text;
  const s = readSpec(text), id = encode(s);
  readout(text, s);
  if (id === scene && vec) return;
  scene = id;
  const plate = $("ldPlate");
  const { wrap, vec: v } = makeVector(style, id, cap(describe(s)));
  wrap.classList.add("ld-art");
  plate.replaceChildren(wrap);
  vec = v; born = performance.now();
  if (still()) drawVector(vec, style, scene, 1, 4);
  else start();
}

/** What the sentence named, kind by kind, with the words that named it. */
function readout(text: string, s: Spec): void {
  $("ldRead").innerHTML = text.trim() ? rowsHtml(rowsOf(s, namedWords(text))) : "";
}

function frame(now: number): void {
  raf = 0;
  if (!vec || !visible || $("mkLanding").hidden || document.hidden) return;
  drawVector(vec, style, scene, Math.min(1, (now - born) / BEAT_MS), now / 1000);
  raf = requestAnimationFrame(frame);
}
function start(): void { if (!raf && !still()) raf = requestAnimationFrame(frame); }

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
  if (mounted) { start(); if (!typed && !auto.timer) tick(); return; }
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
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe($("ldDesk"));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });
  if (still()) { input.value = LINES[0]; draw(LINES[0]); return; }
  draw("");
  auto.timer = window.setTimeout(tick, 700);
}
