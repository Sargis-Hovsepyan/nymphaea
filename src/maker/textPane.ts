// The Text tab: the outline, the typography check and rich paste. The words change only when the
// author types them or chooses Fix (which is one undo step, and only undoes if nothing was typed since).
import { isBreak, plain } from "../inline";
import { findIssues, applyFix, type Kind } from "../text/check";
import { htmlToMarkdown, richEnough } from "../import/html";
import { $, book, hasText, narrow, plural, sess, setMd } from "./session";
import { checkpoint, UNDO } from "./undo";
import { setPane, toast, type Pane } from "./ui";
import { rebuildText } from "./rebuild";

export function renderOutline(): void {
  const box = $("mkOutline"), B = book();
  box.textContent = "";
  const marks: { i: number; kind: string; label: string }[] = [];
  B.blocks.forEach((b, i) => {
    if (b.type === "h") marks.push({ i, kind: (b.level || 1) === 1 ? "ch" : "sec", label: plain(b.text) });
    else if (b.type === "quote") marks.push({ i, kind: "q", label: plain(b.text.split("\n")[0]) });
    else if (b.type === "verse") marks.push({ i, kind: "v", label: plain(b.text.split("\n")[0]) });
    else if (isBreak(b.text)) marks.push({ i, kind: "brk", label: "⁂" });
  });
  box.hidden = !marks.length;
  if (!marks.length) return;
  const h = document.createElement("h3"); h.textContent = "Outline"; box.appendChild(h);
  const ul = document.createElement("ol");
  marks.slice(0, 200).forEach((m) => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.className = "o-" + m.kind;
    b.textContent = m.label.length > 40 ? m.label.slice(0, 40) + "…" : m.label;
    b.title = m.kind === "brk" ? "Scene break" : m.label;
    b.addEventListener("click", () => { jumpEditor(B.blocks[m.i].text); sess.preview.send({ type: "scroll", block: m.i }); });
    li.appendChild(b); ul.appendChild(li);
  });
  box.appendChild(ul);
}

/** Put the editor's caret at a block's text and scroll it into view. */
export function jumpEditor(text: string): void {
  const ta = $<HTMLTextAreaElement>("mkMd"), needle = text.split("\n")[0].slice(0, 40);
  const at = ta.value.indexOf(needle);
  if (at < 0) return;
  if (narrow()) setPane("manuscript", "text"); else setPane($("mkWork").dataset.pane === "design" ? "manuscript" : ($("mkWork").dataset.pane as Pane), "text");
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(at, at + needle.length);
  sess.editor.reveal(at);
}

export function renderTypo(): void {
  const box = $("mkTypo") as HTMLDetailsElement, issues = hasText() ? findIssues(sess.md) : [], wasOpen = box.open;
  box.hidden = !issues.length;
  box.textContent = "";
  if (!issues.length) return;
  box.open = wasOpen;
  const n = issues.reduce((a, it) => a + it.count, 0);
  const sum = document.createElement("summary"); sum.textContent = plural(n, "typography suggestion"); box.appendChild(sum);
  const p = document.createElement("p"); p.className = "note"; p.textContent = "Typewriter habits a typesetter would set differently. Nothing changes unless you choose to fix it.";
  box.appendChild(p);
  issues.forEach((it) => {
    const row = document.createElement("div"); row.className = "mk-fix";
    const t = document.createElement("div");
    const b = document.createElement("b"); b.textContent = it.label + ", " + it.count;
    const d = document.createElement("span"); d.className = "diff";
    const del = document.createElement("del"); del.textContent = it.before;
    const ins = document.createElement("ins"); ins.textContent = it.after;
    d.append(del, ins); t.append(b, d);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn"; btn.textContent = "Fix";
    btn.addEventListener("click", () => fixTypo(it.kind));
    row.append(t, btn); box.appendChild(row);
  });
}

function fixTypo(kind: Kind): void {
  const snap = checkpoint(true);
  sess.md = applyFix(sess.md, kind);
  snap.mdAfter = sess.md;
  setMd(sess.md);
  rebuildText(false, { samePositions: (c) => applyFix(c, kind) });
  toast("Typography fixed. It’s now your own edit.", false, UNDO);
}

export function onPaste(e: ClipboardEvent): void {
  const html = e.clipboardData && e.clipboardData.getData("text/html");
  if (!html || !richEnough(html)) return;
  const conv = htmlToMarkdown(html);
  if (!conv.trim()) return;
  e.preventDefault();
  const ta = e.target as HTMLTextAreaElement, a = ta.selectionStart, b = ta.selectionEnd;
  ta.setRangeText(conv, a, b, "end");
  sess.md = ta.value;
  sess.editor.paint();
  rebuildText(false);
  toast("Pasted with its italics, headings and quotes kept as Markdown.");
}
