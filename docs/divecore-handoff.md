# Divecore minimal — handoff (read the LATEST section first)

Branch `feature/divecore-minimal` (off master `e121ef1c`) · draft PR https://github.com/emci-hub/ATO/pull/33 (Auto-fix on).
The full brief is emci's pasted task (Steps 0-3 + Deliverables + Rules). This file is the state, so the next agent
does not redo the audit. **Do not merge. Do not publish an OTA.** Play-only (`.cursor/rules/play-isolation.mdc`,
`.cursor/rules/fixed-regions.mdc`). No new native deps; package.json may only gain check scripts.

## ▶ LATEST — read this first (session 6, local Windows, 2026-10-14): **Phase 4 built** → phone check, then Phase 5

Phase 4 = ONE "?" per game screen + four coach tips instead of the blocking tutorial. Branch **`claude/divecore-phase4-help`**
(stacked on `feature/divecore-minimal`, which already holds Phases 1-3) → draft PR into `feature/divecore-minimal`.
**Waiting on:** emci's phone check (below). Phase 3 and Phase 2 notes stay underneath.

### What Phase 4 did
- **"?" help button** — `GameScreen` (`stage-layout.tsx`) takes `help?: HelpId` and draws exactly one `HelpButton` at the right
  end of the NoticeLane (placement A of the previews `docs/divecore/previews/phase4-help-placement-{max,se}.png`; B top bar
  squeezed the Claim chip, C floated over the art). The lane gives up **width** (`reserveRight`, 44 pt), never height; the stage
  is untouched. Tap opens `HelpSheet` on the FloatLayer: title + ≤ 3 bullets of ≤ 10 words + **Full guide** (→ Hideout → Info →
  Guide through `setGuideOpener`, registered by `play.tsx`). Outside tap, "?" again, or Android back closes it. In a live run
  (Underground, a wave, a mini-game) leaving would end it, so the card only prints "Full guide: Hideout → Info → Guide".
  Copy: `src/play/help/help-content.ts` (Hideout, Turf setup, Turf wave, Underground, Mini-game, Locker, Blades, Store).
- **Four coach tips** replace `DivecoreTutorial` (file deleted): `src/play/ftue/coach-tips.ts` (pure: copy, `pickCoachTip`, order
  warm egg → Feed → Underground → Turf War tab, ≤ 6 words, placement), `tip-anchors.ts` (callback refs on the egg, Feed, the hatch
  chip, the Turf tab), `coach-tip-layer.tsx` (ring + words, `pointerEvents="none"`, absolutely placed). `GameScreen`'s root
  `onTouchStart` marks the tip seen on ANY touch and the touch still reaches its target. One at a time, 700 ms after the
  Hideout is idle (no sheet / game / Settings / wipe), stored in `play_settings.tipsSeen`. Ring breathes 1.4 s per half; with
  Reduce Motion 2.4 s and smaller — never still. Tips never pause notices (the old tutorial did).
- **Settings**: "Replay the tutorial" → **Replay tips** (goes to the Hideout, all four unseen again). Stale "Open Pet" / "along the
  bottom" copy went with the tutorial.
- **Gate**: `check:divecore-ftue` (new: copy limits, tip order and seen rules, `tipsSeen` migration, placement, static pins on
  the wiring). Re-pinned: `check:stage-bounds`, `check:notify` (NoticeLane now takes `reserveRight`), `check:guide` and
  `check:play-dev-hidden` (tutorial file → help sheet / tip layer). `check:fixed-regions` and `check:divecore-nav` needed none.
- Shots: `docs/divecore/after/phase4-{tips,help}-{max,se}.png` (web export + Playwright with the installed Chrome; same harness
  as before, seeds with `tipsSeen` all false).

### Open / not done
- Pet games get one generic "Mini-game" card (Catch + Train in one), not one per game.
- The tip bubble can sit over the room row / dock for a moment (it is click-through); fine on both sizes, check on a phone.
- The "?" button is 28 pt tall in a 28 pt lane (Underground, wave) — tap column is 44 wide but not 44 tall there.
- iOS `onTouchStart` on a parent View is the dismiss; verified on web with touch only — **confirm on a real phone**.
- About / Credits entry and dead `command-hub.tsx` from Phase 3 are still open.

### Phone check (emci, dev build: `npm start`, same Wi-Fi)
1. New save (or Settings → Replay tips): on the Hideout a ring + "Tap the egg to warm it" shows after a moment on the egg.
2. Tap anywhere: the tip goes; the next one ("Feed keeps your pet happy") shows on Feed. Tap Feed itself: the sheet opens too.
3. Then "Ride the hatch to Underground" on the hatch chip, then "Turf War: defend your street" on the tab. After four, none.
4. Nothing moves while a tip shows (room, bars, dock). Open a sheet: the tip hides.
5. Every game screen has a round "?" at the right of the line under the top bar. Tap: ≤ 3 short lines + Full guide.
6. Full guide (Hideout, Turf setup, Locker) opens Info → Guide. In Underground / a wave / a mini-game it shows the path only.
7. Android back closes the "?" card first. VoiceOver reads "Help".
8. Settings → Reduce Motion: the ring still breathes, slower. Settings → "Replay tips" brings the tips back.

### Lessons learned (Phase 4)
- **Anchor with callback refs, not coordinates**: `tipAnchorRef('feed')` on an existing view + `measureInWindow` in the layer needs
  no layout change and follows the room camera (re-measure every 400 ms). Pure placement keeps the text on screen.
- **"Never blocks" = no overlay**: a pass-through dismiss (`onTouchStart` on the root, layer `pointerEvents="none"`) beat a
  transparent catcher; a tap on a room spot both dismisses the tip and opens the spot (seen in a shot: SE tap hit "Stash").
- **Reserve width, never height, for a new control in a fixed region** (`reserveRight`).
- **Grep the checks that pin a file you delete** (`check:guide`, `check:play-dev-hidden` listed `divecore-tutorial.tsx`).
- Playwright without a browser download: `npm i -g playwright`, launch with `channel: 'chrome'`; a static export plus
  `hasTouch: true` and `touchscreen.tap` drives RN touch events. `setContent` can't load `file://` images — write an HTML file.
- Shareable later: help-content + help sheet pattern, tip anchors. Play-only: the copy and the anchors.

### ▶ Phase 5 prompt (ready to paste into a fresh session)

Model: Sonnet 5

```text
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
.cursor/rules/fixed-regions.mdc and .cursor/rules/stage-bounds.mdc.

First: git fetch origin, git checkout feature/divecore-minimal, git pull, npm ci.
(If the Phase 4 PR into feature/divecore-minimal is not merged yet, check out claude/divecore-phase4-help instead.)
Then read docs/divecore-handoff.md, section "LATEST" (history, emci's decisions, the 5-phase plan, Lessons learned) and
docs/divecore-layout-spec.md (sections 2, 2a, 3).

We are in Divecore Phase 5: content trims + word limits.
1. Underground (Dive): trim the 258 pt dock to the spec's 152 target (Bag + Heat in one row, two button rows); the picture
   fills the stage. Show real-art previews at 430x932 + 375x667 first.
2. Word limits: notices built from values (Surfaced, Skipped ahead, shop buy, long shop names) must fit title <= 3 / body <= 10
   words — cut them; one-line copy everywhere in the lanes.
3. Tap targets >= 44 pt (Dive back, Gear info / How Dive works, "Exit Play" link); 48 pt primary buttons.
4. Gate: extend check:stage-bounds / check:notify for the new heights and word limits; typecheck, lint, check:ota-gate green.
5. Phone check in a visible terminal tab, shots into docs/divecore/after/, update docs/divecore-handoff.md, PR body and
   PROJECT_CONTEXT.md. Draft PR into feature/divecore-minimal. Then stop (the 5 phases are done; no merge to master).

Rules: no merge to master, no OTA publish, no new native deps, no economy/odds/rewards/save changes, never print EXPO_TOKEN or
any key/token. Keep the style (Departure Mono + Rajdhani, Pixelify on Street screens, cyan frames, solid buttons, fullscreen
arenas, locked art rules, Reduce Motion = gentle, never still). Show me previews before any layout choice; keep answers short.
```

---

### Phase 3 (kept for its facts; was: Phase 3 built → phone check)

Phase 3 = nav cleanup. Branch **`claude/divecore-phase3-nav`** (stacked on Phase 2, `claude/divecore-phase2-notify`) → draft PR into
`feature/divecore-minimal`. **Waiting on:** emci's phone check (below). Phase 2's notes stay below this section.
emci's decisions this session: Claim chip in the **top bar** next to Caps (option A); tabs Hideout · Turf War · Locker
(Fits / Blades) · Store; **no Underground tab** (it opens from the Hideout hatch); ⚙ stays top-right and opens in place.
(His message was cut off after "back links renamed to Hideout"; I took Dive-back-to-origin and the Notices switch as the
recommended plan he approved — say so if not.)

### What Phase 3 did
- **Block removed**: no `grove` mode, no `StreetBlock`, no Block tab; the Hideout is home and the first mode. While the save
  loads the screen is an ink view with a spinner + **Exit Play** (was the Command Hub fallback).
- **`src/play/play-nav.ts`** (new, pure): `PlayMode`, `PlayTab`, `PLAY_TABS`, `modeForTab`, `tabForMode`, `backTarget`.
- **Claim chip**: `StreetResourceBar` takes `claim={{ ready, label, onPress }}` → mustard "CLAIM" when ready, else "~42m"
  (greyed, not tappable). It calls the same `handleClaim`; the notice copy is unchanged.
- **⚙ opens in place** (no more flip to the Block). ONE `DivecoreSettingsSheet`, owned by `play.tsx`; the Hideout's second copy is
  gone (Info → Status → Settings calls `onOpenSettings`). New first row **Exit Play**, then **Notices: All / Important only**
  (`play_settings.notices`, already read by `notify()`). The dev unlock row + Tune panel sit in the sheet's `extra` slot (before
  Reset); the floating DEV button still holds the Dev kit. ⚙ is only on screens with the resource bar (not Dive, not a live wave).
- **Back**: every sub-screen → Hideout (Blades no longer goes to Turf War). **Dive → the screen that opened it** (`diveFromRef`,
  set by `openDive`; its label still reads "‹ Hideout" — only a notice can open it from elsewhere, and none does today).
  At the Hideout, Android back / edge: a mini-game or sheet closes first, then back leaves Play. iOS native swipe-back is on
  only at the Hideout with no overlay and **no Hideout sheet / mini-game open** (`onBusyChange` → `petBusy`).
- **Names**: default back link "Hideout" (was "Command Hub"); Store's inner Guide back says "Store"; Hideout's dead header
  says "Exit". `check:divecore-nav` fails on any player-facing "Command Hub" in `src/play` (except `command-hub.tsx`).
- **Gate**: `check:divecore-nav` (new, in package.json → ota-gate); `check:edge-back` and `check:play-dev-hidden` re-pinned
  (home = Hideout, one Settings sheet, floating Dev kit). `check:notify` / `check:stage-bounds` / `check:fixed-regions` needed
  no change. Full `check:ota-gate`: typecheck + lint + 159 offline checks green (before the review fixes; typecheck + lint
  re-run green after them).
- **Review (Opus)** found: iOS swipe-back leaving Play with a Hideout sheet / mini-game open (fixed: `petBusy`), the pet not
  counting Settings as "busy" (fixed: `settingsOpen` prop), Tune toggle opening Settings when turning off (fixed), a weak
  edge-back pin (fixed), a bare loading view (fixed: spinner + Exit).

### Open / not done
- **About / Credits has no way in** (it was only the old Command Hub "More" tile; already unreachable before this change).
  Credits may be required for asset licences — decide where it lives (a Settings row is the cheapest). Not built: new scope.
- **`src/play/command-hub.tsx` and the `neon-viper.ts` hub tiles are dead code**; `check:shop-hidden` / `check:dive-fx` still
  read them. Delete in a cleanup once those checks are re-pointed.
- (Fixed in Phase 4: the tutorial and its stale "Open Pet" copy are gone.)
- Shots: I drove the static export in the built-in browser (Hideout home with the Claim chip, ⚙ sheet, Locker "Back to
  Hideout") and checked the DOM; **no image files saved** (the built-in browser can't write them). Retake into
  `docs/divecore/after/` with `shots.js` (needs `npm i -g playwright`) if you want files.
- SE (375): the top bar now holds Caps · tokens · Shine · Prism · Claim · ⚙. Not measured; check on a small phone.

### Phone check (emci, dev build: `npm start`, same Wi-Fi)
1. Open Play: you land in the Hideout (no Block). Bottom tabs: Hideout · Turf War · Locker (+ Store only when dev-unlocked).
2. Top bar: Caps, tokens, a small "~30m" (or mustard "CLAIM") chip, then ⚙. Tap CLAIM when ready: a one-line notice.
3. Tap ⚙ on the Hideout, Turf War setup and Locker: the sheet opens over the same screen. First row "Exit Play" leaves Play.
4. In the sheet: Notices → "Important only"; a plain notice (e.g. Claim) is hidden, errors still show. Set back to All.
5. Locker → "‹ Hideout" goes to the Hideout. Blades → same. Android back in Locker → Hideout.
6. Hideout: tap the manhole spot → Underground; its Back returns to the Hideout.
7. Hideout: open Info, then swipe from the left edge: the sheet closes (it does not leave Play). Open a mini-game: same.
8. On the Hideout with nothing open, swipe from the left edge (iOS) or Android back: leaves Play.

### Lessons learned (Phase 3)
- **Grep the checks before deleting a mode**: five `check:*` scripts pinned `'grove'`, the hub dev kit or the Pet's own Settings.
  Update the pin to the new behaviour (not a comment) in the same change.
- **A pure nav module is worth it** (`play-nav.ts`): tabs, tab ↔ mode and back targets are testable without React.
- **Moving "home" changes who owns native back**: the iOS swipe-back is a system gesture, not our handler, so anything that
  can be open on top of home (sheet, mini-game) must tell the shell, or one swipe loses the round.
- **One sheet, owned by the shell, beats a copy per screen**; screens ask for it (`onOpenSettings`) and report "busy".
- **Static dev export + the built-in browser** works for DOM checks when Playwright isn't installed; the first screenshot can
  be the splash — take a second one.
- Shareable later: the `play-nav.ts` pattern, the top-bar chip slot. Play-only: Hideout-as-home, Dive's origin ref.

### ▶ Phase 4 prompt (ready to paste into a fresh session)

Model: Sonnet 5

```text
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
.cursor/rules/fixed-regions.mdc and .cursor/rules/stage-bounds.mdc.

First: git fetch origin, git checkout feature/divecore-minimal, git pull, npm ci.
(If the Phase 3 PR into feature/divecore-minimal is not merged yet, check out claude/divecore-phase3-nav instead.)
Then read docs/divecore-handoff.md, section "LATEST" (history, emci's decisions, the 5-phase plan, Lessons learned),
docs/divecore-layout-spec.md and src/play/divecore-tutorial.tsx (+ the Guide in src/play/pet-sheets.tsx).

We are in Divecore Phase 4: ONE "?" help button + replace the 5-card tutorial with at most 4 short tips.
1. One "?" help button per game screen (where it sits is my call — show real-art previews at 430x932 + 375x667 first):
   opens a small context sheet (<= 3 bullets, <= 10 words each) with a "Full guide" link to Hideout -> Info -> Guide.
2. Replace DivecoreTutorial (blocking 5 cards) with 4 coach tips on the FloatLayer: warm the egg · Feed · Underground
   (Hideout hatch) · Turf War tab. <= 6 words each, pulsing ring (slow breathe under Reduce Motion), one at a time, tap
   anywhere, never blocks input, never resizes a region. Use play_settings.tipsSeen (already exists, migrated).
   Settings "Replay the tutorial" -> "Replay tips". Fix the stale copy ("Open Pet", "along the bottom").
3. Gate: check:divecore-ftue (pure where possible); update check:divecore-nav / check:stage-bounds /
   check:fixed-regions pins if they mention the tutorial or the guide entry.
4. Phone check: start `npm start` in a visible terminal tab with a short checklist; then npm run typecheck,
   npm run lint, npm run check:ota-gate - all green. After shots into docs/divecore/after/.
5. Update docs/divecore-handoff.md (state, files, Lessons learned, a ready Phase 5 prompt in this same format), the PR
   body and PROJECT_CONTEXT.md (DIVECORE MINIMAL line). Draft PR into feature/divecore-minimal. Then stop.

Do NOT start Phase 5. Rules: no merge to master, no OTA publish, no new native deps, no economy/odds/rewards/save
changes, never print EXPO_TOKEN or any key/token. Keep the style (Departure Mono + Rajdhani, Pixelify on Street
screens, cyan frames, solid buttons, fullscreen arenas, locked art rules, Reduce Motion = gentle, never still).
Show me previews before any layout choice; keep answers short and plain.
```

---

### Session 4 — Phase 2 (kept for its facts; was: Phase 2 built → phone check)

Phase 2 = ONE notification system in the reserved NoticeLane. Built on the existing pure queue, PlayBanner
removed, gate green. **Waiting on:** emci's look pick from the previews and the phone check (checklist below).
Branch **`claude/divecore-phase2-notify`** → draft PR into `feature/divecore-minimal` (see PR list on GitHub;
#33 stays the one PR to master). Phase 1 notes follow below this section.

### What Phase 2 did
- **`src/play/notify/queue.ts`** (session 1's pure queue, unchanged): kinds `celebrate` / `notify` / `error`,
  priority, de-dupe → ×N, cap 4 waiting, pause = errors only, same-kind 1 s gap, 3.5 / 3 / 5 s (+1 s Reduce
  Motion), "Important only", title ≤ 3 / body ≤ 10 words.
- **`src/play/notify/notify.ts`** (new): the store. `notify({ kind, title, body?, target?, dedupeKey? })` from
  anywhere; timers live here; `useNoticeOptions` (mode from `play_settings.notices` + Reduce Motion, set by
  play.tsx), `useNoticeTargets` (tap → pet / journal / dive), `useNoticePause` (tutorial / hub Settings / Dive
  haul reveal), lane stack: **only the top-most mounted lane shows a notice** (a pet game over the Hideout wins);
  with no lane mounted notices wait. Dev only: `globalThis.__divecoreNotify` for the web preview harness.
- **`src/play/notify/events.ts`** (new): `noticeEvents` = the old `bannerEvents` (hatched / revealed away from the
  Hideout, milestone ready → Journal, Tide day), now NoticeInput with kinds.
- **`src/play/notify/notice-lane.tsx`** (new): the lane. One line (`numberOfLines={1}`), Street toast sticker
  (mustard tab), title in Pixelify bold caps (errors in tag red, `!`; celebrate `★`), body after it, `›` when it
  has a target, ×N counter. Tap = target or close. VoiceOver: `announceForAccessibility` on show, live region,
  hint. Enter = fade + 8 px drift 220 ms; **Reduce Motion = 200 ms fade + 2 px drift** (`ReduceMotion.Never`, so
  it is gentle, never still). Idle = the screen's own line, faded back in.
- **`GameScreen`** (`stage-layout.tsx`) draws `<NoticeLane height idle={notice}>` in its fixed notice region —
  every game screen (Hideout, Turf War, Dive, pet games, Block / Locker / Store) has it; it is placed by layout
  (no `insets.top + 52`), never resizes a region, never touches the stage.
- **Moved** (`play.tsx`): every `setToast` (Claim, dev finds, junk sold, pet back, surfaced, bust, odds changed,
  bag full, sold, clear milestone, wave-5, skipped ahead, avatar unlocked, shop buy / refusal) → `notify()` with
  copy cut to the limits; `bannerReducer`, `toastBanner`, the `<PlayBanner>` float are gone. `pet-screen.tsx`'s 6
  mini-game banners (`onBanner`) → `notify()` (emoji dropped from titles: VoiceOver read them). **Dive**: a find
  that lands = `Found · {category}` (notify, ×N), rare = `★ Rare find` (celebrate); the bust / surface captions
  were duplicates of play.tsx's notices and are gone; the "away" line stays as idle. **Turf War** coach / paused
  lines and the **Hideout** pet strip / swipe hint stay the lanes' idle content (a notice replaces them for its
  few seconds). Fixed in passing: the open coach tip was unreachable with a sword aura (audit F02).
- **Deleted:** `src/play/play-banner.tsx`, `src/play/play-banner-queue.ts`, `scripts/check-play-banner.ts`.
- **Gate:** `check:notify` (in package.json → ota-gate) replaces `check:play-banner`: pure queue + news tests,
  every notice via `notify()`, word limits on all 25 literal calls, lane a11y / one line / Reduce Motion /
  placed by layout / top lane only, old files gone. `check:stage-bounds` + `check:fixed-regions` re-pinned (one
  NoticeLane per GameScreen, no floating banner; Dive finds via notify). Rules `stage-bounds.mdc`,
  `fixed-regions.mdc`, `fixed-region.tsx` header updated.

### Kind mapping (old banner → kind)
error: Odds changed, Bag full, shop refusals · celebrate: hatched, grade revealed, clear / wave-5 milestone,
avatar unlocked, new record, level unlocked, buff, daily best / egg / Shine Stone, rare find · notify: everything
else (Claim, Found, Sold, Surfaced, Busted, Pet is back, Milestone ready, Tide day, Skipped ahead, shop buy).
FEEDBACK results (Claim, Sold, shop buy) still use `notify` — moving them onto their buttons is later work; with
"Important only" (no UI yet, Phase 3 ⚙) they would be hidden.

### Previews (real art, web) — `docs/divecore/previews/phase2-lane-max.png`, `phase2-lane-se.png`
Existing style kept: the Street toast sticker (paper + mustard tab) squeezed to one line, Pixelify title. Shown:
Hideout idle strip · notify · celebrate with `›` · error ×2 · Turf setup with a long body (ends in "…") · Turf wave
(board unmoved) · Dive thin 28 pt lane · pet game lane. Per-shot files: `docs/divecore/after/{max,se}-notice-*.png`.
**emci's look call is open** (keep as shown is the recommendation). Not shot: SE Catch (capture flaky).

### Phone check (emci, dev build: `npm start`, same Wi-Fi) — not done yet
1. Locker → sell a Look: one line "SOLD · name · +n tokens" under the top bar; the list does not move.
2. Sell two fast: one line with ×2.
3. Hideout: tap Feed / play a Catch round to a new record → "★ NEW RECORD" in the game's top lane, not the Hideout's.
4. Turf War: tap Call wave, then pause — the board never moves; a notice sits above the header, not on the board.
5. Underground dive: each find = "FOUND · …" in the thin lane above the picture; rare = "★ RARE FIND".
6. Tap a notice with › (e.g. Milestone ready) → it opens the Journal; a plain one just closes.
7. Settings → Reduce Motion on: notices fade in softly (not instant, not sliding).
8. VoiceOver on: a new notice is read once.

### Gate (session 4)
`npm run typecheck` ✔ · `npm run lint` ✔ (only the old dive-scene warning) · `check:notify` / `check:stage-bounds` /
`check:fixed-regions` ✔ · full `check:ota-gate` ✔ (typecheck + lint + 158 offline checks). Reviewer: pass; fixed
from it: a notice already up when a cover opens (Dive haul reveal, tutorial) goes back in line instead of playing out
unseen; iOS is told via announce, Android via the live region (not both); idle lines are a live region again.
**Open (reviewer, minor):** bodies built from values (Surfaced, Skipped ahead, shop buy, long shop names) can pass
10 words — the lane ends them in "…" (Phase 5 word-limit work should cut them); a find whose reveal is interrupted by
leaving Dive gets no notice; finds now notify while the pet is away (the old caption was hidden then).

### Lessons learned (Phase 2)
- **Build on the WIP that exists**: session 1's pure queue + check needed no logic change; the work was the store,
  the renderer and the migration. Its check's "measured top" assertion was replaced by "placed by layout" (the
  lane lives in GameScreen's region, so there is no top to measure).
- **Put the shared slot in the layout kit, not in each screen**: GameScreen drawing `<NoticeLane idle={notice}>`
  gave every screen (incl. list screens) the lane with zero per-screen work, and the gate only has to pin one line.
- **Nested GameScreens need a rule**: the pet game sits over the Hideout, so two lanes are mounted — "top-most lane
  shows it" (a mount stack in the store) keeps one notice on screen.
- **A component that renders on every screen must load its own font** (`useStreetFonts`): the pet game showed a
  serif fallback because nothing there had loaded Pixelify.
- **Web harness on Windows**: `expo start --web` died twice (out of memory, then EMFILE). A static `expo export
  --dev` served by `python -m http.server` was stable; the built-in browser's capture can lag seconds behind
  during a live wave — capture right after raising, and check the DOM when a shot looks wrong.
- Shareable later: `queue.ts` + `notify.ts` + the lane pattern (generic); Play-only: the toast art, kinds' copy.

### ▶ Phase 3 prompt (ready to paste into a fresh session)

Model: Sonnet 5

```text
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
.cursor/rules/fixed-regions.mdc and .cursor/rules/stage-bounds.mdc.

First: git fetch origin, git checkout feature/divecore-minimal, git pull, npm ci.
(If the Phase 2 PR into feature/divecore-minimal is not merged yet, check out claude/divecore-phase2-notify instead.)
Then read docs/divecore-handoff.md, section "LATEST" (history, emci's decisions, the 5-phase plan, Lessons
learned), docs/divecore-audit/nav.md (every entry point, back map, names) and docs/divecore-layout-spec.md.

We are in Divecore Phase 3: tabs / nav cleanup.
1. One entry per place, one name per thing (Hideout · Underground · Turf War · Locker (Fits / Blades) · Store ·
   Caps — check the names list in the handoff's session-1 section and confirm any change with me first).
2. Remove the Block (decision a1): Hideout is home; the Claim chip (Basecore research) moves to the Hideout
   (TopBar or its NoticeLane idle strip — show me previews first). Underground opens from the Hideout as today.
3. Exit Play lives in ⚙ (first row), ⚙ opens in place (no flip to the Block); add Notices: All / Important only
   (play_settings.notices already exists, notify() already reads it). Back: sub-screens → Hideout; Dive → the
   tab that opened it.
4. Gate: a check:divecore-nav (pure where possible) + update check:stage-bounds / check:fixed-regions /
   check:notify pins that mention the Block or the list frame.
5. Show me previews (real art, 430x932 + 375x667, docs/divecore/tools/README.md — use the static export
   route) BEFORE I choose anything about placement; keep the existing style.
6. Phone check: start `npm start` in a visible terminal tab and give me a short checklist; then npm run
   typecheck, npm run lint, npm run check:ota-gate — all green. After shots into docs/divecore/after/.
7. Update docs/divecore-handoff.md (state, files, Lessons learned, a ready Phase 4 prompt in this same format),
   the PR body and PROJECT_CONTEXT.md (DIVECORE MINIMAL line). Draft PR into feature/divecore-minimal. Then stop.

Do NOT start Phase 4-5. Rules: no merge to master, no OTA publish, no new native deps, no economy/odds/
rewards/save changes, never print EXPO_TOKEN or any key/token. Keep the style (Departure Mono + Rajdhani,
Pixelify on Street screens, cyan frames, solid buttons, fullscreen arenas, locked art rules, Reduce Motion =
gentle, never still). Show me previews before any layout choice; keep answers short and plain.
```

---

## Session 3 — Phase 1 (kept for its facts)

Session 3 finished Phase 1: emci checked it on the real phone (Hideout camera + room taps, Turf War avatar drag,
Setup sheet, pad / won / lost panels, pause, Dive, pet games, Large Text) — **"all good, nothing wrong"**. No fixes
were needed; only a stale comment in `defend-screen.tsx` (board "still scrolls the page") was corrected.
Gate re-run green on Windows. After shots in `docs/divecore/after/` are from session 2 and match this code (no
layout change since). Start Phase 2 with the prompt at the end of this section.

### Where the code is
- Branch **`claude/jolly-cerf-q0gsov`** (cloud session branch) = `feature/divecore-minimal` (session 1's WIP)
  + this work. Draft PR **https://github.com/emci-hub/ATO/pull/35** merges it INTO `feature/divecore-minimal`;
  PR **#33** (`feature/divecore-minimal` → `master`) stays the one PR to master. emci has not yet said whether to
  fold #35 into #33 now — ask once, recommend: merge #35 into `feature/divecore-minimal` when Phase 1 is green,
  then keep working on `feature/divecore-minimal`.
- Locally: `git fetch origin && git checkout claude/jolly-cerf-q0gsov` (or the merged branch once folded).

### The brief (emci, 2026-10-14) — 5 phases, one session each; do only the current one
1. **Placement audit + spacing spec + layout skeleton** ✔ done (emci phone-checked 2026-10-14)
2. One unified notification system in the reserved NoticeLane (`notify()`, replaces PlayBanner) ← **next**
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

### Phase 1 wrap-up (session 3, done)
1. ✔ Real phone (emci, dev build via `npm start`): Hideout camera + room taps, Turf War avatar drag, Setup sheet
   open/close, pad / won / lost panels above the dock, pause, Dive, pet games, Large Text — all good.
2. ✔ No fixes needed. Only change: the stale board-responder comment in `src/play/defend-screen.tsx`.
3. ✔ `npm run check:ota-gate` (typecheck + lint + all offline checks) green on Windows.
4. ✔ After shots: `docs/divecore/after/` (430×932 `max-*`, 375×667 `se-*`), before/after in PR #35's body.
5. ✔ This file, PR #35 body, `PROJECT_CONTEXT.md` (Decisions log, DIVECORE MINIMAL line) updated.
6. Asked emci once whether to merge #35 into `feature/divecore-minimal` (recommended). Never to master.

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

### Lessons learned (Phase 1)
- **Phone check is emci's step; set it up so it's one scan**: run `npm start` in a visible terminal tab (dev build,
  same Wi-Fi) and hand emci a short checklist. The web harness can't prove native gestures (drag, sheet swipe).
- **Removing a ScrollView leaves stale assumptions**: grep the comments/responder code around anything that used
  to scroll (the board's "drag still scrolls the page" note).
- **Don't retake shots for a no-layout change**: session 2's after shots stayed valid; retake only when a region moves.
- **Measure before trusting a review**: the two worst map bugs (SE board hidden, board jump on pause) were not on
  the review's list, and the suspected "grow-only shrink" did not fire in the measured states.
- **One frame per screen, computed from the window, is simple and testable** — the pure `computeStageFrame` lets the
  gate prove the stage can't change with notices/pause/loading. Reusable as-is for the main app (shareable).
- **Show real-art previews before asking**: emci's feedback changed the plan twice (keep the header; room fills).
- Splicing a 5.5k-line screen by marked line ranges (asserting each marker first) was safer than hand edits.
- Shareable later: `stage-frame.ts`, `SPACE`/`TAP_*`, the GameScreen pattern. Play-only: REGIONS heights, the
  Hideout camera, the Turf War board sizing.

### ▶ Phase 2 prompt (ready to paste into a fresh session)

Model: Sonnet 5

```text
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). PLAY-ONLY task: obey .cursor/rules/play-isolation.mdc,
.cursor/rules/fixed-regions.mdc and .cursor/rules/stage-bounds.mdc.

First: git fetch origin && git checkout feature/divecore-minimal && git pull && npm ci
(If PR emci-hub/ATO#35 is not merged yet, check out claude/jolly-cerf-q0gsov instead.)
Then read docs/divecore-handoff.md, section "LATEST" (history, emci's decisions, the 5-phase plan, Lessons
learned), docs/divecore-layout-spec.md (NoticeLane rules) and docs/divecore-audit/notices.md (every notice today).

We are in Divecore Phase 2: ONE unified notification system in the reserved NoticeLane.
1. Finish notify() on the EXISTING pure queue src/play/notify/queue.ts (session 1 WIP: kinds celebrate /
   notify / error, priority, de-dupe, max waiting, durations, word caps — keep these kinds unless I decide
   otherwise) and wire the already-written scripts/check-notify.ts into package.json + check:ota-gate. Do NOT
   build a second queue. Fold in src/play/play-banner-queue.ts and bannerEvents. One line (numberOfLines 1),
   tap to dismiss / tap-through target. Renders in GameScreen's `notice` slot on every screen (Hideout, Turf
   War, Dive, pet games, list screens) — never resizes a region, never pushes the stage. Reduce Motion =
   gentle fade, never still. (Session 1's "Work in progress" list in the handoff describes these files.)
2. Move every Play notice to it: PlayBanner (src/play/play-banner.tsx, bannerReducer in src/app/play.tsx, the
   float at insets.top + 52), the Dive find/caption line, Turf War coach / paused lines, the Hideout pet strip
   and swipe hint. Remove PlayBanner when nothing uses it.
3. Gate: update check:play-banner (or replace it with check:notify) + pins in check:stage-bounds /
   check:fixed-regions. Keep it pure-testable like computeStageFrame.
4. Show me previews (real art, 430x932 + 375x667, docs/divecore/tools/README.md) of the lane with each notice
   kind BEFORE I choose anything about its look; keep the existing style.
5. Phone check: start `npm start` in a visible terminal tab and give me a short checklist; then npm run
   typecheck, npm run lint, npm run check:ota-gate — all green. After shots into docs/divecore/after/.
6. Update docs/divecore-handoff.md (state, files, Lessons learned, a ready Phase 3 prompt in this same format),
   the PR body and PROJECT_CONTEXT.md (DIVECORE MINIMAL line). Draft PR into feature/divecore-minimal. Then stop.

Do NOT start Phase 3-5. Rules: no merge to master, no OTA publish, no new native deps, no economy/odds/
rewards/save changes, never print EXPO_TOKEN or any key/token. Keep the style (Departure Mono + Rajdhani,
Pixelify on Street screens, cyan frames, solid buttons, fullscreen arenas, locked art rules, Reduce Motion =
gentle, never still). Show me previews before any layout choice; keep answers short and plain.
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
