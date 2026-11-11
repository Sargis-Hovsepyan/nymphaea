// A dev-only page (not in the build): every place and shot, in any picture style, to look at the
// composed scenes side by side. Run `npx vite` and open /gallery.html. Add ?ids=gen:a,gen:b to pin.
import { vscene, sceneLabel } from "./compose";
import { blank, encode, PLACES, type Spec } from "./compose/spec";
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
const pinned = new URLSearchParams(location.search).get("ids");
const ids = pinned ? pinned.split(",") : specs.map(encode);
const g = document.getElementById("g")!, sel = document.getElementById("st") as HTMLSelectElement, tr = document.getElementById("t") as HTMLInputElement;

function render(): void {
  g.textContent = "";
  const st = sel.value as Style | "canvas", t = +tr.value;
  ids.forEach((id) => {
    const fig = document.createElement("figure");
    if (st === "canvas") {
      const cv = document.createElement("canvas"); cv.width = 640; cv.height = 400;
      const m = sceneModel(id); vscene(id).update(m.api, t, 2); drawModel(m, cv.getContext("2d")!, 640, 400);
      fig.appendChild(cv);
    } else {
      const { wrap, vec } = makeVector(st, id, sceneLabel(id));
      fig.appendChild(wrap); drawVector(vec, st, id, t, 2);
    }
    const cap = document.createElement("figcaption"); cap.textContent = id + " · " + sceneLabel(id);
    fig.appendChild(cap); g.appendChild(fig);
  });
}
sel.onchange = tr.oninput = render;
(document.getElementById("lt") as HTMLInputElement).onchange = (e) => document.body.classList.toggle("light", (e.target as HTMLInputElement).checked);
render();
