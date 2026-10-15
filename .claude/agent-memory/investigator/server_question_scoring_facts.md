---
name: server-question-scoring-facts
description: Server-side map of question validation/scoring (wave79), pool tables, token claims, reset RPCs (2026-10-06)
metadata:
  type: project
---

- wave79_trait_checkpoint.sql: intake_questions(prompt PK, axis, set_no 1-3, options jsonb) is the server 48 bank (wave84 added reworded rows, old kept = 84 rows). answer_intake_question keys by PROMPT TEXT, gate = trait report answer_count == set_no-1. _trait_write does EWMA. trait_answers log (kind intake/round, question_key, option_index, value) is append-only; no unique key, so nothing is replaced today.
- Round answers: question_items (per user, options jsonb, answered_option) validated by answer_round_item. Pool = question_bank_pool (wave49, authored/ai, created_by wave74), RPCs fetch_bank_candidates/insert_bank_pool_items/bank_pool_depth.
- Tokens: ato_token_events ledger, partial unique indexes = idempotency; claim_full_profile_complete (wave78) once ever, claim_ongoing_round_complete (wave81 cap 2/day). "1 per item per day" = reroll spend index only.
- start_over_my_test_data (wave76) does NOT delete trait_answers or daily_pick_answers (wave82 is later). wave80 lock prepared, not applied.
- ai-generate is a generic proxy (callType sage|explore); questions prompts are built client-side. No pg_cron for questions (only dev-trace-expire in dev_access.sql).
