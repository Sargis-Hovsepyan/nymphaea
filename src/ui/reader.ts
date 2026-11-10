// Builds the book DOM from state.book and runs the animation loop. The words are laid out exactly as
// stored: chapters get their numerals and openers, a quote after a heading is set as an epigraph,
// verse keeps its lines, and every caption has passed the Guard.
import { APP_NAME } from "../brand";
import { PAIRINGS, numeral } from "../design/type";
import { THEMES } from "../design/themes";
import { appendInline, isBreak, plain } from "../inline";
import { R, readTokens, tok, type ArtItem } from "../renderers";
import { engrave, flow, riso, stipple } from "../renderers/print";
import { drawVector, isVector, makeVector } from "../renderers/vector";
import { H, W, clamp, flicker } from "../scenes/helpers";
import { SCENES } from "../scenes";
import { NUM } from "../settings";
import { dominant } from "../stage/auto";
import { autoBeats } from "../stage/beats";
import { guardScenes } from "../stage/guard";
import { SCENE_DESC, bestScene } from "../stage/keywords";
import { hash, moodOf } from "../stage/mood";
import { moving, state } from "../state";
import type { Block } from "../types";
import { darkNow, refineMeasure } from "./look";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const docEl = document.documentElement;
let items: ArtItem[] = [];
let io: IntersectionObserver | null = null, rio: IntersectionObserver | null = null;
const rendered: (() => void)[] = [];
let beatSet = new Set<number>();

export function onRendered(fn: () => void): void { rendered.push(fn); }

export function el<K extends keyof HTMLElementTagNameMap>(t: K, cls?: string | null, txt?: string | null): HTMLElementTagNameMap[K] {
  const e = document.createElement(t);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

export const LOTUS = "M16 7c3 4 3 9 0 15-3-6-3-11 0-15zM16 22c-4-1-8-4-9-9 4 0 7 3 9 9zm0 0c4-1 8-4 9-9-4 0-7 3-9 9z";
const FLEURON = "M16 4c2.5 3.2 2.5 6.4 0 9.6-2.5-3.2-2.5-6.4 0-9.6zM6 14c4 0 7 1.6 10 5-4 .4-7.4-1.2-10-5zm20 0c-2.6 3.8-6 5.4-10 5 3-3.4 6-5 10-5zM16 19.5c1.6 2.6 1.6 5.2 0 8.5-1.6-3.3-1.6-5.9 0-8.5z";

/** An ornament drawn in SVG: rule, fleuron (or lotus), rule. Ornaments style, and the end mark. */
function ornament(): HTMLDivElement {
  const d = el("div", "art orn");
  d.innerHTML = '<i aria-hidden="true"></i><svg viewBox="0 0 32 32" aria-hidden="true"><path d="' + (state.settings.ornament === "lotus" ? LOTUS : FLEURON) + '"/></svg><i aria-hidden="true"></i>';
  return d;
}

function makeArt(scene: string, label: string, opts: { invert?: boolean; text?: string } = {}): HTMLDivElement {
  const style = state.settings.style, invert = !!opts.invert;
  if (style === "orn" || style === "none") return ornament();
  if (isVector(style)) {
    const { wrap, vec } = makeVector(style, scene, label);
    items.push({ scene, t: 1, vis: true, seed: items.length * 1.7, style, invert, vec, node: wrap });
    return wrap;
  }
  const wrap = el("div", "art");
  const srcCv = document.createElement("canvas"); srcCv.width = W; srcCv.height = H;
  const it: ArtItem = {
    scene, t: 1, vis: true, seed: items.length * 1.7, style, invert,
    srcCv, src: srcCv.getContext("2d", { willReadFrequently: true })!, node: wrap,
  };
  if (style === "flow") { const m = moodOf(opts.text || scene); it.gen = { h: hash((opts.text || "") + scene), v: m.v, a: m.a }; }
  if (style === "ascii") {
    it.pre = el("pre"); it.pre.setAttribute("role", "img"); it.pre.setAttribute("aria-label", label); wrap.appendChild(it.pre);
  } else {
    const px = style === "dither", sc = px ? 1 : style === "riso" ? 2 : 3;
    const cv = el("canvas", px ? "px" : null);
    cv.width = W * sc; cv.height = H * sc; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", label);
    wrap.appendChild(cv); it.cv = cv; it.out = cv.getContext("2d")!;
  }
  items.push(it);
  return wrap;
}

function isBeat(b: Block, i: number): boolean {
  if (!state.settings.beats || b.type !== "p") return false;
  const beats = state.book.beats, len = plain(b.text).length;
  if (beats && beats.length) return beats.indexOf(i) >= 0 ? len <= 90 : len <= 18;
  return beatSet.has(i);
}

function dominantFromScenes(): string {
  const cnt: Record<string, number> = {};
  state.book.scenes.forEach((s) => { cnt[s.scene] = (cnt[s.scene] || 0) + 1; });
  return cnt.lamp ? "lamp" : bestScene(cnt) || "lamp";
}

/** Headings that already carry their own number ("Chapter One", "3", "IV. The Sea") get none. */
const NUMBERED = /^(chapter|part|book|episode|act|prologue|epilogue|interlude|afterword|foreword|preface|\d+\b|[ivxlcdm]+\b[.:)]?\s)/i;

export interface Chapter { i: number; title: string; num: string }
let chapterList: Chapter[] = [];
export function chapters(): Chapter[] { return chapterList; }

function lines(node: HTMLElement, text: string, attrib: boolean): void {
  text.split("\n").forEach((ln, k, all) => {
    if (attrib && k === all.length - 1 && k > 0 && /^[—―]/.test(ln)) { const a = el("span", "attr"); appendInline(a, ln, { micro: true }); node.appendChild(a); return; }
    if (k) node.appendChild(el("br"));
    appendInline(node, ln, { micro: true });
  });
}

export function renderBook(): void {
  const B = state.book, S = state.settings, text = $("text");
  items = []; if (io) io.disconnect(); if (rio) rio.disconnect();
  beatSet = autoBeats(B.blocks);
  $("barTitle").textContent = B.title;
  document.title = B.title + " · " + APP_NAME;

  // Cover: title (its last word in italic), subtitle, author; then the dedication.
  const h1 = $("coverTitle"); h1.textContent = "";
  const tw = B.title.split(" ");
  if (tw.length > 1) { h1.appendChild(document.createTextNode(tw.slice(0, -1).join(" ") + " ")); h1.appendChild(el("em", null, tw[tw.length - 1])); }
  else h1.textContent = B.title;
  const sub = document.getElementById("coverSub"), by = document.getElementById("coverBy"), ded = document.getElementById("ded");
  if (sub) { sub.textContent = B.subtitle || ""; sub.hidden = !B.subtitle; }
  if (by) { by.textContent = B.author || ""; by.hidden = !B.author; }
  if (ded) { ded.textContent = ""; ded.hidden = !B.dedication; if (B.dedication) { const p = el("p"); lines(p, B.dedication, false); ded.appendChild(p); } }

  const cov = $("coverArt"); cov.textContent = ""; cov.hidden = S.style === "none";
  if (S.style !== "none") {
    const cs = B.scenes.length ? B.cover || dominantFromScenes() : dominant(B.blocks);
    const a = makeArt(cs, SCENE_DESC[cs] || cs, { text: B.title });
    if (S.style === "orn") { a.classList.add("big"); cov.appendChild(a); }
    else { cov.appendChild(a.firstChild!); items[items.length - 1].node = cov; }
  }

  text.textContent = "";
  const scenes = guardScenes(B.blocks, B.scenes).scenes;
  const byAfter: Record<number, typeof scenes> = {};
  scenes.forEach((s) => { (byAfter[s.after] = byAfter[s.after] || []).push(s); });
  chapterList = [];
  let first = true, fig = 0, chn = 0, opener: HTMLElement | null = null;
  B.blocks.forEach((b, i) => {
    let node: HTMLElement;
    const prev = B.blocks[i - 1];
    if (b.type === "h" && (b.level || 1) === 1) {
      node = el("header", "ch");
      const own = NUMBERED.test(b.text), num = own ? "" : numeral(++chn, S.numerals);
      if (num) node.appendChild(el("span", "num", num));
      const h = el("h2"); appendInline(h, b.text, { micro: true }); node.appendChild(h);
      chapterList.push({ i, title: plain(b.text), num });
      first = true; opener = node;
    } else if (b.type === "h") {
      node = el(b.level === 2 ? "h3" : "h4"); appendInline(node, b.text, { micro: true }); first = true; opener = null;
    } else if (b.type === "quote") {
      const epi = !prev || prev.type === "h";
      node = el("blockquote", epi ? "q epi" : "q"); lines(node, b.text, true);
    } else if (b.type === "verse") {
      node = el("p", "verse"); lines(node, b.text, false); first = false;
    } else if (isBreak(b.text)) {
      // A scene break: the marks stay in the page for screen readers, drawn as the chosen ornament.
      node = el("p", "brk", b.text); node.setAttribute("role", "separator"); first = true;
    } else {
      let cls: string | null = null;
      if (first) { cls = "first"; first = false; }
      else if (isBeat(b, i)) cls = "beat" + (plain(b.text).split(/\s+/).length <= 2 ? " move" : "");
      node = el("p", cls); appendInline(node, b.text, { micro: true });
    }
    node.setAttribute("data-b", String(i));
    // An epigraph sits inside its chapter's opening card.
    if (b.type === "quote" && opener && prev && prev.type === "h") opener.appendChild(node);
    else text.appendChild(node);
    if (b.type !== "h" && b.type !== "quote") opener = null;
    if (S.style !== "none" && byAfter[i]) byAfter[i].forEach((s) => {
      const f = el("figure"); f.setAttribute("data-after", String(i));
      if (S.style === "orn") f.classList.add("orn-fig");
      f.appendChild(makeArt(s.scene, SCENE_DESC[s.scene] || s.scene, { text: b.text }));
      const cap = el("figcaption");
      cap.appendChild(el("b", null, NUM[fig] || String(fig + 1)));
      cap.appendChild(el("span", null, plain(s.caption || "")));
      f.appendChild(cap); text.appendChild(f); fig++;
    });
  });

  // The end: the lotus closes as you reach the last line; then the colophon.
  const end = el("div", "end");
  if (S.style !== "none" && S.style !== "orn") { const m = makeArt("lotus", "a water lily closing for the night", { invert: true }); m.classList.add("mark"); end.appendChild(m); }
  else end.appendChild(ornament());
  end.appendChild(el("span", null, "End"));
  const P = PAIRINGS[S.pairing] || PAIRINGS.literary;
  end.appendChild(el("p", "colophon", (B.author ? B.title + " by " + B.author + ". " : "") + "Set in " + P.note + ", in the " + (THEMES[S.theme] || THEMES.lamplight).name + " theme. Made with " + APP_NAME + "."));
  text.appendChild(end);

  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver((es) => es.forEach((e) => items.forEach((it) => { if (it.node === e.target) it.vis = e.isIntersecting; })), { rootMargin: "120px" });
    items.forEach((it) => io!.observe(it.node));
    revealFallback();
  }
  readTokens(!darkNow());
  items.forEach((it) => { it.t = moving() ? target(it) : it.invert ? 0 : 1; draw(it, 0); });
  rendered.forEach((fn) => fn());
  onScroll();
  const sample = B.blocks.filter((x) => x.type === "p").slice(0, 12).map((x) => plain(x.text)).join(" ");
  refineMeasure(sample).then((changed) => { if (changed) rendered.forEach((fn) => fn()); });
}

/** Browsers without scroll-driven animations (Firefox, Safari) reveal lines with an observer. */
function revealFallback(): void {
  const S = state.settings, body = document.body;
  const native = typeof CSS !== "undefined" && CSS.supports && CSS.supports("animation-timeline: view()");
  const want = !native && moving() && S.reveal !== "none" && S.layout !== "paged";
  body.classList.toggle("rv-js", want);
  if (!want) return;
  rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rio!.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".text > [data-b], .ch").forEach((n) => rio!.observe(n));
}

export function target(it: ArtItem): number {
  const r = it.node.getBoundingClientRect(), vh = window.innerHeight || 800, vw = window.innerWidth || 1200;
  if (state.settings.layout === "paged") return r.right > 0 && r.left < vw ? 1 : 0;
  return clamp((vh - r.top) / (vh * 0.55 + r.height * 0.4));
}

export function draw(it: ArtItem, tm: number): void {
  const S = state.settings, t = it.invert ? 1 - it.t : it.t;
  if (it.vec) { drawVector(it.vec, it.style, it.scene, t, tm + it.seed); return; }
  if (it.style === "flow") { flow(it, t, tm + it.seed, moving()); return; }
  const c = it.src!;
  SCENES[it.scene](c, t, tm + it.seed);
  if (S.light !== "off" && S.flicker && moving()) {
    const fl = flicker(tm);
    if (fl > 0) { c.fillStyle = "rgba(0,0,0," + fl + ")"; c.fillRect(0, 0, W, H); }
  }
  if (it.style === "glass") { R.glass(it); return; }
  const img = c.getImageData(0, 0, W, H);
  if (it.style === "engrave") engrave(it, img);
  else if (it.style === "stipple") stipple(it, img);
  else if (it.style === "riso") riso(it, img);
  else R[it.style as "dither" | "halftone" | "ascii"](it, img);
}

/** Redraw everything now (after a theme change, resize, etc.). */
export function redrawAll(resetWidths = false): void {
  readTokens(!darkNow());
  items.forEach((it) => { if (resetWidths) it.pw = 0; draw(it, performance.now() / 1000); });
}
/** Every picture at its finished frame (print, snapshots). */
export function finishAll(): void {
  readTokens(!darkNow());
  items.forEach((it) => { it.t = it.invert ? 0 : 1; draw(it, 0); });
}
export function resetWidths(): void { items.forEach((it) => { it.pw = 0; }); }
export { tok };

let last = 0;
export function startLoop(lightStep: (s: number) => void): void {
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const tm = now / 1000;
    if (state.settings.light !== "off") lightStep(tm);
    if (!moving() || now - last < 40) return;
    last = now;
    items.forEach((it) => {
      if (!it.vis) return;
      const tg = target(it);
      it.t += (tg - it.t) * 0.12;
      if (Math.abs(tg - it.t) < 0.002) it.t = tg;
      draw(it, tm);
    });
  };
  requestAnimationFrame(frame);
}

export function onScroll(): void {
  if (state.settings.layout === "paged") return;
  const prog = document.getElementById("prog"), pct = document.getElementById("pct");
  if (!prog || !pct) return;
  const h = docEl.scrollHeight - window.innerHeight, v = h > 0 ? clamp(window.scrollY / h) : 0;
  prog.style.width = v * 100 + "%";
  pct.textContent = Math.round(v * 100) + "%";
}

/** How far through the current chapter (scroll layouts), for the Dawn light. */
export function chapterProgress(): number {
  const chs = Array.from(document.querySelectorAll<HTMLElement>(".text .ch"));
  const y = window.scrollY + window.innerHeight * 0.4, top = (e: HTMLElement) => e.getBoundingClientRect().top + window.scrollY;
  let start = 0, end = docEl.scrollHeight;
  chs.forEach((c, k) => { const t = top(c); if (t <= y) { start = t; end = chs[k + 1] ? top(chs[k + 1]) : docEl.scrollHeight; } });
  return clamp((y - start) / Math.max(1, end - start));
}

/** Chapter tick marks on the progress line (scroll layouts). */
function ticks(): void {
  const line = document.querySelector(".bar .line");
  if (!line) return;
  line.querySelectorAll("b").forEach((b) => b.remove());
  if (state.settings.layout === "paged") return;
  const h = docEl.scrollHeight - window.innerHeight;
  if (h <= 0) return;
  document.querySelectorAll<HTMLElement>(".text .ch").forEach((c) => {
    const y = c.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
    const b = document.createElement("b"); b.style.left = clamp(y / h) * 100 + "%"; line.appendChild(b);
  });
}

/** Book and preview only: the Studio page has no book in it. */
export function initReader(): void {
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { items.forEach((it) => { it.pw = 0; if (!moving()) draw(it, 0); }); ticks(); });
  onRendered(() => setTimeout(ticks, 60));
}

let pagedGo: ((el: HTMLElement) => void) | null = null;
/** The pager registers how to bring an element into view. */
export function setPagedGo(fn: (el: HTMLElement) => void): void { pagedGo = fn; }

/** Bring a block (or the picture after it) to the reading line, or its page. */
export function scrollToBlock(i: number, picture = false): void {
  const t = document.querySelector<HTMLElement>(picture ? 'figure[data-after="' + i + '"]' : '[data-b="' + i + '"]')
    || document.querySelector<HTMLElement>('[data-b="' + i + '"]');
  if (!t) return;
  if (state.settings.layout === "paged") { if (pagedGo) pagedGo(t); return; }
  const r = t.getBoundingClientRect();
  window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.3, behavior: "auto" });
}
