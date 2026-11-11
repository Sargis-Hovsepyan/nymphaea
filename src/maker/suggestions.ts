// The note above the picture list: strong passages that have no picture yet, with a way to review them.
import { $, hasText } from "./session";
import { currentSuggestions } from "./suggest";
import { setView } from "./views";

export function refreshSuggestions(): void {
  const box = $("mkSugg");
  if (!box) return;
  const n = hasText() ? currentSuggestions().length : 0;
  box.hidden = n === 0;
  if (!n) { box.textContent = ""; return; }
  const key = String(n);
  if (box.dataset.n === key && box.childElementCount) return;
  box.dataset.n = key;
  box.textContent = "";
  const p = document.createElement("p");
  const b = document.createElement("b"); b.textContent = n.toLocaleString();
  p.append(b, n === 1 ? " strong passage has no picture yet." : " strong passages have no picture yet.");
  const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn"; btn.textContent = "Review";
  btn.setAttribute("aria-label", "Review the " + n + (n === 1 ? " passage" : " passages") + " in the Storyboard");
  btn.addEventListener("click", () => setView("board"));
  box.append(p, btn);
}

export function initSuggestions(): void { refreshSuggestions(); }
