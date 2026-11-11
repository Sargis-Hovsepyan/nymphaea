// What happens in a picture: acts round-trip through the id, are pruned to what the picture can
// draw, follow their things when the things change, read in plain words, and every kind of act
// draws cleanly on every thing and figure that can do it, at every point of the play clock.
import { describe, expect, it } from "vitest";
import { FIG_KINDS, PAIR, PAIR_KINDS, SKY, SKY_KINDS, THING0, THING_KINDS, TO_FIG0, TO_THING0, decodeActs, describeActs, encodeActs, fitActs, thingCan, type Act } from "../src/compose/acts";
import { blank, decode, encode, withProps, withWho, PROPS, type Spec } from "../src/compose/spec";
import { handAt, reachIK } from "../src/compose/figure";
import { looped, timeline } from "../src/compose/timeline";
import { exercise } from "./support/exercise";

const act = (o: Partial<Act>): Act => ({ by: 0, kind: "go", to: 0, manner: 0, with: false, away: false, ...o });
const base: Spec = blank(7, { place: "room", who: 2, cast: [3, 20], props: ["door", "candle", "cup", "table"] });

describe("acts in the id", () => {
  it("round-trip, four characters each", () => {
    const acts = [act({ kind: "open", to: TO_THING0 }), act({ kind: "leave", to: TO_THING0, manner: 1 }), act({ by: THING0 + 1, kind: "die", with: true })];
    const s = encode({ ...base, acts });
    expect(s.split(".").length).toBe(12);
    expect(s.split(".")[10]).toBe("0");
    expect(decode(s)!.acts).toEqual(acts);
    expect(encodeActs(acts)).toHaveLength(12);
    expect(decodeActs(encodeActs(acts))).toEqual(acts);
  });
  it("leave older ids as they were", () => {
    const plain = encode(base);
    expect(plain.split(".").length).toBe(10);
    expect(decode(plain)!.acts).toBeUndefined();
    expect(decode(plain + ".0")).toBeNull();
    expect(decode(plain + ".0.zzzz")).toBeNull();
    expect(decode(plain + ".2.0e40")!.fx).toEqual(["rise"]);
  });
  it("prune what the picture cannot draw, so normalising is stable", () => {
    const acts = [act({ by: 2, kind: "wave" }), act({ by: THING0 + 2, kind: "arrive" }), act({ by: THING0, kind: "open" }), act({ kind: "give", to: TO_FIG0 + 1 })];
    const fit = fitActs(base, acts);
    expect(fit.map((a) => a.kind)).toEqual(["open", "give"]);
    const id = encode({ ...base, acts });
    expect(encode(decode(id)!)).toBe(id);
    // One figure left: the giving loses its taker, not the act.
    expect(withWho({ ...base, acts }, 1).acts!.map((a) => [a.kind, a.to])).toEqual([["open", 0], ["give", 0]]);
  });
  it("follow a thing when the things change", () => {
    const s = { ...base, acts: [act({ kind: "light", to: TO_THING0 + 1 }), act({ by: THING0, kind: "close" })] };
    const t = withProps(s, ["candle", "table", "door"]);
    expect(t.acts!.map((a) => [a.by, a.to])).toEqual([[0, TO_THING0], [THING0 + 2, 0]]);
    expect(withProps(s, ["table"]).acts!.map((a) => a.kind)).toEqual(["light"]);
    expect(withProps(s, ["table"]).acts![0].to).toBe(0);
  });
  it("read in plain words", () => {
    expect(describeActs({ ...base, acts: [act({ kind: "open", to: TO_THING0 }), act({ kind: "leave", to: TO_THING0 }), act({ by: THING0 + 1, kind: "die", with: true })] }))
      .toBe("the first figure opens the door, then the first figure leaves by the door as the candle goes out");
    expect(describeActs({ ...base, acts: [act({ by: PAIR, kind: "hug" })] })).toBe("the two embrace");
    expect(describeActs({ ...base, acts: [act({ by: SKY, kind: "rain", away: true })] })).toBe("the rain stops");
  });
});

describe("the timeline", () => {
  it("plays in order, together on 'as', and holds a still at the telling moment", () => {
    const tl = timeline([act({ kind: "open", to: TO_THING0 }), act({ kind: "leave" }), act({ by: SKY, kind: "rain", with: true })]);
    expect(tl.segs[1].start).toBeGreaterThan(tl.segs[0].start);
    expect(tl.segs[2].start).toBe(tl.segs[1].start);
    expect(tl.still).toBeGreaterThan(0);
    expect(tl.still).toBeLessThanOrEqual(tl.total);
    expect(tl.total).toBeLessThanOrEqual(9);
    expect(looped(tl, undefined).p).toBe(tl.still);
    expect(looped(tl, tl.loop + 1).p).toBeCloseTo(1);
    expect(looped(tl, 1).dip).toBe(1);
  });
});

describe("the arm", () => {
  it("puts the hand on any point within reach, and points at one out of it", () => {
    for (const [tx, ty] of [[30, -80], [20, -50], [5, -95], [25, -70], [-5, -60], [15, -100]]) {
      const [sh, el] = reachIK(11, tx, ty), [hx, hy] = handAt(11, sh, el);
      expect(Math.hypot(hx - tx, hy - ty)).toBeLessThan(0.6);
    }
    const [sh, el] = reachIK(11, 200, -80);
    expect(Number.isFinite(sh) && Number.isFinite(el)).toBe(true);
    const [hx] = handAt(11, sh, el);
    expect(hx).toBeGreaterThan(40);
    expect(reachIK(11, 11, -80).every(Number.isFinite)).toBe(true);
  });
});

describe("every act draws cleanly", () => {
  it("each figure act, alone and between two, in a room and on the bare stage", () => {
    const problems: string[] = [];
    FIG_KINDS.forEach((kind, n) => ["room", "inner", "garden"].forEach((place) => {
      const s: Spec = { ...base, place: place as Spec["place"], props: ["cup", "door", "bench", "candle"], seed: n * 13, moment: n * 7 };
      const to = ["give", "greet", "look", "point"].includes(kind) ? TO_FIG0 + 1 : TO_THING0 + (n % 4);
      const acts = [act({ kind, to, manner: (n % 3) as Act["manner"] }), act({ by: 1, kind: FIG_KINDS[(n + 5) % FIG_KINDS.length], with: n % 2 === 0 })];
      const id = encode({ ...s, acts });
      exercise(id).forEach((x) => problems.push(id + ": " + x));
    }));
    PAIR_KINDS.forEach((kind) => { const id = encode({ ...base, place: "garden", acts: [act({ by: PAIR, kind })] }); exercise(id).forEach((x) => problems.push(id + ": " + x)); });
    expect(problems).toEqual([]);
  });
  it("each thing act on every thing that can do it", () => {
    const problems: string[] = [];
    THING_KINDS.forEach((kind) => PROPS.filter((p) => thingCan(p, kind)).forEach((p, n) => {
      const place = (["train", "ship", "boat"].includes(p) ? (p === "train" ? "station" : "harbour") : ["bird", "horse", "car", "bicycle", "tower"].includes(p) ? "field" : "room") as Spec["place"];
      const id = encode({ ...base, place, props: [p, "table"], who: 1, cast: [4], acts: [act({ by: THING0, kind, manner: (n % 3) as Act["manner"] })] });
      expect(decode(id)!.acts?.length, id).toBe(1);
      exercise(id).forEach((x) => problems.push(id + ": " + x));
    }));
    expect(problems).toEqual([]);
  });
  it("each sky act, starting and stopping, outside and in", () => {
    const problems: string[] = [];
    SKY_KINDS.forEach((kind, n) => ["field", "sea", "kitchen"].forEach((place) => [false, true].forEach((away) => {
      const id = encode({ ...base, place: place as Spec["place"], time: (["dawn", "day", "dusk", "night"] as const)[n % 4], acts: [act({ by: SKY, kind, away })] });
      exercise(id).forEach((x) => problems.push(id + ": " + x));
    })));
    expect(problems).toEqual([]);
  });
});
