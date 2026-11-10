# Research notes (November 2026)

## Demand

- Serialized web fiction is very large. Webnovel has about 400 million readers, mostly on phones. Platforms run on episodes, cliffhangers and a steady release cadence. ([Trends.vc](https://trends.vc/serialized-fiction-apps-cliffhanger-economics-rented-audience-werewolf-formula/))
- Vertical-scroll illustrated reading (webtoons) is a market of about $14B in 2026 and growing. ([abovea.tech](https://abovea.tech/webtoon-statistics-and-trends/))
- Taken together, an episode-based, phone-first, scrolling format matches how people already read.

## What helps and what hurts reading

- **Seductive details:** decorative pictures and animations unrelated to the content reduce recall and add cognitive load. Readers with lower working memory are pulled away the most. Pictures should therefore be small, sit between scenes, and move in step with the story moment. ([Wikipedia summary](https://en.wikipedia.org/wiki/Seductive_details))
- **Eye tracking of multimedia stories:** readers spent as much time or more on photos and video as on text, and only 5 of 30 sessions preferred the text. Visuals win attention, so they must not compete with the words. ([Marino](https://ialjs.org/wp-content/uploads/2017/03/12-Marino-Eye-Tracking_138-150.pdf))
- **"Snow Fall" lessons:** average reading time was about 12 minutes, too short to finish the piece. Critics blamed interruptions, autoplay, and design that signals length. Avoid all of these. ([Slate](https://www.slate.com/articles/technology/technology/2013/08/snow_fall_the_jockey_the_scourge_of_the_new_york_times_bell_and_whistle.html))
- **Scrollytelling study (N=454, 2026):** higher engagement, lower cognitive load and higher willingness to adopt than plain text, with comprehension about the same. ([arXiv](https://arxiv.org/abs/2603.04367))
- **Device 6 and The Sailor's Dream:** shaped text and long swiping can become tiring. Keep navigation simple. ([Emily Short](https://emshort.blog/2014/12/20/device-6-the-sailors-dream-simogo/))

## Visual style

- Dithering and retro-minimalism are rising, not saturated. ([UX Tools](https://uxtools.kit.com/posts/rise-of-a-visual-design-trend-retro-minimalism))
- Glass effects, "motion for its own sake" and AI-looking polish are what creatives say they're tired of in 2026. ([Creative Boom](https://creativeboom.com/insight/10-trends-creatives-are-so-over-in-2026/))
- ASCII art has an active creative-coding scene, for example textmode.js. ([CreativeApplications](https://www.creativeapplications.net/news/textmode-js-library-for-dynamic-ascii-art-text-graphics-with-real-time-rendering/))

**Decision:** dithered is the default. Halftone, ASCII and glass are available as options, and motion is tied to the story.

## Round 2 (November 2026): the evidence behind Nymphaea

The full research tables also live in `docs/roadmap.md` section 2.

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

