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
3. **Pictures.** Place them automatically (few, some, many), stage them with an AI, or change, remove and add them yourself.
   - Automatic placement finds where the story changes scene (TextTiling) and picks vivid paragraphs with even spacing (dynamic programming over TF-IDF keyword scores).
   - **Composed scenes work for any text.** Each passage is read for where it happens (eleven places), when (dawn, day, dusk, night), the sky (rain, snow, fog, storm, wind, cloud), up to four things (a lamp, a boat, a fire, a horse…) and who is there. The setting carries through a chapter, so "She walked on" stays in the rainy street the chapter opened in. The scene is then drawn as a layered, animated picture that every picture style can render. Choose **Drawn scenes** (the hand-drawn library), **Read from the text** (all composed) or **Best fit** (the library where the text names one clearly, composed otherwise). Each composed picture can be edited by place, hour, sky and figures, and **Vary** gives a new layout of the same scene.
   - Captions are always whole words quoted from the text.
   - **Undo** (⌘Z/Ctrl+Z outside the editor, or the Undo button on each message) takes back picture and typography changes.
   - While an AI stages the pictures, a bar shows the seconds so far. **Paint all** shows how many are done.
4. **Look.** Start from an edition (Lamplight, First Edition, Nocturne, Sumi, Zine, Typescript, Field Notes, Drift), then tune:
   - **Layout** (Scroll, Chapters or Pages) is set in the dock under the book. **Print** sets the printed page size.
   - **Colour:** six themes (Lamplight, Nocturne, Vellum, Sumi, Moss, Riso), each light and dark, or following the reader's device.
   - **Type:** nine typeface pairings. Line length is set in characters (55, 66 or 75), so it holds for every face. Choose indented or spaced paragraphs, ragged or justified text, drop cap, raised cap or small-caps openings, chapter numerals and the scene-break ornament.
   - **Pictures in the page:** how many (Few, Some, Many or Every scene), size (up to Full, a plate wider than the text), placement (in the text, a framed plate, in the margin on wide screens, or as a chapter head) and captions.
   - **Page and paper:** line spacing, hyphenation, paper (plain, grain, laid or linen), the cover (picture, type only or minimal) and reading progress (time left, a bar, or none). Chapter openings come in classic, big numeral, minimal or ornament styles.
   - **Light & motion:** off, lamp, candle, focus (the paragraph you're reading stays bright) or dawn (each chapter brightens as you read). Lines can rise, fade or ink in.
   - **Pictures:** Ink, Cut paper, Glow, Ink wash, Engraving, Stipple, Riso, Generative (grown from the passage's own words), Halftone, Dithered, ASCII, Glass, Ornaments or none.
   - **Optional AI** (Pictures tab → AI models). Nothing needs a model. You can connect:
     - a **text model** to stage the pictures: Ollama, LM Studio, any OpenAI-compatible server, or Claude with your own Anthropic API key. Its plan goes through the same Guard, and it can pick drawn scenes or describe composed ones.
     - an **image model** to paint each picture: Stable Diffusion WebUI or Forge on your own computer, or any OpenAI-compatible image API. The prompt is written by rules from the composed scene, the mood and the picture style, and you can edit it per picture. The painting is then inked in your chosen style (Engraving, Dithered, Riso…), so it sits in the book's look. Paintings are kept in this browser (IndexedDB) and embedded in the exported book.
5. **Export.**
   - **HTML book:** one file with the text, pictures, look and reading engine. It works offline.
   - **EPUB:** for e-readers.
   - **Print or PDF:** a typeset page with mirrored margins, folios, and chapters on new pages.
   - **Markdown:** the text itself.

The Studio opens on the **Book panel**: the chapters, each with a dot per picture, and the pictures. The Markdown stays closed until you open it with **Edit the text** (⌘J/Ctrl+J). The rail on the left switches between Book and Text, opens the AI models, and hides the panel to give the book more room.

The centre has four views:
- **Book:** the live book. A thumb index down its fore edge has one tab per chapter, as tall as the chapter is long, and a mark for every picture. Hover a mark to read its caption, click it to go there. Clicking a picture opens an inspector that marks, in the book, the words the picture was read from, with quick Shot, Vary and Shuffle controls.
- **Storyboard:** every picture by chapter, with dashed frames for strong passages that have no picture yet. One click adds one.
- **Story line:** the hour, place, weather, season and mood across the whole text, with the chapters as stations, the pictures as stops, and long stretches without a picture marked.
- **Compare:** the current look beside another edition or palette, both live. **Use this look** applies it, and Undo takes it back.

**⌘K/Ctrl+K** opens a command bar. It finds words in the text, chapters and places, and runs actions, such as adding a picture at every passage set in a harbour, changing the density or the picture style, or exporting. A removed picture stays in the list, struck through, with **Restore**, until you make five more picture edits or change the text.

The Studio itself is jet black, space gray and forest green, dark by default, with a light mode on the colours button.

The middle pane is the real book, live, at desktop, tablet or phone width. Click a paragraph in it to see the choices for it: **Add a picture after this paragraph**, or jump the editor to it. Click a picture to open its card, and as you scroll the book the card of the picture you are reading is marked. The sun and moon button at the top switches the Studio between auto, light and dark. In the workspace (not while typing in a field), Ctrl/⌘+S downloads the book, Ctrl/⌘+E opens the export sheet and Ctrl/⌘+Z undoes. The tab you were on, the device size and which sections are open come back after a reload.

### Pictures tab

Each picture is a small card with its thumbnail, caption and paragraph number. Click one (or press Enter) to open its editor. One card is open at a time. In the editor you can change the scene, edit the caption, adjust a composed scene, **Move** the picture up or down one paragraph, **Use as cover**, show it in the book, or remove it. Moving a picture keeps its caption if it still quotes the text there, and takes a new quote from the paragraph if not. The generator row of a composed scene is built from a list of field descriptors (`GEN_FIELDS` in `src/maker/pictures.ts`), so a new control is one entry.

### Bookshelf

Books are kept in this browser (IndexedDB), several at a time. The landing page lists them with title, date, word count and first picture. Open one to carry on, or delete it (the page asks first). **New book** in the book menu, or opening a file, puts the current book on the shelf and starts a fresh one. The first time you run this version, the single draft the old Studio kept becomes your first book. A painting is removed from storage once no book, draft or undo step uses it. If the browser cannot save, a message says so.

## Put it on GitHub Pages

1. In the repository, go to **Settings → Pages → Build and deployment**.
2. Choose **Deploy from a branch**, select `master`, and select the **/ (root)** folder.
3. Your book is live at `https://sargis-hovsepyan.github.io/nymphaea/`.

The root `index.html` is self-contained, and `.nojekyll` tells Pages to serve it as-is. After you change the code, run `npm run build` and commit the new `index.html`.

### Using a local model with the hosted Studio

The page calls the model straight from the browser, so a model on your own computer works with the GitHub Pages copy. The model server has to allow requests from the page's address:

```bash
# Text: Ollama
ollama pull llama3.2
OLLAMA_ORIGINS=https://sargis-hovsepyan.github.io ollama serve

# Pictures: Stable Diffusion WebUI or Forge
./webui.sh --api --cors-allow-origins=https://sargis-hovsepyan.github.io
```

LM Studio needs "Enable CORS" switched on in its server settings. Chrome may ask once whether the site may reach devices on your local network. API keys and addresses are saved in this browser only and never written into a book. When you connect Claude, the official Anthropic SDK is loaded on demand from jsDelivr (pinned to `@anthropic-ai/sdk@1.8.0`), so the app and the books it exports stay small.

## Pictures

Every picture can be drawn from the text itself, with no AI. Nymphaea reads each passage for where it happens, the hour, the weather, the season, the things in it, who is there and what they are doing. It carries that setting through a chapter, so "She walked on" stays in the rainy street the chapter opened in.

It then lays the scene out like a camera would. A wide shot shows the place with small figures, a nearer shot puts the people on one third of the frame and the light on the other, and a close shot is a still life of the thing the passage dwells on. When two pictures in a row share a place and an hour, the second cuts closer instead of repeating the view. Far land is fainter than near land, things cast shadows away from the light, and the sky takes the colour of the hour inside your theme.

There are 23 places (seven interiors, among them a kitchen, a study, a café and a church, and sixteen outdoor ones from a station to a harbour), 40 things, and figures that stand, walk, run, sit, lie, reach, look up or hold each other. A name that recurs in the book keeps the same silhouette. Words after "no" or "without" do not count, so "there was no moon" is not a moonlit scene. When a passage names nothing visible, the picture is a quiet pattern drawn from its mood instead of an invented room.

In the Pictures tab each composed picture can be changed by place, hour, sky, season, figures, what they are doing, shot and the thing in focus. **Vary** gives a new layout of the place. **Shuffle** keeps the layout and changes the moment.

To look at every place and shot side by side while working on the engine, run `npm run dev` and open `/gallery.html`. That page is not part of the build.

## Change the code

`index.html` at the root is **generated**. Edit `src/`, then rebuild:

```bash
npm install
npm run dev     # live dev server on src/index.html
npm test        # every paragraph survives every import; the Guard; staging; palettes; formats; scenes
npm run build   # typecheck, then write the single-file ./index.html
```

CI (`.github/workflows/ci.yml`) runs on every push and pull request with Node 22: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, then `git diff --exit-code index.html`. If you changed `src/` and forgot to commit the rebuilt `index.html`, CI fails.

## The one rule

**Never change, cut, summarize, merge or reorder the author's words.** The engine only adds things around the text: pictures, captions, spacing, emphasis, typography.
- Every staging plan goes through `guardScenes()` (`src/stage/guard.ts`). A caption must be an exact quote, in whole words, from its paragraph or one of the 6 before it, or it is replaced by one. Composed scene ids are re-encoded and image ids checked, so nothing from a model reaches the page as markup.
- Heuristics never act silently: importers write what they guess into Markdown you can edit, or list it in their report.
- Micro-typography and the editor's colouring are display-only. Copying the page gives back your exact characters.
- `src/seed.ts` is generated from the sample story. Never retype it by hand.

## Files

- `index.html`: the app (built; open this one).
- `src/`: the source. `src/index.html` is the page and `src/main.ts` the entry point, which picks one of three modes: the Studio, an exported book, or the Studio's preview frame.
  - `maker/`: the Studio. `index.ts` wires the parts. `session.ts` holds the shared state. `draft.ts` and `shelf.ts` (with `shelfStore.ts`, `shelfData.ts`) save the book and keep the bookshelf. `undo.ts`, `pictures.ts` (cards), `pictureMove.ts`, `paint.ts`, `staging.ts`, `gc.ts`, `importer.ts`, `textPane.ts`, `design.ts`, `exportSheet.ts`, `pick.ts`, `shortcuts.ts`, `uiState.ts`, plus `editor.ts`, `preview.ts`, `landing.ts`, `ai.ts` (the AI models sheet) and `maker.css`.
  - `import/`: PDF, Word, EPUB and HTML to Markdown.
  - `stage/`: picture placement, the AI staging prompt and the caption guard.
  - `compose/`: composed scenes. `read.ts` reads a scene out of any passage, `layout.ts` places everything with a camera, `places.ts` draws the setting, `things.ts` the 40 things, `figure.ts` the people, `draw.ts` puts it together, `noise.ts` holds the seeded noise and curves, `spec.ts` is the compact `gen:` id (older ids still open).
  - `ai/`: optional models. Settings, text and image adapters, rule-written image prompts and the image store.
  - `design/`: themes, type pairings, editions and the Studio palette.
  - `layout/`, `ui/`: paged spreads, print, and the reader.
  - `vscenes/`, `scenes/`, `renderers/`: the pictures and their styles.
  - `export.ts`, `epub/`: the HTML and EPUB books.
- `tests/`: the guarantees, starting with "every paragraph survives".
- `episodes/`: the story, one Markdown file per episode.
- `docs/roadmap.md`: the platform plan.
- `docs/research.md`: the evidence behind the design.
