# Sage cleanup — later work

The Sage tab was replaced by template-only Insights, and the crisis system was removed
(branch `feature/insights-replace-sage`, 2026-10-14). The user-facing surfaces are done.
Everything below was left on purpose: each item is a migration, a deploy, a native build
or a separate-scope change, and none of it is user-visible.

## Step 3 status (2026-10-20)

Legal text is promoted: `src/app/legal/{terms,privacy,app-privacy-labels}.md` and `landing/{terms,privacy,index}.html` now describe the post-Sage app (no Sage, no crisis scanning/logging, AI only for Legends cards and category deep dives, Divecore save, AI usage log), with `[CONFIRM: ...]` tags for facts only emci or a lawyer can supply (`docs/legal/OPEN-QUESTIONS.md`). Docs corrected: `MAP`, `FLOWS`, `GOTCHAS`, `NOW`, `ME`, `BUSINESS`, `DATA_AI_MAP`, `screen-map`, `dead-weight`, `ATO_DEVICE_TESTS`. Still open: the database drop (section 1; wave103 drops crisis plumbing and is UNAPPLIED, see `docs/under18-server.md`), the two "Write as Sage" prompts (section 2), the Play credits line (3), the widget header (4), module renames (5), and the `ATO_DEVICE_TESTS` rewrite (6). The privacy text says `sage_messages`, `crisis_flags` and `me.facts` retention is `[CONFIRM]`: until section 1 is applied those rows may still exist for old accounts.

## 1. Database (one migration, applied after emci's ok — it deletes data)

| Item | Where it came from | Note |
|---|---|---|
| `sage_messages` table | `stage7_chat_report.sql` | Sage chat history. Nothing reads or writes it now. Dropping deletes user text, so it needs emci's ok and a policy decision on retention (see `docs/legal/`). |
| `crisis_flags` table | crisis system | Flag + timestamp rows. Same: deleting is a data deletion. |
| `me.facts` column | Teach Sage | `addFact` is gone; the column still holds what people taught Sage. Delete after the privacy text ships. |
| `'sage'` tag on `ai_usage` | `stage8_ai_quota.sql` and later | Historic rows keep the tag. Keep until the usage log no longer needs the history, then stop writing and optionally backfill/rename. Dev Hub quota readouts still call `fetchSageUsage`. |
| Story library rows | Story cards in the shared AI library | Rows written by "Write as Sage" prompts. They stay valid; re-seed under the new voice at the next `LIBRARY_VERSION` bump. |
| `crisis_since` | `wave35_home_bootstrap.sql:66` (`home_bootstrap`) | The RPC still returns it; the client ignores it. Remove in a new migration that replaces `home_bootstrap` (copy the live function, drop the key). |

## 2. The two "Write as Sage" prompts — DONE

**Done (2026-10-22 / 2026-10-23):** `story` left the shared AI library (roadmap A3, `ai-library` + `ai-library-fill` redeployed,
bundle regenerated), and the two prompts themselves (`sage-story.ts` and `story-card.ts`, `STORY_CARD_PROMPT_STATIC`)
were deleted in step A5. The server bundle carries no "Write as Sage" text (`check:ai-library`) and `check:no-sage-copy`
has zero exemptions. No `LIBRARY_VERSION` bump was needed for deep dives or Legends (their prompts did not change).

## 3. Play credits line

`src/play/credits.ts:95`: "Play is optional — Home, Check and Sage are never gated behind
it." Rename in a **separate Play-only change** (`check:play-isolation` rejects a Play edit
mixed with app edits). Suggested wording: "Home, Check and Insights…".

## 4. Widget header

**DONE (master-plan Step 3, 2026-10-20): the header now reads "ATO" (`widgets.swift:45,68`).** What is still stale
in the widget is the "READ" / "DO" labels and "Today's Read and Do." description (roadmap v2 S13, next native build).
Original note: `targets/widget/widgets.swift:45`: `Text("SAGE · COACH")`. Swift, so it changes only with
the next native build, not an OTA. Suggested: an ATO / Insights header.
`scripts/floor-check.ts` and `scripts/push-check.ts` pin that string; update them together.
(The `'sage'` default `callType` in `supabase/functions/ai-generate/index.ts` is gone: that function is a 410 stub and,
after emci's OK, is deleted — roadmap A5, D14. The `'sage'` tag on `ai_usage` keeps only historic rows.)

## 5. Module renames of `sage-*` files

Pure renames, no behaviour change; do after the items above so imports move once.

- `src/lib/sage-copy.ts`, `sage-eight-ball.ts`, `sage-knows.ts`, `sage-story.ts` (now only the saved-Story shape and helpers),
  `sage-story-store.ts`, `sage-title.ts` (now only the saved-title reader). (`sage-title-store.ts` no longer exists.)
  Renaming stays skipped (master-plan D11): invisible to users.
- `src/components/sage-eight-ball.tsx`, `sage-knows-card.tsx`
- Related identifiers: `SageEightBall`, `fetchSageUsage` / `SageUsageSnapshot` /
  `formatSageUsage` (`src/lib/voice/quota*.ts`), `recordSageKnowsFits` (`src/lib/me.ts`),
  `src/app/voice/sage.txt`
- Several `scripts/*-check.ts` read these paths by name (`sage-knows-check`,
  `sage-load-check`, `story-*`). Update them in the same commit as each rename.
- `docs/MAP.md` and `docs/FLOWS.md` list these files; refresh them.

## 6. Also pending

- Public privacy/terms text: promoted from the `docs/legal/*.DRAFT.md` files on 2026-10-20 into
  `src/app/legal/*.md` and `landing/privacy.html` / `landing/terms.html` (not published; `[CONFIRM]` tags remain).
- `docs/ATO_DEVICE_TESTS.md` still has Sage/crisis device-test boxes; rewrite for Insights
  and the helpline row after a device pass.
