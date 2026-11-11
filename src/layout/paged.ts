// Paged spreads: the same book DOM flowed into CSS columns, one column per page, two pages side
// by side on a wide screen and one on a phone. A turn is a translate; nothing is measured glyph by
// glyph. Running heads and folios come from a chapter map, the reading position is anchored to a
// paragraph so a resize or a change of type lands on the same words.
import { geometry, pageAt, type Geometry } from "./geometry";
export { geometry, pageAt };
import { state } from "../state";
import { chapters, noteBlock, setPagedGo } from "../ui/reader";

let g: Geometry | null = null, spread = 0, pages = 1, anchor = -1, inited = false, chrome: HTMLElement | null = null;
const turned: (() => void)[] = [];
export function onTurn(fn: () => void): void { turned.push(fn); }

/** Is the event target inside an element matching sel? (Key events can target the document.) */
const inside = (t: EventTarget | null, sel: string) => t instanceof Element && !!t.closest(sel);

const main = () => document.querySelector("main") as HTMLElement | null;
const on = () => state.settings.layout === "paged";

function colWidth(): number {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:var(--col);height:1px";
  document.body.appendChild(probe);
  const w = probe.getBoundingClientRect().width || 620;
  probe.remove();
  return w;
}

function pageOf(el: Element): number {
  const m = main();
  if (!m || !g) return 0;
  return pageAt(el.getBoundingClientRect().left - m.getBoundingClientRect().left, g.pageW, g.gap);
}

/** Lay out (or, out of paged mode, undo) the spreads. */
export function layoutPaged(): void {
  const m = main(), docEl = document.documentElement;
  if (!m) return;
  if (!on()) {
    ["--pg-top", "--pg-left", "--pg-w", "--pg-h", "--pg-gap", "--per", "--pg-x", "--pg-pw"].forEach((k) => docEl.style.removeProperty(k));
    if (chrome) { chrome.remove(); chrome = null; }
    g = null; return;
  }
  const bar = (document.querySelector(".bar") as HTMLElement | null)?.getBoundingClientRect().height || 44;
  g = geometry(window.innerWidth, window.innerHeight, colWidth(), bar);
  const set = (k: string, v: string) => docEl.style.setProperty(k, v);
  set("--pg-top", g.top + "px"); set("--pg-left", g.left + "px"); set("--pg-w", g.spreadW + "px");
  set("--pg-h", g.height + "px"); set("--pg-gap", g.gap + "px"); set("--per", String(g.per)); set("--pg-pw", g.pageW + "px");
  m.style.transition = "none";
  set("--pg-x", "0px");
  const end = m.querySelector(".end") || m.lastElementChild;
  pages = end ? pageOf(end) + 1 : 1;
  const max = Math.max(0, Math.ceil(pages / g.per) - 1);
  if (anchor >= 0) { const a = m.querySelector('[data-b="' + anchor + '"]'); if (a) spread = Math.floor(pageOf(a) / g.per); }
  spread = Math.min(spread, max);
  buildChrome();
  show(false);
}

function show(animate = true): void {
  const m = main();
  if (!g || !m) return;
  const instant = !animate || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (instant) m.style.transition = "none";
  document.documentElement.style.setProperty("--pg-x", -spread * (g.spreadW + g.gap) + "px");
  if (instant) { void m.offsetWidth; requestAnimationFrame(() => { m.style.transition = ""; }); }
  // Anchor: the first paragraph on this spread.
  const firstPage = spread * g.per;
  for (const b of Array.from(m.querySelectorAll<HTMLElement>("[data-b]"))) {
    if (pageOf(b) >= firstPage) { anchor = +(b.getAttribute("data-b") || 0); break; }
  }
  paintChrome();
  if (anchor >= 0) noteBlock(anchor);
  const prog = document.getElementById("prog"), pct = document.getElementById("pct");
  const last = Math.min(pages, firstPage + g.per);
  if (prog) prog.style.width = (pages > 1 ? (last / pages) * 100 : 100) + "%";
  if (pct) pct.textContent = (firstPage + 1) + (g.per > 1 && last > firstPage + 1 ? "–" + last : "") + " / " + pages;
  turned.forEach((fn) => fn());
}

export function turn(d: number): void {
  if (!g) return;
  const max = Math.max(0, Math.ceil(pages / g.per) - 1), n = Math.max(0, Math.min(max, spread + d));
  if (n !== spread) { spread = n; show(); }
}
export function goToPage(p: number): void { if (g) { spread = Math.max(0, Math.floor(p / g.per)); show(); } }
export function pagedInfo(): { spread: number; pages: number; per: number } { return { spread, pages, per: g ? g.per : 1 }; }

function buildChrome(): void {
  if (!chrome) {
    chrome = document.createElement("div");
    chrome.className = "pg-chrome"; chrome.setAttribute("aria-hidden", "true");
    document.getElementById("shell")?.appendChild(chrome);
  }
  chrome.textContent = "";
  if (!g) return;
  for (let k = 0; k < g.per; k++) {
    const x = g.left + k * (g.pageW + g.gap);
    const head = document.createElement("div"); head.className = "pg-head" + (g.per > 1 ? (k ? " r" : " l") : "");
    head.style.cssText = "left:" + x + "px;width:" + g.pageW + "px;top:" + (g.top - 26) + "px";
    const fol = document.createElement("div"); fol.className = "pg-folio" + (g.per > 1 ? (k ? " r" : " l") : "");
    fol.style.cssText = "left:" + x + "px;width:" + g.pageW + "px;top:" + (g.top + g.height + 16) + "px";
    chrome.append(head, fol);
  }
  if (g.per > 1) {
    const sp = document.createElement("div"); sp.className = "pg-spine";
    sp.style.cssText = "left:" + (g.left + g.pageW + g.gap / 2) + "px;top:" + (g.top - 8) + "px;height:" + (g.height + 16) + "px";
    chrome.appendChild(sp);
  }
}

function paintChrome(): void {
  if (!chrome || !g) return;
  const heads = chrome.querySelectorAll<HTMLElement>(".pg-head"), fols = chrome.querySelectorAll<HTMLElement>(".pg-folio");
  const chs = chapters().map((c) => { const e = document.querySelector('[data-b="' + c.i + '"]'); return { ...c, page: e ? pageOf(e) : 0 }; });
  const title = state.book.title;
  for (let k = 0; k < g.per; k++) {
    const p = spread * g.per + k, starts = chs.some((c) => c.page === p);
    let ch = "";
    chs.forEach((c) => { if (c.page <= p) ch = c.title; });
    const blank = p === 0 || p >= pages || starts;
    heads[k].textContent = blank ? "" : g.per > 1 ? (k === 0 ? title : ch || title) : ch || title;
    fols[k].textContent = p === 0 || p >= pages ? "" : String(p);
  }
}

/** Keys, wheel, swipe and the page edges turn the page. Installed once. */
export function initPaged(): void {
  setPagedGo((el) => goToPage(pageOf(el)));
  if (inited) return;
  inited = true;
  document.addEventListener("keydown", (e) => {
    if (!on()) return;
    if (inside(e.target, "input, textarea, select, .studio")) return;
    const next = ["ArrowRight", "PageDown", "ArrowDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
    const prev = ["ArrowLeft", "PageUp", "ArrowUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (next || prev) { e.preventDefault(); turn(next ? 1 : -1); }
    else if (e.key === "Home") { e.preventDefault(); goToPage(0); }
    else if (e.key === "End") { e.preventDefault(); goToPage(pages - 1); }
  });
  let acc = 0, lock = 0;
  window.addEventListener("wheel", (e) => {
    if (!on() || inside(e.target, ".studio")) return;
    e.preventDefault();
    const now = performance.now();
    if (now < lock) return;
    acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(acc) > 50) { turn(acc > 0 ? 1 : -1); acc = 0; lock = now + 450; }
  }, { passive: false });
  let x0 = 0, y0 = 0, down = false;
  window.addEventListener("pointerdown", (e) => { if (!on()) return; down = true; x0 = e.clientX; y0 = e.clientY; }, { passive: true });
  window.addEventListener("pointerup", (e) => {
    if (!on() || !down) return;
    down = false;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (inside(e.target, "button, a, input, select, textarea, .studio, .bar, .scrim")) return;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { turn(dx < 0 ? 1 : -1); return; }
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      const f = e.clientX / window.innerWidth;
      if (f > 0.8) turn(1); else if (f < 0.2) turn(-1);
    }
  }, { passive: true });
  let rt = 0;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = window.setTimeout(() => { if (on()) layoutPaged(); }, 120); });
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", () => { if (on()) layoutPaged(); });
}
