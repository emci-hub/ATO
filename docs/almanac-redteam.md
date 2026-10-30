# Almanac addendum — red team (Step 1)

Date: 2026-10-27 · Reviewer: Opus (docs only, no code edits) · Source: `docs/ATO-ADDENDUM-almanac.md`
Baseline: branch `phase-10-legends` @ 1f72b1f2 (PHASE-00…10 ticked, next unchecked = PHASE-11).
Read: the addendum, `docs/ATO-BUILD.md` §0–§1 + PHASE-08/09/10/15/17/22/24–27, `docs/ato-build-progress.md`,
`docs/art/PIXELLAB_GUIDE.md` §2–§5, and a read-only code audit of daily-pick, daily-line, daily-insights,
insight-bank, local-date, age, push, badges, home-path, insights, legends, art registry and migrations.

**Verdict:** the engine idea is sound and most of it fits. But **6 High findings** must change before any build:
a migration name clash, a Pick rotation that can't hold 365, the cutover rejecting old clients' answers, a ramp
spec that fails its own test, a Home hero that is not a pixel scene (so the backdrop/outfit art has nowhere to go),
and outfit art based on off-style heroes. **7 decisions for emci** are at the end (§5), each with a recommendation.

---

## 1. What already exists (the addendum's baseline is partly stale)

| Addendum says | Repo truth (file:line) | Effect |
|---|---|---|
| Pick: 64 Qs, `day % 64`, wave82 server | 64 active picks `p01…p65` (p25 retired → p65). Index = `(n%16)*4 + floor(n/16)`, epoch 2026-01-01 (`daily-pick/bank.ts:137-152`). Server `daily_pick_position(date)` hardcodes 64 (`wave82_daily_pick.sql:152-159`). `answer_daily_pick` requires `pick.position = daily_pick_position(p_ymd)` and `p_ymd` within UTC-today ±1. | Formula assumes **exactly 4 picks per trait**. See H2, H3. |
| Community % exists | `daily_pick_split(p_pick_id)`: security definer, returns null unless the caller answered AND total ≥ 20 (`wave82:223-252`). | Reuse it. "People like you" by band is a **new kind of aggregate** (see M9). |
| Daily line: 340 lines, picker, "AI pool" | 340 `LOADED_LINES`, id = `fnv1a(text)` base36 (`daily-line/bank.ts:728-740`), state `ato.daily-line.v1` (history 120). Review doc → `load:daily-line` → generated TS + seed SQL. **Leftover AI path** still in code (`LineSource 'ai'`, `keepAiLines`, `ato.daily-line-ai-log.v1` in `sync.ts`, `use-today-line.ts`). | Pipeline to copy is real and tested. AI leftover: flag for PHASE-11 cleanup (L4). |
| Daily insights + streak | "Did it" streak, cap 60, no repair (`daily-insights/streak.ts:12,38-44`). Insights card picked on device from `insight-bank` (stable ids `ftw_<axis>_<h|l>_<nn>`). | Two streaks already exist (plus Home glow). See H-level conflict C3. |
| — | Home "N-day glow" with 1 free rest day / Mon–Sun week (`home-path.ts streakWithRest`), PHASE-08. | Addendum's "1 free weekly **repair**" ≠ shipped **rest day** (C3). |
| "Today's path: Pick → line → try-today" | Shipped in PHASE-08 as **check in · read today's insight · answer questions**, read-only signals, pinned by `check:home-path` (`todays-path.tsx`, `home-path.ts`). | Direct conflict (C1, decision D1). |
| Home hero card with pixel backdrop + hero sprite, 394 wide | Home hero is an **SVG `TraitConstellation`, 260 pt** (`home-hero.tsx:53`). No sprite on Home. ProfileCharacter (sprite) is on **You** only. | Backdrops/outfits/decor have no surface (H5, D2). |
| Insights deck "34/128 found" | PHASE-09 shipped a FlipCard (focus front / try back) and "Insights seen" (`insight-collection*.ts`, key `ato.insights.collection.v1`). | Extend this collection; don't add a second counter (C2). |
| Week card, trait history, badges, push, share | `your-week-card.tsx`, `trait-history(-store).ts`, `badges.ts` (4 pure badges), `push-copy.ts` (morning push = daily line, Sunday push), `push.ts` local scheduling, `share-card.tsx` / `share-poster.tsx` (no `story-card`). | All reusable. Morning push already exists, so "one daily push" = change its copy source, not add a push. |
| Birthday "only if exists" | `age.ts` stores a real `born_on` (YYYY-MM-DD) and `BirthdayRow` is in Settings. | Birthday events are possible with no new data. |
| Region from device locale | `expo-localization ~17.0.9` is in package.json but **not imported anywhere** in `src`. | Must confirm it is linked in the current native binary (M7). |
| `docs/mockups/daily-engine/*.png` | **`docs/mockups/` does not exist.** | Every "match the mockups" accept line is unverifiable (M1). |
| `scripts/build-quest-atlas.ts` to extend | Does not exist yet (PHASE-22 creates it). | Almanac can't "reuse the atlas builder" before PHASE-22 (C5). |
| No almanac/season code | Confirmed: no `src/lib/almanac`, no `check:almanac`, no holiday code. | Clean start. |

---

## 2. Findings

Severity: **High** = would break data, users or the plan's own tests · **Medium** = wrong result or rework · **Low** = polish.

### High

**H1 · `wave116` is already taken.** PHASE-17 Quests owns `wave116_quest_runs.sql` (ATO-BUILD §1.2, PHASE-17, progress checklist).
*Fix:* Almanac server work becomes **`wave117_almanac.sql`**. Note: wave115 is still not applied on the live DB (docs/NOW.md), so emci applies 115 → 116 → 117 in order.

**H2 · The Pick rotation can't hold 365.** The live formula `(n%16)*4 + floor(n/16)` only works with exactly 4 per trait (64). 365 is not a multiple of 16, so "never the same trait two days running" breaks with any naive change.
*Fix:* use **368 = 16 × 23** (23 per trait), generalise to `(n%16)*K + floor(n/16)` with K = count/16, and pin it in `check:daily-pick` for both TS and the generated SQL (it does not compare against SQL text today — add that). The cycle is 368 days, which is fine.

**H3 · Changing the count breaks answers on the switch day and for old clients.** The server checks `pick.position = daily_pick_position(p_ymd)`. When the SQL moves from 64 to 368, every phone still on the old bundle (before the OTA lands) shows the old pick and gets **rejected**; and the moment the formula changes, today's Pick jumps for everyone.
*Fix:* a **cutover date**: `daily_pick_position` keeps the 64 formula for `p_ymd < CUTOVER` and uses the 368 formula from CUTOVER, with CUTOVER set ≥ 14 days after the planned OTA. During the overlap the server accepts **either** the old or the new position for the same ymd. TS gets the same branch. Seasonal Picks (`ev-<event>-<v>`) are outside the rotation, so the server needs an explicit "event override" table `(ymd, region?) → pick_id` that the position check also accepts.

**H4 · The ramp spec fails its own sim.** Rule: "never more than 0.35 a day". Defaults break it: Valentine's fades 1 → 0 in 2 days (−0.5/day); personal fades in 3 (−0.33, borderline); and "the loser drops to teaser" snaps an event from ≥0.4 to ≤0.2 in one day. The 1-day builds (New Year, Valentine's, personal) pass only if a phase does not sweep its whole band (0.4 → 0.7 → 1.0 passes; 0.4 → 0.8 does not) — the spec doesn't say which. The doc also gives the event windows **three** meanings: ramp **durations** (`ramp.ts` 14/7/5/2/5), **offsets** ("Christmas −14d teaser, −7d lead, −5d build"), and the schema's `windows {leadDays, peakDays, afterDays}` (Christmas 10/2/1) — they give different calendars.
*Fix:* (a) define them as **durations, counted back from peak start** (offsets derived, one meaning only); (b) compute a raw target curve, then apply a **slew limit** `|Δ| ≤ 0.3/day` to the displayed intensity (state is pure: derive it by walking back from the day, max 30 days, no storage); (c) minimum durations: build ≥ 2, fade ≥ 4; (d) the resolver demotes the loser by slewing, not snapping. The sim then asserts the **resolver output**, not the raw calendar.

**H5 · The Home hero isn't a pixel scene.** The art plan (09g backdrops 195×120 at ×2 into a "394-wide hero card", decor between far/mid layers, hero sprite with outfit, edge-sprigs) assumes a card that doesn't exist. Home's hero is a 260 pt SVG constellation; PHASE-08 pinned it in `check:motion`. Building a pixel scene there is a **new Home design**, not theming.
*Fix:* decision **D2**. Recommended v1: theme the **constellation** (accent lerp, constellation tint per season, a light SVG/sprite decor ring and particle layer) and keep pixel art to small decor sprites + stickers + badges. A full pixel hero scene becomes its own later phase, with real mockups first.

**H6 · The outfit heroes are off-style, and live on You, not Home.** `HERO_ART` (`src/components/profile-card.tsx:24`, used by `profile-character.tsx:39`) holds 8 **dungeon-legends** heroes, **south-facing only**, loaded from `assets/play/avatars/dungeon-legends/*/rotations/south.png`. The three named heroes (`dungeon-druid`, `dragonblood-champion`, `dungeon-witch`) are in that set. CLAUDE.md art rule 9: dungeon-legends is `needs-restyle` and must not be placed in new streetwear screens. The surface only ever shows the south frame, yet the addendum asks for 8 rotations + idle + wave per hero × outfit (11 outfits × 3 heroes × 24 frames ≈ 790 frames at 128 px, ≈ 13 atlases at 2048²) — far over any size budget, for a card that shows only one facing.
*Fix:* decision **D3**. Recommended: **defer outfits** to a later release. If kept: streetwear heroes only, **south facing only** (+ idle), via PixelLab `transfer_outfit` / `edit_image`, 1:1 at 128 (no ×2 pre-scale; guide §2 says heroes are never rescaled), scale-checked against the grown hero.

### Conflicts with phases already done or planned

**C1 · Today's path (PHASE-08, shipped).** Changing the 3 steps to Pick → line → try reworks a pinned phase and drops "answer questions", which feeds trait data. *Fix (D1, recommended):* keep the 3 shipped steps; the Almanac **feeds content** into the existing cards (the Pick card already on Home, the insight/try on Insights, the Sunday slot). No step change.

**C2 · Insights flip + collection (PHASE-09, shipped).** *Fix:* the deck is the existing FlipCard's content source plus a per-event section in the existing "Insights seen" (`ato.insights.collection.v1`, bump to v2 with a migration that keeps old seen ids). Insight-bank ids (`ftw_*`) stay forever and stay in the count.

**C3 · Streaks.** Three exist (daily-insights "did it", Home glow with rest day, server check-in). §1.6 forbids a paid repair and frames the free weekly day as **rest**, not repair. *Fix:* no new streak. Almanac reads `streakWithRest` for `{streak}` and the 30-day micro-event.

**C4 · Legends (PHASE-10).** No conflict. "Legend of the day" (idea #7) is not in the draft phases; leave it out.

**C5 · Atlas (PHASE-15/21/22).** The builder doesn't exist until PHASE-22, and R23's "own atlas, exempt from the art library" was granted **for Quests only**. *Fix:* Almanac art goes through the normal art library (`art:import` → `art:pack` → registry entry → skeleton slot → `art:sync`; `check:art-registry` stays green) — decision D4. No `assets/almanac` side atlas unless emci grants an R23-style exemption.

**C6 · Camera.** Addendum says `view side`; the repo's locked camera is 3/4 low top-down (`PIXELLAB_GUIDE.md` §3). Side view is a Quests-only exemption. *Fix:* decor/stickers/badges are flat UI icons (camera-neutral); any scene art follows td-3q-low unless emci says otherwise (D4).

**C7 · Critique rubric mismatch.** Addendum says "≥22/28, no zero items" (guide: 14 items × 0–2). ATO-BUILD §1.9 uses 7 × 0–4 with "no criterion below 2". *Fix:* Almanac uses the **guide's** rubric (it isn't Quests art) plus `pixelart_workbench score ≥ 90`.

**C8 · PHASE-27 QA** needs the Almanac rows (see §4).

### Medium — engine, dates, content

**M1 · No mockups.** *Fix:* drop "match the mockups" from accept lines; each surface phase shows rendered samples to emci first (memory rule "show samples").

**M2 · Text-hash ids are fragile here.** A typo fix changes the id, so seen-sets, deck counts and next year's callbacks lose the card. *Fix:* stable slug ids like insight-bank (`alm_<kind>_<event|axis>_<nn>`), never reused; a retired card keeps its id. Keep fnv1a only as a duplicate-text check.

**M3 · Seen-window vs the test.** "Seen = last 60" and "400-day sim, no repeat inside the bank size" contradict once a band's pool is > 60, and strong-band filtering shrinks pools to ~6 bands × 15. *Fix:* per-surface seen-set sized to the pool (cap 400, versioned), and the sim asserts **no repeat within min(pool, 90) days** per user profile, run over 3 sample profiles.

**M4 · Determinism vs reinstall/device.** Same card all day is guaranteed by caching today's pick; after a reinstall the seen-set is gone, so tomorrow can differ. Acceptable; document it. Cache must be keyed `{userId, ymd, surface, bankVersion}` so an OTA mid-day doesn't swap the card.

**M5 · Shared Pick seed `ymd|region` breaks the community %.** The server picks by `ymd` only; a region seed would fail `answer_daily_pick` and split counts. *Fix:* base Pick stays global by ymd; regional only via the event-override table (H3), with region resolved server-side from the stored override row, never from a client string the server can't check.

**M6 · Timezones.** Use `localYmd(…, me.timezone)` everywhere (same key as check-window and home-path, R21). Offline before `me` loads → device zone, then the cached pick wins. Fixtures: UTC+14 / UTC−12 (inside the server's ±1 day), DST both ways, travel across the date line, Monday week boundary (Home) vs Sunday recap.

**M7 · Region and hemisphere.** (a) `expo-localization` is a native module and unused: confirm it's linked in the shipped binary before using it; fallback `Intl.DateTimeFormat().resolvedOptions().locale` (no native change, honours "no 1.3"). (b) Hemisphere from IANA zone: compute **once** and store, so travel doesn't flip seasons; (c) add a **"tropics / no seasons"** value (Singapore, Nairobi, Bogotá…): named seasons stay, but snow/leaf micro-events and solstice flips are off. Settings override per D7.

**M8 · Holiday rules.** Easter computus fine (golden 2027-03-28 ✓; Lunar NY 2027-02-06 ✓; CA Thanksgiving 2026-10-12 ✓). Gaps: Father's Day differs by region (AU/NZ 1st Sun Sep); Mother's Day differs in many more countries (default: no event outside the table, not the US date); Eid dates vary ±1 day by country (use a 2-day peak window, never an exact-day claim); birthday on Feb 29 → Feb 28 in non-leap years; "exam season" has no reliable date → make it a month theme, not an event. Real clashes: 2026 LNY build (Feb 15–16) overlaps the Valentine's fade; Diwali 2027-10-29 inside Halloween's window; Eid 2026-03-20 on the equinox; LNY's 7-day peak covers Valentine's in 2029 (Feb 13), 2032 (Feb 11) and likely 2035 (≈ Feb 8). The addendum's 2026–2028 sim misses the last three, so **run the sim over the full 2026–2035 table range**. The resolver (H4) handles clashes; the test asserts ≤ 1 event > 0.4 after resolve.

**M9 · "People like you" bar.** Needs counts by trait band on the server = a **new kind of aggregate**, not a copy of `daily_pick_split`. *Fix:* defer, or build as one security-definer RPC with the same rules (caller must have answered, k ≥ 50 per band, returns `{total, counts}` only) and **ask emci** (CLAUDE.md: a new pattern needs an OK). Community goal counter: one RPC `sum(answers) where pick_id in event set` with no user rows — copies the split pattern, fine.

**M10 · Content volume.** ≈ 300 Picks + 540 event + 200 arc + 60 micro + 500 try/reflect + 92 recap ≈ **1,700 cards for emci to tick**. That's the real critical path. *Fix (D5):* MVP bank first: 304 new Picks (to 368), events for the next 12 months only (≈ 14 events × 10 = 140), arcs 72 (4 × 6 + 12 × 4), micro 20, base try 160, reflect 60, recap 40 ≈ **800**. More packs later as content-only drops (still inside the single OTA if done in time).

**M11 · Voice.** Addendum says moment voice for everything plus keyword bans ("no 'you are'"). CLAUDE.md: stored tips (try-today) use the **clear voice**; the core content policy judges **meaning, not keywords**. *Fix:* Picks/lines/teasers/pushes = moment voice; try-today/reflect = clear voice; checks use `framework-fence` (meaning-based) + length + slots, no word bans.

**M12 · Gentle days and cultural art.** Gentle mode is right. Remove the "kurta-style festive wrap" outfit (a cultural garment as a costume reads badly); Diwali/Eid/LNY use objects only (diya, crescent, lanterns), and are opt-in outside home regions.

**M13 · Perf / Reduce Motion.** Home hero already uses part of the 60-node budget. *Fix:* all decor particles in ONE sprite-sheet layer driven by the screen's single frame callback (no per-flake nodes); ≤ 12 animated decor nodes; Reduce Motion = half count, quarter speed, frames 1/3, never still (§1.4).

**M14 · Push.** No new push. The existing morning push switches its copy source to `almanac.today('push')`; Sunday push unchanged; max stays one morning push + Sunday. Seasonal toggle off → base copy.

**M15 · Privacy and local data.** All new keys `ato.almanac.*.v1` go into `clearLocalAccountData` (deny-by-default check `check:local-account-data` will force it). Callbacks store only pick ids + side, never text typed by the user (there is none). Year recap share card: image from templates, no struggle-side lines (`isShareableLean`). Region/hemisphere stay on the device. Privacy label: no change unless D7 stores region on the server (it shouldn't).

### Low

- **L1** Weekly theme `weekIndex % 16` trivially never repeats inside 8 weeks; use absolute weeks from the Pick epoch (Mondays), not ISO week numbers (year wrap).
- **L2** Year recap "opens Dec 1": date-gated in code, reachable early via the dev Hub only (`DEV_TOOLS_AVAILABLE`), so PHASE-27 can test it.
- **L3** Seasonal badges: `badges.ts` badges are pure functions of logged facts; seasonal ones need a stored "earned in window" fact → small local store, cosmetic, no tokens (approved).
- **L4** Daily-line AI leftovers (`keepAiLines`, `LineSource 'ai'`) contradict the no-AI invariant: add to PHASE-11 Cleanup, out of Almanac scope.
- **L5** PixelLab tool names in the addendum (`generate-with-style-v2`, `animate-with-text-v3`, `generate-8-rotations-v3`, `transfer-outfit-v2`) are not the MCP's names (`create_image_pixflux`/`create_image_pro`, `animate_object`/`animate_character`, `create_character`, `transfer_outfit`, `create_map_object`, `create_ui_asset`, `inpaint_image`). Pre-flight `search_help` per tool first (CLAUDE.md rule).

---

## 3. PixelLab art steps — corrected settings

- **Pre-flight (every art chat):** read `PIXELLAB_GUIDE.md` + `PIXELLAB_ANIMATION.md`, `search_help` each tool, `get_balance` before/after, **one test asset for emci's OK**, credits logged per batch in `art-src/almanac/credits.md`. Ask first above ~20 generations in a batch or for any Pro call (CLAUDE.md) — the addendum's "no caps" doesn't override that ask.
- **Library first:** search `assets/art/registry.json` for snow/leaf/heart/lantern FX and icons before generating.
- **Camera:** UI icons, stickers, badges, deck emblems = flat, camera-neutral. Any scene art = td-3q-low (not side) unless emci grants an exemption (D4).
- **Sizes:** on the 32 px ladder — icons/badges/stickers 16 or 32, decor props 32, edge sprigs 64, ambient FX 64. Odd sizes in the addendum (12×20 lantern, 6×6 snowflake, 195×120 plate, 48×48 emblem) move to the nearest ladder size. No ×2 pre-scale for anything shown 1:1.
- **Palette:** streetwear-night base + per-season/event accents passed as `target_palette` (extend mid tones first — guide §4), then `reduce_colors` + `score`.
- **Refs:** approved streetwear assets from the registry (not dungeon-legends, not Quests side-view plates).
- **Critique:** guide rubric ≥ 22/28 with no zero + `pixelart_workbench score ≥ 90`; fix by `inpaint_image`, 3 tries then change one param; log every fallback.
- **Scale sheet:** any world object (pumpkin, wreath, lantern) shown next to the grown hero (H ≈ 106 px) before approval; stickers/icons are exempt (UI).
- **Reduce Motion:** frames 1/3 at quarter speed, chosen in code (no extra art). ✓ as written.

---

## 4. Proposed integration

PHASE-10 is ticked; the next unchecked phase is PHASE-11 Cleanup. Insert a **Stage C2 Almanac** right after PHASE-11, numbered `PHASE-11a…11i` (keeps every existing number and anchor). This differs from the addendum's "after the phase in progress" (PHASE-10 is already done), which its "renumber as you see fit" allows. Art phases wait on their deps, so the runner simply skips them until PHASE-15 is ticked.

| Phase | What (changes vs addendum) | Deps | Model | ⚑ |
|---|---|---|---|---|
| **11a Almanac engine core** | types, seed, select, slots, seen-store, cache, `almanac.today()`. Stable slug ids (M2), seen sized to pool (M3), cache keyed with bankVersion (M4). Pure, no network. `check:almanac`. | 11 | Opus plans · Sonnet builds | — |
| **11b Calendar, locale, ramp, arcs** | rules + 2026–2035 tables, hemisphere once + tropics (M7), durations-only ramp + slew limit + resolver (H4), arcs, micro-events, 2026–2035 × 3-region × 3-hemisphere sim + golden dates. Writes `docs/almanac-calendar.md`. | 11a | Opus plans · Sonnet builds | — |
| **11c Content pipeline + MVP bank** | `docs/almanac-review.md`, `load:almanac`, `check:almanac-bank`. MVP ≈ 800 cards (M10, D5), voice split (M11), gentle mode. | 11a, 11b | Sonnet (Opus reviews voice/balance) | ⚑ copy OK |
| **11d Pick 368 + community counter** | append picks to 368 (H2), cutover-date dual formula + event-override table (H3, M5), `daily_pick_event_total` RPC. **`wave117_almanac.sql`** (H1), not applied. People-like-you only if D6 = yes. | 11c | Opus plans · Sonnet builds | ⚑ apply wave117 |
| **11e Surfaces** | Feed the existing Pick card, Insights FlipCard + collection v2 (C2), Sunday recap in the existing Today slot / week card, monthly "what shifted" + year recap on You (date-gated, dev Hub preview). Path steps unchanged (D1). No new streak (C3). | 11a–c, 08, 09 | Sonnet | — |
| **11f Seasonal settings + push copy** | Settings fold: master toggle, hemisphere/tropics override, cultural opt-ins, "use my birthday". Morning push copy from almanac (M14). | 11e | Sonnet | — |
| **11g Art A: Almanac style + decor/stickers/badges** | Through the art library (C5), td-3q-low/UI rules (§3). No backdrops unless D2 = pixel scene. | 15, 11b | Sonnet + PixelLab | ⚑ art OK |
| **11h Art B: outfits + deck art** | **Only if D3 = yes** (streetwear heroes, south only). Deck emblems + card frames otherwise. | 11g | Sonnet + PixelLab | ⚑ art OK |
| **11i Theming integration** | Constellation theming (accent lerp, tint, decor layer, edge sprigs) via skeleton slots + `art:sync`; perf budget (M13); `check:almanac-art` (keys exist, no unused art, size). | 11e, 11g (11h if built) | Sonnet | — |

**PHASE-27 additions:** date-sim gate green; timezone fixtures (UTC±14/−12, DST, date line); Pick cutover dry-run with old and new clients; seasonal off → base + arcs only; tropics setting; year recap gate (dev preview); wave117 missing → community bar hidden, no error; `clearLocalAccountData` covers `ato.almanac.*`; bundle size delta from Almanac art; privacy diff (should be none).

**Order of work:** 11a → 11b → 11c (then emci reviews copy in parallel with) → 11e → 11f; 11d after copy OK; art 11g/11h after PHASE-15; 11i last. Still one branch, one OTA.

---

## 5. Decisions for emci (recommendation first)

1. **D1 Today's path steps** — ✅ *Recommended:* keep the shipped 3 steps; Almanac fills the content of the Pick card, insight and try. · Alt: switch to Pick → line → try (reworks PHASE-08).
2. **D2 Home hero look** — ✅ *Recommended:* theme the existing constellation (tint, accent, light decor, particles). · Alt: build a new pixel hero scene card (new design + backdrops; needs mockups first).
3. **D3 Hero outfits** — ✅ *Recommended:* defer to a later release (current heroes are off-style dungeon-legends, outfits show only on You). · Alt: streetwear heroes, south facing only.
4. **D4 Almanac art route** — ✅ *Recommended:* normal art library + repo camera (no exemption). · Alt: an R23-style exemption (own atlas, side view).
5. **D5 Content size** — ✅ *Recommended:* MVP ≈ 800 cards now, more packs later. · Alt: full ≈ 1,700.
6. **D6 "People like you" bar** — ✅ *Recommended:* leave out for now (new kind of server aggregate). · Alt: build it in wave117 with k ≥ 50.
7. **D7 Hemisphere setting** — ✅ *Recommended:* auto from timezone once + Settings override with North / South / Tropics. · Alt: North / South only.

Nothing in this file changes app code.

## 6. Outcome (2026-10-27)
emci OK'd every finding and **D1–D7 as recommended**. Step 2 merged them into `docs/ATO-BUILD.md`: §1.10 (decisions + shared rules), Stage C2 **PHASE-11a–11h**. Because D3 defers outfits, the table's 11h (outfits) is dropped and 11i (theming) became **11h**. 11d is wave117, Opus plans · Sonnet builds.
