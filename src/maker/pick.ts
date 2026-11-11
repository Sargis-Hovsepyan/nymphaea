// Clicking in the preview. A paragraph shows "Add a picture after this paragraph"; a picture opens
// its card. Scrolling the preview marks the card for the picture being read.
import { plain } from "../inline";
import { $, book, narrow } from "./session";
import { addPictureAfter, openCard, pNumber, setHere } from "./pictures";
import { jumpEditor } from "./textPane";
import { closeInspector, inspect } from "./bookNav";
import { setPane } from "./ui";

let at = -1, snippet = "";

const hide = (): void => { at = -1; $("mkPick").hidden = true; };

/** Drop the bar if the paragraph it pointed at has changed or gone. */
export function checkPick(): void {
  if (at < 0) return;
  const b = book().blocks[at];
  if (!b || plain(b.text).slice(0, 60) !== snippet) hide();
}

function show(i: number, fig: number): void {
  const B = book(), b = B.blocks[i];
  if (!b) return;
  at = i; snippet = plain(b.text).slice(0, 60);
  const isFig = fig >= 0, heading = b.type === "h";
  $("mkPickText").textContent = isFig ? "Picture " + (fig + 1) + ", after paragraph " + pNumber(i)
    : heading ? "That’s a heading. Pictures go after a paragraph."
    : "Paragraph " + pNumber(i) + (B.scenes.some((s) => s.after === i) ? ", which has a picture" : "") + ": “" + (snippet.length > 44 ? snippet.slice(0, 44) + "…" : snippet) + "”";
  $("mkPickAdd").hidden = isFig || heading;
  $("mkPickEdit").hidden = false;
  $("mkPickEdit").textContent = isFig ? "Edit picture" : "Edit text";
  $("mkPickEdit").dataset.fig = String(fig);
  $("mkPick").hidden = false;
}

/** A click in the book: paragraph `block`, or picture number `fig` (-1 when it was a paragraph). */
export function onPick(block: number, fig = -1): void {
  const b = book().blocks[block];
  if (!b) return;
  show(block, fig);
  if (narrow()) return;
  if (fig >= 0) { hide(); setPane("manuscript", "pictures"); openCard(fig); inspect(fig); return; }
  closeInspector();
  if ($("mkWork").dataset.tab === "text" && b.type !== "h") jumpEditor(b.text);
}

export function onView(fig: number): void { setHere(fig); }

export function initPick(): void {
  $("mkPickAdd").addEventListener("click", () => { if (at >= 0) { const i = at; hide(); addPictureAfter(i); } });
  $("mkPickEdit").addEventListener("click", () => {
    const fig = +($("mkPickEdit").dataset.fig || "-1"), b = book().blocks[at];
    if (fig >= 0) { setPane("manuscript", "pictures"); openCard(fig, true); }
    else if (b) jumpEditor(b.text);
  });
  $("mkPickX").addEventListener("click", hide);
}
