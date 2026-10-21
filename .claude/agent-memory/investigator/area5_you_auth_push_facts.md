---
name: area5-you-auth-push-facts
description: You tab/auth/push/widget launch-readiness facts (2026-10-19): no legal links in app, push ask never fires, /play guarded by PRE_LAUNCH_DEV, stale widget header
metadata:
  type: project
---

- src/app/_layout.tsx:109-118 puts `play` under Stack.Protected guard={PRE_LAUNCH_DEV} (contradicts play.tsx:122 "on in every build"); More sheet pushes /play (nav-more-sheet.tsx:101). Public build likely loses Divecore. check:release-mode doesn't test it.
- Push permission: push.ts:125 asks only if checkCount>=1 (use-growth fetchChecks) but Check loop is parked -> never asked; only pet-reminder.ts:77 asks (opt-in). Morning push = Today's Pick prompt (public text).
- No privacy/terms link in any .tsx; legal md at src/app/legal/*.md only. You tab (you.tsx) has delete, sign out, feedback mailto, AI consent, helpline. No data export, no IAP/restore.
- Widget targets/widget/widgets.swift: static "SAGE · COACH", READ/DO labels; home-screen families only (no lock screen).
- Auth screens (src/app/auth/*) have zero accessibility* props.
- signup_mode read in invite.ts:36, fail-closed invite_only; public hides invite field (auth/index.tsx:149, onboarding.tsx:354).
