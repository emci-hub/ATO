# ATO ADDENDUM — Almanac daily engine + seasons (2026-10-27)

**For Claude Code. Read this whole file once. Do NOT build yet.**

The main build (docs/ATO-BUILD.md) is mid-flight (PHASE-10 in progress). This addendum is a NEW feature set designed outside the repo, so its baseline may be stale or wrong. You know the code better: treat everything below as intent + guidance, not gospel. Change approach, file names, phase splits or order wherever the real code says so.

## Step 1 — Red team (Opus, no code edits)
Audit this addendum against the current repo and docs/ATO-BUILD.md + docs/ato-build-progress.md:
- what already exists (Today's Pick 64 Qs + wave82 SQL, daily lines, daily insights, streaks, week card, trait history, milestones), what's stale, what conflicts with phases already done or planned (esp. Home "Today's path", Insights flip cards, Legends, PHASE-15/21/22 art + atlas, PHASE-27 QA);
- gaps and glitches: engine logic/determinism, timezone/date edge cases, hemisphere, movable holidays, ramp/blend math, content volume, Reduce Motion (gentle, never still), perf/atlas size, push limits, privacy, offline, save migration;
- PixelLab art steps: settings, refs, critique gate, scale vs fully grown hero.
Write `docs/almanac-redteam.md` (findings + fixes) and a proposed integration: which phases to add, where they slot after the current phase, deps, model per phase. Stop and wait for emci's OK.

## Step 2 — Merge (after emci OK)
Insert the approved phases into docs/ATO-BUILD.md after the phase currently in progress (renumber as you see fit, e.g. PHASE-10a…), update the §0 checklist and docs/ato-build-progress.md (keep all done ticks), extend PHASE-27 QA. Then continue normally with "Run the next phase".

## Fixed rules (do not change)
- All on the `ato-build` branch. ONE final OTA by emci. No merge, no OTA, no new native deps, don't touch src/play (no pet outfits).
- Opus plans + economy/engine logic; Sonnet builds; never Haiku.
- No new prices or token sources. Seasonal badges/cards = cosmetic, no tokens (approved). Hero outfits free during events, not sold (approved).
- Migrations (Pick 365 SQL, community counter) are written for emci to apply himself.
- Content: Claude drafts, emci ticks cards in a review file, a script loads them. No runtime AI generation.
- PixelLab: no generation caps; critique ≥22/28; Reduce Motion gentle, never still.
- Mockups: docs/mockups/daily-engine/*.png (match these).

---
# Draft phases (guidance — adapt freely)

## PHASE-09a Almanac engine core
Deps: 09 · Model: Opus plans (selection, blend weights, seed design), Sonnet builds
Files: new `src/lib/almanac/{types,seed,select,slots,seen-store,index}.ts` and `src/lib/almanac/__tests__/*`. Read-only: `src/lib/daily-line/*`, `src/lib/daily-pick/bank.ts`, `src/lib/daily-insights/*`, `src/lib/traits.ts`, `src/lib/local-date.ts`, `src/lib/voice/framework-fence.ts`. Never touch src/play.
Steps:
1. **Card type:**
   ```ts
   {id, kind:'pick'|'line'|'try'|'reflect'|'fact'|'contrast'|'week'|'month'|'year'|'callback'|'afterglow'|'teaser',
    axes?, minDataDays?, event?, phase?:'lead'|'build'|'peak'|'fade', arc?, weekday?, text, alt?, weight?, reviewed:boolean, variant?}
   ```
   - The id is a text hash, the same as daily-line.
2. **Seed:**
   - personal: FNV-1a of `userId|ymd|surface`;
   - shared (Pick): `ymd|region` only.
3. **select(surface, ctx):**
   - filter: reviewed, phase/arc/weekday match, minDataDays, not in seen (last 60 per surface);
   - score: +3 strong band, +2 tension pair, +1 axis unseen 7d, then × weight × layer weight (09b);
   - pick: seeded weighted pick from the top 8.
   - The same day always gives the same card. Persist today's pick per surface in AsyncStorage.
4. **Slots:**
   - `{name} {axis} {axisPct} {pairAxis} {pairPct} {peerFrac} {streak} {pickShare} {lastPick} {eventName} {daysInto}`;
   - a missing slot falls back to `alt`, and a card without one is dropped;
   - framework fence + 120-char check after the fill.
5. **API:** `almanac.today(surface)` for `home.path`, `home.hero`, `insights.deck`, `push`, `you.week`, `you.month`, `you.year`.
   - Pure functions only. No network.
6. **Tests:** determinism (same input gives the same output), a 400-day sim with no repeat inside the bank size, and slot-fill fallbacks.
Accept: the tests are green. `check:almanac` is added to `npm run check`. No new deps.

## PHASE-09b Seasons, events, ramp + off-season arcs
Deps: 09a · Model: Opus plans (calendar rules, ramp curves, priority/blend weights — balance work), Sonnet builds
Files: new `src/lib/almanac/{events,calendar,ramp,arcs,locale}.ts` and their tests.
Steps:
1. **Event rules** (`calendar.ts`):
   - rule kinds: `fixed`, `nthWeekday`, `easter` (Anonymous Gregorian computus), `table` (Lunar NY, Diwali, Eid al-Fitr, solstices/equinoxes 2026–2035), `personal` (birthday from existing `lib/age.ts` data only; ATO join date), `regionTable` (Mother's Day US/CA/AU 2nd Sun May, UK Mothering Sunday = Easter−21).
   - Events: new_year, lunar_new_year, valentines, easter, mothers_day, fathers_day, exam_season, summer_solstice, summer, back_to_school, thanksgiving_ca, thanksgiving_us, halloween, diwali, eid_al_fitr, winter_solstice, christmas, year_end, birthday, ato_anniversary.
2. **Locale** (`locale.ts`):
   - region comes from the device locale and hemisphere from the IANA timezone, with an override in Settings (09f);
   - `hemisphereFlip` events (summer, back_to_school, exam_season, solstices) move for the south;
   - `cultural:true` events are opt-in outside their default regions.
3. **Ramp** (`ramp.ts`). Each event has `{teaser, lead, build, peak, fade}` in days (defaults: christmas 14/7/5/2/5, halloween 10/5/3/1/3, new_year 5/2/1/1/7, valentines 5/2/1/1/2, lunar_new_year 7/3/2/7/3, personal 3/1/1/1/3). Output `intensity` 0..1 on a smoothstep:
   - teaser 0.1–0.2;
   - lead 0.2–0.4;
   - build 0.4–0.8;
   - peak 1.0;
   - fade 1→0 over N days.
   Drives decor opacity, accent tween, and the share of seasonal content.
4. **Off-season arcs** (`arcs.ts`). These are always on, so Home is never empty:
   - **4 named quarterly seasons**, rotating with the hemisphere: "Season of Sparks" (Jan–Mar, fresh starts/growth_mindset), "Season of Bloom" (Apr–Jun, openness/relatedness), "Season of Tides" (Jul–Sep, steadiness/playfulness), "Season of Embers" (Oct–Dec, agreeableness/reflection). Each has a palette, a backdrop and a constellation tint.
   - **12 monthly themes** (e.g. Jan "Clean slate", Feb "Soft spots", Mar "Curiosity", … Oct "Masks", Nov "Gratitude & boundaries", Dec "Looking back").
   - **Weekly trait theme:** `weekIndex % 16` → one axis, with Picks, try-today and the Sunday recap leaning to it. It never repeats an axis inside 8 weeks.
   - **Micro-events (gap fillers):** at least one every ≤10 days when no event intensity is above 0, chosen from a bank: first snow (by hemisphere/month), full moon (table), Friday 13th, payday Friday (last Fri), daylight saving change (from tz), equinox, the user's 100th Pick, a 30-day streak, half-year (Jul 1), "one year ago today" callback. Intensity is at most 0.4 and they last 1 day.
5. **Layer blend** (feeds 09a's weight). Layers: base, week, month, season, micro, event, personal.
   - **Path slots:** event intensity ≥0.9 → Pick + line seasonal; ≥0.4 → try slot seasonal; teaser → 1 teaser card in the hero only.
   - **Otherwise:** the week theme sets the try slot and the month theme sets the line 1 day in 3.
   - **Priority:** personal > regional event peak > global peak > event lead/fade > micro > month > season > week > base.
   - **Max one event above 0.4 at once.** The loser drops to teaser.
   - **Afterglow:** on fade day 1, one `afterglow` reflect card ("How did Halloween actually go?"), plus a callback stored for next year.
6. **Sim test:** run 2026-01-01..2028-12-31 for 3 regions × 2 hemispheres. Assert that every day has a hero theme (season ≥ base), that ramps never jump by more than 0.35 per day, and that there are no two overlapping peaks. Golden dates: Easter 2027-03-28, Lunar NY 2027-02-06, CA Thanksgiving 2026-10-12.
Accept: the sim and golden tests are green, and the ramp/arc table is printed to `docs/almanac-calendar.md`.

## PHASE-09c Almanac content pipeline + bank drafts
Deps: 09a, 09b · Model: Sonnet (Opus reviews voice/balance only)
Files: new `docs/almanac-review.md`, `scripts/load-almanac.ts`, `scripts/almanac-check.ts`, `src/lib/almanac/bank.generated.ts`, `package.json` (script lines only).
Steps:
1. Draft into `docs/almanac-review.md` as checkbox lines, grouped by kind/event/arc, using the moment voice (no "you are", no framework terms, ≤120 chars). Quantities:
   - Picks: about 300 more base Picks (taking the bank to 365);
   - Event cards: about 540 (per event: 3 peak Picks as yearly variants, 8 lead/build, 2 afterglow, 2 callbacks, 5 deck cards, 2 push);
   - Arc cards: about 200 (4 seasons × 10, 12 months × 8, 16 weekly themes × 4);
   - Micro-events: about 60;
   - Base cards: about 380 try-today and about 120 reflect;
   - Recap: 60 week, month and year templates, plus 32 year archetypes (16 axes × high/low names).
2. **Gentle mode** for Mother's/Father's Day, Valentine's and Christmas. Never assume family, a partner or faith, and give every Pick an "it's just a day for me" style option.
3. **`load:almanac`** turns ticked lines into `bank.generated.ts`. **`check:almanac-bank`** checks length, slots, coverage (≥15 cards per band, every event has every phase, every arc has a card) and duplicates.
4. ⚑ **copy OK:** emci ticks the cards in `docs/almanac-review.md`. Set `Blocked on: ⚑ almanac copy`. Code phases that don't need the final bank continue on the drafts.
Accept: the loader and checks are green, and only ticked cards ship (`reviewed:true`).

## PHASE-09d Pick 365 + community counter (server)
Deps: 09c · Model: Opus plans (migration + RLS), Sonnet builds
Files: `src/lib/daily-pick/bank.ts` (append only; ids stay forever), `scripts/gen-wave82-picks.ts`, new `supabase/migrations/wave116_almanac.sql`.
Steps:
1. **Extend `DAILY_PICKS` to 365.**
   - The rotation keeps "no same trait two days running".
   - Seasonal Picks use ids `ev-<event>-<v>`, outside the rotation; peak days override.
   - Regenerate the wave82-compatible SQL.
2. **wave116:**
   - add the new pick rows;
   - `almanac_event_progress(event_id, year)`: a view or RPC that counts Pick answers in the event window. Aggregate only, with no per-user exposure.
3. ⚑ **emci applies wave116 himself.** Set `Blocked on: ⚑ wave116`. The client hides the community bar until the RPC exists.
Accept: the server/client rotation parity test is green, and the community counter returns totals only.

## PHASE-09e Almanac surfaces: Home, Insights, You
Deps: 09a, 09b, 09c, 08, 09 · Model: Sonnet
Files: `src/components/almanac/{today-path,pick-result,deck-card,week-recap,month-shift,year-recap,afterglow-card,teaser-card,community-goal}.tsx`, plus small hooks into Home, Insights and You screens.
Steps:
1. **Home "Today's path":** Pick → your line → try-today.
   - The streak counts any 1 action, with 1 free weekly repair. No token cost, and it reuses the existing check-in award only.
   - Teaser card in the hero when event intensity is 0.1–0.4.
2. **Pick result:** community % bar, "you're in the N%", and a "people like you" bar (only if the band count is ≥ 50).
3. **Insights deck:** a flip card from `almanac.today('insights.deck')`, a "34/128 found" count, and per-event decks ("Halloween 3/5").
   - Missed cards return next year.
   - Cosmetic only, no tokens. **emci-approved 2026-10-27.**
4. **You:**
   - the Sunday "Your week in you" recap;
   - the monthly "What shifted" (trait-history delta mini chart in react-native-svg, plus a then-and-now callback);
   - "Your year in you" (8 swipe cards, opening Dec 1, gated by date; share card via the existing share-codec/story-card).
5. **Seasonal badges** reuse `lib/badges.ts`. Cosmetic, no tokens, **emci-approved 2026-10-27.**
6. **Community goal card:** shown on event peak/build days if the wave116 RPC exists.
7. **Reduce Motion is gentle, never still:** flips become crossfades, and bars fill at 0.5 speed.
Accept: screenshots match `docs/mockups/daily-engine/*.png` (copy them from the mockups folder), with no empty states, and `check:*` green.

## PHASE-09f Seasonal settings + one daily push
Deps: 09e, 01 · Model: Sonnet
Files: the Settings screen (from PHASE-01), `src/lib/push-copy.ts`, `src/lib/push-policy.ts`, `src/components/notification-prefs-fold.tsx`.
Steps:
1. **Settings "Seasonal content" fold:**
   - a master toggle;
   - a hemisphere override;
   - a per-event toggle for `cultural:true` events;
   - "Use my birthday" (only if a birthdate exists).
2. **Push:** at most one a day, opt-in, with copy from `almanac.today('push')`. It never stacks with existing pushes; the push policy picks one.
Accept: toggles persist, and with seasonal off, only arcs and base cards show.

## PHASE-09g Art 3: Almanac style, decor, backdrops (PixelLab)
Deps: 15 · Model: Sonnet + PixelLab MCP · Art policy: §1.9 quality-first (no limits; log credits).
Files: `art-src/almanac/**` only (sources, `params.json`, `critique.md`, `palette-*.png`, `refs/`, `STYLE.md`). No app code. Mini red-team first (§0.12).
Shared settings (every call):
- view `side`, matching the Home hero card and the Quests style;
- outline `single color black outline`;
- shading `basic shading`;
- detail `medium detail`;
- `text_guidance_scale` 8;
- negative_description "blurry, anti-aliased, gradient, text, watermark, perspective distortion";
- `color_image` = the season or event swatch with `force_colors:true` where offered;
- style_images = 5–8 approved PHASE-15 assets plus the repo hero south frames, `/unzoom`ed if ever upscaled.
Native sizes only.
Steps:
1. **Style card:** copy the quests STYLE.md rules into `art-src/almanac/STYLE.md`.
   - Add one palette swatch per season (4) and per event (14), each 8–12 colors, sharing the 4 UI neutrals.
   - Make 1 test plate (Christmas hero backdrop), critique it, and freeze the card.
2. **Home hero backdrops** (195×120, which renders at ×2 into the 394-wide hero card). Use `generate-with-style-v2`: greybox init strength 350 → refine 600, seed 7101+n.
   - 4 named seasons: Sparks = "frosty dawn meadow, first light, sparse pines, side view"; Bloom = "spring hill, blossoms, soft sky"; Tides = "summer shoreline at dusk, calm waves"; Embers = "autumn forest edge at night, warm glow, falling leaves".
   - 12 events: Christmas snowy village night, Halloween pumpkin patch with moon, New Year rooftop fireworks, Valentine's rose garden, Lunar NY lantern street, Easter spring meadow, Mother's/Father's Day sunny park, exam season library window, summer beach, back-to-school schoolyard, Thanksgiving harvest table field, Diwali diya-lit courtyard, Eid crescent night courtyard, solstices sun or snow horizon.
   - Each backdrop is 2 layers: far (opaque) and mid (`no_background:true`, init = far crop, strength 450), so the decor overlay sits between them.
   - Leave a clear ground line at the bottom 16 px for the hero.
3. **Decor overlays** (transparent, layered over any backdrop). Use `create-map-object` for single props (view side), or `generate-with-style-v2` with `no_background` for scatter sheets. Seed 7201+n.
   - Static props: wreath 24×24, stocking 16×24, pumpkin S/M/L 16/24/32, ghost 24×24, bat 16×12, heart 12×12, rose 16×16, lantern 12×20, red envelope 12×16, firework-burst 32×32, diya 12×12, crescent 16×16, egg ×3 12×14, apple and books 16×16, beach ball 16×16, leaf ×3 8×8, snowflake ×3 6×6, petal ×3 6×6, star 8×8.
   - Garlands (horizontally tileable 64×12): fairy lights, paper chain, bunting, leaf garland.
4. **Animated ambient** (`animate-with-text-v3`, `no_background`, 64px tier):
   - snow fall tile 64×64, 6f at 120 ms, "gentle snowflakes drifting down, loopable", seed 7301;
   - leaf fall 64×64, 6f at 140 ms, seed 7302;
   - petal drift 64×64, 6f at 140 ms, seed 7303;
   - firework burst 32×32, 8f at 80 ms, seed 7304;
   - lantern sway 12×20, 4f at 250 ms, seed 7305;
   - candle/diya flicker 12×12, 4f, uneven 90–140 ms, seed 7306;
   - pumpkin glow 24×24, 4f at 200 ms, seed 7307;
   - heart float 12×12, 4f at 150 ms, seed 7308.
   Reduce Motion variants: frames 1 and 3 only, at quarter speed (picked in code, not separate art).
5. **Lead-in/fade states:** for each event backdrop, a "teaser" variant is not generated. The ramp is done in code by decor count and opacity (09i). Generate only `edge-sprigs` (one per event: a 48×48 corner decor such as a holly corner or pumpkin corner via `create-map-object`, seed 7401+n) used at intensity 0.1–0.4 so a lead-in shows a hint, not the full scene.
6. **Micro-event and arc stickers** (24×24 `generate-with-style-v2`, one batch per family, seed 7501): full moon, first snow, Friday 13 black cat, payday coin, DST clock, equinox scales, 100th Pick star, half-year hourglass, and 12 month-theme glyphs.
7. Critique every asset with the pixel-art-critique rubric (≥22/28, no zero items; check camera, scale, palette and technical first).
   - Failing assets get a targeted `inpaint-v3` (mask only the fault), then rescore.
   - After 3 targeted tries, change one param (seed → init strength → style ref set) and repeat. There is no attempt cap; log every fallback.
8. Make contact sheets at 2x (`art-src/almanac/{backdrops,decor,ambient,stickers}-sheet.png`) and log credits per batch.
Accept: every asset is ≥22/28 and `params.json` is complete.
⚑ **art OK:** emci approves the sheets. Set `Blocked on: ⚑ art OK almanac decor`.

## PHASE-09h Art 4: hero outfits, deck art, recap + badge icons (PixelLab)
Deps: 09g · Model: Sonnet + PixelLab MCP · Art policy: §1.9 quality-first (no limits; log credits).
Files: `art-src/almanac/{outfits,deck,recap,badges}/**` only. No app code. **Hero only — NO pet/Hideout outfits (src/play off-limits; emci-decided 2026-10-27). Outfits are free during events and never sold in the Store.**
Steps:
1. **Hero seasonal outfits:** 11 outfits — Santa hat + scarf, pumpkin cape, party hat + confetti sash, heart cardigan, red silk jacket (Lunar NY), flower crown (spring), sunhat + shades (summer), backpack + cap (back-to-school/exam), warm knit + mittens (winter solstice), kurta-style festive wrap/lantern (Diwali, opt-in), plus a cozy autumn coat (Embers season).
   - **Heroes:** the 3 main heroes from `HERO_ART` (default `dungeon-druid`, `dragonblood-champion`, `dungeon-witch`) first; the other 7 after approval.
   - **Base:** the cleaned repo south rotation of each hero (same size as the shipped hero frames).
   - **Make each outfit:** `transfer-outfit-v2` (or `edit-image` "add a red Santa hat and green scarf, keep face and body identical") on the south frame, with the same seed per outfit family (7601+outfit), then critique.
   - **Rotations:** `generate-8-rotations-v3` with first_frame = the approved outfitted south frame → 8 directions, with west mirrored from east if it drifts.
   - **Animations:**
     - matching the existing hero set: `animate-character` template idle, 4f at 300/300/400/300 ms, keep_first_frame, seed 7701+n;
     - H-wave (Home greet): `animate-with-text-v3`, 4f at 150 ms, "hero waves one hand, small smile", seed 7711+n;
     - only the south and east directions are animated (the Home card uses those).
   - **Identity check:** copy the clean head across frames, and do a scale check against the fully grown hero (the outfit adds ≤2 px height except hats).
2. **Insight deck art:** 128 base cards plus 5 per event.
   - Card emblem 48×48 via `generate-with-style-v2`, one batch per axis (16 batches × 8, seed 7801+axis) and per event (seed 7901+event), e.g. "compass with browser tabs", "costume mask", "quiet battery icon". no_background.
   - Card frame 9-slice: `create-ui-asset`, 3 rarities (base, seasonal, rare), cyan / event-accent / gold.
3. **Recap frames:**
   - week, month and year story backgrounds at 195×420 (`generate-with-style-v2`, seed 8001–8003);
   - the year archetype crest 64×64 ×32 (16 axes × high/low, seed 8101+n);
   - the share-card frame 195×346.
4. **Collection and badge icons** (32×32, `generate-with-style-v2`, low detail, seed 8201+n): one badge per event (14), 4 season badges, streak repair snowflake 16×16, community-goal lantern-sky tile 32×32 (lit and unlit).
5. Critique (≥22/28), with the same retry rules as 09g; contact sheets; credits logged.
Accept: every asset is ≥22/28, and 8 rotations + idle + wave exist for every main hero × outfit.
⚑ **art OK:** emci approves the sheets.

## PHASE-09i Almanac atlas + theming integration
Deps: 09e, 09g, 09h, 22 (reuse the atlas builder) · Model: Sonnet
Files: `scripts/build-almanac-atlas.ts` (or extend `build-quest-atlas.ts` with an `almanac` target), `assets/almanac/*`, `src/lib/almanac/art-keys.ts`, `src/components/almanac/{season-hero,decor-layer,edge-sprigs,outfit-hero}.tsx`, theme tokens.
Steps:
1. **Atlases:** pack the approved PNGs into `almanac-seasons`, `almanac-events-a` (Christmas → Easter), `almanac-events-b`, `almanac-outfits`, and `almanac-ui` (deck, badges, recap).
   - ≤2048² each, ×2 nearest-neighbour, JSON rects, and `art-keys.ts` generated.
   - Outfits load lazily by the current event only.
2. **Hero theming:** `season-hero` draws backdrop far → decor-layer → mid → hero (with the outfit only while event intensity ≥0.4) → edge-sprigs.
   - **Decor:** the decor count is `round(maxDecor × intensity)`, and opacity tweens 300 ms on change.
   - **Fade:** the accent color lerps between the season and event palette by intensity (pure JS color lerp in theme tokens, no new deps). It fades out back to the season palette over the fade days.
3. **Arc theming:** the season backdrop is always present; a micro-event shows one sticker on the hero for its day.
4. **Reduce Motion is gentle, never still:** half the particles, quarter speed, frames 1/3 only.
5. **`check:almanac-atlas`** checks:
   - every art key in the bank/calendar exists;
   - ≤5 MB total;
   - there are no unused PNGs.
Accept: the atlas check and ota-gate are green. Screenshots: an off-season Home (Embers), a Christmas lead-in (0.3), a peak, and a fade day 3, matching `docs/mockups/daily-engine/`.


---
# Background design (from ato-daily-engine-plan.md)
# ATO Daily Engine plan: what changes every day, with no AI at runtime
Repo read at 87592b19 (read-only clone). Rules: no new native deps, no src/play changes, and any new reward, price or token source is flagged ⚑ for emci. This all ships in the single `ato-build` release, with no extra OTA.

## 1. What ATO already has (more than you might think)
| Daily thing | Where | Rotation | Gap |
|---|---|---|---|
| Today's Pick: one either/or question, the same for everyone, with community % | lib/daily-pick (66 picks, wave82 server) | `day % 64`, never the same trait two days running | **Repeats every 64 days.** Users notice after about 2 months. |
| Daily line: 340 approved lines (16 axes × high/low, plus pairs and starters) | lib/daily-line | picker plus seen-history, plus an AI pool | Good depth. Only shown when Pick is absent. |
| Daily insights: superpower, conflict style, "try today", with a streak | lib/daily-insights (+streak.ts, 60-date cap) | rules.ts | Small banks |
| Today slot: missed check, note, ask, Sunday week | lib/today-slot.ts | fixed priority | Only Sunday changes on its own |
| Your week card, week strip, trait history and checkpoints, milestones, badges | components/your-week-card, lib/trait-history* | weekly | No "what moved" story |
| Push copy and policy | lib/push-*.ts | — | Not tied to the day's content |
| Planned: "Today's path" checklist (PH-08), Insights flip cards (PH-09), Store Daily card, Quests | ATO-BUILD.md | — | Needs a content source per day |

**Per-user data an engine can key off:** 16 trait axes (value plus band, stability and history), Pick answers, check-ins, notes, Legends figure, Quests traits (later), local date and timezone, and streak state.

**Diagnosis:** The mechanics already exist: a daily ritual, a streak, social %, and a weekly recap. What's missing is (a) **content depth** (Pick loops at 64 days), (b) **one engine** shared by all the daily surfaces instead of five separate pickers, and (c) **payoff loops**, where your answers add up into something you collect or discover about yourself.

## 2. What works elsewhere (no AI needed)
- Co-Star sends one daily "Day at a Glance" push, short and sharp, and people screenshot and share it. One notification a day, never more. https://recordings.designmatters.io/how-the-design-of-the-astrology-app-co-star-is-conquering-the-masses/ , https://www.theverge.com/2019/10/4/20879631/co-star-astrology-app-zodiac-signs
- Duolingo: users with a 7-day streak are 2.4× more likely to come back the next day. Making the streak easier to keep (one action, separate from the daily goal) raised D14 retention by 3.3% and grew 7+ day streaks by 40%. https://blog.duolingo.com/improving-the-streak/
- Research shows a streak drives behaviour when it's intact. Breaks hurt less when users can repair them (a "freeze"). https://academic.oup.com/jcr/article-abstract/49/6/1095/6572333
- Wordle: one shared puzzle a day, the same for everyone, plus a result card that's easy to share. ATO's Pick already follows this model. https://en.wikipedia.org/wiki/Wordle
- Daylio, Finch and Headspace: a tiny daily check-in, then weekly and monthly reports built from the check-ins ("your best days were…"). Finch adds collectibles and gentle seasonal events.
- 16Personalities and The Pattern: deep, evergreen write-ups unlocked bit by bit, so you keep finding something new about yourself.

## 3. The engine ("Almanac")
One pure TS module, `src/lib/almanac/`, with no network and no native deps. Content is bundled JSON/TS and ships in the single OTA.

### 3.1 Content schema
```ts
type Card = {
  id: string;              // hash of text, like daily-line
  kind: 'pick'|'line'|'try'|'reflect'|'fact'|'contrast'|'week'|'season';
  axes?: `${TraitAxis}:${'high'|'low'|'mid'}`[];  // targeting
  minDataDays?: number;    // e.g. needs 7 check-ins
  season?: string;         // 'halloween','newyear', date window
  weekday?: number[];      // e.g. reflect on Sun
  text: string;            // slots: {name} {topTrait} {axisPct:openness} {streak} {pickShare} {legend}
  alt?: string;            // fallback if slots unavailable
  weight?: number; reviewed: boolean;
};
```

### 3.2 Selection, deterministic per user per day
1. `seed = hash(userId + ymd + surface)`. Everyone gets their own card. `kind:'pick'` uses `hash(ymd)` only, so the whole community gets the same question.
2. Filter: reviewed, the season or weekday matches, `minDataDays` is met, and the card isn't in the last-N seen set (a local seen-set, the same as daily-line).
3. Score: axis match to the user's strong bands (+3), a tension pair (+2), an axis untouched for a while (+1, so variety), weight.
4. Pick with seeded weighted random over the top K=8. The same day always gives the same card, even after reopening, and no server is needed.
5. Fill slots from the user's own data. If a slot is missing, use `alt`. Run the framework fence and length checks (reuse voice/framework-fence).
6. Surfaces call `almanac.today(surface)`. Home "Today's path", Insights flip card, push copy and the Sunday report all use the same engine.

### 3.3 How much content for 1 year with no repeats
- Pick (shared): 365. You have 64, so write about 300 more (about 19 per axis). **Biggest single fix.**
- Personal line: each user is in about 6 strong bands. At 1 a day with no repeat for 90 days, that needs 15+ per band. You have 340, so roughly fine. Add about 100 pair and tension lines.
- Try-today / micro-experiment: 16 axes × 2 sides × 12 = about 380.
- Reflect prompt (journal one-liner): 120, which loops every 4 months. That's OK, because answers differ.
- Weekly report templates: about 40 variants. Season packs: 6 a year × 15 cards.
- **Total new authoring: about 1,000 short cards.** Workflow: Claude Code drafts them into `docs/almanac-review.md` with the existing voice rules, emci ticks them, and `npm run load:almanac` generates the bank (the same pipeline as daily-line). A validator script enforces length, slots, axis coverage and duplicates.

### 3.4 Supabase
- Only Pick community % needs the server, and that already exists in wave82. Extending it to 365 picks means regenerating the wave82 SQL (⚑ emci applies the migration).
- Everything else stays local (AsyncStorage seen-sets). Optional later: an aggregate "people like you" % by band, as one view over the existing answers.

## 4. Ranked features
| # | Feature | Where | Impact | Effort | Slots into |
|---|---|---|---|---|---|
| 1 | **Pick to 365 plus a "you vs everyone" result line** ("62% chose coffee alone. You're in the 38%.") | Home | High | S–M (copy plus SQL regen ⚑) | PH-08 Home |
| 2 | **Almanac engine plus "Today's path"** (Pick → your line → one try-today, 3 ticks) | Home | High | M | PH-08 (new lib first, like PH-12) |
| 3 | **Sunday "Your week in you" report**: which axes your picks leaned, streak, one surprise | Home Sun / You | High | M | PH-08 / PH-02 You card |
| 4 | **Streak freeze/repair** (one free repair a week). Streak counts any one action. | Home | Med-High | S | PH-08 ⚑ only if it costs tokens |
| 5 | **One daily push = today's line** (Co-Star style, opt-in, one a day max) | notifications | High | S | PH-08/26, uses push-copy |
| 6 | **Insight deck collection**: each day flips one new card, "34/128 found" per axis | Insights | Med-High | M | PH-09 flip cards |
| 7 | **Legend of the day**: your figure plus one "they'd have picked…" fact tied to today's Pick | Legends | Med | S | PH-10 |
| 8 | **Monthly "what shifted"** (trait-history delta, plus a "you said X on day 3, Y today" callback) | You | Med | M | PH-02/05 |
| 9 | **Seasonal packs** (Halloween, New Year, exam season) via `season` tag | all | Med | S per pack | after PH-27, content only |
| 10 | **Quest of the week** rotation (featured campaign + 1 daily scene teaser) | Home/More | Med | S once Quests ship | PH-23 |

⚑ Flags for emci: no new token sources are proposed. Path reuses the existing check-in award (already in ATO-BUILD §1). A streak repair that costs tokens, or any Store Daily tie-in, needs emci's OK. Extending Pick means a wave82 SQL regen that emci applies himself.

## 5. Suggested ATO-BUILD.md insertion
Add **PHASE-08a Almanac engine + content validator** (new files only, can run in parallel after PHASE-00, Sonnet). PHASE-08 Home then renders Today's path from it, PHASE-09 adds the deck count, and the content batches (Pick 365, try-today, reflect) go into one copy-review phase ⚑ copy OK before PHASE-27. Still one branch and one OTA.

---
## 6. Seasonal and event layer ("Almanac Seasons")
Goal: content that targets real moments in the year and comes back every year, so a 2-year user gets "last Christmas you…" instead of a stale repeat. It stays bundled and deterministic, ships in the one OTA, uses no AI and adds no new token sources.

### 6.1 How others do it
- **Finch** runs monthly seasonal events with a themed banner, daily progress, themed clothes and furniture, an exclusive micropet, and a grace period to claim. Users can **turn events off in settings**. https://help.finchcare.com/hc/en-us/articles/37780438941965-Seasonal-Event-Overview
- **Pokémon GO** runs about 3-month named Seasons plus monthly Community Days. Each has a clear start and end at local time. https://www.pokemon.com/us/news/take-a-hike-with-pokemon-gos-new-season-twilight-trails
- **Spotify Wrapped 2025** reached 250M engaged users in 65 hours and 575M shares. Its biggest story was a single invented stat, "Listening Age" (65M shares). https://variety.com/2025/music/news/spotify-wrapped-breaks-own-record-250-million-engagements-1236603493/ , https://www.musicbusinessworldwide.com/spotify-wrapped-campaign-hit-200m-engaged-users-in-24-hours-a-19-yoy-increase/
- **Duolingo Year in Review** uses story-format slides and learner archetypes, ships *before* Wrapped, and leans on roast-y humor. Its community goal stunt ("earn 50B XP to bring Duo back") drove 1.7B impressions. https://wrappeddfy.com/case-studies/duolingo-year-in-review/
- **Animal Crossing** asks for your hemisphere once, then seasons and events follow it. That's the model for south-hemisphere users here (general knowledge, no source cited).
- Co-Star, Wordle and NYT keep the daily ritual the same during holidays and only change the *content* and a light skin. Nobody rebuilds the UI per event.

### 6.2 Event calendar schema
```ts
type AlmanacEvent = {
  id: 'christmas'|'new_year'|'valentines'|'halloween'|'lunar_new_year'|'easter'|'mothers_day'|'fathers_day'|'back_to_school'|'exam_season'|'summer'|'winter_solstice'|'summer_solstice'|'thanksgiving_ca'|'thanksgiving_us'|'diwali'|'eid_al_fitr'|'birthday'|'ato_anniversary'|...;
  date:
    | { kind:'fixed'; month:number; day:number }                 // Dec 25, Oct 31, Feb 14
    | { kind:'nthWeekday'; month:number; weekday:number; n:number } // 2nd Sun May (US/CA Mother's Day), 2nd Mon Oct (CA Thanksgiving), 4th Thu Nov (US)
    | { kind:'easter' }                                           // computus (Anonymous Gregorian), pure math
    | { kind:'table'; dates: Record<number,string> }              // Lunar NY, Diwali, Eid: ship 2026–2035 lookup tables (no lunar math at runtime)
    | { kind:'astro'; which:'jun_solstice'|'dec_solstice'|'mar_equinox'|'sep_equinox' } // table too
    | { kind:'personal'; field:'birthday'|'joinDate' }
    | { kind:'regionTable'; dates: Record<'US'|'CA'|'GB'|'AU'|..., Rule> }; // Mother's Day differs (UK = Lent, AU = 2nd Sun May)
  windows: { leadDays:number; peakDays:number; afterDays:number }; // e.g. Christmas 10/2/1, Halloween 7/1/0, New Year 1/1/7
  regions?: string[];            // ISO country codes; default = all
  hemisphereFlip?: boolean;      // summer/back-to-school/solstice flip for south
  cultural: boolean;             // true = user can opt out (or opt in for less-common ones)
  sensitivity?: 'normal'|'gentle'; // Mother's/Father's Day: always phrased so it includes loss, distance, chosen family
  theme: { accent:string; accent2:string; decor:string /* atlas key */; heroOutfit?:string };
};
```
- **Inputs:** device locale gives the region and the IANA timezone gives the hemisphere (fallback: a one-time "Seasons where you live?" question in Settings, PHASE-01). The birthday is only used if the user already gave their age or birthdate (`lib/age.ts`). Never ask for more data just for this.
- **Settings:** add a "Seasonal content" fold. One master toggle, plus per-event toggles for `cultural:true` events. Default to on for widely secular events (New Year, Halloween, Valentine's, Christmas), and use the region default for the rest. Diwali, Eid and Lunar New Year are opt-in outside regions where they're major.

### 6.3 Blend and priority rules
1. Phase weights. Outside a window the seasonal share is 0%. **Lead-in:** 1 of the 3 Today's path slots can be seasonal (the "try today" slot). **Peak day:** the Pick and your line are both seasonal, and the Home hero gets the event skin. **After:** 1 reflect card ("How did it actually go?").
2. Rank: personal (birthday, ATO anniversary) beats a regional peak, which beats a global peak, which beats a lead-in or after window, which beats a season (summer or winter mood).
3. At most 1 event at peak per day. On overlaps, the higher priority wins and the other drops to the try-today slot.
4. **Shared seasonal Pick:** the same question goes to everyone in a region on the peak day, so community % still works. Pick ids look like `xmas-01` and sit outside the 365 rotation, so the base loop isn't consumed.
5. **Gentle mode** for sensitive days: never assume family, a partner, faith or celebration. Always offer an "it's just a day for me" option.

### 6.4 Year-over-year (evergreen) design
- Each event has **3+ yearly variants** (`year % n`). Peak Picks repeat every 3 years, and each one is written to stay relatable ("the group chat is planning gifts again").
- **Callbacks:** store seasonal Pick answers locally, keyed by `eventId+year`. They're already in `daily_pick` answers if they're on the server. Next year: "Last Halloween you picked 'go as something nobody gets.' Still you?" Then show whether they flipped. That's free content that gets better with tenure.
- **"Your year in you"** (annual recap, first week of December, before Wrapped like Duolingo). 7–9 swipe cards:
  - your most-picked side
  - your trait that moved most
  - your "ATO age"-style invented stat (e.g. "Your year's vibe: The Quiet Explorer", built from your top 2 bands; a shareable archetype)
  - your rarest pick (where you were in the smallest %)
  - streak and longest run
  - deck cards found
  - a 2-pick then-and-now
  - "see you next year"
  
  A share card is image-only, with no AI text, and is rendered from bundled templates (reuse the existing share-codec and story-card).
- **Personal anniversaries:** the ATO join-date anniversary ("1 year since your first Pick. Here's what you said then"), the birthday ("one year older: your year in 3 picks"), and Quest completion anniversaries.

### 6.5 Collections, badges and theming (⚑ items need emci's OK)
- **Seasonal deck:** each event adds 4–6 flip cards to Insights ("Halloween 3/5"). Cards earned in the window stay in your deck. Missed ones come back next year, so there's **no permanent FOMO**. Not a reward with value, but **⚑ confirm** they count toward 128.
- **Seasonal badges** reuse `lib/badges.ts` and are cosmetic only. Examples: "Survived the holidays", "Pumpkin philosopher". **⚑ emci OK**, because a badge is a new reward type, even with no tokens.
- **Home and Insights theming:** a per-event accent pair (CSS tokens through the existing theme), a pixel-art decor overlay on the hero card (snow, lanterns, pumpkins, hearts, confetti, falling leaves), and a seasonal frame on the Pick card. **Reduce Motion is gentle, never still:** snow drifts slowly instead of stopping.
- **Hero/pet seasonal outfits via PixelLab:** Santa hat, pumpkin cape, scarf, sunhat, graduation cap, lantern. Art rules apply: real-world scale against the fully grown hero, critique score of at least 22/28. Outfits on the Hideout pet would need src/play changes, which **must not be touched**. So for now this covers the Home/You hero only, and **⚑ Play outfits are a separate emci decision.** **⚑ No price.** Outfits are free and wear automatically during the window, not sold in the Store. Selling them would need emci's OK.
- **Community event goal** (Pokémon GO and Duolingo style): "Everyone together: 1M Picks this Lunar New Year → the lantern sky lights up on everyone's Home." Needs a small Supabase aggregate (a count over existing answers; **⚑ emci applies the migration**). No tokens.

### 6.6 Content volume (one-time write, reused for years)
| Item | Per event | ~22 events | Notes |
|---|---|---|---|
| Peak Pick (3-year variants) | 3 | 66 | shared, community % |
| Lead-in try-today / lines | 8 | 176 | |
| After reflect | 2 | 44 | |
| Callback templates | 2 | 44 | slot-filled |
| Seasonal flip cards | 5 | 110 | deck |
| Push copy | 2 | 44 | |
| Year recap templates | – | 60 | archetypes 16×2 + stat cards |
| **Total** | | **≈540** | on top of about 1,000 base cards |

Art (PixelLab): 12 decor overlays (atlas), 12 hero outfits × idle frame (plus 2–4 frames each for small animation), 12 accent palettes, 1 recap story frame set. This is about 40–60 generations, with no caps.

### 6.7 Extra ideas found (ranked)
1. **"Your year in you"** annual recap with an invented shareable archetype stat. Highest share potential (Wrapped and Duolingo data).
2. **Year-over-year callbacks.** Costs nothing extra and makes year 2 better than year 1.
3. **Personal anniversaries** (join date, birthday). Truly personal, and needs no new data.
4. **Weekly theme** (e.g. "Conflict week": the Picks and try-today lean toward one axis Mon–Sun, and Sunday recap names it). Gives a reason to open mid-week, and all of it comes from the existing bank.
5. **Monthly "season" of 3 months** (Pokémon GO style): a named arc like "Season of Roots" with a constellation backdrop change. Light skin only.
6. **Community goal on peak days.** Social, with no tokens.
7. **Gentle-day mode** for Mother's/Father's Day, Valentine's and Christmas. Trust is a retention feature.

### 6.8 Build slotting
- **PHASE-08a+ (engine):** add `events.ts` (rules, computus, tables, windows, blend). It's a pure library with unit tests over 2026–2035 dates.
- **PHASE-01 Settings:** the Seasonal fold.
- **PHASE-08/09:** the theming hook and seasonal deck.
- **Art phase (alongside 15/21, ⚑ art OK):** decor and outfits.
- **Copy-review phase (⚑ copy OK):** seasonal bank.
- **PHASE-27:** the year recap ships hidden behind a date gate, so it turns on itself in December. Still one OTA.

### 6.9 emci decisions (approved 2026-10-27)
- ✅ The daily engine and seasonal layer are approved.
- ✅ Seasonal cards and badges are cosmetic, with no tokens.
- ✅ Hero outfits are free and worn automatically during events. They are never sold in the Store.
- ❌ No pet or Hideout outfits (src/play is off-limits).
- ✅ The community counter migration (wave116) is applied by emci himself.

### 6.10 Off-season coverage and smooth transitions
Home always has a theme, so a quiet week never feels empty and an event never pops in or out abruptly.

**Layers (low → high priority):** base → weekly trait theme → monthly theme → named season → micro-event → event (lead/fade) → event peak → personal.
- **4 named seasons** follow the hemisphere and each has its own backdrop, palette and constellation tint:
  - Season of Sparks (Jan–Mar, fresh starts)
  - Season of Bloom (Apr–Jun, curiosity and connection)
  - Season of Tides (Jul–Sep, rest and play)
  - Season of Embers (Oct–Dec, warmth and looking back)
- **12 monthly themes:** Clean slate, Soft spots, Curiosity, Small risks, Roots, Halfway, Play, Slow days, Fresh pages, Masks, Gratitude & boundaries, Looking back. The theme sets your line 1 day in 3.
- **Weekly trait theme:** `week % 16` picks one axis, with no repeat inside 8 weeks. The axis leans the try-today card and the Sunday recap ("Conflict week").
- **Micro-events** fill gaps of 10+ days with no event. Each lasts 1 day, at intensity ≤0.4:
  - full moon, first snow, Friday 13th, payday Friday, the clock change, equinox
  - 100th Pick, 30-day streak, half-year, "one year ago today"

**Ramp** (intensity 0→1, smoothstep, never more than 0.35 a day):
| Phase | Intensity | What shows |
|---|---|---|
| Teaser (e.g. Christmas −14d) | 0.1–0.2 | corner edge-sprig decor at about 20% opacity, a teaser line in the hero ("12 days. Already thinking about gifts?") |
| Lead (−7d) | 0.2–0.4 | 2–3 decor pieces, accent tints 20–40% toward the event palette, try-today goes seasonal |
| Build (−5d) | 0.4–0.8 | full decor at partial density, hero outfit on, the event deck opens |
| Peak (1–2d) | 1.0 | shared seasonal Pick, line, full scene, community goal |
| Fade (+5d) | 1→0 | decor thins and the palette tweens back to the season; afterglow card on day 1 ("How did it actually go?"); callback stored for next year |

**Blend rule:** the event's share of path slots equals its intensity. Below 0.4 only the hero and try slot change, and the Pick stays base. Only one event can sit above 0.4 at a time; the other drops to teaser.

**Build placement:** ATO-BUILD.md Stage C2 (PHASE-09a–09i), after PHASE-09.
