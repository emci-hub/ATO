# The Story — review (STORY_COPY_REVIEWED = false, STORY_BANK_COPY_REVIEWED = false)

Draft. emci 2026-10-13 v3 templates, not yet read as shippable copy. The app shows **no draft badge** on Story (same rule as 2026-10-08). Nothing here is approved until the flags flip.

**What it is:** a ~100-word script-style micro-story on Home, starring the reader. Six swipe cards (📍 setting + hook, twist, move, punchline, next + italic reveal, Why this is you). Templates are primary. Optional tap: "The other way it could have gone". Specs: `docs/story/`.

**v3 beats**

| Card | Beat | Job |
|---|---|---|
| 1 | hook | 📍 setting + cold open, one sentence per line |
| 2 | twist | turn + 2–3 dialogue lines + dark joke |
| 3 | move | the trait, shown; light joke |
| 4 | punchline | callback, setups paid |
| 5 | next + reveal | "Next:" then italic reveal (≤15 words) |
| 6 | Why this is you | catalog `categoryName`, leanPhrase, optional score, Proof, Tip/Watch out |

Dropped as on-screen blocks: "What they noticed", "What it means for you", the v2 recap card. Plot B stays behind a tap.

**Screenshot story (approved sample 2)**

- **Title:** Captain Table for Three
- **Setting:** Café. 7:02 PM. Friday.
- **Card 1:** You're meeting your date for the first time. / Someone by the window looks like your date's photos. / You wave, and they wave back.
- **Card 3:** You pull up a third chair. / You introduce your date and Rory like you planned it. / Then you launch a search party for Rory's date, with croissants.
- **Card 6:** This is your Everyday social energy: people charge you up, even strangers. Proof: you turned a wrong-table mix-up into a table for three.
- **Other way:** The other way, you'd have hidden behind the menu until Rory left.

**Templates:** 14 star topics in `src/lib/story-v3/topics.ts` (2 per occasion group) plus the home object-revolt grammar for Agency / Structure / Resilience. Remaining 35 topics: `docs/story/TODO.md`. AI polish (`STORY_AI_POLISH`) is **off**. `LIBRARY_VERSION.story` = `l3`.

**Motion:** fade + rise per beat. Reduce Motion = a 180 ms cross-fade (never fully static). Motion Full = a springy fade-and-rise; Zen's longer `motionMs` makes that rise extra-dramatic.

**Access:** VoiceOver labels on the title, beat pager (adjustable), Previous/Next beat buttons, Plot B, Share, and Built from. Dynamic Type stays on. Share is title + reveal.

**Open:** high/low meaning for map categories `cat_love`, `cat_independence`, `cat_structure` — provisional leanPhrases only (`STORY_MAP_CATEGORY_LEAN_TODO`).

**Pins:** `check:story-templates`, `check:story-clarity`, `check:story-gender`, `check:story-card6`, `check:story-thread`, `check:story-bank` (in `check:ota-gate`). To approve: flip `STORY_COPY_REVIEWED` in `src/lib/sage-story.ts` and `STORY_BANK_COPY_REVIEWED` in `src/lib/story-bank/index.ts` after you have read live cards.
