# Divecore minimal — handoff (paused 2026-10-14)

Branch `feature/divecore-minimal` (off master `e121ef1c`) · draft PR https://github.com/emci-hub/ATO/pull/33 (Auto-fix on).
The full brief is emci's pasted task (Steps 0-3 + Deliverables + Rules). This file is the state, so the next agent
does not redo the audit. **Do not merge. Do not publish an OTA.** Play-only (`.cursor/rules/play-isolation.mdc`,
`.cursor/rules/fixed-regions.mdc`). No new native deps; package.json may only gain check scripts.

## ▶ Latest: session 2 (cloud, 2026-10-14 evening) — new 5-phase brief, Phase 1 paused at step 3

emci re-issued the brief as **5 phases, one session each** (1 placement audit + spacing spec + layout skeleton ·
2 one notification system in a reserved lane · 3 tabs/nav/names, Exit in ⚙ · 4 one "?" + ≤ 4 tips ·
5 word limits + rewrites; then `docs/main-app-ui-plan.md`). The "Remaining plan" further down was written for the
old one-shot brief: keep its facts, but **do only the current phase**.

**Phase 1 state: steps 1–3 done, waiting for emci's OK. Steps 4–6 not started. Docs only, no code.**

| Step | Status | Output |
|---|---|---|
| 1 Placement audit | done — **measured** at 430×932 and 375×667 on a running web build | `docs/divecore-audit/measured.md` (+ the static `nav.md`, `notices.md`, `layout.md` from session 1), before shots `docs/divecore/before/` |
| 2 Research | done in session 1 (R1–R12, 37 links) — kept as is | `docs/divecore-ui-research.md` |
| 3 Spacing spec + mockups + 2 questions | done | `docs/divecore-layout-spec.md`, `docs/divecore/mockups/*.png` (+ `draw-mockups.py`) |
| 4 Skeleton · 5 Verify · 6 Handoff | **waiting for OK** | — |

New findings from measuring (not in session 1's list):
- **Turf War wave on SE hides 146 pt of the board under the HUD** (the setup scroll offset carries into the wave;
  *Call wave* is 830–870 pt down, so every player scrolls). Pro Max lands at y 114.
- **Pausing a wave moves the board +145 (Pro Max) / +290 (SE).**
- Map share today: Hideout 66 % / 63 %, Dive 50 % / 41 %, Turf War board 44 % (Pro Max), 31 % visible on SE in a wave.
- The tutorial is 124 body words (+12 title), and card 3 is stale (names five dock buttons; the Street dock has two).
- The Block's *Underground* tile opens Dive, but Dive's back always lands in the Hideout.

Spec headline (`docs/divecore-layout-spec.md`): TopBar 44 · NoticeLane 40 (28 on arenas — matches emci's ✔) ·
Stage computed once · ActionDock 64 / 120 / 152 · TabBar 56 + inset. Stage ≥ 60 % everywhere (Hideout 68 / 65 %,
wave 69 / 67 %, Dive 66 / 62 %). Hideout's status strip becomes the NoticeLane's idle content. Phase 1 keeps
today's taller Dive / Turf docks as interim values (§2 table) so nothing is redesigned yet.

Still waiting on emci (asked in session 1, re-asked with new mockups `question-a.png` / `question-b.png`):
(a) remove the Block (Hideout home + Claim chip) vs keep a small Block tab; (b) Turf War fixed board + Setup sheet
vs keep scrolling. Recommendation (a1) and (b1).

Gotchas found this session (cloud container, Linux):
- **`/play` renders on web without sign-in** — it is outside the auth guard (PRE_LAUNCH_DEV) and the save is local
  (`localStorage['ato.play.store.v1']`). Start web with dummy values
  `EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=dummy CI=1 npx expo start --web`
  (local process only), seed a save, drive with Playwright (`NODE_PATH=$(npm root -g)`; Chromium in `/opt/pw-browsers`).
- Inject safe areas with a stylesheet rule: `body > div[style*="safe-area-inset"]{padding-top:59px!important;padding-bottom:34px!important}`.
- **Web-only quirk in react-native-safe-area-context:** `SafeAreaView.web.js` treats an edge missing from `edges` as
  additive (native: off) → the top inset doubles on web. Patch `getEdgeValue` locally (`case undefined:` before
  `case 'off':`) for measuring; never commit; restart Metro with `--clear`.
- Dive can't be opened on web (the manhole wipe never calls `onDone`) → measure it with `?shot=dive&inset=max|se&phase=pre|mid`.
- nngroup / uxmatters / wikipedia are blocked from the cloud container; Apple HIG reads via
  `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`.
- `npm ci` first (~2 min); the container starts without `node_modules`.

Lessons (Phase 1 so far): measure before trusting a review — the two worst map bugs were not on the list, and the
"map shrink" grow-only bug is real in code but didn't fire in the measured states. Reusable later (Play-only for
now): the spacing scale, the region table, the `useStageFrame` math.

### Next session prompt (Phase 1 steps 4–6, after emci's OK)

```
Repo emci-hub/ATO, branch feature/divecore-minimal (draft PR #33). PLAY-ONLY task: obey
.cursor/rules/play-isolation.mdc and .cursor/rules/fixed-regions.mdc. Read docs/divecore-handoff.md first.

Phase 1 steps 1-3 are done. emci answered: (a) = <a1|a2>, (b) = <b1|b2>, spec = <OK|changes>.
Do Phase 1 steps 4-6 only (not phases 2-5):
4. src/play/stage-layout.tsx: <GameScreen> (slots topBar / notice / stage / dock / tabBar + FloatLayer, ModalLayer)
   and useStageFrame(screenId): a FIXED stage size computed once from window size + safe area before first paint;
   only rotation / window-size change recomputes. Use the Phase 1 interim heights in docs/divecore-layout-spec.md §2.
   Wrap Hideout, Dive, Turf War (setup + wave), pet games, Locker, Store, Block (if kept) WITHOUT redesigning
   contents; move in-flow notices / hints / coach lines into the notice slot (same components for now). Fix the
   two measured Turf War bugs in the wrap (SE wave hides 146 pt of board; pause moves the board).
   Add .cursor/rules/stage-bounds.mdc (alwaysApply, globs src/play/**) and point fixed-regions.mdc to it.
   Add check:stage-bounds to check:ota-gate: every game screen uses GameScreen; no flex-leftover stage; no
   notice / banner / coach inside a stage subtree; pure test: frame identical with / without notice, tip, pause,
   loading at 430x932 and 375x667.
5. typecheck, lint, npm run check:ota-gate all green; before/after screenshots at 430x932 and 375x667 in the PR
   (method: handoff gotchas).
6. Update docs/divecore-handoff.md (state, decisions, files, gotchas, Lessons learned, ready-to-paste Phase 2
   prompt), the PR body and PROJECT_CONTEXT.md, then stop.
Rules: no merge, no OTA publish, no new native deps, no economy / odds / rewards / save changes, never print a
token or key; keep Departure Mono + Rajdhani, cyan frames, solid buttons, fullscreen arenas, the locked art
rules, Reduce Motion = gentle never still.
```

---

## Session 1 (Windows / Cursor) — kept for its facts

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
