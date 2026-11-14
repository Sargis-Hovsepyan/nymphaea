// The Studio's CSS is inlined into every exported book (pristine.css copies every <style> on the page),
// so it must never style anything a book has. pond.css is held to strict scoping; every Studio sheet
// is kept off the page root and away from fonts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(new URL("../src/maker/" + f, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The selector of every rule, with @keyframes bodies left out and @media/@supports looked inside. */
function selectors(css: string): string[] {
  const out: string[] = [];
  let depth = 0, buf = "", skip = -1;
  for (const ch of css) {
    if (ch === "{") {
      const head = buf.trim(); buf = "";
      if (skip < 0 && head.startsWith("@keyframes")) skip = depth;
      else if (skip < 0 && !head.startsWith("@")) out.push(...head.split(",").map((s) => s.trim()).filter(Boolean));
      depth++;
    } else if (ch === "}") {
      depth--; buf = "";
      if (skip === depth) skip = -1;
    } else buf += ch;
  }
  return out;
}

const SCOPED = /^(\.mk(\b|[ .:#[>])|body\.mk-on\b|:root\[data-mode="(light|dark)"\] \.mk\b|#mkUndoBtn\.mk-icon$)/;

describe("Studio CSS never reaches a book", () => {
  it("scopes every pond.css rule to the Studio", () => {
    const loose = selectors(read("pond.css")).filter((s) => !SCOPED.test(s) && !/^(from|to|\d+%)$/.test(s));
    expect(loose).toEqual([]);
  });

  it.each(["pond.css", "maker.css", "views.css"])("%s leaves the page root and the fonts alone", (f) => {
    const css = read(f);
    expect(css).not.toMatch(/(^|[}\s,])(:root|html|body|\*)\s*\{/);
    expect(css).not.toMatch(/@font-face|@import/);
  });
});
