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

- **Dev Tools Hub access has no client-side password anymore.** Tapping the version
  number on You 7x opens a prompt checked server-side by the `dev-unlock` Edge
  Function against the `DEV_UNLOCK_PASSWORD` secret; a match sets an in-memory,
  session-only flag (`src/lib/dev-access-unlock.ts`) — never persisted, never sent
  anywhere but that one request. The old dev-test account's own Supabase password
  (`ATO-dev-user-2026`, wave31 migration) is still in git history and unrotated —
  it no longer unlocks anything client-side, but rotate it before public launch too.
- **Root is `me.is_root`.** Never gate on a handle string again — `emci` was claimable.
  The column is trigger-protected; set it from the SQL editor / service role only.
- **`PRE_LAUNCH_DEV = true` ships dev tooling to every OTA user.** Only the Home dev
  box and native-crash probe are `__DEV__`. `check:release-mode` blocks a production
  *build*; it does not block an OTA.
- **Edge Functions must verify the JWT in code** (`auth.getUser()`); gateway
  `verify_jwt` is not committed anywhere (no `supabase/config.toml`). `dev-unlock` and
  `password-login` are the deliberate exceptions — both run pre-login or pre-unlock,
  so there is no JWT to check yet; do not "fix" that.
- **`login_email_for_identifier` is service_role-only (wave36).** It used to be
  `anon`+`authenticated`-callable and returned the plain email for any handle — anyone
  signed out could enumerate handle→email pairs. Password login now goes through the
  `password-login` Edge Function, which resolves the handle and calls
  `signInWithPassword` server-side; only the resulting session (or a generic
  `invalid_credentials`) reaches the client. Never call this RPC directly from `src/`
  again — that regression is exactly what `check:auth-password` asserts against.
- **Apple's `/auth/revoke` returns 200 for almost anything.** Only the refresh-token
  reuse in `confirmRevoked` proves revocation.
- **SecureStore caps values at 2048 bytes.** `auth-storage.ts` splits tokens into
  Keychain and the rest into AsyncStorage; do not store the whole session in Keychain.

## AI

- **No vendor key may be referenced under `src/`.** Only statically referenced
  `EXPO_PUBLIC_*` vars are inlined, so the reference itself is the leak.
  `check:ai-provider` fails on any `EXPO_PUBLIC_*_API_KEY`.
- **`gemini-2.5-flash` is retired** (404 "no longer available to new users"). Default is
  `gemini-3.7-flash`; a wrong `GEMINI_MODEL` Supabase secret fails every call regardless
  of quota. The model is chosen only in the Edge Function — the client no longer reads
  any `EXPO_PUBLIC_*_MODEL` (an EAS env var by that name is inert; delete it).
- **Live AI checks spend the dev-test user's quota** (`scripts/live-ai.ts`): card-live 3,
  talk-live 2, style-live 12 of the 20/day cap. Run them on a day you are not also
  device-testing as `@atodev`, or point `ATO_LIVE_EMAIL` / `ATO_LIVE_PASSWORD` elsewhere.
- **Reasoning models eat the token budget.** Gemini `thinkingLevel: low` and
  `grok-3-mini` can spend a 16–64 token budget on hidden thinking and return empty text.
- **Quota is claimed in the Edge Function.** The client `claimAiCall()` is a no-op for
  remote providers; do not add a second claim or users get charged twice.
- **Pings (`ping: true`) never reach a vendor.** They used to make a real, unmetered
  64-token vendor call with no quota claim at all — a free real generation outside the
  quota system. Now they only confirm the vendor's key secret is present (`keyFor`)
  and return a fixed `{ text: 'ready' }`; `complete()` and `claim_ai_call` are never
  reached for a ping.
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
- **"Filled" and "settled" are two different predicates over one column.** Filled is
  `answer_count >= 1` (`isAxisFilled`/`isProfileComplete`, `trait-stability.ts`);
  settled is `answer_count >= 3` plus agreement, via `effectiveStability`. A profile
  can be Complete (16/16 filled) and still 0 settled — that is the expected state
  after one pass, not a bug, and the Explore folds deliberately show both numbers.
  Note `FullProfileFold` has a third, older notion of "filled" (`value != null` on the
  trait column) that predates this and is not the same thing.
- **The Questions AI path is gated on profile completeness.** `routeQuestions` serves
  the static bank — and claims no quota — until every axis has one answer. The gate
  reads `input.tracks`, and **absent tracks read as incomplete**, so anything newly
  calling `routeQuestions` must pass tracks or it silently loses the AI path. Sage
  chat is a separate route and stays open.
- **`complete_signup` re-save must coalesce every field.** One overwrite slipped
  through once (`recovery_style`, fixed in wave24).
- **Legend never-repeat is per variant**, not per figure (wave32). History FK points
  at `legend_variants.id`.
- **`trait_tracks` cannot be deleted from the client.** wave20 grants only
  select/insert/update to `authenticated` and explicitly revokes delete. Anything that
  needs to "reset" tracks must upsert over them — see the dev thin-profile preset,
  which writes `answer_count 0` (below `STABILITY_FLOOR_N`) instead of removing rows.
- **Dev preset writes are destructive and cover BOTH the me row and tracks.** The
  Legends "Thin profile" chip clears the dev user's whole profile to reach the
  thin-profile gate; the 4 archetype chips restore a settled one. They must stay
  symmetric — if an archetype preset ever stops writing tracks, one thin tap strands
  the dev user permanently unsettled for Categories / Title / Story, which read
  settled tracks rather than the `me` row. `check:dev-test-user` asserts the symmetry.

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

- **Nine surfaces ship behind `*_COPY_REVIEWED = false`** (nine badge render sites,
  the list `check:copy-review-badges` pins). Story/Levity are diagnosis-adjacent. Do
  not flip a flag without emci's read. Newest: `PROFILE_FILL_COPY_REVIEWED`, the
  Explore "Full profile" checklist. Add any new site to that check's `sites` array.
- **The "Draft copy — waiting on emci review." badge is `PRE_LAUNCH_DEV`-gated,
  every render site.** A `false` `*_COPY_REVIEWED` flag alone used to be enough to
  show it to every OTA user, pre-launch or not — the unreviewed copy itself still
  ships either way, but the internal review-status badge is now dev-only.
  `check:copy-review-badges` asserts every site (new ones included) requires
  `PRE_LAUNCH_DEV` alongside its `!*_COPY_REVIEWED` check.
- **Never say "AI" or "tokens" in user copy** (`voice/quota.ts` comment); Sage is a
  "coach", Notes are "notes".
- **MBTI four-letter codes were removed for trademark reasons** — do not reintroduce.
