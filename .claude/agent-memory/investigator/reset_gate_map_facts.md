---
name: reset-gate-map-facts
description: Intake gate (48 or old 50) and reset-path coverage gaps as of 2026-10-07; where start_over / reset_dev_test_user / count_user_rows stop short
metadata:
  type: project
---

- Live gate = reachedFullProfile (src/lib/questions/intake-stage.ts:93): every report trait answerCount>=3 OR legacy 50 shape. Server twin: wave78 claim_full_profile_complete (3 on 16 axes OR legacy 50 OR >=50 self_situation history). Bank "8 sets = full profile" (bank-sets.ts) is copy/profile-fill only, gates nothing.
- Latest start_over_my_test_data = wave85 sec 14 (adds trait_answers, trait_flags, trait_profile_snapshots). NOT cleared: trait_answer_changes (wave86), daily_pick_answers (wave82), daily_line_days (wave77, separate clear_my_daily_lines), ato_token_events other than full_profile_complete, ai_usage, checks, me.ato_tokens, owned styles/identity (device ato.identity.v1).
- reset_dev_test_user latest = wave71 (+wave69 daily_insights); lacks wave77/79/82/85/86 tables (they FK auth.users, not me, so survive me delete). count_user_rows latest = wave72 (written, may be unapplied); same gaps.
- Tracks readers have NO single seam: fetchTraitTracks (trait-tracks-store.ts:45) used by ~10 components; Home uses parseTraitTrackRows via home_bootstrap; Questions uses fetchBankProgress RPC; tokens via me.ato_tokens.
- dev-lab-sections-check pins exact HubSection order/titles and exact component list under "Move my account"; release-mode-check pins render-tree text layout (branch close string before Admin).
