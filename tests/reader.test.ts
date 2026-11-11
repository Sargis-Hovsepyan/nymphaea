// The reading experience's pure parts: time left and pace, the structure rules the screen and the
// EPUB share, the caption's words inside their paragraph, the saved position, and story light.
import { describe, expect, it } from "vitest";
import { beatIndexes, coverScene, hasOwnNumber, showsScene } from "../src/book/structure";
import { buildEpub } from "../src/epub/book";
import { DEFAULTS, migrate } from "../src/settings";
import {
  PACE, clampPace, cueBlock, decodePos, encodePos, lastFigureBefore, leftLabel, minutesLeft, paceAdd, paceOf, pastOpening,
  quoteRange, storyTarget, wordCount,
} from "../src/ui/place";
import type { Block, Book, SceneRef } from "../src/types";

const long = "The tide came in slowly over the flats and the gulls turned above the old pier while she counted the boats. ";
const para = (n = 3): Block => ({ type: "p", text: long.repeat(n).trim() });
const h = (text: string): Block => ({ type: "h", text, level: 1 });

describe("pace and time left", () => {
  it("clamps to 120..450", () => {
    expect(clampPace(40)).toBe(PACE.min);
    expect(clampPace(900)).toBe(PACE.max);
    expect(clampPace(230)).toBe(230);
  });
  it("starts at the default and moves toward what was measured", () => {
    expect(paceOf({ w: 0, ms: 0 })).toBe(PACE.def);
    let p = { w: 0, ms: 0 };
    for (let i = 0; i < 40; i++) p = paceAdd(p, 40, 12000); // 200 words a minute
    expect(Math.abs(paceOf(p) - 200)).toBeLessThan(8);
    expect(paceOf({ w: 100000, ms: 1000 })).toBe(PACE.max);
    expect(paceOf({ w: 1, ms: 6e7 })).toBe(PACE.min);
  });
  it("ignores idle gaps, going back and jumps", () => {
    const p = { w: 10, ms: 1000 };
    expect(paceAdd(p, 50, 31000)).toBe(p);
    expect(paceAdd(p, -20, 5000)).toBe(p);
    expect(paceAdd(p, 0, 5000)).toBe(p);
    expect(paceAdd(p, 400, 5000)).toBe(p); // 4800 words a minute is a drag on the scrollbar
    expect(paceAdd(p, 20, 5000)).toEqual({ w: 30, ms: 6000 });
  });
  it("turns words into minutes and a label", () => {
    expect(minutesLeft(1380, 230)).toBe(6);
    expect(minutesLeft(0, 230)).toBe(0);
    expect(leftLabel(1380, 230, 3)).toBe("Chapter 3 · about 6 min left in chapter");
    expect(leftLabel(1380, 230, null)).toBe("about 6 min left");
    expect(leftLabel(40, 230, null)).toBe("under a minute left");
    expect(leftLabel(0, 230, null)).toBe("The end");
  });
  it("counts the words a reader sees, not the markers", () => {
    expect(wordCount("one *two* **three** four")).toBe(4);
    expect(wordCount("line one\nline two")).toBe(4);
  });
});

describe("structure shared by the screen and the EPUB", () => {
  it("knows which headings already carry a number", () => {
    ["Chapter One", "3", "IV. The Sea", "Prologue", "Part II", "Afterword", "XII"].forEach((t) => expect(hasOwnNumber(t)).toBe(true));
    ["The Sea", "Mild weather", "Dim light", "I wonder", "Civil"].forEach((t) => expect(hasOwnNumber(t)).toBe(false));
  });
  it("takes explicit beats as given, with a length cap, and falls back to the automatic rule", () => {
    const blocks: Block[] = [h("One"), para(), { type: "p", text: "She waited." }, para(), { type: "p", text: "A long one that is explicitly a beat but short enough." }, para()];
    expect([...beatIndexes(blocks, [4])].sort()).toEqual([2, 4]); // very short lines stay beats
    expect(beatIndexes(blocks, [3]).has(3)).toBe(false); // too long to stand alone
    expect(beatIndexes(blocks).has(2)).toBe(true);
    expect(beatIndexes(blocks, [])).toEqual(beatIndexes(blocks));
  });
  it("gives the EPUB the same beats and numbering as the screen", () => {
    const blocks: Block[] = [
      h("Chapter One"), para(), { type: "p", text: "Wait." }, para(), para(),
      h("The Sea"), para(), { type: "p", text: "Go." }, para(),
      h("IV. Later"), para(),
    ];
    const book: Book = { title: "T", blocks, scenes: [], source: "hand" };
    const want = beatIndexes(blocks, book.beats).size;
    const bytes = buildEpub(book, { ...DEFAULTS, beats: true }, [], new Date(0));
    const text = new TextDecoder("latin1").decode(bytes);
    expect((text.match(/class="beat"/g) || []).length).toBe(want);
    // Only "The Sea" is numbered: "Chapter One" and "IV. Later" carry their own.
    expect((text.match(/class="num"/g) || []).length).toBe(1);
    const off = new TextDecoder("latin1").decode(buildEpub(book, { ...DEFAULTS, beats: false }, [], new Date(0)));
    expect(off).not.toContain('class="beat"');
  });
  it("keeps the cover off the first picture when there are others", () => {
    const sc = (after: number, scene: string) => ({ after, scene });
    expect(coverScene([sc(1, "lamp"), sc(5, "sea"), sc(9, "sea"), sc(12, "rain")], "lamp")).toBe("sea");
    expect(coverScene([sc(1, "lamp"), sc(5, "lamp")], "lamp")).toBe("lamp"); // nothing else to choose
    expect(coverScene([sc(1, "lamp")], "lamp")).toBe("lamp");
    expect(coverScene([sc(1, "lamp"), sc(5, "sea")], "forest")).toBe("forest");
    expect(coverScene([sc(1, "lamp"), sc(5, "sea")], "lamp", "door")).toBe("door"); // the author's choice stands
    expect(showsScene([sc(1, "lamp"), sc(4, "lotus")], "lotus")).toBe(true);
    expect(showsScene([sc(1, "lamp")], "lotus")).toBe(false);
  });
});

describe("the caption's words in the text", () => {
  it("finds the exact words, whole words only", () => {
    const t = "He walked down to the old harbour at dusk.";
    expect(quoteRange(t, "the old harbour")).toEqual([18, 33]);
    expect(t.slice(...quoteRange(t, "the old harbour")!)).toBe("the old harbour");
    expect(quoteRange(t, "old harb")).toBeNull();
    expect(quoteRange(t, "the old harbour at noon…")).toBeNull();
    expect(quoteRange(t, "down to the old harbour…")).toEqual([10, 33]);
    expect(quoteRange(t, "")).toBeNull();
  });
  it("treats any run of whitespace as one space and returns offsets into the original", () => {
    const t = "A light in the  window,\nstill burning.";
    const r = quoteRange(t, "light in the window, still")!;
    expect(t.slice(r[0], r[1])).toBe("light in the  window,\nstill");
  });
  it("is case sensitive, as the Guard is", () => {
    expect(quoteRange("The Sea was calm", "the sea")).toBeNull();
  });
  it("picks the paragraph the caption quotes, within the window", () => {
    const blocks: Block[] = [{ type: "p", text: "A bell rang over the water." }, { type: "p", text: "Nothing else." }, { type: "p", text: "Later still." }];
    expect(cueBlock(blocks, 2, "A bell rang over the water")).toBe(0);
    expect(cueBlock(blocks, 2, "never said")).toBe(-1);
    expect(cueBlock([h("x"), ...blocks], 3, "Later still.")).toBe(3);
  });
});

describe("the saved position", () => {
  it("round trips and rejects junk", () => {
    const s = encodePos({ b: 42, o: 0.3456, w: 1200, ms: 300000 });
    expect(decodePos(s)).toEqual({ b: 42, o: 0.346, w: 1200, ms: 300000 });
    expect(decodePos(encodePos({ b: 0, o: 0 }))).toEqual({ b: 0, o: 0, w: 0, ms: 0 });
    expect(encodePos({ b: 3, o: 7 })).toBe("3:1.000:0:0");
    [null, undefined, 5, "", "3", "a:b:c:d", "3:2.0:0:0", "-1:0.5:0:0", {}].forEach((j) => expect(decodePos(j)).toBeNull());
  });
  it("counts as past the opening only a few paragraphs in", () => {
    const blocks: Block[] = [h("One"), para(), para(), para(), para(), para()];
    expect(pastOpening(blocks, 1)).toBe(false);
    expect(pastOpening(blocks, 3)).toBe(false);
    expect(pastOpening(blocks, 4)).toBe(true);
    expect(pastOpening(blocks, 99)).toBe(false); // the book changed under it
  });
  it("finds the last picture passed", () => {
    const sc: SceneRef[] = [{ after: 2, scene: "a", caption: "x" }, { after: 8, scene: "b", caption: "y" }, { after: 20, scene: "c", caption: "z" }];
    expect(lastFigureBefore(sc, 10)?.scene).toBe("b");
    expect(lastFigureBefore(sc, 8)?.scene).toBe("a"); // the figure after block 8 is not yet passed
    expect(lastFigureBefore(sc, 2)).toBeUndefined();
  });
});

describe("story light", () => {
  const T = (time: "dawn" | "day" | "dusk" | "night", sky: "clear" | "fog" | "rain" | "storm" | "cloud" = "clear") => storyTarget({ time, sky });
  it("dims and cools at night, lifts at dawn, warms at dusk, stays light by day", () => {
    expect(T("night").dark).toBeGreaterThan(T("dusk").dark);
    expect(T("dusk").dark).toBeGreaterThan(T("dawn").dark);
    expect(T("dawn").dark).toBeGreaterThan(T("day").dark - 0.01 - 0.1);
    expect(T("day").dark).toBeLessThan(T("dusk").dark);
    const n = T("night").rgb, d = T("dusk").rgb;
    expect(n[2]).toBeGreaterThan(n[0]);
    expect(d[0]).toBeGreaterThan(d[2]);
    expect(T("day").tm).toBe(0);
  });
  it("greys it slightly under fog, rain and storm", () => {
    const clear = T("dusk"), fog = T("dusk", "fog");
    expect(fog.tm).toBeGreaterThan(clear.tm);
    expect(Math.abs(fog.rgb[0] - fog.rgb[2])).toBeLessThan(Math.abs(clear.rgb[0] - clear.rgb[2]));
    expect(T("day", "storm").dark).toBeGreaterThan(T("day").dark);
    expect(T("night", "storm").dark).toBeLessThanOrEqual(0.96);
  });
  it("is neutral without a spec", () => {
    expect(storyTarget(null).tm).toBe(0);
  });
});

describe("settings", () => {
  it("maps the old Dawn light to Story and keeps the new settings valid", () => {
    expect(migrate({ light: "dawn" }).light).toBe("story");
    expect(migrate({ captions: "both", pictures: "still" })).toMatchObject({ captions: "both", pictures: "still" });
    expect(migrate({ captions: "loud", pictures: 3 }).captions).toBeUndefined();
    expect(DEFAULTS.captions).toBe("cue");
    expect(DEFAULTS.pictures).toBe("on");
  });
});
