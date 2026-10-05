# ATO — map for agents

ATO is an invite-only iOS app (Expo SDK 54 / expo-router / Supabase): one daily insight
(loaded on a tap; it replaced the old Read + Do card), a 16-axis trait profile that every AI surface reads from, and a small
scanned-in Circle. `PROJECT_CONTEXT.md` is the memory; `docs/NOW.md` is live status.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm start` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| One check | `npm run check:<name>` (see `package.json`; `scripts/*-check.ts`) |
| Full gate | `npm run check:ota-gate` — typecheck + lint + every offline check |
| Publish OTA | `npm run ota:publish -- <eas args>` — refuses unless the gate is green. Never bare `eas update`. |
| Release mode | `RELEASE_MODE=1 npm run check:release-mode` (auto on EAS production builds) |

Live checks (need real accounts / network / keys) are excluded from the gate and run by hand:
`around`, `auth-password`, `apple-revoke`, `card-live`, `crisis-live`, `delete-account`,
`founder-access`, `intake-live`, `invite`, `question-live`, `quota`, `sentry`, `style-live`, `talk-live`.

## Hard invariants

- **No vendor key in the bundle.** Every model call goes `generateText` → `ai-generate`
  Edge Function; keys are Supabase secrets. `check:ai-provider` fails on any
  `EXPO_PUBLIC_*_API_KEY` reference under `src/`.
- **Quota is claimed server-side** (`claim_ai_call` inside `ai-generate`), output tokens
  capped at 1024. The client never decides whether a paid call happens.
- **Root is `me.is_root`**, never a handle string. `is_root()` / `require_root()` read it;
  a trigger refuses client writes to the column.
- **`record_check` is the only write path for a Check.** Today or up to 2 days back;
  day 3+ is closed. Read/Do text lives 7 days; did/skip forever.
- **Trait writes go through the server checkpoint** (`src/lib/trait-checkpoint.ts` →
  wave79 RPCs: `answer_intake_question`, `answer_round_item`, `set_trait_direct`,
  `record_game_pick`, `confirm_trait_sources`, `apply_dev_trait_preset`). The server
  checks the question/option and runs the EWMA (port of `applyEwmaAnswer` /
  `mergeTraitWrite`, pinned by `check:trait-checkpoint`). No client code writes
  `trait_tracks`, `trait_history` or the `me` trait columns. A tap is not an answer:
  it moves the value, never `answer_count`. wave80 (the lock) is prepared, NOT applied.
- **`PRE_LAUNCH_DEV`** (`src/lib/dev-mode.ts`) un-gates dev tooling while invite-only.
  Must be `false` before a public build — `check:release-mode` enforces it. With it
  off, no dev tool renders for anyone: no PIN, password unlock or grant opens the Hub's
  testing groups, the DEV bubble or the AI lab (`DEV_TOOLS_AVAILABLE`, `hubAccess`).
  Root keeps the Hub's Admin group only. A new dev panel goes inside the `tools`
  branch of `dev-lab.tsx`, or `check:release-mode` fails.
- **Crisis card is static** — never a generated number, never a guessed region.
- **Dev testing uses the dev-test user** (`ato-dev@example.com` / `@atodev`). **Two
  things may act on the SIGNED-IN account's own data pre-launch (emci, 2026-10-01):**
  the "Jump this account" stages (`applyDevIntakeStagePreset`: first read 16, set 2 done
  32, one short 47, the 48, round 1 finished, the old 50), which any signed-in account may use on itself, and
  "Start over" (`start_over_my_test_data`, wave76), which is root only on the server and
  keeps the account and its token balance. Both take two taps. Deleting a profile to
  re-run the sign-up form (`reset_dev_test_user`) stays dev-test-user only. Agents still
  never sign in as, or write to, a real account themselves.
- **Every dev or admin action that writes takes two taps** (`useTwoTap` in
  `dev-lab.tsx`), or a typed handle where it cannot be undone.
- **New copy and new AI prompts use the moment voice (emci 2026-10-02).** One concrete,
  recognizable moment from how people live now (texts, group chats, read receipts, tabs),
  teased kindly, no advice, no slang. Rules + approved examples: `src/lib/voice/moment-voice.ts`;
  drop `MOMENT_VOICE_BLOCK` into any new generation prompt. Older surfaces (question
  prompts, categories, Story, the insight's five fields) are not converted yet.
- **Unreviewed copy ships behind `*_COPY_REVIEWED = false` flags.** Story / Levity are
  diagnosis-adjacent; not shippable as reviewed without emci's read.
- Do not change dependencies, auth, env config, or secrets without emci's ok.
- **Schema changes that copy a tested path need no ask (emci 2026-10-02).** A new table /
  RLS / RPC built the same way as one already live here (e.g. the question pool) is
  built without asking and named in the report. A NEW kind of pattern, or anything that
  alters or deletes existing data, still needs emci's ok first.

## Where things are

| Need | Go to |
|---|---|
| Every file, one line each | `docs/MAP.md` |
| How data moves (auth → card → check → traits → AI) with file:line | `docs/FLOWS.md` |
| Known traps before you edit | `docs/GOTCHAS.md` |
| What is shipped / latest OTA / next | `docs/NOW.md` |
| Product, roster, live AI model | `docs/ME.md` |
| Legal, brand, cost | `docs/BUSINESS.md` |
| Device test checklist | `docs/ATO_DEVICE_TESTS.md` |
| Old plan (reference only, not rules) | `docs/archive/OLD_PLAN.md` |
| Schema + RLS + RPCs | `supabase/migrations/*.sql` (chronological: stage* → wave*) |
| Edge Functions (Deno) | `supabase/functions/{ai-generate,apple-link,delete-account,review-access,refresh-around,dev-unlock,password-login}` |

Expo docs for this repo: https://docs.expo.dev/versions/v54.0.0/ (SDK 54 — check
`package.json` before trusting any other version).
