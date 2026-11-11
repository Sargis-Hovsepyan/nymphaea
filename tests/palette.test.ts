// Command bar matching: text hits with a snippet, fuzzy labels, and places with their stretches.
import { describe, expect, it } from "vitest";
import { trackSpecs } from "../src/compose/read";
import { fuzzy, norm, placeHits, placePlan, placeRuns, pickInRun, rank, snippet, textHits } from "../src/maker/find";
import { parseText } from "../src/parse";

const blocks = parseText([
  "# A Title",
  "# The Harbour",
  "The boat rocked in the harbour at dawn and the gulls cried over the water.",
  "She counted the ropes one by one.",
  "* * *",
  "The kitchen smelled of bread, and the stove was warm.",
  "# The Hill",
  "Up on the hill the wind was cold.",
].join("\n\n")).blocks;

describe("find", () => {
  it("normalises queries", () => { expect(norm("  The   HARBOUR ")).toBe("the harbour"); });
  it("finds a snippet with the term kept as written", () => {
    const s = snippet(blocks[1].text, "HARBOUR")!;
    expect(s.match).toBe("harbour");
    expect(s.before + s.match + s.after).toContain("boat rocked in the harbour at dawn");
    expect(snippet("nothing here", "zebra")).toBeNull();
  });
  it("cuts long passages at word edges with ellipses", () => {
    const long = "word ".repeat(60) + "needle " + "word ".repeat(60);
    const s = snippet(long, "needle", 30)!;
    expect(s.before.startsWith("…")).toBe(true);
    expect(s.after.endsWith("…")).toBe(true);
    expect(s.match).toBe("needle");
  });
  it("ignores italic markers and finds across them", () => {
    expect(snippet("She *never* came back", "never came")!.match).toBe("never came");
    expect(snippet("She *never* came back", "never")!.match).toBe("never");
  });
  it("lists paragraph hits in order, not headings or breaks", () => {
    const h = textHits(blocks, "the", 10);
    expect(h.every((x) => blocks[x.block].type !== "h")).toBe(true);
    expect(h.map((x) => x.block)).toEqual([...h.map((x) => x.block)].sort((a, b) => a - b));
    expect(textHits(blocks, "x")).toEqual([]);
    expect(textHits(blocks, "harbour").map((x) => x.block)).toEqual([1]);
  });
  it("ranks fuzzy matches, prefix first", () => {
    expect(fuzzy("Export the book", "exp")).toBeGreaterThan(fuzzy("Switch to light", "exp"));
    expect(fuzzy("Place pictures automatically", "plac pict")).toBeGreaterThanOrEqual(0);
    expect(fuzzy("Place pictures automatically", "lamp")).toBe(-1);
    expect(fuzzy("Undo", "zzz")).toBe(-1);
    expect(fuzzy("Show the Storyboard", "story board")).toBeGreaterThan(-1);
    expect(rank(["Lamplight edition", "Nocturne edition", "Few pictures"], "noc", (s) => s)[0]).toBe("Nocturne edition");
  });
});

describe("places", () => {
  const specs = trackSpecs(blocks);
  it("matches a place by name", () => {
    const names = (p: string) => p;
    const hits = placeHits(specs, "harb", names);
    expect(hits[0]?.place).toBe("harbour");
    expect(hits[0].passages).toBeGreaterThan(0);
  });
  it("groups passages into stretches that headings and breaks end", () => {
    const fake = [null, { place: "sea" }, { place: "sea" }, null, { place: "sea" }, { place: "hill" }] as never;
    expect(placeRuns(fake, "sea")).toEqual([{ from: 1, to: 2 }, { from: 4, to: 4 }]);
  });
  it("plans one picture per stretch, skipping stretches that have one", () => {
    const runs = [{ from: 1, to: 3 }, { from: 5, to: 6 }, { from: 9, to: 9 }];
    const score = (i: number) => (i === 2 ? 5 : 1);
    expect(placePlan(runs, new Set(), score)).toEqual([2, 5, 9]);
    expect(placePlan(runs, new Set([6]), score)).toEqual([2, 9]);
    expect(pickInRun({ from: 5, to: 6 }, () => 1)).toBe(5);
  });
});
