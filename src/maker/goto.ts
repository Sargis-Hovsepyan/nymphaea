// Jumping to a place in the book from another view.
import { narrow, sess } from "./session";
import { setPane } from "./ui";
import { setView } from "./views";

/** Show the Book view and scroll it to a paragraph (and its picture, when `picture`). */
export function showInBook(block: number, picture = false): void {
  setView("book");
  if (narrow()) setPane("book");
  const go = () => sess.preview.send({ type: "scroll", block, picture });
  // The frame was hidden a moment ago; let it lay out before scrolling.
  requestAnimationFrame(() => requestAnimationFrame(go));
}
