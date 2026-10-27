# ATO-BUILD progress

Branch: `ato-build` (long-lived; every phase PR targets it, never master). One release, one OTA, at the end (PHASE-27).

## Checklist
```
Stage 0 Red team
- [x] PHASE-00 Red team of this plan + repo (fixes applied to ATO-BUILD.md)  ⚑ OK
Stage A Foundations
- [x] PHASE-01 Settings screen
- [ ] PHASE-02 "This is you so far" → You
- [ ] PHASE-03 Motion base + constellation (G1)
- [ ] PHASE-04 Tab bar + layout reset
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

Blocked on: (none)
