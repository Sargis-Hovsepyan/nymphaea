// Keyboard: the shortcuts (Undo, Save, Export, Text, Look) and the book menu.
import { $, hasText, hooks } from "./session";
import { landingOpen } from "./shelf";
import { downloadBook } from "./exportSheet";
import { undo } from "./undo";
import { currentSide, openExport, setSide } from "./ui";

const typingIn = (t: EventTarget | null): boolean => { const el = t as HTMLElement | null; return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable); };

export function initShortcuts(): void {
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || landingOpen()) return;
    const k = e.key.toLowerCase(), typing = typingIn(e.target);
    if (k === "z" && !e.shiftKey && !typing) { e.preventDefault(); undo(); }
    else if (k === "s" && !typing) { e.preventDefault(); downloadBook(); }
    else if (k === "e" && hasText()) { e.preventDefault(); hooks.refresh(); openExport(); }
    // The text and the look open beside the book; the same keys close them.
    else if (k === "j") { e.preventDefault(); setSide(currentSide() === "text" ? "none" : "text"); if (currentSide() === "text") $("mkMd").focus({ preventScroll: true }); }
    else if (k === ".") { e.preventDefault(); setSide(currentSide() === "look" ? "none" : "look"); }
  });

  // The book menu: Escape closes it and gives focus back; arrows move through its items.
  const menu = $<HTMLDetailsElement>("mkMenu"), sum = menu.querySelector("summary") as HTMLElement;
  const items = () => Array.from(menu.querySelectorAll<HTMLElement>("[role=menuitem]"));
  const close = (focus: boolean) => { menu.removeAttribute("open"); if (focus) sum.focus(); };
  menu.addEventListener("toggle", () => sum.setAttribute("aria-expanded", String(menu.open)));
  sum.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); menu.open = true; items()[0]?.focus(); } });
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.open) { e.preventDefault(); e.stopPropagation(); close(true); return; }
    const l = items(), i = l.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); l[(i + 1) % l.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); l[(i + l.length - 1) % l.length].focus(); }
    else if (e.key === "Tab") close(false);
  });
  document.addEventListener("click", (e) => { if (menu.open && !menu.contains(e.target as Node)) close(false); });
  menu.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("button")) close(false); });
}
