// The Pictures tab's buttons and notes that depend on which models are connected.
import type { AiConfig } from "../ai/config";
import { state } from "../state";
import { aiConfig, imageReady, textReady } from "./ai";
import { $, book, hasText, jobs, sess } from "./session";

export function syncAi(): void {
  const c: AiConfig = aiConfig(), t = textReady(c), im = imageReady(c), ok = hasText();
  const ask = $<HTMLButtonElement>("mkAsk");
  ask.hidden = !(t || sess.sample);
  ask.textContent = t ? "Stage with AI" : "Let Claude stage it";
  ask.disabled = !ok || !!jobs.staging;
  $("mkPaintAll").hidden = !im;
  $<HTMLButtonElement>("mkPaintAll").disabled = !ok || !!jobs.paintAll || !book().scenes.length;
  const st = $("mkAiState");
  st.textContent = "";
  const b = document.createElement("b");
  if (!t && !im) { b.textContent = "Drawn by rules. "; st.append(b, "Connect a local or hosted model to stage or paint the pictures."); }
  else {
    b.textContent = [t ? "Staging: " + (c.text.model || c.text.kind) : "", im ? "Painting: " + (c.image.model || "Stable Diffusion") : ""].filter(Boolean).join(" · ");
    st.append(b);
  }
  const art = state.settings.art;
  $("mkArtNote").textContent = art === "library" ? "Only the drawn scenes (lamp, sea, city, train…), matched to keywords."
    : art === "composed" ? "Every picture is composed from its passage: the place, hour, sky, things and people it names."
    : "A drawn scene where the text names one clearly, otherwise a scene composed from the passage.";
}
