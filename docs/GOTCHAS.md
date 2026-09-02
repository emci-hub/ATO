# GOTCHAS — known traps

Read before editing the area. Each one has bitten this repo at least once.

## Process

- **The OTA gate is the only automation.** No CI. `npm run ota:publish` runs
  typecheck + lint + every offline check and refuses to publish on failure. A bare
  `eas update` skips all of it.
- **Checks are string assertions on source.** Renaming a function, escaping an
  apostrophe (`&apos;`), or moving a guard breaks a `scripts/*-check.ts` regex. Run the
  check for the file you touched (grep `scripts/` for the filename).
- **`check:prod-you` is inverted on purpose** while `PRE_LAUNCH_DEV` is true (asserts
  the probes ship). Re-invert it when the flag flips.
- **`npm run -s check:<x>` can exit 1 silently on Windows Git Bash** while
  `npx tsx scripts/<x>-check.ts` passes. Trust the direct run.
- **Four hand-synced docs drift** (`NOW.md`, `ME.md`, `BUSINESS.md`, `PROJECT_CONTEXT.md`).
  The OTA id belongs only in `NOW.md`'s header.

## Auth / security

- **The dev-test password is in the bundle and in git history**
  (`src/lib/dev-test-user.ts:39`). Hiding the button is not remediation; rotate the
  password before public launch (deferred on purpose as of 2026-09-02).
- **Root is `me.is_root`.** Never gate on a handle string again — `emci` was claimable.
  The column is trigger-protected; set it from the SQL editor / service role only.
- **`PRE_LAUNCH_DEV = true` ships dev tooling to every OTA user.** Only the dev sign-in
  button, Home dev box, native-crash probe and cold-start auto-login are `__DEV__`.
  `check:release-mode` blocks a production *build*; it does not block an OTA.
- **Edge Functions must verify the JWT in code** (`auth.getUser()`); gateway
  `verify_jwt` is not committed anywhere (no `supabase/config.toml`).
- **Apple's `/auth/revoke` returns 200 for almost anything.** Only the refresh-token
  reuse in `confirmRevoked` proves revocation.
- **SecureStore caps values at 2048 bytes.** `auth-storage.ts` splits tokens into
  Keychain and the rest into AsyncStorage; do not store the whole session in Keychain.

## AI

- **No vendor key may be referenced under `src/`.** Only statically referenced
  `EXPO_PUBLIC_*` vars are inlined, so the reference itself is the leak.
  `check:ai-provider` fails on any `EXPO_PUBLIC_*_API_KEY`.
- **`gemini-2.5-flash` is retired** (404 "no longer available to new users"). Default is
  `gemini-3.7-flash`; a wrong `EXPO_PUBLIC_GEMINI_MODEL` / `GEMINI_MODEL` secret fails
  every call regardless of quota.
- **Reasoning models eat the token budget.** Gemini `thinkingLevel: low` and
  `grok-3-mini` can spend a 16–64 token budget on hidden thinking and return empty text.
- **Quota is claimed in the Edge Function.** The client `claimAiCall()` is a no-op for
  remote providers; do not add a second claim or users get charged twice.
- **Pings (`ping: true`) are quota-exempt** by design — server-forced 16-token prompt.
- **Any Gemini failure falls back to DeepSeek once** (not only quota). If DeepSeek's
  secret is missing you get the empty-card state, not an error.
- **Every AI await needs `withTimeout`** (25s where two sequential calls are possible).
  RN fetch has no timeout; a stalled call leaves "Loading…" forever.
- **Every `generateText` call site must pass `AiCallMetadata`** from
  `src/lib/ai/call-sites.ts` or `check:ai-provider` fails.

## Data

- **`record_check` is the only Check write.** Client-side inserts into `checks` are
  RLS-blocked. Window is today or 2 days back; P0017/P0018/P0019 map to user copy in
  `checks.ts`.
- **Direct writes to trait columns bypass EWMA.** Only the dev preset does this, and
  only for the dev user. Everything else goes through `mergeTraitWrite`.
- **Inferred sources damp toward 0.5 on a null prior**, so a first answer through
  `self_situation` lands mid-band and never becomes "settled". Use a direct source for
  first-touch flows (this is why optional intake uses `self_scenario`).
- **Report track vs game track never mix.** Categories, Legends, completeness read
  report only.
- **`complete_signup` re-save must coalesce every field.** One overwrite slipped
  through once (`recovery_style`, fixed in wave24).
- **Legend never-repeat is per variant**, not per figure (wave32). History FK points
  at `legend_variants.id`.

## UI

- **`window` is shadowed in Home** (`(tabs)/index.tsx:148`, a local `const window`).
  Rename before using the global there.
- **`BottomTabInset` is hardcoded** (`constants/theme.ts:63`) while the real bar height
  is content + safe-area (`app-tabs.tsx:63`). They can disagree on tall home indicators.
- **Hidden `TabTrigger`s must live inside `TabList`** or tabs parked in More stop
  navigating (`check:nav` asserts this).
- **Type scale has no 20/24 step** (`themed-text.tsx`) — section heads fall back to
  14px bold. (Phase 3 item.)
- **Five appearance modes** each carry radius/serif/scanline/HUD flags
  (`constants/appearance.ts`). A new component owes QA to all five.
- **`checks` array identity churns** on every fetch; effects keyed on it re-run. Key on
  `todayDay`/ids, not the array.

## Copy

- **Seven surfaces ship behind `*_COPY_REVIEWED = false`.** Story/Levity are
  diagnosis-adjacent. Do not flip a flag without emci's read.
- **Never say "AI" or "tokens" in user copy** (`voice/quota.ts` comment); Sage is a
  "coach", Notes are "notes".
- **MBTI four-letter codes were removed for trademark reasons** — do not reintroduce.
