// Ask a text model for JSON. Two protocols cover nearly every model an author can reach from a
// static page: the OpenAI-compatible chat API (Ollama, LM Studio, llama.cpp, vLLM, LocalAI,
// OpenRouter…) and Claude through the Anthropic SDK with the author's own key.
import type AnthropicSdk from "@anthropic-ai/sdk";
import { AiError, base, type TextCfg } from "./config";

/**
 * The official Anthropic SDK, fetched (pinned) only when the author connects Claude. Bundling it
 * would add ~400 KB to the Studio and to every exported book, which embeds the same engine.
 */
const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.8.0/+esm";
let sdk: Promise<typeof AnthropicSdk> | null = null;
function loadSdk(): Promise<typeof AnthropicSdk> {
  if (!sdk) {
    sdk = (import(/* @vite-ignore */ SDK_URL) as Promise<{ default: typeof AnthropicSdk }>).then((m) => m.default).catch(() => {
      sdk = null;
      throw new AiError("network", "Couldn’t load the Anthropic SDK.");
    });
  }
  return sdk;
}

/** The first JSON object or array in a reply (models wrap it in prose or code fences). */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(t); } catch { /* look inside */ }
  const starts = [t.indexOf("{"), t.indexOf("[")].filter((i) => i >= 0);
  if (!starts.length) throw new AiError("bad_reply");
  const s = Math.min(...starts), close = t[s] === "{" ? "}" : "]";
  for (let e = t.lastIndexOf(close); e > s; e = t.lastIndexOf(close, e - 1)) {
    try { return JSON.parse(t.slice(s, e + 1)); } catch { /* shorter */ }
  }
  throw new AiError("bad_reply");
}

async function viaOpenAI(cfg: TextCfg, prompt: string, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(base(cfg.url) + "/chat/completions", {
      method: "POST", signal,
      headers: { "content-type": "application/json", ...(cfg.key ? { authorization: "Bearer " + cfg.key } : {}) },
      body: JSON.stringify({
        model: cfg.model, stream: false,
        messages: [{ role: "system", content: "You answer with one JSON object and nothing else." }, { role: "user", content: prompt }],
      }),
    });
  } catch (e) {
    if (e && (e as Error).name === "AbortError") throw new AiError("cancelled");
    throw new AiError("network");
  }
  if (res.status === 401 || res.status === 403) throw new AiError("auth");
  if (res.status === 429) throw new AiError("rate_limited");
  if (res.status >= 400 && res.status < 500) throw new AiError("bad_request", (await res.text().catch(() => "")).slice(0, 200));
  if (!res.ok) throw new AiError("server", "HTTP " + res.status);
  const j = await res.json().catch(() => null) as { choices?: { message?: { content?: string } }[] } | null;
  const out = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (typeof out !== "string") throw new AiError("bad_reply");
  return out;
}

async function viaAnthropic(cfg: TextCfg, prompt: string, signal?: AbortSignal): Promise<string> {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey: cfg.key, baseURL: base(cfg.url) || undefined, dangerouslyAllowBrowser: true, maxRetries: 2 });
  try {
    const stream = client.beta.messages.stream({
      model: cfg.model || "claude-opus-5-5",
      max_tokens: 32000,
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: prompt + "\n\nAnswer with the JSON object only." }],
    }, { signal });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new AiError("refused");
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (!text.trim()) throw new AiError("bad_reply");
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.APIUserAbortError) throw new AiError("cancelled");
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError("auth");
    if (e instanceof Anthropic.RateLimitError) throw new AiError("rate_limited");
    if (e instanceof Anthropic.NotFoundError || e instanceof Anthropic.BadRequestError) throw new AiError("bad_request", (e as Error).message.slice(0, 200));
    if (e instanceof Anthropic.APIConnectionError) throw new AiError("network");
    if (e instanceof Anthropic.APIError) throw new AiError("server", (e as Error).message.slice(0, 200));
    throw e;
  }
}

/** Send a prompt and read the JSON in the answer. */
export async function askJson(cfg: TextCfg, prompt: string, signal?: AbortSignal): Promise<unknown> {
  const text = cfg.kind === "anthropic" ? await viaAnthropic(cfg, prompt, signal) : await viaOpenAI(cfg, prompt, signal);
  return extractJson(text);
}

/** A tiny round trip, for the Test button. */
export async function testText(cfg: TextCfg, signal?: AbortSignal): Promise<void> {
  const r = await askJson(cfg, 'Reply with exactly this JSON: {"ok": true}', signal) as { ok?: unknown };
  if (!r || r.ok !== true) throw new AiError("bad_reply");
}
