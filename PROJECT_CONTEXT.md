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

## Snapshot (Sep 1, 2026)

- Branch: `master` @ `6e07fbc` plus this docs commit.
- Latest production OTA: `b84f0aa6-a668-4d59-8374-ea9c96e95f63` (provider layer + rotated Gemini key). Binary 10+ only.
- Gemini key lives in gitignored `.env.local` and EAS production env (`eas env:set`). Classic `eas secret:list` is empty/deprecated.
- Claude/Grok need Supabase secrets `ANTHROPIC_API_KEY` / `XAI_API_KEY` or those adapters 503.
- Next product work: full device pass (`docs/ATO_DEVICE_TESTS.md`) on binary 10, then Stage 8 invite/referral.

## Decisions log

- 2026-09-01: Unified AI provider layer shipped; Gemini key rotated; this file is a pointer, not a second source of truth.
