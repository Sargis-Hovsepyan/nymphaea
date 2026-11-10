# Nymphaea: notes for Claude Code

## What this project is

Nymphaea (formerly "Lamplight Press") is a press for stories.
- **What goes in:** story text in any of the usual formats: an episode, a chapter or a whole series, as PDF, Word (.docx), EPUB, HTML, Markdown or plain text.
- **How it becomes a book:** the **Studio** turns it into Markdown the author checks, stages it with small procedural illustrations, and sets it as a book in a chosen look.
- **What comes out:** one self-contained HTML book (scroll, chapter cards or paged spreads), an EPUB, a printed or PDF page, or the Markdown itself.

Every effect is a parameter the author can switch, and every look comes in a dim light mood and a dim dark mood.

The author writes a story in episodes. The first one is `episodes/01-the-lesson-i-refused-to-learn.md`. The long-term goal is a platform: drop in any book or the episode history, and get a book that keeps the reader's place, the thread and the mood. **The full plan is `docs/roadmap.md`.** The evidence behind it is in `docs/research.md`.

## The one rule that never bends

**Never change, cut, summarize, merge or reorder the author's words.** The engine only adds things around the text: pictures, captions, spacing, emphasis, typography. A caption may quote a few words from its paragraph exactly; it must never invent text. Every import path must round-trip every paragraph, with a test.

This is enforced in code:
- `src/stage/guard.ts`: every staging plan, whether by hand, by rules or by an AI, goes through `guardScenes()` before it reaches the page.
  - A caption must be an exact, case-sensitive substring of its anchor block or one of the 6 before it. Whitespace is compared flat, so verse line breaks don't matter.
  - Otherwise it is replaced with a quote taken from the paragraph.
- **Heuristics never act silently.** Importers and analysers write what they guess into Markdown the author can see and edit, or list it in their report. The renderer only follows explicit Markdown.
- **Micro-typography is display-only.** `src/text/micro.ts` handles small-caps acronyms and keeps the last two words together. It only wraps runs in spans, so copying the page gives back the author's exact characters.
- **The typography check is opt-in.** `src/text/check.ts` offers curly quotes, dashes and ellipses, but changes nothing unless the author clicks Fix. Then it is the author's own edit.
- `tests/parse.test.ts`, `tests/pdfmd.test.ts`, `tests/formats.test.ts`: every import path keeps every paragraph.
- `src/seed.ts` is generated from the v0 file. Never retype the author's words by hand.

## Current state

**The build.** It is a Vite + TypeScript project. The build output, the root `index.html`, is **one self-contained file** (`vite-plugin-singlefile`), about 240 kB (80 kB gzipped). Keep it under 245 / 82 kB.
- **One engine, three modes,** chosen in `src/main.ts`:
  - **maker:** the Studio: a landing page, then a three-pane workspace (manuscript, the live book, design).
  - **book:** an exported file, with `window.__BOOK`.
  - **preview:** the Studio's iframe, with `window.__PREVIEW`. It is fed by `postMessage` and built by the same `buildBookHtml`, so the preview is exactly the download.
- **On claude.ai,** two features light up through `window.claude.use(...)`: `sample` (the **Let Claude stage it** button) and `downloads`. Elsewhere, downloads fall back to a normal browser download.
- **In the dev server,** downloads are disabled, because export needs the inlined engine.

Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`.

### Code map

**Entry and data**
- `src/index.html`: the Vite entry (`root: "src"`). It holds two things:
  - **The book shell `#shell`:** the top bar, the `.room` light overlay, the `#pages` wrapper around `main` (cover, dedication, `#text`), the `#studio` Reading drawer (contents, page, light, type, print), and the `#nyWash` SVG filter.
  - **The Studio `#maker`:** `#mkLanding` (a full-screen overlay with a live demo book), `#mkWork` (the workspace: `.wk-left` manuscript with Text and Pictures tabs, `.wk-canvas` the preview iframe and dock, `.wk-right` the Design inspector, `.wk-nav` the phone tab bar), the `#mkExport` dialog and `#mkToasts`.

  The build writes the root `index.html`, which is generated: never edit it. It is what GitHub Pages serves.
- `src/main.ts`: boot. It captures the pristine shell, CSS and engine for export. `READER_KEYS` lists what a reader may change.
- `src/types.ts`:
  - `Book`: `{ title, blocks, scenes, beats?, cover?, source, subtitle?, author?, dedication? }`.
  - `Block`: `{ type: 'p'|'h'|'quote'|'verse', text, level? }`. Verse keeps `\n` in `text`.
  - `Settings`: see the table below.
- `src/settings.ts`: `DEFAULTS`, `SETTINGS_REV` (3), `migrate()` (rev 1–2 → 3; validates everything) and `withDefaults()`. Also `DENS`, `FIGW`, `STRUCTURAL`.
- `src/state.ts` (`state`, `moving()`), `src/store.ts` (localStorage, `lp-*` migration), `src/brand.ts` (names, keys, `readerKey`).
- `src/seed.ts` (generated) and `src/sample.ts`: the sample episode and its hand-placed scenes.

**Design** (`src/design/`)
- `themes.ts`: 6 themes × light and dark (`palette()`, `paletteVars()`, `contrast()`, `isDark()`). Contrast is tested.
- `type.ts`: 9 pairings (`PAIRINGS`) plus `fontsHref()` (loads only the chosen pair), `leading()`, `normSize()` (x-height matching), `MEASURE` (55/66/75 characters) and `numeral()`.
- `presets.ts`: the 8 editions in the Studio gallery.
- `studio.ts`: the Studio's own palette ("night water" dark, "mist" light), with `raised` and `pollen` tokens; contrast-tested. It is not a book theme.

**Text** (`src/parse.ts`, `src/inline.ts`, `src/text/`)
- `parse.ts`: `parseText`, `blocksToText` (a round-trip fixed point), `parseDraft`, `isProse` and `flat`.
- `inline.ts`: render-time `*em*` / `**strong**`, `isBreak`, and `appendInline(…, { micro })`.
- `text/micro.ts`: display-only small caps and the last-two-words tail.
- `text/check.ts`: `findIssues` and `applyFix`.

**Import** (`src/import/`)
- `pdfmd.ts`: pure PDF lines → Markdown, with a report.
  - It removes page numbers and running heads, and handles paragraphs across pages and indent or spaced styles.
  - It mends line-end hyphens from evidence elsewhere in the document.
  - It keeps italics and bold from font names, rejoins drop caps, reads two-column pages in order, spells out ligatures and notes footnotes.
  - Breaks it can't be sure of go in `report.unsure`.
- `pdf.ts`: pdf.js 3.11.174 from cdnjs, with face detection via `commonObjs`.
- `docx.ts`, `epub.ts`, `html.ts`: tokenizers with no DOM, so they are testable in Node. `html.ts` also serves rich paste.
- `files.ts`: routes each format. `joinEpisodes` handles series.
- `src/zip.ts`: ZIP with no library. Store-only writing; reading uses `DecompressionStream("deflate-raw")`.

**Staging** (`src/stage/`)
- `keywords.ts`: 26 scenes, `WORDS`, and `scoreOf(text, model?)`, matched by stem and TF-IDF weighted.
- `stem.ts`: the stemmer, stop words, `docModel` and `idf`.
- `segment.ts`: TextTiling with word-count windows. Headings and breaks are always boundaries.
- `place.ts`: `placeK`, the dynamic program choosing K vivid, evenly spaced paragraphs.
- `auto.ts`: `autoStage` (deterministic), `captionFor` (scored clauses, always a quote) and `dominant`.
- `beats.ts`: `autoBeats`, short lines relative to their neighbours.
- `mood.ts`: `moodOf` and `hash`, for the generative style.
- `guard.ts`, `remap.ts`, and `claude.ts` (`buildStagingPrompt` / `readStagingReply`: the JSON contract any AI tier must reuse).

**Pictures**
- `src/vscenes/`:
  - `index.ts`: 14 scenes.
  - `more.ts`: 12 everyday scenes (window, stairs, letter, train, bird, mountain, house, bridge, field, cup, clock, book).
  - `shapes.ts`.
  - `model.ts`: a DOM-free model of any vector scene. It is used to draw canvas versions (`canvasScene`) and to give SVG snapshots.
- `src/scenes/`: the hand-drawn 192×120 canvas scenes. `index.ts` fills every other library scene from its vector version.
- `src/renderers/`:
  - `index.ts`: dither, halftone, ascii, glass, plus tokens.
  - `print.ts`: engrave, stipple, riso and flow (generative, seeded by the passage).
  - `vector.ts`: ink, cut, glow, wash. Each is CSS on role classes in `styles.css`.

**Layout and the reader**
- `src/layout/`:
  - `geometry.ts`: pure `pageAt`, `geometry` and `printCss`.
  - `paged.ts`: CSS-column spreads, turning pages, running heads and folios, and an anchor that keeps the reading place across reflows.
  - `print.ts`: forces light mode and finished frames for print.
- `src/ui/`:
  - `reader.ts`: `renderBook`. It covers chapter openers with numerals, epigraphs inside the opener, verse, ornaments, the colophon, the reveal fallback by IntersectionObserver, and the ~25 fps loop.
  - `look.ts`: settings → tokens, fonts and classes; `refineMeasure` measures the real glyph width.
  - `light.ts`: off, lamp, candle, focus and dawn.
  - `controls.ts`, `readerPanel.ts`, `previewChild.ts` (render, scroll, top, print, snapshots).

**The Studio and export**
- `src/maker/`:
  - `index.ts`: landing and workspace switching; the Studio's own auto/light/dark; the preset gallery, theme, type and style pickers; outline chips and the typography banner; rich paste; picture cards with thumbnails (`sceneThumb`); click-to-edit from the preview (`onPick`); HTML, EPUB, print and Markdown export.
  - `editor.ts`: the Markdown textarea over a colour mirror (`highlight`, display-only, its text always equals the input; tested). The textarea grows with its text, so the pane scrolls as one page.
  - `landing.ts`: the demo iframe and edition chips on the landing page.
  - `ui.ts`: `toast`, `saveState`, `setPane` (phones show one pane, mid widths one side beside the book), the export dialog.
  - `preview.ts`: the iframe bridge, including `pick` messages.
  - `maker.css`: the Studio's styles, on tokens from `design/studio.ts`.
- `src/export.ts`: `buildBookHtml` and `scriptJson`. `src/epub/book.ts`: `buildEpub`, an EPUB 3 package.

### Parameters (all in `DEFAULTS`)

| key | values | effect |
|---|---|---|
| layout | **scroll**, cards, paged | one column; full-screen chapter openers; two-page spreads (one on phones) |
| theme / mode | lamplight, nocturne, vellum, sumi, moss, riso / auto, light, **dark** | palette; auto follows the reader's device |
| light, follow, flicker | off, **lamp**, candle, focus, dawn / bool / bool | the room's light |
| pairing, fontSize, measure | 9 pairings / 15–25 / narrow, **normal**, wide (55, 66, 75 chars) | type; size matched by x-height |
| para, align | book (indented), **web** (spaced) / **ragged**, justify | paragraph setting |
| opening, numerals, ornament | **drop**, raised, smallcaps, none / **roman**, words, arabic, none / **asterism**, dinkus, hedera, lotus, rule | chapter openings and scene breaks |
| style, size, density, motion | **ink**, cut, glow, wash, engrave, stipple, riso, flow, halftone, dither, ascii, glass, orn, none / s, **m**, l / few, **some**, many / bool | pictures |
| reveal, beats | none, **rise**, fade, ink / bool | how lines arrive; short lines stand alone |
| trim | **a5**, 6x9, a4, letter | printed page size |
| readerControls | bool | exported books show the Reading drawer |

## Design decisions already made (keep unless the author says otherwise)

- **The Studio is not the book.** The app around the book is "night water": deep blue-green, a lotus-violet accent and a pollen-gold signal, set in Instrument Sans (its width axis does the headlines). The only serif on screen is the book itself. No all-caps labels, mono eyebrows or arrows on buttons. Reader chrome in exported books keeps each book theme's own tokens but shares the sentence-case sans controls.
- **Dim, in two moods.** The aesthetic is a private press after dark, in a dim light mood and a dim dark mood. Nothing is pure white or pure black; there are warm greys, one accent per theme and hairline rules. The Studio has its own auto, light and dark switch.
- **Scroll is the default form.** Chapter cards, paged spreads, print and EPUB are the other forms the author asked for (Nov 2026).
- **Pictures are small and sit between scenes.** Motion is tied to the story moment, not decoration: research on "seductive details" says decorative animation hurts reading. Ink is the default look.
- **New scenes go in `src/vscenes/`.** Tag shapes with role classes (`pool edge board far key lit beam line fig bg2`) and animate only the parts that carry the beat. Canvas styles get them for free through `vscenes/model.ts`.
- **When a default changes for everyone,** bump `SETTINGS_REV` and extend `migrate()`.
- **Short lines become beats.** These are lines like "Check." and "No.", or lines short compared with their neighbours. Lines of one or two words get the mono accent style.
- **No reading-speed tricks:** no RSVP or Bionic-style text, no streaks, no notifications, and the total book length is never shown (see `docs/research.md`).

## Roadmap

See `docs/roadmap.md` §6. Since the roadmap was written:
- **Done:**
  - docx, epub and html importers (Phase 1);
  - parts of the analysis layer (segmentation, beats, mood);
  - Place (focus and dawn light);
  - Mood (pacing via beats);
  - EPUB 3 export (Phase 8).
- **Open:**
  - Thread (who's who, quoted story-so-far);
  - AI tiers (local WebLLM, Anthropic API with `claude-sonnet-5-5`);
  - Listen-along;
  - OCR for scanned PDFs;
  - recto chapter starts in paged mode.

## Working notes

- **Test pictures by scrolling.** A scene's `t` comes from its position on screen, so a still screenshot shows only one moment. In paged mode a picture plays when its page shows.
- **Fonts** come from Google Fonts, and only the chosen pairing is loaded. Fallback stacks are in `design/type.ts`. The Studio's specimen cards use `&text=` subsetting.
- **PDF paragraph detection** uses line-gap heuristics, so check it against the author's PDFs.
- **The print loop:** a book printed to PDF in Chromium re-imports paragraph for paragraph, ignoring emphasis markers (printed beats are italic). The print stylesheet is in `layout/geometry.ts`; keep it that way.
- **After a build,** the root `index.html` must contain exactly one `</script>`. The exporter builds its closing tag at runtime for this reason.
- **The published version** lives at the author's private claude.ai artifact (still titled "Lamplight Press"). Publish the root `index.html` to keep it in sync, but ask first: it replaces the book page with the Studio.
