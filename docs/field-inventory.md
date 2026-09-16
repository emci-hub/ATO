# Field Inventory

**Goal (emci, 2026-09-12):** three things, in this order of importance —
1. **Remove dead weight** — data stored in the DB that no screen ever displays.
2. **Connect what's needed** — features that are built and working but hard to find / surface in only one place.
3. **Decide where things should show** — placement decisions per screen (information architecture).

Not a raw field dump. Organized around those three goals.

**Deliverables:**
- `docs/screen-map.md` — what data shows on each screen, in plain language
- `docs/dead-weight.md` — DB fields no screen displays (safe to delete / needs a look / dynamically accessed, verify manually)
- `docs/built-not-connected.md` — real working features that are buried or single-surfaced

**Process:** 2–3 sections at a time, pause for emci to confirm between batches. Sonnet (volume work, not judgment).

---

## Step 1 — Coverage scan (done 2026-09-12)

Everything relevant to input/output fields. Pure styling/layout excluded and listed as such.

### Database — 40 live tables

**Baseline tables — NO `CREATE TABLE` anywhere in the repo.** They predate migration tracking; columns must be reconstructed from `ALTER TABLE ... ADD COLUMN`, the `Me` type in `src/lib/me.ts`, and RPC signatures. ~95% confidence, not provable without a live `supabase db dump`:
`me` · `checks` · `crisis_flags` · `connections`

`me` is the dominant table — 81 `ALTER TABLE` references, ~70 columns incl. all 16 trait axes.

**From migrations (36):**

| Source migration | Tables |
|---|---|
| `explore.sql` | explore_packs, explore_entries, explore_reactions |
| `stage7_chat_report.sql` | blocks, mutes, threads, messages, sage_messages, reports |
| `stage8_invite_referral.sql` | app_config, invite_codes |
| `stage8_apple_delete_account.sql` | apple_credentials, account_deletions |
| `stage8_ai_quota.sql` | ai_usage |
| `ai_provider_layer.sql` | ai_provider_log |
| `founder_access_requests.sql` | access_requests |
| `dev_access.sql` | dev_access_grants, dev_trace_sessions, dev_trace_events |
| `wave2_going_colors.sql` | going |
| `wave17_infinite_questions.sql` | question_packs, question_items |
| `wave19_trait_history_tokens.sql` | trait_history, token_events |
| `wave20_trait_tracks_titles.sql` | trait_tracks, sage_title_flags |
| `wave21_playfulness_categories.sql` | category_defs, category_share |
| `wave42_qa_override_invite_code_storage.sql` | app_secrets |
| `wave46_trait_rolls.sql` | trait_rolls, trait_roll_snapshots |
| `wave49_question_bank_pool.sql` | question_bank_pool, question_bank_reroll_exclusions |
| `wave51_ato_tokens.sql` | ato_token_events |
| `wave58_legend_generations.sql` | legend_generations |
| `wave59_category_statements.sql` | category_statements |

**Excluded — dropped tables (verified via `drop table`):** legends (wave32) · archetype_defs, legend_archetypes, legend_variants, legend_figures, user_legend_history (wave57) · category_question_batches (wave60) · category_question_items (wave61)

### Frontend — screens/routes (`src/app`, 28 files)

- **Tabs:** index (Home) · explore · sage · you · circle · around · legends · roll · intake-sweep
- **Auth:** auth/index · auth/login · auth/_layout
- **Standalone:** onboarding · chat · dawn · week · [handle] (public profile) · +native-intent
- **Dev labs (field-bearing, gated):** dev-lab · ai-lab · around-lab · crisis-lab · pixel-lab · talk-lab · theme-lab · voice-lab
- **Excluded (pure layout):** `_layout.tsx`, `(tabs)/_layout.tsx`

### Frontend — components (81 total; field-bearing)

- **Intake/forms:** core-intake-sweep · optional-intake · intake-chips · intake-settings · intake-sweep · born-on-fields · birthday-row · city-picker · crisis-region-picker · voice-preset-picker · appearance-picker
- **Questions:** paged-questions · questions-fold · full-profile-fold · profile-fill-fold · scenario-card · ranking-card · axis-taps · depth-dive
- **Auth/account:** auth-apple-block · auth-otp-code · auth-scaffold · password-settings-fold · delete-account-sheet · dev-unlock-gate · ai-consent-card
- **Sage:** sage-facts · sage-knows-card · sage-title-card · sage-insight-spend · sage-story-fold · sage-usage · sage-eight-ball · ask-sheet
- **Traits/progress:** trait-bands-fold · growth-markers · quest-growth-bars · check-milestone-badge · milestone-toast · axis-code-label · concept-hint
- **Categories/legends/rolls:** categories-fold · category-compare · category-teaser · category-visual · category-statement-archive-fold · legend-card · legend-history-fold · roll-history-fold · roll-item-body
- **Social/circle:** scan-sheet · report-sheet · action-menu · share-poster · nav-more-sheet · nav-edit-overlay
- **Cards/state:** crisis-card · reveal-card · missed-check-card · running-update-line · explore-panel · settings-fold · provider-status-dot
- **Dev:** you-dev-tools · push-test-card · sentry-test-card · trace-pipeline · dev-probes-stub · kenney-credits-card
- **Excluded (pure styling/layout):** themed-text · themed-view · themed-pressable · themed-tab-bar · app-tabs · animated-icon(.web/.module.css) · pixel-face · nav-pixel · sage-tab-icon · kenney-character · push-runtime · `ui/` (empty)

### Frontend — hooks (8)
use-me · use-session · use-circle · use-growth · use-today-card
*(excluded, styling only: use-theme · use-color-scheme(.web))*

### Frontend — data layer (`src/lib`, 204 files)

- **Root (field-bearing):** me · me-context · traits · trait-history · trait-stability · trait-tracks-store · trait-history-store · trait-bands · checks · check-window · checks-events · intake · invite · access-requests · auth-apple · auth-otp · auth-password · auth-storage · circle · circle-context · chat · moderation · facts · ranking · rci · reveal · milestones · badges · growth · profile-fill · full-profile · full-profile-unlock · categories · category-bands · category-catalog · category-share-store · dawn-category · home-bootstrap · home-teaser · today-card · today-slot · today-card-events · scenario · vibe-check · depth-dive · ask · share · share-codec · subscription · push · push-copy · push-policy · tokens · tokens-server · ato-tokens · ato-tokens-server · sage-\* (copy, eight-ball, insight, knows, messages, story, story-store, title, title-store) · delete-account · dev-\* (access, access-server, access-unlock, intake-stages, lab, mode, overrides, test-user, trace, trace-server, unlock-server) · age · local-date · week-window · running-update · axis-codes · axis-poles · concept-explainers · supabase · sentry · timeout
- **Subdirs:** `questions/` (25) · `voice/` (21 + providers) · `around/` (10) · `explore/` (9) · `ai/` (10) · `rolls/` (6) · `crisis/` (7) · `legends64/` (5) · `category-statements/` (2) · `nav/` (2) · `kenney/` (7 + manifests)
- **Excluded (pure styling/util):** `theme/` (5) · color · constants/theme · constants/appearance

### Local device storage (AsyncStorage — fields that exist ONLY on-device, never in the DB)
auth-storage · supabase (session) · use-session · invite (pending code) · push (token/prefs) · today-card · home-teaser · full-profile-unlock · dev-access-unlock · dev-overrides · crisis/region-storage · questions/answered-option-storage · questions/category-page-position · theme/storage · reveal-card · paged-questions

### Backend — Edge Functions (7)
ai-generate · apple-link · delete-account · dev-unlock · password-login · refresh-around · review-access · (`_shared/`)

### Known gaps to close before trusting "orphaned" conclusions
1. The 4 baseline tables above have no schema in the repo — a live dump would make column coverage provable rather than inferred.
2. RPCs return computed shapes (`home_bootstrap`, `public_profile`, `count_user_rows`, …) that produce derived fields with no matching column — these belong in Computed/Derived, not Orphaned.
3. Dynamic access (`field[key]`, spreads) can hide a real usage — anything only reachable that way gets flagged "likely orphaned, verify manually", never asserted.

---

## Already-answered question (2026-09-12)

**"Can we convert categories from generating questions to generating statements?"** — already built and shipped. `category_statements` table (wave59), generation in `src/lib/category-statements/generate-statements.ts`, rendered by `categories-fold.tsx` and `category-statement-archive-fold.tsx`. The old Q&A version (`category_question_items` / `category_question_batches`) was dropped in wave60/61. Emci did not know this was live — which is the exact problem these documents exist to solve.

---

## Proposed sections for the screen map
Auth/Signup · Onboarding · Home · Dawn · Week · Explore · Sage · You · Questions/Intake · Circle · Chat · Around · Legends · Roll · Categories · Public Profile · Settings · Dev Tools · Shared/Global
