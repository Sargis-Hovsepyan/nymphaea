// Vector scenes: every library scene exists, every part it animates exists in its markup,
// and no update ever writes NaN/Infinity into the SVG, for any beat t in [0,1].
import { describe, expect, it } from "vitest";
import { SCENE_LIST } from "../src/stage/keywords";
import { VSCENES, type VApi } from "../src/vscenes";

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

describe("vector scenes", () => {
  it("cover every scene in the library", () => {
    SCENE_LIST.forEach((s) => expect(VSCENES[s], s).toBeDefined());
  });

  SCENE_LIST.forEach((name) => {
    it(name + " builds and animates cleanly for t in [0,1]", () => {
      const markup = VSCENES[name].build("t1");
      expect(markup).not.toMatch(/NaN|Infinity|undefined/);
      expect(markup).toContain('class="s ');
      const problems: string[] = [];
      const api = fakeApi(markup, problems);
      for (let i = 0; i <= 40; i++) [0, 2.5, 600].forEach((tm) => VSCENES[name].update(api, i / 40, tm));
      expect(problems).toEqual([]);
    });
  });
});
