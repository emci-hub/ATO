# PROJECT_CONTEXT.md

Pointer only. Live status lives in the four tracked docs — keep them in sync, commit together, and `git push` immediately.

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
