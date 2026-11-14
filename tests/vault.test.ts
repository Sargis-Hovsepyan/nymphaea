import { describe, expect, it } from "vitest";
import { seal, unseal } from "../src/ai/vault";

describe("vault", () => {
  it("unlocks with the right password only", async () => {
    const s = await seal("gsk_secret", "correct horse battery");
    expect(s).not.toContain("gsk_secret");
    expect(await unseal(s, "correct horse battery")).toBe("gsk_secret");
    expect(await unseal(s, "wrong password here")).toBeNull();
    expect(await unseal("garbage", "correct horse battery")).toBeNull();
  });
});
