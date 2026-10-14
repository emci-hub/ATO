# Daily insights

Three static cards on **Explore**:
- 🎯 **Try this today**: one task a day, with **Did it ✓** and a 🔥 streak.
- ⚡ **Your superpower** / 🪫 **Your kryptonite**.
- 🗣️ **How you argue**.

Every line is hand-written in `src/lib/daily-insights/*-bank.ts` and picked on the phone. There is **no model call, no network and no AI library**. `check:daily-insights-bank` scans the folders to prove it. Bank version: `DAILY_INSIGHTS_BANK_VERSION` (1). Bump it when a line or card shape changes. Ids are forever.

## Placement (emci 2026-10-13)
- **All three cards live on Explore.** Home already has the daily insight's own "try today" line, so 🎯 stays off Home and Home never carries two try actions on one day. `shouldShowTryToday({ insightTryTodayShown, slotKind, crisisToday })` still encodes that rule.
- The order on Explore:
  1. Your shape
  2. 🎯 Try this today
  3. Categories
  4. ⚡/🪫 Superpower and Kryptonite
  5. 🗣️ How you argue
  6. Category deep dive
- **Locked until the full profile is done** (all 48, `isFullProfileDone`), the same unlock as the Categories tiles. No category reading shows mid-intake.
- **Hidden on a crisis day** (the phone flag OR the server flag, read the same way as Home) and whenever `canShowCategoryTeaser(slot)` is false. Explore has no Today slot, so it passes `'none'`.

## Copy rules (`rules.ts` → `validateInsightLine`)
1. Lines speak to "you" only. No gendered words: the story-v3 lists plus man, woman, guy, girl.
2. Word limits:
   - `text`: 20 words or fewer.
   - Tip, strength, watch-out and try lines: 16 or fewer.
   - Titles: 4 or fewer, sentence case.
   - "Why you" line: 22 or fewer.
3. No framework or test names (`containsFrameworkTerm`).
4. No claims of measured ability, and no clinical words.
5. Tone mix in the Try-today bank: at least 30% light and at least 10% dark. Dark jokes stay gentle and aimed at yourself. Banned: die, dead, kill, suicide, funeral.
6. Safety: nothing about money, driving, alcohol, quitting or exes. Every task can be done alone, for free, in under 15 minutes, and is safe to skip.
7. No sentence of 2+ words repeats inside a bank. One apostrophe style per bank. At most one `!` per line.

## Selection
**Try this today** (`pick-try-today.ts`) uses the seed `dailyTeaserRoll("try:<user>:<dateKey>")`. It never uses `Math.random` or the device clock; `dateKey` is the app's day in the user's timezone.
1. Start from the ready categories.
2. Drop the provisional categories (see below).
3. Drop any category picked in the last 3 days, unless that leaves nothing.
4. Choose one with `pickTeaserCategory`.
5. Work out the lean: bars use `leanHighLow`, maps use `provisionalMapLean`.
6. Mode by weekday:
   - Mon, Wed, Fri and Sun are **strength**.
   - Tue, Thu and Sat are **stretch**.
   - Exception: low Resilience and low Steadiness always get **strength**. Their stretch lines are validated but not reachable in v1.
7. The day's pick is stored, so it never moves mid-day. If the stored line is gone or hidden, it re-picks.

**Superpower / Kryptonite** (`pick-superpower.ts`) uses ready bar categories only.
- The highest bar is the superpower. It shows only when that bar is 0.5 or above.
- The lowest bar is the kryptonite. It shows only when that bar is below 0.5.
- Ties go to catalog order.
- The card is hidden when fewer than 3 bars are ready or the spread is under 0.10.

**How you argue** (`pick-conflict.ts`) needs both `conflict_assertiveness` (A) and `conflict_cooperativeness` (C) to be stable (`reportStableValue`). Intervals are closed.

| A and C | Style |
|---|---|
| Both in [0.40, 0.60] | Deal maker |
| A ≥ 0.5, C ≥ 0.5 | Team fixer |
| A ≥ 0.5, C < 0.5 | Straight shooter |
| A < 0.5, C ≥ 0.5 | Peacekeeper |
| A < 0.5, C < 0.5 | Quiet exit |

## Provisional leans
**Love, Independence and Structure leans are provisional until emci signs off; lines are hidden in prod.**
- `DAILY_INSIGHTS_SHOW_PROVISIONAL = false`.
- `resolveShowProvisional` can only turn it on while dev tools are live, so a production build always reads false.
- No Dev Lab toggle is wired in v1; it is a const only.
- The provisional map rules live in `provisionalMapLean`:
  - Love is high when avoidance < 0.5.
  - Independence is high when autonomy > relatedness.
  - Structure is high when conscientiousness > openness.

## Storage
- AsyncStorage key `ato.daily-insights.v1`, holding `{ version, userId, streak, history, picks }`. A payload for another account is ignored.
- Sign-out and Reset account wipe it, because `clearLocalAccountData` clears every `ato.*` key unless it is on the keep list.
- Writes are queued, so a double tap can't race.
- **Local only.** A reinstall or a second phone starts the streak at 0 (accepted for v1).
- Streaks are gentle. A missed day just hides the 🔥 line. There is no undo, no push and no analytics.

## Checks (all run inside `check:ota-gate`)
- `check:daily-insights-bank`
- `check:daily-insights-pick`
- `check:daily-insights-streak`
- `check:daily-insights-ui`
