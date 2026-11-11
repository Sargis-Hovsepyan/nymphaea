// The Pictures tab: one compact card per picture (thumbnail, caption, paragraph). A card opens to its
// full editor, one at a time. Moving, adding, removing and choosing the cover all go through the
// Guard, so a caption can never stop being a quote of the author's words.
import { decode, encode, blank, LABEL, type Spec } from "../compose/spec";
import { actsSummary, pictureEditor } from "./pictureEdit";
import { inReach, readQuoteAt, trackSpecs } from "../compose/read";
import { shown, type Hit } from "../stage/locate";
import { NUM } from "../settings";
import { autoStage, captionFor, captionOf } from "../stage/auto";
import { captionIsQuoted } from "../stage/guard";
import { SCENE_DESC, SCENE_LIST } from "../stage/keywords";
import { state } from "../state";
import type { SceneRef } from "../types";
import { imageReady, aiConfig, openAi } from "./ai";
import { briefFor, paint, paintAll } from "./paint";
import { movePicture, canMove } from "./pictureMove";
import { $, book, clearWarn, commitScenes, hasText, hooks, narrow, painting, pkey, plural, sceneNote, sess, stopAll } from "./session";
import { thumb } from "./studio";
import { checkpoint, UNDO } from "./undo";
import { setPane, toast } from "./ui";
import { stageWithAi } from "./staging";
import { noteRemoved, renderRemoved } from "./removed";
import { cap, clip } from "../text/strings";

const COMPOSE = "__compose";

/** Which card is open (by its place in the book), and which one the reading point is on. */
let openKey = "", hereK = -1;

export function pNumber(after: number): number {
  let n = 0; book().blocks.forEach((b, i) => { if (i <= after && b.type !== "h") n++; }); return n;
}

/**
 * The composed scene for a paragraph, read with its chapter's setting carried in. With `quote`, the
 * picture is read from those words first, then the rest of their paragraph, then the chapter.
 */
export function composeFor(i: number, quote?: string): string {
  try {
    if (quote) { const r = readQuoteAt(book().blocks, i, quote); if (r) return encode(r.spec); }
    const sp = trackSpecs(book().blocks)[i]; if (sp) return encode(sp);
  } catch { /* fall through to a plain scene */ }
  return encode(blank(i));
}

/** Add a picture after paragraph `after`, drawn from the chosen words, and open its card. */
export function addPictureFrom(after: number, quote: string): void {
  const B = book();
  if (!B.blocks[after] || B.blocks[after].type === "h") return;
  checkpoint();
  const scene = composeFor(after, quote);
  const ref: SceneRef = { after, scene, caption: captionOf(quote, scene), quote };
  openKey = pkey(ref);
  commitScenes([...B.scenes, ref]);
  const k = book().scenes.findIndex((x) => pkey(x) === openKey);
  toast("Added a picture of “" + clip(shown(quote), 40) + "” after paragraph " + pNumber(after) + ".", false, UNDO);
  if (!narrow()) { setPane("manuscript", "pictures"); openCard(k); }
  sess.preview.send({ type: "scroll", block: after, picture: true });
}

/** Draw picture k again from the words in `h`. The picture moves to just after them when they are beyond its reach. */
export function redrawFrom(k: number, h: Hit): void {
  const B = book(), s = B.scenes[k];
  if (!s) return;
  checkpoint();
  if (!inReach(h.startBlock, h.endBlock, s.after)) s.after = h.endBlock;
  const old = s.scene, quote = h.exact;
  s.scene = composeFor(s.after, quote); s.quote = quote; s.caption = captionOf(quote, s.scene);
  if (B.cover === old) B.cover = s.scene;
  const had = !!s.img;
  delete s.img; delete s.prompt;
  openKey = pkey(s);
  commitScenes(B.scenes);
  toast("Picture " + (NUM[k] || k + 1) + " is now drawn from “" + clip(shown(quote), 40) + "”." + (had ? " The painting was for the old words, so the drawing shows now." : ""), false, UNDO);
}

/* ---------------- cards ---------------- */
function sceneOptions(sel: HTMLSelectElement, value: string): void {
  sel.textContent = "";
  const gText = document.createElement("optgroup"); gText.label = "Read from the text";
  if (decode(value)) { const o = document.createElement("option"); o.value = value; o.textContent = "Composed from the text"; o.selected = true; gText.appendChild(o); }
  const c = document.createElement("option"); c.value = COMPOSE; c.textContent = decode(value) ? "Read this passage again" : "Composed from this passage"; c.selected = value === COMPOSE; gText.appendChild(c);
  const gLib = document.createElement("optgroup"); gLib.label = "Drawn scenes";
  SCENE_LIST.forEach((s) => { const o = document.createElement("option"); o.value = s; o.textContent = cap(s); o.title = SCENE_DESC[s]; o.selected = s === value; gLib.appendChild(o); });
  sel.append(gText, gLib);
}

function btn(label: string, f: string, cls = "btn quiet", title?: string): HTMLButtonElement {
  const b = document.createElement("button"); b.type = "button"; b.className = cls; b.dataset.f = f; b.textContent = label; if (title) b.title = title;
  return b;
}

/** Paint controls: make or redo the AI picture, drop it, and see or edit its prompt. */
function paintRow(s: SceneRef, k: number): HTMLElement | null {
  const ready = imageReady(aiConfig());
  if (!ready && !s.img) return null;
  const row = document.createElement("div"); row.className = "mk-paint";
  const busy = painting.has(pkey(s));
  if (ready) { const b = btn(busy ? "Painting…" : s.img ? "Paint again" : "Paint with AI", "p-make", "btn"); b.disabled = busy; row.appendChild(b); }
  if (s.img) row.appendChild(btn("Use the drawing", "p-drop", "btn quiet", "Keep the drawn scene instead of the painting"));
  if (ready) {
    const det = document.createElement("details"), sum = document.createElement("summary"), ta = document.createElement("textarea");
    sum.textContent = s.prompt ? "Prompt (edited)" : "Prompt";
    ta.className = "mk-input"; ta.dataset.f = "p-prompt"; ta.setAttribute("aria-label", "Prompt for picture " + (k + 1));
    ta.value = s.prompt || briefFor(s).prompt;
    det.append(sum, ta); row.appendChild(det);
  }
  return row;
}

const isCover = (s: SceneRef): boolean => { const B = book(); return !!B.cover && B.scenes.find((x) => x.scene === B.cover) === s; };

function cardBody(s: SceneRef, k: number): HTMLElement {
  const B = book(), body = document.createElement("div"); body.className = "card-b"; body.id = "card-b-" + k;
  const sel = document.createElement("select"); sel.className = "mk-input"; sel.dataset.f = "scene"; sel.setAttribute("aria-label", "Scene for picture " + (k + 1)); sceneOptions(sel, s.scene);
  const capIn = document.createElement("input"); capIn.className = "mk-input cap"; capIn.dataset.f = "cap"; capIn.value = s.caption;
  capIn.setAttribute("aria-label", "Caption for picture " + (k + 1)); capIn.placeholder = "Caption: words quoted from the text";
  const msg = document.createElement("p"); msg.className = "cap-msg"; msg.id = "cap-msg-" + k; msg.hidden = true;
  capIn.setAttribute("aria-describedby", msg.id);
  body.append(sel, capIn, msg);
  const q = document.createElement("div"); q.className = "card-q";
  if (s.quote) {
    const bq = document.createElement("blockquote"); bq.textContent = clip(shown(s.quote), 220);
    const lbl = document.createElement("span"); lbl.textContent = "Drawn from these words";
    q.append(lbl, bq, btn("Choose other words", "q-pick", "btn quiet", "Select other words in the book for this picture"));
  } else {
    const lbl = document.createElement("span"); lbl.textContent = "Drawn from the whole paragraph";
    q.append(lbl, btn("Choose the words", "q-pick", "btn quiet", "Select the words in the book this picture should show"));
  }
  body.appendChild(q);
  const sp = decode(s.scene);
  if (sp) {
    const ed = pictureEditor(s.scene, sp, {
      edit: (fn) => editSpec(k, fn),
      reread: () => decode(composeFor(s.after, s.quote)),
      large: () => hooks.openLarge(k),
      mark: () => sess.preview.send({ type: "scroll", block: s.after, picture: true }),
    });
    editors.push(ed.stop);
    body.appendChild(ed.el);
  }
  const pr = paintRow(s, k);
  if (pr) body.appendChild(pr);
  const mv = canMove(B.blocks, s), busy = painting.has(pkey(s));
  const acts = document.createElement("div"); acts.className = "card-acts";
  const up = btn("Up", "mv-up", "btn quiet", "Move this picture up one paragraph"), dn = btn("Down", "mv-dn", "btn quiet", "Move this picture down one paragraph");
  up.disabled = !mv.up || busy; dn.disabled = !mv.down || busy;
  const show = btn("Show in book", "go"), cov = btn(isCover(s) ? "Not the cover" : "Use as cover", "cov"), x = btn("Remove", "x");
  cov.setAttribute("aria-pressed", String(isCover(s)));
  acts.append(show, up, dn, cov, x);
  body.appendChild(acts);
  return body;
}

/** The players of open editors, stopped when the list is drawn again. */
const editors: (() => void)[] = [];

export function renderScenes(): void {
  editors.splice(0).forEach((stop) => stop());
  let specs: ReturnType<typeof trackSpecs> = []; try { specs = trackSpecs(book().blocks); } catch { /* chips are optional */ }
  const B = book(), list = $("mkScenes");
  // Keep keyboard focus on the same control through the rebuild (buttons and selects, not text fields).
  const ae = document.activeElement as HTMLElement | null, keepF = ae && list.contains(ae) && ae.dataset.f && !/^(INPUT|TEXTAREA)$/.test(ae.tagName) ? ae.dataset.f : "";
  list.textContent = "";
  const by = ({ hand: "placed by hand", auto: "placed automatically at the scene changes in your text", claude: "staged by AI" } as Record<string, string>)[B.source] || "";
  if (!hasText()) { sceneNote("Add some text first."); return; }
  const nComp = B.scenes.filter((s) => decode(s.scene)).length, nImg = B.scenes.filter((s) => s.img && sess.images[s.img]).length;
  const extra = (nComp ? ", " + nComp + " composed from the text" : "") + (nImg ? ", " + nImg + " painted" : "");
  if (!$("mkSceneNote").classList.contains("warn")) sceneNote(B.scenes.length ? plural(B.scenes.length, "picture") + ", " + by + extra + "." : "No pictures yet.");
  if (!B.scenes.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = "Place them automatically, or click a paragraph in the book and add one there."; list.appendChild(li); }
  let found = false;
  B.scenes.forEach((s, k) => {
    const li = document.createElement("li"); li.dataset.k = String(k);
    const open = pkey(s) === openKey && !found; if (open) found = true;
    li.className = [open ? "open" : "", painting.has(pkey(s)) ? "busy" : "", k === hereK ? "here" : "", isCover(s) ? "is-cover" : ""].filter(Boolean).join(" ");
    const head = document.createElement("button"); head.type = "button"; head.className = "card-h"; head.dataset.f = "card-h";
    head.setAttribute("aria-expanded", String(open)); head.setAttribute("aria-controls", "card-b-" + k);
    const th = document.createElement("span"); th.className = "th";
    const src = s.img && sess.images[s.img];
    if (src) { const im = document.createElement("img"); im.src = src; im.alt = ""; th.appendChild(im); const ai = document.createElement("b"); ai.className = "ai"; ai.textContent = "AI"; th.appendChild(ai); }
    else th.innerHTML = thumb(s.scene);
    const n = document.createElement("i"); n.textContent = NUM[k] || String(k + 1); th.appendChild(n);
    const t = document.createElement("span"); t.className = "card-t";
    const c = document.createElement("span"); c.className = "card-cap"; c.textContent = s.caption || "No caption";
    const m = document.createElement("span"); m.className = "card-m"; m.textContent = "¶ " + pNumber(s.after) + (isCover(s) ? " · Cover" : "");
    const rd = decode(s.scene) || specs[s.after];
    if (rd) [rd.place === "inner" ? (rd.acts?.length ? "stage" : "") : LABEL.place[rd.place].replace(/^(a|an|the) /, ""), rd.time].filter(Boolean).forEach((x) => { const g = document.createElement("b"); g.className = "card-tag"; g.textContent = x; m.appendChild(g); });
    const acting = actsSummary(decode(s.scene));
    if (acting) { const ac = document.createElement("span"); ac.className = "card-act"; ac.textContent = acting; t.append(c, ac, m); } else t.append(c, m);
    head.append(th, t); li.appendChild(head);
    if (open) li.appendChild(cardBody(s, k));
    list.appendChild(li);
  });
  renderRemoved(list);
  if (!found) openKey = "";
  if (keepF) {
    const li = list.querySelector("li.open") || null;
    const el = (li && (li.querySelector<HTMLElement>('[data-f="' + keepF + '"]:not(:disabled)') || li.querySelector<HTMLElement>('[data-f="card-h"]'))) as HTMLElement | null;
    if (el) el.focus({ preventScroll: true });
  }
}

/** Open one card (closing the others) and bring it into view. */
export function openCard(k: number, focus = false): void {
  const s = book().scenes[k];
  if (!s) return;
  openKey = pkey(s);
  renderScenes();
  const li = $("mkScenes").querySelector<HTMLElement>('li[data-k="' + k + '"]');
  if (li) { li.scrollIntoView({ block: "nearest" }); if (focus) li.querySelector<HTMLElement>(".card-h")!.focus({ preventScroll: true }); }
}

/** The reading point in the book is on picture k (-1 for none): mark that card. */
export function setHere(k: number): void {
  if (k === hereK) return;
  hereK = k;
  const list = $("mkScenes");
  list.querySelectorAll("li.here").forEach((l) => l.classList.remove("here"));
  const li = k >= 0 ? list.querySelector<HTMLElement>('li[data-k="' + k + '"]') : null;
  if (!li) return;
  li.classList.add("here");
  if (li.offsetParent && !list.contains(document.activeElement)) li.scrollIntoView({ block: "nearest" });
}

/* ---------------- editing ---------------- */
export function editSpec(k: number, fn: (sp: Spec) => Spec): void {
  const B = book(), s = B.scenes[k], sp = s && decode(s.scene);
  if (!sp) return;
  checkpoint();
  const old = s.scene;
  s.scene = encode(fn(sp));
  if (B.cover === old) B.cover = s.scene;
  openKey = pkey(s);
  // A painting and its prompt describe the old scene: set them aside (Undo brings them back).
  const had = !!s.img;
  delete s.img; delete s.prompt;
  commitScenes(B.scenes);
  if (had) toast("The painting was for the old scene, so the drawing shows now. Paint again for the new one.", false, UNDO);
}

/** Take picture k out (undoable; it is listed under Removed, to restore). */
export function removePicture(k: number): void {
  const B = book(), s = B.scenes[k];
  if (!s) return;
  checkpoint(); noteRemoved(s); B.scenes.splice(k, 1); commitScenes(B.scenes);
  toast("Removed picture " + (k + 1) + ".", false, UNDO);
}

/** Add a picture after paragraph `i` (a composed scene read from the passage) and open its card. */
export function addPictureAfter(i: number): void {
  const B = book(), scene = composeFor(i);
  if (!B.blocks[i] || B.blocks[i].type === "h") return;
  checkpoint();
  const ref: SceneRef = { after: i, scene, caption: captionFor(B.blocks[i].text, scene) };
  openKey = pkey(ref);
  commitScenes([...B.scenes, ref]);
  const k = book().scenes.findIndex((x) => pkey(x) === openKey);
  toast("Added a picture after paragraph " + pNumber(i) + ".", false, UNDO);
  if (!narrow()) { setPane("manuscript", "pictures"); openCard(k); }
  sess.preview.send({ type: "scroll", block: i, picture: true });
}

export function moveCard(k: number, dir: -1 | 1): void {
  const B = book(), m = movePicture(B.blocks, B.scenes, k, dir);
  if (!m) return;
  checkpoint();
  openKey = pkey(m.scenes[m.index]);
  commitScenes(m.scenes);
  const s = book().scenes.find((x) => pkey(x) === openKey);
  toast("Moved to paragraph " + pNumber(s ? s.after : B.scenes[k].after) + (m.recaptioned ? ". The caption was taken again from that paragraph." : "."), false, UNDO);
  if (s) sess.preview.send({ type: "scroll", block: s.after, picture: true });
}

function badCaption(inp: HTMLInputElement, v: string, was: string): void {
  const k = inp.closest("li")!.dataset.k, msg = $("cap-msg-" + k);
  inp.setAttribute("aria-invalid", "true");
  msg.hidden = false; msg.textContent = "Not a quote. “" + (v.length > 36 ? v.slice(0, 36) + "…" : v) + "” isn’t in the text just before this picture, so the caption stays as it was.";
  inp.value = was;
}
function okCaption(inp: HTMLInputElement): void {
  inp.removeAttribute("aria-invalid");
  const k = inp.closest("li")!.dataset.k, msg = $("cap-msg-" + k); if (msg) msg.hidden = true;
}

export function initScenes(): void {
  const list = $("mkScenes");
  list.addEventListener("input", (e) => { const t = e.target as HTMLInputElement; if (t.classList.contains("cap")) okCaption(t); });
  list.addEventListener("change", (e) => {
    const t = e.target as HTMLElement, li = t.closest("li"), B = book();
    if (!li || li.dataset.k == null) return;
    const k = +li.dataset.k, s = B.scenes[k], f = t.dataset.f || "";
    if (f === "scene") {
      checkpoint();
      const v = (t as HTMLSelectElement).value, old = s.scene;
      s.scene = v === COMPOSE ? composeFor(s.after, s.quote) : v;
      if (B.cover === old) B.cover = s.scene;
      openKey = pkey(s);
      delete s.img; delete s.prompt;
      commitScenes(B.scenes);
    } else if (f === "p-prompt") {
      const v = (t as HTMLTextAreaElement).value.trim();
      if (v && v !== briefFor({ ...s, prompt: undefined }).prompt) s.prompt = v.slice(0, 1200); else delete s.prompt;
      commitScenes(B.scenes);
    } else if (f === "cap") {
      const v = (t as HTMLInputElement).value.trim();
      if (v === s.caption) { okCaption(t as HTMLInputElement); return; }
      if (captionIsQuoted(v, B.blocks, s.after)) { checkpoint(); s.caption = v; commitScenes(B.scenes); }
      else badCaption(t as HTMLInputElement, v, s.caption);
    }
  });
  list.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"), li = b && b.closest("li");
    if (!b || !li || li.dataset.k == null) return;
    const k = +li.dataset.k, B = book(), s = B.scenes[k], f = b.dataset.f || "";
    if (f === "card-h") { if (li.classList.contains("open")) { openKey = ""; renderScenes(); (list.querySelector(`li[data-k="${k}"] .card-h`) as HTMLElement).focus({ preventScroll: true }); } else openCard(k, true); return; }
    if (f === "x") removePicture(k);
    else if (f === "go") { sess.preview.send({ type: "scroll", block: s.after, picture: true }); if (narrow()) setPane("book"); }
    else if (f === "mv-up") moveCard(k, -1);
    else if (f === "mv-dn") moveCard(k, 1);
    else if (f === "cov") {
      checkpoint();
      if (isCover(s)) { delete B.cover; toast("The cover is chosen by the book again.", false, UNDO); }
      else { B.cover = s.scene; toast("Picture " + (NUM[k] || k + 1) + " is the cover.", false, UNDO); }
      commitScenes(B.scenes);
    }
    else if (f === "q-pick") hooks.armWords(k);
    else if (f === "p-make") paint(s).catch(() => {});
    else if (f === "p-drop") { checkpoint(); delete s.img; commitScenes(B.scenes); toast("Back to the drawn scene. The painting is kept until it is no longer needed.", false, UNDO); }
  });

  $("mkAuto").addEventListener("click", () => {
    const B = book(), had = B.scenes.length && B.source !== "auto";
    if (B.scenes.length) checkpoint();
    B.scenes = autoStage(B.blocks, state.settings.density, state.settings.art); B.source = "auto"; delete B.beats;
    clearWarn(); hooks.refresh();
    if (had) toast("Placed " + plural(B.scenes.length, "picture") + " automatically.", false, UNDO);
  });
  $("mkClear").addEventListener("click", () => { checkpoint(); commitScenes([]); toast("Removed every picture. The text reads on its own.", false, UNDO); });
  $("mkAsk").addEventListener("click", stageWithAi);
  $("mkStop").addEventListener("click", stopAll);
  $("mkPaintAll").addEventListener("click", () => { paintAll().catch(() => {}); });
  $("mkAiOpen").addEventListener("click", openAi);
}
