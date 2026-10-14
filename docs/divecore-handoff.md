# Divecore minimal — handoff (paused 2026-10-14)

Branch `feature/divecore-minimal` (off master `e121ef1c`) · draft PR https://github.com/emci-hub/ATO/pull/33 (Auto-fix on).
The full brief is emci's pasted task (Steps 0-3 + Deliverables + Rules). This file is the state, so the next agent
does not redo the audit. **Do not merge. Do not publish an OTA.** Play-only (`.cursor/rules/play-isolation.mdc`,
`.cursor/rules/fixed-regions.mdc`). No new native deps; package.json may only gain check scripts.

## Done
| Step | Output |
|---|---|
| 0 Audit — nav, entry points, back map, thumb zones, names | `docs/divecore-audit/nav.md` |
| 0 Audit — 80 notice surfaces, classified, PlayBanner facts | `docs/divecore-audit/notices.md` |
| 0 Audit — stage size root cause + proposed fixed heights | `docs/divecore-audit/layout.md` (§7 causes, §8 `computeStageFrame` table, §9 onLayout logs still to run) |
| 0 Copy audit script + top 20 | `scripts/divecore-copy-audit.ts` (exports `extractPlayCopy`, `countWords`) · `docs/divecore-audit/copy-top20.md` |
| 1 Research, rules R1-R12, 37 verified links | `docs/divecore-ui-research.md` |
| Fence fix | `scripts/check-play-isolation.ts`: `docs/divecore-*` and `docs/GOTCHAS.md` are neutral (the script classed docs as app, the .mdc allows Play docs) |
| PR description = Audit + Research + open questions | PR #33 body |

### Work in progress (committed with this file, not wired yet)
- `src/play/notify/queue.ts` — pure notice queue: kinds celebrate/notify/error (FEEDBACK/STATUS/HELP/CONFIRM never queue),
  priority high > normal > low, FIFO, dedupe by dedupeKey or kind+title within 10 s → ×N counter, cap 4 waiting (oldest
  low drops first), pause = only ERROR shows, same kind never back to back < 1 s, durations 3.5 / 3 / 5 s (+1 s Reduce
  Motion), "Important only" = ERROR + CELEBRATE, title ≤ 3 / body ≤ 10 words (`noticeCopyProblem`), `noticeAnnouncement`.
- `scripts/check-notify.ts` — pure-queue tests (should pass now) + static checks that will FAIL until the migration is
  done (expects `src/play/notify/notice-lane.tsx`, no `setToast`/`onBanner`/old PlayBanner, ≥10 literal `notify({…})`
  calls, `useNoticeLaneTop()`, `REDUCED_FADE_MS = 200`, `REDUCED_DRIFT_PX = 2`). NOT in package.json yet — add
  `"check:notify": "tsx ./scripts/check-notify.ts"` when the lane exists (ota-gate runs every `check:*`).
  Note: the brief's lane is IN LAYOUT between TopBar and Stage; adjust the `useNoticeLaneTop` assertion if the lane
  ends up positioned by layout rather than a measured top (keep "no hard-coded 52").
- `src/play/play-settings.ts` — new `tipsSeen: Record<'warm'|'feed'|'dive'|'turf', boolean>` and `notices: 'all'|'important'`
  with safe migration (a save that saw the tutorial / has progress = all tips seen). Typecheck green.

## emci's decisions so far
- **Notice lane on fullscreen arenas (Turf War wave, Underground): thin 28 pt translucent one-line strip.** ✔
- **Word limits: enforce now on what you see first** (notices, buttons, tabs, coach tips, "?" bullets, HUD, pet speech);
  long sheet paragraphs go into a baseline allowlist the check only lets shrink. ✔
- **Ask again (emci paused before answering):**
  1. The Block — A (recommended) remove it, Hideout is home, hunger/mood + Claim chip in one strip under the top bar;
     B keep a small Block tab.
  2. Turf War setup — A (recommended) board is a fixed Stage out of the ScrollView, coach / gear score / skip-ahead move into
     one Setup sheet, bottom region same height in setup and wave; B keep setup scrolling, fix only the wave.
  Show rendered mockups again before asking (emci rule: show samples before any layout choice).
- Defaults stated in the PR, not yet confirmed: names Hideout · Underground · Turf War · Locker (Fits / Blades) · Store ·
  Caps; Subway Tokens = icon "n/10"; Turf War "scrap" → "run Caps"; Avatar star tokens → "Stars"; Underground tab icon =
  library `icon.streetwear.subway-train` (PixelLab MCP was down, 502).

## Key facts the next agent needs (from the audit)
- `streetUiOn()` is always true (Classic retired, `art-skin.ts`); CommandHub only renders while `view == null`.
- Real bar heights: resource bar renders **56** (code says 44), Turf War HUD 56, tab bar `~51 + max(bottom, 6)`,
  Turf dock `116 + max(bottom, 8)`, Dive top ≈113, Dive dock ≈264. PlayBanner `TOP_BAR_H = 52` is 4 pt inside the bar.
- Turf War board = `W-24` square inside the `play.tsx` ScrollView (`defend-screen.tsx:5285`, drag hands touch to the
  scroll at `:2704`); setup → run bar swap moves it 60 pt; SE clips 28 pt.
- Hideout room canvas 352×576 fitted by height (`hideout-iso.ts:507-532`), controls row reserve 64 inside the stage.
- Store is dev-only (`shopUnlocked` = PRE_LAUNCH_DEV + dev PIN). About is unreachable in Street. Pet menu sheet unreachable
  in Street. ⚙ flips to the Block before opening Settings.
- Bugs to fix in passing: Street speech bubble never clears + silent to VoiceOver (`pet-screen.tsx:447`); Turf coach tip
  unreachable with a sword aura (`defend-screen.tsx:3932-3952`); reveal label hides the grade (`pet-reveal.tsx`);
  "Avatar unlocked" says "tap Use"; Dive gear note / sword notice go stale.
- Out of scope (app file): `src/lib/push.ts:73` shows OS notifications as system banners in-app — flag only.

## Remaining plan (Steps 2-3 + deliverables)
1. Re-ask the two open decisions (with mockups).
2. Write `docs/divecore-ui-spec.md` (layout regions, notify kinds/rules, nav, top bar, thumb zone, help, FTUE, word
   limits, names, Reduce Motion) from the brief + decisions + layout.md §8 numbers.
3. `src/play/stage-layout.tsx`: `computeStageFrame(screenId, window, insets)` (pure, numbers from layout.md §8, lane 56 /
   28 on arenas), `<GameScreen topBar notice stage dock tabBar>` + FloatLayer + ModalLayer, `useStageFrame`, `useStageRect`.
   Wrap Hideout, Underground, Turf War (board out of the ScrollView), pet games, Locker, Store. Remove grow-only from the
   Dive dock; explicit heights.
4. `src/play/notify/`: `notify()` store + `notice-lane.tsx` renderer (fade 200 ms + 2 px drift under Reduce Motion,
   `AccessibilityInfo.announceForAccessibility`, live region, hint when tappable, body `numberOfLines={1}`), pause while
   modal / tip / wave-critical; `useControlFeedback` for FEEDBACK; migrate all banners per notices.md (old → new kind),
   rewrite copy to the limits; delete `play-banner.tsx` + `play-banner-queue.ts` (fold `bannerEvents` into notify),
   retire `check:play-banner` into `check:notify`.
5. Nav: one Street shell; tabs Hideout · Underground · Turf War · Locker · Store (store only unlocked); land on Hideout;
   one entry per destination; back → Hideout, Dive back → the tab that opened it; ⚙ opens in place with Exit Play first
   row + Notices All/Important + Replay tips + Guide; "?" context sheet (≤ 3 bullets ≤ 10 words + Full guide); dev kit and
   DevUnlockRow only in PlayDevFab / dev slot.
6. FTUE: replace `DivecoreTutorial` with 4 coach tips on the FloatLayer (warm egg · Feed · Underground tab · Turf War tab),
   ≤ 6 words, pulsing ring (slow breathe under Reduce Motion), one at a time, tap anywhere, never blocks input.
7. Checks in package.json: `check:stage-bounds` (incl. pure test: frame identical with/without notice/tip/pause/loading at
   max/15/se/and), `check:notify`, `check:divecore-copy` (uses `extractPlayCopy` + allowlist baseline file),
   `check:divecore-nav`, `check:divecore-names`, `check:divecore-ftue`; update `check:fixed-regions` to stage/lane pins;
   keep `check:play-isolation` green. Rule file `.cursor/rules/stage-bounds.mdc` (alwaysApply, globs src/play/**,
   src/app/play.tsx) + same rule in docs/GOTCHAS.md, CLAUDE.md, AGENTS.md; point fixed-regions.mdc at it.
8. Gate: `npm run typecheck`, `npm run lint`, `npm run check:ota-gate`. One reviewer pass at the end.
9. Screenshots: before/after for every tab, "?" sheet, ⚙, each coach tip, each notice kind at 16 Pro Max (430×932) and SE
   (375×667). Extend `src/play/layout-shot.tsx` to render the street bars + every tab (it only has pet/dive/catch/train/
   play today and omits the bars). Before-shots must come from master code (e.g. a worktree) — or label them "from code".
10. Update the PR body (Spec · Changes · Checks · tables: stage size before/after, word counts before/after, notice
    inventory old → new kind) and PROJECT_CONTEXT.md.

## Environment gotchas (this Windows machine)
- Expo web: `preview_start` name `expo-web` (port 8099). It crashed twice with `EMFILE: too many open files` while
  subagents were grepping the repo and while a curl loop polled it; it came up fine when nothing else was scanning.
  Never poll it in a tight loop.
- `/play` needs sign-in on web; only `/play?shot=pet|dive|catch|train|play&inset=se|15|max|and[&phase=pre|mid]` renders
  without auth. Each load shows the Expo splash for ~20 s; wait, then screenshot. Set the window size with
  `resize_window` — the `inset` param only changes safe-area padding.
