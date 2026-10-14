# Divecore minimal — handoff (read the LATEST section first)

Branch `feature/divecore-minimal` (off master `e121ef1c`) · draft PR https://github.com/emci-hub/ATO/pull/33 (Auto-fix on).
The full brief is emci's pasted task (Steps 0-3 + Deliverables + Rules). This file is the state, so the next agent
does not redo the audit. **Do not merge. Do not publish an OTA.** Play-only (`.cursor/rules/play-isolation.mdc`,
`.cursor/rules/fixed-regions.mdc`). No new native deps; package.json may only gain check scripts.

## ▶ LATEST — read this first (session 2, cloud, 2026-10-14 night): Phase 1 step 4 built, steps 5–6 left

**Why the session moved:** emci moved off the cloud session (it was spending the one-time "cloud session
credit"); the rest of Phase 1 continues in a local Claude Code session on emci's Windows PC. Everything needed
is in this file, the spec and the repo — nothing lives only in the cloud chat.

### Where the code is
- Branch **`claude/jolly-cerf-q0gsov`** (cloud session branch) = `feature/divecore-minimal` (session 1's WIP)
  + this work. Draft PR **https://github.com/emci-hub/ATO/pull/35** merges it INTO `feature/divecore-minimal`;
  PR **#33** (`feature/divecore-minimal` → `master`) stays the one PR to master. emci has not yet said whether to
  fold #35 into #33 now — ask once, recommend: merge #35 into `feature/divecore-minimal` when Phase 1 is green,
  then keep working on `feature/divecore-minimal`.
- Locally: `git fetch origin && git checkout claude/jolly-cerf-q0gsov` (or the merged branch once folded).

### The brief (emci, 2026-10-14) — 5 phases, one session each; do only the current one
1. **Placement audit + spacing spec + layout skeleton** ← current; steps 1–4 done, **5–6 left**
2. One unified notification system in the reserved NoticeLane (`notify()`, replaces PlayBanner)
3. Tabs / nav cleanup: one entry per place, one name per thing, Exit in ⚙, **remove the Block (a1)**
4. One "?" help button + replace the 5-card tutorial with ≤ 4 short tips
5. Word-limit checks + rewrite long text
After phase 5: `docs/main-app-ui-plan.md` (what worked, what to share via e.g. `src/ui/`, the same 5 phases for the
main app, a ready main-app Phase 1 prompt), then stop for emci's OK. Every phase ends with a "Lessons learned"
section here. Keep reusable pieces generic (GameScreen / stage-frame, notify(), word-limit checks, spacing scale)
and note Play-only vs shareable — do NOT move anything outside `src/play` yet.

Rules (every phase): Play-only (`.cursor/rules/play-isolation.mdc`: `src/play/**`, `assets/play/**`,
`src/app/play.tsx`, `docs/**`, `scripts/check-*.ts`, package.json scripts, `.cursor/rules/**`); obey
`fixed-regions.mdc` + `stage-bounds.mdc`. No merge, no OTA publish, no new native deps (must ship as OTA), no
economy / odds / rewards / save changes, never print EXPO_TOKEN or any key/token. Keep the style: Departure Mono +
Rajdhani (Street screens use Pixelify Sans), cyan frames, solid buttons, fullscreen arenas, the locked art rules,
Reduce Motion = gentle, never still. emci wants plain, short answers and to SEE changes (previews) before choosing.

### emci's decisions (all 2026-10-14)
- Accepted every recommendation: **(a1)** remove the Block → Hideout is home + Claim chip (do it in Phase 3);
  **(b1)** Turf War fixed board + one Setup sheet; spec heights + "stage ≥ 60 %" target OK.
- From the previews: Turf War keeps the **TURF WAR header + the full lede** ("Protect the Basecore Path. Drag your
  Avatar to the thick, and time Root Veil.") with the **board right under them** — "I just wanted the map moved".
- Hideout: the **room fills the stage** like the Underground picture, **Hideout / Loft / Call on their own row**,
  and on small phones the **view follows the pet** (accepted recommendation).
- Earlier (session 1): thin 28 pt lane on arenas ✔; word limits enforced on what you see first ✔.

### What Phase 1 has done
- Step 1 audit: `docs/divecore-audit/measured.md` (real numbers, web build + Playwright) on top of session 1's
  static `nav.md` / `notices.md` / `layout.md`. Before shots `docs/divecore/before/`.
- Step 2 research: `docs/divecore-ui-research.md` (session 1, R1–R12).
- Step 3 spec: `docs/divecore-layout-spec.md` (approved; §2a = what was built) + mockups `docs/divecore/mockups/`.
- **Step 4 skeleton (this session):**
  - `src/play/stage-frame.ts` — pure `computeStageFrame(id, window, insets)`, `REGIONS` (per-screen heights),
    `layoutRegions`, `SPACE` (4/8/12/16/24), `TAP_MIN` 44 / `TAP_PRIMARY` 48, `tabBarHeight`.
  - `src/play/stage-layout.tsx` — `<GameScreen frame topBar notice stage dock tabBar float modal fadeKey>` +
    `useStageFrame(id)` (computed during render = before first paint; frozen until the window size changes).
  - `src/app/play.tsx` — the Street shell no longer has a flex-leftover body or bar slots: it builds the resource
    bar (`shellTop`) and tab bar (`shellTabs`) and hands them to each screen; list screens (Block, Locker, Store,
    About) are `GameScreen('list')` with a scroll body; Dive renders without SafeAreaView (GameScreen does insets).
  - Hideout (`pet-screen.tsx`, `pet-room.tsx`, `hideout-iso.ts`): `GameScreen('hideout')`; NoticeLane = pet strip
    (or the "Swipe for rooms" hint until seen); stage = room at the frame size, **cover-fit**
    (`hideoutCoverScale`) with a lazy **camera** (`hideoutCameraTop`, feet kept between 40–88 % of the stage, glide
    600 ms / 900 ms under Reduce Motion); dock = room row (Hideout/Loft/Call, 56) + Feed/Info (64).
  - Turf War (`defend-screen.tsx`): `GameScreen` with ONE frame for setup + wave (`turf-setup`; the wave frame =
    `computeStageFrame('turf-wave', same window + insets)`). Stage = header (112) + square board
    `min(stageW − 24, stageH − 112)` (406 Pro Max / 309 SE), not in a ScrollView. Lane = setup coach (tap hides) /
    wave coach / "Paused…". Setup dock = **Setup ▲** + **Call wave**; wave dock = Cast + Pounce·1×·2×·Leave; wave
    TopBar = HUD (wave · run caps · pause). Setup sheet (`PlaySheet`) = map label, wave/HUD card, Why?, fight card +
    speed, drops, maps, replays, effects quality. Pad panel and won/lost cards float above the dock. Back closes the
    sheet first. `StreetHudFill/StreetDockFill` are no longer used (exports still exist in `street-shell.tsx`).
  - Dive (`dive-scene.tsx`): `GameScreen('dive')`; picture size from the frame; the find / caption toast is now one
    line in the NoticeLane; dock fixed (no grow-only).
  - Pet games (`pet-games.tsx` `GamePlate`): `GameScreen('pet-game')`, fullscreen over the Hideout.
  - `layout-shot.tsx`: pet / dive / games no longer add insets (GameScreen does).
  - Gate: new **`check:stage-bounds`** (`scripts/check-stage-bounds.ts`, in `check:ota-gate`): GameScreen on every
    game screen, no flex-leftover stage, nothing forbidden in a `stage={…}`, pure frame tests at both sizes (incl.
    Turf setup = wave, Hideout camera). Rule **`.cursor/rules/stage-bounds.mdc`**; `fixed-regions.mdc` points to
    it; `check:fixed-regions` re-pinned to the new layout.
  - Verified on web at both sizes: Turf War board top/size **identical in setup, wave and pause** (Pro Max 267/406,
    SE 228/309) — the two measured bugs are fixed. After shots `docs/divecore/after/`.
- **Gate result at hand-off: `npm run check:ota-gate` → typecheck + lint + all 158 offline checks passed**
  (incl. the new `check:stage-bounds`; one old lint warning in dive-scene.tsx is not new).

### Measured results (Phase 1)
| | Before | After (Phase 1) |
|---|---|---|
| Hideout stage (Pro Max / SE) | 613 / 417 incl. the 64 pt room row; room 332 wide with side bands | 563 / 365 room only; room fills the width (430 / 375) |
| Turf War board | 406 at y 319, jumps to 114 in a wave, +145 on pause; SE: 146 pt hidden, +290 on pause | 406 at y 267 / SE 309 at y 228 — never moves, never hidden |
| Turf War Call wave | 650 / 870 pt down a scroll | always in the dock (bottom third) |
| Dive picture | 468 / 276 | 444 / 252 (new 28 pt lane; dock still 258 until Phase 5) |

### What is LEFT in Phase 1 (do these, then stop)
1. **Look at it on a real phone** (Expo Go / dev client, both a tall phone and SE-size if possible). Check:
   Hideout camera feel and that taps on room spots still land; Turf War drag-the-Avatar works now that the board is
   not in a ScrollView; Setup ▲ sheet scrolls and closes (back gesture too); pad panel / won / lost panels sit
   above the dock and are scrollable; immersive mode on SE (status bar hidden) leaves no gap problem; Dive and the
   pet games; Large Text (Dynamic Type) doesn't clip fixed regions badly (Departure/Pixelify mostly cap scaling).
2. Fix what that finds (small, in-scope only).
3. Run `npm run typecheck`, `npm run lint`, `npm run check:ota-gate` — all green except `art-registry` if it is
   still the pre-existing staleness (see gotchas).
4. After shots at 430×932 + 375×667 (harness: `docs/divecore/tools/README.md`) → `docs/divecore/after/`; put
   before/after in the PR (#35 or #33).
5. Update this file (state, files, Lessons learned, a ready Phase 2 prompt in the same format), the PR body, and
   `PROJECT_CONTEXT.md` (Play entry), then stop for emci.

### Known trade-offs / risks to tell emci
- SE Turf War board is **309** (was 351, but 146 of that was hidden in a wave and 28 under the tab bar in setup) —
  the cost of keeping the full header above it. Pro Max unchanged at 406.
- Dive picture is 24 pt smaller until Phase 5 shrinks its dock.
- On SE the Hideout shows ~60 % of the room at a time; Play / Stash come into view when the pet walks up there.
  No vertical drag-to-look yet (would fight the room swipe) — offer it in Phase 3/4 if emci wants.
- Effects quality toggle moved into the Turf War Setup sheet (not reachable mid-wave).
- List screens (Block, Locker, Store) and the pet games have an empty 40 / 28 pt NoticeLane until Phase 2.
- PlayBanner still floats at `insets.top + 52` (Phase 2 replaces it with the lane).

### Environment gotchas
- `art-registry` (`check:art-registry --fresh`) was red once at the start of this session and green at hand-off
  with no art changes; the pre-commit hook runs `art:sync` when staged files touch art. If it goes red again it is
  not a Play-layout failure: run `npm run art:sync`, never hand-edit generated art files.
- Measuring on web: see `docs/divecore/tools/README.md` (dummy Supabase env, local safe-area-context patch, Dive
  only via `?shot=dive`). Session 1 (Windows) also saw Expo web crash with `EMFILE` when other tools scanned the
  repo — don't poll it in a loop.
- nngroup / uxmatters were unreachable from the cloud; session 1 verified the research links locally.

### Lessons learned (Phase 1 so far)
- **Measure before trusting a review**: the two worst map bugs (SE board hidden, board jump on pause) were not on
  the review's list, and the suspected "grow-only shrink" did not fire in the measured states.
- **One frame per screen, computed from the window, is simple and testable** — the pure `computeStageFrame` lets the
  gate prove the stage can't change with notices/pause/loading. Reusable as-is for the main app (shareable).
- **Show real-art previews before asking**: emci's feedback changed the plan twice (keep the header; room fills).
- Splicing a 5.5k-line screen by marked line ranges (asserting each marker first) was safer than hand edits.
- Shareable later: `stage-frame.ts`, `SPACE`/`TAP_*`, the GameScreen pattern. Play-only: REGIONS heights, the
  Hideout camera, the Turf War board sizing.

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
