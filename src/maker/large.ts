// One picture, large: the picture playing with its timeline, the words it was drawn from and what
// happens in it, and the pictures before and after it a key away (arrows). Opened from a card, the
// inspector, or a storyboard frame.
import { decode, describe } from "../compose/spec";
import { sceneLabel } from "../compose";
import { shown } from "../stage/locate";
import { cap, clip, esc } from "../text/strings";
import type { Player } from "../renderers/player";
import { actsSummary, stage } from "./pictureEdit";
import { openCard, pNumber } from "./pictures";
import { $, book, hooks, sess } from "./session";
import { setPane } from "./ui";

let at = -1, pl: Player | null = null;

function show(k: number): void {
  const B = book(), s = B.scenes[k], dlg = $("mkLarge") as HTMLDialogElement;
  if (!s) return;
  at = k;
  pl?.stop();
  const sp = decode(s.scene), what = actsSummary(sp);
  dlg.innerHTML = `<header><b id="mkLgTitle">Picture ${k + 1} <span>of ${B.scenes.length}</span></b><span class="lg-m">Paragraph ${pNumber(s.after)}</span>` +
    `<button type="button" class="mk-icon" data-l="prev" aria-label="Picture before"${k > 0 ? "" : " disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>` +
    `<button type="button" class="mk-icon" data-l="next" aria-label="Picture after"${k < B.scenes.length - 1 ? "" : " disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>` +
    `<button type="button" class="mk-icon" data-l="close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>` +
    `<div class="lg-stage pe-stage big"></div>` +
    `<div class="lg-t"><p class="lg-cap">${esc(s.caption)}</p>` +
    (what ? `<p class="lg-what">${esc(what)}.</p>` : "") +
    `<p class="lg-d">${esc(cap(sp ? describe(sp) : sceneLabel(s.scene)))}.</p>` +
    (s.quote ? `<blockquote>${esc(clip(shown(s.quote), 400))}</blockquote>` : "") +
    `<div class="lg-acts"><button type="button" class="btn" data-l="book">Show in book</button><button type="button" class="btn" data-l="edit">Edit</button></div></div>`;
  pl = stage(dlg.querySelector<HTMLElement>(".lg-stage")!, s.scene, sp, cap(sp ? describe(sp) : sceneLabel(s.scene)), { big: true });
  if (!dlg.open) dlg.showModal();
}

export function openLarge(k: number): void { show(k); }

export function initLarge(): void {
  hooks.openLarge = openLarge;
  const dlg = $("mkLarge") as HTMLDialogElement;
  dlg.addEventListener("close", () => { pl?.stop(); pl = null; dlg.innerHTML = ""; });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) { dlg.close(); return; }
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-l]");
    if (!b) return;
    const a = b.dataset.l;
    if (a === "close") dlg.close();
    else if (a === "prev") show(at - 1);
    else if (a === "next") show(at + 1);
    else if (a === "book") { const s = book().scenes[at]; dlg.close(); if (s) sess.preview.send({ type: "scroll", block: s.after, picture: true }); }
    else if (a === "edit") { const k = at; dlg.close(); setPane("manuscript", "pictures"); openCard(k, true); }
  });
  dlg.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest(".pe-track")) return;
    if (e.key === "ArrowLeft" && at > 0) { e.preventDefault(); show(at - 1); }
    if (e.key === "ArrowRight" && at < book().scenes.length - 1) { e.preventDefault(); show(at + 1); }
  });
}
