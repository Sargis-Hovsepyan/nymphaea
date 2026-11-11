// Renderers turn the greyscale scene canvas into the final look, using the room's token colours.
import { BAY, H, W, lg } from "../scenes/helpers";
import type { Style } from "../types";
import type { VecHandle } from "./vector";

export interface ArtItem {
  scene: string;
  t: number;
  vis: boolean;
  seed: number;
  style: Style;
  /** Drawn as t = 1 - progress (the end lotus closes as you reach it). */
  invert?: boolean;
  /** Canvas styles: the greyscale source the renderer reads. */
  srcCv?: HTMLCanvasElement;
  src?: CanvasRenderingContext2D;
  /** Vector styles: the live SVG. */
  vec?: VecHandle;
  cv?: HTMLCanvasElement;
  out?: CanvasRenderingContext2D;
  pre?: HTMLPreElement;
  pw?: number;
  node: HTMLElement;
  /** An AI picture, drawn through the style (canvas styles) or shown with a CSS treatment (vector). */
  photo?: HTMLImageElement;
  /** Generative style: a seed from the text and its mood. */
  gen?: { h: number; v: number; a: number };
}

type RGB = [number, number, number];
export const tok: { hi: RGB; lo: RGB; accent: string; acc: RGB; acc2: RGB; light: boolean } = { hi: [239, 230, 207], lo: [11, 11, 13], accent: "#e8a93a", acc: [232, 169, 58], acc2: [127, 156, 201], light: false };

function rgbOf(col: string): RGB {
  const t = document.createElement("canvas"); t.width = t.height = 1;
  const x = t.getContext("2d")!; x.fillStyle = col; x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
}

export function readTokens(isLightRoom: boolean): void {
  const cs = getComputedStyle(document.documentElement);
  tok.hi = rgbOf(cs.getPropertyValue("--hi").trim() || "#efe6cf");
  tok.lo = rgbOf(cs.getPropertyValue("--lo").trim() || "#0b0b0d");
  tok.accent = cs.getPropertyValue("--accent").trim() || "#e8a93a";
  tok.acc = rgbOf(tok.accent);
  tok.acc2 = rgbOf(cs.getPropertyValue("--accent2").trim() || "#7f9cc9");
  tok.light = isLightRoom;
}

const RAMP = " .'`^,:;-~+=*xo#%@";

export const R = {
  dither(it: ArtItem, img: ImageData): void {
    const d = img.data, hi = tok.hi, lo = tok.lo;
    for (let y = 0; y < H; y++) {
      const row = BAY[y & 7];
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, k = l > (row[x & 7] + 0.5) / 64 ? hi : lo;
        d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255;
      }
    }
    it.out!.putImageData(img, 0, 0);
  },
  halftone(it: ArtItem, img: ImageData): void {
    const d = img.data, o = it.out!, C = 3, sc = 3, r0 = C * sc / 2;
    o.fillStyle = "rgb(" + tok.hi.join(",") + ")"; o.fillRect(0, 0, W * sc, H * sc);
    o.fillStyle = "rgb(" + tok.lo.join(",") + ")";
    for (let cy = 0; cy < H; cy += C) {
      const off = (cy / C) % 2 ? C / 2 : 0;
      for (let cx = 0; cx < W; cx += C) {
        const sx = Math.min(W - 1, (cx + off) | 0), i = (cy * W + sx) * 4, l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, r = r0 * 1.18 * Math.sqrt(1 - l);
        if (r > 0.35) { o.beginPath(); o.arc((cx + off + C / 2) * sc, (cy + C / 2) * sc, r, 0, 7); o.fill(); }
      }
    }
  },
  ascii(it: ArtItem, img: ImageData): void {
    const d = img.data, cols = 64, rows = 24, cw = W / cols, ch = H / rows, out: string[] = [], n = RAMP.length - 1, pre = it.pre!;
    const pw = pre.clientWidth;
    if (pw && pw !== it.pw) { it.pw = pw; pre.style.fontSize = (pw / (cols * 0.6)).toFixed(2) + "px"; }
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < cols; c++) {
        const x = Math.floor(c * cw + cw / 2), y = Math.floor(r * ch + ch / 2), i = (y * W + x) * 4;
        let l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        if (tok.light) l = 1 - l;
        line += RAMP[Math.max(0, Math.min(n, Math.round(l * n)))];
      }
      out.push(line);
    }
    pre.textContent = out.join("\n");
  },
  glass(it: ArtItem): void {
    const o = it.out!, sc = 3, OW = W * sc, OH = H * sc, SW = 21, n = Math.ceil(OW / SW);
    o.save(); o.imageSmoothingEnabled = true;
    try { o.filter = "blur(1.5px)"; } catch { /* unsupported */ }
    for (let i = 0; i < n; i++) {
      const x = i * SW, cx = (x + SW / 2) / sc, w = SW / sc;
      o.drawImage(it.srcCv!,Math.max(0, cx - w * 1.1), 0, Math.min(W, w * 2.2), H, x, -4 + Math.sin(i * 0.9) * 3, SW, OH + 8);
    }
    o.filter = "none";
    for (let i = 0; i < n; i++) {
      const x = i * SW;
      o.fillStyle = lg(o, x, 0, x + SW, 0, [[0, "rgba(255,255,255,.22)"], [0.18, "rgba(255,255,255,0)"], [0.75, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.4)"]]);
      o.fillRect(x, 0, SW, OH);
    }
    o.globalCompositeOperation = "color"; o.globalAlpha = 0.6; o.fillStyle = tok.accent; o.fillRect(0, 0, OW, OH);
    o.globalCompositeOperation = "soft-light"; o.globalAlpha = 0.35; o.fillRect(0, 0, OW, OH);
    o.globalCompositeOperation = "screen"; o.globalAlpha = 0.12; o.fillStyle = "#fff"; o.fillRect(0, 0, OW, OH);
    o.restore();
  },
};
