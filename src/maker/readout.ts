// What a picture was read from, kind by kind, with the words that named each part and where those
// words were: the words chosen for the picture, the rest of their paragraph, or the chapter before.
// Shared by the landing desk, the selection bar and the picture inspector. Display only.
import type { Named, QuoteReading, Source } from "../compose/read";
import { LABEL, type Spec } from "../compose/spec";
import { describeActs } from "../compose/acts";
import { esc } from "../text/strings";

export interface Row { label: string; value: string; words: string[]; from?: Source }

const bare = (t: string) => t.replace(/^(a|an|the) /, "");
export const FROM_NAME: Record<Source, string> = { words: "your words", paragraph: "the paragraph", chapter: "the chapter" };

/** The rows for a spec read from one passage, with the words that named each part. */
export const rowsOf = (s: Spec, named: Named): Row[] => rows(s, named);
/** The rows for chosen words: each says where it came from (the words, the paragraph, the chapter) and shows the words there. */
export const rowsOfReading = (r: QuoteReading): Row[] => rows(r.spec, r.named.words, r);

function rows(s: Spec, named: Named, reading?: QuoteReading): Row[] {
  const nm = (k: keyof Named, f?: Source): string[] => !reading ? named[k] : f === "words" ? reading.named.words[k] : f === "paragraph" ? reading.named.paragraph[k] : [];
  const fr = reading ? reading.from : {};
  const out: Row[] = [
    { label: "Place", value: s.place === "inner" ? "" : bare(LABEL.place[s.place]), words: nm("place", fr.place), from: fr.place },
    { label: "Hour", value: s.time, words: nm("time", fr.time), from: fr.time },
    { label: "Weather", value: s.sky === "clear" ? "" : s.sky, words: nm("sky", fr.sky), from: fr.sky },
    { label: "Season", value: s.season === "none" ? "" : s.season, words: nm("season", fr.season), from: fr.season },
    { label: "Things", value: s.props.map((p) => bare(LABEL.prop[p])).join(", "), words: nm("props", fr.props), from: fr.props },
    { label: "Figures", value: s.who ? s.who + (s.who === 1 ? " figure" : " figures") + (s.pose !== "stand" && LABEL.pose[s.pose] ? ", " + LABEL.pose[s.pose] : "") : "", words: [...nm("people", fr.people), ...nm("pose", fr.pose)].filter((w, i, a) => a.indexOf(w) === i), from: fr.people },
    { label: "Moving", value: (s.fx || []).map((x) => LABEL.fx[x]).join(", "), words: nm("motion", fr.motion), from: fr.motion },
    { label: "Acting", value: s.acts && s.acts.length ? describeActs(s) : "", words: nm("act", fr.act), from: fr.act },
  ];
  return out.filter((r) => r.value);
}

/** The rows as a definition list's items (dt/dd pairs wrapped in a div each). */
export function rowsHtml(rows: Row[], max = 2): string {
  return rows.map((r) => `<div${r.from ? ` data-from="${r.from}"` : ""}><dt>${r.label}</dt><dd>${esc(r.value)}${r.words.length ? `<q>${r.words.slice(0, max).map(esc).join(", ")}</q>` : ""}${r.from ? `<small>${FROM_NAME[r.from]}</small>` : ""}</dd></div>`).join("");
}
