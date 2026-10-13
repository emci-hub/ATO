# The Story — review (STORY_COPY_REVIEWED = false, STORY_BANK_COPY_REVIEWED = false)

Draft. emci 2026-10-13 redesign, not yet read as shippable copy. The app shows **no draft badge** on Story (same rule as 2026-10-08). Nothing here is approved until the flags flip.

**What it is:** a ~100-word micro-story on Home, starring the reader, in six beats you swipe (Wrapped-style, no section labels). One AI badge on a model card; bank cards skip it. Optional tap: "The other way it could have gone". Old labelled cards (`scene` / `moment` / `means`) still render until a lazy rewrite on open lands; a failed rewrite keeps the old one.

**The six beats**

| Beat | Field | Words | Job |
|---|---|---|---|
| Cold open | `hook` | 8–18 | Mid-action, one vivid detail |
| Twist | `twist` | 12–30 | It gets worse; exactly one quoted line allowed |
| The move | `move` | 15–35 | What they do (the trait, shown) |
| Punchline | `punchline` | 6–20 | Callback to the hook; laugh in the last 6–8 words |
| Reveal | `reveal` | 6–14 | One flattering trait line ("You're the person who…" allowed here only) |
| Next | `next` | 4–12 | Cliffhanger statement, not a question |
| Title | `title` | 2–5 | Memorable nickname / metaphor (`The Bread Basket Diplomat`) |

Dropped as on-screen blocks: "What they noticed", "What it means for you". Plot B stays behind a tap.

**Voice (looser than the old Story):** exaggerated numbers, one spoken line, unnamed side characters ("the hat guy"), unusual-but-plausible details. No forced hedges ("you might", "on a day like this"). Safety unchanged: no real names/brands, no diagnosis, no trait or category labels, no cruelty.

**Jokes:** comedy craft, not an observation. Specific concrete detail, setup then callback, rule of three with a twist third, escalation, misdirection, understatement. The model writes 2–3 candidate punchlines; the phone reranks. Banned: explaining the joke, puns-for-their-own-sake, stock clichés (walk into a bar, plot twist, living the dream, it is what it is, say less, no cap, spoiler alert, like nothing happened, take a breath, shoulders drop, …).

**Screenshot story (few-shot 1 — match the energy, never the content)**

- **Title:** The Bread Basket Diplomat
- **Hook:** Friday, 8:40. Your table has been staring at the kitchen door like it owes them money.
- **Twist:** The server arrives empty-handed. "So the kitchen lost your slip." Your friend's eye starts to twitch. Someone opens a delivery app under the table.
- **Move:** You slide the bread basket to the middle like a peace treaty, order whatever is fastest plus fries for the hostages, and start a ranking of everyone's worst-ever restaurant disaster.
- **Punchline:** By the time the food lands, nobody wants it. They want round two of the rankings. And more bread.
- **Reveal:** When plans break, you quietly turn the delay into the good part.
- **Next:** Next time: you're first at the cinema. Your friends are not.

**Bank:** 66 hand-written cards in `src/lib/story-bank/stories.json` (11 categories × friends/work/home × high/low). Same validators as a model card. Instant fallback when AI fails / times out / is offline / is over budget; also the first paint while a library card loads (serve first, then upgrade). Device-local seen-id + hook history (last 40 ids / 8 hooks) so a tap does not re-show the same card too soon. Copy unreviewed.

**Motion:** fade + rise per beat. Reduce Motion = a 180 ms cross-fade (never fully static). Motion Full (OS Reduce Motion off) = a springy fade-and-rise; Zen's longer `motionMs` makes that rise extra-dramatic.

**Access:** VoiceOver labels on the title, beat pager (adjustable), Previous/Next beat buttons as a swipe alternative, Plot B, Share, and Built from. Dynamic Type stays on (`allowFontScaling` is not disabled). Share is title + reveal; a failed share sheet does not throw.

**Pins:** `check:story-thread`, `check:story-bank` (in `check:ota-gate`), `LIBRARY_VERSION.story` = `l2` (old library cards stay on `l1` until rewritten). To approve: flip `STORY_COPY_REVIEWED` in `src/lib/sage-story.ts` and `STORY_BANK_COPY_REVIEWED` in `src/lib/story-bank/index.ts` after you have read live cards and the bank.
