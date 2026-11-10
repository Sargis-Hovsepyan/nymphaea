import { KEYS, LEGACY_KEYS } from "./brand";

export function store(k: string, v: unknown): void {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode / blocked storage */ }
}

export function load<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

/** One-time copy of v0 ("lp-*") data to the new keys. The old keys are left untouched. */
export function migrateLegacy(): void {
  try {
    (Object.keys(KEYS) as (keyof typeof KEYS)[]).forEach((k) => {
      if (localStorage.getItem(KEYS[k]) == null) {
        const old = localStorage.getItem(LEGACY_KEYS[k]);
        if (old != null) localStorage.setItem(KEYS[k], old);
      }
    });
  } catch { /* storage unavailable */ }
}
