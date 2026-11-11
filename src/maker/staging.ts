// Staging with an AI: send the text to a model (yours, or Claude when running as an artifact) and
// take back a plan, which the Guard checks like any other. While it reads, a progress strip shows
// the seconds so far (a model gives no way to know how far along it is).
import { explain } from "../ai/config";
import { askJson } from "../ai/text";
import { decode } from "../compose/spec";
import { buildStagingPrompt, readStagingReply } from "../stage/claude";
import { sameBlocks } from "../stage/guard";
import { state } from "../state";
import { aiConfig, textReady } from "./ai";
import { progress } from "./paint";
import { $, book, hooks, jobs, plural, sceneNote, sess, syncStop } from "./session";
import { checkpoint, UNDO } from "./undo";
import { syncAi } from "./aiState";
import { toast } from "./ui";

export async function stageWithAi(): Promise<void> {
  const c = aiConfig(), useApi = textReady(c);
  if (!useApi && !sess.sample) return;
  const B = book(), { prompt, cut } = buildStagingPrompt(B, state.settings.density);
  const who = useApi ? "the text model" : "Claude", Who = who[0].toUpperCase() + who.slice(1);
  const ctl = jobs.staging = new AbortController();
  $<HTMLButtonElement>("mkAsk").disabled = true; syncStop();
  const prog = progress(Who + " is reading your text");
  try {
    const reply = useApi ? await askJson(c.text, prompt, ctl.signal) : await sess.sample.json(prompt, { signal: ctl.signal });
    // The author may have kept writing while the model read: its paragraph numbers are for that text.
    const cur = book();
    if (!sameBlocks(cur.blocks, B.blocks)) { sceneNote("The text changed while " + who + " was reading it, so its plan was set aside. Run it again to stage the new text.", true); return; }
    const r = readStagingReply(cur, reply);
    if (!r.scenes.length) { sceneNote(Who + "’s answer had no usable scenes. Try again, or place them automatically.", true); return; }
    checkpoint();
    cur.scenes = r.scenes; cur.source = "claude"; cur.beats = r.beats;
    if (r.cover) cur.cover = r.cover;
    const fixed = r.recaptioned ? " " + plural(r.recaptioned, "caption") + (r.recaptioned === 1 ? " wasn’t" : " weren’t") + " an exact quote, so the words were taken from the paragraph instead." : "";
    const comp = r.scenes.filter((s) => decode(s.scene)).length;
    $("mkSceneNote").classList.remove("warn");
    hooks.refresh();
    toast("Staged " + plural(r.scenes.length, "picture") + (comp ? ", " + comp + " composed" : "") + (cut ? " (it read the first part of a very long text)" : "") + "." + fixed, false, UNDO);
  } catch (e: any) {
    const code = e && e.code;
    if (code === "cancelled" || (e && e.name === "AbortError")) toast("Stopped.");
    else if (!useApi && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(code)) { sess.sample = null; sceneNote("Claude isn’t available here. Automatic placement still works, or connect a model under AI models."); }
    else if (!useApi && code === "rate_limited") sceneNote("Too many requests right now. Try again in a little while.", true);
    else if (!useApi && code === "prompt_too_large") sceneNote("This text is too long for one pass. Try a single chapter.", true);
    else if (useApi) sceneNote(explain(e, who), true);
    else sceneNote("That didn’t work. Try again, or place the pictures automatically.", true);
  } finally {
    prog.end();
    jobs.staging = null;
    syncStop();
    syncAi();
  }
}
