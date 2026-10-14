---
name: dev-kit-redteam-facts
description: Release gating, server enforcement, RLS and ledger facts for the dev kit presets/reset (audited 2026-10-01)
metadata:
  type: project
---

- Gates differ per entry: labs theme/around/pixel/crisis/play = Stack.Protected(PRE_LAUNCH_DEV) + per-screen check (_layout.tsx:108). /dev-lab = authed stack + canSeeDevLab(__DEV__||7-tap unlock||PIN||root||grant). /ai-lab and RunningUpdateLine use PRE_LAUNCH_DEV||devUnlocked (NO PIN, any tester today). Hub's ResetAiConsent, LocalAccountData, ExploreRegen, ForceTestError are NOT PRE_LAUNCH_DEV-gated: root/grant/unlock users get them in prod.
- release-mode-check.ts only asserts the PRE_LAUNCH_DEV literal is false (production profile or RELEASE_MODE=1). Nothing else.
- Server: trait_history insert-own only (delete/update revoked, wave19); trait_tracks select/insert/update own, no delete (wave20); question_packs/items select-only, writes via insert_ongoing_round_pack (1-25 items, needs bank item id) + answer_question_item; ato_token_events select-only, deleted only by reset_my_test_data / reset_dev_test_user (and cascade when packs deleted, wave52 FK cascade). claim_full_profile_complete only counts >=50 trait_history rows source self_situation (client-forgeable by design). reset_my_test_data zeroes ato_tokens (cannot keep balance).
- clearLocalAccountData (lib/local-account-data.ts) wipes every ato.* key except device keys + resets the 3 in-memory caches + widget + cancels push. Covers answeredOption/categoryPage keys. Stamps key is full-profile:<me.id> (per account, not per run).
- Tabs load tracks once per mount (intake-sweep loadTracks [userId]); Hub refresh() only refreshes me context.
- Check scripts pinning kit text: dev-lab-sections-check (Home/Sage/You/System headings, ForceTestError x4, component placement), dev-test-user-check (5 stage ids, self_scenario must be DIRECT, intake panel regexes, wave75 text, ResetToFreshSignup slice), dev-fab-check (exports/plain declarations, no PRE_LAUNCH_DEV in fab, isDev line).
