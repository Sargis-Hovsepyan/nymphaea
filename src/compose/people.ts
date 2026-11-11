// Nouns that name people: who a passage is about when it gives no name. "The nurse hurried", "the
// soldiers marched", "a bride walked down the aisle" each put someone in the picture. Plurals are
// read from the singular ("nurses", "firemen"), so one list covers both. Shared by the setting
// reading (compose/read.ts, how many people) and the clause reader (compose/clauses.ts, who acts). Pure.

const WORDS = {
  f: `woman girl mother daughter wife queen lady lass maid widow nun sister aunt grandmother grandma granny waitress bride princess
    duchess empress actress hostess landlady stewardess niece mum mom mama mummy girlfriend fiancee policewoman headmistress mistress
    witch goddess heroine schoolgirl housewife nanny`,
  m: `man boy father son husband king gentleman lad monk brother uncle grandfather grandpa waiter groom bridegroom prince duke emperor
    lord earl sultan emir sheikh nephew dad daddy papa boyfriend fiance policeman fireman fisherman postman milkman horseman workman
    widower butler schoolboy headmaster master sir priest vicar imam rabbi bishop pope hero wizard`,
  n: `child stranger friend baby doctor sailor soldier farmer driver nurse teacher guard officer captain servant traveller traveler
    visitor guest neighbour neighbor figure poet painter musician fiddler shepherd hunter rider dancer singer beggar thief detective
    inspector constable clerk boatman ferryman astronaut pilot passenger tourist pilgrim merchant trader vendor seller buyer customer
    shopkeeper baker butcher cook chef barman bartender cashier worker labourer laborer builder mason carpenter blacksmith smith miner
    gardener herder herdsman courier messenger lamplighter sweeper cleaner janitor professor student pupil scholar scientist engineer
    lawyer judge banker boss manager secretary colleague journalist reporter photographer artist sculptor writer author novelist pianist
    violinist guitarist drummer actor player athlete boxer wrestler striker goalkeeper referee coach champion runner jogger walker hiker
    climber skier skater swimmer surfer diver angler rower cyclist spectator orphan robber burglar murderer killer assassin spy agent
    sentry warrior knight archer general sergeant lieutenant colonel commander admiral teenager youth kid toddler infant twin grandson
    granddaughter cousin lover partner host bedouin nomad cowboy sheriff outlaw pirate firefighter cop prisoner inmate refugee migrant
    tenant landlord nanny surgeon patient vet dentist preacher minister mayor president giant dwarf elf fairy ghost angel robot fugitive
    survivor rescuer volunteer mourner worshipper villager peasant porter doorman receptionist waiter mechanic plumber
    electrician tailor potter weaver hermit monarch ruler chief elder healer midwife ranger guide sage scout comrade companion enemy
    intruder invader rebel leader follower`,
};

/** Nouns for a group, whatever their number. */
const GROUPS = new Set(`people crowd children friends family couple lovers pair everyone everybody both audience band team crew class
  congregation choir army troops police staff villagers guests strangers mourners folk men women gang orchestra parade procession
  caravan`.split(/\s+/).filter(Boolean));

const G: Record<string, "f" | "m" | "?"> = {};
(["f", "m", "n"] as const).forEach((k) => WORDS[k].split(/\s+/).filter(Boolean).forEach((w) => { if (!G[w]) G[w] = k === "n" ? "?" : k; }));

/** The singular a plural person noun comes from ("firemen", "nurses", "thieves", "children"). */
function singular(w: string): string | null {
  if (w === "children") return "child";
  if (w === "people" || w === "folk") return null;
  if (w.endsWith("men") && G[w.slice(0, -3) + "man"]) return w.slice(0, -3) + "man";
  if (w.endsWith("women") && G[w.slice(0, -5) + "woman"]) return w.slice(0, -5) + "woman";
  if (w.endsWith("ves") && G[w.slice(0, -3) + "f"]) return w.slice(0, -3) + "f";
  if (w.endsWith("ies") && G[w.slice(0, -3) + "y"]) return w.slice(0, -3) + "y";
  if (w.endsWith("es") && G[w.slice(0, -2)]) return w.slice(0, -2);
  if (w.endsWith("s") && G[w.slice(0, -1)]) return w.slice(0, -1);
  return null;
}

/** One person: their gender if the noun says ("f", "m"), "?" if not; null if the word names nobody. */
export function personOf(w: string): "f" | "m" | "?" | null {
  return G[w] ?? null;
}

/** A group of people: a plural person noun or a group noun. */
export function isGroup(w: string): boolean {
  return GROUPS.has(w) || singular(w) != null;
}

/** Any person noun, one or many. */
export const isPersonNoun = (w: string): boolean => personOf(w) != null || isGroup(w);
