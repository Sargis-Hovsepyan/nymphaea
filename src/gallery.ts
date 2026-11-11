// A dev-only page (not in the build): every place and shot, in any picture style, to look at the
// composed scenes side by side. Run `npx vite` and open /gallery.html. Add ?ids=gen:a,gen:b to pin,
// ?read for sentences read as a book is, ?act for sentences that act something out (with a play
// slider: "p" scrubs the play clock, "play" runs it).
import { vscene, sceneLabel } from "./compose";
import { blank, encode, PLACES, type Spec } from "./compose/spec";
import { readSpec } from "./compose/read";
import { makeVector, drawVector } from "./renderers/vector";
import { drawModel, sceneModel } from "./vscenes/model";
import type { Style } from "./types";

const TIMES: Spec["time"][] = ["dusk", "day", "night", "dawn"];
const specs: Spec[] = [];
PLACES.forEach((place, i) => {
  const t = TIMES[i % 4];
  specs.push(blank(i * 977 + 3, { place, time: t, who: 1 + (i % 3), cast: [i % 36, (i * 7) % 36, (i * 13) % 36].slice(0, 1 + (i % 3)), pose: (["stand", "walk", "sit", "look", "pair", "reach"] as Spec["pose"][])[i % 6], props: ([["lamp", "car"], ["cup", "table", "candle"], ["tree", "bench"], ["boat", "bird"], ["house", "dog"]] as Spec["props"][])[i % 5], sky: (["clear", "rain", "cloud", "snow", "fog", "wind"] as Spec["sky"][])[i % 6], season: (["none", "autumn", "winter", "spring"] as Spec["season"][])[i % 4], shot: "wide" }));
  if (i % 3 === 0) specs.push(blank(i * 31 + 5, { place, time: TIMES[(i + 2) % 4], who: 2, cast: [3, 20], pose: "pair", shot: "mid", props: ["lamp"] }));
  if (i % 4 === 1) specs.push(blank(i * 53 + 1, { place, time: "night", who: 1, cast: [8], shot: "close", props: ["cup", "letter", "candle"] }));
});
// ?read: sentences read the way a book is, to judge the pictures against their words.
const LINES = [
  "She sat in the living room with a cup of tea while the clock ticked.",
  "He read the letter at the kitchen table by candlelight.",
  "We sat on the bench in the garden and watched the birds.",
  "They kissed on the bridge over the river at dawn.",
  "The boat drifted across the lake in the fog.",
  "At midnight the city was silent and wet with rain.",
  "The old man slept in his bed by the window.",
  "She held the umbrella over her head in the street.",
  "They walked along the beach at sunset.",
  "The train pulled into the station in the snow.",
  "She ran through the forest as the wind howled.",
  "They sat by the campfire under the stars.",
  "A lighthouse stood on the cliffs above the sea.",
  "The snow fell softly on the cottage roof.",
  "She held the candle up in the dark hall.",
  "He rowed the boat across the lake at dusk.",
];
// ?act: what happens, played.
const ACTS = [
  "The train pulled into the station in the snow.", "The candle went out.", "The sun rose over the sea.",
  "The rain stopped and the sun came out over the field.", "Her heart sank when the door slammed shut.",
  "A bird flew up from the fence as she walked along the road.", "He turned and ran from the dog.",
  "She sat down on the bench and wept.", "She opened the door and stepped into the rain.", "Mara lit a candle in the church.",
  "He gave her the letter.", "They embraced on the platform as the train left.", "Night fell over the village and the stars came out.",
  "She knelt by the grave and laughed.", "He picked up the cup and drank.", "The two friends danced in the garden at dusk.",
  "She waved from the boat as it sailed away.", "The clock struck midnight and he looked up.", "He jumped over the fence and ran off.",
  "She fell in the street, then got up slowly.",
];
const q = new URLSearchParams(location.search);
const pinned = q.get("ids");
const ids = pinned ? pinned.split(",") : q.has("act") ? ACTS.map((t) => encode(readSpec(t))) : q.has("read") ? LINES.map((t) => encode(readSpec(t))) : specs.map(encode);
const texts = q.has("act") ? ACTS : q.has("read") ? LINES : [];
const g = document.getElementById("g")!, sel = document.getElementById("st") as HTMLSelectElement, tr = document.getElementById("t") as HTMLInputElement;
const pr = document.getElementById("p") as HTMLInputElement, playB = document.getElementById("play") as HTMLButtonElement;
let drawn: { id: string; vec: ReturnType<typeof makeVector>["vec"] }[] = [];

function render(): void {
  g.textContent = "";
  const st = sel.value as Style | "canvas", t = +tr.value, p = pr.value === "" ? undefined : +pr.value;
  drawn = [];
  ids.forEach((id, n) => {
    const fig = document.createElement("figure");
    if (st === "canvas") {
      const cv = document.createElement("canvas"); cv.width = 640; cv.height = 400;
      const m = sceneModel(id); vscene(id).update(m.api, t, 2, p); drawModel(m, cv.getContext("2d")!, 640, 400);
      fig.appendChild(cv);
    } else {
      const { wrap, vec } = makeVector(st, id, sceneLabel(id));
      fig.appendChild(wrap); drawVector(vec, st, id, t, 2, p); drawn.push({ id, vec });
    }
    const cap = document.createElement("figcaption"); cap.textContent = (texts[n] ? texts[n] + " · " : "") + id + " · " + sceneLabel(id);
    fig.appendChild(cap); g.appendChild(fig);
  });
}
sel.onchange = tr.oninput = pr.oninput = render;
let raf = 0;
playB.onclick = () => {
  if (raf) { cancelAnimationFrame(raf); raf = 0; return; }
  const t0 = performance.now(), st = sel.value as Style;
  const step = (now: number) => { const p = (now - t0) / 1000; drawn.forEach((d) => drawVector(d.vec, st, d.id, 1, now / 1000, p)); pr.value = String(Math.min(+pr.max, p % +pr.max)); raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
};
(document.getElementById("lt") as HTMLInputElement).onchange = (e) => document.body.classList.toggle("light", (e.target as HTMLInputElement).checked);
render();
