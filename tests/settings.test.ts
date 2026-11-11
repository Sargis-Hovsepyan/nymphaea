// New book settings: defaults, validation, old looks carrying over, and the textures staying readable.
import { describe, expect, it } from "vitest";
import { THEMES, THEME_LIST, contrast } from "../src/design/themes";
import { PRESETS } from "../src/design/presets";
import { DEFAULTS, DENS, FIGW, LEAD, STRUCTURAL, migrate, withDefaults } from "../src/settings";
import { autoStage } from "../src/stage/auto";
import type { Block } from "../src/types";

const mix = (a: string, b: string, t: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");

describe("new book settings", () => {
  it("default to today's look", () => {
    expect(DEFAULTS).toMatchObject({ frame: "inline", leading: "normal", hyphens: false, paper: "grain", chapterStyle: "classic", cover: "picture", progress: "time", size: "m", density: "some", theme: "parchment", mode: "light", style: "ink" });
  });
  it("accept every valid value and drop junk", () => {
    const ok = { frame: "head", leading: "loose", hyphens: true, paper: "linen", chapterStyle: "numeral", cover: "minimal", progress: "none", size: "full", density: "every" };
    expect(migrate(ok)).toMatchObject(ok);
    const bad = migrate({ frame: "float", leading: 3, hyphens: "yes", paper: "marble", chapterStyle: "x", cover: "", progress: "ring", size: "xl", density: "lots" });
    ["frame", "leading", "hyphens", "paper", "chapterStyle", "cover", "progress", "size", "density"].forEach((k) => expect(k in bad).toBe(false));
  });
  it("old saved looks stay valid and fill from defaults", () => {
    const old = withDefaults({ theme: "vellum", rev: 3, size: "l" });
    expect(old).toMatchObject({ theme: "vellum", size: "l", frame: "inline", paper: "none", progress: "time" });
  });
  it("keeps hyphenation for justified looks saved before the setting existed", () => {
    expect(migrate({ align: "justify", rev: 3 }).hyphens).toBe(true);
    expect(migrate({ align: "justify", hyphens: false }).hyphens).toBe(false);
    expect(migrate({ align: "ragged" }).hyphens).toBeUndefined();
  });
  it("marks the settings that rebuild the book", () => {
    ["frame", "cover", "size", "leading", "hyphens", "chapterStyle", "density"].forEach((k) => expect(STRUCTURAL[k as keyof typeof STRUCTURAL]).toBe(true));
  });
  it("has a width for every size and a multiplier for every leading", () => {
    expect(FIGW.full).toBe("100%");
    expect(LEAD.tight).toBeLessThan(LEAD.normal);
    expect(LEAD.loose).toBeGreaterThan(LEAD.normal);
  });
  it("presets only use valid values", () => {
    PRESETS.forEach((p) => expect(migrate(p.s)).toMatchObject(p.s));
  });
});

describe("density every", () => {
  const blocks: Block[] = [];
  for (let c = 0; c < 6; c++) {
    blocks.push({ type: "h", level: 1, text: "Chapter " + c });
    for (let p = 0; p < 6; p++) blocks.push({ type: "p", text: ("The lamp burned low on the table and she walked down to the harbour where the boat waited in the rain. ").repeat(4) + "Number " + c + p });
  }
  it("asks for the fewest words per picture", () => {
    expect(DENS.every).toBeLessThan(DENS.many);
    expect(DENS.every).toBe(140);
  });
  it("places more pictures than many", () => {
    expect(autoStage(blocks, "every").length).toBeGreaterThan(autoStage(blocks, "many").length);
  });
});

describe("paper textures", () => {
  // The textures draw the ink at up to 3.5% over the desk in thin lines; check a 5% shift anyway.
  THEME_LIST.forEach((t) => (["dark", "light"] as const).forEach((m) => it(THEMES[t].name + " " + m + " keeps 4.5:1 under texture", () => {
    const p = THEMES[t][m], bg = mix(p.desk, p.ink, 0.05);
    expect(contrast(p.ink, bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.muted, bg)).toBeGreaterThanOrEqual(4.5);
  })));
});

describe("the default look", () => {
  it("opens in ink on yellowed paper, and the Studio moves an untouched old default to it", async () => {
    const { studioLook } = await import("../src/settings");
    expect(studioLook(null)).toMatchObject({ theme: "parchment", mode: "light", style: "ink", paper: "grain" });
    expect(studioLook({ theme: "lamplight", mode: "dark", preset: "lamplight", rev: 3 })).toMatchObject({ theme: "parchment", style: "ink" });
    // A look the author chose stays.
    expect(studioLook({ theme: "nocturne", mode: "dark", style: "glow", preset: "nocturne", rev: 3 })).toMatchObject({ theme: "nocturne", style: "glow" });
    // A book saved before keeps its look.
    expect(withDefaults({ style: "cut", rev: 3 })).toMatchObject({ theme: "lamplight", mode: "dark", paper: "none" });
  });
});
