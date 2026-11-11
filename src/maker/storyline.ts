// The Story line: the hour, place, weather, season and mood of the whole text as bands sized by
// words, and below them the chapters as stations with pictures as stops. Stretches with no picture
// for much longer than the density asks are marked in the warning colour.
import { decode } from "../compose/spec";
import { NUM } from "../settings";
import { captionFor } from "../stage/auto";
import { state } from "../state";
import { showInBook } from "./goto";
import { lineModel, type Band } from "./lineModel";
import { composeFor } from "./pictures";
import { $, book, hasText, plural, sess } from "./session";
import { currentSuggestions, specsOf } from "./suggest";
import { thumb } from "./studio";
import { registerView } from "./views";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e;
};
const roman = (n: number): string => NUM[n - 1] || String(n);
const fmt = (n: number): string => n.toLocaleString();
const hash = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

const MIN_W = 880, MAX_W = 6000, THUMB_GAP = 96;

function strip(b: Band, W: number, total: number): HTMLElement {
  const row = el("div", "sl-strip"); row.dataset.band = b.id; row.style.width = W + "px";
  b.segs.forEach((s) => {
    const x = (s.start / total) * W, w = Math.max(2, (s.words / total) * W - 2);
    const bt = el("button", "sl-seg"); bt.type = "button"; bt.dataset.b = String(s.from); bt.dataset.v = s.key;
    bt.dataset.t = String(b.id === "place" || b.id === "season" ? hash(s.key) % 5 : 0);
    bt.style.left = x + "px"; bt.style.width = w + "px";
    bt.title = b.name + " " + s.label.toLowerCase() + ", " + plural(s.words, "word");
    bt.setAttribute("aria-label", bt.title + ". Show in the book.");
    if (w > 46) bt.appendChild(el("span", "", s.label));
    row.appendChild(bt);
  });
  return row;
}

function render(): void {
  const root = $("viewLine"), B = book();
  const keep = root.querySelector<HTMLElement>(".sl-scroll")?.scrollLeft || 0;
  root.textContent = ""; root.classList.add("sl");
  if (!hasText()) {
    const e = el("div", "vw-empty");
    e.append(el("h3", "", "The story line shows how your story moves"), el("p", "", "Add a story and this view reads it for the hour, the place, the weather and the mood, then lays the chapters and pictures along one line. Long stretches without a picture are marked."));
    root.appendChild(e); return;
  }
  const specs = specsOf(B.blocks), sugg = currentSuggestions();
  const m = lineModel(B.blocks, B.scenes, specs, sugg, state.settings.density, (s) => { try { return captionFor(B.blocks[s.block].text, composeFor(s.block)); } catch { return ""; } });
  if (!m.total) return;
  const W = Math.min(MAX_W, Math.max(MIN_W, Math.round(m.total * 0.3)));
  const x = (pos: number) => (pos / m.total) * W;

  const card = el("section", "sl-card");
  const head = el("div", "sl-head");
  head.append(el("h4", "", "Across the text"), el("span", "", plural(m.total, "word") + (m.stations.length ? " · " + plural(m.stations.length, "chapter") : "") + " · " + plural(B.scenes.length, "picture")));
  const grid = el("div", "sl-grid");
  const keys = el("div", "sl-keys"), sc = el("div", "sl-scroll"), inner = el("div", "sl-inner"); inner.style.width = (W + 24) + "px";
  sc.tabIndex = 0; sc.setAttribute("role", "group"); sc.setAttribute("aria-label", "Story line, scrolls sideways");

  m.bands.forEach((b) => { keys.appendChild(el("span", "sl-key", b.name)); inner.appendChild(strip(b, W, m.total)); });

  // The line: thumbnails over it, stations on it, labels under it.
  const track = el("div", "sl-track");
  const line = el("div", "sl-ln"); track.appendChild(line);
  m.gaps.forEach((g) => {
    const gp = el("div", "sl-gap"); gp.style.left = x(g.start) + "px"; gp.style.width = Math.max(4, x(g.end) - x(g.start)) + "px";
    gp.title = plural(g.words, "word") + " without a picture";
    const lab = el("span", "sl-gapl", fmt(g.words) + " words without a picture");
    gp.appendChild(lab); track.appendChild(gp);
  });
  // thumbnails: only as many as fit
  let lastShown = -1e9;
  m.stops.forEach((s) => {
    const px = x(s.pos);
    const bt = el("button", "sl-stop" + (s.suggested ? " ghost" : ""));
    bt.type = "button"; bt.dataset.b = String(s.block); bt.dataset.s = s.suggested ? "1" : "0";
    bt.style.left = px + "px";
    bt.title = (s.suggested ? "Suggested, strength " + (s.strength || 0).toFixed(2) + ". " : "") + (s.caption ? "“" + s.caption + "”" : "");
    bt.setAttribute("aria-label", (s.suggested ? "Suggested picture" : "Picture " + (s.k + 1)) + (s.caption ? ", " + s.caption : "") + ". Show in the book.");
    if (!s.suggested) {
      const mini = el("span", "sl-mini"); const sc2 = B.scenes[s.k];
      const src = sc2 && sc2.img && sess.images[sc2.img];
      if (src) { const im = document.createElement("img"); im.src = src; im.alt = ""; mini.appendChild(im); } else if (decode(s.scene) || s.scene) mini.innerHTML = thumb(s.scene);
      if (px - lastShown >= THUMB_GAP) { bt.classList.add("shown"); lastShown = px; }
      bt.appendChild(mini);
    }
    track.appendChild(bt);
  });
  // stations, labels on up to three rows so close chapters do not overlap
  const ends = [-1e9, -1e9, -1e9];
  if (!m.stations.length) m.stations.push({ block: 0, start: 0, title: "The whole book", num: 0 });
  m.stations.forEach((s) => {
    const px = x(s.start);
    const dot = el("button", "sl-stn"); dot.type = "button"; dot.dataset.b = String(s.block); dot.style.left = px + "px";
    dot.setAttribute("aria-label", (s.num ? "Chapter " + roman(s.num) + ", " : "") + s.title + ". Show in the book.");
    const label = s.title.length > 28 ? s.title.slice(0, 27) + "…" : s.title;
    const wpx = 30 + label.length * 6.6;
    let row = ends.findIndex((e) => px >= e + 8); if (row < 0) row = 0;
    ends[row] = px + wpx;
    const lb = el("span", "sl-stl"); lb.style.top = row * 18 + "px";
    if (s.num) lb.append(el("i", "", roman(s.num))); lb.append(label);
    dot.appendChild(lb);
    track.appendChild(dot);
  });
  const rows = ends.filter((e) => e > -1e8).length;
  const th = 118 + (rows ? rows * 18 + 8 : 0) + (m.gaps.length ? 34 : 0);
  track.style.height = th + "px"; track.style.setProperty("--gl", (rows * 18 + 30) + "px");
  keys.appendChild(el("span", "sl-key sl-key-track", "Chapters and pictures"));
  inner.appendChild(track);
  sc.appendChild(inner); grid.append(keys, sc);

  const legend = el("div", "sl-legend");
  const l1 = el("span", "", "A picture"), l2 = el("span", "", "A suggested picture"), l3 = el("span", "", "No picture for over " + fmt(m.limit) + " words");
  l1.prepend(el("i", "k-pic")); l2.prepend(el("i", "k-sug")); l3.prepend(el("i", "k-gap"));
  legend.append(l1, l2, l3);
  card.append(head, grid, legend);
  root.appendChild(card);
  sc.scrollLeft = keep;
}

export function initStoryline(): void {
  $("viewLine").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-b]");
    if (b) showInBook(+(b.dataset.b || 0), b.classList.contains("sl-stop") && b.dataset.s === "0");
  });
  registerView("line", render);
}
