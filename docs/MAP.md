# MAP — every file, one line

Generated 2026-09-02 from the tree. Purpose only; for how things connect see `FLOWS.md`.

> **Stale for screens and questions (noted 2026-10-01).** This list predates the isolation pass: it names files that no longer exist (`dawn.tsx`, `questions.tsx`, `questions/route.ts`, `questions/sweep.ts`) and tables with no app code (chat, moderation). For what is live, parked or dead today, open `docs/system-map.html` (facts in `docs/system-map.data.js`).
>
> **Sage and the crisis system are gone (2026-10-14).** Rows below that name Sage, the crisis card/region/keyword files, `sage_messages`, "Teach Sage this" or Talk are history, not live code: the You tab carries one static `HelplineRow`, nothing typed is scanned or logged, and AI is used only for Legends cards and category deep dives via `ai-library`. `voice/sage.txt` is already gone (replaced by `voice-reference.txt`); `src/lib/voice/content.generated.ts` still exists and may be deleted by the code agent; `scripts/gen-sage-icon.ts` does not exist (checked 2026-10-20). See `docs/sage-cleanup.md`.

## Root

| File | Purpose |
|---|---|
| `CLAUDE.md` | Agent map: commands, invariants, pointers |
| `AGENTS.md` | Points to CLAUDE.md + SDK 54 docs |
| `PROJECT_CONTEXT.md` | Memory: snapshot, re-gating checklist, decisions log |
| `app.json` | Expo config (bundle id, plugins, privacy manifest, widget target) |
| `eas.json` | EAS build/submit profiles (production = channel `production`) |
| `eslint.config.js` | Expo flat config; ignores `dist` and `supabase/functions` (Deno) |
| `metro.config.js` | Metro config |
| `tsconfig.json` | TS config (`@/*` → `src/*`; includes `scripts/`) |
| `PrivacyInfo.xcprivacy` | iOS privacy manifest (mirrors `app.json`) |
| `plugins/with-widget-appicon-scope` | Config plugin scoping the widget's app icon |
| `targets/` | WidgetKit extension (`ATOWidget`) |
| `landing/` | Static landing page (`ato.emgens.com`) + privacy/terms HTML |
| `assets/` | Icons, splash, Kenney sprites (CC0) |

## `src/app` — routes (expo-router)

| File | Route / purpose |
|---|---|
| `_layout.tsx` | Root: Sentry, providers, three-way auth gate (`auth` / `onboarding` / app), lab guard |
| `auth/_layout.tsx`, `auth/index.tsx`, `auth/login.tsx` | Sign up (OTP + Apple) / Log in (Apple, password via `password-login`, OTP) |
| `onboarding.tsx` | Identity + 8 core chips + optional 8-scenario phase → `complete_signup` |
| `(tabs)/_layout.tsx` | Tab shell: `AppTabs` + always-mounted `NavPixel` |
| `(tabs)/index.tsx` | Home: today's card, Did/Skip, primary slot, category teaser |
| `(tabs)/sage.tsx` | REMOVED (Sage tab is gone; the You tab carries the static helpline row) |
| `(tabs)/explore.tsx` | Explore: title, Categories, The Story, insight spend, observations |
| `(tabs)/you.tsx` | You: tone, badges, growth, weeks, support region, Full Profile, account |
| `(tabs)/around.tsx` | Around: weekend shows by typed city, "I'm going" |
| `(tabs)/circle.tsx` | Circle: scanned friends, peer cards, category compare |
| `(tabs)/legends.tsx` | Legends: manual-trigger 64-archetype story, 6-skin switch, paid reroll, archive; dev persona strip (dev user only) |
| `(tabs)/intake-sweep.tsx` | "Questions" tab: the optional fast-entry sweep |
| `dawn.tsx` | Dawn: generate/reveal today's card, consent interstitial |
| `week.tsx` | Weekly recap |
| `questions.tsx` | REMOVED (old "Tell Sage more" batches; questions come from the fixed bank) |
| `chat.tsx` | 1:1 Circle thread; block/mute/report |
| `[handle].tsx` | Public poster at `/@handle` (only poster fields) |
| `dev-lab.tsx` | Dev Tools Hub (root + granted capabilities) |
| `ai-lab.tsx` | Hidden provider switcher (5-tap Build line) + status dots |
| `*-lab.tsx` (theme, around, pixel, voice; the talk and crisis labs are removed) | Dev labs, behind `PRE_LAUNCH_DEV` |
| `+native-intent.ts` | Deep-link → route mapping |
| `copy/first_cards.md`, `copy/library.md` | Banked Day 1–3 cards; Library paraphrase lines |
| `voice/voice-reference.txt` | Shared voice register (was `voice/sage.txt`, now gone) |
| `legal/*.md` | Privacy, terms, App Store privacy-label answers |

## `src/components`

| File | Purpose |
|---|---|
| `app-tabs.tsx` | Custom JS tab bar over `expo-router/ui`, hidden triggers for More tabs |
| `nav-edit-overlay.tsx`, `nav-more-sheet.tsx`, `nav-pixel.tsx` | Edit-navigation drag mode, More sheet, top-right companion |
| `themed-text.tsx`, `themed-view.tsx`, `themed-pressable.tsx`, `themed-tab-bar.tsx` | Theme primitives (type scale lives in themed-text) |
| `appearance-picker.tsx`, `voice-preset-picker.tsx` | Appearance mode / voice pickers |
| `ask-sheet.tsx`, `ranking-card.tsx`, `scenario-card.tsx`, `sage-knows-card.tsx` | The weekly Home Ask (three kinds; may be stale) |
| `reveal-card.tsx`, `missed-check-card.tsx`, `category-teaser.tsx` | Home primary-slot cards (`crisis-card.tsx` removed) |
| `helpline-row.tsx` | The one static helpline row on the You tab (replaced `crisis-region-picker.tsx` and the crisis card) |
| `categories-fold.tsx`, `category-compare.tsx`, `category-visual.tsx`, `concept-hint.tsx` | Categories UI + "?" explainers |
| `explore-panel.tsx`, `sage-story-fold.tsx`, `sage-title-card.tsx`, `sage-insight-spend.tsx` | Explore tab pieces |
| `profile-fill-fold.tsx` | Explore "Full profile" checklist — filled (>=1 answer) per axis, N of 16, Complete state |
| `sage-eight-ball.tsx`, `sage-usage.tsx`, `sage-facts.tsx` | Old Sage chat pieces (Sage is gone; may be deleted — check before relying on them) |
| `core-intake-sweep.tsx`, `optional-intake.tsx`, `intake-sweep.tsx`, `intake-chips.tsx`, `intake-settings.tsx` | Intake screens/chips |
| `questions-fold.tsx`, `paged-questions.tsx` | Question batch UI; flat 5-per-page book pager over the frozen 50-question intake |
| `full-profile-fold.tsx`, `trait-bands-fold.tsx`, `axis-taps.tsx`, `axis-code-label.tsx`, `depth-dive.tsx` | Full Profile + trait editing |
| `growth-markers.tsx`, `quest-growth-bars.tsx`, `check-milestone-badge.tsx` | Growth/badges |
| `share-poster.tsx`, `scan-sheet.tsx`, `city-picker.tsx` | Poster + QR scan; Around city |
| `action-menu.tsx`, `report-sheet.tsx`, `delete-account-sheet.tsx`, `password-settings-fold.tsx`, `settings-fold.tsx` | Menus, moderation, account |
| `auth-*.tsx`, `birthday-row.tsx`, `born-on-fields.tsx` | Auth scaffold, Apple block, OTP, age fields |
| `ai-consent-card.tsx`, `provider-status-dot.tsx`, `running-update-line.tsx` | AI consent, provider ping dot, Build line (5-tap) |
| `push-runtime.tsx`, `push-test-card.tsx`, `sentry-test-card.tsx`, `you-dev-tools.tsx`, `dev-probes-stub.ts` | Push scheduling runtime; dev probes |
| `dev-unlock-gate.tsx` | 7-tap version number → password prompt → session-only Dev Tools unlock |
| `kenney-character.tsx`, `kenney-credits-card.tsx`, `pixel-face.tsx`, `animated-icon*.tsx` | Sprite character, credits, splash |
| `trace-pipeline.tsx` | Generic dev trace viewer |
| `legend-figure-card.tsx`, `legend-figures-dev.tsx` | Legends museum: ??? frames, story card, share sheet; dev tool |
| `category-deep-dive-card.tsx` | Explore: category list with one number each, leanings %, the deep-dive card (one AI call on tap) |

## `src/lib` — logic (no React except `*-context.tsx`)

| Area | Files | Purpose |
|---|---|---|
| Auth/session | `supabase.ts`, `auth-storage.ts`, `auth-apple.ts`, `auth-otp.ts`, `auth-password.ts`, `dev-test-user.ts`, `dev-mode.ts`, `dev-access-unlock.ts`, `dev-unlock-server.ts` | Client, Keychain-split storage, sign-in paths, dev-test presets, `PRE_LAUNCH_DEV`, session-only dev unlock |
| Me | `me.ts`, `me-context.tsx`, `intake.ts`, `full-profile.ts`, `facts.ts`, `age.ts`, `invite.ts`, `access-requests.ts`, `delete-account.ts` | The `me` row and everything written to it |
| Traits | `traits.ts`, `trait-history*.ts`, `trait-tracks-store.ts`, `trait-stability.ts`, `trait-bands.ts`, `axis-codes.ts`, `axis-poles.ts` | 16 axes, merge rules, EWMA tracks, bands |
| Checks | `checks.ts`, `checks-events.ts`, `check-window.ts`, `week-window.ts`, `local-date.ts`, `today-card.ts`, `today-card-events.ts`, `today-slot.ts` | Check write/read, day window, widget card, Home slot |
| Home extras | `ask.ts`, `ranking.ts`, `scenario.ts`, `sage-knows.ts`, `reveal.ts`, `badges.ts`, `growth.ts`, `home-teaser.ts`, `running-update.ts` | Weekly Ask, reveal, badges, growth |
| AI transport | `ai/{config,types,generate,edge,http,override,usage,limits,call-sites}.ts` | `generateText` → Edge Function; provider override; usage log. No vendor HTTP in the bundle |
| Voice (cards; `talk`, `router` and other Sage-era files may be gone) | `voice/{router,talk,bank,filters,jargon,phrase-guard,framework-fence,style-checklist,quota,quota-server,select-provider,config,library,nudge,cue,preset,voice-reference}.ts`, `voice/providers/*` | Dawn card + Talk routing, guards, quota, providers |
| Explore | `explore/{route,generate,prompt,combine,cadence,copy,local,store,types}.ts` | Observation entries |
| Questions | `questions/{route,generate,prompt,bank,sweep,rotation,deferral,guards,parse,store,local,copy,context,types}.ts` | Infinite questions + sweep |
| Categories | `categories.ts`, `category-bands.ts`, `category-share-store.ts`, `concept-explainers.ts`, `dawn-category.ts` | 11 categories in code (`cat_structure`/`cat_resilience` new, DB seed + OTA pending), bands, sharing, explainers |
| Sage-era extras (names kept; no model call) | `sage-title*.ts`, `sage-story*.ts`, `sage-insight.ts`, `sage-messages.ts`, `sage-copy.ts`, `sage-eight-ball.ts`, `chat.ts`, `moderation.ts` | Title/Story templates, chat, block/mute/report. Some of these may already be deleted: check the tree |
| Circle | `circle.ts`, `circle-context.tsx`, `share.ts`, `share-codec.ts` | Connections, poster link/QR |
| Crisis | REMOVED (`src/lib/crisis/` no longer exists) | Replaced by the static `HelplineRow`; no detection, no logging |
| Around | `around/{fetch,fixture,going,weekend,tickets,ages,slug,map-edmtrain,edmtrain-api,types}.ts` | Weekend shows, going |
| Legends | `legends64/{classify,archetypes,generate-story,store}.ts` | 64-archetype classify, name content (6 skins), story generation, storage |
| Legends museum | `legend-figures/{types,labels,pick,story,generate,museum-store,flags}.ts`, `legend-figures/roster/*` | 12 halls × 10 hand-written legends, ??? frames, chapters, the one AI story call |
| Category deep dive | `category-deep-dive/{dive,generate,state,store,flags}.ts` | Explore: leanings % per category + one AI call a day, 2 cards (wave90/91) |
| Nav | `nav/{nav-order,nav-context}.tsx` | Persisted tab order + gates |
| Theme | `theme/{context,chrome,contrast,navigation,storage}.ts`, `color.ts` | Appearance modes |
| Push | `push.ts`, `push-policy.ts`, `push-copy.ts` | Local schedules, copy |
| Tokens | `tokens.ts`, `tokens-server.ts` | Notes ledger |
| Dev | `dev-access*.ts`, `dev-lab.ts`, `dev-overrides.ts`, `dev-trace*.ts` | Capabilities, overrides, traces |
| Kenney | `kenney/*` | Sprite registry, credits (throws if a family lacks a pack URL), animation |
| Misc | `timeout.ts`, `sentry.ts`, `depth-dive.ts`, `vibe-check.ts`, `scenario.ts` | `withTimeout`, Sentry, depth |

## `src/hooks`, `src/constants`

`use-session` (cached session → server proof), `use-me`, `use-today-card`,
`use-growth`, `use-circle`, `use-theme`, `use-color-scheme`; `constants/{theme,appearance,around-cities}.ts`.

## `supabase`

| Path | Purpose |
|---|---|
| `migrations/stage*.sql`, `*.sql` | Early schema (me, checks, chat/report, invite, quota, Apple) |
| `migrations/wave2_*` … `wave34_*` | Feature waves; latest: `wave34_root_is_column.sql` |
| `functions/ai-generate` | CLOSED to a 410 stub (wave98); deleted in launch-flip step 9. Model calls now run in `ai-library` / `ai-library-fill` |
| `functions/apple-link` | Store Apple refresh token for later revocation |
| `functions/delete-account` | Revoke at Apple (with proof) → delete user → audit row |
| `functions/review-access` | Root-only approve/deny landing signups (emails invite) |
| `functions/refresh-around` | Edmtrain refresh (cron not scheduled yet) |
| `functions/dev-unlock` | JWT required; checks a password against the `DEV_UNLOCK_PASSWORD` secret |
| `functions/password-login` | No JWT (pre-login); resolves @handle/email + password to a session server-side, never returns the email |
| `functions/_shared/apple.ts` | ES256 client-secret, token exchange, revoke, confirm |

## `scripts`

`*-check.ts` — one static/pure-logic assertion file per feature (`npm run check:<name>`).
`live-ai.ts` — shared transport for the live AI checks (`card-live`, `talk-live`, `style-live`):
signs in as the dev-test user and calls `ai-generate`, so a live check spends that user's quota
and never needs a vendor key on the machine.
`ota-gate.ts` runs typecheck + lint + all offline checks; `ota-publish.ts` wraps `eas update`
behind it; `release-mode-check.ts` blocks production builds while `PRE_LAUNCH_DEV` is true.
`pixellab-watch.ts` (`npm run pixellab:watch`, network, not in the gate) diffs PixelLab's public docs against
`docs/art/pixellab-snapshot.json`; the art rules it keeps current are in `docs/art/PIXELLAB_GUIDE.md`.
