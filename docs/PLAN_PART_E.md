# Divecore Part E: Premium pass ("Tide Pass") + Shop expansion

**Status:** APPROVED by emci (2026-09-30), NOT BUILT. Save v27 → v28. emci approved every §1 recommendation and every Part E add-on in §3.6 marked for Part E (A1 login streak, A2 reminders). No real money in this build (D1); T-E8 payments stays gated for later.
**Depends on:** Part D (PR #4, branch `cursor/divecore-part-d-den-pity-stones-01cc`) being merged first.
Part E builds on its pity counter, Shine Stones, Prism styles, `weekly_limit` and the hidden Shop.
**Who this is for:** emci first (the §1 decisions), then any coding agent picking it up cold.
Everything is here plus the code. Don't rely on chat history.

---

## 0. How to work (read first)

1. **Read first:** `AGENTS.md`, `CLAUDE.md`, `PROJECT_CONTEXT.md` (the Part D "BUILT (PR)"
   entry and the Part C entry), `docs/GOTCHAS.md`, `docs/PLAN_PART_D.md`, then the files in §2.
   This is **Play work only** (`src/play/**`, `src/app/play.tsx` shell, `scripts/check-*.ts`,
   `scripts/*-sim.ts`, `games/grove/**`). The one exception is T-E8 (payments). That is
   app work, it is gated, and it ships as its own change (§6).
2. **Assess and red-team before you code.** Write a short note in your reply: conflicts
   between this plan and the code (the code wins, then flag it), your own red-team on top
   of §7, and any number you'd change and why. If a conflict touches a §1 call, STOP and ask
   emci.
3. **Build order = §6 cards T-E1…T-E7, in order, in one pass.** **T-E8 is NOT part of the
   pass.** D1 is answered: no money now. Build T-E8 only when emci later says yes to money and answers D2–D4.
4. **Verify (§8)**, then ship like Part D: one `feat(play): …` commit, ONE OTA via
   `npm run ota:publish -- --branch production --message "…" --non-interactive`,
   a `PROJECT_CONTEXT.md` decisions entry, and a report (§10).
5. **House rules (all still hold, plus the Part E rules in bold):**
   - The odds shown are the odds used. Looks never change stats. The TD help band stays
     3–8% (`TD_HELP_BAND`). The daily Divecore Power ceiling stays 6.
   - The Shop never sells permanent power. No new packages. No casino words
     (gamble / casino / jackpot / bet; GAME_SPEC §7). Every Guide number comes from a
     code constant (`check:guide`). "Per day" means `petDayHolds`.
   - **The pass never touches Power, TD, Dive odds, pet growth speed, the daily Power
     ceiling, or free-egg counts and prices.** It only changes collection pace (Legendary
     progress) and looks (Prism styles, badge, frame).
   - **Nothing bought with real money has a random outcome.** (See 3.2.)
   - **The Classic shiny is never sold.** It stays earned-only.
   - **No real-money code in T-E1…T-E7.** The pass can only be granted by a dev button
     (and by earned rewards, if D7 is approved). The Paid shop keeps "Soon" pills.
   - The Shop stays hidden behind the dev unlock (`shopUnlocked`) until emci says otherwise.

## 1. Locked calls (emci approved the recommendation column on 2026-09-30; don't re-litigate)

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Is real money in at all?** `PLAY_EVERYTHING_FREE` and "Premium parked" (AGENTS.md) are live today. | Build T-E1…T-E7 now with **no** money. Decide money later (T-E8). |
| D2 | **Payment path** (see 3.5) | **Apple In-App Purchase** through our own Shop screen. Add a US-only web checkout link later only if US players matter. Canada can't use a web link. |
| D3 | **Pass price** | **US$1.99 / CA$2.99 for 5 days.** Maybe a 3-pass bundle at US$4.99. |
| D4 | **New package + native build for IAP** (breaks "no new packages"; can't ship by OTA; needs a server check, which is app/Supabase code outside the Play fence) | Approve only when D1 = yes. Pick `expo-iap` or RevenueCat at that time. |
| D5 | **Pass length counts "days you play" or calendar days** | **Days you play** (5 days you open Divecore). It's kinder, the clock can't cheat it, and it matches how buffs work. |
| D6 | **Prism Stone: pick your style, or a random style with odds** | **Pick your style** (no paid randomness). Gold and Prism styles cost 2 Prism Stones. |
| D7 | **Can free players earn pass days?** | **Yes:** day 7 of the login streak gives 1 Tide day (add-on A1). |
| D8 | **"Level boosts"** | **Don't sell pet growth speed** (it is power, see 3.4). A pass "level boost" is Legendary progress ×2 instead. |
| D9 | **"Shinies only for premium"** | **Prism styles are pass-only. The Classic shiny stays earnable by everyone** (see 3.2). |
| D10 | **The pass name** | "Tide Pass" (🌊 badge). Alternatives: Deep Pass, Glow Pass. |

## 2. Files to read + reuse map

Read: `pet-eggs.ts`, `pet.ts`, `playStore.ts`, `use-play-store.ts`, `shop.ts`, `shop-screen.tsx`,
`data/shops/token.json`, `data/shops/paid.json`, `guide-content.ts`, `guide-sheet.tsx`,
`play-buffs.ts`, `play-settings.ts` (MILESTONES, PlayStats, ribbons), `pet-card.tsx`,
`pet-egg-sheets.tsx`, `stone-sheet.tsx`, `den.ts`, `den-sheet.tsx`, `dev-unlock-row.tsx`,
`pet-reminder.ts`, `neon-viper.ts`, `src/app/play.tsx`, `scripts/collect-sim.ts`,
`check-pity.ts`, `check-stones.ts`, `check-shop-hidden.ts`, `check-guide.ts`.

| Feature | Extends (no new systems) |
|---|---|
| Tide Pass state + day counting | `playStore.ts` doc (v28 field `tide`), the `petDayHolds` day rule in `pet.ts`, and the same pattern as `play_stats.days_played` / `countDay` |
| Legendary progress ×2 | `pet-eggs.ts`: `pityEggNumber`, `pityAfterReveal`, `eggsUntilLegendary`, `gradeOdds`, `rollPet` gain a `step` (1 or 2). The pet's Part D `pity_from` stamp gains `pity_step`, set at pick and on every wake (`den.ts`) |
| Prism styles (pass-only) | Part D's `SHINY_STYLES`, `PRISM_STYLES`, `PRISM_STYLE_COLOR`, `shiny_style`, `styles` per hero, `prism_stones` (always 0 today), `stone-sheet.tsx` (add a Prism mode), `pet-looks.tsx` recolour, all-styles foil frame |
| Tide shelf (pass-only rows) | `shop.ts` `ShopTokenRow` (+`pass_only`, +`per_pass_limit`, +kinds `prism_stone`, `star_pearl`), `token.json`, `purchaseShopRow`, `tokenRowState` in `shop-screen.tsx` |
| Pass product card (Paid tab) | `paid.json` row `paid_tide_pass` (kind `pass`, `available:false` until T-E8), `ShopPaidRow` |
| Badge / frame / ribbon | `pet-card.tsx` frames, nameplate (`nameplateText`), ribbons in `play-settings.ts`, Journal rows |
| Dev grant | `dev-unlock-row.tsx` / Dev kit buttons (like Part D's +Stones, set pity) |
| Guide | `guide-content.ts` new section `tide`, plus "?" on the pass card and the Tide shelf |
| Sim | `scripts/collect-sim.ts` (add pass players + the guards) |
| Reminders | `pet-reminder.ts` ("Tide Pass: last day") |

## 3. The design

### 3.1 Tide Pass (the premium badge)
- **Length:** `TIDE_PASS_DAYS = 5` **days you play**. A pass day is used the first time you
  open Divecore on a new local day (`petDayHolds`). Days you skip aren't used. Setting the
  clock back can't add days. Setting it forward only burns your own days.
- **Stacking:** buying or earning more while active adds days, up to `TIDE_PASS_MAX_DAYS = 30`
  held. (Genshin's Welkin stacks too, capped at 180 days.)
- **Legendary progress ×2** (`TIDE_PITY_STEP = 2`): an egg revealed under the pass counts
  **two** toward the Legendary guarantee. Starting from zero, **egg 20 is guaranteed** (not 40)
  and soft pity starts at **egg 15** (not 30).
  - How: the egg's pity position becomes `since + step` (step 1 is exactly Part D's
    `since + 1`), and after a reveal the counter is `min(PITY_HARD − 1, since + step)`.
    `gradeOdds(band, ticket, since, step)` is what `rollPet` uses and what the Odds panel shows.
  - **The base odds table never changes.** Only the pity bar fills faster. The picker shows
    "Legendary guaranteed in X eggs (×2 Tide)" with X = `ceil((PITY_HARD − since) / step)`.
  - **When it counts:** the pet carries `pity_step`, stamped at egg pick and again on every
    Den wake, like Part D's `pity_from`. So a pass that ends while an egg is incubating still
    counts for that egg. An egg woken after the pass ends gets step 1.
  - It works for any egg, including ticket eggs. Release, swap, rebirth and restart still
    never change the counter.
- **One Prism Stone per pass** (`TIDE_PRISM_GIFT = 1`), given when the pass starts.
- **Badge + looks:** 🌊 "Tide" pill on the nameplate and pet card while active, a looks-only
  Tide card frame while active, and a permanent "Tide Friend" ribbon after your first pass.
  Journal: "Tide Pass: X days left · Legendary progress ×2".
- **The Tide shelf** in the Shop (3.3) is open while the pass is active.

**Why ×2 progress and not ×2 Legendary odds** (sim numbers in §5):
- **It fixes bad luck instead of printing Legendaries.** With ×2 odds always on, a Regular
  player gets **+68% more Legendaries a month** (11.8 → 19.8) and a Pro **+69%** (21 → 36).
  Legendaries stop feeling special, for free players too. With ×2 progress the gain is
  **+14–22%** for engaged players.
- **It helps the unlucky, which is what people actually hate.** One pass cuts a Casual
  player's worst case from 17 to 13 days and a Regular's from 8 to 5. ×2 odds leaves the
  worst case unchanged (17 → 17, 8 → 8), because unlucky streaks still hit 40.
- **There's one odds table.** ×2 odds means paying customers see a different % table.
  That reads as "pay for luck", the loot-box look ATO already worries about
  (`docs/BUSINESS.md`). ×2 progress shows the same table, and only the bar moves.
- **The label is honest.** "Legendary progress ×2" is literally what happens, so it still
  delivers emci's "x2".

### 3.2 Shinies: honest answer to "shinies only for premium"
- **Recommendation: split the looks, not the access.**
  - **Classic shiny = earned only.** It comes from the natural 1-in-50 roll and Shine Stones
    (10%, certain after 5 glimmers). It's never sold for money, so it stays a badge of play.
  - **Prism styles (Aurora, Ember, Frost, Void, Gold, Prism) = pass-only.** A Prism Stone
    makes a revealed non-shiny pet shiny in a Prism style. It can't restyle an existing
    shiny (Part D rule).
- **Why not "all shinies premium-only":** free players already have shinies today (Part D
  sources, the "first shiny" milestone). Taking that away is a visible downgrade. Pokémon GO
  never sells a guaranteed shiny, and its best shiny odds (Community Day) are free. The
  all-styles foil frame still needs the Classic, so collectors play *and* pay. Nobody can
  pay their way past play.
- **D6 (recommended): pick your style.** Spend 1 Prism Stone for Aurora, Ember, Frost or Void,
  or 2 for Gold or Prism (`PRISM_STYLE_COST`). No paid randomness means no loot-box question
  (Apple 3.1.1 odds rule, Canadian consumer-protection exposure, see §11), and rarity comes
  from price, not luck. This replaces Part D's random preview table (`PRISM_STYLE_ODDS`).
  Keep the constant only if emci picks the random option. *Alternative if emci prefers the
  chase:* random with the shown odds plus "no style that hero already owns" (odds rescaled and
  shown). Then the Paid shop must show odds before purchase.

### 3.3 Shop expansion (build on the existing Shop)
Three tabs: **Token shop · Tide shelf · Paid shop.**
- **Tide shelf** = token rows with `pass_only: true`. Everyone can see them. Without the pass
  they show "Tide Pass only" (disabled), so the value is visible. They're bought with **soft
  tokens** (earned only), and limits reset each pass (`per_pass_limit`).
  - **Prism Stone:** 120 tokens, 1 per pass.
  - **Star Pearl:** +5 Legendary progress (`STAR_PEARL_PITY = 5`, five eggs' worth on the
    counter, clamped at `PITY_HARD − 1`), 60 tokens, 1 per pass. This is the "Legendary
    boost" item, and it moves pity, not odds.
  - (Later, looks only) a Tide decor set and a Tide dye.
- **Token shop:** unchanged (Dive refresh, merge crate, Shine Stone 1/week). Fill the two
  stubs (decor, Look dye) only via add-on A4.
- **Paid shop:** add `paid_tide_pass` (badge "Pass", price label from D3, `available:false`
  until T-E8). Forge Edge / Emberheart "Paid Unique" stronger-gear rows **stay preview-only
  and are out of Part E scope**. They're stronger gear for money, the real pay-to-win
  risk, and need their own decision.
- **Token pressure check:** mini-games pay at most 30 tokens a day (`PET_TOKENS_DAILY_CAP`), so
  a 5-day pass earns about 150. Prism (120) + Pearl (60) + Shine Stone (120/week) is more than
  that on purpose: the player has to choose. Don't raise the token cap.

### 3.4 What we never sell (and why)
- **Pet growth speed / "level boosts":** a pet's stage is real power (Dive bust cut, TD
  pounce), and reaching God sooner means rebirth sooner, which is **+2% permanent TD damage
  each** (`PET_REBIRTH_STEP`). Selling it breaks "never sells permanent power". The safe
  "level boost" is Legendary progress ×2.
- Powers, Dive charges for money, merge crates on the Tide shelf, ×2 odds, extra daily eggs
  above 6, shells for money (shells buy eggs, so money → shells → eggs is paid randomness).
- **Pre-existing leak to fix before the Shop goes public:** the token merge crate sells
  Powers outside the daily ceiling (Part D noted it). T-E5 makes crate Powers count toward
  "Powers today".

### 3.5 Payment path: what "our own shop" can mean
Short version (sources in §11):
- **Canada (emci's storefront, and the testers'):** digital items and passes **must use
  Apple In-App Purchase**. An in-app link or button to a web shop is **not allowed** on any
  storefront except the US (3.1.1(a)). A Canadian legal challenge (CIPPIC at the Competition
  Tribunal) is pending but hasn't changed anything.
- **US storefront:** since 1 May 2025, apps may show buttons and links to their own web
  checkout (Stripe etc.) with no entitlement, currently at 0% Apple commission. That fee
  is **still in court**. The Ninth Circuit (Dec 2025) said Apple may charge some reasonable
  fee, and the Supreme Court took the contempt question on 30 Jun 2026 (argued from Oct 2026).
  Assume the 0% could change.
- **Web purchases used in the app** are allowed (3.1.3(b)) **only if the same item is also
  sold as IAP inside the app**. So a web shop is an *extra* door, never the only one. Emails
  outside the app may mention the web shop on any storefront (3.1.3).
- **Pass type:** auto-renewing subscriptions must be **at least 7 days** (3.1.2(a)), so a
  5-day pass must be a **consumable** (or non-renewing) IAP. IAP-bought currency can't expire.
- **Commission:** Apple Small Business Program, **15%** under US$1M a year.

**Recommendation:** "Our own shop" = **our in-game Shop screen and catalog** (designed by us,
built on the existing Shop). The money goes through **Apple IAP** (one consumable product,
`tide_pass_5d`). Optional later: a US-only "Buy on web" button (storefront check via StoreKit
`Storefront.countryCode`), and passes bought there are granted to the Supabase account.
**No new hard currency (gems) in Part E:** one product, fewer rules (no "currency can't
expire" or restore issues).
**Uncertain / check before T-E8:** the remand fee (US), App Review's treatment of a 5-day
consumable vs non-renewing pass, the age-rating questionnaire answers once IAP exists, and
whether `PRE_LAUNCH_DEV` / invite-only status affects review. Re-read the live guidelines
(last updated 8 Jun 2026) the day T-E8 starts.

### 3.6 Gap-filling add-ons (ranked; each one is a separate yes/no for emci)
| # | Add-on | Why (one line) | Effort | Reuses |
|---|---|---|---|---|
| A1 | **Login streak (7-day "Tide calendar")**: day 1 shells, day 3 a Shine Stone, day 5 a Rare+ ticket, day 7 1 Tide day. A missed day **pauses** the streak, it never resets it (no shaming) | There's no come-back reward today beyond free eggs, and it gives free players a taste of the pass | S | `play_stats.days_played`, `countDay`/`petDayHolds`, MILESTONES reward kinds (ticket, stone) |
| A2 | **Hero wish (hero pity)**: pick a wished hero in an egg; if it hasn't come in `WISH_PITY = 8` eggs of that type, the next one is it (odds shown) | With 16 heroes, "Find all 16" is pure luck today | S–M | the pity pattern (`pityEggNumber` style), `heroOdds`, `EGG_POOLS`, Part D stamp-at-pick |
| A3 | **Collection goals per hero**: all 4 grades, 5★, all forms, all styles → tickets, Stones, frames | Turns the Collection into goals and uses existing rewards | S–M | `MILESTONES`, `PetHeroRecord`, `ownsAllStyles`, `bestGrade` |
| A4 | **Fill the token-shop stubs** (Grove decor, Look dye): looks-only token sinks | Tokens pile up with nothing to buy, and the stubs already exist | M | `token.json` stubs, `pet-cosmetics.ts`, `pet-looks.tsx` |
| A5 | **Tide Track (28-day season)**: points from things you already do (eggs, dives, daily challenge, trips). A free row (shells, Stones, tickets, 1 Tide Pass at the end) and a pass row (Prism Stone, frames, badges, looks only). Claim earlier rows later, like the GO Pass | The standard "free + premium rows" pass the market expects, without power | L | MILESTONES reward plumbing, `shop_weekly` week logic, PlayStats counters |
| A6 | **Weekend egg festival**: one egg type features a hero, or shiny 1-in-25 for that weekend (dates as JSON, odds shown) | Gives a reason to come back on a specific day and is cheap to schedule | M | `dailySeed` date logic, `EGG_POOLS`, `SHINY_ODDS` via a dated override |
| A7 | **"Pass ending" + "free eggs ready" reminders** | Fewer surprise expiries and gentle retention | S | `pet-reminder.ts` |

Recommended for Part E itself: **A1 and A7** (small, and they make the pass fair and clear).
Then A2 → A3 → A4 as Part F. A5/A6 come after money is decided.

## 4. Numbers (all constants; Guide reads them)

| Constant | Value | Home |
|---|---|---|
| `TIDE_PASS_DAYS` | 5 (days you play) | new `src/play/tide.ts` |
| `TIDE_PASS_MAX_DAYS` | 30 | `tide.ts` |
| `TIDE_PITY_STEP` | 2 | `tide.ts` (used by `pet-eggs.ts`) |
| `TIDE_PRISM_GIFT` | 1 Prism Stone per pass | `tide.ts` |
| `PRISM_STYLE_COST` | Aurora/Ember/Frost/Void 1 · Gold/Prism 2 | `pet-eggs.ts` |
| `STAR_PEARL_PITY` | +5 (clamped at `PITY_HARD − 1`) | `pet-eggs.ts` |
| Tide shelf | Prism Stone 120 tokens 1/pass · Star Pearl 60 tokens 1/pass | `token.json` |
| `tide_pass_5d` price label | US$1.99 (D3) | `paid.json` (label only until T-E8) |
| A1 streak rewards | d1 10 shells · d3 1 Stone · d5 Rare+ ticket · d7 1 Tide day | `play-settings.ts` |

## 5. Sim targets (`sim:collect`, extended)

Add pass players to `scripts/collect-sim.ts` using the REAL functions with `step`: "one pass on
days 1–5" and "always-on pass" for Pro / Regular / Casual / Poor. Keep a ×2-odds row as a
**rejected comparison** (printed, not a target).

Planning sim (a Python port of `collect-sim.ts` at the PR's current constants: hard 40, soft 30,
3,000 runs; the script is at `/workspace/ato/sim/pass_sim.py` on the box, for reference only):

| Player | Free: Legendary 90% (worst) | One pass, ×2 progress | One pass, ×2 odds (rejected) | Legendaries / 30 days: free → always-on ×2 progress → always-on ×2 odds |
|---|---|---|---|---|
| Pro | 4d (6d) | 3d (3d) | 2d (5d) | 21.4 → 24.5 (+14%) → 36.2 (+69%) |
| Regular | 7d (8d) | 4d (5d) | 4d (8d) | 11.8 → 14.3 (+22%) → 19.8 (+68%) |
| Casual | 14d (17d) | 10d (13d) | 13d (17d) | 4.6 → 6.1 (+31%) → 7.6 (+63%) |
| Poor | 15d (17d) | 10d (12d) | 14d (17d) | 3.3 → 5.0 (+51%) → 4.9 (+48%) |

Note: the shipped PR sim shows Regular 6d (8d), not the ~10d target in Part D. If Part D is
retuned toward ~10d, re-run. The targets below are ratios and caps so they survive a retune.

**Targets (the sim fails if any break):**
1. **Free players unchanged:** with the pass off, every free number matches the Part D
   baseline exactly.
2. **One pass from day 1:** Regular 90% ≤ ~60% of free (≈ 4–6d if Part D lands at ~10d), and
   every player's worst case at least ~20% shorter than free.
   **Always-on pass:** every player's worst case ≤ ceil(`PITY_HARD`/`TIDE_PITY_STEP`) eggs ÷
   their eggs a day, +1 day.
3. **Inflation cap:** always-on pass adds ≤ +35% Legendaries per 30 days for Pro and Regular.
4. **Shiny:** a pass holder has a (Prism) shiny on day 1 (gift). Free Casual shiny 90% stays
   ≤ ~24d (Part D target, unchanged).
5. Guide timeline constants hold (add `COLLECT_TIMELINES.legendaryTideDays`, the Regular 90%
   with one pass).

## 6. Task cards (build order)

- **T-E1 Rules + save v28 + sim.** New `tide.ts` (constants, `tideActive`, `useTideDay` with the
  day rule, `grantTide(days, source)`, stack cap). `pet-eggs.ts`: `step` in pity functions and
  `gradeOdds`/`rollPet`, `PRISM_STYLE_COST`, `STAR_PEARL_PITY`. `pet.ts`: `pity_step` stamp.
  `playStore.ts`: `tide { days_left, day_ymd, passes_started, source_last }`,
  `prism_stones` becomes usable, per-pass shop counts, v27→v28 parse with safe defaults
  (no pass). `collect-sim.ts` pass rows + targets.
- **T-E2 Pass in the Pet room.** Nameplate pill, card frame, ribbon, Journal rows, egg picker
  "(×2 Tide)" + the pity bar with step, Odds panel with step, a reminder (A7).
- **T-E3 Prism Stones.** `stone-sheet.tsx` Prism mode: pick a pet (non-shiny, revealed, active
  or resting), pick a style (cost shown), confirm. `pet-looks.tsx` uses the existing style
  colours. The Collection gets styles. The pass gift goes in when a pass starts.
- **T-E4 Shop: Tide shelf + pass card.** `shop.ts` fields/kinds, `token.json` rows,
  `paid.json` `paid_tide_pass` (not for sale), a third tab, locked-row copy "Tide Pass only".
  `purchaseShopRow` refuses `pass_only` rows without an active pass and enforces
  `per_pass_limit`.
- **T-E5 Leaks + dev kit.** Merge-crate Powers count toward "Powers today". Dev buttons:
  Grant Tide (5 days), End Tide, +Prism Stone, set pity (exists).
- **T-E6 Add-on A1 (if approved).** Streak calendar in the Journal plus a small banner via
  `play-banner-queue.ts`.
- **T-E7 Guide + "?" + verify + ship** (§8, §9, §10).
- **T-E8 Payments: GATED, separate, app-side.** Only after D1–D4 are answered in writing.
  It includes: the IAP package + native build (not OTA), App Store Connect product
  `tide_pass_5d` (consumable), the Paid Apps agreement and tax/banking, a Supabase Edge
  Function that verifies the Apple transaction and grants pass days to the account (the
  client never decides a purchase is real, the same rule as the AI quota), restore/ledger,
  refund handling (Apple notifications → remove unused days), and, only if D2 includes the
  web, a US-only storefront check plus a Stripe checkout and webhook. Must be split from Play
  commits (`check:play-isolation`). Use TestFlight sandbox first.

## 7. Red-team list (handle each; add your own)

- **Clock tricks:** pass days use `petDayHolds`. Setting the clock back can't add days, and
  setting it forward only burns days. A stored day >2 days ahead resets as in Part D.
- **Banking ×2 in the Den:** the step is re-stamped on every wake, so eggs picked during the
  pass and woken after it get step 1. An egg incubating when the pass ends keeps its stamp
  (intended, and say so in the Guide).
- **Skipping the guarantee:** step 2 from 38 clamps at 39, so the next egg is still certain.
  Test 0→20 eggs = Legendary with step 2, and mixed steps.
- **The odds panel must use the same `step`** as the roll (shown = used). Test the picker vs
  `rollPet` at every position 0–39 for steps 1 and 2.
- **Prism Stone:** refuses on a shiny, an unrevealed pet or an egg. Can't double-charge
  (busy guard + store check). Gold/Prism need 2 Stones. Styles land in the Collection.
- **Classic never sold:** a check that no shop row, paid row or pass gift can produce
  `shiny_style = 'classic'`.
- **No power for money:** a check that the pass, Tide shelf rows and Paid rows never touch
  Powers, Dive charges, TD numbers, pet stage timers, or eggs above `EGGS_PER_DAY_MAX`.
  Re-run `sim:balance` (TD band unchanged) and `sim:dive`.
- **Shop hidden:** Tide shelf and pass card unreachable without the dev unlock
  (`check:shop-hidden` extended).
- **Old saves:** v27 → v28 = no pass, `prism_stones` 0, nothing lost.
- **Copy:** no casino words. Avoid "luck" framing for the pass ("progress", not "luck").
- **Free-player perception:** the Tide shelf is visible but locked. Keep the copy neutral
  ("Tide Pass only"), never shaming.
- **T-E8 risks:** a refund after days were used, a family-shared device, reinstall with a
  local-only save (the pass must live on the account, not only the local doc), the
  US-storefront check, and the court-ordered fee changing.

## 8. Verification

- `npx tsc --noEmit -p .` and `npm run lint`.
- New/extended checks (wired as `check:*`): `check:tide` (days, day rule, stacking cap, gift,
  ribbon, re-stamp on wake, old saves), `check:pity` (step 1/2, egg 20 guaranteed, shown =
  used, clamp), `check:stones` (Prism costs, no Classic for sale, refusals),
  `check:shop-hidden` (+Tide shelf), `check:guide` (+tide section, no hand-typed digits),
  plus a `check:no-power-for-money` assertion set (could live in `check:tide`).
- `npm run sim:collect` (targets §5), `npm run sim:dive`, `npm run sim:balance`,
  `npm run check:ota-gate` green before the OTA.
- A second-model code review before shipping.

## 9. Guide section (new `tide` section, "Tide Pass & Shop"; every number from constants)

Add `'tide'` to `GUIDE_SECTIONS` after `stones`. The lines (built like `stonesSection()`):
1. **What it is:** "The Tide Pass lasts `TIDE_PASS_DAYS` days you play. A day counts the first
   time you open Divecore that day, and days you skip don't count. Hold up to
   `TIDE_PASS_MAX_DAYS` days."
2. **Legendary progress ×`TIDE_PITY_STEP`:** "Every egg revealed with the pass counts
   `TIDE_PITY_STEP` toward the guarantee. From zero, egg ceil(`PITY_HARD`/step) is always
   Legendary, rising from egg ceil(`PITY_SOFT_FROM`/step). The odds table doesn't change; the
   bar fills faster. An egg counts double if it was picked or woken while the pass was on."
3. **Prism styles:** "Pass only. Each pass brings `TIDE_PRISM_GIFT` Prism Stone. Pick a
   style: [styles with `PRISM_STYLE_COST`]. Classic shinies are never sold. They come from
   play (one in `1/SHINY_ODDS`, and Shine Stones)."
4. **Tide shelf:** rows listed from `token.json` (`pass_only`), with price and per-pass limit.
5. **What it never changes:** "Powers, the `DIVECORE_POWERS_PER_DAY` daily Power ceiling, TD
   help (`TD_HELP_BAND`), Dive odds, how fast your pet grows, and free eggs
   (`FREE_EGGS_PER_DAY`, max `EGGS_PER_DAY_MAX`)."
6. **Without the pass:** "Everything else is the same, and a Legendary is still certain by egg
   `PITY_HARD`." (+ A1: "Day 7 of your streak gives a Tide day.")
7. **How long:** "With one pass, most regular players find a Legendary in
   `aboutWeeks(COLLECT_TIMELINES.legendaryTideDays)`."
8. **Buying:** before T-E8: "Not for sale yet." After T-E8: "Bought through Apple (price shown
   by Apple); refunds through Apple."
Also: "?" on the pass card, the Tide shelf header and the Prism sheet. Extend the eggs and
stones sections with one line each pointing to the Tide section.

## 10. Report to emci (exact shape)

```
Status:
Files changed:
What changed:
Verification run:
Result: pass / fail / not run
Risks or unknowns:
Next action:
```
Plus: the §5 sim table (free vs pass vs the rejected ×2 odds), anything changed from this plan
and why, and an iPhone test list: Dev kit → Grant Tide → see the badge/frame → the egg
picker says ×2 and the bar moves 2 per egg → set pity 38 → next egg Legendary → Prism Stone
on a pet (pick Gold = 2 Stones) → Tide shelf buys + limits → End Tide → shelf locks → Guide
"Tide Pass & Shop" → Shop still hidden without the dev unlock.

## 11. Research notes (sources)

**Comparable games (patterns):**
- *Pokémon GO.* GO Pass: free + Deluxe tracks, monthly, Deluxe US$7.99 (US$9.99 with +10
  ranks). Rewards claimed retroactively. Also sold on the Pokémon GO Web Store with web-only
  gifts. https://pokemongolive.com/news/go-pass-august-2026 ·
  https://bulbapedia.bulbagarden.net/wiki/GO_Pass. Timed boosts: Lucky Egg 2× XP for 30 min,
  Star Piece +50% Stardust:
  https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/2483-what-is-a-lucky-egg/. Shinies
  stay random, with the best odds free on Community Day:
  https://www.newgamenetwork.com/news/22839/pokemon-go-deluxe-go-pass-restricts-shiny-odds-to-reward-encounters/
- *Genshin Impact.* Welkin Moon US$4.99 / 30 days, daily login payout, not auto-renewing,
  stackable to 180 days, and days tick even if you don't log in:
  https://genshin-impact.fandom.com/wiki/Blessing_of_the_Welkin_Moon. Pity is never sold:
  soft from 74, hard at 90: https://playaware.gg/guides/genshin-pity
- *Brawl Stars / Clash Royale.* Seasonal pass US$6.99 / Plus US$9.99 (Plus = cosmetics + 20%
  XP boost); Clash Royale Diamond Pass US$11.99 with regional pricing:
  https://www.sportskeeda.com/mobile-games/brawl-stars-season-35-brawl-pass-cost-rewards ·
  https://supercell.com/en/news/clash-royale-regional-pricing-global/
- *Neopets Premium.* US$7.95/mo: convenience + extra pet slots + exclusive cosmetics and
  quests, no battle power: https://nc.neopets.com/membership/ ·
  https://www.jellyneo.net/?go=premium&id=perks
- *Finch (virtual pet).* Plus = cosmetics + extras, core care free:
  https://help.finchcare.com/hc/en-us/articles/37780200600589-Benefits-of-Finch-Plus
- *Monopoly GO.* Paid speed comes from multipliers and timed events, and the premium club
  is recurring perks: https://www.supercheats.com/monopoly-go-walkthrough-guide/monopoly-go-boost-events-explained
- **Pattern:** passes run 5–30 days at US$2–12. What gets boosted is **progress speed or
  extra rewards**, almost never base odds. Premium-exclusive items are **cosmetic**. Free
  tracks always exist, and the best rarity odds are often free events.

**Apple / payments (current as of 30 Sep 2026; guidelines last updated 8 Jun 2026):**
- App Review Guidelines 3.1.1 (IAP required for passes and currency; loot-box odds before
  purchase; IAP currency can't expire), 3.1.1(a) (no in-app purchase links except the US
  storefront), 3.1.2(a) (auto-renew ≥7 days), 3.1.3 / 3.1.3(b) (web purchases usable only if
  also sold as IAP; outside-app emails OK): https://developer.apple.com/app-store/review/guidelines/
- US change 1 May 2025: https://developer.apple.com/news/?id=9txfddzf
- Ninth Circuit, 11 Dec 2025 (contempt upheld; zero-fee ban sent back for a reasonable fee):
  https://cdn.ca9.uscourts.gov/datastore/opinions/2025/12/11/25-2935.pdf ·
  https://www.fenwick.com/insights/publications/ninth-circuit-largely-upholds-ruling-in-epic-v-apple
- Supreme Court cert granted 30 Jun 2026 (No. 25-1311, contempt question only):
  https://www.supremecourt.gov/docket/docketfiles/html/public/25-1311.html
- Litigation timeline + US costs: https://tiun.io/blog/ios-external-payments-us-cost-2026
- Canada: no change; CIPPIC application at the Competition Tribunal (Jan 2026):
  https://www.cippic.ca/news/cippic-takes-apple-to-competition-tribunal-over-alleged-anti-competitive-app-store-practices
- Small Business Program 15%: https://developer.apple.com/app-store/small-business-program/
- EU (not relevant unless ATO ships there): https://developer.apple.com/support/payment-options-on-the-app-store-in-the-eu

**Loot boxes / fairness:**
- Canada has no loot-box statute, but consumer-protection claims over paid random items are
  live (EA v. Sutherland, 2026 BCCA 245):
  https://kylaleelawyer.substack.com/p/are-video-game-loot-boxes-illegal ·
  https://amarvrlaw.com/loot-boxes-in-game-purchases-and-canadian-consumer-protection-law/
- Players see cosmetics as fair and paid power as unfair; paid convenience is a grey zone:
  https://guof.people.clemson.edu/papers/chiplay22.pdf ·
  https://link.springer.com/article/10.1007/s10551-021-04970-6
- Takeaway for Divecore: grades and shinies are **looks only**, so even the pass is
  pay-for-collection-speed, not pay-to-win. Keep paid items non-random and odds unchanged, and
  that stays true and easy to explain.
