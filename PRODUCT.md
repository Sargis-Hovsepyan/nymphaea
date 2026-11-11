# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three groups, all served by the same Studio. Writers who turn their own manuscripts or serial episodes into illustrated books. Readers who load a public domain or saved story to read it in an illustrated form. Small presses and editors who produce illustrated editions of other people's work. Each one imports text, places pictures, chooses a look and exports or reads the result.

## Product Purpose

Nymphaea Studio turns any story into an illustrated book that can be read in the browser, exported as one HTML file, printed, or saved as EPUB. Pictures are drawn from the text itself with no AI. Success is a book a person wants to keep reading, made in minutes, with the author's words untouched.

## Positioning

The pictures are composed from the passage's own words (place, hour, weather, season, things, people, pose) and every caption is an exact quote. No neighbouring tool reads a text and stages it without a model, or guarantees the words are never changed.

## Operating Context

The user drops a PDF, Word file, EPUB, web page, Markdown or plain text, checks the text, stages pictures, tunes the look, then exports. The live book is the centre of the work. Text and controls are secondary panels. Optional local or remote AI models can stage or paint pictures.

## Capabilities and Constraints

- The author's words are never changed, cut or reordered. Captions are exact quotes (`src/stage/guard.ts`).
- One static `index.html`, served by GitHub Pages, works offline, no server.
- Everything works without AI. AI hooks are optional and run from the browser.
- Books are kept in browser storage (IndexedDB bookshelf).
- The text lexicon for reading scenes is English only.

## Brand Commitments

Name Nymphaea, after the water lily that opens with the light and closes at night. The lotus mark. Every look comes in a light and a dark mood.

## Evidence on Hand

A built-in sample book and `episodes/` text. No testimonials, customers or usage numbers exist and none may be invented.

## Product Principles

1. The words come first. Nothing in the interface may alter or crowd them.
2. The book is the workspace. Controls serve the live book and step aside.
3. Pictures must be earned by the text. No decoration that the passage does not support.
4. Works with nothing installed. AI is an option, never a requirement.
5. Every effect can be switched off by the author and the reader.
