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
import { sceneFn } from "../scenes";
import { sceneLabel } from "../compose";
import { beatIndexes, coverScene, hasOwnNumber, showsScene } from "../book/structure";
import { trackSpecs } from "../compose/read";
import type { Spec } from "../compose/spec";
import { NUM } from "../settings";
import { dominant } from "../stage/auto";
import { guardScenes } from "../stage/guard";
import { bestScene } from "../stage/keywords";
import { hash, moodOf } from "../stage/mood";
import { moving, pictureMoves, state } from "../state";
import { load, store } from "../store";
import type { Block, SceneRef, Settings } from "../types";
import { darkNow, refineMeasure } from "./look";
import { cueBlock, cueSupported, decodePos, encodePos, lastFigureBefore, leftLabel, paceAdd, paceOf, pastOpening, quoteRange, wordCount, type PaceStat, type Pos } from "./place";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const docEl = document.documentElement;
let items: ArtItem[] = [];
let io: IntersectionObserver | null = null, rio: IntersectionObserver | null = null;
const rendered: (() => void)[] = [];
let beatSet = new Set<number>();
// Reading point: words before each block, the spec in force at each block (read once per render),
// the block under the reading line, and the reader's measured pace.
let wordCum: number[] = [0], blockEls: HTMLElement[] = [], blockIdx: number[] = [], hint = 0;
let specAt: (Spec | null)[] = [], specFor: Block[] | null = null, readB = 0;
let pace: PaceStat = { w: 0, ms: 0 };
export interface Fig { after: number; num: string; caption: string }
let figList: Fig[] = [];
export function figures(): Fig[] { return figList; }
/** Does the book show pictures at all, for this reader? (Marks and the contact sheet follow it.) */
export const figuresShown = (): boolean => state.settings.style !== "none" && state.settings.pictures !== "off";

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

/** The AI picture for an image id, if the book has one. */
function photoFor(id?: string): HTMLImageElement | undefined {
  const src = id && state.images[id];
  if (!src) return undefined;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  return img;
}

function makeArt(scene: string, label: string, opts: { invert?: boolean; text?: string; img?: string } = {}): HTMLDivElement {
  const style = state.settings.style, invert = !!opts.invert;
  if (style === "orn" || style === "none") return ornament();
  const photo = photoFor(opts.img);
  // Vector styles and Generative show the AI picture itself, toned by CSS to sit in the look.
  if (photo && (isVector(style) || style === "flow")) {
    const wrap = el("div", "art photo");
    photo.className = "aiart " + style; photo.alt = label;
    wrap.appendChild(photo);
    items.push({ scene, t: 1, vis: true, seed: items.length * 1.7, style, invert, photo, node: wrap });
    return wrap;
  }
  if (isVector(style)) {
    const { wrap, vec } = makeVector(style, scene, label);
    items.push({ scene, t: 1, vis: true, seed: items.length * 1.7, style, invert, vec, node: wrap });
    return wrap;
  }
  const wrap = el("div", "art");
  const srcCv = document.createElement("canvas"); srcCv.width = W; srcCv.height = H;
  const it: ArtItem = {
    scene, t: 1, vis: true, seed: items.length * 1.7, style, invert,
    srcCv, src: srcCv.getContext("2d", { willReadFrequently: true })!, node: wrap, photo,
  };
  if (photo) photo.onload = () => draw(it, performance.now() / 1000);
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
  return beatSet.has(i);
}

function dominantFromScenes(list: SceneRef[]): string {
  const cnt: Record<string, number> = {};
  list.forEach((s) => { cnt[s.scene] = (cnt[s.scene] || 0) + 1; });
  return cnt.lamp ? "lamp" : bestScene(cnt) || "lamp";
}

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
  beatSet = beatIndexes(B.blocks, B.beats);
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

  const scenes = guardScenes(B.blocks, B.scenes).scenes;
  const cov = $("coverArt"); cov.textContent = ""; cov.hidden = S.style === "none" || S.cover !== "picture";
  let cs = "";
  if (S.style !== "none" && S.cover === "picture") {
    // The cover never repeats the first picture when there are others to choose from.
    cs = B.scenes.length ? coverScene(scenes, dominantFromScenes(scenes), B.cover) : B.cover || dominant(B.blocks);
    const a = makeArt(cs, sceneLabel(cs), { text: B.title });
    if (S.style === "orn") { a.classList.add("big"); cov.appendChild(a); }
    else { cov.appendChild(a.firstChild!); items[items.length - 1].node = cov; }
  }

  text.textContent = "";
  const byAfter: Record<number, typeof scenes> = {};
  scenes.forEach((s) => { (byAfter[s.after] = byAfter[s.after] || []).push(s); });
  chapterList = []; figList = [];
  let first = true, fig = 0, chn = 0, opener: HTMLElement | null = null;
  const figure = (s: SceneRef, i: number): HTMLElement => {
    const f = el("figure"); f.setAttribute("data-after", String(i));
    if (S.style === "orn") f.classList.add("orn-fig");
    f.appendChild(makeArt(s.scene, sceneLabel(s.scene), { text: B.blocks[i].text, img: s.img }));
    if (s.img && state.images[s.img]) f.classList.add("has-photo");
    const num = NUM[fig] || String(fig + 1), cue = cueBlock(B.blocks, i, s.caption || "");
    if (cue >= 0) f.setAttribute("data-cue", String(cue));
    const cap = el("figcaption");
    cap.appendChild(el("b", null, num));
    cap.appendChild(el("span", null, plain(s.caption || "")));
    f.appendChild(cap); fig++;
    figList.push({ after: i, num, caption: plain(s.caption || "") });
    return f;
  };
  // Head frame: a chapter's first picture is lifted into its opening, above the title.
  const heads = new Map<SceneRef, number>(), headOf = new Map<number, SceneRef>();
  if (S.frame === "head" && S.style !== "none") {
    const hs = B.blocks.map((b, i) => (b.type === "h" && (b.level || 1) === 1 ? i : -1)).filter((i) => i >= 0);
    hs.forEach((h, k) => {
      const end = k + 1 < hs.length ? hs[k + 1] : B.blocks.length;
      const pick = scenes.filter((s) => s.after >= h && s.after < end).sort((a, b) => a.after - b.after)[0];
      if (pick) { heads.set(pick, h); headOf.set(h, pick); }
    });
  }
  B.blocks.forEach((b, i) => {
    let node: HTMLElement;
    const prev = B.blocks[i - 1];
    if (b.type === "h" && (b.level || 1) === 1) {
      node = el("header", "ch");
      const hp = headOf.get(i);
      if (hp) { const f = figure(hp, hp.after); f.classList.add("head"); node.appendChild(f); }
      const own = hasOwnNumber(b.text), num = own ? "" : numeral(++chn, S.numerals);
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
    if (S.style !== "none" && byAfter[i]) byAfter[i].forEach((s) => { if (!heads.has(s)) text.appendChild(figure(s, i)); });
  });

  // The end: the lotus closes as you reach the last line; then the colophon.
  const end = el("div", "end");
  // The lotus closes the book only if no picture already shows one.
  if (S.style !== "none" && S.style !== "orn" && cs !== "lotus" && !showsScene(scenes, "lotus")) { const m = makeArt("lotus", "a water lily closing for the night", { invert: true }); m.classList.add("mark"); end.appendChild(m); }
  else end.appendChild(ornament());
  end.appendChild(el("span", null, "End"));
  const P = PAIRINGS[S.pairing] || PAIRINGS.literary;
  end.appendChild(el("p", "colophon", (B.author ? B.title + " by " + B.author + ". " : "") + "Set in " + P.note + ", in the " + (THEMES[S.theme] || THEMES.lamplight).name + " theme. Made with " + APP_NAME + "."));
  text.appendChild(end);

  // Words before each block, and the hour and weather in force at each (computed once per render).
  wordCum = [0]; B.blocks.forEach((b, i) => { wordCum.push(wordCum[i] + (b.type === "h" || isBreak(b.text) ? 0 : wordCount(b.text))); });
  if (specFor !== B.blocks) { specAt = fillSpecs(trackSpecs(B.blocks)); specFor = B.blocks; }
  blockEls = Array.from(text.querySelectorAll<HTMLElement>(":scope > [data-b]"));
  blockIdx = blockEls.map((e) => +(e.getAttribute("data-b") || 0)); hint = 0;

  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver((es) => { es.forEach((e) => items.forEach((it) => { if (it.node === e.target) it.vis = e.isIntersecting; })); wake(); }, { rootMargin: "120px" });
    items.forEach((it) => io!.observe(it.node));
    revealFallback();
  }
  readTokens(!darkNow());
  items.forEach((it) => { it.t = pictureMoves() ? target(it) : it.invert ? 0 : 1; if (S.pictures !== "off") draw(it, 0); });
  cues();
  rendered.forEach((fn) => fn());
  if (boot) { const b = boot; boot = null; b(); }
  onScroll();
  remeasure();
  wake();
}

/** The last spec seen at or before each block, so any reading point has an hour and a sky. */
function fillSpecs(list: (Spec | null)[]): (Spec | null)[] {
  let last: Spec | null = null;
  return list.map((s) => (last = s || last));
}

/** Measure the real face on the author's own words (once its font has loaded), then lay out again. */
export function remeasure(): void {
  const sample = state.book.blocks.filter((x) => x.type === "p").slice(0, 12).map((x) => plain(x.text)).join(" ");
  refineMeasure(sample).then((changed) => { if (changed) rendered.forEach((fn) => fn()); });
}

/** Browsers without scroll-driven animations (Firefox, Safari) reveal lines with an observer. */
function revealFallback(): void {
  const S = state.settings, body = document.body;
  const native = typeof CSS !== "undefined" && CSS.supports && CSS.supports("animation-timeline: view()");
  const want = !native && moving() && S.reveal !== "none" && S.layout !== "paged" && "IntersectionObserver" in window;
  body.classList.toggle("rv-js", want);
  if (rio) { rio.disconnect(); rio = null; }
  if (!want) return;
  rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rio!.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".text > [data-b], .ch").forEach((n) => { if (!n.classList.contains("in")) rio!.observe(n); });
}

/** After any setting changed outside a rebuild: do what that setting needs, once. */
export function settingsChanged(prev: Settings): void {
  const S = state.settings;
  if (prev.reveal !== S.reveal) revealFallback();
  if (prev.captions !== S.captions || prev.pictures !== S.pictures) cues();
  if (prev.pictures !== S.pictures) { applyPictures(); rendered.forEach((fn) => fn()); }
  if (prev.pairing !== S.pairing) remeasure();
  wake();
}

/** The system's reduced motion preference flipped: the reveal, the pictures and the loop follow it. */
export function motionChanged(): void { revealFallback(); applyPictures(); wake(); }

/** Pictures On, Still or Off: put every picture at the frame that choice calls for. */
function applyPictures(): void {
  readTokens(!darkNow());
  if (state.settings.pictures === "off") return;
  items.forEach((it) => { it.t = pictureMoves() ? target(it) : it.invert ? 0 : 1; draw(it, pictureMoves() ? performance.now() / 1000 : 0); });
}

export function target(it: ArtItem): number {
  const r = it.node.getBoundingClientRect(), vh = window.innerHeight || 800, vw = window.innerWidth || 1200;
  if (state.settings.layout === "paged") return r.right > 0 && r.left < vw ? 1 : 0;
  return clamp((vh - r.top) / (vh * 0.55 + r.height * 0.4));
}

export function draw(it: ArtItem, tm: number): void {
  const S = state.settings, t = it.invert ? 1 - it.t : it.t;
  if (it.vec) { drawVector(it.vec, it.style, it.scene, t, tm + it.seed); return; }
  if (it.photo && !it.src) {
    // A slow push-in as the beat arrives: the picture settles into place, it never jumps.
    const e = clamp(t), s = 1.12 - 0.12 * e, y = (1 - e) * 2.5;
    it.photo.style.transform = "translateY(" + y.toFixed(2) + "%) scale(" + s.toFixed(4) + ")";
    it.photo.style.opacity = (0.35 + 0.65 * e).toFixed(3);
    return;
  }
  if (it.style === "flow") { flow(it, t, tm + it.seed, pictureMoves()); return; }
  const c = it.src!;
  if (it.photo) drawPhoto(c, it.photo, t);
  else sceneFn(it.scene)(c, t, tm + it.seed);
  if (S.light !== "off" && S.flicker && pictureMoves()) {
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

/** An AI picture as the style's greyscale source: cover-fit, with the same slow push-in. */
function drawPhoto(c: CanvasRenderingContext2D, img: HTMLImageElement, t: number): void {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.fillStyle = "rgb(8,8,8)"; c.fillRect(0, 0, W, H);
  if (!img.complete || !img.naturalWidth) return;
  const e = clamp(t), z = 1.12 - 0.12 * e;
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * z, dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  c.globalAlpha = 0.35 + 0.65 * e;
  c.drawImage(img, (W - dw) / 2, (H - dh) / 2 + (1 - e) * H * 0.025, dw, dh);
  c.globalAlpha = 1;
}

/** Redraw everything now (after a theme change, resize, etc.). */
export function redrawAll(resetWidths = false): void {
  readTokens(!darkNow());
  if (state.settings.pictures === "off") return;
  items.forEach((it) => { if (resetWidths) it.pw = 0; draw(it, performance.now() / 1000); });
}
/** Every picture at its finished frame (print, snapshots). */
export function finishAll(): void {
  readTokens(!darkNow());
  items.forEach((it) => { it.t = it.invert ? 0 : 1; draw(it, 0); });
}
export function resetWidths(): void { items.forEach((it) => { it.pw = 0; }); }
export { tok };

// ---- the loop: frames are asked for only while something needs one ---------------------------
let raf = 0, lastLight = 0, lastPics = 0, lightFn: ((s: number) => boolean) | null = null;
const slowAt = new WeakMap<ArtItem, number>();

/** Ask for a frame (scroll, resize, a setting, a picture coming into view). A running loop is left alone. */
export function wake(): void {
  if (!raf && lightFn && !document.hidden) raf = requestAnimationFrame(frame);
}

function frame(now: number): void {
  raf = 0;
  const tm = now / 1000;
  let more = false;
  if (state.settings.light === "off") lightFn!(tm);
  else if (now - lastLight >= 32) { lastLight = now; if (lightFn!(tm)) more = true; }
  else more = true;
  if (pictureMoves()) {
    if (now - lastPics < 40) more = true;
    else {
      lastPics = now;
      items.forEach((it) => {
        if (!it.vis) return;
        const tg = target(it), eased = Math.abs(tg - it.t) >= 0.002;
        if (eased) { it.t += (tg - it.t) * 0.12; if (Math.abs(tg - it.t) < 0.002) it.t = tg; }
        const plainPhoto = !!it.photo && !it.src;
        // A settled canvas picture only needs a few frames a second (its grain, flicker and sway).
        const gap = eased || it.vec || plainPhoto ? 0 : 125;
        if (now - (slowAt.get(it) || 0) >= gap) { slowAt.set(it, now); draw(it, tm); }
        if (eased || !plainPhoto) more = true;
      });
    }
  }
  if (more) raf = requestAnimationFrame(frame);
}

export function startLoop(lightStep: (s: number) => boolean): void {
  lightFn = lightStep;
  document.addEventListener("visibilitychange", () => { lastWp = -1; if (!document.hidden) wake(); });
  wake();
}

// ---- where the reader is ------------------------------------------------------------------------
/** The reading line, as a share of the window height; chapter jumps put their target here too. */
const LINE = 0.3;
let tick = 0, settleT = 0, lastWp = -1, lastWpT = 0, saveT = 0, posKey = "", armed = false, muted = false, boot: (() => void) | null = null;

/** The top-level block under line `y`, and how far down it that line falls (0..1). */
function blockAt(y: number): Pos {
  const n = blockEls.length;
  if (!n) return { b: 0, o: 0 };
  const bottom = (k: number) => blockEls[k].getBoundingClientRect().bottom;
  let k = Math.min(hint, n - 1);
  while (k > 0 && bottom(k - 1) > y) k--;
  while (k < n - 1 && bottom(k) <= y) k++;
  hint = k;
  const r = blockEls[k].getBoundingClientRect();
  return { b: blockIdx[k], o: r.height > 0 ? clamp((y - r.top) / r.height) : 0 };
}

const wordsAt = (p: Pos): number => {
  const b = Math.min(p.b, wordCum.length - 2);
  return b < 0 ? 0 : wordCum[b] + p.o * (wordCum[b + 1] - wordCum[b]);
};

/** The hour and sky at the reading point, for Story light. */
export function readingSpec(): Pick<Spec, "time" | "sky"> | null { return specAt[readB] || null; }

/** The paged layout reports the first block on its spread. */
export function noteBlock(b: number): void {
  readB = b;
  if (state.settings.layout !== "paged") return;
  save({ b, o: 0 });
  wake();
}

function save(p: Pos): void {
  if (!armed || !posKey || muted) return;
  clearTimeout(saveT);
  saveT = window.setTimeout(() => store(posKey, pastOpening(state.book.blocks, p.b) ? encodePos({ ...p, w: pace.w, ms: pace.ms }) : null), 600);
}

/** The bar's label: time left in the chapter (or the book), at the reader's own pace. */
function leftText(p: Pos): string {
  const chs = chapterList, here = wordsAt(p);
  let k = -1;
  chs.forEach((c, j) => { if (c.i <= p.b) k = j; });
  const end = k >= 0 && chs[k + 1] ? chs[k + 1].i : state.book.blocks.length;
  return leftLabel(wordCum[end] - here, paceOf(pace), k >= 0 && chs.length ? k + 1 : null);
}

function update(): void {
  tick = 0;
  if (state.settings.layout === "paged") return;
  const prog = document.getElementById("prog"), pct = document.getElementById("pct");
  const h = docEl.scrollHeight - window.innerHeight, v = h > 0 ? clamp(window.scrollY / h) : 0;
  if (prog) prog.style.width = v * 100 + "%";
  const p = blockAt(window.innerHeight * LINE + 2);
  readB = p.b;
  if (pct) pct.textContent = leftText(p);
  save(p);
  // Pace is measured between pauses in scrolling, so a flick down the page is not "reading".
  clearTimeout(settleT);
  settleT = window.setTimeout(() => {
    if (document.hidden) return;
    const now = performance.now(), wp = wordsAt(blockAt(window.innerHeight * LINE + 2));
    if (lastWp >= 0) pace = paceAdd(pace, wp - lastWp, now - lastWpT);
    lastWp = wp; lastWpT = now;
  }, 700);
}

export function onScroll(): void {
  if (!tick) tick = requestAnimationFrame(update);
  wake();
}

/** Chapter and picture marks on the progress line (scroll layouts): the book's map, as buttons. */
function ticks(): void {
  const line = document.querySelector(".bar .line");
  if (!line) return;
  line.querySelectorAll("button").forEach((b) => b.remove());
  if (state.settings.layout === "paged") return;
  const h = docEl.scrollHeight - window.innerHeight;
  if (h <= 0) return;
  const put = (e: Element, cls: string, label: string, go: () => void) => {
    const y = e.getBoundingClientRect().top + window.scrollY - window.innerHeight * LINE;
    const b = el("button", cls); b.type = "button"; b.title = label; b.setAttribute("aria-label", label);
    b.style.left = clamp(y / h) * 100 + "%"; b.addEventListener("click", go); line.appendChild(b);
  };
  const chEls = document.querySelectorAll<HTMLElement>(".text .ch");
  chapterList.forEach((c, k) => { if (chEls[k]) put(chEls[k], "tk", (c.num ? "Chapter " + c.num + ". " : "") + c.title, () => scrollToBlock(c.i)); });
  if (!figuresShown()) return;
  const fe = document.querySelectorAll<HTMLElement>("figure[data-after]");
  figList.forEach((f, k) => { if (fe[k]) put(fe[k], "fm", "Picture " + f.num + ". " + f.caption, () => scrollToBlock(f.after, true)); });
}

// ---- cues: the caption's words, marked in the text they came from ---------------------------------
type Hl = { set(k: string, v: unknown): void; delete(k: string): void };
const hls = (): Hl => (CSS as unknown as { highlights: Hl }).highlights;
const mkHl = (...r: Range[]): unknown => new ((globalThis as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight)(...r);
let fio: IntersectionObserver | null = null;
const seen = new Map<HTMLElement, Range>();

const cueOn = (): boolean => cueSupported() && state.settings.pictures !== "off" && state.settings.style !== "none" && (state.settings.captions === "cue" || state.settings.captions === "both");

/** The caption's words inside the paragraph a figure quotes, as a live Range (the text is not touched). */
function cueRange(f: HTMLElement): Range | null {
  const host = document.querySelector<HTMLElement>('.text [data-b="' + f.getAttribute("data-cue") + '"]'), cap = f.querySelector("figcaption span");
  if (!host || !cap) return null;
  const segs: { n: Text; s: number }[] = [];
  let hay = "";
  const walk = (n: Node) => n.childNodes.forEach((c) => {
    if (c.nodeType === 3) { segs.push({ n: c as Text, s: hay.length }); hay += (c as Text).data; }
    else if (c.nodeName === "BR") hay += " ";
    else walk(c);
  });
  walk(host);
  const q = quoteRange(hay, cap.textContent || "");
  if (!q) return null;
  const a = segs.find((g) => q[0] >= g.s && q[0] < g.s + g.n.length), z = segs.find((g) => q[1] > g.s && q[1] <= g.s + g.n.length);
  if (!a || !z) return null;
  const r = document.createRange();
  r.setStart(a.n, q[0] - a.s); r.setEnd(z.n, q[1] - z.s);
  return r;
}

function paintCue(): void {
  if (!cueSupported()) return;
  if (seen.size) hls().set("ny-cue", mkHl(...Array.from(seen.values()))); else hls().delete("ny-cue");
}

/** Watch the figures; the quoted words are marked while their picture is on screen. */
function cues(): void {
  if (fio) { fio.disconnect(); fio = null; }
  seen.clear(); paintCue();
  if (!cueOn() || !("IntersectionObserver" in window)) return;
  fio = new IntersectionObserver((es) => {
    es.forEach((e) => {
      const f = e.target as HTMLElement, r = e.isIntersecting ? cueRange(f) : null;
      if (r) seen.set(f, r); else seen.delete(f);
    });
    paintCue();
  }, { rootMargin: "-8% 0px -8% 0px" });
  document.querySelectorAll<HTMLElement>("figure[data-cue]").forEach((f) => fio!.observe(f));
}

/** Tap a picture: bring its line near the reading point and pulse the marked words. */
function onFigureTap(e: Event): void {
  const f = (e.target as Element).closest<HTMLElement>("figure[data-cue]");
  if (!f || !cueOn()) return;
  const r = seen.get(f) || cueRange(f), host = r && (r.startContainer.parentElement as HTMLElement | null)?.closest("[data-b]");
  if (!r || !host) return;
  const smooth = moving();
  scrollToBlock(+(host.getAttribute("data-b") || 0), false, smooth);
  setTimeout(() => { hls().set("ny-pulse", mkHl(r)); setTimeout(() => hls().delete("ny-pulse"), 900); }, smooth ? 350 : 0);
}

// ---- coming back ------------------------------------------------------------------------------
function restore(p: Pos): void {
  const t = document.querySelector<HTMLElement>('.text > [data-b="' + p.b + '"]') || document.querySelector<HTMLElement>('[data-b="' + p.b + '"]');
  if (!t) return;
  if (state.settings.layout === "paged") { if (pagedGo) pagedGo(t); return; }
  const r = t.getBoundingClientRect();
  window.scrollTo({ top: Math.max(0, window.scrollY + r.top + p.o * r.height - window.innerHeight * LINE), behavior: "auto" });
}

function toStart(): void {
  const c = document.querySelector<HTMLElement>(".cover");
  if (state.settings.layout === "paged") { if (pagedGo && c) pagedGo(c); } else window.scrollTo({ top: 0, behavior: "auto" });
}

/** A small card near the top: the last picture passed and its quoted line, and the way back to the start. */
function welcomeBack(p: Pos): void {
  document.getElementById("resume")?.remove();
  const fig = lastFigureBefore(guardScenes(state.book.blocks, state.book.scenes).scenes, p.b);
  const card = el("div", "resume"); card.id = "resume"; card.setAttribute("role", "region"); card.setAttribute("aria-label", "Welcome back");
  card.appendChild(el("p", "rs-h", "Welcome back"));
  if (fig && fig.caption) card.appendChild(el("p", "rs-q", "\u201c" + plain(fig.caption) + "\u201d"));
  const row = el("div", "rs-row");
  const start = el("button", "btn quiet", "Start from the beginning"); start.type = "button";
  const close = el("button", "btn quiet rs-x", "\u00d7"); close.type = "button"; close.setAttribute("aria-label", "Dismiss");
  const gone = () => card.remove();
  start.addEventListener("click", () => { gone(); toStart(); store(posKey, null); });
  close.addEventListener("click", gone);
  row.append(start, close); card.appendChild(row);
  document.getElementById("shell")?.appendChild(card);
  setTimeout(gone, 25000);
}

/** The reader's place: save it per book, and on the first render of a visit offer to pick it up. */
function initPlace(key: string): void {
  posKey = key;
  const saved = decodePos(load<string>(key));
  if (saved && saved.w && saved.ms) pace = { w: saved.w, ms: saved.ms };
  boot = () => {
    armed = true;
    if (!saved || !pastOpening(state.book.blocks, saved.b)) return;
    restore(saved);
    // Fonts arriving can move every line; put the place back once more if the reader has not moved.
    let moved = false;
    const mv = () => { moved = true; };
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach((ev) => window.addEventListener(ev, mv, { once: true, passive: true }));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!moved) restore(saved); });
    welcomeBack(saved);
  };
  const flush = () => { if (saveT) { clearTimeout(saveT); saveT = 0; if (armed && !muted) { const p = state.settings.layout === "paged" ? { b: readB, o: 0 } : blockAt(window.innerHeight * LINE + 2); store(posKey, pastOpening(state.book.blocks, p.b) ? encodePos({ ...p, w: pace.w, ms: pace.ms }) : null); } } };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  window.addEventListener("beforeprint", () => { muted = true; });
  window.addEventListener("afterprint", () => { muted = false; });
}

/** Chapter keys in scroll layouts: [ and ] jump to the previous and next chapter. */
function chapterKeys(e: KeyboardEvent): void {
  if (e.key !== "[" && e.key !== "]") return;
  if (e.ctrlKey || e.metaKey || e.altKey || state.settings.layout === "paged") return;
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
  const here = blockAt(window.innerHeight * LINE + 2).b, chs = chapterList;
  const to = e.key === "]" ? chs.find((c) => c.i > here) : chs.slice().reverse().find((c) => c.i < here);
  if (to) { e.preventDefault(); scrollToBlock(to.i); }
}

/** Book and preview only: the Studio page has no book in it. The preview never saves or resumes. */
export function initReader(opts: { preview?: boolean; posKey?: string } = {}): void {
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { items.forEach((it) => { it.pw = 0; if (!pictureMoves() && state.settings.pictures !== "off") draw(it, 0); }); ticks(); onScroll(); });
  onRendered(() => setTimeout(() => { ticks(); onScroll(); }, 60));
  document.getElementById("text")?.addEventListener("click", onFigureTap);
  document.addEventListener("keydown", chapterKeys);
  if (!opts.preview && opts.posKey) initPlace(opts.posKey);
}

let pagedGo: ((el: HTMLElement) => void) | null = null;
/** The pager registers how to bring an element into view. */
export function setPagedGo(fn: (el: HTMLElement) => void): void { pagedGo = fn; }

/** Bring a block (or the picture after it) to the reading line, or its page. */
export function scrollToBlock(i: number, picture = false, smooth = false): void {
  const t = document.querySelector<HTMLElement>(picture ? 'figure[data-after="' + i + '"]' : '[data-b="' + i + '"]')
    || document.querySelector<HTMLElement>('[data-b="' + i + '"]');
  if (!t) return;
  if (state.settings.layout === "paged") { if (pagedGo) pagedGo(t); return; }
  const r = t.getBoundingClientRect();
  window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * LINE, behavior: smooth ? "smooth" : "auto" });
}
