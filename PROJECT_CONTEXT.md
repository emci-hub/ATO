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

- Branch: `master` @ `dac0813` — replaced optional-intake flow with 2-axis scenario questions (see Decisions log).
- Latest production OTA: `6b5cf8d4-442e-4f21-9682-7cdf0ff78e35` (8-screen optional intake replaced with 8 scenario questions covering all 16 axes; chip text overflow fix). Binary 10+ only.
- Gemini key lives in gitignored `.env.local` and EAS production env (`eas env:set`). Classic `eas secret:list` is empty/deprecated.
- Claude/Grok need Supabase secrets `ANTHROPIC_API_KEY` / `XAI_API_KEY` or those adapters 503.
- Next product work: full device pass (`docs/ATO_DEVICE_TESTS.md`) on binary 10, then Stage 8 invite/referral. New OTA not yet pushed for today's Nine→Eight Quick Taps fix — do that next.

## Decisions log

- 2026-09-01: Unified AI provider layer shipped; Gemini key rotated; this file is a pointer, not a second source of truth.
- 2026-09-01: Fixed — onboarding screen 0 (MBTI four-letter type-code chips) removed. It turned out to BE the "grid" screen inferring O/C/E/A; sliders on the following screens always overwrote those same axes, so it was dead weight plus an unnecessary trademark risk. Optional-intake screens renumbered 0-7 (was 0-8). `self_grid` trait-source token kept read-only for existing users' historical data.
- 2026-09-02: Replaced the entire optional-intake flow (5 sliders + 2 close-pattern + 1 disagreement screen) with 8 new forced-choice scenario questions, each covering exactly 2 of the 16 axes (all 16 covered once), source draft in `docs/optional-intake-2axis-scenarios-DRAFT.md`. Added a new direct trait source, `self_scenario` — tried `self_situation` (inferred) first per the original spec, but that damps every write toward 0.5 for a null prior, so all 16 answers would've landed permanently in the mid band and been invisible to Sage-knows/pole-lines/completeness; switched to a direct source after flagging it to emci. Also fixed a pre-existing `ChipGroup` layout bug (`intake-chips.tsx`, missing `flexShrink`/`maxWidth`) found via visual QA — long chip text was overflowing mobile viewports instead of wrapping.
- 2026-09-02: Audited the separate "Nine Quick Taps" core-intake screen (`intake.ts`/`core-intake-sweep.tsx` — unrelated to the scenario/axis flow above, none of its 9 fields ever wrote to a trait axis). Found `talk_style` already wired into the AI tone guide but too weak to notice; `evening_wind_down` and `current_focus` collected but with no guaranteed on-screen or push effect; `recovery_style` a true orphan. Fixed all four: strengthened `TALK_STYLE_GUIDE` (`voice/providers/types.ts`) with distinct word-choice/length/exclamation rules per tone; wired `evening_wind_down` into the evening Check push body via the existing `cueAfterYou` helper (`push-copy.ts`/`push.ts`/`push-runtime.tsx`) — a doc comment in `me.ts` had literally said "wiring later"; added a deterministic `current_focus` line to the Explore tab header; removed `recovery_style` entirely from the app (screen now "Eight Quick Taps", `CORE_INTAKE_TOTAL` 9→8). Mid-fix, review caught that the live `complete_signup` RPC (`wave23_optional_intake.sql`) overwrites `recovery_style` on re-save instead of coalescing (unlike every other field in the same function) — with the app no longer sending a value, any already-onboarded user hitting the re-save path would've had it silently nulled. Added `wave24_recovery_style_resave_coalesce.sql` to fix just that one line, confirmed with emci first. DB column itself untouched; existing users keep their historical value. Copy-quality review of the remaining 8 questions/chip labels drafted in `docs/eight-quick-taps-copy-review-DRAFT.md`, not yet applied — flags two prompts that informally say "nudge" for a feature that isn't the real in-app Nudge, plus a pre-existing first-person/second-person pronoun mismatch in cue chip values ("When you put my phone down") shared by morning_cue and evening_wind_down.
