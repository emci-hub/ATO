# ATO-BUILD progress

Branch: `ato-build` (long-lived; every phase PR targets it, never master). One release, one OTA, at the end (PHASE-27).

## Checklist
```
Stage 0 Red team
- [x] PHASE-00 Red team of this plan + repo (fixes applied to ATO-BUILD.md)  ⚑ OK
Stage A Foundations
- [x] PHASE-01 Settings screen
- [x] PHASE-02 "This is you so far" → You
- [x] PHASE-03 Motion base + constellation (G1)
- [x] PHASE-04 Tab bar + layout reset
Stage B Profile & IA
- [ ] PHASE-05 Explore → You part 1
- [ ] PHASE-06 Explore → You part 2 + redirect
- [ ] PHASE-07 Roll = "Your reveals"
Stage C Gamify screens
- [ ] PHASE-08 Home (G2)
- [ ] PHASE-09 Insights (G3)
- [ ] PHASE-10 Legends (G4)
- [ ] PHASE-11 Cleanup
Stage D Quests
- [ ] PHASE-12 Quests content model + validator
- [ ] PHASE-13 Scoring + sims
- [ ] PHASE-14 Run engine + saves
- [ ] PHASE-15 Art 1: style lock + Lantern set (PixelLab)
- [ ] PHASE-16 Quests UI v3
- [ ] PHASE-17 Server, Apply, Undo, flags  ⚑ wave116
- [ ] PHASE-18 Style guide + The Drowned Lantern  ⚑ copy OK
- [ ] PHASE-19 The Masquerade  ⚑ copy OK
- [ ] PHASE-20 Last Train Home  ⚑ copy OK
- [ ] PHASE-21 Art 2: Masquerade + City + shared VFX (PixelLab)  ⚑ art OK
- [ ] PHASE-22 Atlas build + art integration
- [ ] PHASE-23 Quests entry points + tutorial + You
Stage E Polish & release
- [ ] PHASE-24 Per-mode polish (G5)
- [ ] PHASE-25 Quests QA + playtest  ⚑ playtest
- [ ] PHASE-26 Whole-app a11y + states
- [ ] PHASE-27 Regression QA + release  ⚑ wording, flags, OTA
```

## Log
- 2026-10-26: progress file created. Master pulled (up to date). `docs/ATO-BUILD.md` is untracked on master (not yet committed).
- 2026-10-26 PHASE-00: red team done. Wrote `docs/ato-build-redteam.md` (27 findings, 8 High) and applied fixes in `docs/ATO-BUILD.md` (CHANGELOG, wave116, verify-only status on 01/02/04/05/06/07/11, hardening on 03/08/10/12/13/14/16/17/22/23/27, ⚑ note in §1.9). Anchors unique (29 phase/appendix anchors + CHANGELOG). Branch `ato-build` cut from master. No app code touched; no checks run (docs only).
- Lesson: the plan's baseline was stale (IA pass already shipped); each phase should start by auditing the code, not assuming.

- 2026-10-26: emci OK'd the red-team findings/edits and R23 (plan wins for Quests art only; PixelLab pre-flight + one test clip + credit log kept). PHASE-00 ticked. Committed on `ato-build` (docs only, not pushed).
- 2026-10-26 PHASE-01 (verify-only): audit found settings.tsx complete (8 sections, You/Home decluttered, gear 44pt, delete/AI-off 2 taps). Fixed gaps: a11y role/label/state on the AI toggle (now `switch`), Sign out, Send feedback, Dev Tools Hub, Pixel lab; stale "on You" comments (running-update-line.tsx, index.tsx); plan text (5-tap opens /dev-lab, no /ai-lab route). Files: src/app/settings.tsx, src/components/running-update-line.tsx, src/app/(tabs)/index.tsx, docs/ATO-BUILD.md, this file. Gate: typecheck + lint (0 errors) + 194 offline checks green. NOT run: live checks delete-account, auth-password. NOT verified: 430x932 / 375x667 screenshots, Dynamic Type XXL, swipe-back (need a phone).
- Lessons: plan text can go stale vs code (ai-lab); the investigator audit before editing kept this phase tiny. No check:settings exists; you-restored + prod-you cover it.
- 2026-10-27 PHASE-02 (verify-only): PR 97 squash-merged into ato-build first. Investigator audit found no gaps: you.tsx:84-139 mirrors Home's fetch guards (requestIdRef, loadedOnceRef, tracksUserId===userId, [userId] reset); you.tsx:154 renders ProfileCharacter only when `tracksOwned && tracks.length > 0` (nothing on empty/failure, no profile-done gate, above IdentityCard); questions-fold.tsx has no ProfileCharacter. No app code changed. Files: docs/ato-build-progress.md, docs/ATO-BUILD.md. Gate: typecheck + lint (0 errors) + 194 offline checks green (includes questions, paged-questions, full-profile-signal, no-auto-ai, profile-history, you-restored, prod-you). NOT verified: phone check that the card shows on You for a real account.
- Lessons: check:profile-history already pins the card's position on You and its absence from Questions, so verify-only phases can lean on it. On failure You keeps old tracks silently (Home sets bootstrapFailed); left as is, it matches "render nothing".
- 2026-10-27 PHASE-03 (real build; emci chose option B for R18): PR 98 was already merged, branch `phase-03-motion-base` cut from ato-build. New: `src/lib/motion-tokens.ts` (§1.3 + haptics map), `src/lib/trait-constellation.ts` (pure star maths), `src/hooks/{use-motion-reduced,use-motion-active,use-breath}.ts`, `src/components/{press-pop,plus-pop,sheen,living-bg,gradient-fill,trait-constellation}.tsx`, `scripts/motion-check.ts` + `check:motion`. Edited: `motion.tsx` (Appear cross-fades in Reduce Motion, `breathe` prop for a hero; skeleton pulses at half size / quarter speed), `check-milestone-badge.tsx`, `daily-insights/try-today-card.tsx`, `week-strip.tsx`, `set-done-moment.tsx`, `sage-eight-ball.tsx`, `milestone-toast.tsx` (each now reads the phone's Reduce Motion AND the app's; variable name `reduceMotion` kept so pinned checks hold), `theme-lab.tsx` (Motion primitives section, normal + Reduce Motion), `scripts/polish-check.ts:98` (repointed to the new Appear line), `package.json`. Gate: typecheck + lint (0 errors) + 195 offline checks green (incl. `motion`, `polish`, `badges`, `daily-insights-ui`, `ui-bundle`, `appearance`, `trait-shape`). NOT verified: on-screen look and 60 fps (phone/simulator), 430x932 and 375x667 screenshots in all 5 appearance modes, VoiceOver.
- Lessons: the audit listed 3 files that loop but the scan found 7 (sage-eight-ball, week-strip, set-done-moment, milestone-toast too): always let the check do the counting. `useAppearance().reduceMotion` is itself the OS setting (AccessibilityInfo), so B adds no behaviour; it only makes the R18 rule literal. Not wired into any screen yet (PHASE-05 puts the constellation header on You). No haptics-off setting exists outside src/play, so the haptics map has no off switch. Reviewer: PASS, no High; fixed the pause-restart pop (clock reset), the radial blob grey ring (stopOpacity, not 'transparent'), mini/badge empty state and brighten, PressPop style type. Open (Low): no caller passes `Appear breathe` yet, so Appear only cross-fades in Reduce Motion; PHASE-05 sets `breathe` on the You constellation header. Gold fill and the `interpolateColor`-on-SVG-fill path need one look on a device.
- 2026-10-27 PHASE-04 (verify-only): PHASE-03 was merged into ato-build; branch `phase-04-tab-bar` cut from it. Investigator audit found all behaviour correct: pool `play` (nav-order.ts:62), default `['home','insights','you','play']` (:178), `NAV_LAYOUT_VERSION=3` in the layout JSON (:152), old/unversioned layouts reset once on read and saved edits are stamped v3 (me.ts:239, :401), Play slot does `router.push('/play')` (app-tabs.tsx:234), No DB change. Fixed only stale comments: nav-order.ts (:9, :172, :176, :240) and the nav-more-sheet.tsx header; plan step 5 text (Explore is not in More: removed in the IA pass, `/explore` redirects). Files: src/lib/nav/nav-order.ts, src/components/nav-more-sheet.tsx, docs/ATO-BUILD.md, this file. Gate: typecheck + lint (0 errors) + 195 offline checks green (incl. `nav`, `tab-rename`). NOT verified: on a phone (fresh account bar, old-layout reset).
- Lessons: `check:nav` already pins reset-once, persist, and the Divecore-only-when-Play-off-bar rule (nav-check.ts:81-97, :288-290), so no new assertion was needed. The plan's "Explore in More until PHASE-06" was stale; PHASE-06 should not look for an Explore tab to remove.

Blocked on: (none)
