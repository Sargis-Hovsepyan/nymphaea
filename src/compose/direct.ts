// Directing a picture in plain words: "make her run", "add rain", "at night", "closer", "no dog",
// "she opens the door, then leaves". The direction is read by the same reading as the book
// (compose/read.ts), so it names places, hours, weather, things and acts the same way; a few words
// of its own handle the camera and taking things away. The direction changes only the picture:
// it is never added to the author's words. Pure.
import { bindActs, evidence } from "./read";
import { describeActs } from "./acts";
import { FX, LABEL, MAX_PROPS, PLACES, SKIES, TIMES, withWho, type Fx, type Prop, type Sky, type Spec } from "./spec";

export interface Direction { spec: Spec; changes: string[] }

const SHOT_WORDS: [RegExp, Spec["shot"]][] = [
  [/\b(close[\s-]?up|closer|close|zoom in|tight)\b/, "close"], [/\b(nearer|mid|medium|half)\b/, "mid"], [/\b(wide|wider|further|farther|zoom out|far)\b/, "wide"],
];
const NO = /\b(no|without|remove|take away|drop|lose|get rid of|less)\s+(the\s+|a\s+|an\s+)?/;
const SUBJ_FIX: [RegExp, string][] = [
  // "make her run", "let them dance": the person becomes the subject.
  [/\b(make|let|have|get)\s+(her|him|them|me|us)\b/g, "$2"], [/\bher\b(?=\s+(?:run|walk|go|sit|stand|kneel|fall|jump|bow|wave|look|read|drink|laugh|weep|cry|leave|open|close|light|turn|dance))/g, "she"],
  [/\bhim\b(?=\s+(?:run|walk|go|sit|stand|kneel|fall|jump|bow|wave|look|read|drink|laugh|weep|cry|leave|open|close|light|turn|dance))/g, "he"],
  [/\bthem\b(?=\s+(?:run|walk|go|sit|stand|kneel|fall|jump|dance|hug|kiss|embrace|leave|turn))/g, "they"],
];
/** Imperative commands ("open the door") get a subject: the first figure. */
const IMPERATIVE = /^(open|close|shut|light|blow|walk|run|go|sit|stand|get|kneel|fall|jump|bow|wave|look|read|drink|laugh|weep|cry|leave|enter|turn|point|raise|lift|take|pick|put|drop|throw|knock|dance|hug|kiss|embrace|nod|smile|speak|whisper)\b/;
const SKY_NAMES: Record<string, Sky> = { rain: "rain", rainy: "rain", raining: "rain", snow: "snow", snowy: "snow", fog: "fog", foggy: "fog", mist: "fog", wind: "wind", windy: "wind", storm: "storm", stormy: "storm", cloud: "cloud", clouds: "cloud", cloudy: "cloud" };

/** Read a direction against the picture it changes. */
export function direct(sp: Spec, text: string): Direction {
  const raw = text.toLowerCase().replace(/[“”"]/g, " ").trim();
  let s: Spec = { ...sp, props: [...sp.props], ...(sp.fx ? { fx: [...sp.fx] } : {}) };
  const changes: string[] = [];
  if (!raw) return { spec: s, changes };

  // The camera.
  for (const [re, shot] of SHOT_WORDS) if (re.test(raw)) { if (s.shot !== shot) { s.shot = shot; changes.push("Shot: " + ({ wide: "wide", mid: "nearer", close: "close up" })[shot]); } break; }
  if (/\b(another view|vary|different view|new layout)\b/.test(raw)) { s.seed = (s.seed + 7919) % 46656; changes.push("A new view of the place"); }
  if (/\b(no acting|still|stop acting|nothing happens|don't act|do not act)\b/.test(raw) && s.acts?.length) { delete s.acts; changes.push("Acting: off"); }

  // Taking things away: "no rain", "without the dog".
  const parts = raw.split(/\s*(?:,|;|\band then\b|\bthen\b|\band\b|\.)\s*/).filter(Boolean);
  const keep: string[] = [];
  parts.forEach((p) => {
    const m = NO.exec(p);
    if (!m) { keep.push(p); return; }
    const rest = p.slice(m.index + m[0].length).trim(), word = rest.split(/\s+/)[0] || "";
    if (SKY_NAMES[word] && s.sky === SKY_NAMES[word]) { s.sky = "clear"; changes.push("Weather: clear"); return; }
    if (/^(one|body|people|figures?|person)$/.test(word) || /^nobody/.test(p)) { s = withWho(s, 0); changes.push("Figures: none"); return; }
    if (/^(acting|action)$/.test(word)) { if (s.acts?.length) { delete s.acts; changes.push("Acting: off"); } return; }
    const e = evidence(rest);
    const gone = (Object.keys(e.props) as Prop[]).filter((q) => s.props.includes(q));
    if (gone.length) { s.props = s.props.filter((q) => !gone.includes(q)); gone.forEach((q) => changes.push("Without " + LABEL.prop[q])); return; }
    const fx = (Object.keys(e.fx) as Fx[]).filter((q) => s.fx?.includes(q));
    if (fx.length) { s.fx = (s.fx || []).filter((q) => !fx.includes(q)); fx.forEach((q) => changes.push("No " + LABEL.fx[q])); return; }
    keep.push(p);
  });
  if (!keep.length) return { spec: tidy(s), changes };

  // Everything else reads as the book does: weather, hour, place, things, people, motion, acts.
  let text2 = keep.map((p) => {
    let q = p.replace(/^(?:add|with|put in|show|make it|make|there is|there are|it is|it's|set it|set)\s+/, "");
    for (const [re, to] of SUBJ_FIX) q = q.replace(re, to);
    if (IMPERATIVE.test(q)) q = (sp.who > 1 && /\b(dance|hug|kiss|embrace)\b/.test(q) ? "they " : "he ") + q;
    return q;
  }).join(". ") + ".";
  text2 = text2.replace(/\bcry\b/g, "weep");
  const e = evidence(text2);
  const firm = (m: Partial<Record<string, number>>, min = 0.5) => (Object.keys(m) as string[]).filter((k) => (m[k] || 0) >= min).sort((a, b) => (m[b] || 0) - (m[a] || 0))[0];
  const skyWord = Object.keys(SKY_NAMES).find((w) => new RegExp("\\b" + w + "\\b").test(text2));
  const sky = skyWord ? SKY_NAMES[skyWord] : (firm(e.sky) as Sky | undefined);
  if (sky && SKIES.includes(sky) && s.sky !== sky) { s.sky = sky; changes.push("Weather: " + sky); }
  const time = firm(e.time) as Spec["time"] | undefined;
  if (time && TIMES.includes(time) && s.time !== time) { s.time = time; changes.push("Hour: " + time); }
  const place = firm(e.place, 0.9) as Spec["place"] | undefined;
  if (place && PLACES.includes(place) && s.place !== place) { s.place = place; changes.push("Place: " + LABEL.place[place].replace(/^(a|an|the) /, "")); }
  const added = (Object.keys(e.props) as Prop[]).filter((q) => (e.props[q] || 0) >= 0.5 && !s.props.includes(q));
  added.forEach((q) => { if (s.props.length < MAX_PROPS) { s.props.push(q); changes.push("With " + LABEL.prop[q]); } });
  const fxAdd = (Object.keys(e.fx) as Fx[]).filter((q) => (e.fx[q] || 0) > 0 && FX.includes(q) && !s.fx?.includes(q));
  // Rain or snow named as weather is weather, not falling things.
  fxAdd.filter((q) => !(q === "fall" && (sky === "rain" || sky === "snow"))).forEach((q) => { if ((s.fx || []).length < 3) { s.fx = [...(s.fx || []), q]; changes.push("Moving: " + LABEL.fx[q]); } });
  const many = /\b(two|both|couple|pair)\b/.test(text2) ? 2 : /\b(crowd|people|everyone|many|several|a few|three)\b/.test(text2) ? 3 : /\b(alone|someone|a figure|one person|a man|a woman|a girl|a boy)\b/.test(text2) ? 1 : 0;
  if (many && many !== s.who) { s = withWho(s, many); changes.push("Figures: " + ["none", "one", "two", "a few"][many]); }

  // What happens. New acts replace the old, unless the direction says "then" after the old ones.
  if (e.acts.length) {
    const bound = bindActs(e.acts, s.props, Math.max(s.who, 0));
    if (bound.acts.length) {
      const extend = /^\s*(then|and then|after that|next)\b/.test(raw) && s.acts?.length;
      if (bound.who > s.who) s = withWho(s, bound.who);
      s.acts = extend ? [...(s.acts || []), ...bound.acts].slice(0, 6) : bound.acts;
      changes.push("Acting: " + describeActs(s));
    }
  }
  return { spec: tidy(s), changes };
}

function tidy(s: Spec): Spec {
  const o = { ...s };
  if (o.fx && !o.fx.length) delete o.fx;
  if (o.acts && !o.acts.length) delete o.acts;
  return o;
}
