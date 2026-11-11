// Painting with an image model: one picture, or all of them. A painting is stored in IndexedDB and
// the scene keeps only its id. The plan may change while the model works, so the finished picture
// is matched back to its place in the book, not to a card number.
import { explain } from "../ai/config";
import { makeImage } from "../ai/image";
import { imageBrief } from "../ai/prompt";
import { newImageId, putImage } from "../ai/store";
import { state } from "../state";
import type { SceneRef } from "../types";
import { aiConfig, imageReady } from "./ai";
import { $, book, commitScenes, hooks, jobs, painting, pkey, plural, clearWarn, syncStop, sess } from "./session";
import { checkpoint } from "./undo";
import { toast } from "./ui";

export function briefFor(s: SceneRef) {
  const B = book(), S = state.settings, c = aiConfig();
  return imageBrief(s.scene, s.quote || (B.blocks[s.after] ? B.blocks[s.after].text : B.title), S.style, c.image.withText);
}

export async function paint(s0: SceneRef, outer?: AbortSignal): Promise<boolean> {
  const c = aiConfig(), key = pkey(s0);
  if (!imageReady(c) || painting.has(key)) return false;
  const pc = new AbortController();
  if (outer) { if (outer.aborted) return false; outer.addEventListener("abort", () => pc.abort(), { once: true }); }
  const brief = briefFor(s0), prompt = s0.prompt || brief.prompt;
  painting.set(key, pc); syncStop(); hooks.renderScenes();
  try {
    const data = await makeImage(c.image, prompt, brief.negative, pc.signal);
    const id = newImageId();
    await putImage(id, data);
    sess.images[id] = data;
    const now = book().scenes.find((x) => pkey(x) === key);
    if (!now) return false;
    checkpoint();
    now.img = id;
    painting.delete(key);
    commitScenes(book().scenes);
    return true;
  } catch (e) {
    if (!(e && ((e as { code?: string }).code === "cancelled" || (e as Error).name === "AbortError"))) toast(explain(e, "the image model"), true);
    throw e;
  } finally {
    painting.delete(key);
    syncStop();
    hooks.renderScenes();
  }
}

/** Paint every picture that has no painting yet, one after another, with a progress bar. */
export async function paintAll(): Promise<void> {
  const todo = book().scenes.filter((s) => !(s.img && sess.images[s.img])).map(pkey);
  if (!todo.length) { toast("Every picture is already painted. Use Paint again on one to redo it."); return; }
  const ctl = jobs.paintAll = new AbortController();
  syncStop(); $<HTMLButtonElement>("mkPaintAll").disabled = true;
  let done = 0;
  const prog = progress("Painting");
  try {
    for (const key of todo) {
      if (ctl.signal.aborted) break;
      const s = book().scenes.find((x) => pkey(x) === key);
      if (!s) continue;
      prog.set(done, todo.length);
      try { if (await paint(s, ctl.signal)) done++; } catch { break; }
    }
    clearWarn();
    if (done) toast("Painted " + plural(done, "picture") + ". Each one is inked in your picture style.");
  } finally {
    prog.end();
    jobs.paintAll = null; syncStop(); $<HTMLButtonElement>("mkPaintAll").disabled = false;
  }
}

/**
 * The progress strip above the cards. `set(n, of)` fills a determinate bar; with no total it shows
 * only the seconds so far. Returns controls so the caller never touches the DOM.
 */
export function progress(what: string): { set: (n?: number, of?: number) => void; end: () => void } {
  const box = $("mkProg"), txt = $("mkProgTxt"), bar = $("mkProgBar") as HTMLElement;
  const t0 = Date.now();
  let n = -1, of = 0;
  const draw = () => {
    const s = Math.round((Date.now() - t0) / 1000);
    txt.textContent = of ? what + " " + Math.min(n + 1, of) + " of " + of + ", " + s + " s" : what + "… " + s + " s";
    box.classList.toggle("indet", !of);
    bar.style.width = of ? Math.round((n / of) * 100) + "%" : "";
    box.setAttribute("aria-valuenow", of ? String(Math.round((n / of) * 100)) : "");
    if (!of) box.removeAttribute("aria-valuenow");
  };
  box.hidden = false; box.setAttribute("aria-valuemin", "0"); box.setAttribute("aria-valuemax", "100");
  draw();
  const timer = window.setInterval(draw, 1000);
  return { set(a, b) { if (a !== undefined) n = a; if (b !== undefined) of = b; draw(); }, end() { clearInterval(timer); box.hidden = true; } };
}
