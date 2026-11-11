// One picture, playing: the landing desk, the words bar, the picture editor and the large view all
// use it. It reveals the picture over a short beat, plays what happens in it on its own clock, holds,
// and plays again; it can be paused, replayed and scrubbed. It stops drawing while it is off screen
// or the page is hidden, and with reduced motion it shows the telling moment and does not move.
import { sceneTiming } from "../compose";
import type { Style } from "../types";
import { drawVector, makeVector, type VecHandle } from "./vector";

export interface Player {
  /** Show a scene (a new one starts from the beginning). */
  set(style: Style, scene: string, label: string): void;
  /** Play from the start. */
  replay(): void;
  /** Pause or play; returns whether it is now paused. */
  toggle(paused?: boolean): boolean;
  /** Jump to a point on the clock (seconds) and hold there. */
  seek(p: number): void;
  /** Where the clock is, how long one play lasts and where the acts end (0 when the scene has none). */
  state(): { p: number; loop: number; total: number; paused: boolean };
  stop(): void;
}

export const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A player drawing into `host`. onTick is called each drawn frame (for a scrubber). */
export function player(host: HTMLElement, opts: { beatMs?: number; onTick?: (p: number) => void; className?: string } = {}): Player {
  const beat = opts.beatMs ?? 1800;
  let vec: VecHandle | null = null, style: Style = "cut", scene = "", born = 0, raf = 0, paused = false, held = 0, visible = true;
  const io = typeof IntersectionObserver === "function" ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) run(); }) : null;
  io?.observe(host);
  const vis = () => { if (!document.hidden) run(); };
  document.addEventListener("visibilitychange", vis);

  const clock = (now: number) => (paused ? held : (now - born) / 1000);
  function frame(now: number): void {
    raf = 0;
    if (!vec || !host.isConnected || !visible || document.hidden) return;
    const p = clock(now);
    drawVector(vec, style, scene, Math.min(1, (now - born) / beat + (paused ? 1 : 0)), now / 1000, p);
    opts.onTick?.(p);
    raf = requestAnimationFrame(frame);
  }
  function run(): void { if (!raf && vec && !reducedMotion()) raf = requestAnimationFrame(frame); }
  function still(): void { if (vec) { drawVector(vec, style, scene, 1, 0); opts.onTick?.(sceneTiming(scene).still); } }

  return {
    set(st, sc, label) {
      if (sc === scene && st === style && vec) return;
      style = st; scene = sc;
      const { wrap, vec: v } = makeVector(st, sc, label);
      if (opts.className) wrap.classList.add(opts.className);
      host.replaceChildren(wrap);
      vec = v; born = performance.now(); paused = false;
      if (reducedMotion()) still(); else run();
    },
    replay() { born = performance.now(); paused = false; if (reducedMotion()) still(); else run(); },
    toggle(pz = !paused) {
      if (pz === paused) return paused;
      const now = performance.now();
      if (pz) { held = clock(now); paused = true; }
      else { born = now - held * 1000; paused = false; }
      run();
      return paused;
    },
    seek(p) {
      held = Math.max(0, p); paused = true;
      if (vec) { drawVector(vec, style, scene, 1, performance.now() / 1000, held); opts.onTick?.(held); }
    },
    state() { const tl = sceneTiming(scene); return { p: clock(performance.now()), loop: tl.loop, total: tl.total, paused }; },
    stop() { cancelAnimationFrame(raf); raf = 0; vec = null; scene = ""; },
  };
}
