---
name: sage-crisis-inventory-facts
description: Sage/Talk/crisis wiring as of 2026-10-14 - sage tab parked, Talk is placeholder, crisis_flags has no writer, live AI paths, storage keys
metadata:
  type: project
---

- Routes live in src/app (not app/). Tabs declared in src/components/app-tabs.tsx (Sage trigger :107); sage is in PARKED_PINNED_IDS (nav-order.ts:101) but DEFAULT_NAV_LAYOUT still lists it (:159); layout persisted server-side in me.nav_layout (me.ts:401), not AsyncStorage.
- src/app/(tabs)/sage.tsx and src/app/chat.tsx are RebuiltNotice placeholders; no model call. addFact (me.ts:782) has zero callers; me.facts read by explore/combine.ts:158 and ask.ts.
- crisis_flags: only read (days.ts, home_bootstrap SQL) and deleted (reset RPCs). No writer anywhere. Real trigger = local AsyncStorage ato.crisis.today.v1 via noteCrisisText (only addFact + dev-lab call it).
- STORY_AI_POLISH=false (story-v3/polish.ts:6) makes sage-story-fold.tsx:242 return before library/paid path. BUT rewriteOldStory (:409, fired on fold open :494) still calls generateStoryCardText for legacy stories.
- Day helper: src/lib/local-date.ts:9 localYmd(date, tz). daily-insights uses it via hooks/use-try-today.ts; pickConflict/pickSuperpower do not use dates.
- Sign-out wipe: clearLocalAccountData (local-account-data.ts:174) deny-by-default on ato.*; called from supabase.ts:86 and you.tsx:93. Crisis region keys are on the keep-list.
- Pitfall: grep "sage" case-insensitive matches "message"; use "Sage" case-sensitive (395 hits / 97 src files).
