// Ask an image model for a picture, then fit it to the book's 8:5 frame and keep it small enough to
// live inside a single-file book. Two protocols: Stable Diffusion WebUI / Forge (/sdapi/v1/txt2img,
// the usual local setup) and the OpenAI-compatible /v1/images/generations.
import { AiError, base, type ImageCfg } from "./config";

async function call(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try { res = await fetch(url, init); } catch (e) {
    if (e && (e as Error).name === "AbortError") throw new AiError("cancelled");
    throw new AiError("network");
  }
  if (res.status === 401 || res.status === 403) throw new AiError("auth");
  if (res.status === 429) throw new AiError("rate_limited");
  if (res.status >= 400 && res.status < 500) throw new AiError("bad_request", (await res.text().catch(() => "")).slice(0, 200));
  if (!res.ok) throw new AiError("server", "HTTP " + res.status);
  return res;
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new AiError("bad_reply")); r.readAsDataURL(b); });
}

/** Crop to 8:5 around the centre and re-encode as a JPEG of at most 960×600. */
export function fitImage(src: string, w = 960, h = 600): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d")!;
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      try { res(c.toDataURL("image/jpeg", 0.86)); } catch { rej(new AiError("bad_reply")); }
    };
    img.onerror = () => rej(new AiError("bad_reply"));
    img.src = src;
  });
}

export async function makeImage(cfg: ImageCfg, prompt: string, negative: string, signal?: AbortSignal): Promise<string> {
  const auth: Record<string, string> = cfg.key ? { authorization: "Bearer " + cfg.key } : {};
  let raw: string;
  if (cfg.kind === "a1111") {
    const r = await call(base(cfg.url) + "/sdapi/v1/txt2img", {
      method: "POST", signal, headers: { "content-type": "application/json", ...auth },
      body: JSON.stringify({ prompt, negative_prompt: [negative, cfg.negative].filter(Boolean).join(", "), steps: cfg.steps, width: 768, height: 480, cfg_scale: 6, batch_size: 1, n_iter: 1 }),
    });
    const j = await r.json().catch(() => null) as { images?: string[] } | null;
    const b64 = j && j.images && j.images[0];
    if (!b64) throw new AiError("bad_reply");
    raw = b64.startsWith("data:") ? b64 : "data:image/png;base64," + b64;
  } else {
    const r = await call(base(cfg.url) + "/images/generations", {
      method: "POST", signal, headers: { "content-type": "application/json", ...auth },
      body: JSON.stringify({ model: cfg.model, prompt: prompt + (negative ? ". Avoid: " + negative : ""), n: 1, size: "1536x1024" }),
    });
    const j = await r.json().catch(() => null) as { data?: { b64_json?: string; url?: string }[] } | null;
    const d = j && j.data && j.data[0];
    if (d && d.b64_json) raw = "data:image/png;base64," + d.b64_json;
    else if (d && d.url) raw = await blobToDataUrl(await (await call(d.url, { signal })).blob());
    else throw new AiError("bad_reply");
  }
  return fitImage(raw);
}

/** Is the image server there? (A cheap request, no picture made.) */
export async function testImage(cfg: ImageCfg, signal?: AbortSignal): Promise<void> {
  const auth: Record<string, string> = cfg.key ? { authorization: "Bearer " + cfg.key } : {};
  await call(base(cfg.url) + (cfg.kind === "a1111" ? "/sdapi/v1/sd-models" : "/models"), { signal, headers: auth });
}
