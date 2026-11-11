---
name: Nymphaea Studio
description: The workspace that frames a live illustrated book. Jet black room, space gray panels, forest green marks.
colors:
  jet-black: "#0a0a0b"
  space-gray: "#1d1f23"
  raised-gray: "#272a2f"
  rule-gray: "#33373d"
  paper-ink: "#eceef0"
  fog-gray: "#9aa0a8"
  forest-green: "#3f9a6b"
  forest-fill: "#347e58"
  leaf-green: "#7fcfa3"
  pollen-amber: "#e0a645"
  cool-desk: "#cfd2d6"
  cool-panel: "#f3f4f5"
  cool-raised: "#fbfbfc"
  cool-rule: "#c3c7cc"
  night-ink: "#0c0d0e"
  slate-muted: "#50565e"
  deep-forest: "#24603f"
  deep-forest-text: "#1d5a3a"
  dark-pollen: "#9a6200"
  on-fill: "#ffffff"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 560
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 82"
  headline:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 560
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 82"
  title-lg:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 620
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 88"
  title:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  control:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 550
  label:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  mono:
    fontFamily: "Geist Mono, ui-monospace, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
  quote:
    fontFamily: "var(--book-face), Newsreader, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.25
rounded:
  xs: "4px"
  chip: "7px"
  ctl: "9px"
  ctl-top: "11px"
  card: "12px"
  panel: "14px"
  sheet: "18px"
spacing:
  sp-1: "4px"
  sp-2: "8px"
  sp-3: "12px"
  sp-4: "16px"
  sp-5: "24px"
  sp-6: "32px"
components:
  button-primary:
    backgroundColor: "{colors.forest-fill}"
    textColor: "{colors.on-fill}"
    typography: "{typography.control}"
    rounded: "{rounded.ctl}"
    padding: "0 15px"
    height: "40px"
  button-export:
    backgroundColor: "{colors.forest-fill}"
    textColor: "{colors.on-fill}"
    typography: "{typography.control}"
    rounded: "{rounded.ctl-top}"
    padding: "0 16px"
    height: "38px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.paper-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.ctl}"
    padding: "0 15px"
    height: "40px"
  segmented:
    backgroundColor: "{colors.space-gray}"
    textColor: "{colors.fog-gray}"
    rounded: "{rounded.ctl}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.raised-gray}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.chip}"
  view-switch:
    backgroundColor: "{colors.space-gray}"
    textColor: "{colors.fog-gray}"
    typography: "{typography.control}"
    rounded: "{rounded.card}"
    padding: "3px"
  view-switch-active:
    backgroundColor: "{colors.raised-gray}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.ctl}"
    padding: "0 14px"
    height: "34px"
  panel:
    backgroundColor: "{colors.space-gray}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.panel}"
  card:
    backgroundColor: "{colors.raised-gray}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.card}"
    padding: "8px 8px 10px"
  input:
    backgroundColor: "{colors.jet-black}"
    textColor: "{colors.paper-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.ctl}"
    padding: "0 12px"
    height: "40px"
  tag:
    textColor: "{colors.paper-ink}"
    typography: "{typography.label}"
    rounded: "6px"
    padding: "1px 7px"
  command-bar:
    backgroundColor: "{colors.raised-gray}"
    textColor: "{colors.paper-ink}"
    rounded: "16px"
    width: "580px"
  thumb-tab:
    backgroundColor: "{colors.space-gray}"
    textColor: "{colors.fog-gray}"
    typography: "{typography.mono}"
    width: "30px"
  thumb-tab-active:
    backgroundColor: "{colors.forest-fill}"
    textColor: "{colors.on-fill}"
---

# Design System: Nymphaea Studio

## Overview

**Creative North Star: "The Galley Proof"**

The book is a live galley proof laid on a dark table, and every Studio control is a quiet mark around it. The room is jet black, the tools float on it as space gray panels, and forest green appears only where something is marked, active, or ready to ship. The Studio never dresses the words. The book inside the stage (its own themes in `src/styles.css`) is the content this system frames, not part of it.

Density is that of a working tool. Panels hold ruled sections rather than nested boxes, labels are short, and numbers (word counts, paragraph numbers, zoom) speak in Geist Mono so they read as measurement, not prose. Archivo runs slightly condensed across the interface and narrower still in headings. The one serif on screen belongs to the book: captions and quoted lines are always set in the book's own face.

Dark is the default. The light mood is a cool grey room with near white panels and a deeper forest green, built from the same token names so every rule holds in both.

**Key Characteristics:**
- 60/30/10 proportion of jet black room, space gray panels, forest green marks.
- Floating panels with 12 to 14px radii and soft shadows; sections inside are ruled, not boxed.
- Archivo for the interface on a width axis, Geist Mono only for counts.
- Quoted captions in the book face, never in the interface sans.
- Motion is state only, 160 to 200ms on a fast ease out.

## Colors

A near black, tightly neutral palette with a single green voice and an amber reserve for warnings.

### Primary
- **Forest Green** (forest-green): the mark colour. Picture pips on the chapter list, the save dot, the Story line picture stops, range thumbs, the selected border on design tiles, the wash behind an active rail tab and the highlighted picture card.
- **Forest Fill** (forest-fill): forest green mixed 82% with black, used wherever green carries white text. The Export button, primary buttons, the active thumb index tab. In light mode the fill is deep-forest itself.
- **Leaf Green** (leaf-green): the text and icon green on dark surfaces. Active view switch icon, current chapter numeral, the lotus mark, the focus ring, quoted words inside the picture inspector, search match highlights. Light mode swaps to deep-forest for the same jobs.

### Secondary
- **Pollen Amber** (pollen-amber): the second signal, reserved for what needs attention. Typography fix panels, caption validation errors, the strike line on removed pictures, gaps on the Story line, danger buttons, the dawn and dusk bands of the hour strip. Dark-pollen in light mode.

### Neutral
- **Jet Black** (jet-black): the room. Page background behind every panel, input wells, thumbnail grounds. A faint radial lift of space gray at 32% sits at the top centre of the workspace so the room is not dead flat.
- **Space Gray** (space-gray): floating panels, the rail, the dock, the view switch, the command trigger, the sheet surface.
- **Raised Gray** (raised-gray): one step up. Storyboard frames, Story line cards, the picture inspector, popovers, toasts, the command bar, the selected segment.
- **Rule Gray** (rule-gray): hairlines and card borders. Inside panels most rules are softer still, ink at 7 to 8% over the panel.
- **Paper Ink** (paper-ink): primary text on dark.
- **Fog Gray** (fog-gray): secondary text, inactive controls, counts, keys.
- **Light mode set**: cool-desk room, cool-panel panels, cool-raised cards, cool-rule hairlines, night-ink text, slate-muted secondary text.

### Named Rules
**The Ten Percent Rule.** Green is for marks, the active state and the one primary action. If a screen shows green on anything that is neither marked, selected nor Export, it is wrong.

**The Fill Rule.** White text sits only on forest-fill, never on raw forest-green. Raw green with white text is under 3.5:1 on dark; the fill clears 4.5:1.

**The Same Names Rule.** Every Studio colour is a runtime token (`--desk --panel --raised --rule --ink --muted --accent --accent2 --pollen`) set from `src/design/studio.ts`. New surfaces use the tokens, never literals, so light and dark both hold.

## Typography

**Display Font:** Archivo (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Archivo, at font-stretch 96%
**Label/Mono Font:** Geist Mono (with ui-monospace, Menlo)
**Quote Font:** the book's own face (`--book-face`, Newsreader, Georgia)

**Character:** A grotesque that narrows as it rises. Body sits just under normal width; headings tighten to 88% or the 82 width axis, which keeps titles compact beside a book that owns all the expressive type.

### Hierarchy
- **Display** (560, 32px, 1.1, width 82): the drop veil and type specimen glyphs. Rare.
- **Headline** (560, 24px, width 82): sheet titles and the empty landing line.
- **Title Large** (620, 17px, width 88): Storyboard chapter group headings.
- **Title** (650, 15px): panel headings such as Chapters, Pictures, Edition, the book title in the top bar at 15.5px and 620.
- **Body** (400, 14px): panel prose, inspector descriptions at 13px and line height 1.4.
- **Control** (550, 13px, stretch 92 to 94%): buttons, segments, the view switch.
- **Label** (400, 12px): field labels and hints in fog gray; rail labels drop to 11px at 85% stretch.
- **Mono** (400, 11 to 12px): word and picture counts, paragraph numbers, zoom percent, keyboard keys.
- **Quote** (400, 15 to 15.5px, 1.25): picture captions and quoted lines, in typographic quotes on Storyboard.

### Named Rules
**The Mono Counts Rule.** Geist Mono is for numbers and keys only. Never set a sentence or a label in it.

**The Book Face Rule.** Any line quoted from the text is shown in the book's face. Interface copy is never set in a serif.

## Layout

The workspace is a three row frame. A 64px top bar (56px on phones) is a three column grid: identity left (lotus button, title, mono slug of counts and save state), the view switch centred, then the command trigger, undo, mode, menu and Export right. Below it the body grid runs a 64px rail, a 300 to 330px left panel, the stage, and a 290 to 320px design inspector, with 12px gaps and 12px outer padding so every panel floats on the room.

The stage holds the book iframe with a 40px right gutter for the thumb index and a floating dock under it for device, layout and zoom. Storyboard is an auto fill grid of 210px minimum frames with 14px gaps; Story line is a stack of cards; Compare is two equal columns.

Spacing runs on a 4px base (4, 8, 12, 16, 24, 32). Panels pad 14 to 16px horizontally. Breakpoints: below 1279px the command trigger loses its text; below 1199px the inspector replaces the left panel and view labels collapse to icons; below 759px the rail, thumb index, inspector and zoom go away, panels lose their radius and shadow and fill the screen, and Compare becomes a snap scrolling carousel at 88% column width.

## Elevation & Depth

Depth is tonal first and shadowed second. The room is the darkest plane, panels one step up, cards and popovers one more. Two shadow tokens carry the rest. Float sits under every panel at rest with a hairline inner top highlight. Lift is reserved for things above the work: the book iframe, inspector, popovers, toasts, sheets. Sheet backdrops dim to 60% black with a 4px blur.

### Shadow Vocabulary
- **Float** (`0 1px 0 ink 5% inset, 0 12px 32px -14px rgba(0,0,0,.65)`): panels, rail, dock, view switch, thumb tabs.
- **Lift** (`0 2px 6px rgba(0,0,0,.18), 0 28px 64px -18px rgba(0,0,0,.7)`): the book stage, picture inspector, popovers, toasts, sheets.
- **Card** (`0 1px 2px rgba(0,0,0,.18), 0 10px 24px -14px rgba(0,0,0,.5)`): Storyboard frames and Story line cards.
- **Export glow** (`0 6px 18px -8px` forest green at 70%): the Export button only.

Light mode keeps the same names with gentler values (see the sidecar).

### Named Rules
**The Float, Not Box Rule.** Panels float on the room by shadow and tone with no border. Inside a panel, divide with a hairline rule at ink 7 to 8%; do not nest bordered boxes.

## Shapes

Soft rectangles throughout, with radius stepping down as elements nest: sheets 18px, panels 14px, the dock 13px, cards and the book stage 12px, top bar controls 11px, controls 9px, segments and chips 7px, tags 5 to 6px, small badges 4px. The thumb index is the one asymmetric form: tabs square on the book side and rounded 8px on the fore edge, like cut index tabs. Icons are 1.6 to 1.8px stroked line drawings with round joins, never filled glyphs. Suggested or empty items use a dashed outline in place of a solid one.

## Components

### Buttons
Compact, flat, and calm until primary.
- **Shape:** gently rounded (9px), 40px tall in panels, 34px in cards.
- **Primary:** forest-fill with white text at weight 550; hover mixes 12% white into the fill.
- **Export:** the one primary action in the top bar, 38px tall, 11px radius, with the green glow.
- **Secondary:** transparent with a rule gray hairline; hover lifts the border to fog gray. Quiet variant drops the border and shows an ink 7% wash on hover.
- **Press:** scale 0.97. **Focus:** 2px leaf-green outline at 2px offset.

### Segmented controls
- **Style:** an ink 6% well, 9px radius, 3px inset. The selected segment becomes raised gray with a rule hairline and a small shadow, ink text. Unselected segments are fog gray and wash on hover.

### View switch
- **Style:** a space gray pill of four 34px buttons (Book, Storyboard, Story line, Compare) with stroked icons. The active view is raised gray with a leaf green icon. Labels hide below 1199px.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** raised gray on the room; picture cards in the left panel sit transparent and only take a green wash with a green inset ring when they are the picture in view.
- **Shadow Strategy:** Card shadow at rest. On hover in Storyboard the frame rises 3px and scales to 1.025 while siblings fade to 50%.
- **Border:** 1px rule gray; suggested frames use a 1.5px dashed green border and a hatched thumbnail.
- **Internal Padding:** 8px for frames, 16 to 18px for Story line cards.

### Inputs / Fields
- **Style:** jet black well, 1px rule hairline, 9px radius, 40px tall.
- **Focus:** border turns forest green; the Markdown editor also gains a 3px green halo at 18%.
- **Error:** pollen amber border with an amber message underneath.

### Navigation
- **Rail:** 64px column of 50 by 54px stacked icon and label buttons at 11px. The active tab is a green wash with leaf green content.
- **Command bar:** a 580px raised dialog with a 54px search row whose bottom edge turns green on focus, grouped results, the selected row in green at 20% with a green inset ring, and mono hints on the right.

### Thumb Index
The signature component. A 30px column of tabs on the book's fore edge, one per chapter, with chapter numerals in mono. Tabs sit tucked 8px into the book, slide out 5px on hover, and the chapter in view extends fully in forest-fill. Each picture is a 4px leaf green bar inside its tab; hovering or focusing it grows the bar and shows the quoted line in the book face in a raised tooltip. Transitions are 160 to 200ms and switch off under reduced motion.

### Story Line
A horizontal timeline per chapter. Bands of segments (hour, sky, mood, place, season) tinted as forest green or pollen mixed into the panel, a 6px track, round stations ringed in fog gray, green picture stops with square heads, dashed green for suggestions and a dashed amber gap marker where a passage has no picture.

## Do's and Don'ts

### Do:
- **Do** keep the 60/30/10 proportion of jet black, space gray and forest green on every screen.
- **Do** use forest-fill, not raw forest green, under any white text.
- **Do** set counts, paragraph numbers and keys in Geist Mono at 11 to 12px.
- **Do** show any quoted line from the book in the book face.
- **Do** float panels with the Float shadow and divide their insides with hairline rules.
- **Do** keep motion to state changes at 160 to 200ms on `cubic-bezier(.16,1,.3,1)`, with a reduced motion fallback.
- **Do** ship every new surface in both moods through the shared tokens.

### Don't:
- **Don't** use green as decoration, a second accent, or a background for anything that is not marked, active or the primary action.
- **Don't** add a second primary button beside Export.
- **Don't** let any Studio surface overlap, recolour or restyle the book's words.
- **Don't** nest bordered boxes inside a floating panel.
- **Don't** use pollen amber for anything but warnings, gaps, removals and the dawn and dusk hours.
- **Don't** return to a blue or lavender tinted room; the neutrals stay within a few points of chroma.
