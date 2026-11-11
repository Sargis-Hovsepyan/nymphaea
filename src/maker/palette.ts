// The command bar: one input over the text, the chapters, the places and the Studio's actions.
// Opens with Ctrl/⌘+K or the top-bar button, closes with Escape. Arrow keys move, Enter runs.
import { LABEL, encode, type Place } from "../compose/spec";
import { PRESETS } from "../design/presets";
import { plain } from "../inline";
import { DENS, NUM } from "../settings";
import { captionFor } from "../stage/auto";
import { state } from "../state";
import type { Density, SceneRef, Style } from "../types";
import { concreteness, evidence } from "../compose/read";
import { STYLE_NAME, setOpt } from "./design";
import { norm, placeHits, placePlan, placeRuns, rank, textHits, type Snip } from "./find";
import { showInBook } from "./goto";
import { $, book, commitScenes, hasText, hooks, plural } from "./session";
import { chapterBlocks, specsOf } from "./suggest";
import { studioMode } from "./studio";
import { checkpoint, undo, UNDO } from "./undo";
import { closeOnBackdrop, openExport, setPane, toast } from "./ui";
import { VIEWS, currentView, setView, type View } from "./views";

interface Item { group: string; label: string; hint?: string; snip?: Snip; run: () => void; id: string }

const VIEW_NAME: Record<View, string> = { book: "Book", board: "Storyboard", line: "Story line", compare: "Compare" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const roman = (n: number): string => NUM[n - 1] || String(n);

/** Everything the palette can do, built fresh each time it opens. */
function actions(): Item[] {
  const ok = hasText(), S = state.settings, out: Item[] = [];
  const add = (label: string, hint: string, run: () => void, keys = "") => out.push({ group: "Actions", label, hint, run, id: "a:" + label + keys });
  if (ok) add("Export the book", "⌘E", () => { hooks.refresh(); openExport(); }, " download epub print");
  VIEWS.filter((v) => v !== currentView()).forEach((v) => add("Show the " + VIEW_NAME[v], "View", () => setView(v), " switch view"));
  if (ok) add("Place pictures automatically", "Pictures", () => $("mkAuto").click(), " auto stage");
  (["few", "some", "many"] as Density[]).forEach((d) => { if (S.density !== d) add(cap(d) + " pictures", "About one per " + DENS[d] + " words", () => setOpt("density", d), " density amount how many"); });
  (Object.keys(STYLE_NAME) as Style[]).forEach((s) => { if (S.style !== s) add(s === "none" ? "No pictures in the book" : STYLE_NAME[s] + " picture style", "Style", () => setOpt("style", s), " art look"); });
  PRESETS.forEach((p) => { if (S.preset !== p.id) add(p.name + " edition", "Edition", () => { const b = document.querySelector<HTMLElement>('#mkPresets button[data-preset="' + p.id + '"]'); if (b) b.click(); }, " look theme"); });
  const mode = (m: "light" | "dark") => { for (let i = 0; i < 3 && studioMode() !== m; i++) document.querySelector<HTMLElement>(".mk-mode")?.click(); };
  if (studioMode() !== "light") add("Switch the Studio to light", "Colours", () => mode("light"), " mode theme day");
  if (studioMode() !== "dark") add("Switch the Studio to dark", "Colours", () => mode("dark"), " mode theme night");
  add("Open the text editor", "Text", () => setPane("manuscript", "text"), " markdown write");
  add("Undo the last change", "⌘Z", undo);
  return out;
}

/** Add a picture at one passage in each stretch set in `place` that has none. */
export function addAtPlace(place: Place): number {
  const B = book(), specs = specsOf(B.blocks), runs = placeRuns(specs, place);
  const pictured = new Set(B.scenes.map((s) => s.after));
  const score = (i: number) => concreteness(evidence(B.blocks[i].text));
  const plan = placePlan(runs, pictured, score);
  if (!plan.length) return 0;
  checkpoint();
  const fresh: SceneRef[] = plan.map((i) => { const sp = specs[i]!, scene = encode(sp); return { after: i, scene, caption: captionFor(B.blocks[i].text, scene) }; });
  commitScenes([...B.scenes, ...fresh]);
  return plan.length;
}

let items: Item[] = [], flat: Item[] = [], active = 0, input: HTMLInputElement, list: HTMLElement, live: HTMLElement, dlg: HTMLDialogElement, made = false;

function search(q: string): Item[] {
  const B = book(), query = norm(q), out: Item[] = [];
  const chapters = chapterBlocks(B.blocks);
  const heads = B.blocks.map((b, i) => ({ b, i })).filter((x) => x.b.type === "h");
  const chItems: Item[] = heads.map((h) => {
    const n = chapters.indexOf(h.i), title = plain(h.b.text);
    return { group: "Chapters", label: title, hint: n >= 0 ? "Chapter " + roman(n + 1) : "Section", run: () => showInBook(h.i), id: "c:" + h.i };
  });
  if (!query) {
    out.push(...chItems.filter((c) => c.hint !== "Section").slice(0, 5));
    out.push(...items.slice(0, 8));
    return out;
  }
  if (query.length >= 2) textHits(B.blocks, query, 6).forEach((h) => out.push({ group: "In the text", label: "", snip: h.snip, hint: "¶ " + (B.blocks.slice(0, h.block + 1).filter((b) => b.type !== "h").length) + (h.count > 1 ? " · " + h.count + "×" : ""), run: () => showInBook(h.block), id: "t:" + h.block }));
  out.push(...rank(chItems, query, (c) => c.label, 5));
  const names = (p: Place) => p + " " + LABEL.place[p].replace(/^(a|an|the) /, "");
  placeHits(specsOf(B.blocks), query, names, 2).forEach((h) => {
    const todo = placePlan(h.runs, new Set(B.scenes.map((s) => s.after)), () => 0).length, name = cap(h.place);
    out.push({ group: "Places", label: name, hint: plural(h.passages, "passage") + " in " + plural(h.runs.length, "stretch", "stretches"), run: () => showInBook(h.runs[0].from), id: "p:" + h.place });
    out.push({ group: "Places", label: "Add a picture at every passage set in " + h.place, hint: todo ? plural(todo, "new picture") : "Every stretch has one", id: "pa:" + h.place,
      run: () => { const n = addAtPlace(h.place); toast(n ? "Added " + plural(n, "picture") + " in " + h.place + " passages." : "Every stretch set in " + h.place + " already has a picture.", false, n ? UNDO : undefined); } });
  });
  out.push(...rank(items, query, (a) => a.label + " " + a.id, 6));
  return out;
}

function draw(): void {
  const found = search(input.value);
  flat = found;
  if (active >= flat.length) active = Math.max(0, flat.length - 1);
  list.textContent = "";
  if (!flat.length) {
    const p = document.createElement("p"); p.className = "pl-none"; p.textContent = hasText() ? "Nothing matches “" + input.value.trim() + "”." : "Add some text to search it.";
    list.appendChild(p); input.removeAttribute("aria-activedescendant"); live.textContent = "No results"; return;
  }
  let group = "", box: HTMLElement | null = null;
  flat.forEach((it, i) => {
    if (it.group !== group) {
      group = it.group;
      box = document.createElement("div"); box.className = "pl-group"; box.setAttribute("role", "group");
      const h = document.createElement("div"); h.className = "pl-gh"; h.id = "plg-" + i; h.textContent = group; box.setAttribute("aria-labelledby", h.id);
      box.appendChild(h); list.appendChild(box);
    }
    const li = document.createElement("div"); li.className = "pl-item"; li.id = "pl-" + i; li.setAttribute("role", "option"); li.dataset.i = String(i);
    li.setAttribute("aria-selected", String(i === active));
    const t = document.createElement("span"); t.className = "pl-t";
    if (it.snip) { t.classList.add("snip"); const b = document.createElement("b"); b.textContent = it.snip.match; t.append(it.snip.before, b, it.snip.after); }
    else t.textContent = it.label;
    li.appendChild(t);
    if (it.hint) { const e = document.createElement("em"); e.textContent = it.hint; li.appendChild(e); }
    box!.appendChild(li);
  });
  input.setAttribute("aria-activedescendant", "pl-" + active);
  live.textContent = plural(flat.length, "result");
}

function mark(): void {
  list.querySelectorAll<HTMLElement>(".pl-item").forEach((li) => li.setAttribute("aria-selected", String(+(li.dataset.i || -1) === active)));
  const cur = $("pl-" + active); input.setAttribute("aria-activedescendant", "pl-" + active); cur?.scrollIntoView({ block: "nearest" });
}

function run(i: number): void {
  const it = flat[i];
  if (!it) return;
  dlg.close();
  it.run();
}

function make(): void {
  made = true;
  dlg = $<HTMLDialogElement>("mkPalette");
  dlg.innerHTML = '<div class="pl-in"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>'
    + '<input id="mkPalIn" type="text" role="combobox" aria-expanded="true" aria-controls="mkPalList" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Find words, places, actions" aria-label="Find words, places, actions"><kbd>Esc</kbd></div>'
    + '<div class="pl-list" id="mkPalList" role="listbox" aria-label="Results"></div><p class="sr-only" id="mkPalLive" role="status" aria-live="polite"></p>';
  input = $<HTMLInputElement>("mkPalIn"); list = $("mkPalList"); live = $("mkPalLive");
  input.addEventListener("input", () => { active = 0; draw(); });
  input.addEventListener("keydown", (e) => {
    const n = flat.length;
    if (e.key === "ArrowDown") { e.preventDefault(); if (n) { active = (active + 1) % n; mark(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (n) { active = (active + n - 1) % n; mark(); } }
    else if (e.key === "Home" && !input.value) { e.preventDefault(); active = 0; mark(); }
    else if (e.key === "End" && !input.value) { e.preventDefault(); active = Math.max(0, n - 1); mark(); }
    else if (e.key === "Enter") { e.preventDefault(); run(active); }
  });
  list.addEventListener("mousemove", (e) => { const li = (e.target as HTMLElement).closest<HTMLElement>(".pl-item"); if (li && +(li.dataset.i || 0) !== active) { active = +(li.dataset.i || 0); mark(); } });
  list.addEventListener("click", (e) => { const li = (e.target as HTMLElement).closest<HTMLElement>(".pl-item"); if (li) run(+(li.dataset.i || 0)); });
  closeOnBackdrop(dlg);
}

export function openPalette(): void {
  if ($("mkWork").hidden) return;
  if (!made) make();
  items = actions();
  input.value = ""; active = 0;
  if (!dlg.open) dlg.showModal();
  draw();
  input.focus();
}

export function initPalette(): void {
  $("mkCmdBtn").addEventListener("click", openPalette);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (made && dlg.open) dlg.close(); else openPalette();
    }
  });
}
