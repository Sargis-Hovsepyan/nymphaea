// Design guarantees: every palette is readable in both moods, old saved looks carry over, the type
// arithmetic behaves, micro-typography never changes a character, and the page geometry is sound.
import { describe, expect, it } from "vitest";
import { PRESETS } from "../src/design/presets";
import { STUDIO } from "../src/design/studio";
import { THEMES, THEME_LIST, contrast } from "../src/design/themes";
import { MEASURE, PAIRINGS, PAIRING_LIST, fontsHref, leading, normSize, numeral } from "../src/design/type";
import { geometry, pageAt, printCss } from "../src/layout/geometry";
import { highlight } from "../src/maker/editor";
import { DEFAULTS, migrate, withDefaults } from "../src/settings";
import { capsRuns, isShouting, tailStart } from "../src/text/micro";

describe("palettes", () => {
  THEME_LIST.forEach((t) => (["dark", "light"] as const).forEach((m) => {
    it(THEMES[t].name + " " + m + " is readable", () => {
      const p = THEMES[t][m];
      expect(contrast(p.ink, p.desk)).toBeGreaterThanOrEqual(7);
      expect(contrast(p.ink, p.panel)).toBeGreaterThanOrEqual(7);
      expect(contrast(p.muted, p.desk)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accent, p.desk)).toBeGreaterThanOrEqual(3);
      expect(contrast(p.accent2, p.desk)).toBeGreaterThanOrEqual(3);
      // The canvas styles print with hi on lo: they must read too.
      expect(contrast(p.hi, p.lo)).toBeGreaterThanOrEqual(7);
    });
    it(THEMES[t].name + " " + m + " is dim: nothing pure white or pure black", () => {
      Object.values(THEMES[t][m]).forEach((c) => { expect(c.toLowerCase()).not.toBe("#ffffff"); expect(c.toLowerCase()).not.toBe("#000000"); });
    });
  }));
});

describe("the Studio's own palette", () => {
  (["dark", "light"] as const).forEach((m) => it("night water " + m + " is readable and dim", () => {
    const p = STUDIO[m];
    expect(contrast(p.ink, p.desk)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.ink, p.panel)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.ink, p.raised)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.muted, p.desk)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.muted, p.raised)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.accent, p.desk)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.pollen, p.desk)).toBeGreaterThanOrEqual(3);
    expect(contrast(m === "dark" ? p.desk : p.panel, p.accent)).toBeGreaterThanOrEqual(4.5); // text on a primary button
    Object.values(p).forEach((c) => { expect(c.toLowerCase()).not.toBe("#ffffff"); expect(c.toLowerCase()).not.toBe("#000000"); });
  }));
});

describe("settings migration", () => {
  it("rev 2 rooms become a theme and a mood", () => {
    expect(migrate({ room: "paper", rev: 2 })).toMatchObject({ theme: "lamplight", mode: "light" });
    expect(migrate({ room: "midnight", rev: 2 })).toMatchObject({ theme: "nocturne", mode: "dark" });
    expect(migrate({ room: "lamplit", rev: 2 })).toMatchObject({ theme: "lamplight", mode: "dark" });
  });
  it("lamp, dropcap, reveal and font map onto the new settings", () => {
    expect(migrate({ lamp: false, dropcap: false, reveal: false, font: "mono", rev: 2 })).toMatchObject({ light: "off", opening: "none", reveal: "none", pairing: "typewriter" });
    expect(migrate({ lamp: true, dropcap: true, reveal: true, font: "sans", rev: 2 })).toMatchObject({ light: "lamp", opening: "drop", reveal: "rise", pairing: "modern" });
  });
  it("a rev 1 look drops its old default style; a rev 2 choice is kept", () => {
    expect(migrate({ room: "lamplit", style: "dither" }).style).toBeUndefined();
    expect(migrate({ room: "lamplit", style: "dither", rev: 2 }).style).toBe("dither");
  });
  it("junk is ignored and the result is always a full, valid look", () => {
    const s = withDefaults({ theme: "neon", fontSize: 400, layout: 3, mode: "dark", motion: "yes" });
    expect(s.theme).toBe(DEFAULTS.theme); expect(s.fontSize).toBe(DEFAULTS.fontSize); expect(s.layout).toBe(DEFAULTS.layout);
    expect(s.mode).toBe("dark"); expect(s.motion).toBe(true);
    expect(withDefaults(null)).toEqual(DEFAULTS);
  });
  it("every preset is a valid look", () => {
    PRESETS.forEach((p) => expect(withDefaults({ ...DEFAULTS, ...p.s, preset: p.id })).toEqual({ ...DEFAULTS, ...p.s, preset: p.id }));
  });
});

describe("type", () => {
  it("leading grows with the measure and the x-height, within bounds", () => {
    [0.4, 0.45, 0.5].forEach((xh) => expect(leading(MEASURE.narrow, xh, false)).toBeLessThan(leading(MEASURE.wide, xh, false)));
    expect(leading(66, 0.4, false)).toBeLessThan(leading(66, 0.5, false));
    expect(leading(66, 0.46, true)).toBeGreaterThan(leading(66, 0.46, false));
    PAIRING_LIST.forEach((p) => (["narrow", "normal", "wide"] as const).forEach((m) => {
      const lh = leading(MEASURE[m], PAIRINGS[p].xh, true);
      expect(lh).toBeGreaterThanOrEqual(1.35); expect(lh).toBeLessThanOrEqual(1.85);
    }));
  });
  it("sizes are matched by x-height: a small-eyed face is set larger", () => {
    expect(normSize(19, PAIRINGS.classic.xh)).toBeGreaterThan(normSize(19, PAIRINGS.clear.xh));
    expect(normSize(19, 0.46)).toBe(19);
  });
  it("loads only the chosen pairing's fonts", () => {
    const h = fontsHref("classic");
    expect(h).toContain("EB+Garamond"); expect(h).toContain("Cormorant+Garamond"); expect(h).not.toContain("Newsreader");
    expect(h.startsWith("https://fonts.googleapis.com/css2?")).toBe(true);
  });
  it("numerals", () => {
    expect([1, 4, 9, 14, 40].map((n) => numeral(n, "roman"))).toEqual(["I", "IV", "IX", "XIV", "XL"]);
    expect([1, 12, 21, 40].map((n) => numeral(n, "words"))).toEqual(["One", "Twelve", "Twenty-one", "Forty"]);
    expect(numeral(3, "none")).toBe("");
  });
});

describe("micro-typography never changes a character", () => {
  const samples = ["NASA sent the BBC a TV.", "He said NO. Then YES.", "I AM SHOUTING NOW", "A quiet line, with OK in it and the end."];
  it("small-caps runs join back to the text", () => {
    samples.forEach((s) => expect(capsRuns(s, isShouting(s)).map((r) => r.t).join("")).toBe(s));
    expect(capsRuns("NASA sent the BBC a TV.", false).filter((r) => r.sc).map((r) => r.t)).toEqual(["NASA", "BBC", "TV"]);
    expect(capsRuns("I AM SHOUTING NOW", isShouting("I AM SHOUTING NOW")).every((r) => !r.sc)).toBe(true);
  });
  it("the unbreakable tail is the last two words", () => {
    const t = "The lamp above the table buzzed quietly.";
    expect(t.slice(tailStart(t, 7))).toBe("buzzed quietly.");
    expect(tailStart("Too short.", 2)).toBe(-1);
  });
});

describe("pages", () => {
  it("page index from position", () => {
    expect(pageAt(0, 400, 50)).toBe(0);
    expect(pageAt(424, 400, 50)).toBe(0);
    expect(pageAt(450, 400, 50)).toBe(1);
    expect(pageAt(900, 400, 50)).toBe(2);
  });
  it("two pages on a wide screen, one on a phone, always inside the viewport", () => {
    [[1440, 900], [1024, 700], [390, 844], [820, 1180]].forEach(([w, h]) => {
      const g = geometry(w, h, 620, 44);
      expect(g.per).toBe(w >= 900 ? 2 : 1);
      expect(g.left).toBeGreaterThanOrEqual(15);
      expect(g.left + g.spreadW).toBeLessThanOrEqual(w - 15);
      expect(g.pageW).toBeLessThanOrEqual(620);
      expect(g.top + g.height).toBeLessThan(h);
    });
  });
  it("print: trim size, mirrored margins, folios, chapters on a new page", () => {
    const c = printCss({ ...DEFAULTS, trim: "6x9" });
    expect(c).toContain("size:6in 9in");
    expect(c).toContain("@page :left"); expect(c).toContain("@page :right");
    expect(c).toContain("counter(page)");
    expect(c).toContain(".ch{break-before:page");
  });
});

describe("the editor's colour mirror", () => {
  const plain = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  it("never adds or drops a character", () => {
    const samples = [
      "# Title\n\nA *quiet* line, with **weight** & a <tag>.\n\n* * *\n\n> “Quoted,” she said.\n> — Name\n\nVerse one\\nVerse two\n\n---\n\n## Part 2\n",
      "", "\n\n", "no markup at all", "*unclosed and **also unclosed", "a * b * c", "***", "**", "\\", "# \n>",
    ];
    samples.forEach((s) => expect(plain(highlight(s))).toBe(s));
  });
  it("marks headings, quotes, breaks, verse and emphasis", () => {
    expect(highlight("# A")).toContain('class="hd"');
    expect(highlight("> A")).toContain('class="qt"');
    expect(highlight("* * *")).toContain('class="bk"');
    expect(highlight("one\\")).toContain('class="vb"');
    expect(highlight("a *b* c")).toContain('class="ex"');
    expect(highlight("a **b** c")).toContain('class="sx"');
  });
});
