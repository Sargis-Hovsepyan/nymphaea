// One editor for a composed picture, the same in its card and in the inspector over the book: the
// picture itself, playing, with play, pause, replay and a timeline of what happens (each act a
// segment you can jump to); the acts as chips you can take out; a box to direct it in plain words
// ("make her run, add rain, closer") that shows what it understood before anything changes; and
// every setting with its name on it. Edits go through the caller, so they are undoable and guarded.
import { describeActs, type Act } from "../compose/acts";
import { direct } from "../compose/direct";
import { FX, LABEL, PLACES, POSES, PROPS, SEASONS, SHOTS, SKIES, TIMES, describe, encode, withProps, withWho, type Spec } from "../compose/spec";
import { timeline } from "../compose/timeline";
import { player, reducedMotion, type Player } from "../renderers/player";
import { isVector } from "../renderers/vector";
import { state } from "../state";
import type { Style } from "../types";
import { cap, esc } from "../text/strings";

export interface EditorOpts {
  /** Change the picture (undoable). */
  edit: (fn: (sp: Spec) => Spec) => void;
  /** Read the acts again from the words (for "Acting on"). */
  reread: () => Spec | null;
  /** Show the picture large. */
  large?: () => void;
  /** Mark these words in the book. */
  mark?: (words: string[]) => void;
}

export const SHOT_NAME: Record<string, string> = { wide: "Wide", mid: "Nearer", close: "Close" };
const WHO_NAME = ["Nobody", "One", "Two", "A few"];
const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5M5 4.5V9h4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  large: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

/** The style pictures are previewed in: the book's own when it is a vector style, else Cut paper. */
export const previewStyle = (): Style => (isVector(state.settings.style) ? state.settings.style : "cut");

const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** One act in a few words, without who does it when there is only one figure. */
export function actLabel(sp: Pick<Spec, "who" | "props">, a: Act): string {
  const t = describeActs({ ...sp, acts: [a] });
  return cap(sp.who <= 1 ? t.replace(/^the figure /, "") : t);
}

/**
 * The picture playing, with its controls and its timeline. `host` gets it; returns the player so the
 * caller can stop it. Used by the editor and by the large view.
 */
export function stage(host: HTMLElement, scene: string, sp: Spec | null, label: string, opts: { large?: () => void; onAct?: (n: number) => void; big?: boolean } = {}): Player {
  const tl = timeline(sp?.acts || []);
  // Acts that play at the same time each get a lane.
  const lane: number[] = [];
  tl.segs.forEach((g, i) => { let l = 0; while (tl.segs.slice(0, i).some((h, j) => lane[j] === l && h.end > g.start + 0.25 && h.start < g.end - 0.25)) l++; lane.push(l); });
  const lanes = Math.max(1, ...lane.map((l) => l + 1));
  const segs = tl.segs.map((g, i) => {
    const l = (g.start / tl.loop) * 100, w = Math.max(3, ((g.end - g.start) / tl.loop) * 100), hgt = 100 / lanes;
    return `<button type="button" class="pe-seg" data-pe="seg" data-n="${g.n}" style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}%;top:calc(${(lane[i] * hgt).toFixed(1)}% + 4px);height:calc(${hgt.toFixed(1)}% - 8px);bottom:auto" title="${esc(actLabel(sp!, g.act))}"><span>${esc(actLabel(sp!, g.act))}</span></button>`;
  }).join("");
  host.innerHTML = `<div class="pe-art"></div><div class="pe-ctl">` +
    `<button type="button" class="pe-b" data-pe="play" aria-label="Pause">${ICON.pause}</button>` +
    `<button type="button" class="pe-b" data-pe="replay" aria-label="Play again" title="Play again">${ICON.replay}</button>` +
    (tl.segs.length ? `<div class="pe-track${lanes > 1 ? " lanes" : ""}" data-pe="track" role="slider" tabindex="0" aria-label="Where in what happens" aria-valuemin="0" aria-valuemax="${tl.loop.toFixed(1)}" aria-valuenow="0">${segs}<i class="pe-head"></i></div>`
      : `<span class="pe-none">${sp ? "Nothing happens in the words; the scene moves on its own." : "A drawn scene from the library."}</span>`) +
    (opts.large ? `<button type="button" class="pe-b" data-pe="large" aria-label="View large" title="View large">${ICON.large}</button>` : "") + `</div>`;
  const art = host.querySelector<HTMLElement>(".pe-art")!, head = host.querySelector<HTMLElement>(".pe-head"), track = host.querySelector<HTMLElement>(".pe-track");
  const pl = player(art, {
    onTick: (p) => {
      if (!head || !tl.loop) return;
      const q = ((p % tl.loop) + tl.loop) % tl.loop;
      head.style.left = ((q / tl.loop) * 100).toFixed(2) + "%";
      track!.setAttribute("aria-valuenow", q.toFixed(1));
      track!.querySelectorAll<HTMLElement>(".pe-seg").forEach((b) => { const g = tl.segs[+b.dataset.n!]; b.classList.toggle("on", q >= g.start && q <= g.end); });
    },
  });
  pl.set(previewStyle(), scene, label);
  const playB = host.querySelector<HTMLButtonElement>('[data-pe="play"]')!;
  const showPaused = (pz: boolean) => { playB.innerHTML = pz ? ICON.play : ICON.pause; playB.setAttribute("aria-label", pz ? "Play" : "Pause"); };
  if (reducedMotion()) { showPaused(true); playB.disabled = true; }
  const seekAt = (clientX: number) => { const r = track!.getBoundingClientRect(); pl.seek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * tl.loop); showPaused(true); };
  host.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-pe]");
    if (!b) { if ((e.target as HTMLElement).closest(".pe-art")) { pl.replay(); showPaused(false); } return; }
    const a = b.dataset.pe;
    if (a === "play") showPaused(pl.toggle());
    else if (a === "replay") { pl.replay(); showPaused(false); }
    else if (a === "large") opts.large?.();
    else if (a === "seg") { const g = tl.segs[+b.dataset.n!]; pl.seek(g.tell); showPaused(true); opts.onAct?.(g.n); e.stopPropagation(); }
  });
  if (track) {
    track.addEventListener("pointerdown", (e) => { if ((e.target as HTMLElement).closest(".pe-seg")) return; track.setPointerCapture(e.pointerId); seekAt(e.clientX); });
    track.addEventListener("pointermove", (e) => { if (track.hasPointerCapture(e.pointerId)) seekAt(e.clientX); });
    track.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const st = pl.state(), q = ((st.p % tl.loop) + tl.loop) % tl.loop;
      pl.seek(Math.max(0, Math.min(tl.loop, q + (e.key === "ArrowRight" ? 0.25 : -0.25)))); showPaused(true);
    });
  }
  return pl;
}

/** The editor for a composed picture. */
export function pictureEditor(scene: string, sp: Spec, o: EditorOpts): { el: HTMLElement; stop: () => void } {
  const el = document.createElement("div"); el.className = "pe";
  const acts = sp.acts || [];
  const seg = (field: string, opts: readonly string[], cur: string, name: (v: string) => string) =>
    `<div class="seg pe-seg-row" role="group" aria-label="${field}">${opts.map((v) => `<button type="button" data-field="${field}" data-v="${v}" aria-pressed="${v === cur}">${esc(name(v))}</button>`).join("")}</div>`;
  const sel = (field: string, label: string, opts: readonly string[], cur: string, name: (v: string) => string) =>
    `<label class="pe-f"><span>${label}</span><select class="mk-input" data-field="${field}">${opts.map((v) => `<option value="${v}"${v === cur ? " selected" : ""}>${esc(name(v))}</option>`).join("")}</select></label>`;
  const bare = (t: string) => t.replace(/^(a|an|the) /, "");
  el.innerHTML =
    `<div class="pe-stage"></div>` +
    `<p class="pe-d">${esc(cap(describe(sp)))}.</p>` +
    `<section class="pe-acts" aria-label="What happens"><header><span>What happens</span>` +
    `<button type="button" class="pe-switch" data-pe="acting" role="switch" aria-checked="${acts.length > 0}">${acts.length ? "Acting" : "Still"}</button></header>` +
    (acts.length ? `<ol>${acts.map((a, n) => `<li><button type="button" class="pe-chip" data-pe="act" data-n="${n}" title="Show this moment">${n ? (a.with ? "as " : "then ") + esc(lower(actLabel(sp, a))) : esc(actLabel(sp, a))}</button><button type="button" class="pe-x" data-pe="unact" data-n="${n}" aria-label="Take out: ${esc(actLabel(sp, a))}">×</button></li>`).join("")}</ol>`
      : `<p class="pe-hint">The words name nothing that happens. Direct it below, or turn acting on to read them again.</p>`) +
    `</section>` +
    `<form class="pe-direct" data-pe="direct"><label class="pe-f"><span>Direct it</span><input class="mk-input" name="d" autocomplete="off" placeholder="make her run, add rain, closer" aria-describedby="pe-dh"></label><button type="submit" class="btn">Try</button></form>` +
    `<p class="pe-dh" id="pe-dh">Your direction changes only the picture, never the words of the book.</p>` +
    `<div class="pe-preview" hidden></div>` +
    `<div class="pe-fields">` +
    `<div class="pe-f"><span>Hour</span>${seg("time", TIMES, sp.time, cap)}</div>` +
    `<div class="pe-f"><span>Weather</span>${seg("sky", SKIES, sp.sky, cap)}</div>` +
    `<div class="pe-f"><span>Shot</span>${seg("shot", SHOTS, sp.shot, (v) => SHOT_NAME[v])}</div>` +
    `<div class="pe-2">` +
    sel("place", "Place", PLACES, sp.place, (v) => v === "inner" ? "No place" : cap(bare(LABEL.place[v as Spec["place"]]))) +
    sel("season", "Season", SEASONS, sp.season, (v) => v === "none" ? "Any" : cap(v)) +
    sel("who", "Figures", ["0", "1", "2", "3"], String(sp.who), (v) => WHO_NAME[+v]) +
    sel("pose", "At rest", POSES, sp.pose, (v) => v === "stand" ? "Standing" : cap(LABEL.pose[v as Spec["pose"]])) +
    `</div>` +
    sel("focus", "In focus", ["-", ...PROPS], sp.props[0] || "-", (v) => v === "-" ? "Nothing in particular" : cap(bare(LABEL.prop[v as Spec["props"][number]]))) +
    `<div class="pe-f"><span>Moving</span><div class="pe-chips" role="group" aria-label="Moving">${FX.map((x) => `<button type="button" data-field="fx" data-v="${x}" aria-pressed="${!!sp.fx?.includes(x)}">${esc(cap(LABEL.fx[x]))}</button>`).join("")}</div></div>` +
    `</div>` +
    `<div class="pe-gen"><button type="button" class="btn quiet" data-pe="vary" title="A new view of the same place">New view</button><button type="button" class="btn quiet" data-pe="shuffle" title="The same view, with the clouds, people and small things moved">New moment</button></div>`;

  const pl = stage(el.querySelector<HTMLElement>(".pe-stage")!, scene, sp, cap(describe(sp)), { large: o.large, onAct: () => o.mark?.([]) });
  let pending: Spec | null = null;
  const preview = el.querySelector<HTMLElement>(".pe-preview")!;

  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!b || b.closest(".pe-stage")) return;
    const f = b.dataset.field, v = b.dataset.v, a = b.dataset.pe;
    if (f === "time") o.edit((s) => ({ ...s, time: v as Spec["time"] }));
    else if (f === "sky") o.edit((s) => ({ ...s, sky: v as Spec["sky"] }));
    else if (f === "shot") o.edit((s) => ({ ...s, shot: v as Spec["shot"] }));
    else if (f === "fx") o.edit((s) => { const on = s.fx?.includes(v as never); const fx = on ? (s.fx || []).filter((x) => x !== v) : [...(s.fx || []), v as NonNullable<Spec["fx"]>[number]].slice(-3); const n: Spec = { ...s, fx }; if (!fx.length) delete n.fx; return n; });
    else if (a === "vary") o.edit((s) => ({ ...s, seed: (s.seed + 7919) % 46656 }));
    else if (a === "shuffle") o.edit((s) => ({ ...s, moment: (s.moment + 487) % 1296 }));
    else if (a === "unact") { const n = +b.dataset.n!; o.edit((s) => { const left = (s.acts || []).filter((_, j) => j !== n); const r: Spec = { ...s, acts: left }; if (!left.length) delete r.acts; return r; }); }
    else if (a === "act") { const tl = timeline(sp.acts || []), g = tl.segs[+b.dataset.n!]; if (g) pl.seek(g.tell); }
    else if (a === "acting") {
      if (acts.length) o.edit((s) => { const r = { ...s }; delete r.acts; return r; });
      else { const again = o.reread(); if (again && again.acts?.length) o.edit((s) => withWho({ ...s, acts: again.acts }, Math.max(s.who, again.who))); else showPreview(null, ["The words name nothing that can be acted. Direct it instead."]); }
    }
    else if (a === "apply" && pending) { const next = pending; pending = null; preview.hidden = true; o.edit(() => next); }
    else if (a === "cancel") { pending = null; preview.hidden = true; }
  });
  el.addEventListener("change", (e) => {
    const t = e.target as HTMLSelectElement, f = t.dataset.field, v = t.value;
    if (f === "place") o.edit((s) => ({ ...s, place: v as Spec["place"] }));
    else if (f === "season") o.edit((s) => ({ ...s, season: v as Spec["season"] }));
    else if (f === "who") o.edit((s) => withWho(s, +v));
    else if (f === "pose") o.edit((s) => withWho({ ...s, pose: v as Spec["pose"] }, Math.max(s.who, v === "pair" ? 2 : v === "stand" ? s.who : 1)));
    else if (f === "focus" && v !== "-") o.edit((s) => withProps(s, [v as Spec["props"][number], ...s.props.filter((p) => p !== v)]));
  });
  el.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = (e.target as HTMLFormElement).elements.namedItem("d") as HTMLInputElement, text = inp.value.trim();
    if (!text) return;
    const d = direct(sp, text);
    if (!d.changes.length) { showPreview(null, ["Nothing there I can draw. Try “she runs”, “add rain”, “at dawn”, “closer” or “no dog”."]); return; }
    showPreview(d.spec, d.changes);
  });
  function showPreview(next: Spec | null, lines: string[]): void {
    pending = next && encode(next) !== encode(sp) ? next : null;
    preview.innerHTML = `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` + (pending ? `<div><button type="button" class="btn primary" data-pe="apply">Apply</button><button type="button" class="btn quiet" data-pe="cancel">Cancel</button></div>` : `<div><button type="button" class="btn quiet" data-pe="cancel">OK</button></div>`);
    preview.hidden = false;
    (preview.querySelector("button") as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }
  return { el, stop: () => pl.stop() };
}

/** For a picture in the list: the still of what happens, described. */
export const actsSummary = (sp: Spec | null): string => (sp && sp.acts && sp.acts.length ? cap(describeActs(sp)) : "");
