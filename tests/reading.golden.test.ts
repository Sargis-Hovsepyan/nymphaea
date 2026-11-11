// The golden set: sentences annotated by hand with what a reader would draw, and the share the
// reading gets right, field by field. Many are written to probe the traps of reading by words alone:
// two-word names, verbs that look like things, similes, memories, dialogue and weather that stops.
import { describe, expect, it } from "vitest";
import { readSpec } from "../src/compose/read";
import type { Place, Pose, Prop, Time } from "../src/compose/spec";

interface Gold { t: string; place?: Place; time?: Time; props?: Prop[]; no?: Prop[]; who?: number; pose?: Pose; sky?: string }

const GOLD: Gold[] = [
  { t: "She sat in the living room with a cup of tea while the clock ticked.", place: "room", props: ["cup", "clock"], who: 1, pose: "sit" },
  { t: "Under the street lamp he waited for the last bus.", props: ["lamp"], who: 1 },
  { t: "They climbed down the fire escape into the alley.", place: "city", no: ["fire"], who: 3, pose: "walk" },
  { t: "In the kitchen she remembered the sea, the waves and the gulls.", place: "kitchen", who: 1 },
  { t: "His voice rolled like a storm across the quiet church.", place: "church", sky: "clear", who: 1 },
  { t: "The rain stopped and the sun came out over the field.", place: "field", sky: "clear" },
  { t: "She fired him that morning at the office.", place: "study", no: ["fire"], time: "dawn", who: 1 },
  { t: "The fire crackled in the hearth all night.", props: ["fire"], time: "night" },
  { t: "A full moon hung over the harbour.", place: "harbour", time: "night" },
  { t: "He read the letter at the kitchen table by candlelight.", place: "kitchen", props: ["letter", "table", "candle"], who: 1, pose: "reach" },
  { t: "They walked along the beach at sunset.", place: "shore", time: "dusk", who: 3, pose: "walk" },
  { t: "The train pulled into the station in the snow.", place: "station", sky: "snow", props: ["train"] },
  { t: "We sat on the bench in the garden and watched the birds.", place: "garden", props: ["bench", "bird"], who: 2 },
  { t: "The boat drifted across the lake in the fog.", place: "lake", sky: "fog", props: ["boat"] },
  { t: "At midnight the city was silent and wet with rain.", place: "city", time: "night", sky: "rain" },
  { t: "The old man slept in his bed by the window.", place: "bedroom", props: ["bed", "window"], who: 1, pose: "lie" },
  { t: "She ran through the forest as the wind howled.", place: "forest", sky: "wind", who: 1, pose: "run" },
  { t: "A dog barked somewhere down the village street.", place: "village", props: ["dog"] },
  { t: "They kissed on the bridge over the river at dawn.", place: "river", time: "dawn", props: ["bridge"], who: 3, pose: "pair" },
  { t: "The ship sailed out of the harbour in the storm.", place: "harbour", sky: "storm", props: ["ship"] },
  { t: "He stood on the mountain summit and looked at the stars.", place: "mountain", time: "night", who: 1, pose: "look" },
  { t: "In the desert the camels rested by the oasis.", place: "desert" },
  { t: "The graveyard was covered in snow that winter.", place: "graveyard", sky: "snow" },
  { t: "She played the piano in the hall until evening.", place: "hall", props: ["piano"], time: "dusk", who: 1 },
  { t: "“Let’s go to the sea tomorrow,” she said in the kitchen.", place: "kitchen", who: 1 },
  { t: "He dreamed of the desert, but he woke in the bedroom.", place: "bedroom", who: 1 },
  { t: "The café was crowded with people at noon.", place: "cafe", time: "day", who: 3 },
  { t: "On the hill a lone tree bent in the wind.", place: "hill", props: ["tree"], sky: "wind" },
  { t: "She opened the front door and stepped into the rain.", props: ["door"], sky: "rain", who: 1, pose: "walk" },
  { t: "There was no moon over the road that night.", place: "road", time: "night" },
  { t: "He would park the car by the gate.", props: ["car", "gate"], who: 1 },
  { t: "Mara lit a candle in the church.", place: "church", props: ["candle"] },
  { t: "The children played in the meadow all afternoon.", place: "field", time: "day", who: 3 },
  { t: "The cat slept on the chair by the fire.", props: ["cat", "chair", "fire"] },
  { t: "We waited on the platform for the night train.", place: "station", time: "night", props: ["train"], who: 2 },
  { t: "A lighthouse stood on the cliffs above the sea.", props: ["tower"] },
  { t: "The fog lifted and the harbour was bright in the morning.", place: "harbour", time: "dawn", sky: "clear" },
  { t: "She held the umbrella over her head in the street.", place: "city", props: ["umbrella"], who: 1, pose: "reach" },
  { t: "He packed his suitcase in the bedroom before dawn.", place: "bedroom", props: ["suitcase"], time: "dawn", who: 1 },
  { t: "They rode their horses across the plain.", place: "field", props: ["horse"], who: 3 },
  { t: "The waves crashed against the rocks on the shore.", place: "shore", props: ["rock"] },
  { t: "In the study the clock on the shelf ticked loudly.", place: "study", props: ["clock", "shelf"] },
  { t: "I looked at myself in the mirror in the hallway.", place: "hall", props: ["mirror"], who: 1, pose: "look" },
  { t: "The garden was full of roses in the summer.", place: "garden", props: ["flower"] },
  { t: "His anger burned like fire as he left the house.", props: ["house"], no: ["fire"], who: 1 },
  { t: "The leaves fell in the autumn park.", },
  { t: "We drove down the highway through the night.", place: "road", time: "night", who: 2 },
  { t: "She sat at the bar and ordered a glass of wine.", place: "cafe", props: ["glass"], who: 1, pose: "sit" },
  { t: "Two friends walked up the stairs together.", props: ["stairs"], who: 2, pose: "walk" },
  { t: "The snow fell softly on the cottage roof.", place: "village", sky: "snow", props: ["house"] },
  { t: "At the river bank the boy fished in the evening.", place: "river", time: "dusk", who: 1 },
  { t: "The tent stood in the forest clearing at dusk.", place: "forest", time: "dusk", props: ["tent"] },
  { t: "He would book a room at the inn.", place: "cafe", no: ["book"], who: 1 },
  { t: "Birds flew over the frozen lake in winter.", place: "lake", props: ["bird"] },
  { t: "She whispered as if the walls could hear, alone in the dark room.", place: "room", time: "night", who: 1 },
  { t: "Dawn broke over the fields and the farm woke up.", place: "field", time: "dawn" },
  { t: "The bell tower rose above the square in the village.", place: "village", props: ["tower"] },
  { t: "In the morning light she wrote in her diary at the desk.", time: "dawn", props: ["book"], who: 1 },
  { t: "The car stopped at the station in the rain.", place: "station", sky: "rain", props: ["car"] },
  { t: "They sat by the campfire under the stars.", time: "night", props: ["fire"], who: 3, pose: "sit" },
];

type Field = "place" | "time" | "sky" | "props" | "who" | "pose";
function score(): Record<Field, [number, number]> {
  const tally: Record<Field, [number, number]> = { place: [0, 0], time: [0, 0], sky: [0, 0], props: [0, 0], who: [0, 0], pose: [0, 0] };
  const miss: string[] = [];
  GOLD.forEach((g) => {
    const s = readSpec(g.t);
    const check = (f: Field, ok: boolean) => { tally[f][1]++; if (ok) tally[f][0]++; else miss.push(f + ": " + g.t); };
    if (g.place) check("place", s.place === g.place);
    if (g.time) check("time", s.time === g.time);
    if (g.sky) check("sky", s.sky === g.sky);
    if (g.props || g.no) check("props", (g.props || []).every((p) => s.props.includes(p)) && (g.no || []).every((p) => !s.props.includes(p)));
    if (g.who != null) check("who", g.who === 0 ? s.who === 0 : s.who === g.who || (g.who === 3 && s.who >= 2));
    if (g.pose) check("pose", s.pose === g.pose);
  });
  if (process.env.GOLD_VERBOSE) console.log(miss.join("\n"));
  return tally;
}

describe("the golden set", () => {
  const t = score();
  const pct = (f: Field) => t[f][0] / Math.max(1, t[f][1]);
  it("reports accuracy by field", () => {
    console.log("golden reading: " + (Object.keys(t) as Field[]).map((f) => f + " " + Math.round(pct(f) * 100) + "% of " + t[f][1]).join(", "));
  });
  it("reads the place right in at least 90 percent", () => { expect(pct("place")).toBeGreaterThanOrEqual(0.9); });
  it("reads the things right in at least 85 percent", () => { expect(pct("props")).toBeGreaterThanOrEqual(0.85); });
  it("counts the figures right in at least 90 percent", () => { expect(pct("who")).toBeGreaterThanOrEqual(0.9); });
  it("reads the hour, the weather and the pose right in at least 80 percent", () => {
    expect(pct("time")).toBeGreaterThanOrEqual(0.8);
    expect(pct("sky")).toBeGreaterThanOrEqual(0.8);
    expect(pct("pose")).toBeGreaterThanOrEqual(0.8);
  });
});
