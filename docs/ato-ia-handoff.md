# ATO IA handoff

State of the IA runner (`docs/ato-ia-runner.md`). The runner does ONLY the first unchecked phase each session.

## Checklist
- [x] P1 — Settings screen
- [x] P2 — "This is you so far" on You
- [x] P3 — New tab bar + one-time layout reset
- [x] P4 — Explore → You, part 1
- [x] P5 — Explore → You, part 2 + remove Explore
- [x] P6 — Roll = "Your reveals"
- [ ] P7 — Cleanup

## Log

### P6 — Roll = "Your reveals" (2026-10-26, branch `ia/p6-your-reveals`, stacked on `ia/p5-explore-to-you-2`, draft PR, no merge, no OTA)
Built by an Opus subagent (the runner says Opus builds P6). Files: `src/app/roll.tsx` (new, root Stack screen; the placeholder
`src/app/(tabs)/roll.tsx` was removed), `src/app/_layout.tsx` (`<Stack.Screen name="roll" />` in the authed + hasMe guard),
`src/components/app-tabs.tsx` (roll trigger dropped; the `explore` redirect trigger stays), `src/app/(tabs)/legends.tsx` (a
"Your reveals ›" link and a `hall` route param only; no copy constants touched), checks nav, rebuilt, no-auto-ai.
- Screen (display only, no spend/claim/refund/save/model call): the Today panel (free reveal used, bonus open, extra reveal costs
  `AI_TOKEN_PRICE` tokens + balance), one "Reveal in Legends ›" row per hall (opens that hall in Legends), and every legend met,
  grouped by hall, each opening its saved story free via `LegendStoryCard`. Locked and zero-met cases have plain lines.
- Nothing changed in prices, rewards or quotas; rerolls stay frozen. Lessons: (1) rebuilt-check pinned roll as a parked
  RebuiltNotice screen; it now pins "real screen, no RebuiltNotice, no backend patterns" instead. (2) nav-check's "/roll is a hidden
  TabList trigger" pin became "roll is a root Stack screen with no trigger and not a pool id".

### P5 — Explore → You, part 2 + remove Explore (2026-10-26, branch `ia/p5-explore-to-you-2`, stacked on `ia/p4-explore-to-you-1`, draft PR, no merge, no OTA)
Files: `src/app/(tabs)/you.tsx` (CategoriesFold + CategoryDeepDiveCard with the same props/gates, FullProfileFold, `Legends ›` / `Circle ›`
NavRows, `section` now also `categories|profile|tokens`), `src/app/(tabs)/explore.tsx` (now only `<Redirect href="/you?section=categories" />`),
`src/lib/nav/nav-order.ts` ('explore' removed from `ReorderableTabId` / `NAV_TABS`; a saved layout holding it loses it and backfills),
`src/components/app-tabs.tsx` (hidden `explore` trigger in `HIDDEN_TAB_ROUTES` so the redirect route stays navigable),
`src/components/category-teaser.tsx` + `src/lib/push-copy.ts` (links repointed), `src/lib/dev-fab-model.ts` (the trait dev tools follow the
trait bands to `/you`), 11 check scripts repointed (nav, tab-rename, explore, explore-refetch, category-deep-dive, dev-fab, dev-test-user,
full-profile, full-profile-signal, wave21, wave22).
- Lessons: (1) a route removed from the pool still needs a hidden TabList trigger or a stale deep link throws instead of redirecting.
  (2) `rg "'/explore'"` under src now finds only the app-tabs trigger; a check scans for it. (3) explore-refetch-check used to pin
  Explore's own `fetchTraitTracks` refetch; You refetches via `home_bootstrap` on focus (requestIdRef + loadedOnceRef), so it was
  repointed and the redirect is pinned to fetch nothing. (4) `home-teaser.ts` / `preview-mode.ts` built no /explore links, so untouched.
  (5) Phone look: a push or link to `/explore` lands on You at categories; More has no Explore row.

### P4 — Explore → You, part 1 (2026-10-26, branch `ia/p4-explore-to-you-1`, stacked on `ia/p3-tab-bar`, draft PR, no merge, no OTA)
Files: `src/app/(tabs)/you.tsx` (ShapeCard behind a skeleton until `tracksReady && tracksOwned`; a traits block with TraitBandsFold,
ProfileFillFold, ChangeCard; `?section=shape|traits` scrolls via `onLayout` y positions), `src/app/(tabs)/explore.tsx` (only those components
removed, plus their now-unused imports), checks category-deep-dive, explore, full-profile, polish, trait-bands, wave19, wave20, profile-history.
- Lessons: (1) You reuses P2's `home_bootstrap` tracks (same `TraitTrack[]`), so no second fetch; Explore keeps its own `fetchTraitTracks`
  for categories until P5. (2) `full-profile-check` had one cross-screen ORDER pin (bands before FullProfileFold); the two now live on different
  screens, so it became presence on You + absence on Explore rather than an order. (3) The ShapeCard still routes to `/intake-sweep`.
  (4) Phone look: shape and traits on You before/after the profile is done; `/you?section=traits` scrolls to the block.

### P3 — New tab bar + one-time layout reset (2026-10-26, branch `ia/p3-tab-bar`, stacked on `ia/p2-you-so-far`, draft PR, no merge, no OTA)
Files: `src/lib/nav/nav-order.ts` (pool id `play`, `PUSHED_TAB_IDS`, `NAV_LAYOUT_VERSION = 3` stored inside the layout JSON, default
`['home','insights','you','play']`), `src/components/app-tabs.tsx` (`PushTabButton` pushes `/play`, no hidden tab trigger for it),
`src/components/nav-more-sheet.tsx` ("Open Divecore" row only when Play is not on the bar), checks `nav-check` + `tab-rename-check`.
`nav-context.tsx` needed no change (the version rides through `normalizeNavLayout` in `me.ts`; no DB schema change).
- Lessons: (1) the reset is a READ rule keyed on `version !== 3`; the edit screen's write path (`resetShort:false`) stamps the
  version, so a user's later edit is never reset. (2) Every old test that fed an unversioned layout to `normalizeNavLayout` now
  resets to the default, so those inputs got `version: NAV_LAYOUT_VERSION` (or the write path); new pins assert that unversioned
  and v2 layouts reset, that a v3 layout is kept, and that a saved edit is stamped. (3) More now lists Questions, Explore, Legends,
  Circle (registry order). (4) Needs a phone look: fresh account bar, an old custom layout resetting once, a re-edited layout
  persisting, Play opening Divecore from the bar.

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
