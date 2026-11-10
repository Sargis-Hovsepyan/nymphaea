# Nymphaea

Nymphaea turns any story into an illustrated book: scrolled, in chapter cards, in paged spreads, printed, or as an EPUB. Small drawings act out the story's beats as you reach them, a lamp lights the line you're reading, and every effect can be switched off. Every look comes in a dim light mood and a dim dark mood. **Your words are never changed, cut or reordered.**

The name comes from the water lily *Nymphaea*. The sacred blue lotus of Egypt grew on the Nile beside papyrus, and it opens with the light and closes at night.

## Start it

**Double-click `index.html`.** That one file is the whole app, **Nymphaea Studio**: no install, no server. It opens on a page with a live sample book you can restyle, then becomes a three-pane workspace: your manuscript on the left, the real book in the middle, and the design controls on the right. On a phone the panes sit behind a bottom tab bar.

1. **Source.** Drop a PDF, a Word file (`.docx`), an EPUB, a web page, Markdown or plain text, or several episodes at once (ordered by file name). Everything becomes Markdown, and the Studio reports what it did:
   - **From a PDF:** page numbers and running heads come out, paragraphs split across pages are joined, and words hyphenated at a line end are mended. Italics and bold are kept, drop caps are put back on their word, two-column pages are read in order, and footnotes are noted. Page breaks it can't be sure about are listed for you to check.
2. **Text.** Check the Markdown:
   - `#` starts a chapter and `##` a section.
   - `>` is a quote. Under a heading it becomes an epigraph, and an attribution line (`> — Name`) keeps its own line.
   - A line ending in `\` keeps its line break, for verse.
   - `*word*` is italic, and `* * *` is a scene break.
   - Pasting from Word or Google Docs keeps italics, headings and quotes.

   The step also has:
   - fields for the subtitle, author and dedication;
   - an outline that jumps to each chapter, quote and verse;
   - a **typography check** that offers curly quotes, em dashes and ellipses, but changes nothing unless you click Fix.
3. **Pictures.** Place them automatically (few, some, many), let Claude stage them (on claude.ai), or change, remove and add them yourself.
   - Automatic placement finds where the story changes scene (TextTiling) and picks vivid paragraphs with even spacing (dynamic programming over TF-IDF keyword scores).
   - Captions are always words quoted from the text.
4. **Look.** Start from an edition (Lamplight, First Edition, Nocturne, Sumi, Zine, Typescript, Field Notes, Drift), then tune:
   - **Form:** scroll, chapter cards or paged spreads; printed page size.
   - **Colour:** six themes (Lamplight, Nocturne, Vellum, Sumi, Moss, Riso), each light and dark, or following the reader's device.
   - **Type:** nine typeface pairings. Line length is set in characters (55, 66 or 75), so it holds for every face. Choose indented or spaced paragraphs, ragged or justified text, drop cap, raised cap or small-caps openings, chapter numerals and the scene-break ornament.
   - **Light & motion:** off, lamp, candle, focus (the paragraph you're reading stays bright) or dawn (each chapter brightens as you read). Lines can rise, fade or ink in.
   - **Pictures:** Ink, Cut paper, Glow, Ink wash, Engraving, Stipple, Riso, Generative (grown from the passage's own words), Halftone, Dithered, ASCII, Glass, Ornaments or none.
5. **Export.**
   - **HTML book:** one file with the text, pictures, look and reading engine. It works offline.
   - **EPUB:** for e-readers.
   - **Print or PDF:** a typeset page with mirrored margins, folios, and chapters on new pages.
   - **Markdown:** the text itself.

The middle pane is the real book, live, at desktop, tablet or phone width. Click any paragraph in it to jump the editor there. The moon button switches the Studio between auto, light and dark. Ctrl/⌘+S downloads, and Ctrl/⌘+E opens the export sheet.

## Put it on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, select your branch, and select the **/ (root)** folder.
3. Your book is live at `https://<user>.github.io/<repo>/`.

The root `index.html` is self-contained, and `.nojekyll` tells Pages to serve it as-is. After you change the code, run `npm run build` and commit the new `index.html`.

## Change the code

`index.html` at the root is **generated**. Edit `src/`, then rebuild:

```bash
npm install
npm run dev     # live dev server on src/index.html
npm test        # every paragraph survives every import; the Guard; staging; palettes; formats; scenes
npm run build   # typecheck, then write the single-file ./index.html
```

## Files

- `index.html`: the app (built; open this one).
- `src/`: the source. `src/index.html` is the page, and `src/main.ts` is the entry point. See `CLAUDE.md` for the map.
- `tests/`: the guarantees, starting with "every paragraph survives".
- `episodes/`: the story, one Markdown file per episode.
- `docs/roadmap.md`: the platform plan.
- `docs/research.md`: the evidence behind the design.
