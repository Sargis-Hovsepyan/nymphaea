# Nymphaea: a new way to read any book

## Name

**Lamplight Press is renamed to Nymphaea**, after the water lily *Nymphaea*. The sacred blue lotus of Egypt grew on the Nile beside papyrus, the first paper. It opens with the light and closes at night, like a book under a lamp. The brand motif is a small dithered lotus that opens as the reader scrolls through the cover and closes on the stop card at the end of a sitting.

The rename touches:
- the `<title>`, top bar and cover in `index.html`
- the export file name (`nymphaea-<book>.html`)
- the localStorage keys (`lp-book` becomes `nymphaea-book` and `lp-settings` becomes `nymphaea-settings`, with a one-time migration so nothing is lost)
- `README.md` and `CLAUDE.md`
- `package.json` (`"name": "nymphaea"`)

The name lives in a single `APP_NAME` constant in `src/brand.ts`, so a later change is one line. The lamp stays as a *feature*, not the brand.

## Context

`index.html` (v0) turns pasted text, .md, .txt or .pdf into one scrolling, illustrated book. It already has procedural dithered scenes tied to story beats, a lamp focus effect, typographic beats and a Studio of switches. The author wants a **platform**: drop in any story (PDF, Word, EPUB, plain text, a whole series) and get a book that is so pleasant and so *guiding* that people would choose to convert their books into it before reading.

- Work that rules can do is done by rules.
- Harder judgement goes to a pluggable AI.
- The one rule in CLAUDE.md is absolute: **the words are never changed, cut, merged or reordered.** Everything we add sits *around* the text.

This plan is the research, the product idea, the architecture and a phased build order. Research gets appended to `docs/research.md`.

---

## 1. The thesis

Paper still beats screens. Not because of the glass, but because on screens readers **lose their place, lose the thread, and lose the mood** (scrolling, mind-wandering, interruptions, forgetting who is who). Every past "revolution" attacked the wrong thing. RSVP and Bionic Reading changed *how the words are read*, and the evidence says that fails.

**Nymphaea's idea: leave the words exactly as they are and make the book *aware of the reader*.** It knows where you are, what you've already met, and what moment of the story you're in. It uses that to light the way: pictures that act out the beat, a lamp on your line, a memory of every character, pacing that lets you stop well.

Three promises, which drive every feature:

1. **Never lose your place.** Focus, position, sittings, return.
2. **Never lose the thread.** Who's who, story so far, dialogue, story map. Always spoiler-safe.
3. **Never lose the mood.** Beat-synced scenes, room and lamp, space as time, optional sound and voice.

## 2. Research: what the evidence says

### What fails, so we don't build it
| Evidence | Consequence |
|---|---|
| RSVP (one word at a time) lowers comprehension because readers can't glance back ([Schotter et al., Psych Science](https://www.psychologicalscience.org/journals/psychological-science/0956797614531148/)). Static text beats it. | No word-flashing modes. The text stays still and complete. |
| Bionic Reading: no speed or comprehension effect across 2,000+ readers ([Readwise](https://blog.readwise.io/bionic-reading-results/)). | No gimmicks that alter letterforms. |
| "Dyslexia fonts" show no benefit once spacing is matched. **Letter and line spacing** do help (Zorzi, PNAS 2012: accuracy roughly doubled; Stagg & Kiss 2021: +13% speed) ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3396504), [UMich](https://dyslexiahelp.umich.edu/latest/increased-spacing-letters-helps-dyslexics-read-better/)). | Offer an "Easy spacing" switch (extra letter, word and line spacing), not a special font. |
| Seductive details: decorative art and motion lower recall (existing docs). "Snow Fall": autoplay and visible length drove abandonment. | Every picture and motion is tied to a beat. Nothing autoplays with sound. The total length is never shown. |
| Streaks raise short-term use, but the effect on long-term habit is unproven, and readers end up chasing the streak ([PressGazette](https://pressgazette.co.uk/news/streak-mechanism-key-gen-z-gamified-app-newsreel/), [arXiv RCT](https://arxiv.org/pdf/2310.10850v2.pdf)). | No streaks, no guilt, no notifications. Gentle "reading nights" history only. |
| Kinetic or animated text: jerky motion overloads, and smooth timing helps ([Kuraitytė 2020](https://journals.uc.edu/index.php/vl/article/view/4632)). | Text animation is limited to a soft rise-in and to beats. |

### What helps, so we build it
| Evidence | Feature |
|---|---|
| The screen deficit is largest **when readers must scroll**, and small without scrolling (2026 meta-analysis, [reported](https://www.dailysabah.com/opinion/op-ed/staying-with-a-page-why-we-still-need-printed-books/amp)). Mind wandering predicts worse inference ([Frontiers](https://www.frontiersin.org/articles/10.3389/fpsyg.2022.987964)). | A reading-line lamp, a "you were here" marker, position memory, sittings, and Focus mode. |
| **Focused animated illustrations increased engagement and recall** in ebook readers (CHI 2024, [Sumedh et al.](https://www.asarif.com/pub/Sumedh_CHI2024_eBook_Illustrations.pdf)). Scrollytelling (N=454, 2026): higher engagement, lower load ([arXiv](https://arxiv.org/abs/2603.04367)). | Our core: small scenes whose motion is driven by the beat. |
| Comprehension peaks at medium line length. Extreme line spacing hurts, and small type slows reading ([Rello](https://flatisbad.com/resources/Rello-LA-WEB12.pdf), [Dyson](https://journals.uc.edu/index.php/vl/article/view/5671)). | Width locked to 55–75 characters, line spacing 1.5–1.7. The size setting changes the type only. |
| Phrase-chunked formatting (VSTF / Cascade) shows modest gains, mostly for second-language and struggling readers. The evidence is mixed and partly vendor-funded ([PubMed](https://pubmed.ncbi.nlm.nih.gov/34807375/), [Dempsey 2024](https://www.researchgate.net/profile/Jack-Dempsey-3/publication/379834622_Linguistically-driven_text_formatting_improves_reading_comprehension_for_ELLs_and_EL1s/links/661dd06af7d3fc2874633b0c/Linguistically-driven-text-formatting-improves-reading-comprehension-for-ELLs-and-EL1s.pdf)). | An optional **Cascade mode** that adds only line breaks and indents at phrase boundaries. Words and order are unchanged, and the round-trip test still passes. Off by default. |
| Reading while listening: comprehension results are mixed, but **readers consistently prefer it**, and it helps decoding for weaker readers ([UMD](https://education.umd.edu/node/44014), [ERIC](https://files.eric.ed.gov/fulltext/EJ1403866.pdf)). | **Listen-along** mode with word-level highlight, started by the reader and never autoplayed. |
| Story maps help comprehension, mostly for young or struggling readers ([Beyhatin 2023](https://irrc.education.uiowa.edu/sites/irrc.education.uiowa.edu/files/2023-07/Story%20Map_2023.pdf)). Glosses aid vocabulary ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC9851552)). | Who's who, a spoiler-safe story map, and tap-to-gloss. |
| Webtoon craft: **space on the scroll is time**. Wide gutters mean pauses, stretched scroll means tension, and reveals must not enter the screen before their setup ([Stimpunks](https://stimpunks.org/fieldguide/design/rhythm/), [Comics Beat](https://www.comicsbeat.com/interview-ethan-leblanc-on-reformatting-beneath-the-trees-where-nobody-sees-other-comics-to-webtoons-vertical-scroll)). | A **pacing grammar**: whitespace before reveals, held beats, chapter-end holds. |
| Ambient sound: industry-funded positives, and reviewers found even ambient sound eventually distracting ([Booktrack coverage](https://newatlas.com/booktrack-soundtracks-for-ebooks/19761)). | Sound is a low-priority, opt-in, ambient-only room tone. |

### What readers and the market want
- Episodic, phone-first reading is huge: Webnovel has about 400M readers, and webtoons are a ~$14B market (existing docs). Kindle Vella closed in Feb 2025, leaving serial authors spread across Royal Road, Substack, Patreon and Ream ([Engadget](https://www.engadget.com/apps/amazon-is-shutting-down-its-kindle-vella-serialized-story-platform-in-february-2025-120030125.html)). **Authors need a beautiful, portable format they own.**
- Readers want memory help: Kindle Recaps, "Story So Far" and Ask-this-Book ([Amazon](https://www.aboutamazon.com/news/books-and-authors/kindle-recaps-feature-ebook-series-refreshers)), and the Readwise X-ray ([Readwise](https://readwise.io/reader/update-july2024)). Their recaps are *generated* text. Ours are **quoted** text, which is a trust advantage.
- Social reading is real: Fable reports 5M users and ~200K clubs ([Scribd](https://www.scribdinc.com/newsroom/everand-and-fable-launch-a-single-shared-subscription)).
- Competitors (dokkei, Book 2 Life, Bookworm, TextWiz, Sova) only bolt AI pictures onto EPUBs ([PH](https://www.producthunt.com/p/dokkei/dokkei)). **No one owns the beat-synced, place-aware reading experience.** That's the gap.

## 3. The Nymphaea format: what a reader gets

**Reading modes** (one tap, top bar):
- **Read** (default): one continuous scroll, beat scenes, lamp.
- **Focus**: only the current paragraph is fully lit. Others dim to about 35%. Arrow, space or tap advances smoothly. This is the anti-lost-place mode for phones.
- **Listen-along**: TTS reads aloud while the current word is underlined in accent colour. The scroll follows the voice, and scenes play as the voice reaches them. It pauses when the reader scrolls away.
- **Cascade**: phrase-break layout (described above).

**Never lose your place**
- The lamp tracks the *reading line*: the paragraph at about 40% of viewport height. Pointer-follow stays optional on desktop.
- A "You were here" ribbon on return, plus exact paragraph restore across devices through the exported file and localStorage.
- **Sittings** of about 8–12 minutes, cut at scene breaks. Each shows only "~9 min left in this sitting". At the end, a stop card reads "A good place to stop", with the next chapter's title and a bookmark saved.
- Easy spacing and the high-contrast room (accessibility).

**Never lose the thread** (every aid is cut off at the reader's furthest-read paragraph, so nothing spoils)
- **Who's who margin**: a character card fades in on first mention. It shows the name, the *exact introducing sentence*, and later quoted lines the reader has already passed. Tap any later mention to bring it back.
- **Story so far**: the author's "Previously" if present. Otherwise 3–5 **quoted** key sentences from what the reader has read, ranked by rules or the AI.
- **Dialogue marks**: a speaker initial or colour tick in the margin when attribution is confident.
- **Story map** (a drawer): characters met so far, who appears with whom (co-occurrence), and places. All entries link back to passages.
- **Tap-to-gloss**: tap a word for a dictionary definition, from an optional bundled or online dictionary. This is reference data, not story text.
- **Search and quotes**: find in book, save a highlight, share a quote card (dithered scene plus exact sentence).

**Never lose the mood**
- **Beat scenes**: the existing 13 scenes, plus a composable *scene grammar* (see §5). Motion is driven by `t` at the beat.
- **Room drift**: the palette eases along the story ribbon (dark passages lean toward midnight). It's subtle and can be switched off.
- **Pacing grammar**: extra whitespace before a beat or reveal. Short-line beats are held. A chapter-final line gets a full-screen hold. A cliffhanger card says "Next episode".
- **Story ribbon**: a thin progress bar showing the tension curve for *this chapter only*, so book length is never revealed.
- **Room tone** (opt-in, last priority): a quiet loop per room (rain, fire, night). No effects, no music.

**Make it yours**: every effect stays a switch in `DEFAULTS`. Presets: *Calm* (no motion, no lamp), *Lamplit* (default), *Cinematic* (larger scenes, room drift, room tone), and *Study* (Focus, story map, glosses).

**Read together** (later phase): an exported book can carry the author's margin notes. Shared annotations need a backend, so that's deferred. The first version is shareable quote cards and links to a paragraph (`#p-142`).

## 4. Platform: the two sides

**Author / Studio**
- Import: paste, .txt, .md, .pdf, **.docx**, **.epub**, .html, .rtf (later). Batch-drop a folder to make a series.
- Review the **staging plan** before anything ships. It appears as a list: "scene *knight-falls* after ¶41, caption '…'". Accept, reject, move. Click a paragraph to pin a scene (the motif editor).
- Series: `series.json` (title, order, cover style, default settings, recurring motifs → scenes), author-written "Previously" per episode, and a library view.
- Upload their own pictures, which go through the same dither/halftone renderers so the look stays consistent.
- Export: a single-file HTML book (exists), **EPUB 3 with Media Overlays** (EPUB's standard read-along sync, so Listen-along survives in Apple Books, Thorium and others), and a static site per series.

**Reader**
- Open any exported book from a link or file, offline-capable (the single file).
- Library with continue-reading across episodes.
- Convert their *own* books locally. Text never leaves the device unless they enable the cloud AI tier. Personal use; the platform doesn't host other people's books.

## 5. The engine

```
Import ─▶ Normalize ─▶ Analyze ─▶ Stage ─▶ Guard ─▶ Render / Export
 file      BOOK.blocks   annotations  plan     verified   reader · HTML · EPUB · site
```

### 5.1 Import (`src/import/`)
- `txt.ts` and `md.ts` (current `parseText`).
- `pdf.ts` (current `pdfText`, pdf.js 3.11.174 lazily loaded).
- `docx.ts` (mammoth.js browser build, loaded only when needed; paragraphs and headings from styles).
- `epub.ts` (JSZip, OPF spine order, XHTML `<p>`/`<h*>` into blocks).
- `html.ts`.
- All output `BOOK.blocks`. **Round-trip invariant:** normalized source paragraphs equal `blocks[].text`, in order, for every importer, with fixture tests.

### 5.2 Analyze (`src/analyze/`): Tier 0, rules, deterministic, offline
- `entities.ts`: capitalized-token candidates (stop-list, sentence-start filter), clustered by shared tokens and honorifics ("Tom", "Mr. Sawyer").
- `dialogue.ts`: quote spans, speaker guessed from speech verbs ("said X", "X asked") and alternation, each with a confidence score.
- `breaks.ts`: `***`/`#`/blank-gap scene breaks. Sittings come from words per minute (default 230) cut at the nearest break.
- `ribbon.ts`: lexicon sentiment per paragraph (AFINN-style, MIT-licensed list), smoothed per chapter.
- `keylines.ts`: extractive ranking (TextRank over sentences plus a boost for entity first mentions) for Story so far.
- `phrases.ts`: Cascade break points (punctuation, conjunctions, prepositions, a max chunk length).
- `keywords.ts`: the current `WORDS`/`scoreOf` scene matching.
- Output: `BOOK.annotations` = `{entities, mentions, quotes, breaks, sittings, ribbon, keylines, phrases}`. These are **offsets into blocks, never copies of text**.

### 5.3 Stage: three tiers of intelligence, one contract (`src/stage/`)
`interface Stager { id; available(): Promise<boolean>; stage(book, ann): Promise<StagingPlan> }`

| Tier | Provider | When | Does |
|---|---|---|---|
| 0 | `algorithmic` (current `autoStage`) | always | scenes by keyword density, captions from clauses |
| 1 | `local-llm` (WebLLM + small Qwen/Phi, WebGPU, JSON-schema output) | optional, no key, private | improves speakers, moods, scene choice per chunk |
| 2 | `claude-artifact` (current `stageWithClaude` via `window.claude`) / `anthropic-api` (pasted key in sessionStorage, `claude-sonnet-5-5`, chunked by chapter, prompt-cached) | hard books, best quality | full staging: scenes, captions, beats, entity merges, speakers, key lines, motifs |

The AI returns **structure only**: indexes, scene ids, and quoted spans as `{block, start, end}` or exact strings. One shared JSON schema lives in `src/stage/contract.ts`, and the current prompt in `stageWithClaude()` is reused and extended.

### 5.4 Guard (`src/stage/validate.ts`): makes the one rule unbreakable
- Every caption, card quote, key line and gloss anchor must be an exact substring of its block.
- Indexes must be in range, scene ids must exist, there can be no duplicate scene within N blocks, and density limits apply.
- Invalid items are dropped and logged in the Studio ("2 AI suggestions rejected: not in text").
- Final check before render or export: `blocks` deep-equal the imported blocks.

### 5.5 Pictures (`src/scenes/`, `src/renderers/`)
- Keep the 13 scenes and the `scene(ctx, t, tm)` signature, and the `dither`/`halftone`/`ascii`/`glass` renderers (`R`).
- **Scene grammar** (new): composable primitives drawn on the existing helpers (`person`, `piece`, `board`, `poly`, `lg`/`rg`, `vignette`):
  - *setting*: room, street, night sky, table, doorway, field
  - *figure*: count, pose
  - *object*: lamp, chessboard, blueprint, chair, letter, door
  - *action over t*: enter, fall, advance, recede, light up, open
- The stager (rules or AI) can emit `{setting, figures, object, action}` when no hand scene fits, so any book gets meaningful, beat-tied pictures, not just chess scenes.
- `SceneSource` plug-in: procedural | author image (dithered) | *future* AI image provider through the same renderer.

### 5.6 Render and UI (`src/ui/`)
- `reader.ts` (current `renderBook`, the rAF loop, `target()`)
- `lamp.ts` (reading-line mode)
- `modes.ts` (Read, Focus, Listen, Cascade)
- `aids.ts` (cards, ribbon, sittings, story map, gloss)
- `studio.ts` (plan review, pin editor)
- `library.ts`
- `listen.ts`: Web Speech API `onboundary` for word highlight (free, available everywhere). Optional Kokoro in-browser neural voice (timestamped ONNX via transformers.js, WebGPU) for a better voice.
- All settings sit in `DEFAULTS` and persist as now.

### 5.7 Build and product shape
- Vite + TypeScript + Vitest. `vite-plugin-singlefile` keeps `dist/index.html` as a single self-contained file (the product). Heavy optional modules (pdf.js, mammoth, JSZip, WebLLM, Kokoro) load lazily from cdnjs/jsdelivr, so the base file stays small.
- The claude.ai artifact build stays in sync, with `window.claude` features enabled when present.

## 6. Phased build order (each phase ships something usable)

| Phase | Deliverable | Done when |
|---|---|---|
| **0 Foundation** | Rename to Nymphaea (with storage migration, plus the lotus cover scene), split `index.html` into Vite+TS modules, single-file build, Vitest | Build output behaves identically to v0. Round-trip, determinism, caption-substring and scenes-never-throw tests are green. |
| **1 Any file in** | docx, epub and html importers, plus the batch folder → series | Round-trip fixtures pass for each format. The author's real files import with matching paragraph counts. |
| **2 Understanding** | Analyze layer, annotations, Guard | Unit tests on episode 01 (entities, quotes, breaks, sittings). Guard rejects injected fake captions. |
| **3 Place** | Reading-line lamp, Focus mode, sittings and stop cards, you-were-here, Easy spacing, high-contrast room | Playwright at 390px: stop card appears, Focus advances, reduced-motion is respected. |
| **4 Thread** | Who's who, Story so far (quoted), dialogue marks, story map, gloss, search, quote cards | Spoiler test: no aid ever shows content beyond the furthest-read paragraph. |
| **5 Mood** | Pacing grammar, story ribbon, room drift, scene grammar plus 6 new author-world scenes (blueprint, hand over piece, chair pushed back, letter, doorway light, window rain) | Every new scene animates across t∈[0,1] and is tied to a beat. |
| **6 Intelligence** | `Stager` tiers 1 and 2, the Studio plan-review UI, chunking and caching | The same book staged by the three tiers all pass Guard. Plans can be diffed in the Studio. |
| **7 Voice** | Listen-along (Web Speech, then Kokoro) | Word highlight stays in sync. Pauses when the reader scrolls. |
| **8 Out** | Local Blob download, EPUB 3 with Media Overlays, static series site, presets | The EPUB passes epubcheck, opens in Thorium and Apple Books, and its paragraphs match. |
| **9 Together** (later) | Author margin notes in exports, deep links. Shared annotations need a backend, so that's out of scope for now. | |

## 7. Guardrails (checked in review on every phase)
- The one rule: Guard plus a final deep-equal of blocks before render and export.
- Motion only on beats. `prefers-reduced-motion` turns everything off. Nothing autoplays sound.
- Total book length is never shown. No streaks or notifications.
- Privacy: the text stays local unless the reader turns on Tier 2. API keys are never committed or exported.
- Accessibility: `role="img"` + `aria-label` on art, aids reachable by keyboard, a high-contrast room, Easy spacing.

## 8. Critical files
- `index.html`: the source to split. Reuse `parseText`, `blocksToText`, `scoreOf`/`bestScene`/`captionFor`/`autoStage`, `SCENES` and helpers (`person`, `piece`, `board`…), `R`, `renderBook`, `target`/`frame`, `lampStep`, `pdfText`, `loadScript`, `stageWithClaude`, `store`/`load`.
- New: `package.json`, `vite.config.ts`, `src/{import,analyze,stage,scenes,renderers,ui}/`, `tests/` (fixtures: episode 01 as md, docx, epub, pdf).
- Docs: append §2 to `docs/research.md`. Update the `CLAUDE.md` parameters table and architecture, and `README.md`.

## 9. Verification
- `npm test`:
  - importer round-trip (every paragraph identical, in order)
  - Guard rejects invented text
  - autoStage determinism
  - scene grammar and scenes never throw
  - spoiler cutoff for aids
- `npm run build`: `dist/index.html` works from `file://`. Its size is checked, and optional modules load only when used.
- Playwright (phone 390px and desktop): import the sample, scroll through, and check each of these:
  - scenes animate at beats
  - cards appear on first mention
  - the sitting stop card appears
  - Focus and Listen modes work
  - reduced-motion disables motion
  - screenshots at several scroll positions, since `t` is position-driven
- Manual: import the author's real .pdf, .docx and .epub and compare paragraph counts. Read one full sitting on a phone in each preset.
