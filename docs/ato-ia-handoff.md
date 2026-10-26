# ATO IA handoff

State of the IA runner (`docs/ato-ia-runner.md`). The runner does ONLY the first unchecked phase each session.

## Checklist
- [x] P1 — Settings screen
- [x] P2 — "This is you so far" on You
- [ ] P3 — New tab bar + one-time layout reset
- [ ] P4 — Explore → You, part 1
- [ ] P5 — Explore → You, part 2 + remove Explore
- [ ] P6 — Roll = "Your reveals"
- [ ] P7 — Cleanup

## Log

### P2 — "This is you so far" on You (2026-10-26, branch `ia/p2-you-so-far`, stacked on `ia/p1-settings`, draft PR, no merge, no OTA)
Files: `src/app/(tabs)/you.tsx` (same `fetchHomeBootstrap` + `requestIdRef` / `loadedOnceRef` / `tracksUserId` guards as
Home, refetch on focus, `<ProfileCharacter>` at the top when tracks exist), `src/components/questions-fold.tsx` (render +
import removed), `scripts/profile-history-check.ts` (one pin replaced). `profile-character.tsx` untouched.
- Lessons: (1) only ONE check pinned the old wiring (`profile-history-check`, "character shows after the 48"); it now pins
  the reverse (gone from Questions) plus You's wiring, so nothing was dropped. (2) The card now shows any time tracks
  exist, not only between the 48 and set 25; a brand-new account with no tracks shows nothing. (3) P2 branches from P1
  because both rewrite `you.tsx`; merge P1 first (or merge them together). (4) No screenshots again (sign-in wall).

### P1 — Settings screen (2026-10-26, branch `ia/p1-settings`, draft PR, no merge, no OTA)
Files: `src/app/settings.tsx` (new), `src/app/(tabs)/you.tsx`, `src/app/(tabs)/index.tsx`, `src/app/_layout.tsx`
(`<Stack.Screen name="settings" />` inside the authed + hasMe guard), and 14 check scripts repointed (age, appearance,
circle-safety, dev-access, dev-fab, dev-lab, dev-unlock, floor, helpline-row, local-account-data, rebuilt, running-update,
ui-bundle, you-restored). Nothing under `src/play`, no native dep, no AI call.
- Sections on /settings: Appearance, Profile details (city + birthday), Notifications, Privacy & AI, Help & legal
  (helpline row, Send feedback, legal links), Account (Sign out, Delete account), About (running update line), Developer
  (Hub / Pixel lab / PIN box, same gates as before). Delete account and AI on/off are two taps from Home (gear) or You (row).
- `FEEDBACK_EMAIL` / `SEND_FEEDBACK_LABEL` exports now live in settings.tsx (age-check reads them there).
- Lessons: (1) ~15 checks regex-read you.tsx/index.tsx source, so any move needs a repoint pass; run the gate once
  first to get the exact list. (2) polish-check pins the exact `<ThemedText type="subtitle">{HOME_TITLE}</ThemedText>`
  markup, so the Home gear was added next to it, not by changing it. (3) appearance-check wanted the picker right after
  the build line; on Settings the build line is under About, so that pin became "picker present, build line present,
  picker above it" (no assertion dropped). (4) Screenshots (430x932 / 375x667) were NOT taken: the web preview stops at
  the sign-in wall and agents never sign in to a real account. emci please eyeball /settings, You and Home on a phone.
