# MAP — every file, one line

Generated 2026-09-02 from the tree. Purpose only; for how things connect see `FLOWS.md`.

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
| `auth/_layout.tsx`, `auth/index.tsx`, `auth/login.tsx` | Sign up (OTP + Apple) / Log in (Apple, password, OTP; dev button `__DEV__`) |
| `onboarding.tsx` | Identity + 8 core chips + optional 8-scenario phase → `complete_signup` |
| `(tabs)/_layout.tsx` | Tab shell: `AppTabs` + always-mounted `NavPixel` |
| `(tabs)/index.tsx` | Home: today's card, Did/Skip, primary slot, category teaser |
| `(tabs)/sage.tsx` | Sage: 8-ball + Talk chat, Support tap |
| `(tabs)/explore.tsx` | Explore: title, Categories, The Story, insight spend, observations |
| `(tabs)/you.tsx` | You: tone, badges, growth, weeks, support region, Full Profile, account |
| `(tabs)/around.tsx` | Around: weekend shows by typed city, "I'm going" |
| `(tabs)/circle.tsx` | Circle: scanned friends, peer cards, category compare |
| `(tabs)/legends.tsx` | Legends: archetype-matched stories; dev persona strip (dev user only) |
| `(tabs)/intake-sweep.tsx` | "Questions" tab: the optional fast-entry sweep |
| `dawn.tsx` | Dawn: generate/reveal today's card, consent interstitial |
| `week.tsx` | Weekly recap |
| `questions.tsx` | "Tell Sage more": cached 5-question batches |
| `chat.tsx` | 1:1 Circle thread; block/mute/report; "Teach Sage this" |
| `[handle].tsx` | Public poster at `/@handle` (only poster fields) |
| `dev-lab.tsx` | Dev Tools Hub (root + granted capabilities) |
| `ai-lab.tsx` | Hidden provider switcher (5-tap Build line) + status dots |
| `*-lab.tsx` (theme, around, talk, pixel, crisis, voice) | Dev labs, behind `PRE_LAUNCH_DEV` |
| `+native-intent.ts` | Deep-link → route mapping |
| `copy/first_cards.md`, `copy/library.md` | Banked Day 1–3 cards; Library paraphrase lines |
| `voice/sage.txt` | Sage register + five few-shots |
| `legal/*.md` | Privacy, terms, App Store privacy-label answers |

## `src/components`

| File | Purpose |
|---|---|
| `app-tabs.tsx` | Custom JS tab bar over `expo-router/ui`, hidden triggers for More tabs |
| `nav-edit-overlay.tsx`, `nav-more-sheet.tsx`, `nav-pixel.tsx` | Edit-navigation drag mode, More sheet, top-right companion |
| `themed-text.tsx`, `themed-view.tsx`, `themed-pressable.tsx`, `themed-tab-bar.tsx` | Theme primitives (type scale lives in themed-text) |
| `appearance-picker.tsx`, `voice-preset-picker.tsx` | Appearance mode / Sage voice pickers |
| `ask-sheet.tsx`, `ranking-card.tsx`, `scenario-card.tsx`, `sage-knows-card.tsx` | The weekly Home Ask (three kinds) |
| `reveal-card.tsx`, `missed-check-card.tsx`, `crisis-card.tsx`, `category-teaser.tsx` | Home primary-slot cards |
| `crisis-region-picker.tsx` | Region override for the crisis card |
| `categories-fold.tsx`, `category-compare.tsx`, `category-visual.tsx`, `concept-hint.tsx` | Categories UI + "?" explainers |
| `explore-panel.tsx`, `sage-story-fold.tsx`, `sage-title-card.tsx`, `sage-insight-spend.tsx` | Explore tab pieces |
| `sage-eight-ball.tsx`, `sage-usage.tsx`, `sage-facts.tsx` | Sage chat pieces; usage line; "What Sage remembers" |
| `core-intake-sweep.tsx`, `optional-intake.tsx`, `intake-sweep.tsx`, `intake-chips.tsx`, `intake-settings.tsx` | Intake screens/chips |
| `questions-fold.tsx` | Question batch UI |
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

## `src/lib` — logic (no React except `*-context.tsx`)

| Area | Files | Purpose |
|---|---|---|
| Auth/session | `supabase.ts`, `auth-storage.ts`, `auth-apple.ts`, `auth-otp.ts`, `auth-password.ts`, `dev-test-user.ts`, `dev-mode.ts`, `dev-access-unlock.ts`, `dev-unlock-server.ts` | Client, Keychain-split storage, sign-in paths, dev-test presets, `PRE_LAUNCH_DEV`, session-only dev unlock |
| Me | `me.ts`, `me-context.tsx`, `intake.ts`, `full-profile.ts`, `facts.ts`, `age.ts`, `invite.ts`, `access-requests.ts`, `delete-account.ts` | The `me` row and everything written to it |
| Traits | `traits.ts`, `trait-history*.ts`, `trait-tracks-store.ts`, `trait-stability.ts`, `trait-bands.ts`, `axis-codes.ts`, `axis-poles.ts` | 16 axes, merge rules, EWMA tracks, bands |
| Checks | `checks.ts`, `checks-events.ts`, `check-window.ts`, `week-window.ts`, `local-date.ts`, `today-card.ts`, `today-card-events.ts`, `today-slot.ts` | Check write/read, day window, widget card, Home slot |
| Home extras | `ask.ts`, `ranking.ts`, `scenario.ts`, `sage-knows.ts`, `reveal.ts`, `badges.ts`, `growth.ts`, `home-teaser.ts`, `running-update.ts` | Weekly Ask, reveal, badges, growth |
| AI transport | `ai/{config,types,generate,edge,http,gemini,override,usage,limits,call-sites}.ts` | `generateText` → Edge Function; provider override; usage log |
| Voice (cards) | `voice/{router,talk,bank,filters,jargon,phrase-guard,framework-fence,style-checklist,quota,quota-server,select-provider,config,library,nudge,cue,preset,voice-reference}.ts`, `voice/providers/*` | Dawn card + Talk routing, guards, quota, providers |
| Explore | `explore/{route,generate,prompt,combine,cadence,copy,local,store,types}.ts` | Observation entries |
| Questions | `questions/{route,generate,prompt,bank,sweep,rotation,deferral,guards,parse,store,local,copy,context,types}.ts` | Infinite questions + sweep |
| Categories | `categories.ts`, `category-bands.ts`, `category-share-store.ts`, `concept-explainers.ts`, `dawn-category.ts` | 9 categories, bands, sharing, explainers |
| Sage extras | `sage-title*.ts`, `sage-story*.ts`, `sage-insight.ts`, `sage-messages.ts`, `sage-copy.ts`, `sage-eight-ball.ts`, `chat.ts`, `moderation.ts` | Title/Story, chat, block/mute/report |
| Circle | `circle.ts`, `circle-context.tsx`, `share.ts`, `share-codec.ts` | Connections, poster link/QR |
| Crisis | `crisis/{detect,copy,days,log,region,region-context,region-storage}.ts` | Keyword detect, static card, region |
| Around | `around/{fetch,fixture,going,weekend,tickets,ages,slug,map-edmtrain,edmtrain-api,types}.ts` | Weekend shows, going |
| Legends | `legends/{store,match,dev-preview}.ts` | Catalog, archetype match, dev preview |
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
| `functions/ai-generate` | All vendors, JWT verified, quota claimed, 1024-token cap |
| `functions/apple-link` | Store Apple refresh token for later revocation |
| `functions/delete-account` | Revoke at Apple (with proof) → delete user → audit row |
| `functions/review-access` | Root-only approve/deny landing signups (emails invite) |
| `functions/refresh-around` | Edmtrain refresh (cron not scheduled yet) |
| `functions/dev-unlock` | JWT required; checks a password against the `DEV_UNLOCK_PASSWORD` secret |
| `functions/_shared/apple.ts` | ES256 client-secret, token exchange, revoke, confirm |

## `scripts`

`*-check.ts` — one static/pure-logic assertion file per feature (`npm run check:<name>`).
`ota-gate.ts` runs typecheck + lint + all offline checks; `ota-publish.ts` wraps `eas update`
behind it; `release-mode-check.ts` blocks production builds while `PRE_LAUNCH_DEV` is true.
