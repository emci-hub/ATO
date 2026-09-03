# ATO — map for agents

ATO is an invite-only iOS app (Expo SDK 54 / expo-router / Supabase): one daily card
(Read + Do), a 16-axis trait profile that every AI surface reads from, and a small
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
`founder-access`, `intake-live`, `invite`, `quota`, `sentry`, `style-live`, `talk-live`.

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
- **Trait writes go through `mergeTraitWrite` → `updateTraits`** (EWMA, direct sources
  sticky over inferred). Direct writes to trait columns are dev-user-only.
- **`PRE_LAUNCH_DEV`** (`src/lib/dev-mode.ts`) un-gates dev tooling while invite-only.
  Must be `false` before a public build — `check:release-mode` enforces it.
- **Crisis card is static** — never a generated number, never a guessed region.
- **Dev testing uses the dev-test user** (`ato-dev@example.com` / `@atodev`) and its
  persona presets. Never a real login, never a real account's traits.
- **Unreviewed copy ships behind `*_COPY_REVIEWED = false` flags.** Story / Levity are
  diagnosis-adjacent; not shippable as reviewed without emci's read.
- Do not change dependencies, schemas, auth, env config, or secrets without emci's ok.

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
| Edge Functions (Deno) | `supabase/functions/{ai-generate,apple-link,delete-account,review-access,refresh-around}` |

Expo docs for this repo: https://docs.expo.dev/versions/v54.0.0/ (SDK 54 — check
`package.json` before trusting any other version).
