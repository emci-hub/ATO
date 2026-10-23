# ATO — map for agents

ATO is an 18+ iOS app (Expo SDK 54 / expo-router / Supabase; public sign-up since 2026-10-21, `PRE_LAUNCH_DEV = false`):
one daily insight on the Insights tab (loaded on a tap; it replaced the old Read + Do card), a 16-axis trait profile that
every AI surface reads from, and a small Circle of accepted friends added by @handle (1:1 encrypted chat from 1.1).
`PROJECT_CONTEXT.md` is the memory; `docs/NOW.md` is live status; `docs/ato-finish-roadmap.md` (v2) is the order of what is left.

## When to move to a new chat (emci 2026-10-15: saves credits)

One chat = one step. Move to a new chat when ANY of these is true:
- a plan step is done (merged / published / handed to emci for a phone check);
- the next request is a different feature or a new roadmap step;
- the chat has run through several tasks or a long back-and-forth (every reply re-sends the whole history).

Before moving, end the chat with: (1) a 3–5 line **assessment** (built / verified / not verified / what went wrong),
(2) **next** (the next step + anything emci must do first), (3) a **new-chat prompt**: a `Model:` line, then ONE
code block to paste (repo, branch, files to read — PROJECT_CONTEXT.md + the plan doc, e.g. `docs/hideout-roadmap.md` —
the task, done-criteria, rules, and "end this chat the same way"). Keep the plan's state in that repo doc, never only in
chat. The new chat does its part and ends the same way — that is the loop.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm start` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| One check | `npm run check:<name>` (see `package.json`; `scripts/*-check.ts`) |
| Art library | `npm run art:sync` — registry + catalog/portable (commit the result) |
| Full gate | `npm run check:ota-gate` — typecheck + lint + every offline check |
| Publish OTA | `npm run ota:publish -- <eas args>` — refuses unless the gate is green. Never bare `eas update`. |
| Release mode | `RELEASE_MODE=1 npm run check:release-mode` (auto on EAS production builds) |

Live checks (need real accounts / network / keys) are excluded from the gate and run by hand:
`around`, `auth-password`, `apple-revoke`, `card-live`, `crisis-live`, `delete-account`,
`founder-access`, `intake-live`, `invite`, `quota`, `sentry`, `style-live`, `talk-live`.

## Hard invariants

- **No vendor key in the bundle.** Every model call runs on the server in `ai-library` /
  `ai-library-fill`; keys are Supabase secrets. `ai-generate` (the old generic prompt proxy)
  is CLOSED to a 410 stub since wave98 and is deleted in launch-flip step 9: never put a vendor
  call or a caller-supplied prompt back (`check:ai-provider`). `check:ai-provider` also fails on
  any `EXPO_PUBLIC_*_API_KEY` reference under `src/`.
- **Shared AI library (wave93, emci 2026-10-09).** Deep dives, Story and Legends cards are
  library first: a free unseen card from the reader's bucket (`library_serve`; Legends
  through `claim_library_write`), else the `ai-library` Edge Function writes one. That
  function is the only server-side model path (with its cron sibling `ai-library-fill`): the phone sends only `{kind, bucket,
  mode}`, never text; the server rebuilds the prompt and runs the app's checks from
  `supabase/functions/_shared/ai-library.bundle.js`. Any edit under the prompts/checks it
  bundles needs `npm run gen:ai-library` + `supabase functions deploy ai-library`
  (`check:ai-library` fails on a stale bundle). Bump `LIBRARY_VERSION` when a prompt or
  card shape changes. Nothing personal (user id, told-vs-played) may enter a shared prompt.
- **Quota is claimed server-side** (`claim_library_write` / `claim_ai_call` inside `ai-library`), output tokens
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
  it moves the value, never `answer_count`. wave80 (the lock) is APPLIED (2026-10-21, verified read-only: no client
  write grant on the trait tables).
- **`PRE_LAUNCH_DEV`** (`src/lib/dev-mode.ts`) un-gates dev tooling while invite-only.
  Must be `false` before a public build — `check:release-mode` enforces it. With it
  off, no dev tool renders for anyone: no PIN, password unlock or grant opens the Hub's
  testing groups, the DEV bubble or the AI lab (`DEV_TOOLS_AVAILABLE`, `hubAccess`).
  Root keeps the Hub's Admin group only. A new dev panel goes inside the `tools`
  branch of `dev-lab.tsx`, or `check:release-mode` fails.
- **Helpline row is static (emci 2026-10-14; replaced the crisis system).** The Sage tab and every
  crisis path (card, region picker, flags, message scanning) are gone. The You tab carries one fixed
  `HelplineRow` (`src/components/helpline-row.tsx`): 988 for US/Canada, findahelpline.com elsewhere, a
  local-emergency line. Never a generated number, never a guessed region, never triggered by or logging
  anything a person typed. Pinned by `check:helpline-row`. Insights is template-only (no model call,
  `check:insights-no-ai`); no user-facing "Sage" copy (`check:no-sage-copy`). Leftovers: `docs/sage-cleanup.md`.
- **Dev testing uses the dev-test user** (`ato-dev@example.com` / `@atodev`). **Two
  things may act on the SIGNED-IN account's own data pre-launch (emci, 2026-10-01):**
  the "Jump this account" stages (`applyDevIntakeStagePreset`: first read 16, set 2 done
  32, one short 47, the 48, round 1 finished, the old 50), which any signed-in account may use on itself, and
  "Reset account" (`reset_my_account`, wave88; replaced Start over 2026-10-07), which is root
  only on the server, needs RESET typed, wipes answers, tokens and saved content, and keeps the
  account, consent, Circle, the AI usage log and the Divecore save. "Preview as new user" (root,
  pre-launch only, `lib/preview-mode.ts`) changes nothing: it refuses every write at the network
  layer while it is on. Deleting a profile to
  re-run the sign-up form (`reset_dev_test_user`) stays dev-test-user only. Agents still
  never sign in as, or write to, a real account themselves.
- **Every dev or admin action that writes takes two taps** (`useTwoTap` in
  `dev-lab.tsx`), or a typed handle where it cannot be undone.
- **New copy and new AI prompts use the moment voice (emci 2026-10-02).** One concrete,
  recognizable moment from how people live now (texts, group chats, read receipts, tabs),
  teased kindly, no advice (the deep dive's one small step and the core content policy below are the exceptions),
  no slang. Rules + approved examples: `src/lib/voice/moment-voice.ts`;
  drop `MOMENT_VOICE_BLOCK` into any new generation prompt. Older surfaces (question
  prompts, categories, Story, the insight's five fields) are not converted yet.
- **Stored tips (insight-bank, category-bank) use the clear voice (emci 2026-10-07), not the moment voice.**
  Rules, approved examples and `tipRuleViolation`: `src/lib/voice/clear-voice.ts`. The daily insight
  (Focus · try · watch, `src/lib/insight-bank/`) and the Explore category cards (`src/lib/category-bank/`)
  are written by hand, picked on the device, and never call a model. Ids are forever (`ftw_<axis>_<h|l>_<nn>`).
  Both ship with `*_COPY_REVIEWED = false` and a review doc, and show NO draft badge in the app (emci 2026-10-07).
- **Category deep dive on Explore (emci 2026-10-08; moved from Home 2026-10-09).** Between Categories and
  "How you've changed" (after Questions are finished): pick a category → leanings worked out on the phone ("Adventurous 78%") →
  "Write my deep dive" = one AI call (`src/lib/category-deep-dive/`: consent, then `claim_category_deep_dive`,
  1/day, wave90), strict validator (plain language, a necessary technical term explained, no diagnosis or label pinned on the reader, no directive "you should"; Love / closeness is judged by meaning like any other category, no special block). It never touches
  insight-bank or category-bank. `CATEGORY_DEEP_DIVE_COPY_REVIEWED = false`, review doc
  `docs/category-deep-dive-review.md`, pinned by `check:category-deep-dive`.
- **AI views cost ATO tokens (wave92, emci 2026-10-09).** Every AI view (a new Legends AI card or a
  new deep dive; the Story is free templates since 2026-10-14; library deep dives are free up to 10 a day) costs `ai_token_price` (5), charged on the server inside its claim RPC (after the safety cap of
  5/day), refunded once a day per feature on failure (`refund_ai_tokens`). Earn: daily check-in +5 (every
  7th +10), first 48 +15, set of 16 +5. The client never decides a charge. Root can clear today's AI counters
  for any handle from the Dev Hub (`dev_reset_ai_limits`). Pinned by `check:ai-tokens`.
- **The AI consent copy names every real AI use** (Legends cards and category deep dives only —
  `AI_USE_DISCLOSURE`; Story and Sage are no longer AI surfaces, Insights is templates). A new AI
  surface updates it in the same change (Apple 5.1.2).
- **Questions come from the fixed bank (wave85, emci 2026-10-06).** 400 questions, 25 per trait,
  one file per trait in `src/lib/questions/bank/`; the server copy (`question_bank`) is generated
  by `scripts/gen-wave85-bank.ts` and pinned by `check:question-bank`. No AI writes a question and
  nothing a person typed reaches one. Never renumber or reuse a question id — answers point at it.
  wave85/85b/86 are applied (2026-10-06); a wording edit needs a new migration updating that row.
  A SCENARIO change (new situation, or an option that now means something else) is never written in
  place (emci 2026-10-20): wrap the old row in `retired(newId, …)` with its text untouched and add the
  new scene as the next free id (`<trait>_26`…), same setting, direction and values; regenerate with
  `--wave100`-style output. Retired rows (`question_bank.retired_at`, wave100/100b, applied 2026-10-20) are
  never served or changed but still count for whoever answered them (answered = min(25, all answered)).
  Exactly 25 ACTIVE per trait. No question may score a privacy, money or safety boundary as distance.
- **Profile history (wave86, emci 2026-10-06).** Saved profiles live in `trait_profile_snapshots`
  (reasons `start_fresh`, `change_answers`, `monthly`) and render as cards (`profile-card.tsx`,
  Divecore sprites). History is never auto-deleted; the monthly pg_cron job saves only on a
  meaningful change (`_profile_changed` = `profileChanged`, pinned by `check:profile-history`).
  Retest is retired: after set 25 it is Change answers + Undo. No AI anywhere in cards/history.
- **Weaknesses on the profile card (emci 2026-10-19):** the Strengths/Weaknesses labels stay. A possible drawback is
  named only for a clear lean (`WEAKNESS_MIN_LEAN`), always as a possibility ("You may find it cuts both ways."), with
  one practical step; shareable titles, push and widget lines keep struggle-side lines out (`isShareableLean`).
- **Core content policy (emci 2026-10-20; replaces every conflicting earlier writing rule): `docs/copy-review-rules.md`.**
  Clarity, natural language, accurate meaning, honest feedback, adult humor. Judge MEANING, not keywords: no word or
  topic is a reason to reject by itself. Supported weaknesses and uncomfortable truths are allowed (never invented
  certainty, never a meaningless softening, never a forced upside); dark/absurd adult jokes, strong swearing and
  references to death, drinking and money are allowed; no unsupported diagnosis or label pinned on the reader; tasks are
  judged by action, consent, cost, time and safety; questions never score reasonable privacy/safety/financial
  boundaries as distance; facts about real people are sourced and never padded with invented tags. Change content only for
  a specific problem (confusing wording, factual error, unsupported inference, misleading scoring, targeted degradation,
  encouraging harm), with the smallest fix that keeps meaning and humor; a flag names the concrete problem and every rule
  change adds pass/fail pairs. Age (18+), privacy (public snippets skip struggle-side lines), security and platform rules
  are separate and unchanged. If a prompt, list, check or doc conflicts with the policy, fix that, don't add exceptions.
- **Unreviewed copy ships behind `*_COPY_REVIEWED = false` flags.** Story / Levity are
  diagnosis-adjacent; not shippable as reviewed without emci's read.
- **Game art follows `docs/art/PIXELLAB_GUIDE.md` (emci 2026-10-12).** Every art request: check the art
  library first and recommend what's there (reuse / edit / new), then PixelLab's dedicated tools
  (building kit, tilesets, map objects, object states, VFX/pixelart workbench, reduce_colors); sizes on the
  32 px ladder (option A: heroes 128 at 1:1); every new or edited asset passes the scale check against the
  grown hero (guide §2 table); show emci rendered samples + a scale sheet before any art choice; and the
  same change updates the library (import / `replaces` / archive via art-decisions, then `art:sync`).
- **PixelLab pre-flight before ANY animation or art generation (emci 2026-10-21).** Every new chat relearns PixelLab
  first: read `docs/art/PIXELLAB_GUIDE.md` + `docs/art/PIXELLAB_ANIMATION.md`, ask `search_help` about each tool you
  will use, update those docs if the answers differ, then `get_balance`, estimate the cost, ONE test clip for emci's ok,
  and log generations per asset. Never generate from memory. Over ~20 generations in a batch or any Pro call: ask first.
- **Game screens use fixed regions (emci 2026-10-13).** Top bar · viewport · bottom panel + a floating
  overlay; content never resizes a region (bars reserve their tallest state, announcements float, text in
  fixed boxes, loading keeps final size; a deliberate screen switch like Turf War setup → wave may
  re-lay out once, marked `fixed-regions: screen switch`). Kit `src/play/fixed-region.tsx`, rule `.cursor/rules/fixed-regions.mdc`,
  gate `check:fixed-regions` — a new game screen adds its pins there.
- **Compliance is researched, built, tested and documented, not handed to a lawyer (emci 2026-10-22).** Hiring a
  lawyer is never a default requirement or a launch blocker. For privacy, terms, AI-provider disclosures, encryption
  declarations and App Store rules: (1) start from current official docs (Apple, regulators, our providers);
  (2) comparable apps are implementation examples only, never proof of compliance, and their legal text is never copied;
  (3) label every item **mandatory** (cite the rule), **recommended safeguard** or **optional precaution**, and never
  present a recommendation as a legal requirement; (4) read our code, config and data flows before any claim, so the
  policies describe what the app really does; (5) prefer practical, lower-risk implementations, but never remove a
  feature or change an AI provider without emci's approval; (6) when uncertain, write the exact question, the sources,
  and the simplest compliant option, with no "ask a lawyer" default and no unsupported reassurance; (7) flag professional
  review only for a specific, material unresolved issue, saying why the guidance doesn't resolve it and whether it really
  blocks launch, and keep doing unrelated work. Evidence goes in the roadmap or the doc for that area.
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
| Sprite gallery artifact (Streetwear art, all facings) — "update the sprite gallery" | `scripts/sprite-gallery/README.md` · https://claude.ai/artifact/9wjcLv4FQu4S8dwqT2RBho |
| **Making or editing any game art (PixelLab)** — tools order, size ladder, gates | `docs/art/PIXELLAB_GUIDE.md` (read first) · `npm run pixellab:watch` = has PixelLab changed? |
| Old plan (reference only, not rules) | `docs/archive/OLD_PLAN.md` |
| Schema + RLS + RPCs | `supabase/migrations/*.sql` (chronological: stage* → wave*) |
| Edge Functions (Deno) | `supabase/functions/{ai-library,ai-library-fill,ai-generate (closed stub),apple-link,delete-account,review-access,refresh-around,dev-unlock,password-login}` · rate limits: `_shared/rate-limit.ts` + wave98 · live schema snapshot: `supabase/baseline/` |

Expo docs for this repo: https://docs.expo.dev/versions/v54.0.0/ (SDK 54 — check
`package.json` before trusting any other version).

## Art library (mandatory for any art work)
1. Library first. Before creating, generating or placing ANY image/animation, search
   assets/art/registry.json (and ART_LIBRARY.md / _contact sheets) by type, theme, placement, tags.
2. Reuse before create. If an approved or candidate asset fits (same camera, theme, placement, scale), use it.
   Variants (colour/state) are new entries with `replaces`/`tags`, not copies.
3. Create in PixelLab first. Follow the pixellab-workflow skill: grey blockout at our camera
   (3/4 low top-down, td-3q-low), locked streetwear palette, reference images from the registry.
   Hand work only for cleanup or after 3 failed PixelLab tries. Log every generation.
4. Import, never drop files. Bring raw output in with `npm run art:import -- --from … --id …`
   (saves prompt/seed/params to art-src/pixellab/<id>/<gen>/gen.json), then `npm run art:pack -- --id …`.
   Never commit raw frames or PixelLab exports under assets/; raw lives only in art-src/.
   New art goes in `assets/art/<category>/in-use/<set>/<variant>/` or
   `…/unused/<set>/<variant>/` (art:registry recomputes `inUse` + `usedBy` +
   `set`/`variant` and moves the file). Viewer is one card per set. Categories:
   `heroes/<slug>/<skin-set>/` (pets + characters), `enemies-bosses/<slug>/<skin-set>/`,
   `ui/` (buttons, frames, bars, panels, kit), `icons/` (items, currency, stats, tabs),
   `rooms/<room>/` (live Hideout packs stay here — equivalent in-use), `rooms/unused/`,
   `props/` (furniture/decor by room or theme), `tiles/`, `fx/`, `backgrounds/`, `branding/`.
   `misc/` is last resort (aim ~0). Classify by what the file is, not the old folder.
5. Register. Every bundled file has a registry entry: id, category, inUse, type, theme (streetwear default), placement,
   camera, heroRelativeHeight (vs final hero, 53 art px), footprintTiles (12px), sortY/occluder,
   clips (dirs/frames/ms), palette, status, critiqueScore, source, genCount, tags.
6. Style rules. One camera for everything (perspective guide): tops + fronts, no side faces, light from
   top-left, shadow down-right, footprint = collision, tall props get occluders. Props are sized to the
   FINAL hero and never scale with evolution stage. Streetwear palette only; ≤256 colours per sheet.
7. Critique gate. Score with pixel-art-critique; ≥22/28 with no zero before status can leave `candidate`.
   Only emci sets `approved`.
8. Code names art through the skeletons (src/art/skeletons.ts), never a typed-out id or sheet path: ROOM.<room>.<slot>, SHEET.<hero|enemy|tower|fx|aura|hideoutFx>.<item>.<slot>, SHEET.ui['<piece>'] / SHEET.sword.<tier> / SHEET.board, HERO.<hero>.<slot>, or ART.<kind>.<set>... for anything else; findArt({...}) from src/art. Art that fits no skeleton slot stops art:sync. Ids are clean (<kind>.<set>[.<variant>][.<part>]); old ids still resolve via ART_ALIASES. check:art-registry fails on id strings. No direct require() of image paths.
9. Off-style art (kenney, craftpix, scribble, primal, dungeon-legends, classic) is `needs-restyle`:
   don't place it in new streetwear screens; regenerate in PixelLab with `replaces`. Never auto-filter/restyle.
10. After any art add/remove/usage change: `npm run art:sync` and commit the
    result. Never hand-edit generated files (`registry.json`, `generated-art.ts`,
    `ART_LIBRARY.md`, `_contact/`, `tools/art-viewer/README.md`). The viewer is
    the source of truth for what's implemented. `check:art-registry --fresh`
    (in `check:ota-gate`) fails if they are stale. A pre-commit hook runs
    `art:sync` when staged files touch art. Never delete art; archive it
    (status archived, files to art-src/archive/).
