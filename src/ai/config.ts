// Optional AI, brought by the author: a text model to stage the pictures and an image model to paint
// them. Nymphaea is a static page (it runs from GitHub Pages or a double-clicked file), so the
// browser talks to the model directly: a model on this computer (Ollama, LM Studio, Stable
// Diffusion WebUI / Forge) or a hosted API with the author's own key.
//
// The settings live in this browser only. They are never written into an exported book.
import { load, store } from "../store";

export type TextKind = "off" | "openai" | "anthropic";
export type ImageKind = "off" | "a1111" | "openai";

export interface TextCfg { kind: TextKind; url: string; model: string; key: string }
export interface ImageCfg { kind: ImageKind; url: string; model: string; key: string; steps: number; negative: string; withText: boolean }
export interface AiConfig { text: TextCfg; image: ImageCfg }

export const AI_KEY = "nymphaea-ai";

export interface Preset<K> { id: string; kind: K; label: string; url: string; model: string; needsKey: boolean; note: string }

export const TEXT_PRESETS: Preset<TextKind>[] = [
  { id: "ollama", kind: "openai", label: "Ollama", url: "http://localhost:11434/v1", model: "llama3.2", needsKey: false,
    note: "Free and local. Install Ollama, run ollama pull llama3.2, then start it with OLLAMA_ORIGINS set to this page's address." },
  { id: "lmstudio", kind: "openai", label: "LM Studio", url: "http://localhost:1234/v1", model: "", needsKey: false,
    note: "Free and local. Load a model, open the Developer tab, start the server and turn on CORS." },
  { id: "compat", kind: "openai", label: "Other OpenAI-compatible server", url: "", model: "", needsKey: false,
    note: "llama.cpp server, vLLM, LocalAI, OpenRouter and most hosted APIs speak this protocol." },
  { id: "anthropic", kind: "anthropic", label: "Claude (your Anthropic API key)", url: "https://api.anthropic.com", model: "claude-opus-5-5", needsKey: true,
    note: "Uses your own key from platform.claude.com. The key stays in this browser." },
];

export const IMAGE_PRESETS: Preset<ImageKind>[] = [
  { id: "a1111", kind: "a1111", label: "Stable Diffusion WebUI or Forge", url: "http://127.0.0.1:7860", model: "", needsKey: false,
    note: "Free and local. Start it with --api --cors-allow-origins followed by this page's address." },
  { id: "openai-img", kind: "openai", label: "OpenAI-compatible image API", url: "https://api.openai.com/v1", model: "gpt-image-1", needsKey: true,
    note: "Any server with /v1/images/generations (OpenAI, LocalAI and others). Uses your own key." },
];

export const DEFAULT_AI: AiConfig = {
  text: { kind: "off", url: "", model: "", key: "" },
  image: { kind: "off", url: "", model: "", key: "", steps: 24, negative: "", withText: true },
};

const KINDS_T: TextKind[] = ["off", "openai", "anthropic"], KINDS_I: ImageKind[] = ["off", "a1111", "openai"];
const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");

/** Saved settings, with anything malformed replaced by the defaults. */
export function loadAi(): AiConfig {
  const raw = load<Partial<AiConfig>>(AI_KEY) || {};
  const t = (raw.text || {}) as Partial<TextCfg>, i = (raw.image || {}) as Partial<ImageCfg>;
  return {
    text: { kind: KINDS_T.includes(t.kind as TextKind) ? (t.kind as TextKind) : "off", url: str(t.url), model: str(t.model, 120), key: str(t.key, 300) },
    image: {
      kind: KINDS_I.includes(i.kind as ImageKind) ? (i.kind as ImageKind) : "off", url: str(i.url), model: str(i.model, 120), key: str(i.key, 300),
      steps: typeof i.steps === "number" && i.steps >= 1 && i.steps <= 150 ? Math.round(i.steps) : 24,
      negative: str(i.negative, 600), withText: i.withText !== false,
    },
  };
}

export function saveAi(c: AiConfig): void { store(AI_KEY, c); }

export const textReady = (c: AiConfig): boolean => c.text.kind !== "off" && !!c.text.url && !!c.text.model && (c.text.kind !== "anthropic" || !!c.text.key);
export const imageReady = (c: AiConfig): boolean => c.image.kind !== "off" && !!c.image.url && (c.image.kind !== "openai" || !!c.image.model);

/** Strip a trailing slash so "…/v1/" and "…/v1" both work. */
export const base = (u: string): string => u.trim().replace(/\/+$/, "");

/** An error with a short code the Studio turns into plain words. */
export class AiError extends Error {
  constructor(public code: "network" | "auth" | "rate_limited" | "refused" | "bad_reply" | "bad_request" | "cancelled" | "server", message: string = code) { super(message); }
}

/** Plain words for a failure. `where` is written lower-case ("the text model"). */
export function explain(e: unknown, where: string): string {
  const Where = where[0].toUpperCase() + where.slice(1);
  const c = e instanceof AiError ? e.code : e && (e as { name?: string }).name === "AbortError" ? "cancelled" : "server";
  const origin = typeof location !== "undefined" && /^https?:/.test(location.origin) ? location.origin : "this page";
  switch (c) {
    case "network": return "Couldn’t reach " + where + ". Check that it is running and allows requests from " + origin + " (CORS).";
    case "auth": return Where + " refused the key. Check the API key.";
    case "rate_limited": return Where + " is busy (rate limited). Try again in a little while.";
    case "refused": return Where + " declined this request.";
    case "bad_reply": return Where + " answered, but not with something Nymphaea can use. A larger model may do better.";
    case "bad_request": return Where + " rejected the request. Check the model name. " + ((e as Error).message || "");
    case "cancelled": return "Stopped.";
    default: return "Something went wrong with " + where + ". " + ((e as Error)?.message || "");
  }
}
