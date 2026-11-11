// Breadth: 243 everyday sentences from many kinds of writing (the Gulf, offices, hospitals, war, sport,
// farms, the sea, homes, crime, weddings, travel). Not annotated one by one: the test holds how much
// of them the reading finds (a place, something happening) so later changes cannot quietly lose it.
// Below, sentences where the context decides what a word means.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readSpec } from "../src/compose/read";
import { parseText } from "../src/parse";
import { trackSpecs } from "../src/compose/read";

const lines = readFileSync(new URL("./support/breadth.txt", import.meta.url), "utf8").split("\n").filter(Boolean);
const kinds = (t: string) => (readSpec(t).acts || []).map((a) => a.kind).join(" ") || "-";

describe("reading breadth", () => {
  const specs = lines.map((t) => readSpec(t));
  const placed = specs.filter((s) => s.place !== "inner").length / lines.length;
  const acted = specs.filter((s) => s.acts?.length).length / lines.length;
  const kindsSeen = new Set(specs.flatMap((s) => (s.acts || []).map((a) => a.kind)));
  it("reports its scores", () => { console.log("breadth: place " + Math.round(placed * 100) + "%, acts " + Math.round(acted * 100) + "%, kinds " + kindsSeen.size); });
  it("finds a place in most sentences", () => { expect(placed).toBeGreaterThanOrEqual(0.58); });
  it("finds something happening in over half of them", () => { expect(acted).toBeGreaterThanOrEqual(0.5); });
  it("uses a wide range of acts", () => { expect(kindsSeen.size).toBeGreaterThanOrEqual(34); });
});

describe("context decides what a word means", () => {
  it("a cigarette's flame and ember are the cigarette's, not a candle or a fire", () => {
    for (const t of ["He flicked his lighter and the flame caught.", "The cigarette burned itself out, its ember flickering in the dark.", "Her cigarette was burning down to her fingers."]) {
      const s = readSpec(t);
      expect(s.props).toContain("cigarette");
      expect(s.props).not.toContain("candle");
      expect(s.props).not.toContain("fire");
    }
    expect(kinds("The cigarette burned itself out in the ashtray.")).toBe("die");
    expect(kinds("He lit a cigarette and watched the smoke rise.")).toBe("light look");
  });
  it("a candle's flame stays a candle, and flames alone are a fire", () => {
    expect(readSpec("She lit the candle and the flame steadied.").props).toEqual(["candle"]);
    expect(readSpec("The flames spread to the roof.").props).toContain("fire");
  });
  it("words that look like things or names are read in their place", () => {
    expect(readSpec("The curtain rose.").props).not.toContain("flower");
    expect(readSpec("Icicles hung from the eaves.").who).toBe(0);
    expect(readSpec("The grandfather clock ticked in the hall.").who).toBe(0);
    expect(readSpec("The plane touched down after midnight.").props).not.toContain("bird");
  });
  it("people named by what they are act", () => {
    expect(kinds("The nurse hurried down the corridor.")).toBe("run");
    expect(kinds("The guards opened the castle gates.")).toBe("open");
    expect(kinds("The mourners gathered around the grave.")).toBe("go");
    expect(readSpec("Firemen sprayed water on the burning house.").who).toBe(3);
  });
  it("her forehead is her; her own head is her own", () => {
    expect(kinds("He kissed her forehead.")).toBe("kiss");
    expect(readSpec("She laughed and threw back her head.").who).toBe(1);
  });
  it("a subject carries past a verb it does not know", () => {
    expect(kinds("She leaned out of the window and waved.")).toBe("look wave");
  });
  it("hand in hand is not walking in, and a torn letter is not a run", () => {
    expect(kinds("They walked hand in hand along the shore.")).toBe("cross");
    expect(kinds("She tore the letter in half.")).toBe("handle");
  });
  it("a figurative square or path does not move a room outside", () => {
    const book = parseText("The lamp lit the table in the small room where we played chess.\n\nHe moved first.\n\nHis king slid into the last square of safety.\n\nThere was no path forward for him.");
    trackSpecs(book.blocks).filter(Boolean).forEach((s) => expect(s!.place).toBe("room"));
  });
});
