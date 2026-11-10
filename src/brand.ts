// The one place the product name lives. Rename here and everything follows.
export const APP_NAME = "Nymphaea";

export const KEYS = { book: "nymphaea-book", settings: "nymphaea-settings" } as const;

/** The Studio's working draft: the Markdown, the title and the staging plan. */
export const DRAFT_KEY = "nymphaea-draft";

/** A reader's own look for one exported book. */
export const readerKey = (title: string): string => "nymphaea-reader:" + slug(title);

export function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book";
}

// Keys used by v0 ("Lamplight Press"). Read once and copied forward so no reader loses a book.
export const LEGACY_KEYS = { book: "lp-book", settings: "lp-settings" } as const;

export function exportFileName(title: string): string {
  return APP_NAME.toLowerCase() + "-" + slug(title) + ".html";
}
