// The act golden set: sentences annotated by hand with what a reader sees happen, in order, and
// how many of them the reading gets exactly right. Three groups: the tuned set (the rules were
// adjusted against it), a held-out set written at the same time and never tuned on (the honest
// score), and sentences where nothing should be acted (negations, wishes, idioms, states,
// metaphors), which must stay quiet. Expected acts are kinds in order; "-" is no act.
import { describe, expect, it } from "vitest";
import { readSpec } from "../src/compose/read";

const TUNED: [string, string][] = [
  ["The train pulled into the station in the snow.", "arrive"],
  ["The candle went out.", "die"],
  ["The sun rose over the sea.", "sunrise"],
  ["The rain stopped and the sun came out over the field.", "rain cloud"],
  ["Her heart sank when the door slammed shut.", "close"],
  ["A bird flew up from the fence as she walked along the road.", "depart cross"],
  ["He turned and ran from the dog.", "turn run"],
  ["She sat down on the bench and wept.", "sit weep"],
  ["She opened the door and stepped into the rain.", "open leave"],
  ["Mara lit a candle in the church.", "light"],
  ["He gave her the letter.", "give"],
  ["They embraced on the platform as the train left.", "hug depart"],
  ["Night fell over the village and the stars came out.", "nightfall stars"],
  ["She knelt by the grave.", "kneel"],
  ["He picked up the cup and drank.", "take drink"],
  ["The clock struck midnight.", "ring"],
  ["She waved from the boat.", "wave"],
  ["He jumped over the fence and ran off.", "jump run"],
  ["She fell in the street, then got up slowly.", "fall rise"],
  ["The fog lifted over the harbour.", "fog"],
  ["It began to rain.", "rain"],
  ["The wind died down in the night.", "wind"],
  ["Lightning flashed over the hills.", "flash"],
  ["The door opened slowly.", "open"],
  ["The gate swung open in the wind.", "open"],
  ["The car drove away down the road.", "depart"],
  ["The ship sailed out of the harbour.", "depart"],
  ["The boat drifted across the lake.", "pass"],
  ["The fire died in the hearth.", "die"],
  ["The cup fell from the table.", "fall"],
  ["The bell rang in the tower.", "ring"],
  ["She closed the window.", "close"],
  ["He knocked on the door.", "knock"],
  ["She read the letter by the window.", "read"],
  ["He put the book on the table.", "put"],
  ["She dropped the glass.", "drop"],
  ["He threw the letter into the fire.", "throw"],
  ["She raised her glass.", "raise"],
  ["He pointed at the tower.", "point"],
  ["She looked at the stars.", "look"],
  ["He nodded.", "nod"],
  ["She laughed.", "laugh"],
  ["He bowed to the queen.", "bow"],
  ["They danced in the hall.", "dance"],
  ["He kissed her on the bridge.", "kiss"],
  ["She walked into the room.", "leave"],
  ["He came in through the door.", "enter"],
  ["She left the house at dawn.", "leave"],
  ["The children ran across the field.", "cross"],
  ["She lay down on the bed.", "lie"],
  ["He stood up and walked to the window.", "rise go"],
  ["She blew out the candle.", "snuff"],
  ["The lights came on in the street.", "light"],
  ["The moon rose over the lake.", "moonrise"],
  ["Dawn broke over the fields.", "daybreak"],
  ["The clouds gathered over the sea.", "cloud"],
  ["It snowed all night.", "snow"],
  ["The sun set behind the hills.", "sunset"],
  ["He whispered to her in the dark.", "speak"],
  ["She turned away from the window.", "turn"],
];

/** Written with the tuned set and never used to adjust the rules: the honest score. */
const HELD_OUT: [string, string][] = [
  ["The bus pulled up at the corner.", "arrive"],
  ["She shut the gate behind her.", "close"],
  ["The lamp flickered and went out.", "die"],
  ["He sat down at the piano and played.", "sit work"],
  ["The birds flew off the roof.", "depart"],
  ["Tom handed the cup to his mother.", "give"],
  ["She hurried across the square.", "cross"],
  ["The horse galloped away.", "depart"],
  ["He lit the fire and sat down.", "light sit"],
  ["Snow began to fall over the town.", "snow"],
  ["She took the letter from the table.", "take"],
  ["The storm broke over the harbour.", "storm"],
  ["He stepped out into the night.", "leave"],
  ["They shook hands at the gate.", "greet"],
  ["The door creaked open.", "open"],
  ["She sighed and looked out of the window.", "speak look"],
  ["He knelt and prayed.", "kneel speak"],
  ["The train left the station at noon.", "depart"],
  ["She drank her tea by the fire.", "drink"],
  ["The stars came out one by one.", "stars"],
];

/** Nothing happens here that should be acted. */
const NONE: string[] = [
  "She did not open the door.", "He would open the window tomorrow.", "She fell in love with the sea.", "She sat on the bench.",
  "He stood by the window.", "If the train came, they would leave.", "She wanted to run.", "He never knocked.",
  "“Close the door,” she thought.", "He remembered how the train had left.", "She dreamed she was flying.",
  "His anger burned like fire.", "The room was quiet.", "The house stood on the hill.", "Her heart sank.",
  "He gave up.", "The meeting took place at noon.", "She could not walk any further.", "He didn’t look back.",
  "The road ran along the river.", "They might dance tomorrow.", "The lamp stood on the table.", "She lay in bed all morning.",
  "He hoped the rain would stop.", "The idea struck him.", "She ran out of time.", "The news broke his heart.",
  "The years passed.", "He held his breath.", "There was no door.",
];

const kinds = (t: string) => (readSpec(t).acts || []).map((a) => a.kind).join(" ") || "-";
function score(set: [string, string][]): { exact: number; n: number; miss: string[] } {
  const miss: string[] = [];
  let exact = 0;
  set.forEach(([t, want]) => { const got = kinds(t); if (got === want) exact++; else miss.push(t + "  want " + want + ", got " + got); });
  return { exact, n: set.length, miss };
}

describe("the act golden set", () => {
  const tuned = score(TUNED), held = score(HELD_OUT);
  const quiet = NONE.filter((t) => kinds(t) === "-").length;
  it("reports its scores", () => {
    console.log("acts golden: tuned " + tuned.exact + "/" + tuned.n + ", held out " + held.exact + "/" + held.n + ", quiet " + quiet + "/" + NONE.length);
    if (process.env.GOLD_VERBOSE) console.log([...tuned.miss, "-- held out --", ...held.miss, "-- should be quiet --", ...NONE.filter((t) => kinds(t) !== "-").map((t) => t + "  got " + kinds(t))].join("\n"));
  });
  it("gets at least 85 percent of the tuned set exactly", () => { expect(tuned.exact / tuned.n).toBeGreaterThanOrEqual(0.85); });
  it("gets at least 60 percent of the held-out set exactly", () => { expect(held.exact / held.n).toBeGreaterThanOrEqual(0.6); });
  it("acts nothing out in at least 90 percent of the quiet set", () => { expect(quiet / NONE.length).toBeGreaterThanOrEqual(0.9); });
});
