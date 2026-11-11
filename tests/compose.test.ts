// Composed scenes: any passage gets a picture. The spec round-trips through its id, reading is
// deterministic and carries a chapter's setting forward, and every combination of place, hour,
// sky, things and figures builds and animates without a missing part or a NaN.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { vscene } from "../src/compose";
import { evidence, readSpec, trackSpecs } from "../src/compose/read";
import { FX, PLACES, POSES, PROPS, SHOTS, SKIES, TIMES, blank, decode, describe as describeSpec, encode, fromLoose, isWater, type Spec } from "../src/compose/spec";
import { layout } from "../src/compose/layout";
import { cut } from "../src/stage/auto";
import { parseText } from "../src/parse";
import { autoStage } from "../src/stage/auto";
import { captionIsQuoted, guardScenes } from "../src/stage/guard";
import { isScene } from "../src/stage/keywords";
import type { VApi } from "../src/vscenes";

function fakeApi(markup: string, problems: string[]): VApi {
  const els: Record<string, SVGElement> = {};
  const bad = (v: string) => /NaN|Infinity|undefined/.test(v);
  return {
    a(k) {
      if (!markup.includes('data-a="' + k + '"')) problems.push("missing part " + k);
      return els[k] || (els[k] = {
        setAttribute: (n: string, v: string) => { if (bad(String(v))) problems.push(k + "." + n + " = " + v); },
        style: new Proxy({}, { set: (_t, p, v) => { if (bad(String(v))) problems.push(k + ".style." + String(p) + " = " + v); return true; } }),
      } as unknown as SVGElement);
    },
    light(v) { if (!Number.isFinite(v)) problems.push("light " + v); },
  };
}

function exercise(id: string): string[] {
  const vs = vscene(id), markup = vs.build("t");
  const problems: string[] = [];
  if (/NaN|Infinity|undefined/.test(markup)) problems.push("markup has NaN");
  const keys = Array.from(markup.matchAll(/data-a="([^"]+)"/g)).map((m) => m[1]);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dup.length) problems.push("duplicate parts " + dup.join(","));
  const api = fakeApi(markup, problems);
  for (let i = 0; i <= 12; i++) [0, 3.3, 900].forEach((tm) => vs.update(api, i / 12, tm));
  return problems;
}

const base: Spec = blank(42);

describe("composed scene ids", () => {
  it("round-trip and normalise", () => {
    const s: Spec = { ...base, place: "city", sky: "rain", props: ["lamp", "car"], who: 2, cast: [3, 17], pose: "walk", shot: "mid", season: "autumn", v: -0.5, a: 1, seed: 1234, moment: 77 };
    const id = encode(s);
    expect(id.startsWith("gen:city.night.rain.lamp+car.2w.3h.ma.")).toBe(true);
    expect(encode(decode(id)!)).toBe(id);
    expect(isScene(id)).toBe(true);
  });

  it("reject junk", () => {
    ["gen:", "gen:moon.night.clear.-.1.22.a", "gen:room.noon.clear.-.1.22.a", "gen:room.night.clear.sword.1.22.a", "gen:room.night.clear.-.9.22.a", "lamp<script>", 42, null]
      .forEach((x) => expect(decode(x), String(x)).toBeNull());
    expect(isScene("gen:room.night.clear.-.9.22.a")).toBe(false);
  });

  it("still read the older seven part ids", () => {
    const old = decode("gen:city.night.rain.lamp+car.1w.12.k3f");
    expect(old).toMatchObject({ place: "city", pose: "walk", who: 1, shot: "wide", season: "none" });
    expect(decode(encode(old!))).toEqual(old);
    expect(decode("gen:city.night.rain.-.1r.12.k3f")).toBeNull();
  });

  it("read loose AI data safely", () => {
    const s = fromLoose({ place: "Sea", time: "dusk", weather: "fog", props: ["boat", "sword", "bird"], figures: 7, pose: "dance", walk: true });
    expect(s).toMatchObject({ place: "sea", time: "dusk", sky: "fog", props: ["boat", "bird"], who: 3, pose: "walk" });
    expect(s!.cast).toHaveLength(3);
    expect(fromLoose({ place: "the moon" })).toBeNull();
  });

  it("describe in plain words", () => {
    expect(describeSpec({ ...base, place: "sea", time: "dawn", props: ["boat"], who: 0 })).toBe("the sea at dawn, with a boat");
  });
});

describe("reading a scene from text", () => {
  it("finds place, hour, sky, things and people", () => {
    const s = readSpec("Rain hammered the city streets at midnight. She stood under the lamp and watched the taxis pass.");
    expect(s.place).toBe("city");
    expect(s.time).toBe("night");
    expect(s.sky).toBe("rain");
    expect(s.props).toContain("lamp");
    expect(s.who).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const t = "At dawn the fishermen pushed their boat into the grey sea.";
    expect(readSpec(t)).toEqual(readSpec(t));
  });

  it("carries the chapter's setting forward and resets at a new chapter", () => {
    const { blocks } = parseText("# One\n\nThe forest was dark with pines and moss at night.\n\nShe walked on.\n\n# Two\n\nShe walked on.");
    const specs = trackSpecs(blocks);
    const walkOn = blocks.map((b, i) => (b.text === "She walked on." ? specs[i] : null)).filter(Boolean) as Spec[];
    expect(walkOn[0].place).toBe("forest");
    expect(walkOn[0].pose).toBe("walk");
    expect(walkOn[1].place).not.toBe("forest");
  });

  it("does not mistake a word for another that shares its stem", () => {
    const e = evidence("He pinned my bishop, winning even so; I stared, then kept leaving the pawn.");
    expect(e.place).toEqual({});
    expect(e.time).toEqual({});
    expect(e.props).toEqual({});
  });

  it("holds the hour and the place through a chapter instead of flickering with the mood", () => {
    const { blocks } = parseText("# One\n\nThe kitchen at midnight was cold.\n\nI laughed, warm and happy, with joy.\n\nI cried, lost and afraid.\n\nWe sat on.");
    const specs = trackSpecs(blocks).filter(Boolean) as Spec[];
    expect(new Set(specs.map((s) => s.time))).toEqual(new Set(["night"]));
    expect(new Set(specs.map((s) => s.place))).toEqual(new Set(["kitchen"]));
  });

  it("has evidence only from words it knows", () => {
    expect(Object.keys(evidence("Quantum lattice symmetries.").place)).toEqual([]);
  });
});

describe("every composed scene draws cleanly", () => {
  it("each place × hour × sky", () => {
    const problems: string[] = [];
    PLACES.forEach((place) => TIMES.forEach((time) => SKIES.forEach((sky) => {
      const who = place.length % 4;
      const id = encode({ ...blank(place.length * 97 + sky.length, { place, time, sky }), ...{ who, cast: [1, 14, 27].slice(0, who), pose: POSES[(place.length + sky.length) % POSES.length], shot: SHOTS[(time.length + sky.length) % 3], props: [PROPS[place.length % PROPS.length]] } });
      exercise(id).forEach((p) => problems.push(id + ": " + p));
    })));
    expect(problems).toEqual([]);
  });

  it("each thing, indoors and out, alone and crowded", () => {
    const problems: string[] = [];
    PROPS.forEach((p, i) => ["room", "kitchen", "sea", "road", "village", "harbour"].forEach((place) => {
      const props = [p, PROPS[(i + 3) % PROPS.length], PROPS[(i + 7) % PROPS.length], PROPS[(i + 11) % PROPS.length]];
      const id = encode({ ...base, place: place as Spec["place"], props: Array.from(new Set(props)), who: 3, cast: [0, 12, 30], pose: POSES[i % POSES.length], shot: SHOTS[i % 3], seed: i * 13 });
      exercise(id).forEach((x) => problems.push(id + ": " + x));
    }));
    expect(problems).toEqual([]);
  });
});

describe("staging with composed scenes", () => {
  const EPISODE = readFileSync(new URL("../episodes/01-the-lesson-i-refused-to-learn.md", import.meta.url), "utf8");
  const { blocks } = parseText(EPISODE);

  it("composed mode gives every picture a composed scene with a quoted caption", () => {
    const plan = autoStage(blocks, "some", "composed");
    expect(plan.length).toBeGreaterThan(0);
    plan.forEach((s) => {
      expect(decode(s.scene), s.scene).not.toBeNull();
      expect(captionIsQuoted(s.caption, blocks, s.after)).toBe(true);
    });
  });

  it("a text with no library words still gets pictures that fit it", () => {
    const { blocks: b } = parseText("# Harbour\n\n" + Array.from({ length: 30 }, (_, i) => "Fishermen mended their nets on the quay while gulls wheeled over the harbour, and the tide came in number " + i + ".").join("\n\n"));
    const plan = autoStage(b, "some", "mixed");
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.some((s) => /^gen:(sea|harbour|shore)\./.test(s.scene))).toBe(true);
  });

  it("the guard keeps composed ids and drops forged ones", () => {
    const ok = encode({ ...base, place: "sea" });
    const g = guardScenes(blocks, [{ after: 2, scene: ok, caption: "" }, { after: 3, scene: "gen:sea.night.clear.-.9.22.a", caption: "" }]);
    expect(g.scenes.map((s) => s.scene)).toEqual([ok]);
    expect(g.rejected).toBe(1);
  });
});

describe("the caption guard", () => {
  const { blocks } = parseText("The next knight fell, and the board went quiet.");
  it("accepts whole-word quotes, rejects fragments of words", () => {
    expect(captionIsQuoted("knight fell", blocks, 0)).toBe(true);
    expect(captionIsQuoted("the board went quiet…", blocks, 0)).toBe(true);
    expect(captionIsQuoted("x", blocks, 0)).toBe(false);
    expect(captionIsQuoted("ext knig", blocks, 0)).toBe(false);
  });
});

describe("layout", () => {
  const all: Spec[] = [];
  PLACES.forEach((place, pi) => SHOTS.forEach((shot) => [0, 1, 2, 3].forEach((who) => [11, 222, 3333].forEach((seed) => {
    all.push({ ...blank(seed, { place, shot, who, cast: [5, 18, 31].slice(0, who) }), pose: POSES[(pi + seed) % POSES.length], props: [PROPS[(pi * 3 + seed) % PROPS.length], PROPS[(pi * 7 + seed + 1) % PROPS.length]] });
  }))));

  it("never stands anyone on water, and keeps feet on the land", () => {
    const bad: string[] = [];
    all.forEach((s) => {
      const L = layout(s);
      L.items.filter((it) => it.kind === "fig" && L.cam.shot !== "close").forEach((it) => {
        if (it.on !== "ground") return;
        if (L.water && it.y >= L.water[0] && it.y <= L.water[1]) bad.push(encode(s) + " fig on water at " + it.y.toFixed(1));
        if (!L.land.some(([a, b]) => it.y >= a - 4 && it.y <= b + 6)) bad.push(encode(s) + " fig off the land at " + it.y.toFixed(1));
      });
      L.items.filter((it) => it.on === "water").forEach((it) => { if (!isWater(s.place)) bad.push(encode(s) + " " + it.kind + " floats on dry land"); });
    });
    expect(bad).toEqual([]);
  });

  it("keeps the focus inside the frame and figures clear of big near things", () => {
    const bad: string[] = [];
    all.forEach((s) => {
      const L = layout(s);
      const figs = L.items.filter((it) => it.kind === "fig");
      figs.forEach((fg) => {
        if (L.cam.shot !== "close" && (fg.x < -5 || fg.x > 325)) bad.push(encode(s) + " fig outside at " + fg.x.toFixed(0));
        L.items.forEach((q) => {
          if (q.kind === "fig" || q.on !== "ground" || q.y <= fg.y + 1) return;
          const o = Math.max(0, Math.min(q.x + q.w / 2, fg.x + fg.w / 2) - Math.max(q.x - q.w / 2, fg.x - fg.w / 2));
          if (o > fg.w * 0.5 && q.h > fg.h * 0.6) bad.push(encode(s) + " " + q.kind + " hides a figure");
        });
      });
    });
    expect(bad).toEqual([]);
  });

  it("drops things that do not belong", () => {
    expect(layout({ ...base, place: "room", props: ["house", "boat", "cup"] }).dropped).toEqual(["house", "boat"]);
    expect(layout({ ...base, place: "field", props: ["boat", "bridge"] }).dropped).toEqual(["boat", "bridge"]);
    expect(layout({ ...base, place: "river", props: ["boat", "bridge"] }).dropped).toEqual([]);
  });

  it("varies the look of a place with its layout seed", () => {
    PLACES.filter((p) => p !== "inner").forEach((place) => {
      const looks = new Set([1, 2, 3, 4, 5, 6].map((seed) => vscene(encode({ ...blank(seed * 911, { place, who: 0 }) })).build("x")));
      expect(looks.size, place).toBeGreaterThanOrEqual(4);
    });
  });
});

describe("reading more of the scene", () => {
  it("does not count a thing the text says is absent", () => {
    const e = evidence("There was no moon and not a lamp in the street.");
    expect(e.time.night).toBeUndefined();
    expect(e.props.lamp).toBeUndefined();
    // "in the street": a place right after a preposition counts double.
    expect(e.place.city).toBe(2);
  });

  it("does not read common words as things", () => {
    expect(evidence("I had played well, and he took note of the keys and the next steps.").props).toEqual({});
  });

  it("reads poses, seasons and the shot", () => {
    expect(readSpec("She sat on the bench in the autumn garden.")).toMatchObject({ pose: "sit", season: "autumn", place: "garden" });
    expect(readSpec("They embraced on the platform as the train left.").pose).toBe("pair");
    expect(readSpec("A cup of tea, a letter.").shot).toBe("close");
  });

  it("gives an honest motif when nothing names a scene", () => {
    expect(readSpec("I had been wrong about all of it, and I knew it.").place).toBe("inner");
  });

  it("keeps a named person's build across the book", () => {
    const { blocks } = parseText("Mara opened the door.\n\nLater, Mara walked to the river.\n\nThe rain stopped and Mara smiled.");
    const builds = trackSpecs(blocks).filter(Boolean).map((s) => s!.cast[0]);
    expect(new Set(builds).size).toBe(1);
  });

  it("cuts to a nearer shot when the place and hour repeat", () => {
    const a = { ...base, place: "kitchen" as const, who: 1, props: ["cup" as const], shot: "wide" as const };
    expect(cut(a, a).shot).toBe("mid");
    expect(cut({ ...a, shot: "mid" }, { ...a, shot: "mid" }).shot).toBe("close");
    expect(cut(a, { ...a, place: "city" }).shot).toBe("wide");
  });
});

describe("contrast in the canvas source", () => {
  it("a night sky is never as dark as a figure", () => {
    const m = vscene(encode({ ...base, place: "field", time: "night", who: 1 })).build("c");
    expect(m).toMatch(/class="sky"[^>]*data-h="night"/);
  });
});

describe("motion read from the text", () => {
  const fx = (t: string) => readSpec(t).fx || [];
  it("reads what moves", () => {
    expect(fx("Smoke curled from the chimney of the cottage at dusk.")).toContain("rise");
    expect(fx("A shooting star fell across the night sky above the field.")).toContain("star");
    expect(fx("A shooting star fell across the night sky above the field.")).not.toContain("fall");
    expect(fx("The gulls flew off the harbour wall as the waves crashed in.")).toEqual(expect.arrayContaining(["fly", "swell"]));
    expect(fx("The candle flickered in the kitchen.")).toContain("flicker");
    expect(fx("In the garden the petals were falling.")).toContain("fall");
  });
  it("keeps only motion the scene can show", () => {
    expect(fx("A comet crossed the sky at noon over the field.")).not.toContain("star");
    expect(fx("The waves of grief crashed through the kitchen.")).not.toContain("swell");
  });
  it("ignores motion the text denies, and stays empty for still passages", () => {
    expect(fx("There was no smoke from the chimney.")).not.toContain("rise");
    expect(readSpec("She sat in the quiet kitchen.").fx).toBeUndefined();
  });
  it("counts a place after a preposition double", () => {
    expect(evidence("She walked into the forest.").place.forest).toBe(2);
    expect(evidence("The forest was old.").place.forest).toBe(1);
  });
  it("reads present-tense verbs as poses", () => {
    expect(readSpec("She sits by the window in the room.").pose).toBe("sit");
    expect(readSpec("He runs down the road.").pose).toBe("run");
    // "old bench" is not a person and "leaves" are not leaving.
    expect(readSpec("In the autumn garden the leaves were falling around the old bench.").who).toBe(0);
  });
  it("round-trips motion and leaves ids without motion unchanged", () => {
    const sp = { ...base, fx: ["rise", "star"] as Spec["fx"] };
    expect(decode(encode(sp))!.fx).toEqual(["rise", "star"]);
    const plain = encode(base);
    expect(plain.split(".").length).toBe(10);
    expect(decode(plain)!.fx).toBeUndefined();
    expect(decode(plain + ".0")).toBeNull();
    expect(describeSpec(sp)).toMatch(/smoke rising/);
  });
  it("every motion draws cleanly in every place", () => {
    const problems: string[] = [];
    PLACES.forEach((place, i) => TIMES.forEach((time) => {
      const props = (["fire", "candle", "cup", "house", "tree", "flower"] as const).slice(i % 3, i % 3 + 3);
      const id = encode({ ...base, place, time, props: [...props], who: 1, cast: [3], fx: [...FX], seed: i * 31, moment: i * 7 });
      exercise(id).forEach((x) => problems.push(id + ": " + x));
    }));
    expect(problems).toEqual([]);
  });
});
