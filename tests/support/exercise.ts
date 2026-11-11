// Build a scene and run it over the beat, the seconds and the play clock, collecting every missing
// part, duplicate key and NaN it writes. Shared by the scene tests.
import { vscene } from "../../src/compose";
import type { VApi } from "../../src/vscenes";

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

export function exercise(id: string): string[] {
  const vs = vscene(id), markup = vs.build("t");
  const problems: string[] = [];
  if (/NaN|Infinity|undefined/.test(markup)) problems.push("markup has NaN");
  const keys = Array.from(markup.matchAll(/data-a="([^"]+)"/g)).map((m) => m[1]);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dup.length) problems.push("duplicate parts " + dup.join(","));
  const api = fakeApi(markup, problems);
  for (let i = 0; i <= 12; i++) [0, 3.3, 900].forEach((tm) => vs.update(api, i / 12, tm));
  // The play clock: the still (none), the start, during, after and far on.
  [undefined, 0, 0.7, 2.5, 9, 900].forEach((p) => vs.update(api, 1, 3.3, p));
  return problems;
}
