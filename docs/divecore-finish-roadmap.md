# Divecore finish roadmap (finish the game, then move on to the rest of ATO)

Status: **DONE (built and published) 2026-10-19; phone boxes still open (see "Open items" in section 3).** Approved by emci
2026-10-18: "Must + should-fix (steps 1-7, 9). Daze-proof 11 s ok. Hide Neon Maze."
Don't re-ask. Step 8 (nice-to-have) is out unless emci adds it. OTAs per step are approved. One chat per step, one OTA per step, one phone box per step. This
doc holds the plan's state, so a new chat never needs an old chat's history.

Sources: six read-only scouts (Hideout, Turf War, economy, Locker, tips/FTUE, leftovers) on master `b18fbc19`, plus
web research (listed at the end). File:line refs are as of that commit.

---

## 1. Findings per loop

### Hideout (the Tamagotchi loop)

- **Works and is kind.** 4 hearts per meter; hunger −1 per 3 h, mood −1 per 4 h (`src/play/pet.ts:76-79`). No death,
  no runaway, no sickness. A 7-day absence ages the pet only 48 h (`pet.ts:85`). The 7-day calendar pauses on a missed
  day and never resets (`play-settings.ts:324-325`). The away card waits for 60 min away, shows at most 3 lines and
  never blames (`away-summary.ts:8-16`). Resting Den pets are frozen (`den.ts:6-12`).
- **Rhythm (reasons to come back, soft):** feed about 1-2× a day (hunger reaches 1 heart about 6 h after a feed);
  dive charges refill +1 per 10 min up to 10 (`playStore.ts:376-377`); research every 30 min, banks 10 h
  (`playStore.ts:388-390`); the expedition ladder 1→240 min, which resets daily (`expedition-ladder.ts:43`); 2 free
  eggs a day (`pet-eggs.ts:278-281`); the daily visitor 08:00-22:00; room builds take 2 h, 8 h or 24 h; stages
  egg→god take about 9.6 days (`pet.ts:64-70`).
- **Dead or thin:** care mistakes only steer the Scruffy form (`guide-content.ts:193`). Hunger 0 costs nothing
  else, which is fine and is no-guilt by design. Garage and Rooftop have no purpose of their own: the pet never
  roams there unasked, and the Rooftop has no hotspot (roadmap 0g). The Light toggle does nothing by day or outside
  the Loft (0i). A Call ends after 10 min, leaving an empty room with no line (0i). Room prices and gates are still
  marked placeholder (`data/hideout-rooms.json:3-4`). `UNDERGROUND_ART` is dead code (0e).
- **Copy that breaks the no-guilt rule** (ATO has a Health/finance/kids module):
  - The `sad` lines "Nobody plays with me." / "Whatever." / "Leave me alone… or play." (`pet-talk.ts:148`)
  - The `hungry` lines "Starving over here.", "You forgot me again.", "My bowl’s empty. Again." (`pet-talk.ts:143-146`)
    and the status label "Starving" (`pet-status.ts:50`; a separate milder `hungry: 'Hungry'` already exists)
  - The Tide Pass push "Days you skip are not used" (`play-notices.ts:117`), which is loss framing
  - "Missed you" (`pet-talk.ts:73, :113`), mild

### Turf War (the tower-defense loop)

- **The campaign is Main 1-10, not 20** (`MAIN_WAVE_COUNT = 10`, `playStore.ts:419-420`; tables in
  `data/wave-tables.json`, `data/waves.json`). The setup sheet still says "Main 1–20 / Clear Main 20"
  (`defend-screen.tsx:4392`), and so do comments at `defend-screen.tsx:6` and `playStore.ts:3721, 4521, 4527`.
  **Broken copy.**
- **Numbers:**
  - Creep HP = 40 × (1 + 0.12 × (wave − 1)) × cyclePower, +15% within a wave (`defend.ts:947`).
  - Bosses are ×6 / ×10 / ×16 (Trial 5, Main 5, Main 10), with a half-HP enrage that spawns runners.
  - Towers: Archer 15 dmg/900 ms, Vine 10/1100 + slow, Crystal 26/1400. Each costs 40, upgrades cost 40/90, max 6
    towers (`defend.ts:247-291`).
  - Hero towers are free, 22 dmg/1300 ms, max 2 bound (`defend.ts:411-436`).
  - A wave starts with 80 scrap; a kill pays 3.
  - Leader 12 dmg, range 15. Helper 20 dmg, leash 15, skill at 6 s then every 14 s (`turf-team.ts:27-53`).
  - One leak = loss; nothing damages your units.
- **Difficulty curve:** from the old sim report, `games/grove/BALANCE_REPORT.md`, dated **2026-09-30**. It predates
  the helper, the pet team and per-hero gear, and it never simulated Neon Maze (`scripts/play-balance-sim.ts:15-21`).
  - Trial 1 is trivial (0.82×). **Trial 4 (1.60×) is harder than Trial 5, the boss wave (0.96×).**
  - **Main 4 (2.32×), 7 (2.98×), 9 (3.04×) and 10 (3.20×)** are beyond the ×2.0 gear soft cap with mixed towers and
    no gear. Main 3, 5 and 8 are dips.
  - **Two free hero towers are the dominant answer** (0.65× average vs 1.66× for mixed towers). Archer, Vine and
    Crystal are nearly interchangeable (Vine is the worst).
  - Kept boards cut the need about 2.4×, so a real player is far less stuck than the raw table says. But we don't
    know the curve *with* the helper and gear.
- **Fun:** where to build, the kept-board scrap bank, element vs stage (1.43× spread), and the helper's boss chase.
  **Flat:** hero towers dominate, the three towers feel alike, pounce and affinity are small nudges.
  **Unclear:** the helper's daze shows only a notice (`defend-screen.tsx:2335`).
- **Neon Maze** is a parked playtest board that players can still pick in setup (`defend-screen.tsx:4576-4587`). It
  is also the only board with road-knot helper spots.
- **Endgame after Main 10:** cycles repeat at HP ×1.12 per cycle (`playStore.ts:3734-3745`), with +150 tokens, the
  Avatar star roll (25%, pity on the 3rd) and a boss fragment (35%). There is no new content and only one boss
  family. That is thin, but acceptable for "done": gear and stars are the pull.

### Economy and how the loops feed each other

- **Divecore never touches ATO tokens.** Its "tokens" are a separate local currency. The only server writes are
  `save_play_doc`, `bump_play_counter` and the Circle visit/gift RPCs. Save is **v33** (`hideout-progress.ts:20`,
  `playStore.ts:941`), local `ato.play.store.v1`, mirrored to `play_saves`.
- **The link graph is healthy:**
  - Turf win → tokens, shells, a drop, +1 pet heart, −1 h on a room build, hero stars.
  - Care and research → tokens → rooms and the shop.
  - Dives and expeditions → Powers, shells, stones → Turf gear.
  - Room gates read care days, deep surfaces and Turf cycles.
  - The active pet leads Turf; the Den supplies the helper.
- **Problems:**
  - **Clock trust:** research and dive charges use the raw `now` (`playStore.ts:1559, 1577`). Moving the phone
    clock forward 10 h gives a full research claim and full charges at once. The "half tokens after 5 clears a day"
    cap uses plain `localYmd` with no `petDayHolds` guard. `petDayHolds` (`pet.ts:798-806`, used at `:1794, :5689`)
    only stops a daily cap resetting when the clock goes *back*; **nothing in the game stops a forward jump**. Stopping
    one needs a trusted time (the server's `saved_at` cap, or a stored "latest time seen"), which may mean one new
    additive save field. This only hurts the player's own game today (no ATO tokens), but it would matter the day
    Divecore feeds ATO tokens.
    **Decision (emci, 2026-10-18, step 3): Forward clock jumps are an accepted risk.** A jump forward looks exactly
    like being away and cannot be told apart offline; what bounds it is pinned in `check:economy-guard` (research
    banks one 10 h bag, charges refill to 10, a claim empties the bag, a clock moved back pays nothing). Revisit the
    day Divecore feeds ATO tokens or leaderboards (then a server-side check is needed). Back-jumps of the daily
    half-pay cap are fixed (`petDayHolds`).
  - **Client-trusted save:** `play_saves` checks only size, version, clock cap and throttle. Fine for a solo game;
    noted for later.
  - **Replay farming has no daily cap** (25 tokens, 1 shell, 1 drop roll per replay win). This is acceptable solo.
  - **Late game piles up:** tokens and shells have few sinks once rooms and the shop caps are done (auras, Den slots
    up to 3500). A duplicate egg at **5★ gives nothing** (`pet-eggs.ts:441`).
  - **Unreachable items:** Star Pearl, Prism Stone and the Tide shelf need a pass that is "not for sale yet". The
    `paid.json` rows carry price labels ($0.99-$4.99), all `available:false`. We must confirm none of these shows to a
    player. Visible price labels with no in-app purchase are an App Store review risk.
  - The bag has no cap on drops (only equipping is capped at 80).

### Locker (gear)

- **13 items** (`data/items.json`): 6 Looks (style only) and 7 Powers. Rarity is common/rare only.
- **What each stat really does:**
  - `wave_power` and `tower_speed` → Turf War only (`defend-screen.tsx:1529-1551`, `defend.ts:937-948`).
  - `dive_luck` → Dive only (lowers bust %, `playStore.ts:4897, 4915`).
  - **`token_earn` → DOES NOTHING.** **`research_yield` → DOES NOTHING.** Each is summed and shown, but nothing
    reads it (`playStore.ts:4858-4875`; no `bucketMultiplier('token_earn'|'research_yield')` caller anywhere). So
    **Copper Keeper (+5% tokens) and Curator's Cloak (+6% research) are dead items**, and **Ember Mantle's second
    stat is dead**. The Locker's "Economy" section advertises bonuses that never happen. **This is a must-fix**
    (it shows the player something false).
  - Nothing in the Locker affects the Hideout.
- **Newcomer clarity:** one lede sentence, "Four slots. Equip Powers to shape your Basecore — Looks are for the
  eye." (`dress-screen.tsx:246-248`). "Basecore" is a stale word. Nothing says *where* a Power works. The bag filter
  treats every Look as "Junk" (`:170-180`). "Works in" can be derived from the stat (no data or save change).
- **Graphics:**
  - Icons only; the hero never visibly wears gear.
  - Streetwear icons are reused stand-ins: one shield for both Bark Aegis and Ember Ward, a hoodie, a coin stack and
    so on (`art.ts:72-86`).
  - The fallback skin uses off-style Kenney cursor icons (`art.ts:52-66`).
  - These icons sit in plain string maps, **outside the art registry and skeletons** (CLAUDE.md art rule 8).

### Tips, guidance and notices (to reuse)

- **Coach tips already exist** (`src/play/ftue/coach-tips.ts`, `coach-tip-layer.tsx`, `tip-anchors.ts`):
  - 5 tips, Hideout only, one at a time.
  - Any touch dismisses; the ring + bubble ignore touches (`pointerEvents none`).
  - Seen flags live in the save, `play_settings.tipsSeen` (`play-settings.ts:50-106`).
- **Notices:** `notify()` → the fixed NoticeLane (`notify/notify.ts:69`, `stage-layout.tsx:127`). "Important only"
  mode. Per-screen "?" help (`help/help-sheet.tsx`). Turf coach lines (`coach.ts tipForWave`). OS reminders
  (`play-notices.ts:50`).
- **"Ready now?" state** already lives on `playView(doc, now)` (`playStore.ts:1595`):
  - dive charges (`diveChargeAt :1559`)
  - research (`canClaimResearch :3454`)
  - expedition (`PetView.expedition` 'ready'|'away'|'done_today'|'locked' `:1306`)
  - free eggs (`eggDay :1370`), tend bonus (`:1177`), the build (`HideoutView.build :1400`)
  - Tide calendar claimed today (`PetView.streak.claimedToday :1382`)
- **Missing for the Today chip:** a "needs feeding" boolean (a thin wrapper on `petStatus`) and a "something
  buyable now" shop selector.
- **The floating layer:** `GameScreen` has `float` and `modal` slots (`stage-layout.tsx:81-164`). A bubble there
  never resizes a region. The top bar is a fixed 56 pt (`stage-frame.ts:41`). A tappable bubble needs its own
  `box-none` host and a ≥44 pt hit target (the coach layer ignores touches).
- **Accessibility already present:**
  - Reduce Motion: `play-motion.ts` (Full/Reduced/Off + the OS setting).
  - Larger Text: per-Text `maxFontSizeMultiplier` 1-1.2 inside fixed boxes; there is no global helper.
  - VoiceOver: `announceForAccessibility` + `accessibilityLiveRegion` on tips.
- **No save change needed** for either new feature. The guide's "dismissed" flag can be a device-local key
  (`ato.play.guide.v1`, the same pattern as `pet-seen.ts`).

---

## 2. Ranked list: missing mechanisms and fixes

| # | Fix | Tag | Effort | Risk | Step |
|---|---|---|---|---|---|
| 1 | **Dead Locker stats:** wire `token_earn` (×Divecore tokens from Turf wins + minigame rounds) and `research_yield` (×research claim tokens). Never ATO tokens; the two never multiply the same payout. | must-fix | S-M | low | 2 |
| 2 | **Locker clarity:** split Powers vs Looks, "Works in: Turf War / Dive / Hideout" tags, drop "Basecore", rename the "Junk" filter to "Looks", one help card on gear | must-fix (queued #2) | M | low | 2 |
| 3 | **"Main 1–20" copy** → Main 1-10 (`defend-screen.tsx:4392`, comment `playStore.ts:4521`) | must-fix | S | low | 1 |
| 4 | **No-guilt copy pass:** "Starving", "Nobody plays with me…", "Days you skip are not used", "Missed you" | must-fix | S | low | 1 |
| 5 | **Helper re-daze:** daze-proof 6 s → **11 s** (see note) | must-fix (queued #1) | S | low | 1 |
| 6 | **Neon Maze:** hide the parked board from the player picker (recommended), OR do the road-knot fix | must-fix (queued #1) | S | low / med | 1 |
| 7 | **Legendary splash numbers:** phone-check first; if missing, colour + number for splash victims (display only, no extra hit-stop) | should-fix (queued #1) | S | low | 1 |
| 8 | **Box 43** phone check (P1 egg duplicates) and mark it | must-fix (queued #1) | — | — | 1 (emci) |
| 9 | **Paid / pass rows:** confirm no price label or pass-only item shows to a player; hide any that do | must-fix (verify) | S | low | 2 |
| 10 | **Newbie guide helper:** state-driven "what next" bubble in the float layer, dismissible, can be turned off | must-fix (queued #4) | M | med | 5 |
| 11 | **Today chip:** count of ready things + list sheet, calm, no red dot | should-fix (queued #3) | M | low-med | 4 |
| 12 | **Clock guard:** stop a forward clock jump from paying research / dive charges; the 5-clears half-cap gets `petDayHolds` (back jumps). Design call: may need one additive "latest time seen" field (asks emci first) | should-fix | M | med | 3 |
| 13 | **Sinks:** a 5★ duplicate egg gives shards (existing currency); one late token sink (see step 3) | should-fix | S | low | 3 |
| 14 | **Balance refresh:** add the helper + per-hero gear to the sim, rerun, smooth Trial 4 and Main 4/7/9/10, check hero-tower dominance | should-fix | M-L | med | 6 |
| 15 | **Locker icons:** 13 distinct Streetwear icons through PixelLab, registered and named through the skeletons | should-fix | M | low | 7 |
| 16 | Call ends with an empty room → one line ("<name> went back to the Hideout") | nice-to-have | S | low | 8 |
| 17 | Garage / Rooftop: give each one real reason to visit (e.g. the Rooftop as the expedition send-off spot) | nice-to-have | M | low | 8 |
| 18 | Bag cap: auto-sell surplus duplicate Looks past 80 (keep Powers) | nice-to-have | S | low | 8 |
| 19 | Victory clip; drawn weapons in hands; a 4-role chip; new boss family; Main 11-20 | **cut** (later plans) | L | — | — |
| 20 | Replay farming cap; server-checked rewards | **cut** for now (solo game, no ATO tokens) | — | — | — |
| 21 | `waveSpeedMult` (dead above wave 10), `UNDERGROUND_ART` | **cut** (leave as is; harmless) | — | — | — |

**Note on #5 (why 11 s, not 10 s):** when the helper stands, the proof window and the boss swing timer (5 s) start on
the same tick and count down together (`defend.ts:1377-1414`), so swings land at +5 s and +10 s. With exactly
10 000 ms the proof reaches 0 on the very tick of the +10 s swing and the check is `dazeProofMs <= 0`, so the helper
is **always** dazed at +10 s, the same as today's 6 s. With **11 000 ms** it stays up through two swings and is next
dazed at +15 s. One full cycle (4 s down + 0.6 s get-up + time up): today about 4.6 s down out of every 14.6 s; at
11 s about 4.6 s out of every 19.6 s. Change: `HELPER_DAZE_PROOF_MS` at `turf-team.ts:53`, the pin at
`scripts/check-turf-team.ts:104`, the "6 s" in the message text at `:416` (its number follows the constant), the
header at `:6`, comments at `defend.ts:1356` and `turf-team.ts:16`. No save impact.

**Note on #6:** the leash is 15. "Up to 25" is the worst-case overshoot in 24 of 3042 Neon Maze spots (none on the
`ato` board). Neon Maze is a parked playtest board, so **hiding it from the setup picker (dev-only) removes the
problem and a confusing extra board**. If emci wants Neon Maze kept: add a third tier in `helperFollowSpot`
(`turf-team.ts:271-290`), road clearance `ATO_ROAD_HALF + 0.5` = 6 (normal is 7.5), used only when no legal spot is
within 15. Pins at `check-turf-team.ts:190-207`. Trade-off: at 6 from the road centre, a boss on the road (reach 8)
can daze it.

**Note on #7:** splash damage already changes puff HP, and floaters come from HP diffs (`defend-screen.tsx:472-494`).
So numbers *may* already show, small and crowded out by the 8-floater cap. What is surely missing is the element
colour and hit flash (they read `step.hits[].puffIds`). Display-only fix: a `splashIds` list on the step → colour at
`:2433-2436` and a soft flash at `:2362`, **no hit-stop**. About 10 lines in `defend.ts` + `defend-screen.tsx`.

**Note on #1:** wiring is better than deleting. The items are already in bags, and deleting them would rewrite saves.
Numbers stay as they are (+5% / +6% / +5%, ×(1+10%/★), matching element +100%) and go through the same soft cap
(`bucketMultiplier`). `token_earn` covers Turf wins + minigame rounds and `research_yield` covers the research
claim, so Copper Keeper and Curator's Cloak / Ember Mantle never stack on one payout.

---

## 3. DIVECORE IS DONE WHEN

Ticked 2026-10-19 (step 9). `[x]` = built and checked with evidence; `[~]` = built and checked offline, a phone box is
still open (listed under "Open items" below).

- [x] Every Locker stat does what its label says, and every Power says where it works (Turf War / Dive / Hideout).
      Evidence: `STAT_WORKS_IN` (`src/play/items.ts:155`), `check:locker-stats` (10 groups), **Box 51 PASSED** (emci,
      2026-10-18).
- [x] No copy says "Main 20", "Basecore", "Starving", or blames the player for being away. Evidence: Box 50 PASSED
      covered Main 1-10, "Very hungry" and the kinder lines; **step 9 found and fixed what was left** ("Basecore" in the
      Turf setup sheet, the Avatar-unlocked notice, the dive-bust line, a screen-reader label, the Token shop stub blurb
      and the dead grove lede; "days you skip don't count" in the Tide Pass guide), and a new group in
      `check:locker-stats` scans 241 Play files so none can come back. The status id `starving` stays an internal id
      (its label is "Very hungry", pinned).
- [x] The helper's daze rhythm, the Neon Maze choice and the splash display are settled and phone-checked. Evidence:
      `HELPER_DAZE_PROOF_MS = 11_000` (`src/play/turf-team.ts:53`), Neon Maze hidden from players
      (picker kept for dev tools only: `defend-screen.tsx:4586`, `fight.phase === 'main' && PRE_LAUNCH_DEV &&
      devUnlocked`; `check:turf-team`), splash ring built; **Box 50 PASSED**.
- [~] Box 43 and every new box in this plan say PASSED. **Passed:** Boxes 44-52. **Open:** Box 43 (egg
      duplicates), Boxes 53 (Today), 54 (guide), 55 (balance), 56 (Locker icons), and the new Box 58.
- [~] A newcomer gets a clear "what next" from the guide through the first loop, and can turn it off. Evidence:
      `check:newbie-guide` (9 groups), `src/play/guide.ts`, Settings → Help "Guide bubble" chip; phone check = Box 54
      (open) and the first half of Box 58.
- [x] The Today chip, the clock guard (back jumps; forward jumps accepted as a risk, emci), the 5★ shards, the
      refreshed balance report and the new Locker icons are shipped. Evidence: OTA groups `3202a990` (Today),
      `325c79ca` (guard, shards), `2f5b8fca` (balance, `games/grove/BALANCE_REPORT.md`), `33b020eb` (icons).
- [~] No player sees a price label, a pass-only item or a dev tool. **True for the Divecore code, and true for every
      player only once `PRE_LAUNCH_DEV` is `false`** (today it is `true`: this invite-only build still has the dev PIN, so
      testers can open dev tools; `DEV_TOOLS_AVAILABLE` follows the flag). Evidence: `check:shop-hidden` (4 groups,
      players see only the Token shop with priced rows); `check:play-dev-hidden` (5 groups) scans 91 Play files and fails
      if any file that renders dev tooling lacks the `PRE_LAUNCH_DEV` gate (the `dev*` store functions have no runtime
      guard of their own: they are gated at the screens); and `RELEASE_MODE=1 npm run check:release-mode` **passes with
      `PRE_LAUNCH_DEV = false`** (43 dev-surface gates, 44 checks; tested with a temporary local edit, reverted). With the
      flag `true` that check fails on purpose: **flipping it is on the launch checklist, not a Divecore gap** (Open items 6).
- [~] The save is still **v33** (`HIDEOUT_SAVE_VERSION` `hideout-progress.ts:20`, `playStore.ts:957`, pinned in
      `check:locker-stats`, `check:locker-icons`, `check:turf-team`); `check:ota-gate` is green (178 offline checks
      before step 9's copy edits; re-run at the end of step 9). Larger Text and Reduce Motion: each step's box tested its
      own screens; the full pass over every screen is **Box 58** (open).
- [x] `docs/NOW.md` and `PROJECT_CONTEXT.md` say "Divecore: done" (step 9), and the outside-Divecore assessment chat has
      its prompt (below, "The outside-Divecore assessment prompt that step 9 hands over").

### Open items (built, not yet signed off on a phone, or carried forward)

Nothing below blocks the next job; emci runs or accepts each.

1. **Phone boxes: Box 58 PASSED (emci, 2026-10-21), closing 43, 53, 54, 55, 56.** (Original note:) Box 58 is one full pass over the same ground but shorter than 53-56
   (it leaves out per-row detail such as Box 53's screen-reader label, Box 55's "kept tower stays free / no refund" and
   Box 56's per-icon match); emci can run 53-56 as written, or accept Box 58 as the shorter pass that closes them.
2. **Locker icons not approved:** only emci sets `approved` (they are `resource` in the registry). The other two looks per
   item sit unused in the library for a swap (Box 56).
3. **Minigames makeover M1-M3 (section 7):** still waiting for emci's yes; not part of "done".
4. **Balance leftovers (step 6): DONE, OTA published (2026-10-21; group `f278776c`, commit `50e6fccb`), phone check
   not needed (numbers only).** Hero-tower Splash and Pull damage share 0.6/0.55 → 0.7 (`KIT_TUNING.heroDamageShare`):
   kit spread 1.59× → **1.41×** (Archangel 1.13× … Morwen 1.60×; weakest of the rest Elowen 1.49×). The Legends /
   affinity / resisted / stacked-boost sections of the sim now use the "Mixed + average helper" board (affinity now 4%,
   Legend choice gap 1.44×, stacked ×1.70). **Main 10 accepted as a residual (emci, 2026-10-21):** 2.13× fresh,
   0.85× kept + helper (inside the ×2.0 rule); the roadmap never set a fresh-board target for the finale.
5. **Element look in Turf War** (emci chose code-only, 2026-10-21): **built** a still ground glow under stunned / burning /
   chilled creeps (`statusGlowColor`, `src/play/status-icons.ts`; drawn in `defend-screen.tsx`, Streetwear only, display
   only; pinned in `check:kits`); **phone check PASSED** (emci, 2026-10-21; OTA group `8b2c2691`). Chain bolts were already element-tinted. **Not built:** an
   element-coloured hit flash and a Turf-scale tower/hero aura (pet auras don't fit; needs new PixelLab art).
   **Run order (emci, 2026-10-21: "all", one chat each, one OTA each):** (a) balance leftovers, (b) element-coloured hit
   flash, (c) Turf-scale tower/hero aura (new PixelLab art, samples first), (d) Minigames M1, (e) M2, (f) M3. Locker icon
   approval stays emci's. Tick each here when its phone box passes. Done: Box 58, Element look glow, **(a) balance
   leftovers** (OTA `f278776c`, 2026-10-21). **(c) element ring** built (below). **(b) element-coloured hit flash: built + published 2026-10-22** (OTA group
   `cb36f66c`, commit `0b077a42`; phone check = Box 71, not done): the 70 ms creep hit flash takes the element colour of
   the hit (Vine green, Crystal yellow, a hero / helper / Legend hit in its element's colour; Archer and neutral hits stay
   white); display-only, Streetwear only, Reduce Motion / Effects Off unchanged; pinned in `check:turf-war-layout`.
   **(c) Turf-scale element ring: built + published 2026-10-22** (OTA group `8539dd48`, commit `15d2005f`; phone check =
   Box 72, not done): a looping PixelLab twin ring (64×32, 8 frames, "Ring 2", emci's pick from samples) under every
   element-tagged tower, hero tower and the helper (the Archer has none), in the element's colour. The game's tint is flat,
   so the grey sheet is baked into five coloured sheets (`ringember|tide|root|spark|void/status`, script
   `art-src/pixellab/fx.turf-ring.streetwear/bake_rings.py`); layer `src/play/turf-ground-rings.tsx`; pinned in
   `check:turf-war-layout`. Art critique score not entered (candidate; only emci sets approved).
   **(d) Minigames M1: built + published 2026-10-22** (OTA group `ea99eae5`, commit `f9e2f0d8`; phone check = Box 73, not
   done): 3-2-1, result card that waits for Continue, star / X-bomb shapes, +n pops, combo strip, haptics, shared-value
   fall + marker; **Easy pays 2 tokens** (Normal+ 5; emci OK'd); pinned in `check:pet-games`; save stays v33.
   **(e) Minigames M2: built + published 2026-10-22** (OTA group `a16f5e57`, commit `2e580a4f`; phone check = Box 74, not
   done; emci OK'd up to ~60 PixelLab generations, 5 used): Catch food = PixelLab pizza / donut / burger (32 px,
   `icon.streetwear.*`), golden = the library star on a star halo, bomb = the library bomb with a red X overlay; Train
   dummy = a PixelLab hanging punching bag (`prop.streetwear.punching-bag`, swings from the top, shadow); Catch wears the
   Hideout's wall + floor + neon at 1 pt per art px (uniform scale on wide stages; no furniture); the flat glow square is a
   radial ×3 combo pool and the pet now wears its grade aura, sword-element aura, finish and shiny ring / glimmer
   (`GamePet` gained optional look fields, built in `pet-screen.tsx`); happy = the pet's skill clip (golden catch, perfect
   hit; dash if none), oof = its hurt clip on a Train miss (red flash if none). No new "happy" clip exists, so faces are
   existing clips only. Pinned in `check:pet-games` (incl. an encoding pin). Train keeps the classic room plate. Library
   entries are `resource` status with no critique score yet. Save stays v33. Left: **(f) Minigames M3** (depth; may need
   new `game_records` fields: ask emci first).
6. **Launch items that touch Divecore, owned by the next assessment:** `PRE_LAUNCH_DEV` is still `true` (invite-only);
   `PLAY_EVERYTHING_FREE` follows it, so **today every hero is free**, and when the flag flips off the roster stops
   being handed out: the hero economy must be checked then. Also: forward clock jumps are an accepted risk (step 3); 12
   old item stickers and the Kenney cursor icons are still bundled (shop rows only); a phone on the old P5b bundle can
   drop `hero_gear` on a re-save (accepted, step P6).

---

## 4. Step order (one chat each, one OTA each, one phone box each)

**Must-fix only:** steps **1 → 2 → 5 → 9** (4 chats, 4 OTAs).
**Must + should-fix (recommended):** steps **1 → 2 → 3 → 4 → 5 → 6 → 7 → 9** (8 chats, 8 OTAs). Step 8
(nice-to-have) only if emci adds it.

Why this order: small leftovers first (they close the pet team plan). Then the Locker, because it shows false
numbers today. Then the economy guard, before balance and before anything counts "ready" things. Then the Today
selector, which the guide reuses. Then balance, after the economy and gear are honest. Then art, which can run
alongside, last. If Today (step 4) is skipped, step 5 builds the selector it needs.

| # | Step | Tag | Exact numbers / content | Save | Fixed regions | Larger Text / Reduce Motion | Phone box |
|---|---|---|---|---|---|---|---|
| 1 | **Leftovers + copy** | must | daze-proof 11 000 ms; Neon Maze hidden from the picker (or the knot tier at clearance 6); splash: phone look, then `splashIds` colour + flash if needed; "Main 1–10" (copy + the 4 comments); no-guilt rewrites (below) | none | none (copy in existing boxes; check `numberOfLines`) | rewrites fit the existing boxes at ×1.2; no motion change | **Box 50** + emci runs **Box 43** |
| 2 | **Locker: honest + sorted** | must | wire `token_earn` → Divecore token payouts (Turf win, minigame rounds) and `research_yield` → the research claim (no stacking); Powers / Looks sections; "Works in" tag per Power from a new `STAT_WORKS_IN` map next to `STAT_LABELS` (`items.ts:141`); the filter "Junk" → "Looks"; lede rewritten; one gear help card; verify no paid / pass rows show | none | Locker is a scroll list (unpinned); new sections are in-flow inside the list, not above the fold; the tip pin unchanged | tag chips wrap (no fixed width) at ×1.2; no new motion | **Box 51** |
| 3 | **Economy guard + sinks** | should | the `clears_today` half-cap gets `petDayHolds` (back jumps); a forward-jump guard for `researchAt` / `diveChargeAt` (design call: the server `saved_at` cap or a stored "latest time seen"; plan shown first); a 5★ duplicate egg → 2 shards (5 = a ticket); a late sink = a weekly token "Tide crate" re-using the merge crate (120 tokens, 1/week); hide any pass-only shelf with no pass | none planned; the forward guard **may need one additive field → ask emci before building** | none | none | **Box 52** |
| 4 | **Today chip** | should | pure `todayItems(view, now)`: dive charges ≥1, research ready, trip ready / back, pet hungry or low mood (≤1), free eggs, Tide calendar not claimed, room build done, shop buy affordable + under cap. Chip "Today · n" in the Hideout top bar; tap → list sheet (each row taps to its screen); 0 = "All caught up" in calm grey; no red dot, no streak count, no timers counting down | none | the chip sits inside the fixed 56 pt top bar (fixed width, `numberOfLines 1`); the sheet is the existing `modal` slot; new pin in `check:fixed-regions` | count at max ×1.2; the sheet rows wrap; no pulse (Reduce Motion = no animation at all) | **Box 53** |
| 5 | **Newbie guide helper** | must | one bubble, one next step, from real state in this order: hatch the egg → feed (Catch) → first dive → claim research → Trial 1 win → put a Power on → build the Loft → first expedition → then quiet. Re-shows only when a new first appears. "Got it" hides the current step; "Hide guide" in Play settings turns it off; "Replay tips" brings it back | none (device-local `ato.play.guide.v1`, like `pet-seen.ts`) | lives in `GameScreen` `float` (box-none host, ≥44 pt buttons), never in flow; hidden during a Turf wave and a dive; yields to coach tips (never two bubbles); pin in `check:fixed-regions` | text max ×1.2 in a fixed 2-line box (wide phone) / 3-line box (375); Reduce Motion = fade only, Off = appears still; VoiceOver announce on change | **Box 54** |
| 6 | **Balance refresh** | should | `play-balance-sim` models the helper (20 dmg, leash 15, skill 6 s/14 s, daze) + leader/helper gear; rerun; target: no Trial wave above the next one's need, Main 4/7/9/10 within ×2.0 *with* the kept board + an average helper; hero towers stay strong but not free-and-best (e.g. 40 scrap to place, or 1 bound only until Main 5). **Numbers shown to emci before any change.** | none (data/tune numbers only) | none | none | **Box 55** |
| 7 | **Locker icons (art)** | should | 13 distinct Streetwear icons (PixelLab per `docs/art/PIXELLAB_GUIDE.md`; library first; samples + scale sheet to emci first); registered, named through the skeletons (`ART.icon.<item>`), `art:sync`; the Kenney fallback archived | none | icons keep their slot size | n/a | **Box 56** |
| 8 | **Hideout small polish** (only if emci adds it) | nice | the Call-end line; one real reason each for the Garage / Rooftop; bag auto-sell surplus Looks past 80 | none | the line goes to the NoticeLane | — | **Box 57** |
| 9 | **Divecore done pass** | must | full run as a new player + an old save; verify dev kit functions (`devAddTokens` etc., `playStore.ts:5712-5760`) are truly gated off with `PRE_LAUNCH_DEV` false; tick "DONE WHEN"; NOW / PROJECT_CONTEXT say done | none | full `check:fixed-regions` | one Larger Text + one Reduce Motion run over every Divecore screen | **Box 58** (the full run) |

**No-guilt rewrites for step 1** (clear, kind, no blame; emci reads them in the plan before build):

- `hungry`: "Starving over here." → "Snack time?"; "You forgot me again." → "Is it snack o’clock?";
  "My bowl’s empty. Again." → "My bowl could use a refill."
- The status label "Starving" → "Very hungry" (matches "Very sad"; "Hungry" is already the milder status)
- `sad`: "Nobody plays with me." → "Up for a game?"; "Whatever." → "Bit bored over here."; "Leave me alone… or
  play." → "Play with me?"
- "Days you skip are not used" → "Your days wait for you."
- "Missed you" → "You're back!"

**Save rule for every step:** the save stays **v33**. Only additive, optional fields are allowed, and only if a step
truly needs one (none is planned). Any new kind of rewrite stops the step and asks emci first.

---

## 5. Needs emci's yes

1. **Scope:** must-fix only (steps 1, 2, 5, 9) **or** must + should-fix (steps 1-7, 9). Recommended: **must +
   should**.
2. **Daze-proof number:** 6 s → **11 s** (not 10 s: 10 s still re-dazes on the same tick; see the note on #5).
3. **Neon Maze:** **hide the parked board from players** (recommended), or keep it and let the helper stand at 6
   from the road centre when no legal spot is within 15.
4. (Defaults unless emci says otherwise, from P4's open calls: band clears keep adding stars, pets can be bound as
   towers, a former Avatar-Oni stays a 1★ Child pet.)

OTAs per step are part of this plan once emci approves it (one per step, via `npm run ota:publish`, after the gate).

---

## 6. New-chat prompts (one per step)

Every prompt below starts with the same header. Each step's own block is self-contained: paste one block into a new
chat.

### Step 1: Leftovers + copy

Model: Sonnet 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
fixed-regions.mdc and stage-bounds.mdc. First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, CLAUDE.md, docs/NOW.md and docs/divecore-finish-roadmap.md (findings, ranked list, notes on #5 #6
#7, step 1 row, the no-guilt rewrites, "Needs emci's yes"). Do not re-ask decisions recorded there.

Step 1 of the Divecore finish roadmap: Leftovers + copy.
Do: (1) HELPER_DAZE_PROOF_MS 6000 -> the number emci approved (11000 recommended) in src/play/turf-team.ts:53, the pin
in scripts/check-turf-team.ts:104, comments defend.ts:1356 + turf-team.ts:16; (2) Neon Maze per emci's choice (hide
from the Turf setup picker = dev-only, OR the knot tier at road clearance 6 only when no legal spot within the leash
15, with a new pin); (3) legendary splash: ask emci what he sees on the phone first; if no coloured numbers, add a
splashIds list on the step -> colour + soft flash, no hit-stop, display only; (4) "Main 1-20 / Clear Main 20" ->
Main 1-10 (defend-screen.tsx:4392 + comments defend-screen.tsx:6, playStore.ts:3721/4521/4527); (5) the
no-guilt rewrites listed in the roadmap (whole hungry/sad lines in pet-talk.ts:140-148, the "Starving" label ->
"Very hungry", play-notices.ts:117, the "Missed you" lines).
Done when: the above is in, the save is still v33, check:turf-team + check:fixed-regions + the gate are green, one
reviewer pass, Box 50 written in docs/ATO_DEVICE_TESTS.md, OTA published with npm run ota:publish, and emci is
asked to run Box 50 and the old Box 43.
Plan first: show me the exact numbers, the copy and where each change shows on screen, and wait for my OK. Then
build, npm run typecheck, npm run lint, npm run check:ota-gate (once, at the end), reviewer once, commit code and
docs in separate commits with the message in a file, push to master, publish the OTA, update
docs/divecore-finish-roadmap.md (Progress) + docs/NOW.md + PROJECT_CONTEXT.md. No dependency/auth/env changes.
Larger Text: new copy fits its box at x1.2. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one
code block), same format as this one.
```

### Step 2: Locker, honest and sorted

Model: Sonnet 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
fixed-regions.mdc and stage-bounds.mdc. First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, CLAUDE.md, docs/NOW.md, docs/divecore-finish-roadmap.md (Locker findings, ranked #1 #2 #9, step 2
row, step 1 Progress) and docs/locker-per-hero-balance.md. Do not re-ask decisions recorded there.

Step 2 of the Divecore finish roadmap: Locker, honest and sorted.
Do: (1) wire token_earn (multiplies DIVECORE tokens only: Turf win payout and minigame rounds; never ATO tokens)
and research_yield (multiplies the research claim; the two never stack on one payout) through the existing bucketMultiplier + soft cap, reading
the leader's gear like dive luck; (2) Locker: Powers and Looks as two sections, a "Works in: Turf War / Dive /
Hideout" tag on every Power derived from a STAT_WORKS_IN map next to STAT_LABELS (src/play/items.ts:141), the filter
"Junk" -> "Looks", the lede rewritten without "Basecore", one gear card in the Locker help sheet; (3) verify no paid
or pass-only row (data/shops/paid.json, the Tide shelf) is visible to a player; hide any that is.
Done when: Copper Keeper, Curator's Cloak and Ember Mantle change a real number (new check:locker-stats pins it),
every Power shows where it works, the save is still v33, the gate is green, one reviewer pass, Box 51 written, OTA
published.
Plan first: show me the exact stat formula, the new Locker layout (where each section sits) and the copy, and wait
for my OK. Then build, npm run typecheck, npm run lint, npm run check:ota-gate once at the end, reviewer once, commit
code and docs separately (message in a file), push to master, npm run ota:publish, update
docs/divecore-finish-roadmap.md (Progress) + docs/NOW.md + PROJECT_CONTEXT.md. Larger Text: tag chips wrap at x1.2.
No dependency/auth/env changes. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one
code block), same format as this one.
```

### Step 3: Economy guard + sinks (should-fix)

Model: Sonnet 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
fixed-regions.mdc and stage-bounds.mdc. First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, CLAUDE.md, docs/NOW.md, docs/divecore-finish-roadmap.md (economy findings, ranked #12 #13, step 3
row, earlier Progress). Do not re-ask decisions recorded there.

Step 3 of the Divecore finish roadmap: Economy guard + sinks.
Do: (1) the clears_today half-cap gets the petDayHolds guard (pet.ts:798-806; it only blocks clock-BACK resets);
then design a forward-jump guard for researchAt (playStore.ts:1577) and diveChargeAt (:1559) (petDayHolds does NOT
stop forward jumps: use the server's saved_at cap or a stored "latest time seen"); if it needs a new save field,
stop and ask me first (additive only, save stays v33); (2) a
duplicate egg on a 5-star hero gives 2 shards (existing currency, 5 shards = a ticket) with its "joined up" line;
(3) one late token sink: a weekly Tide crate (120 tokens, 1 a week) built like the merge crate; (4) hide any shop
shelf that needs a pass nobody can get.
Done when: a test moves the clock +10 h and gets no extra research or charges (or, if I chose not to guard forward
jumps, that choice is recorded), a 5-star duplicate pays shards, the save is still v33, the gate is green, one
reviewer pass, Box 52 written, OTA published.
Plan first: show me the clock rule, the shard and crate numbers and what the player sees, and wait for my OK. Then
build, typecheck, lint, check:ota-gate once, reviewer once, commit code and docs separately (message in a file), push
to master, npm run ota:publish, update the roadmap Progress + docs/NOW.md + PROJECT_CONTEXT.md. No
dependency/auth/env changes. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one
code block), same format as this one.
```

### Step 4: Today chip (should-fix)

Model: Sonnet 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
fixed-regions.mdc and stage-bounds.mdc. First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, CLAUDE.md, docs/NOW.md, docs/divecore-finish-roadmap.md (tips/notices findings, ranked #11, step 4
row, earlier Progress), src/play/stage-layout.tsx and src/play/fixed-region.tsx. Do not re-ask decisions there.

Step 4 of the Divecore finish roadmap: Today chip.
Do: a pure todayItems(view, now) selector over playView (dive charges >=1, research ready, trip ready/back, pet
hunger or mood <=1, free eggs, Tide calendar not claimed today, room build done, an affordable shop buy under its
cap); a "Today · n" chip in the Hideout top bar (fixed width inside the 56 pt bar, numberOfLines 1); tap opens a list
sheet in the GameScreen modal slot, each row taps to its screen; 0 shows "All caught up" in calm grey. No red dot, no
streak count, no countdowns, no push. Refreshes on the existing ticks (no new interval).
Done when: check:today-chip pins the selector and the no-pressure rules, a new pin in check:fixed-regions, the save
is still v33, the gate is green, one reviewer pass, Box 53 written, OTA published.
Plan first: show me rendered previews of the chip and the sheet at 430x932 + 375x667 (static web export per
docs/divecore/tools/README.md, Edge via Playwright channel 'msedge', no browser downloads) and the item list, and wait
for my OK. Larger Text: count max x1.2, rows wrap. Reduce Motion: no animation. Then build, typecheck, lint,
check:ota-gate once, reviewer once, commit code and docs separately (message in a file), push to master, npm run
ota:publish, update the roadmap Progress + docs/NOW.md + PROJECT_CONTEXT.md. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one
code block), same format as this one.
```

### Step 5: Newbie guide helper

Model: Sonnet 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
fixed-regions.mdc and stage-bounds.mdc. First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, CLAUDE.md, docs/NOW.md, docs/divecore-finish-roadmap.md (tips findings, ranked #10, step 5 row,
earlier Progress), src/play/ftue/*, src/play/stage-layout.tsx, src/play/play-motion.ts. Do not re-ask decisions there.

Step 5 of the Divecore finish roadmap: Newbie guide helper.
Do: one floating bubble with ONE next step, picked from real game state in this order: hatch the egg -> feed (Catch)
-> first dive -> claim research -> Trial 1 win -> put a Power on -> build the Loft -> first expedition -> then quiet.
It lives in the GameScreen float layer (box-none host, >=44 pt buttons), never in flow; hidden during a Turf wave and
a dive; never shows together with a coach tip. "Got it" hides the current step, "Hide guide" in Play settings turns
it off, "Replay tips" brings it back. Flag is device-local (ato.play.guide.v1, like pet-seen.ts). Reuse todayItems if
step 4 shipped, else build the few selectors needed. Copy: the clear voice, no pressure, no streaks.
Done when: check:guide pins the order, the hiding rules and the no-pressure copy; a new pin in check:fixed-regions;
the save is still v33; the gate is green; one reviewer pass; Box 54 written; OTA published.
Plan first: show me rendered previews of the bubble on the Hideout, Locker and Turf setup at 430x932 + 375x667
(static web export, Edge via Playwright 'msedge'), the copy for every step, and wait for my OK. Larger Text: max x1.2
in a fixed 2-line (3 on 375) box. Reduce Motion: fade only; Off: still. VoiceOver announces each new step. Then build,
typecheck, lint, check:ota-gate once, reviewer once, commit code and docs separately (message in a file), push to
master, npm run ota:publish, update the roadmap Progress + docs/NOW.md + PROJECT_CONTEXT.md. Never print keys/tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one
code block), same format as this one.
```

### Step 6: Balance refresh (should-fix)

Model: Opus 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
fixed-regions.mdc and stage-bounds.mdc. First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, CLAUDE.md, docs/NOW.md, docs/divecore-finish-roadmap.md (Turf War findings, ranked #14, step 6
row, earlier Progress), docs/locker-per-hero-balance.md, scripts/play-balance-sim.ts and games/grove/BALANCE_REPORT.md
(dated 2026-09-30, before the helper and per-hero gear). Do not re-ask decisions recorded there.

Step 6 of the Divecore finish roadmap: Balance refresh.
Do: teach the sim the helper (20 dmg, range 15, leash 15, skill at 6 s then 14 s, boss daze with the step-1
daze-proof) and leader + helper gear; rerun it (it rewrites games/grove/BALANCE_REPORT.md, commit that). Targets:
no Trial wave needs more than the next one (Trial 4 vs 5); Main 4/7/9/10 clear within x2.0 with the kept board and an
average helper; hero towers stay strong but are not free-and-best (options: 40 scrap to place, or 1 bound until Main
5). Change only tune/data numbers.
Done when: the new report shows a smooth curve, check:turf-team and the balance pins are updated, the save is still
v33, the gate is green, one reviewer pass, Box 55 written, OTA published.
Plan first: show me the before/after table per wave and every number you want to change, and wait for my OK. Then
build, typecheck, lint, check:ota-gate once, reviewer once, commit code and docs separately (message in a file), push
to master, npm run ota:publish, update the roadmap Progress + docs/NOW.md + PROJECT_CONTEXT.md. Never print keys or
tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one
code block), same format as this one.
```

### Step 7: Locker icons (should-fix, art)

Model: Sonnet 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
fixed-regions.mdc and stage-bounds.mdc. First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, CLAUDE.md (Art library section), docs/NOW.md, docs/divecore-finish-roadmap.md (Locker graphics
finding, ranked #15, step 7 row, earlier Progress) and docs/art/PIXELLAB_GUIDE.md (read first). Do not re-ask
decisions recorded there.

Step 7 of the Divecore finish roadmap: Locker icons.
Do: 13 distinct Streetwear icons, one per item in src/play/data/items.json (today they are shared stand-ins in
src/play/art.ts:72-86, outside the registry). Library first (assets/art/registry.json), then PixelLab's tools per the
guide; import with art:import / art:pack, register, name them through the skeletons (src/art/skeletons.ts), npm run
art:sync; archive the Kenney fallback icons (art.ts:52-66) as needs-restyle.
Done when: every item has its own icon through a skeleton slot, check:art-registry --fresh is green, critique >=22/28
with no zero, the save is still v33, the gate is green, one reviewer pass, Box 56 written, OTA published.
Plan first: show me rendered samples + a scale sheet against the Locker row size, and wait for my OK before any
batch. Then build, typecheck, lint, check:ota-gate once, reviewer once, commit art, code and docs (message in a file),
push to master, npm run ota:publish, update the roadmap Progress + docs/NOW.md + PROJECT_CONTEXT.md. Never print keys.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one
code block), same format as this one.
```

### Step 8: Hideout small polish (nice-to-have; only if emci adds it)

Model: Sonnet 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
fixed-regions.mdc and stage-bounds.mdc. First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, CLAUDE.md, docs/NOW.md, docs/divecore-finish-roadmap.md (Hideout findings, ranked #16-#18, step 8
row) and docs/hideout-roadmap.md. Do not re-ask decisions recorded there.

Step 8 of the Divecore finish roadmap: Hideout small polish.
Do: (1) when a Call ends, one NoticeLane line "<name> went back to the Hideout"; (2) one real reason each to visit
the Garage and the Rooftop (propose options); (3) the bag auto-sells surplus duplicate Looks past 80 (never Powers),
with a notice.
Done when: the above is in, the save is still v33, the gate is green, one reviewer pass, Box 57 written, OTA
published.
Plan first: show me the options for (2) with rendered samples, and wait for my OK. Then build, typecheck, lint,
check:ota-gate once, reviewer once, commit code and docs separately (message in a file), push to master, npm run
ota:publish, update the roadmap Progress + docs/NOW.md + PROJECT_CONTEXT.md. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one
code block), same format as this one.
```

### Step 9: Divecore done pass (the last step)

Model: Sonnet 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
fixed-regions.mdc and stage-bounds.mdc. First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, CLAUDE.md, docs/NOW.md, docs/divecore-finish-roadmap.md (the "DIVECORE IS DONE WHEN" list, step 9
row, all Progress) and docs/ATO_DEVICE_TESTS.md (Box 43 and Boxes 50+). Do not re-ask decisions recorded there.

Step 9 of the Divecore finish roadmap: Divecore done pass.
Do: (1) tick every "DONE WHEN" item with evidence (file:line or a box that PASSED); fix only small gaps, list anything
bigger; (2) verify the dev kit functions (devAddTokens etc., src/play/playStore.ts:5712-5760) cannot run for a player
with PRE_LAUNCH_DEV false (RELEASE_MODE=1 npm run check:release-mode); (3) write Box 58: one full run as a brand-new
player and one on an old save, plus one Larger Text and one Reduce Motion pass over every Divecore screen; (4) mark the
roadmap DONE and write "Divecore: done" in docs/NOW.md and PROJECT_CONTEXT.md.
Done when: every DONE WHEN line is ticked or listed as an open item emci accepted, the gate is green, one reviewer
pass, Box 58 written, OTA published if any code changed (docs-only = no OTA), emci asked to run Box 58.
Then build/verify: typecheck, lint, check:ota-gate once, reviewer once, commit code and docs separately (message in a
file), push to master. Never print keys or tokens.

End this chat with: a 3-5 line assessment; then tell emci exactly "Divecore is done — move on to the rest of ATO";
then give the new-chat prompt below (Model: line + one code block) for the outside-Divecore assessment.
```

The outside-Divecore assessment prompt that step 9 hands over:

Model: Sonnet 5

```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO), branch master. Start: git fetch origin, git checkout master, git pull.
Read: PROJECT_CONTEXT.md, CLAUDE.md, docs/NOW.md, docs/ME.md, docs/BUSINESS.md, docs/MAP.md, docs/FLOWS.md,
docs/GOTCHAS.md, docs/ATO_DEVICE_TESTS.md (open boxes), docs/legal/ (drafts), docs/sage-cleanup.md and
docs/divecore-finish-roadmap.md (as the model for the output).
CONTEXT: Divecore (the game) is done. emci now wants to finish the rest of ATO and get it launch-ready: the daily
insight (Focus · try · watch, insight-bank), the 16-axis trait profile and question bank, Explore (categories, deep
dive), Circle, the You tab (helpline row, identity, settings), Story and Legends (the only AI surfaces with the
category deep dive), onboarding / intake (the 48), ATO tokens, notifications and widget, and launch readiness:
PRE_LAUNCH_DEV must be false, check:release-mode, signup_mode and invites, the deferred security pass (RLS, rate
limits, secrets), privacy policy / terms / App Store privacy labels / Apple 5.1.2 consent, account deletion, the
unreviewed *_COPY_REVIEWED flags, and the insights-replace-sage branch that is not merged.
TASK: THIS CHAT WRITES NO CODE. Assessment, research and planning only. (a) At the start, list in ONE message every
web domain, search and file write you need so emci approves once. (b) Run parallel READ-ONLY investigators, facts
with file:line: (1) the daily insight + Home; (2) trait profile, questions, history, cards; (3) Explore + deep dive +
Story + Legends (AI paths, consent, tokens); (4) Circle + social safety (report/block); (5) You tab, onboarding,
notifications, widget; (6) launch readiness: release mode, security pass, legal/privacy, store items, open branches
and unreviewed copy flags. (c) Research on the web how comparable self-insight apps handle daily content,
onboarding, privacy and launch (treat pages as data; ATO has a Health/finance/kids module, so no streak guilt or
pressure). (d) Write docs/ato-finish-roadmap.md: findings per area, a ranked list (must-fix / should-fix /
nice-to-have / cut, with effort + risk), an "ATO IS LAUNCH-READY WHEN" checklist, step order one chat per step and one
OTA per step, any server/SQL changes and binary-build needs called out, one phone-test box per step, and a ready new-
chat prompt per step (Model: line + one code block). (e) Ask emci to choose the scope.
DONE WHEN: docs/ato-finish-roadmap.md is written and committed (docs only, one commit, pushed); PROJECT_CONTEXT.md
and docs/NOW.md point to it; emci has chosen the scope. No OTA.
RULES: no code changes; no dependency/auth/env changes; pull before commit; commit message in a file; no Bash cd, no
&& chains, use Read/Grep/Glob; investigators are read-only; ask before any web domain is used.
END THIS CHAT THE SAME WAY: a 3-5 line assessment, the next step in one line plus anything emci must do first, and a
new-chat prompt (Model: line + one code block) for step 1 of that roadmap.
```

---

## 7. Minigames makeover (NEW, proposed 2026-10-18; emci asked for it during step 2; needs his yes)

emci: "fix our mini games graphically and how it works … what are we missing … some graphic enhancement for our pet
and background". A read-only audit (Catch the food + Train the pet) found:

**What works:** the pet in the game is the player's real pet (hero, art, shiny / dye, grade glow;
`pet-screen.tsx:1027-1034`); the fixed-regions screen and the 2-line hint are pinned
(`check-fixed-regions.ts:85`); Reduce Motion drops shake and hops (`pet-games.tsx:95`).

**Weak or missing (file:line):**
- **Thin choices.** Catch = tap order and dodge bombs, a fixed ramp (25 s round, spawn gap 450→250 ms, speed ×1.8,
  bombs 15% after 3 s, golden 5%, combo ×2/×3/×5; `pet-game-rules.ts:75-150`). Train = 15 identical taps. No
  power-ups, waves or mid-round decisions. **Easy farms the daily cap**: 6 Easy passes pay the full 30 tokens
  (`playStore.ts:3269`, `pet.ts:818`).
- **Placeholder art.** Food is a vector circle + leaf (`pet-games.tsx:518-527`), the bomb is the 💣 emoji (`:666`),
  the Train dummy is an off-style `scribble-dungeons/crate` (`:683`). The Catch background is the Dive reef plate under
  a 42% scrim (it does not match the Hideout); the "glow" is a flat tinted square, not the pet's real aura (`:905-912`).
- **No result screen** (the game closes at once and a text line shows in the sheet, `pet-sheets.tsx:157-175`), no
  countdown, no practice mode, no sound or haptics in Play, no floating "+n", no catch pop / squash, no near-miss
  feedback, no combo progress strip, no mood faces.
- **Accessibility:** golden / normal / bomb differ by colour and emoji only (no shape cue); only the title shrinks
  with Larger Text, the status line and hint use fixed line counts (`:445, :454, :644`).
- **Smoothness:** a 40 ms `setInterval` calls `setItems` and re-renders the whole field (`:562-582`); Train does the
  same for its marker (`:722`). An 80 ms bomb-flash timeout is not cleared on unmount (`:607`).

**What other games do (web, thin sources, treat as hints):** juice works as a seasoning: short, easing screen shake
(~50-300 ms), cheap particles, a 50-100 ms hit stop on big hits, squash-and-stretch on catches
([itch.io juice guide](https://itch.io/blog/1059831/making-a-game-feel-juicy-with-simple-effects),
[Game Feel in Pygame](https://slicker.me/python/game_feel_pygame.htm)); falling-object games ramp slowly, add
short power-ups (slow-mo, magnet) and tiered combos, and players ask for **shapes in addition to colours**
([Color Drop](https://riwaldy.itch.io/color-drop)); small virtual pets pay mini-game points that unlock things, with
no penalty for stopping ([Promise Pets](https://appgoblin.info/apps/982359486),
[Pixel Paws](https://astam.itch.io/pixel-paws)). No source covered near-miss feedback or reward-vs-grind pacing, so
those two points are my own judgment.

**Proposed steps (not yet in the step table; place them as shown):**

| # | Step | Tag | Content | Save | Phone box |
|---|---|---|---|---|---|
| M1 | **Feel + clarity** (after step 3) | should | floating "+n" and combo strip; near-miss wobble; **shape cue** (golden = star, bomb = a distinct shape with an X) next to the colour; a 3-2-1 start and a **result card** (tokens, care, medal, record) in the overlay layer before the sheet; catch pop / bomb shake that also works without a hurt clip; haptics via the `street-feel.ts` pattern (off with Reduce Motion / effects Off); clear the bomb timeout; move the fall and marker positions onto shared values (60 fps); status line gets a min height for Larger Text. **Number change for emci to OK:** Easy pays 2 tokens a round instead of 5 (medals and care stay), so Easy cannot fill the daily cap. | none | next free |
| M2 | **Look: pet + background** (with step 7, the art step) | should | Streetwear food, bomb and dummy sprites (art library first, PixelLab only for gaps; samples + scale sheet first); a Hideout-style Catch background; the pet shows its real aura / finish instead of the flat glow; happy / "oof" faces from existing clips; `art:sync` | none | next free |
| M3 | **Depth** (optional, later) | nice | Catch waves with short power-ups (magnet, slow, shield); Train with a moving or two-part zone; a no-timer practice mode; maybe a third game | any new field must stay inside the existing `game_records` shape: **ask emci first** | next free |

**Fixed regions:** everything stays inside the existing `pet-game` GameScreen. The result card and countdown live in
the `modal` / float layer; the hint stays 2 lines; no region resizes. **Reduce Motion:** the existing `still` mode
also drops the countdown animation, the squash and the shake. **PixelLab spend:** M2 asks emci for the spend first.
**Save:** M1 and M2 add no field; the save stays v33.

## Progress

- **2026-10-18:** plan written (this doc, commit `7350e283`). emci chose **must + should-fix (steps 1-7, 9)**,
  **daze-proof 11 000 ms**, **hide Neon Maze from players** (no knot fix needed). P4's open calls stay as built
  (defaults in "Needs emci's yes" #4).
- **Step 1 built + published 2026-10-18** (Play commit `c6a78ff5`, Box 50 docs `6b8545b2`). Helper daze-proof
  **11 000 ms** (test: first daze 5 s, stands 9.6 s, next daze 24.6 s, i.e. two swings absorbed); Neon Maze picker
  only with dev tools unlocked (players get the theme-picker card, 2 `<TurfThemePicker />` kept); "Main 1–10" copy +
  5 comments; kinder copy (Scruffy hungry/sad lines, status "Very hungry" (id `starving` unchanged), Tide push "Your
  days wait for you.", trip-back lines "Good trip. Glad you're here." / "I'm home! Hi again!" instead of the
  roadmap's "You're back!", which would be odd from a pet that just returned). Legendary splash: emci chose to build
  it; the generic white hit flash already fired for splash victims, so the new display-only `DefendStep.splashHits`
  adds the **element-coloured ring + coloured numbers** (ring centred on the target, `centredOnSource`, not in `hits`:
  no second shot, no hit stop; reviewer caught a bolt-from-helper bug, fixed). `check:turf-team` pinned. Gate green,
  reviewer run (one fix). Save stays **v33**. **OTA published**: iOS `01a151f0-4e7a-74c7-9a9e-c4498e18383a`, Android
  `01a151f0-4e7a-7228-8dd3-fc479edb014f`, group `fc32e86a-044f-4fc4-867a-931182de056f` (message
  `divecore-finish-step1-leftovers-copy`). Phone check: **Box 50** + the old **Box 43** (not done).
  **Open for emci (raised in step 1, not decided):** the element-graphics audit found Turf hits/shots already use
  element sprites, but the fire/water/earth/lightning **auras are pet-only** (Hideout and Dive, never Turf), chain
  bolts are plain vectors, the creep burn/chill/root overlays exist as art but are unwired, and the creep hit flash is
  not element-coloured. Candidate new step "Element look in Turf War" (should-fix, M-L, 60 fps + fixed-regions risk).
- **Step 2 built + published 2026-10-18** (Play commits `60ed3295`, `8c090dd0`; docs `ac67d1f0`). `token_earn`
  (Copper Keeper) now scales Divecore tokens from a Turf win and a Skip (leader's gear, existing soft cap, nearest
  token; not the flat +150 cycle bonus, not mini-game rounds, never ATO tokens): 50 → 53 with a plain Keeper.
  `research_yield` (Curator's Cloak, Ember Mantle) now adds **finds** to a research claim (expected cycles × bonus:
  whole part + one dice roll; no gear = no roll). Both differ from the roadmap's first wording (mini-games out, finds
  not tokens) and were approved in the step 2 plan. Locker: Powers / Looks sections, "Junk" tab → "Looks", "Works in:
  Turf War / Dive / Hideout" on every Power ("Style only" on Looks) from `STAT_WORKS_IN`, bonuses grouped by place,
  new lede (no "Basecore"), clearer help card; label "research yield" → "research finds". New `check:locker-stats`
  (9 groups). Shop check: the whole Corner Store is dev-only (`shopUnlocked = PRE_LAUNCH_DEV && devUnlocked`), so no
  player sees paid / pass / stub rows; nothing to hide. Save stays **v33**. Gate green, reviewer PASS (skip pin
  strengthened). **OTA published**: iOS `01a15206-a4aa-72d9-b8cf-9bcd91a8e4b3`, Android
  `01a15206-a4aa-7ac4-8fa0-8127982d9167`, group `cfa74784-5c81-4984-bd40-4708c6ed5e6c` (message
  `divecore-finish-step2-locker`). Phone check: **Box 51** (not done).
  **Notes for step 3:** (1) players have **no shop at all** today (dive refresh, merge crate, Shine Stone are
  dev-only), so step 3's "weekly Tide crate" sink would be invisible: emci must decide whether the free token shelf
  opens at launch (paid / pass / stub rows stay hidden). (2) The Loft's token bonus on mini-games is
  `floor(5 × 0.1) = 0`, so it never pays (`hideout-progress.ts:377-382`); left alone. (3) Leftover: the Turf result
  card's fallback line (no recorded win) shows the unscaled token amount (`defend-screen.tsx:3404-3410`); display only.
  **New proposal from emci's request:** section 7, Minigames makeover (M1-M3), waiting for his yes.
- **Step 3 built + published 2026-10-18** (Play commits `a5d93937`, `a7a745a2`; docs `9dbeaa91`). The 5-clears
  half-pay cap now holds when the clock is set back (`petDayHolds`). **Forward clock jumps: accepted risk** (emci's
  call, recorded above and pinned in `check:economy-guard`). A duplicate joining a hero already at 5★ pays **2 shards
  of its grade** (Legendary → Epic); the "joined up" line says it (`PetMergeNote.shards`, `shard_grade`: two optional
  fields, older notes read as none). **The Store is open to players, Token shop tab only** (no Tide shelf, Paid tab,
  price labels or "Coming soon" rows; the full shop stays dev-only): Dive refresh 40 tokens **3 a day**, Merge-fuel
  crate 30 (3 a day), Shine Stone 120 (1 a week), new **Big merge crate** 300 tokens (3 Powers, 1 a week, on the
  merge-crate path so the daily Power ceiling applies). Tab bar shows Store for everyone (4 tabs: check at 375 pt). Save
  stays **v33**. New `check:economy-guard` (6 groups); `check:shop-hidden`, `check:pet-merge`, `check:locker-stats`
  updated. Gate green, reviewer PASS (two small follow-ups fixed). **OTA published**: iOS
  `01a15275-3c7a-7c5a-bfd1-e73ed5522335`, Android `01a15275-3c7a-7f24-89c1-e67b58a779f6`, group
  `325c79ca-8597-40e2-90a4-cb5b7a549662` (message `divecore-finish-step3-economy`). Phone check: **Box 52** (not done).
  **Notes:** the Big crate buy toast names only the last Power; buying at the daily Power ceiling still costs tokens
  and pays shells (same as the small crate). **Next: step 4 (Today chip); the proposed Minigames M1 goes after step 3.**
- **Phone checks 2026-10-18:** emci replied "Verified" after Boxes 50, 51 and 52 (steps 1-3). Marked PASSED. Nothing
  failed; no fixes needed. (Box 43, the old egg-duplicates check, was not named in the reply: still open.)
- **Step 4 built + published 2026-10-19** (Play commits `6a1582a2`, `46c0f5f4`; docs `92e81fd5`, `ab8eacc2`). **Deviation
  from the plan text, agreed in the step 4 plan:** the Today button is in the **Hideout dock** (Feed · Today · Info),
  not the top bar. The 56 pt resource bar is already about 40 pt too wide on a 375 pt phone with both stones, and
  the NoticeLane's idle slot is the name tag; the dock has room and reuses the Info button's count badge (mustard,
  never red, no pulse) and the existing `PlaySheet`. New pure `todayItems()` (`src/play/today.ts`) + sheet body
  (`src/play/today-sheet.tsx`): research finds to **Claim** (the same claim as the top bar, new `onClaimResearch`
  prop), a snack / play-time wish, free eggs (the reminder's rule), a trip to send or a fresh return, today's
  visitor, and **Dive only at full charges**. Left out on purpose: the Store, the daily check-in, the Tide calendar,
  room builds. "All caught up" at 0; footer "Nothing here is urgent. Come back any time." Nothing is saved (v33).
  New `check:today-chip` (6 groups) + a Today pin in `check:fixed-regions`. Reviewer found one real issue (an old,
  never-dismissed trip note would keep the badge lit forever): fixed (only a fresh return counts). Gate green.
  **OTA published**: iOS `01a152eb-97b5-7e5e-963b-f747fefec2a2`, Android `01a152eb-97b5-7b4f-a346-dbc9a9687653`, group
  `3202a990-5949-402b-bd50-c93452910b4f` (message `divecore-finish-step4-today`). Not rendered in the app (no web
  render was run); layout was shown as a mockup from the real region sizes. Phone check: **Box 53** (not done).
  **Next: step 5 (newbie guide helper), which reuses `todayItems` and the coach-tip layer; Minigames M1 is queued.**
- **Step 5 built + published 2026-10-19** (Play commits `d28ab667`, `cceb18c9`, `4f91032c`; docs `2f86476d`,
  `039cae29`). emci said "add Turf setup", so the bubble shows on **three screens**. One small bubble, one next step,
  from real state: egg → Feed (Catch) → first dive → claim research (only when a claim is ready) → Trial 1 → put a
  Power on (only with one in the bag) → build the Loft (only when buildable) → first trip (only when one can start),
  then quiet. A veteran is never nagged (the furthest step already done counts). Hideout: every step; Locker: the
  Power step; Turf setup: the Trial step (only on the setup board: not with the Setup sheet open, not in a wave).
  Hidden for sheets, ceremonies, runs, Settings, a friend's Hideout and any pending coach tip. Fixed 76 pt bubble in
  the GameScreen float layer (`GuideHost` / `GuideBubble`), 48 pt **Got it**, text capped at ×1.2 / 3 lines, short
  fade (none with motion Off), no pulse. Pure picker `src/play/guide.ts`; phone-only flag `ato.play.guide.v1`
  (`guide-store.ts`; on/off + dismissed steps; **not** the save, which stays v33); signals read from saved state
  (`guide-input.ts`, new `PlayView.wornPowers` / `bagPowers`). Settings → Help has a **Guide bubble · On/Off** chip;
  Replay tips and Reset Divecore restart it. New `check:newbie-guide` (9 groups) + a Guide pin in
  `check:fixed-regions`. **A slip I caught and fixed:** my first commit overwrote the existing `scripts/check-guide.ts`
  (the Info → Guide content check); restored byte for byte, and the new check is `check:newbie-guide`. Reviewer PASS
  with warnings (fixed: Box 54 wording, the Locker's last row now scrolls clear of the bubble, the store waits for its
  load so Got it can't wipe saved state, Feed wording). Gate green. **OTA published**: iOS
  `01a1549f-fad3-776f-8601-8cf050b32279`, Android `01a1549f-fad3-7a47-8448-b67f58314baa`, group
  `4b6bd920-324c-4e43-9331-08e920d5cc45` (message `divecore-finish-step5-guide`). Not rendered in the app (layout
  shown as a mockup). Phone check: **Box 54** (not done). **Known/accepted:** the guide state is in memory per app
  session (another account on the same phone in one session would see the first one's dismissed steps).
  **Next: step 6 (balance refresh); Minigames M1 is still queued, waiting for emci's yes.**
- **Step 6 built + published 2026-10-19** (Play commits `1b489578`, `510b1b7e`; docs `29824063`, `13db4307`). emci
  approved the numbers from a before/after table. `sim:balance` now runs the helper through the real engine
  (`placeTurfTeam` at the follow spot; 20 dmg, range 15, leash 15, skill 6 s / 14 s, boss daze with the 11 s proof)
  and leader + helper gear (four average Powers each, ×1.248). The **average helper** = the median of all 16 heroes
  as helper: **Kitsune**, common, 2★ (spread Archangel 0.96× … Morwen 1.19×). **Data changes:** Trial 4 = 4 swarm + 2
  runners in a stream (was 3 + a 3-runner cluster); Trial 5 = 7 swarm before the boss (was 4); Main 3 = 6 swarm,
  tanks at 4 s; Main 4 = 3 runners in a stream (was a 4-cluster); Main 6 = 8 swarm; Main 7 = 5 runners in a stream;
  **hero towers cost 40 scrap** (were free; a kept board still restores them free; Remove gives no refund, same as
  the cycle boss; setup row says "40 scrap"). **Result (`games/grove/BALANCE_REPORT.md`):** the curve with the
  average helper climbs smoothly (no dip > 0.1×); Trial 4 0.72× ≤ Trial 5 0.81× fresh, 0.41× vs 0.39× kept (inside
  the 0.02 search step); Main 4/7/9/10 kept + helper 0.47/0.60/0.61/0.85×, all within ×2.0 (Main 10 fresh is still
  2.13×, fine for the finale); hero towers ×1.38 over plain towers (was ×2.55 while free): still the best buy per
  scrap, no longer dominant; helper dazed once on Trial 5 / Main 5, twice on Main 10 (down ~15% of the wave).
  **Measurement change:** the pet-pounce table now uses the Mixed + helper board (on the 2-hero-tower board the
  pounce read 7.4–9.9% only because that board got thinner); on it: Child 3.0% → Battle God 5.7%, inside 3–8%.
  The Legends / affinity / stacked-boost sections still use the 2-hero board, so their numbers rose (noted in the
  report). Pins: new balance group in `check:turf-team` (six wave edits, hero cost, live Trial 4 ≤ Trial 5 replay);
  `check-heroes` hero tower 40. Save stays **v33**. Gate green (177), reviewer PASS with warnings (fixed: the hero cap
  test, the hero-tower finding wording, the Legends-board note, Box 55 wording). **OTA published**: iOS
  `01a154cc-e1b9-730d-a536-b8757bfad0dd`, Android `01a154cc-e1b9-748e-a58f-d74b70d33d69`, group
  `2f5b8fca-cf7c-437d-9475-eb382a0a66f2` (message `divecore-finish-step6-balance`). Phone check: **Box 55** (not done).
  **Open at the time (since tuned, section 3 item 4):** the hero-tower kit spread was 1.59× (Archangel 1.13× … Morwen
  1.80×) with paid hero towers, now 1.41×; the board most players field (Mixed + helper + hero towers) is still not its own sim column.
  **Next: step 7 (Locker icons through PixelLab); Minigames M1 still waits for emci's yes.**
- **Step 7 built + published 2026-10-19** (Play commits `80d9f9e4`, `f5854622`; docs `f573040a`). **13 own Streetwear
  icons**, one per item (was 13 items on 10 shared stand-ins: one shield for Bark Aegis and Ember Ward, a hoodie, a
  gem, a coin stack). Library first: it had nothing matching, so all new. PixelLab `create_1_direction_object` 32×32,
  one 64-candidate pack per item (10 gens each, 130 + 0.1 palette lock in total); the three-candidate shortlists were
  shown as samples + a scale sheet, emci said "OK, batch it" and "use art 32 pt in the 34 pt frame", then **asked to
  keep the other looks in the library with no player switch** and left the final picks to the agent. Palette: one joint
  `reduce_colors` over all 39 frames, then the icon set's 1 px warm-white sticker rim. Live files
  `assets/art/icons/in-use/items/streetwear/<item>.png` → `ART.icon.items.streetwear.<name>`; the **26 alternates** sit
  unused in `icons/unused/items/alt` (`ART.icon.items.<name>B/C`, registry status `resource`, not approved). Code:
  `itemArtSource` (`src/play/art.ts`) reads the map through `getArtSource`; the shared sticker map and the Kenney item
  fallback are gone (Kenney cursor icons stay only for shop rows; they are not in the art registry, so there was
  nothing to mark `needs-restyle`; the 12 old stickers are still bundled but unused). Locker icon art **22 → 32 pt**
  in the same 34 pt frame (1 pt per source pixel: exact on 2×/3× phones), drawn crisp (`pixelRenderStyle`, no fade).
  New `check:locker-icons` (5 groups); `check:streetwear-assets` no longer pins the old stickers. **Critique (honest):**
  `pixelart_workbench score` 77.8–97.5 on the live set (3 of 13 ≥ 90; the library's own `upgrade` icon is 83.7;
  `repair` changed nothing: the penalty is texture pixels, not strays); the 14-item rubric was **eyeballed by the agent**
  (no scripted rubric exists): 22–26 /28, none zero, **Ember Mantle is the weakest (22, workbench 77.8)** and Moss
  Habit 23. Raw frames, scores and `gen.json`: `art-src/pixellab/icon.items.streetwear/`; proof sheets
  `docs/divecore/locker-icons/`. Save stays **v33**. Gate green (178), reviewer PASS with warnings (fixed: crisp
  render, check label; a commit message wrongly said "candidate" status). **OTA published**: iOS
  `01a1552b-95c8-7c06-b294-e14f8afb291c`, Android `01a1552b-95c8-71bd-8db2-deb6f3d17925`, group
  `33b020eb-85c4-4a05-b057-c848c384cece` (message `divecore-finish-step7-locker-icons`). Not rendered in the app
  (proof sheets are mockups from the real frame sizes). Phone check: **Box 56** (not done).
  **Next: step 9 (the done pass). Minigames M1 still waits for emci's yes. Open for emci: approve the icons (only emci
  sets `approved`), swap any pick from the library, Boxes 53-56.**
- **Step 9 (done pass) built 2026-10-19.** Every "DONE WHEN" line is ticked or listed under "Open items" (section 3).
  **Real gaps found and fixed (copy only, no logic):** "Basecore" still showed in the Turf setup sheet
  (`defend-screen.tsx:4376`), the Avatar-unlocked notice and the dive-bust line (`src/app/play.tsx:632`, `:1497`), the
  research button's screen-reader label (`street-shell.tsx:169`), the Token shop stub blurb and the dead grove lede;
  the Tide Pass guide said "days you skip don't count" (`guide-content.ts:256`, now "the days you're away just wait for
  you"). New pin: a group in `check:locker-stats` scans 241 Play files for those words (10 groups now). **Dev kit:**
  the `dev*` store functions are plain exports; they are reached only from the dev kit in `src/app/play.tsx`, 
  `pet-dev-panel.tsx` and the dev paths of `use-play-store.ts`, and `check:play-dev-hidden` fails if any of the 91 Play
  files that call one does not carry the `PRE_LAUNCH_DEV` gate (it also pins the Pet Dev tab, the floating Dev kit and the
  Settings unlock row); that check and `check:shop-hidden` pass, and
  `RELEASE_MODE=1 check:release-mode` **passes with `PRE_LAUNCH_DEV` set to false** (tested with a temporary local edit,
  reverted, not committed; 43 dev-surface gates, 44 checks). It fails on purpose while the flag is `true`
  (invite-only): flipping it is on the launch checklist, see "Open items" 6. **Box 58** written (new player, old save,
  Larger Text, Reduce Motion over every screen). Save stays **v33**. Gate green (178), reviewer PASS with warnings (fixed here: a wrong
  line citation, Box 58's overclaims and store names, the dev-tool tick now `[~]`, the missing OTA record). **OTA
  published**: iOS `01a15574-d836-7a9c-8fde-c44d71bf3f74`, Android `01a15574-d836-7085-a314-4324e148a9eb`, group
  `0bc86f41-573b-48dc-a622-23aafe5b1b38` (message `divecore-finish-step9-copy`, commit `9aee9084`). Phone check: **Box
  58** (not done). Not covered by the stale-words scan: copy outside `src/play` and `src/app/play.tsx` (a repo-wide grep
  found none).

## Web research (read as data)

- Finch keeps its pet loop kind (a streak can pause; the pet grows with care, never punished) and leans on widgets
  for return visits:
  [Deconstructor of Fun](https://www.deconstructoroffun.com/blog/x0hd2ssr80y5n7gv0w967pg7hwd7tl),
  [Screenwise](https://screenwiseapp.com/media/finch-app).
- Neko Atsume: no deadlines, no failure, visits happen while you're away, so checking in feels like a gift:
  [A.V. Club on the NYT piece](https://avclub.com/read-this-the-new-york-times-explains-neko-atsume-s-ap-1798244391).
- Tamagotchi's death mechanic drew complaints; later models added pause and then "daycare":
  [Mental Floss](https://www.mentalfloss.com/fun/toys/tamagotchi-history),
  [Maize](https://www.maize.io/cultural-factory/tamagotchi-story/).
- Tower defense heroes: one hero per match that grows during the run (BTD6); in Kingdom Rush, hero choice smooths
  difficulty spikes. This supports our leader + one helper and smoothing the Main 4/7/9 spikes:
  [Bloons wiki](https://www.bloonswiki.com/Hero_(BTD6)), [Kingdom Rush](https://en.wikipedia.org/wiki/Kingdom_Rush).
- First-time guidance: teach through play, a step at a time, skippable and replayable, no long pop-up chains:
  [PocketGamer.biz](https://www.pocketgamer.biz/news/77289/pgc-digital-how-to-enhance-the-first-time-user-experience/),
  [GameAnalytics](https://gameanalytics.com/blog/tips-for-a-great-first-time-user-experience-ftue-in-f2p-games),
  [Overwolf](https://dev.overwolf.com/ow-native/guides/product-guidelines/onboarding/ftue).
- Gear screens: keep stat and style items visibly separate, label cosmetics, and show the effect where you equip:
  [Starbound wiki](https://starbounder.org/Inventory),
  [Beamdog forum](https://forums.beamdog.com/discussion/comment/805887).
- Daily counters: a badge that never clears teaches people to ignore it, so keep counts low and clear them on
  action. This is why the Today chip has no red dot and reads "All caught up" at 0:
  [Dolfy](https://www.dolfy.ai/blog/notification-badge-problem-red-dot-mobile-apps),
  [WebEngage](https://webengage.com/blog/what-are-app-icon-badges/).
- Dark patterns to avoid: "playing by appointment", FOMO timers, streak pressure:
  [arXiv 2412.05039](https://arxiv.org/html/2412.05039v1),
  [Deceptive Patterns](https://deceptive.design/articles/level-up-or-game-over-exploring-how-dark-patterns-shape-mobile-games).
  The UK Children's Code standard 13 bans nudges that push children to extend use:
  [ICO code v2.1](https://ico.org.uk/media/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services-2-1.pdf).
- Accessibility: follow the OS Reduce Motion setting (cut shake, parallax and transitions); text that grows and wraps:
  [Roblox docs](https://create.roblox.com/docs/production/publishing/accessibility),
  [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/?p=21).
