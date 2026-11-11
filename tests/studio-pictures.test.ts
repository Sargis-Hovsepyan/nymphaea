// Moving a picture by a paragraph, the paintings nothing uses any more, undo onto edited text,
// and the old single draft becoming a book on the shelf.
import { describe, expect, it } from "vitest";
import { parseDraft } from "../src/parse";
import { captionIsQuoted } from "../src/stage/guard";
import type { SceneRef } from "../src/types";
import { GRACE_MS, imageAge, referenced, unreferenced } from "../src/maker/gc";
import { canMove, movePicture, neighbourProse } from "../src/maker/pictureMove";
import { restorePictures } from "../src/maker/restore";
import { asDraft, byRecent, migrateDraft, shelve } from "../src/maker/shelfData";

const MD = "# One\n\nThe lamp burned low on the table.\n\nShe walked down to the sea at dawn.\n\n* * *\n\nThe boat leaned into the wind.\n\n## Two\n\nNobody came back that night.";
const { blocks } = parseDraft(MD, "");
const at = (t: string) => blocks.findIndex((b) => b.text.startsWith(t));
const lamp = at("The lamp"), sea = at("She walked"), boat = at("The boat"), last = at("Nobody");

describe("moving a picture", () => {
  it("steps over headings and scene breaks to the next paragraph", () => {
    expect(neighbourProse(blocks, lamp, 1)).toBe(sea);
    expect(neighbourProse(blocks, sea, 1)).toBe(boat);
    expect(neighbourProse(blocks, boat, 1)).toBe(last);
    expect(neighbourProse(blocks, lamp, -1)).toBe(-1);
    expect(neighbourProse(blocks, last, 1)).toBe(-1);
  });
  it("keeps a caption that still quotes the text where it lands", () => {
    const s: SceneRef[] = [{ after: sea, scene: "sea", caption: "The lamp burned" }];
    const m = movePicture(blocks, s, 0, -1)!;
    expect(m.scenes[0].after).toBe(lamp);
    expect(m.recaptioned).toBe(false);
    expect(m.scenes[0].caption).toBe("The lamp burned");
  });
  it("re-picks a caption from the new paragraph when the old one no longer quotes", () => {
    const s: SceneRef[] = [{ after: lamp, scene: "lamp", caption: "The lamp burned low" }];
    const m = movePicture(blocks, s, 0, 1)!, out = m.scenes[m.index];
    expect(out.after).toBe(sea);
    expect(m.recaptioned).toBe(false); // the window reaches back to the lamp paragraph
    const far: SceneRef[] = [{ after: lamp, scene: "lamp", caption: "The lamp burned low" }];
    const m2 = movePicture(blocks, far, 0, 1)!;
    let cur = m2, k = m2.index;
    for (let i = 0; i < 2; i++) { const n = movePicture(blocks, cur.scenes, k, 1)!; cur = n; k = n.index; }
    expect(captionIsQuoted(cur.scenes[k].caption, blocks, cur.scenes[k].after)).toBe(true);
  });
  it("re-quotes from the paragraph when the caption is gone from the window", () => {
    const text = "# T\n\n" + Array.from({ length: 10 }, (_, i) => (i === 0 ? "The red kite hung over the hill." : "Paragraph number " + i + " is about nothing much.")).join("\n\n");
    const bl = parseDraft(text, "").blocks;
    const from = bl.findIndex((b) => b.text.startsWith("The red kite"));
    const s: SceneRef[] = [{ after: from, scene: "field", caption: "The red kite hung" }];
    let m = movePicture(bl, s, 0, 1)!, k = m.index;
    for (let i = 0; i < 9; i++) { const n = movePicture(bl, m.scenes, k, 1); if (!n) break; m = n; k = n.index; }
    const o = m.scenes[k];
    expect(captionIsQuoted(o.caption, bl, o.after)).toBe(true);
    expect(o.caption).not.toBe("The red kite hung");
  });
  it("returns null at the ends and reports which way is open", () => {
    const s: SceneRef = { after: lamp, scene: "lamp", caption: "The lamp" };
    expect(movePicture(blocks, [s], 0, -1)).toBeNull();
    expect(canMove(blocks, s)).toEqual({ up: false, down: true });
  });
  it("sorts the pictures and says where the moved one went", () => {
    const s: SceneRef[] = [{ after: lamp, scene: "lamp", caption: "The lamp" }, { after: sea, scene: "sea", caption: "walked down" }];
    const m = movePicture(blocks, s, 0, 1)!;
    expect(m.scenes.map((x) => x.after)).toEqual([sea, sea]);
    expect(m.scenes[m.index].scene).toBe("lamp");
  });
});

describe("paintings nothing uses", () => {
  const now = Date.UTC(2026, 10, 11), old = "i" + (now - 3_600_000).toString(36) + "abc", fresh = "i" + (now - 1000).toString(36) + "xyz";
  it("reads the age from the id", () => { expect(imageAge(old)).toBe(now - 3_600_000); expect(imageAge("weird")).toBe(0); });
  it("keeps what the draft, a shelved book or the undo stack use", () => {
    const keep = referenced([{ after: 1, scene: "x", caption: "", img: "a1" }], [{ after: 1, scene: "x", caption: "", img: "b2" }], undefined);
    expect(Array.from(keep).sort()).toEqual(["a1", "b2"]);
  });
  it("deletes only old unreferenced ids", () => {
    expect(unreferenced([old, fresh, "a1"], new Set(["a1"]), now)).toEqual([old]);
    expect(unreferenced([old], new Set([old]), now)).toEqual([]);
  });
  it("never touches an id younger than the grace period or one it cannot date", () => {
    expect(unreferenced([fresh, "i-not-a-date"], new Set(), now, GRACE_MS)).toEqual([]);
  });
});

describe("undo puts pictures back onto the text as it is now", () => {
  const scenes: SceneRef[] = [{ after: sea, scene: "sea", caption: "walked down to the sea" }];
  it("restores them as they were when the text is unchanged", () => {
    const r = restorePictures(blocks, MD, "", { md: MD, title: "", scenes, beats: [sea] });
    expect(r.scenes).toEqual(scenes);
    expect(r.beats).toEqual([sea]);
  });
  it("follows the paragraph when text was added above it since", () => {
    const md2 = "Brand new opening line.\n\n" + MD, cur = parseDraft(md2, "").blocks;
    const r = restorePictures(cur, md2, "", { md: MD, title: "", scenes, beats: [sea] });
    expect(cur[r.scenes[0].after].text).toBe("She walked down to the sea at dawn.");
    expect(cur[r.beats![0]].text).toBe("She walked down to the sea at dawn.");
  });
  it("drops a picture whose paragraph was deleted", () => {
    const md2 = MD.replace("She walked down to the sea at dawn.\n\n", ""), cur = parseDraft(md2, "").blocks;
    expect(restorePictures(cur, md2, "", { md: MD, title: "", scenes }).scenes).toEqual([]);
  });
});

describe("the bookshelf", () => {
  const old = { md: MD, title: "My book", scenes: [{ after: boat, scene: "boat", caption: "The boat leaned" }, { after: lamp, scene: "lamp", caption: "The lamp" }], source: "hand", cover: "boat" };
  it("turns the old single draft into the first book", () => {
    const m = migrateDraft(old, [], 1000)!;
    expect(m.title).toBe("My book");
    expect(m.updated).toBe(1000);
    expect(m.words).toBeGreaterThan(10);
    expect(m.pic).toEqual({ scene: "lamp", img: undefined });
    expect(m.draft.cover).toBe("boat");
    expect(m.id).toMatch(/^b/);
    expect(m.draft.id).toBe(m.id);
  });
  it("does nothing for an empty draft, junk, or a book already shelved", () => {
    expect(migrateDraft({ md: "  " }, [])).toBeNull();
    expect(migrateDraft(null, [])).toBeNull();
    expect(migrateDraft("x", [])).toBeNull();
    const m = migrateDraft({ ...old, id: "b1" }, [])!;
    expect(m.id).toBe("b1");
    expect(migrateDraft({ ...old, id: "b1" }, ["b1"])).toBeNull();
  });
  it("cleans up odd drafts instead of trusting them", () => {
    const d = asDraft({ md: "Hi.", title: 5, scenes: "no", source: "weird", beats: [1] })!;
    expect(d.title).toBe("");
    expect(d.scenes).toEqual([]);
    expect(d.source).toBe("auto");
  });
  it("lists the newest first", () => {
    const a = shelve({ md: "One.", title: "A", scenes: [], source: "auto" }, "a", 1), b = shelve({ md: "Two.", title: "B", scenes: [], source: "auto" }, "b", 2);
    expect([a, b].sort(byRecent).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
