// ZIP without a library. Writing: stored entries with CRC-32 (EPUB needs "mimetype" first and
// uncompressed). Reading: stored and deflated entries, inflated with the platform's own
// DecompressionStream("deflate-raw"). Used by import/docx.ts, import/epub.ts and epub/book.ts.

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

export function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
export const utf8 = (s: string): Uint8Array => enc.encode(s);

export function zipStore(files: { name: string; data: Uint8Array | string }[]): Uint8Array {
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let off = 0;
  files.forEach((f) => {
    const name = utf8(f.name), data = typeof f.data === "string" ? utf8(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  });
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; all.forEach((a) => { out.set(a, p); p += a.length; });
  return out;
}

async function inflate(d: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([d as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** All entries of a ZIP (read from the central directory, so data descriptors don't matter). */
export async function unzip(buf: ArrayBuffer | Uint8Array): Promise<Map<string, Uint8Array>> {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip");
  const n = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder(), out = new Map<string, Uint8Array>();
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("zip");
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
    const lnl = v.getUint16(lo + 26, true), lxl = v.getUint16(lo + 28, true), start = lo + 30 + lnl + lxl;
    const raw = b.subarray(start, start + csize);
    if (!name.endsWith("/")) out.set(name, method === 0 ? raw.slice() : method === 8 ? await inflate(raw) : new Uint8Array());
    p += 46 + nl + xl + cl;
  }
  return out;
}

export function text(d: Uint8Array | undefined): string {
  return d ? new TextDecoder().decode(d).replace(/^﻿/, "") : "";
}
