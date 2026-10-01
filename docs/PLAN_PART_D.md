# Divecore Part D — Den, egg pacing, Legendary pity, Shine Stones

**Status:** APPROVED by emci (2026-09-30), NOT BUILT. Save v26 → v27.
**Who this is for:** any coding agent picking this up cold. Everything you need is
here plus the code. Do not rely on chat history.

---

## 0. How to work (read first)

1. **Read before you touch anything:** `AGENTS.md`, `CLAUDE.md`, `PROJECT_CONTEXT.md`
   (the 2026-09-30 Divecore entries, newest first), `docs/GOTCHAS.md`, then the files in
   §2. Play is a fenced mini-app: this is **Play work only** (`src/play/**`,
   `src/app/play.tsx` shell, `scripts/check-*.ts`, `scripts/*-sim.ts`,
   `games/grove/**`). Never touch app code in the same change.
2. **Do your own assessment and red-team first.** Before writing code, read the real
   code and write a short note (in your reply, not a file) covering:
   - anything in this plan that conflicts with the code as it is now (things may have
     moved since this was written — the code wins, then flag it);
   - your own red-team pass over §6 plus anything new you find;
   - any number you'd change, with a reason.
   If you find a conflict that changes a locked call (§1), STOP and ask emci. Otherwise
   continue — don't wait for approval on small fixes.
3. **Build order = §5 cards, in order, in one pass.** Don't check in after each card.
4. **Verify at the end** (§7): typecheck, lint, the full gate, the sims. Fix failures.
   Never weaken or delete a test to make it pass — if a rule changed on purpose, update
   the assertion and say why.
5. **Ship:** one commit (`feat(play): …`), push to `master`, ONE OTA via
   `npm run ota:publish -- --branch production --message "…" --non-interactive`
   (never bare `eas update`), then add a `PROJECT_CONTEXT.md` decisions entry
   (replace the "APPROVED, NOT BUILT — Divecore Part D" entry) and report (§8).
6. **House rules that always hold:**
   - The odds shown are the odds used (grade odds, pity, Stone %, Prism styles).
   - One seed per egg, chosen at egg pick, rolled once at Child; nothing rerolls it.
   - Looks never change stats. TD help from pet + Dive stays in the 3–8% band
     (`TD_HELP_BAND` in `play-buffs.ts`). Daily Divecore Power ceiling stays 6.
   - Existing art / recolour only. No new packages. No purchase code, no Apple
     checkout. No casino words (gamble/casino/jackpot/bet) — GAME_SPEC §7.
   - Every number in the Guide comes from a code constant (`check:guide` enforces).
   - Day rule for anything "per day": `petDayHolds(today, storedYmd)` in `pet.ts`
     (clock set back can't reopen a day; a stored day >2 days ahead resets).

## 1. Locked calls (emci — don't re-litigate)

1. Keep the current Legendary odds (`BAND_WEIGHTS` in `pet-eggs.ts`). Targets are the
   **90% times** to a first Legendary: Pro ~5 days, Regular ~6 days, Casual ~19; pity caps
   everyone at ~20 days. **Regular ~6d was accepted by emci on 2026-09-30** (sim band
   5–7 days, worst ≤ ~10 days). The earlier ~10 day figure is impossible under these
   locks: the daily egg plus ticket recycling already land 9 in 10 Regular players
   inside a week, and soft pity can only make that faster.
2. **Pity:** a Legendary is guaranteed on the **40th egg** since your last Legendary,
   with **soft pity from egg 30** (Legendary odds rise each egg 30→39; the odds shown =
   the odds used; 100% at 40).
3. **Shine Stone:** 10% to make a revealed non-shiny pet shiny (classic colour). Each
   failure = +1 **glimmer** (per player, not per pet). At **5 glimmers** the next Stone
   is certain (the 6th Stone). Glimmers reset when a Stone succeeds.
4. **Eggs:** 2 free a day; extra eggs **10 / 20 / 40 / 80 shells**; max **6 eggs a day**.
   **+1 free egg** for passing the daily challenge (once a day). A trade-up ticket brings
   its own egg (doesn't use a free/bought egg).
5. **Hide the Shop:** the Shop hub tile (`HUB_TILES` in `neon-viper.ts`) shows only
   with the dev unlock (`usePlayDevUnlocked` / `PRE_LAUNCH_DEV`), plus a new
   `check:shop-hidden`. Today the Shop is reachable by any Divecore player.
6. **Extras, all approved:** soft pity (above); daily-challenge free egg (above); Den
   favourites + sort by grade / shiny; a "glimmer" glow on a pet that failed a Stone;
   a looks-only card frame for owning every shiny style of one hero.

## 2. Files to read

`pet.ts`, `pet-eggs.ts`, `pet-egg-sheets.tsx`, `pet-sheets.tsx`, `pet-screen.tsx`,
`pet-room.tsx`, `pet-menu.tsx`, `pet-card.tsx`, `pet-looks.tsx`, `playStore.ts`,
`use-play-store.ts`, `play-buffs.ts`, `expedition-ladder.ts`, `dive-loot.ts` +
`data/dive-loot.json`, `game-records.ts`, `guide-content.ts`, `guide-sheet.tsx`,
`play-settings.ts` (MILESTONES, PlayStats), `shop.ts`, `shop-screen.tsx`,
`data/shops/token.json`, `data/shops/paid.json`, `neon-viper.ts`, `command-hub.tsx`,
`src/app/play.tsx`, and the checks `scripts/check-pet*.ts`, `check-guide.ts`,
`check-stage-power.ts`, `check-buffs.ts`.

Known facts (verified 2026-09-30 — re-check):
- The grade/hero/shiny roll happens **inside the pet's aging** at Child
  (`rollPet(seed, egg, band, ticket)` in `pet-eggs.ts`, called from `pet.ts` evolve),
  which can't see the save. `use-play-store.ts` saves a reveal the moment the view shows it.
- `chooseEggDoc`, `changeEggDoc` (egg-only, refunds the ticket, fresh seed),
  `applyTicketDoc`, `releasePetDoc` → `recordLeaving` (Hall + 1 shard),
  `rebirthPetDoc`, `resetDivecore` (fresh save, keeps settings) are in `playStore.ts`.
- `petRecolor(hero, shiny, dyeOn)` takes the shiny colour from `HERO_SHINY_COLOR[hero]`
  only; there's no per-pet colour today. "Dye never on a shiny" is enforced in
  `dyeApplies` and in `petRecolor`.
- `PetHeroRecord = { copies, shinies, grades, forms, dye }` (`pet-eggs.ts`).
- The Shop has daily limits only (`shop_daily`); no weekly concept exists yet.
- The daily challenge always uses **Normal** rules (`DAILY_LEVEL`), so "Gold on Insane
  in the daily" is impossible — use "the first daily-challenge Gold of the day".

## 3. The design

### Den (keep many pets)
- 6 slots to start (the active pet counts as one). More slots for shells:
  7th **100**, 8th **150**, 9th **225**, 10th **340**, 11th **500**, 12th **750**. Max 12.
- One **active** pet (the room, perks, pounce, Pumped). Others **rest** in the Den.
- Resting pets are **frozen**: no aging, no hunger/mood loss, no care mistakes, no
  warmth loss (an egg's care score only counts active time). Card: "Resting in the Den".
- On activation set `seen_at = max(now, pet.seen_at)` so no time passes while resting.
- **Swap blocked:** during a dive (`dive_run != null`), while the active pet is away on
  an expedition, while a mini-game is open (UI). TD can't run at the same time (the Den
  is only in the Pet room) — confirm this in code.
- From the Den: set active, release (shard as today), view card, rename, favourite,
  sort by grade / shiny. Use static figures in the list (no animated sprites).
- A **new egg** needs a free slot, becomes the active pet; the old active pet rests.
  Full Den → "Free a slot or buy one".
- Resting pets count in the Collection (copies/stars), not only the active pet.
- Buffs, expedition ladder, token cap, Power ceiling, game records are per player —
  swapping doesn't touch them.
- **Old saves:** the current pet = active in slot 1, Den empty, 6 slots.

### Egg pacing
- `eggs_today` + `eggs_ymd` (day rule). 2 free, then 10/20/40/80 shells, max 6/day.
- Daily challenge pass → +1 free egg once a day (store a flag on the daily state).
- Ticket egg: doesn't count against free/bought eggs.
- The picker shows "Free eggs today: X/2", the next price, and the pity bar.
- "Change egg" doesn't cost another egg (it swaps type/seed in the same slot — as today).

### Legendary pity
- `eggs_since_legendary` on the save. +1 at each reveal at Child (any egg, incl. ticket
  eggs); 0 on any Legendary. Release / swap / rebirth / restart / clock never change it.
  Old saves start at 0.
- The pet carries a **pity stamp** (e.g. `pity_from: number` = the counter value it will
  reveal at), set whenever it becomes active before Child (pick, activation). The roll
  uses the stamp → soft-pity odds. Recalculate on every activation.
- Soft pity (propose exact curve, keep it simple and shown): from the 30th egg the
  Legendary weight rises each egg so the 40th is 100%. `gradeOdds` must take the pity
  position so the Odds panel shows the same numbers the roll uses.
- Show "Legendary guaranteed in X eggs" (picker, Journal, Odds panel).

### Shine Stones
- `shine_stones`, `glimmers`, `stones_used`, `stone_seq` (seeded sequence for rolls so
  killing the app can't reroll), `prism_stones` (always 0 for now).
- Use on a revealed non-shiny pet (active or resting): roll from the saved sequence;
  success → `shiny = true`, `shiny_style = 'classic'`; fail → glimmers +1 and a glimmer
  glow on that pet. At 5 glimmers the next Stone succeeds.
- A shiny can't take another Stone; Prism can't restyle an existing shiny.
- **Prism styles** (Paid Shop preview only — never usable in this build):
  Aurora `#4FFFD2` 24% · Ember `#FF6A3D` 22% · Frost `#9FD8FF` 22% · Void `#7B4DFF` 16% ·
  Gold `#FFC83D` 10% · Prism magenta + rainbow sparkles 6%. Uses the existing hue-blend /
  wash recolour + sparkle colour. Add `shiny_style` to the pet and styles owned per hero
  to the Collection (all-styles frame on the card).
- **Sources (play, since the Shop is hidden):**
  - first daily-challenge Gold of the day (either game): 1 Stone
  - the 4h expedition trip (step 7): 20% a Stone, taken from the non-Power part (the
    Power chance must stay exactly as today)
  - Abyss 2% / Hadal 5% of finds (replace shell weight in `dive-loot.json`)
  - every 5th day played (`play_stats.days_played`): 1 Stone
  - milestones: first Legendary, 10 eggs, first Insane Gold: 1 each
  - Token Shop (hidden): 120 tokens, 1 a week (add a weekly limit)
- Target: a regular player gets about one Stone every 3 days. Tune with `sim:collect`.

### Shop (stays hidden)
- Token Shop: a Shine Stone card (looks only — fits the "never sells permanent power"
  rule). Paid Shop: a Prism Stone preview card ("SOON", price label, not for sale), same
  style as the existing previews.

### Guide + Journal + "?"
- Guide sections from code constants: Den, free eggs + prices, pity (soft + hard),
  Stones, glimmers, styles, and timelines in plain words built from the sim constants
  ("about a week if you play every day").
- Journal: eggs since last Legendary, glimmers, Stones used, styles owned.
- "?" links on the Den, the egg picker and the Stone screen.

## 4. Sim targets (`sim:collect` — build it first)

Write `scripts/collect-sim.ts` (`npm run sim:collect`) using the REAL constants
(`BAND_WEIGHTS`, `SHINY_ODDS`, `SHARDS_PER_TICKET`, the pity/soft-pity function, Stone
odds, glimmer pity, egg pacing). Players:
- Pro: Perfect care, 2 free + 2–4 bought eggs a day, daily egg, a Stone every ~2 days.
- Regular: Great care, 2 free + 1 bought + daily egg, a Stone every ~3 days.
- Casual: Good care, 2 free eggs only, a Stone every ~4 days.
- Poor care, 2 eggs/day, no Stones (the pity floor).
Model: release Commons + Rares for shards → tickets (as the collector would).

Baseline from the planning sim (today's odds, hard pity 40, glimmer pity 5):

| Player | Legendary 90% (worst) | Shiny median / 90% |
|---|---|---|
| Pro | 5d (10d) | 5d / 12d |
| Regular | 10d (14d) | 8d / 18d |
| Casual | 19d (20d) | 12d / 24d |
| Poor | 20d (20d) | — |

**Targets after adding soft pity + the daily egg:** Legendary 90% Pro ~5d, Regular
~6d (two-sided 5–7d, worst ≤ ~10d), Casual ≤ ~20d; nobody > ~20d. Shiny 90% Casual
≤ ~24d. **Regular ~6d accepted by emci 2026-09-30**, replacing ~10d, because the
daily egg + tickets make ~10d impossible under the locks in §1. Show before/after
and say what you tuned.

## 5. Task cards (build order)

- **T-D1 Rules + save v27 + sim:collect.** `den.ts` (new: slots, prices, swap/freeze),
  `pet-eggs.ts` (soft/hard pity in `gradeOdds` + roll, Prism styles, Stone roll from a
  sequence), `pet.ts` (pity stamp, `shiny_style`, glimmer flag), `playStore.ts` (den,
  eggs today, pity counter, Stones/glimmers/sequence, parse v27 with safe defaults),
  `scripts/collect-sim.ts`.
- **T-D2 Den sheet + swap + new egg.** New `den-sheet.tsx`; `pet-screen.tsx` (Den
  icon/menu entry), `pet-menu.tsx`, `pet-card.tsx` ("Resting in the Den", frame),
  Collection counts resting pets.
- **T-D3 Egg picker.** Free eggs, prices, max 6, daily egg, ticket egg, pity bar, odds
  with pity (`pet-egg-sheets.tsx`, `chooseEggDoc`).
- **T-D4 Stones.** Sources (dive-loot, expedition step 7, daily Gold, days played,
  milestones), a Stone sheet (pick a pet, use, result), styles in the Collection,
  glimmer glow (`pet-looks.tsx` colour per style).
- **T-D5 Shop.** Hide the tile behind the dev unlock; Stone card + weekly limit;
  Prism preview card.
- **T-D6 Guide + Journal + "?".**
- **T-D7 Verify + ship** (§7, §8).

## 6. Red-team list (handle each; add your own)

- Reroll via Den/swap: the seed is fixed at pick; the stamp is recalculated on every
  activation; only the active pet reveals.
- Freezing exploits: resting stops growth too; egg warmth only counts active time;
  evolution forms come from counters earned while active.
- Pity tricks: counter never reset by release/swap/rebirth/old saves; a ticket Legendary
  resets it; "Reset Divecore" wipes everything on purpose.
- Stone exploits: saved roll sequence (no app-kill reroll); glimmers per player; a
  shiny can't be stoned again; releasing a stoned shiny keeps it in the Collection
  (intended).
- Shells: only new sinks (eggs, slots) → no inflation; check the Lamp-in-~3-days target
  in `sim:dive` is still reasonable and say so.
- Power: the 4h-trip Stone and the Abyss/Hadal Stone must not change any Power chance
  (`check:stage-power` holds the expedition Power shares).
- Merge crates (token shop) sell Powers outside the daily ceiling — pre-existing; fine
  while the Shop is hidden. Note it.
- Old-save migration: v26 pet → active slot 1; nothing lost; Hall/Collection unchanged.
- Phone performance: static figures in the Den, max 12.

## 7. Verification

- `npx tsc --noEmit -p .` and `npm run lint`
- New checks, wired as `check:*` scripts (the gate picks them up automatically):
  `check:den`, `check:pity`, `check:stones`, `check:shop-hidden`; extend `check:guide`.
  They must cover at least:
  - free eggs reset daily and the clock can't cheat them; extra egg prices; max 6;
    the daily-challenge egg once a day
  - a Legendary by the 40th egg; soft-pity odds shown = used; the counter survives
    release / swap / rebirth / old saves
  - Den pets don't age or lose care; swap blocked mid-dive / expedition / game
  - Stone 10% + certain after 5 glimmers; the roll can't be redone; a shiny can't take
    a Stone; Prism odds shown = used; dyes never on a shiny
  - the Shop is unreachable without the dev unlock
  - Guide numbers match the constants (no hand-typed digits)
- `npm run sim:collect` (targets §4), `npm run sim:dive`, `npm run sim:balance`
  (TD band unchanged), `npm run check:ota-gate` (must be green before the OTA).
- Then a code review pass (yours or a second model) before shipping.

## 8. Report to emci (exact shape)

```
Status:
Files changed:
What changed:
Verification run:
Result: pass / fail / not run
Risks or unknowns:
Next action:
```
Plus: the sim before/after table, anything you changed from this plan and why, and an
iPhone test list (numbered steps emci can tap through: Den, swap rules, egg picker and
prices, pity bar, a Stone use + glimmers, Collection styles, Guide sections, Shop hidden).
Use the Dev kit for shortcuts (add dev buttons: +Stones, set pity counter, fill Den).
