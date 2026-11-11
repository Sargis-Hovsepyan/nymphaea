// The bookshelf's storage: every book the author has made, in IndexedDB (a small database of its
// own, so the paintings store is untouched). Same pattern as ai/store.ts: if IndexedDB is
// unavailable the books are kept in memory for this session, and put() says it wasn't saved to disk.
import type { Shelved } from "./shelfData";

const DB = "nymphaea-shelf", STORE = "books";
const mem = new Map<string, Shelved>();
let dbp: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: "id" }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<{ ok: boolean; v: T | null }> {
  return db().then((d) => new Promise((res) => {
    if (!d) { res({ ok: false, v: null }); return; }
    try {
      const t = d.transaction(STORE, mode), q = fn(t.objectStore(STORE));
      let v: T | null = null;
      q.onsuccess = () => { v = q.result; };
      t.oncomplete = () => res({ ok: true, v });
      t.onerror = t.onabort = () => res({ ok: false, v: null });
    } catch { res({ ok: false, v: null }); }
  }));
}

/** Every shelved book, newest first. `ok` is false when the disk could not be read (do not clean up then). */
export async function listBooks(): Promise<{ books: Shelved[]; ok: boolean }> {
  const r = await run<Shelved[]>("readonly", (s) => s.getAll() as IDBRequest<Shelved[]>);
  const out = new Map<string, Shelved>(mem);
  (r.v || []).forEach((b) => { if (b && typeof b.id === "string" && b.draft) { const m = out.get(b.id); if (!m || m.updated <= b.updated) out.set(b.id, b); } });
  return { books: Array.from(out.values()).sort((a, b) => b.updated - a.updated), ok: r.ok };
}

/** Save a book. Resolves true when it reached the disk, false when only memory has it. */
export async function putBook(b: Shelved): Promise<boolean> {
  mem.set(b.id, b);
  const r = await run("readwrite", (s) => s.put(b));
  if (r.ok) mem.delete(b.id);
  return r.ok;
}

export async function deleteBook(id: string): Promise<void> {
  mem.delete(id);
  await run("readwrite", (s) => s.delete(id));
}
