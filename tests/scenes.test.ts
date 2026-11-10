// Every scene must draw without throwing for every story beat t in [0,1].
// The mock canvas is strict where real canvases throw: non-finite numbers, colour stops outside
// [0,1], and negative radii.
import { describe, expect, it } from "vitest";
import { SCENES } from "../src/scenes";
import { SCENE_LIST } from "../src/stage/keywords";

// Node has no Path2D; the vector-scene adapter only needs one to exist.
(globalThis as Record<string, unknown>).Path2D ??= class { constructor(public d?: string) {} };

function strictCtx(): { ctx: CanvasRenderingContext2D; problems: string[]; calls: () => number } {
  const problems: string[] = [];
  let calls = 0;
  const finite = (name: string, args: unknown[]) => args.forEach((a, i) => {
    if (typeof a === "number" && !Number.isFinite(a)) problems.push(name + " arg " + i + " = " + a);
  });
  const grad = { addColorStop: (o: number) => { if (!(o >= 0 && o <= 1)) problems.push("addColorStop " + o); } };
  const store: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p];
      return (...args: number[]) => {
        calls++;
        finite(String(p), args);
        if (p === "createRadialGradient" && (args[2] < 0 || args[5] < 0)) problems.push("negative radial radius");
        if (p === "arc" && args[2] < 0) problems.push("negative arc radius");
        if (p === "ellipse" && (args[2] < 0 || args[3] < 0)) problems.push("negative ellipse radius");
        if (p === "createLinearGradient" || p === "createRadialGradient") return grad;
        return undefined;
      };
    },
    set(t, p, v) {
      if (typeof v === "number" && !Number.isFinite(v)) problems.push("set " + String(p) + " = " + v);
      t[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, problems, calls: () => calls };
}

describe("scenes", () => {
  it("every scene in the library has a drawing function", () => {
    SCENE_LIST.forEach((s) => expect(typeof SCENES[s], s).toBe("function"));
  });

  SCENE_LIST.forEach((name) => {
    it(name + " draws cleanly for t in [0,1]", () => {
      const { ctx, problems, calls } = strictCtx();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        [0, 1.7, 13.37, 600].forEach((tm) => expect(() => SCENES[name](ctx, t, tm)).not.toThrow());
      }
      expect(problems).toEqual([]);
      expect(calls()).toBeGreaterThan(0);
    });
  });
});
