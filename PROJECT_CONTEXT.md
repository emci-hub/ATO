# PROJECT_CONTEXT.md

## What ATO is
A self-based alternative to Costar-style astrology apps. Instead of generic daily content, it uses a multi-axis personality/behavior framework to generate accurate, personalized guidance. Goal: help users understand themselves and how they interact with others (e.g. why an extrovert might overwhelm an introvert), and nudge them toward growth and new experiences.

**Confirmed 16 axes** (`TRAIT_AXES` in `src/lib/traits.ts:15`): openness, conscientiousness, extraversion, agreeableness, steadiness, attachment_anxiety, attachment_avoidance, conflict_assertiveness, conflict_cooperativeness, autonomy, competence, relatedness, growth_mindset, locus_of_control, self_efficacy, playfulness.

Pointer only below this. Live status lives in the four tracked docs — keep them in sync, commit together, and `git push` immediately.

| File | Role |
|---|---|
| `docs/NOW.md` | What's shipped, latest OTA, what's left, next 15 min |
| `docs/ME.md` | Product + roster + live AI/model |
| `docs/ATO_PLAN_v2.md` | Working reference (not a locked spec) |
| `docs/BUSINESS.md` | Legal / brand / cost |

Expo SDK **54** in this repo. `AGENTS.md` still says to read https://docs.expo.dev/versions/v57.0.0/ before writing Expo code.

Do not commit `.env.local` or API keys. Do not change dependencies, schemas, auth, env config, or secrets without asking emci first.

## Snapshot (Sep 2, 2026)

- Branch: `master` @ `b74cdc6` — replaced optional-intake flow with 2-axis scenario questions (see Decisions log). Not yet published as an OTA update.
- Latest production OTA: `c9d31a38-867e-4017-99fa-0c3b55489b16` (removed MBTI type-code chips + dead onboarding grid screen). Binary 10+ only. The scenario-question rebuild above is committed but not yet on this OTA.
- Gemini key lives in gitignored `.env.local` and EAS production env (`eas env:set`). Classic `eas secret:list` is empty/deprecated.
- Claude/Grok need Supabase secrets `ANTHROPIC_API_KEY` / `XAI_API_KEY` or those adapters 503.
- Next product work: publish the scenario-question rebuild as an OTA update (if/when emci wants it live), full device pass (`docs/ATO_DEVICE_TESTS.md`) on binary 10, then Stage 8 invite/referral.

## Decisions log

- 2026-09-01: Unified AI provider layer shipped; Gemini key rotated; this file is a pointer, not a second source of truth.
- 2026-09-01: Fixed — onboarding screen 0 (MBTI four-letter type-code chips) removed. It turned out to BE the "grid" screen inferring O/C/E/A; sliders on the following screens always overwrote those same axes, so it was dead weight plus an unnecessary trademark risk. Optional-intake screens renumbered 0-7 (was 0-8). `self_grid` trait-source token kept read-only for existing users' historical data.
- 2026-09-02: Replaced the entire optional-intake flow (5 sliders + 2 close-pattern + 1 disagreement screen) with 8 new forced-choice scenario questions, each covering exactly 2 of the 16 axes (all 16 covered once), source draft in `docs/optional-intake-2axis-scenarios-DRAFT.md`. Added a new direct trait source, `self_scenario` — tried `self_situation` (inferred) first per the original spec, but that damps every write toward 0.5 for a null prior, so all 16 answers would've landed permanently in the mid band and been invisible to Sage-knows/pole-lines/completeness; switched to a direct source after flagging it to emci. Also fixed a pre-existing `ChipGroup` layout bug (`intake-chips.tsx`, missing `flexShrink`/`maxWidth`) found via visual QA — long chip text was overflowing mobile viewports instead of wrapping.
