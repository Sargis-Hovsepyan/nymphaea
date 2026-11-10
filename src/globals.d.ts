import type { Book, Settings } from "./types";

declare global {
  interface Window {
    /** Embedded by an exported book file. */
    __BOOK?: Book;
    __SETTINGS?: Partial<Settings>;
    /** Set inside the Studio's live preview iframe. */
    __PREVIEW?: boolean;
    /** Present only when running as a claude.ai artifact. */
    claude?: { use(name: string): Promise<any> };
    pdfjsLib?: any;
  }
}

export {};
