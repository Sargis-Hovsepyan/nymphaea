// The "AI models" sheet: pick a text model (staging) and an image model (painting), test them, and
// read how to run a free one locally. Everything is optional; with nothing connected the pictures
// are composed by rules. Settings are saved in this browser only (ai/config.ts).
import { DEFAULT_AI, IMAGE_PRESETS, TEXT_PRESETS, explain, imageReady, loadAi, saveAi, textReady, type AiConfig, type ImageKind, type Preset, type TextKind } from "../ai/config";
import { testImage } from "../ai/image";
import { testText } from "../ai/text";
import { closeOnBackdrop } from "./ui";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let cfg: AiConfig = loadAi();
let changed: (c: AiConfig) => void = () => {};

export function aiConfig(): AiConfig { return cfg; }

function origin(): string {
  return /^https?:/.test(location.origin) ? location.origin : "*";
}

function presetOf<K>(list: Preset<K>[], kind: K, url: string): Preset<K> | null {
  return list.find((p) => p.kind === kind && p.url && url.startsWith(p.url)) || list.find((p) => p.kind === kind && !p.url) || list.find((p) => p.kind === kind) || null;
}

function presets<K extends string>(box: HTMLElement, list: Preset<K>[], current: () => { kind: K; url: string }, pick: (p: Preset<K> | null) => void): void {
  box.textContent = "";
  const off = document.createElement("button"); off.type = "button"; off.textContent = "Off"; off.dataset.id = "off";
  off.addEventListener("click", () => pick(null));
  box.appendChild(off);
  list.forEach((p) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = p.label; b.dataset.id = p.id;
    b.addEventListener("click", () => pick(p));
    box.appendChild(b);
  });
  const mark = () => {
    const c = current(), on = c.kind === ("off" as K) ? "off" : (presetOf(list, c.kind, c.url) || { id: "" }).id;
    box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === on)));
  };
  mark();
  box.addEventListener("click", mark);
}

function fill(): void {
  const t = cfg.text, i = cfg.image;
  $<HTMLInputElement>("aiTextUrl").value = t.url; $<HTMLInputElement>("aiTextModel").value = t.model; $<HTMLInputElement>("aiTextKey").value = t.key;
  $<HTMLInputElement>("aiImgUrl").value = i.url; $<HTMLInputElement>("aiImgModel").value = i.model; $<HTMLInputElement>("aiImgKey").value = i.key;
  $<HTMLInputElement>("aiImgSteps").value = String(i.steps); $<HTMLInputElement>("aiImgText").checked = i.withText;
  const tp = presetOf(TEXT_PRESETS, t.kind, t.url), ip = presetOf(IMAGE_PRESETS, i.kind, i.url);
  $("aiTextNote").textContent = t.kind === "off" ? "Off. Pictures are placed by rules (TextTiling and keyword salience)." : tp ? tp.note : "";
  $("aiImgNote").textContent = i.kind === "off" ? "Off. Pictures are drawn as vector scenes composed from the text." : ip ? ip.note : "";
  ["aiTextUrl", "aiTextModel", "aiTextKey", "aiTextTest"].forEach((id) => { ($(id) as HTMLInputElement).disabled = t.kind === "off"; });
  ["aiImgUrl", "aiImgModel", "aiImgKey", "aiImgSteps", "aiImgText", "aiImgTest"].forEach((id) => { ($(id) as HTMLInputElement).disabled = i.kind === "off"; });
  $<HTMLInputElement>("aiImgModel").placeholder = i.kind === "a1111" ? "Uses the model loaded in the WebUI" : "gpt-image-1";
  $<HTMLInputElement>("aiTextKey").placeholder = t.kind === "anthropic" ? "sk-ant-…" : "Not needed for a local model";
}

function save(): void { saveAi(cfg); changed(cfg); }

function help(): void {
  const o = origin(), box = $("aiHelp");
  const blocks: [string, string, string][] = [
    ["Text: Ollama", "Install from ollama.com, then in a terminal:", "ollama pull llama3.2\nOLLAMA_ORIGINS=" + o + " ollama serve"],
    ["Text: LM Studio", "Download a model, open the Developer tab, start the server and switch on “Enable CORS”. The address is:", "http://localhost:1234/v1"],
    ["Pictures: Stable Diffusion WebUI or Forge", "Start it with the API on and this page allowed:", "./webui.sh --api --cors-allow-origins=" + o],
    ["Why the address matters", "Browsers only let a page talk to a local server that says yes to that page. The commands above give that permission to " + (o === "*" ? "this file" : o) + " only. Chrome may also ask once whether this site can reach devices on your local network.", ""],
  ];
  box.textContent = "";
  blocks.forEach(([h, p, code]) => {
    const hh = document.createElement("h4"); hh.textContent = h;
    const pp = document.createElement("p"); pp.textContent = p;
    box.append(hh, pp);
    if (code) { const pre = document.createElement("pre"); pre.textContent = code; box.appendChild(pre); }
  });
}

async function runTest(btn: string, res: string, fn: (s: AbortSignal) => Promise<void>, what: string): Promise<void> {
  const r = $(res), b = $<HTMLButtonElement>(btn), ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 60000);
  b.disabled = true; r.className = "note"; r.textContent = "Testing…";
  try { await fn(ctl.signal); r.className = "note res-ok"; r.textContent = "Connected. " + what[0].toUpperCase() + what.slice(1) + " works."; }
  catch (e) { r.className = "note res-bad"; r.textContent = explain(e, what); }
  finally { clearTimeout(timer); b.disabled = false; }
}

export function openAi(): void { const d = $<HTMLDialogElement>("mkAi"); fill(); help(); if (!d.open) d.showModal(); }

export function initAiPanel(onChange: (c: AiConfig) => void): void {
  changed = onChange;
  const d = $<HTMLDialogElement>("mkAi");
  $("mkAiClose").addEventListener("click", () => d.close());
  closeOnBackdrop(d);
  presets($("aiTextPre"), TEXT_PRESETS, () => cfg.text, (p) => {
    cfg.text = p ? { kind: p.kind as TextKind, url: p.url, model: p.model, key: cfg.text.kind === p.kind ? cfg.text.key : "" } : { ...DEFAULT_AI.text };
    $("aiTextRes").textContent = ""; fill(); save();
  });
  presets($("aiImgPre"), IMAGE_PRESETS, () => cfg.image, (p) => {
    cfg.image = p ? { ...cfg.image, kind: p.kind as ImageKind, url: p.url, model: p.model, key: cfg.image.kind === p.kind ? cfg.image.key : "" } : { ...DEFAULT_AI.image, withText: cfg.image.withText };
    $("aiImgRes").textContent = ""; fill(); save();
  });
  const bind = (id: string, set: (v: string) => void) => $(id).addEventListener("input", (e) => { set((e.target as HTMLInputElement).value.trim()); save(); });
  bind("aiTextUrl", (v) => { cfg.text.url = v; });
  bind("aiTextModel", (v) => { cfg.text.model = v; });
  bind("aiTextKey", (v) => { cfg.text.key = v; });
  bind("aiImgUrl", (v) => { cfg.image.url = v; });
  bind("aiImgModel", (v) => { cfg.image.model = v; });
  bind("aiImgKey", (v) => { cfg.image.key = v; });
  bind("aiImgSteps", (v) => { const n = Math.round(+v); if (n >= 1 && n <= 150) cfg.image.steps = n; });
  $("aiImgText").addEventListener("change", (e) => { cfg.image.withText = (e.target as HTMLInputElement).checked; save(); });
  $("aiTextTest").addEventListener("click", () => runTest("aiTextTest", "aiTextRes", (s) => testText(cfg.text, s), "the text model"));
  $("aiImgTest").addEventListener("click", () => runTest("aiImgTest", "aiImgRes", (s) => testImage(cfg.image, s), "the image server"));
}

export { imageReady, textReady };
