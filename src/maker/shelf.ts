// The landing page and the bookshelf. Books are kept in IndexedDB (see shelfStore.ts); the one being
// edited is also mirrored to localStorage. "New book" and opening a file put the current book on the
// shelf first. The shelf is also where unused paintings are swept up.
import { DRAFT_KEY } from "../brand";
import { deleteImages, getImage, listImageIds } from "../ai/store";
import { load } from "../store";
import { applyDraft, blankBook, flushDraft, saveDraft, watchShelf } from "./draft";
import { mountLanding } from "./landing";
import { referenced, unreferenced } from "./gc";
import { migrateDraft, type Shelved } from "./shelfData";
import { deleteBook, listBooks, putBook } from "./shelfStore";
import { $, book, hasText, hooks, plural, sess } from "./session";
import { thumb } from "./studio";
import { undoScenes } from "./undo";
import { setPane, type Pane, type Tab } from "./ui";
import { asDraft } from "./shelfData";

export function landingOpen(): boolean { return !$("mkLanding").hidden; }

export function showLanding(): void {
  $("mkLanding").hidden = false;
  ($("mkWork") as HTMLElement & { inert: boolean }).inert = true;
  $("mkBack").hidden = !hasText();
  mountLanding(sess.pristine);
  $("mkLanding").scrollTop = 0;
  renderShelf();
}
export function showWork(pane: Pane = "manuscript", tab?: Tab): void {
  $("mkLanding").hidden = true;
  ($("mkWork") as HTMLElement & { inert: boolean }).inert = false;
  setPane(pane, tab);
}

/** Put the book being edited on the shelf and start an empty one. */
export async function newBook(): Promise<void> {
  await flushDraft();
  blankBook();
  saveDraft();
  hooks.refresh();
}

async function openBook(b: Shelved): Promise<void> {
  if (b.id !== sess.id) {
    await flushDraft();
    applyDraft({ ...b.draft, id: b.id });
    saveDraft();
    hooks.refresh();
    sess.preview.send({ type: "top" });
  }
  showWork("manuscript", "text");
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function card(b: Shelved, list: HTMLElement): HTMLElement {
  const li = document.createElement("li"); li.className = "bk"; if (b.id === sess.id) li.classList.add("now");
  const show = () => {
    li.textContent = "";
    const open = document.createElement("button"); open.type = "button"; open.className = "bk-open";
    const th = document.createElement("span"); th.className = "th";
    if (b.pic) {
      if (b.pic.img) getImage(b.pic.img).then((d) => { if (d) { const im = document.createElement("img"); im.src = d; im.alt = ""; th.textContent = ""; th.appendChild(im); } });
      th.innerHTML = thumb(b.pic.scene);
    }
    const t = document.createElement("span"); t.className = "bk-t";
    const name = document.createElement("b"); name.textContent = b.title;
    const meta = document.createElement("span"); meta.textContent = fmtDate(b.updated) + " · " + plural(b.words, "word") + (b.id === sess.id ? " · Open now" : "");
    t.append(name, meta); open.append(th, t);
    open.setAttribute("aria-label", "Open " + b.title);
    open.addEventListener("click", () => { openBook(b); });
    const del = document.createElement("button"); del.type = "button"; del.className = "bk-del"; del.setAttribute("aria-label", "Delete " + b.title); del.title = "Delete this book";
    del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    del.addEventListener("click", ask);
    li.append(open, del);
  };
  const ask = () => {
    li.textContent = "";
    const p = document.createElement("p"); p.className = "bk-q"; p.textContent = "Delete “" + (b.title.length > 40 ? b.title.slice(0, 40) + "…" : b.title) + "”? This can’t be undone.";
    p.id = "bk-q-" + b.id;
    const row = document.createElement("div"); row.className = "row";
    const yes = document.createElement("button"); yes.type = "button"; yes.className = "btn danger"; yes.textContent = "Delete";
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Keep";
    no.addEventListener("click", () => { show(); (li.querySelector(".bk-del") as HTMLElement).focus(); });
    yes.addEventListener("click", async () => {
      const wasNow = b.id === sess.id;
      await deleteBook(b.id);
      if (wasNow) { blankBook(); saveDraft(); hooks.refresh(); $("mkBack").hidden = true; }
      await renderShelf();
      sweepPaintings();
      const first = list.querySelector<HTMLElement>(".bk-open"); if (first) first.focus(); else $("mkSample").focus();
    });
    row.append(yes, no); li.append(p, row);
    li.setAttribute("role", "group"); li.setAttribute("aria-labelledby", p.id);
    no.focus();
  };
  show();
  return li;
}

export async function renderShelf(): Promise<void> {
  const box = $("mkShelf"), list = $("mkShelfList");
  if (hasText()) await flushDraft();
  const { books } = await listBooks();
  const shown = books.filter((b) => b.draft && b.draft.md && b.draft.md.trim());
  box.hidden = !shown.length;
  list.textContent = "";
  shown.forEach((b) => list.appendChild(card(b, list)));
}

/** Delete paintings nothing uses any more: not the draft, a shelved book, or an undo step. */
export async function sweepPaintings(): Promise<void> {
  const { books, ok } = await listBooks();
  if (!ok) return;
  const other = asDraft(load<unknown>(DRAFT_KEY));
  const keep = referenced(book().scenes, other ? other.scenes : [], ...books.map((b) => b.draft.scenes), ...undoScenes());
  const gone = unreferenced(await listImageIds(), keep);
  if (gone.length) { await deleteImages(gone); gone.forEach((id) => { delete sess.images[id]; }); }
}

let sweepTimer = 0;
const later = () => { clearTimeout(sweepTimer); sweepTimer = window.setTimeout(() => { sweepPaintings(); }, 8000); };

/** Carry the old single draft onto the shelf (first run), and keep the shelf and the cleanup running. */
export async function initShelf(): Promise<void> {
  watchShelf(later);
  const { books } = await listBooks();
  const m = migrateDraft(load<unknown>(DRAFT_KEY), books.map((b) => b.id));
  if (m) await putBook(m);
  window.addEventListener("pagehide", () => { flushDraft(); });
  window.setTimeout(() => { sweepPaintings(); }, 4000);
}
