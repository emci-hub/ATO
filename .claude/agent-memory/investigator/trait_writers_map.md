---
name: trait-writers-map
description: Every client writer of trait_tracks/trait_history/me trait cols, guard-trigger patterns, gotchas for moving writes server-side (2026-10-02)
metadata:
  type: project
---

- Client writers all funnel through src/lib/me.ts persistMergedTraits (updateTraits, recordSageKnowsCorrection, recordRanking/StandaloneRanking, recordForcedPick, recordScenario/StandaloneScenario) EXCEPT: confirmTraits + recordSageKnowsFits (me-only, persistMe), applyQuestionAnswer secondary nudge (answer.ts: updateTraitTrackValueOnly + insertTraitHistory), stampAxisDepth (last_depth_at), dev-test-user.ts jump (me update + upsertTraitTracks + insertTraitHistory top-up).
- me trait cols: 16 axis cols + trait_sources + trait_touched_at (jsonb). Guard patterns: wave34 me_guard_is_root (checks auth.jwt role; would ALSO block definer RPCs called by a client) vs wave51 me_ato_tokens_guard (tx-local setting ato.allow_ato_token_write) - use the latter pattern.
- Intake answers carry no question id server-side (axisVariant = answer_count picks the draft); only round answers have question_items rows (answer_question_item RPC wave18).
- Live UI mounts: ask-sheet.tsx (Ranking/Scenario/SageKnows bodies), full-profile-fold (explore.tsx) + DepthDive, questions-fold (intake-sweep.tsx). optional-intake.tsx not imported anywhere.
