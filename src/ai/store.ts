// AI pictures are too big for localStorage, so they live in IndexedDB, keyed by a short id that the
// book's SceneRef carries (scene.img). If IndexedDB is unavailable (private windows, some file://
// pages) they are kept in memory for this session and still go into the exported book.
const DB = "nymphaea", STORE = "images";
const mem = new Map<string, string>();
let dbp: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return db().then((d) => new Promise<T | null>((res) => {
    if (!d) { res(null); return; }
    try { const q = fn(d.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch { res(null); }
  }));
}

export function newImageId(): string {
  return "i" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export async function putImage(id: string, data: string): Promise<void> {
  mem.set(id, data);
  await tx("readwrite", (s) => s.put(data, id));
}

export async function getImage(id: string): Promise<string | null> {
  if (mem.has(id)) return mem.get(id)!;
  const v = await tx<string>("readonly", (s) => s.get(id) as IDBRequest<string>);
  if (typeof v === "string") mem.set(id, v);
  return typeof v === "string" ? v : null;
}

export async function getImages(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of Array.from(new Set(ids))) { const v = await getImage(id); if (v) out[id] = v; }
  return out;
}

export async function deleteImage(id: string): Promise<void> {
  mem.delete(id);
  await tx("readwrite", (s) => s.delete(id));
}

/** Every stored painting id (memory and disk). */
export async function listImageIds(): Promise<string[]> {
  const r = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
  return Array.from(new Set([...Array.from(mem.keys()), ...((r || []) as string[]).filter((k) => typeof k === "string")]));
}

/** Delete every stored painting in `ids`. */
export async function deleteImages(ids: string[]): Promise<void> {
  for (const id of ids) await deleteImage(id);
}

/** Only real raster data URLs ever reach a page. */
export const isImageData = (v: unknown): v is string => typeof v === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 6_000_000;
