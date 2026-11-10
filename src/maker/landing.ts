// The landing page's live demo: the real reader in an iframe, showing the sample episode, restyled
// by the edition chips. It is built once, the first time the landing is shown.
import { PRESETS } from "../design/presets";
import type { Pristine } from "../export";
import { parseDraft } from "../parse";
import { SEED_SCENES } from "../sample";
import { SEED_TEXT, SEED_TITLE } from "../seed";
import { DEFAULTS } from "../settings";
import { guardScenes } from "../stage/guard";
import type { Book, Settings } from "../types";
import { createPreview, type Preview } from "./preview";

export function sampleBook(): Book {
  const parsed = parseDraft("# " + SEED_TITLE + "\n\n" + SEED_TEXT.join("\n\n"), "");
  return { title: parsed.title, blocks: parsed.blocks, scenes: guardScenes(parsed.blocks, SEED_SCENES).scenes, source: "hand" };
}

let preview: Preview | null = null;

export function mountLanding(p: Pristine): void {
  if (preview) return;
  const frame = document.getElementById("ldFrame") as HTMLIFrameElement, chips = document.getElementById("ldChips")!;
  const book = sampleBook();
  let cur: Settings = { ...DEFAULTS, ...PRESETS[0].s, preset: PRESETS[0].id, readerControls: false };
  preview = createPreview(frame, p, cur);
  const go = (id: string) => {
    const pr = PRESETS.find((x) => x.id === id) || PRESETS[0];
    cur = { ...DEFAULTS, ...pr.s, preset: pr.id, readerControls: false };
    preview!.render(book, cur);
    chips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === pr.id)));
  };
  PRESETS.forEach((pr) => {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.id = pr.id; b.textContent = pr.name; b.title = pr.note;
    b.addEventListener("click", () => go(pr.id));
    chips.appendChild(b);
  });
  go(PRESETS[0].id);
  // The one moment of motion: once the book has loaded it drifts down to its first picture.
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches && book.scenes.length) {
    const at = book.scenes[0].after;
    setTimeout(() => preview && preview.send({ type: "scroll", block: at, picture: true }), 1800);
  }
}
