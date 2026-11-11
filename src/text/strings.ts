// Small string helpers shared by the Studio's panels. Display only.

/** Escape text for an HTML string. */
export const esc = (t: string): string => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
/** First letter in capitals. */
export const cap = (t: string): string => (t ? t[0].toUpperCase() + t.slice(1) : t);
/** At most `n` characters, cut at the end with an ellipsis. */
export const clip = (t: string, n: number): string => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
