# ATO finish roadmap v2 (2026-10-22): from "submitted" to "launch-ready and kept honest"

Written 2026-10-22 by the outside-Divecore assessment (docs only, no code changed). The **v1 plan (2026-10-19)** is kept
unchanged below the line "Archive: v1" because `docs/master-plan.md` points at its findings and prompts. Every v1 step is
done (master-plan rows 0-15). `docs/master-plan.md` stays the ledger of DECISIONS (Ledger A/C); this file is the ORDER for
what is left. If they disagree on order, this file wins; on a settled decision, the master plan wins.

## 0. Where ATO really is (read this first)

The brief for this chat assumed launch work was still ahead. It mostly is not:

- **Live since 2026-10-21:** `PRE_LAUNCH_DEV = false`, public sign-up (`wave107`), the trait lock (`wave80`), wave98-109
  applied and verified read-only, leaked-password protection on, rotations done (master-plan Step 12, Ledger A).
- **Store:** 1.0 is built from tag `v1.0.0`; **1.1 (Circle chat, runtime 1.1.0) was submitted 2026-10-21** (submission
  `9cc1261b`) and was waiting on App Review at the last record. Whether 1.0 was ever submitted on its own is not recorded
  (master-plan row 13 still lists "EAS build, TestFlight, Box 68" as emci's). **emci: say which build is in review / live.**
- **Divecore:** done; run order (a)-(f) built; Box 75 passed (2026-10-22).
- **Gate:** 191 offline checks, last recorded green; `check:release-mode` 47 pass.

So this roadmap is about: (1) the few things that can still fail review or embarrass a public launch, (2) honest
copy and promises, (3) server cleanup the v1 plan deferred, (4) depth of the daily content, and (5) the art track
interleaved between app steps.

## Scope chosen (emci, 2026-10-22; do not re-ask)

- **Must + should-fix:** steps A1-A7 and art AN0-AN4, interleaved as in §5. AN5 (paid motion) stays opt-in. Nice-to-have
  waits.
- **D23: sign-up stays public** while the legal pages are finished.
- **Compliance by research, not a lawyer (emci, standing rule in CLAUDE.md "Compliance is researched…").** A lawyer is
  never a default or a launch blocker. Every "lawyer" mention in this file and in v1 (M1, M3, D12, OPEN-QUESTIONS) is
  replaced by the compliance path below.

## Compliance path (standing rule; research 2026-10-22; findings, not legal advice)

**Is a lawyer required?** No rule we found requires one. Apple requires a privacy policy that covers collection, use,
retention/deletion and consent revocation, plus in-app deletion (guideline 5.1.1(i), (v)); it does not require legal
review. (Secondary: termly.io, getterms.io, revenuecat.com app-privacy guides; vendors, so treat as examples.)

Each row: **M** = mandatory (rule cited), **R** = recommended safeguard, **O** = optional precaution. "Open" = an exact
question still to settle in A2 from primary sources; nothing here is reassurance.

| Topic | Class | What the source says | What ATO does / must do | Open question → simplest compliant option |
|---|---|---|---|---|
| Third-party AI disclosure + consent | **M** Apple 5.1.2(i) | "clearly disclose … third-party AI, and obtain explicit permission before doing so" | consent card + server 403 without consent (§1.3); disclosure names Legends + deep dives | must name each provider that receives data. Today: Gemini + DeepSeek (`_shared/ai-vendors.ts`). Keep both and name both, unless emci decides D26 |
| AI provider data use | **M** (5.1.1(i): "all uses of that data") | Gemini API terms as quoted 2024-10-17: paid tier not used to improve products; free tier may be used and human-reviewed (re-read ai.google.dev in A2) | unknown which tier the key is on (D27); DeepSeek terms not yet read | A2 reads both providers' current terms and the policy states what they say. No "not used to train" claim unless the terms say so for our tier |
| DeepSeek (China-based fallback) | **R** (cross-border transparency, PIPEDA principle of openness) | — | fallback is live | D26 is emci's call (no provider change without approval). If kept: the policy says data may be processed in China under DeepSeek's terms |
| Encryption export (1.1, libsodium) | **M** answer Apple's export questions truthfully | US BIS change 2021-03-29: mass-market items with standard published algorithms no longer need a self-classification report (secondary: developer write-ups; A2 reads the BIS page) | `ITSAppUsesNonExemptEncryption: false`; X25519 + XSalsa20-Poly1305 (NaCl, published); not offered in France | Open: does `false` match Apple's current wording for mass-market standard encryption? A2 reads Apple's export-compliance help page + BIS 740.17 and records the answer in `app-store-pack.md` §9 |
| Canadian privacy law (Alberta PIPA, PIPEDA) | **M** | a responsible person, purposes at or before collection, safeguards, access/correction requests (~30 days), breach notice to the Alberta OIPC for real risk of significant harm (clym.io summary, mondaq.com; A2 reads the OIPC page) | none of the contact/access text exists yet | add a privacy-contact + access-request paragraph; one-page breach plan in `docs/` |
| Operator name | **M** (5.1.1 contact; PIPA contact) | — | documents say "AsTrollOGs"; `docs/BUSINESS.md` M0: sole proprietor under emci's legal name | emci gives the legal name; text says "operated by [name] (AsTrollOGs)" |
| Retention periods | **M** Apple 5.1.1(i) | "Explain its data retention/deletion policies" | text says only "while your account exists" | A2 proposes numbers from the code (deletion record, reports, backups per Supabase plan, Sentry per plan, `access_requests`) for emci's OK |
| Governing law, liability wording | **O** | — | drafts name Alberta | keep plain wording; no rule requires more |
| "Not therapy or medical advice" | **R** (1.4.1 scrutiny for medical-adjacent apps) | — | helpline row exists | one clear line in terms and on You |
| UGC safeguards | **M** Apple 1.2 | filter, report + timely response, block, published contact | built (§1.4); report alert missing; inbox unconfirmed | S1 + M2 |

**Professional review:** not needed for any row today. If A2's reading of Apple + BIS leaves the encryption row unresolved
(the only row where a wrong answer has a legal consequence outside the store), A2 will say exactly why and whether it
blocks; it does not block A1, A3 or the art steps. A free, optional second look exists (University of Calgary BLG Business
Venture Clinic) but nothing waits on it.

## 1. Findings per area (facts, file:line; investigators were read-only)

### 1. Daily insight + Home
- The Focus · try · watch card is on the **Insights tab**, not Home: `src/app/(tabs)/insights.tsx:177-185` →
  `src/components/insights/today-focus-card.tsx`; loaded only by the "Load insight" button (`:82-134`, `:192-208`).
  Home keeps the title, week strip, identity chip, Today's Pick, check-in (+5), "See today's Insights →", round ring,
  consent card (`src/app/(tabs)/index.tsx:379-519`).
- Picker `src/lib/insight-bank/pick.ts:68-115`: deterministic; an idea is eligible only if every key is a clear lean;
  no clear lean → 16 starters; no-repeat window `min(60, floor(pool×0.8))`.
- Bank: 192 trait ideas (6 per `ftw_<axis>_<h|l>`, the 6th a pair) + 16 starters. **A person with one clear lean sees only
  5 ideas** (repeat every ~5 days); a person with no clear lean only the 16 starters. No mid/neutral ideas.
- `INSIGHT_BANK_COPY_REVIEWED = false` (`src/lib/insight-bank/index.ts:49`); `docs/insight-bank-review.md`: 208 `[ ]`, 0 `[x]`.
- Streak copy is non-punitive: "a missed day never resets" (`daily-checkin-card.tsx:4,87`), push bans
  streak/losing/don't-miss (`src/lib/push-copy.ts:103`). One live 🔥 N-days line on Try this today
  (`try-today-card.tsx:107-109`), hidden at 0. Dead pressure copy: `BANK_MARKDOWN` in `src/lib/voice/content.generated.ts:8`
  ("Keep the streak breathing"), imported nowhere.
- Provisional Love / Independence / Structure leans: `src/lib/daily-insights/pick-try-today.ts:40` (TODO(emci)),
  `story-v3/lean-phrases.ts:7-15`.
- `feature/insights-replace-sage` is **superseded by master** (master has `insights.tsx`, `helpline-row.tsx`,
  `check:insights-no-ai`, and newer insight-bank code). `docs/NOW.md:62` still says "NOT merged" (stale).

### 2. Trait profile, questions, history, cards
- 16 axes `src/lib/traits.ts:16-33`. Every trait write goes through `src/lib/trait-checkpoint.ts` (wave79 RPCs); no client
  insert/update on `trait_tracks` / `trait_history` / `me` trait columns (selects only: `trait-tracks-store.ts:47`,
  `trait-history-store.ts:12`). wave80 lock is applied (master-plan Step 12, verified read-only 2026-10-21).
- Bank: exactly 25 active per trait, 19 `retired(...)` rows, 419 rows (`src/lib/questions/bank/`, `define.ts:83,102`).
  wave99/100/100b applied (master-plan Step 6: 400 active / 19 retired verified).
- History: `trait_profile_snapshots`; `snapshot_profiles_monthly` + cron `profile-history-monthly` (`7 3 1 * *`,
  `wave86_change_answers_history.sql:453,500`). **First run 2026-11-01; registration in prod never verified** (if pg_cron
  were missing it only raises a notice).
- Weakness gate `WEAKNESS_MIN_LEAN = 0.15` (`src/lib/profile-history.ts:176`), `isShareableLean`
  (`src/lib/legends64/identity.ts:161`).
- Flags false here: `PROFILE_CARD`, `BANK` (352 questions), `STAGED_INTAKE`, `TITLE`.
- **No phone box exists** for set 25 → Change answers + Undo, Start Fresh keep/wipe, card compare, monthly snapshot.
- Open decisions D1 (retired answers read-only) and D2 (houseguest question) still in Ledger C.

### 3. Explore, deep dive, Story, Legends, AI, tokens
- Explore order `src/app/(tabs)/explore.tsx:93-140`: shape, categories (stored, `CATEGORY_BANK_COPY_REVIEWED = false`),
  deep dive (after the 48), changes, bands, fill, full profile.
- Deep dive: library first, then a paid write (5 tokens), phone sends only the bucket; server refuses without consent
  (`supabase/functions/ai-library/index.ts:82-84`). Legacy `writeOld` (`category-deep-dive-card.tsx:159`) still goes
  through `generateText` → `src/lib/ai/edge.ts:24` → the `ai-generate` 410 stub, so a "missing" library answer charges,
  fails, then refunds (once a day).
- Story = templates only (`STORY_AI_POLISH = false`, `story-v3/polish.ts:6`), on Insights. But the server still accepts
  `kind:'story'` (`ai-library/index.ts:35`) with the old "Write as Sage" prompt in the bundle
  (`_shared/ai-library.bundle.js:9577`; sources `sage-story.ts:286`, `story-card.ts:288`).
- **User-facing token copy is wrong:** `src/lib/ato-tokens.ts:58` ("a new Story on Home") and
  `src/components/daily-checkin-card.tsx:32` ("a new Story") say Story costs tokens / is AI. That contradicts
  `AI_USE_DISCLOSURE` (`ai-consent-card.tsx:24`: AI only for Legends + deep dives), which Apple 5.1.2 reads.
- **Refund hole (reading of the SQL, not exploited):** `refund_ai_tokens` (`wave92_ai_tokens.sql:234`, restated wave101)
  refunds the latest spend of that kind within 15 min without checking that the AI call failed: one free AI view per kind
  per day by a hand-made call.
- Legends: 120 in 12 halls, Wikipedia-sourced; 3 trait sides with no legend (`conflict_assertiveness:low`,
  `competence:low`, `growth_mindset:low`), Africa 2, Oceania 1 (D5 accepted).
- Consent: card on Home (new account near the top, finished account at the bottom) while `ai_consent` is null; You → "ATO's
  AI" On/Off is the revoke path. **Apple 5.1.2(i) now names "third-party AI" and needs explicit permission; a developer was
  rejected because reviewers "were not presented with the consent prompt"** (see §2). The review notes
  (`docs/app-store-pack.md:87-88`) don't say where the prompt is.
- `LIBRARY_VERSION` deep_dive l2 / story l4 / legend l2 match the bundle; no bundled source changed since `9f1fc02c`.
- Unused: `rolls/compose.ts`, `rolls/results.ts`, `rolls/store.ts`, `legends64/store.ts`; `'sage'` callType
  (`voice/quota-server.ts:32`); stale comments (`category-deep-dive/generate.ts:4-5`, `index.tsx:323-326`,
  `ato-tokens.ts:50-53`).

### 4. Circle + social safety (Apple 1.2: filter, report + timely response, block, contact)
- Circle tab ⋯ = Message · Compare · Report · Block · Remove (`src/app/(tabs)/circle.tsx:253-281`, two taps on
  Block/Remove); 6 fixed reasons, no free text; "Block them too" after a report; request caps 20/20/20 per hour; block row
  readable only by the blocker (wave109).
- Chat: on-phone filter (`src/lib/chat/chat-filter.ts`), report = message + 5 before (`chat-rules.ts:8,26-38`), server
  checks ids, 10 reports/day, send 200/h, 30-day ciphertext cron (wave108:416-438).
- **Chat Report is long-press on a message only** (`src/app/chat.tsx:387-388`); the header has Block but no Report. A
  reviewer can miss it.
- **No alert when a report arrives.** Triage is a daily manual SQL query (`docs/circle-safety.md`), while the copy
  promises "We read every report within a day." (`chat-rules.ts:67`). A Resend path already exists
  (`supabase/functions/review-access/index.ts:30-48`).
- Public `/[handle]` page (`src/app/[handle].tsx:57-75`) has no Report/Block; `public_profile` shows name, handle,
  `show_up`, `talk_style`, recipe to anyone (60/10 min). **`show_up` / `talk_style` are written raw on the server**
  (`wave39_drop_recovery_style.sql:67-68,131`, no allow-list), so a hand-made call could put unfiltered text on a public card.
- No hide switch for the public card (OPEN-QUESTIONS 16). Name filter has no sexual terms (policy call, not a bug).
- Support: `support@asstrollogs.com` mailto in Circle, You, Under-18; support URL = landing page; **no /support page; inbox
  not confirmed monitored** (`docs/app-store-pack.md:11,15,123`).

### 5. You tab, sign-up, onboarding, notifications, widget
- You order (`src/app/(tabs)/you.tsx:155-272`): identity, tokens, your week, settings (appearance, city), Account
  (birthday), notification prefs, helpline row, ATO's AI, feedback, legal links, sign out, delete, dev PIN (dead in release:
  `src/lib/dev-pin.ts:28`).
- Delete: link → type DELETE → one tap (`delete-account-sheet.tsx:26,64,181`), no email needed, honest copy. The list
  still names "saved facts" (stale concept); the link has no `accessibilityRole`.
- **Broken promise:** login says "Password is optional — set it in Settings after you're in" (`src/app/auth/login.tsx:135`,
  `src/lib/auth-password.ts:5`), but `PasswordSettingsFold` (`src/components/password-settings-fold.tsx:21`) is mounted
  nowhere; `scripts/auth-password-check.ts:62` (live) still asserts it on You.
- First run: email → code → one onboarding form (birthday 18+, name, handle, city) → Home. **Insights unlock only after
  all 48 questions** (`index.tsx:455-457`, ~12 pages of 4). Before that: Today's Pick, the trait shape, set-done jokes.
- Notifications are local: morning Today's Pick (6-10 h by `energy_pattern`), Sunday recap if opened that week; evening off;
  insight push always null (flag). Ask once, after the first insight (`push-policy.ts:7-13`). Per-kind toggles,
  device-local (reset on reinstall); no quiet hours in the app (fixed windows only).
- **Divecore asks for notification permission itself** on Build (`src/play/pet-reminder.ts:77-90`,
  `pet-screen.tsx:1601-1604`) without the explainer and regardless of the app's "Not now" (stored only in AsyncStorage).
- **Widget still says "READ" / "DO" and "Today's Read and Do."** (`targets/widget/widgets.swift:49,56,89`); header is "ATO"
  (`:45,68`). Native build only. Privacy: gated by `isShareableLean`, wiped on sign-out.
- `docs/sage-cleanup.md` §4 is stale (widget header already fixed).

### 6. Launch readiness
- Release mode: flag false; labs behind `Stack.Protected guard={PRE_LAUNCH_DEV}` (`src/app/_layout.tsx:136-143`);
  `/dev-lab` + `/ai-lab` stay registered for root's Admin group only (`_layout.tsx:128-129`, intended).
- **Legal pages: `landing/privacy.html:19` and `landing/terms.html:19` read "Last updated: [DATE — fill in on publish] ·
  Draft, pending lawyer review"; 46 `[CONFIRM]` tags (23 in `src/app/legal`, 23 in `landing`).** Public sign-up is live and
  the in-app links open these pages (`src/components/legal-links.tsx:10-11`). OPEN-QUESTIONS 1-16 all open; item 8 is stale
  (says "no chat").
- **Encryption:** `app.json:152` `ITSAppUsesNonExemptEncryption: false` while 1.1 ships `react-native-libsodium`
  (`package.json:44`). `docs/app-store-pack.md` §9 records why (Apple error 90592 on build 17) and calls it "an exemption
  claim we cannot fully back". Lawyer read (D12) open.
- Account deletion: in-app path works; **live `check:delete-account` never run** (excluded from the gate,
  `scripts/ota-gate.ts:35`); Box 68 (TestFlight) 0 of 20 ticked, with stale steps B1 ("Home → tap the daily insight") and B3
  ("Mark a Check").
- **Copy flags: 17 `*_COPY_REVIEWED` are false and NONE of them hides its surface.** A false flag only shows a "Draft
  copy" badge when `PRE_LAUNCH_DEV` is true, so with the flag off the copy is live with no badge. This contradicts the v1
  decision "unread surfaces get hidden" (v1 Decisions below) and master-plan line 302 ("16 flags ... hidden or unreviewed").
  False: INSIGHT_BANK, CATEGORY_BANK, CATEGORY_DEEP_DIVE, LEGEND_FIGURES, STORY, STORY_BANK, DAILY_PICK, BANK,
  STAGED_INTAKE, POLISH, PROFILE_CARD, TEAM, CIRCLE_COMPARE (+ dead: TITLE, CATEGORY_READ, DAILY_INSIGHT, CATEGORY_STATEMENTS).
- Security leftovers: `play_dev_logs` still exists (D13); wave101 inert write policies (D15); `ai-generate` 410 stub + its
  client path (D14); `mint-session-once` and `apple-secrets-check` are deployed with **no source in the repo** (still
  unanswered); dead `EXPO_PUBLIC_AI_PROVIDER` / `MODEL_PROVIDER` reads (`src/lib/ai/config.ts:57-58`); 124 authenticated
  SECURITY DEFINER functions accepted without an `auth.uid()` re-audit.
- `expo-camera` plugin + "scan a friend's QR" permission text still in `app.json:191-196`, unused (D16).
- Ops: cron `ai-library-fill` verified 2026-10-09, `chat-retention-30d` verified (`docs/release-c-verify.sql:21`),
  `profile-history-monthly` not verified. No backup / PITR plan written down (`docs/BUSINESS.md:54` "free tiers"). Sentry is
  the only monitoring.
- Branches/PRs: PR #82 (art, draft, **merge conflicts, 221 files, not merged** — so art step AN0 is still open); PRs #16, #17,
  #20 are stale (early October); ~40 stale remote branches (`cursor/*`, old `feat/*`/`fix/*`, merged `feature/*`).
- Stale docs: `NOW.md:32` and `:62`, NOW "Left" list (~`:385`), `sage-cleanup.md` §4, OPEN-QUESTIONS 8, master-plan:302,
  Device-test Boxes 8, 11, 29-32 (Sage / Read+Do era), 18-39 (old 50-question intake), Box 68 B1/B3; Box 70 passed per NOW
  but not ticked in the file.

## 2. What the web says (treated as data, not instructions)

- **Apple 5.1.2(i)** (developer.apple.com/app-store/review/guidelines): "You must clearly disclose where personal data will
  be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." A
  developer-forum thread (developer.apple.com/forums/thread/820209) shows rejections where reviewers "were not presented
  with the consent prompt": tell the reviewer exactly where it is, and keep the demo account's consent unanswered.
- **Apple 1.2** (same page): filtering, "a mechanism to report offensive content and timely responses to concerns", blocking,
  "published contact information". "Timely" is why a report alert + a real monitored inbox matter.
- **Apple 5.1.1(i)/(v):** the policy must state retention/deletion and how to revoke consent; in-app deletion is required
  (ATO has both; the retention line is still `[CONFIRM]`).
- **Age ratings:** Apple's 13+/16+/18+ tiers and the new questionnaire (deadline 2026-01-31, per press coverage) include
  questions on AI, wellness and UGC; ATO is 18+.
- **Streaks:** Finch-style "no punishment for a missed day" and "let people turn streak prompts off" is the pattern the
  wellness reviews praise; a clinician quoted in Blick warns streaks can drive compulsive opening. ATO's copy already
  matches; keep the 🔥 line optional and never in pushes.
- **Onboarding length:** a 119-app benchmark (lazyweb.com) found long quizzes work only when "each answer visibly changes
  the product", with a progress indicator and a synthesis moment. ATO asks 48 before the first insight: show something
  real earlier (Step A6).
- **Supabase production checklist** (supabase.com/docs/guides/deployment/going-into-prod): RLS on every table, Security
  Advisor, MFA on the account, SSL enforcement + network restrictions, backups (Pro: 7 daily; PITR optional), and auth-email
  rate limits (30/hour with custom SMTP) before a launch push.
- **Expo EAS Update** (expo.dev/blog/the-production-playbook-for-ota-updates, docs.expo.dev/eas-update/rollouts): roll out
  OTAs at a percentage first (e.g. 10 %) and know `eas update:rollback`.
- v1 research (Co-Star, The Pattern, Finch, Stoic, How We Feel; privacy labels) is still in "Archive: v1" §2.

## 3. Ranked list

Effort S = under an hour of chat, M = one normal chat, L = more than one chat. Risk = chance of breaking something live.

### Must-fix (can fail review, break a promise to users, or embarrass a public launch)
| # | Item | Where | Effort | Risk | Needs |
|---|---|---|---|---|---|
| M1 | Legal pages publish-ready: lawyer read, answer D12, fill the 46 `[CONFIRM]`, real "Last updated", remove "Draft"; fix OPEN-QUESTIONS 8; landing form wording (OQ10) | `landing/*.html`, `src/app/legal/*.md` | M | low | **emci + lawyer first**; Vercel redeploy (emci) |
| M2 | Support: a monitored inbox + a `/support` page on the landing site | landing | S | low | emci confirms inbox; redeploy |
| M3 | Encryption claim for 1.1: lawyer/Apple answer; if a document is needed, upload it and set `true` + compliance code | `app.json:152`, ASC | S | med | emci + lawyer; a native build only if it changes |
| M4 | Token copy says Story is a paid AI view (contradicts the AI disclosure) | `ato-tokens.ts:58`, `daily-checkin-card.tsx:32` | S | low | OTA |
| M5 | Visible Report in the chat header (not only long-press) + review notes say where Report, Block and AI consent are | `src/app/chat.tsx`, `docs/app-store-pack.md` | S | low | OTA (runtime 1.1.0) |
| M6 | Password promise: mount `PasswordSettingsFold` on You or change the login line; fix `check:auth-password` | `login.tsx:135`, `you.tsx` | S | low | OTA (decision D20) |
| M7 | Live `check:delete-account` run + Box 68 rewritten (B1/B3) and run on the store build | scripts, Box 68 | S | low | emci runs |
| M8 | Copy flags: the v1 rule "unread surfaces get hidden" is not true in code. emci either says "accept" per surface or the step hides the ones he won't read | 17 flags | M | med | decision D21 |

### Should-fix
| # | Item | Effort | Risk | Needs |
|---|---|---|---|---|
| S1 | Report alert: email emci (Resend, existing path) when a report row lands, so "within a day" is true | M | low | SQL trigger + edge function = **new pattern (pg_net or a cron poll): emci OK** |
| S2 | `refund_ai_tokens` refunds only a recorded failure | S | med | SQL (restate one function) |
| S3 | Server allow-list for `show_up` / `talk_style` (public card text) | S | low | SQL; check existing rows first |
| S4 | Drop `kind:'story'` from `ai-library` + the "Write as Sage" prompts; `gen:ai-library` + deploy | S | med | deploy (emci OK) |
| S5 | Cleanup migration: drop `play_dev_logs` (D13, deletes rows), wave101 inert policies (D15) | S | low | SQL, deletes data → emci OK |
| S6 | Verify cron jobs before 2026-11-01 (`profile-history-monthly`, `chat-retention-30d`, `ai-library-fill`) | S | none | read-only SQL |
| S7 | `mint-session-once` / `apple-secrets-check`: download the source or delete them | S | low | emci decision |
| S8 | Divecore notification ask respects the app's one-time ask ("Not now" shared) | S | low | Play commit (separate) |
| S9 | Insight depth: more ideas per lean (a single-lean person sees 5) + "mixed" ideas for no-clear-lean people, clear voice, ids forever | M | low | OTA; copy for emci's read |
| S10 | First real insight earlier than the 48 (e.g. after set 1, from starters + any clear lean), honest "early read" label | M | med | product decision D22, OTA |
| S11 | Dead code: `ai-generate` client path + function (D14), `EXPO_PUBLIC_AI_PROVIDER/MODEL_PROVIDER`, rolls/legends64 stores, `BANK_MARKDOWN`, stale comments, "saved facts" in the delete list, delete-link a11y role | M | low | OTA + function delete |
| S12 | Docs truth pass: NOW stale lines, sage-cleanup §4, OPEN-QUESTIONS 8, master-plan flag count, obsolete device boxes, new boxes for Change answers / Start Fresh / card compare | S | none | docs only |
| S13 | Native 1.2 build: widget labels (READ/DO → Focus/Try), drop `expo-camera` (D16), encryption flag if M3 says so | M | med | **binary build + store submission** |
| S14 | Backups: decide Supabase plan (Pro = daily backups; PITR optional) + MFA on the Supabase account; write it down | S | none | emci (billing) |
| S15 | Art track AN0-AN4 (below) | per step | low | Play scope only |

### Nice-to-have
- Report/Block on the public `/[handle]` page; a "hide my card" switch (OQ16).
- Notification quiet hours / chosen time; sync prefs to the account.
- Dev Hub button for the chat ladder (D19).
- Legends for the 3 empty trait sides + more Africa/Oceania (D5).
- `sage-*` module renames (D11), one codemod.
- `auth.uid()` re-audit of the 124 SECURITY DEFINER functions (L; do once real users exist).
- Staged OTA rollouts (10 % first) as the default for `ota:publish`.
- Close stale PRs #16 #17 #20 and delete ~40 merged/stale branches (emci OK; list in Step A3).

### Cut (recommend not doing)
- Re-enabling Story AI polish (`STORY_AI_POLISH`): templates are approved and the disclosure no longer names Story.
- Restoring the Check / Read+Do loop on Home.
- AN5 paid anchored-AI motion until AN2 is on phones and emci names specific clips.

## 4. ATO IS LAUNCH-READY WHEN

- [x] `PRE_LAUNCH_DEV = false`; `RELEASE_MODE=1 npm run check:release-mode` green (47).
- [x] Public sign-up, wave80 trait lock, wave98-109 applied and verified.
- [x] No vendor key in the bundle; `ai-generate` closed; quota and charges on the server.
- [x] Report, block, filter in Circle and chat; Circle tab reachable.
- [x] In-app account deletion; delete proof counts every table (wave106).
- [ ] **Legal pages final:** no "Draft", no `[DATE]`, no `[CONFIRM]`, filled by the no-lawyer path (M1).
- [ ] **Support inbox monitored + a support page** (M2).
- [ ] **Encryption answer settled** for the shipped build (M3).
- [ ] **Every promise in the app is true:** token copy (M4), password line (M6), "we read every report within a day"
      (S1 or emci's daily triage confirmed), AI disclosure names every AI use.
- [ ] **Reviewer can find** AI consent, Report (visible in chat), Block, Delete; review notes say where (M5).
- [ ] **Copy:** every surface either read by emci or explicitly accepted as is (M8, D21).
- [ ] Live `check:delete-account` passed; Box 68 run on the store build (M7).
- [ ] Cron jobs verified (S6); backup plan written down (S14).
- [ ] Gate green on the release commit; one phone box per step passed.
- [ ] The build in review is approved by Apple (emci).

## 5. Step order (one chat each; at most one OTA / SQL set / build each; one phone box each)

App steps = A*, art steps = AN*. Art is Play scope: its own commits and its own OTA, never mixed with app work
(`check:play-isolation`), and it only fills gaps (while emci phone-tests, waits on a lawyer or on Apple). **No art step
may delay A1, A2 or A3.** Box numbers continue from 75.

| Step | What | Rank items | Ships | Server / SQL | Binary | Phone box | PixelLab | Chat size |
|---|---|---|---|---|---|---|---|---|
| A1 | Honest promises + reviewer path | M4, M5, M6, S8, review notes, Box 68 B1/B3 | 1 OTA (app + a separate Play commit) | none | no | Box 76 | 0 | M (Sonnet) |
| AN0 | Merge PR 82 (art docs + Kael/Morwen Idles): resolve conflicts, Play-only | AN0 | none (docs/art merge) | none | no | — | 0 | S-M (Sonnet) |
| A2 | Legal + support go final (after emci's D12 answers + lawyer read) | M1, M2, M3 (text side), OQ8, OQ10 | landing redeploy (emci), no OTA unless in-app text changes | none | no | Box 77 (open links on a phone) | 0 | M (Opus) |
| AN1 | Art engine v1 + Maldrath pilot (test only) | AN1 | nothing installed | none | no | — (GIF review) | 0 | M (Sonnet) |
| A3 | Server cleanup + safety | S2, S3, S4, S5, S6, S7, S1 (if OK'd) | `gen:ai-library` + deploy if S4; no OTA | **yes: one migration set + maybe an edge function** | no | Box 78 (report → email arrives; deep dive still works) | 0 | M (Opus) |
| A4 | Copy decision + hide what won't be read | M8 | 1 OTA if anything is hidden | none | no | Box 79 | 0 | S-M (Sonnet) |
| AN2 | All hero Idles via the engine, install approved | AN2 | 1 OTA (Play only) | none | no | Box 80 | 0 | M (Sonnet) |
| A5 | Dead code + docs truth pass | S11, S12 | 1 OTA | `ai-generate` function delete (emci OK) | no | Box 81 | 0 | M (Sonnet) |
| A6 | Insight depth + earlier first insight | S9, S10 | 1 OTA | none (stored copy) | no | Box 82 | 0 | M-L (Sonnet; Opus for D22 design) |
| AN3 | Clip timing holds (`ms[]`) | AN3 | 1 OTA (Play) | none | no | Box 83 | 0 | S-M (Sonnet) |
| A7 | Native 1.2 build | S13, S14 write-up | **EAS production build + TestFlight + submit** | none | **yes** | Box 84 | 0 | M (Sonnet) |
| AN4 | Creep / boss / tower Idles | AN4 | with its own OTA | none | no | Box 85 | 0 | M (Sonnet) |
| AN5 | Optional paid anchored-AI motion | AN5 | per batch | none | no | per batch | ~3 / direction, emci picks | M |

Interleaving: A1 → (emci runs Box 76 + Box 68) AN0 → A2 as soon as the lawyer answers (if the lawyer is slow, run AN1
and A3 first; A2 stays top priority the moment answers exist) → AN1 → A3 → A4 → AN2 → A5 → A6 → AN3 → A7 → AN4.

**Interim choice while M1 waits on the lawyer (D23):** sign-up is public and the pages say "Draft". Options: (a) keep
public and finish M1 fast; (b) set `signup_mode` back to `invite_only` (one config row, tested path wave107 in reverse)
until the pages are final. Recommendation: (a) if the lawyer read is days away; (b) if it is weeks.

### Open decisions this roadmap adds (answer once; recommendation first)
| # | Question | Recommendation |
|---|---|---|
| D20 | Password: show the "set a password" fold on You, or drop the promise from the login screen? | drop the promise (email code + Apple are enough; one less auth surface). Mounting it is an auth change |
| D21 | Copy flags: per surface "read", "accept as is", or "hide until read"? | accept: Story, Daily Pick, Legends (already sourced), questions (QUESTION_VOICE approved); read first: insight bank, deep dive, profile card; hide nothing unless emci says so |
| D22 | First insight earlier than the 48: after set 1 (16) with an "early read" label? | yes, after set 1, starters + clear leans only |
| D23 | While legal pages are drafts: stay public or back to invite-only? | see above |
| D24 | Report alert: email per report (trigger + pg_net, a new pattern) or a cron that emails a daily digest? | daily digest by cron (copies the cron pattern already live), plus emci keeps the 24 h promise |
| D25 | Supabase plan for backups (Pro) before real users? | yes, Pro + MFA on the account |
| D26 | Keep the DeepSeek fallback, or Gemini only? (provider change = emci's call) | either is compliant if disclosed. Dropping it is simpler (no China processing to disclose; on a Gemini outage the card uses the free library / hand-written card as today). Keeping it needs one disclosure sentence and DeepSeek's terms read in A2 |
| D27 | Is the Gemini key on the paid tier (billing on)? | emci checks in Google AI Studio; paid tier lets the text say "not used to train" |

## 6. Step prompts (copy one per new chat)

Every step ends the chat the CLAUDE.md way: 3-5 line assessment, next step + anything emci must do, a new-chat prompt.
Common rules for every prompt: pull first; plan ≤15 lines and wait for emci's OK; max 2 agents; one gate run at the end;
one reviewer pass; ask before any migration, deploy, OTA, merge, build or data deletion; Play files in their own commit;
tick this file's step and the master-plan ledgers; commit message in a file.

### Step A1: Honest promises + reviewer path
Model: Sonnet
```
Repo emci-hub/ATO, branch master (git fetch origin; git checkout master; git pull). Read PROJECT_CONTEXT.md, CLAUDE.md,
docs/ato-finish-roadmap.md (v2 §1.3-§1.5, §3 M4 M5 M6 S8, Step A1), docs/master-plan.md (Ledger A/C), docs/app-store-pack.md.
TASK (step A1): (1) fix the token copy that calls Story a paid AI view (src/lib/ato-tokens.ts:58,
src/components/daily-checkin-card.tsx:32) so it names only Legends AI cards and deep dives; (2) add a visible Report in the
chat thread header (src/app/chat.tsx), same report flow as long-press; (3) D20 password line: ask emci, then either change
src/app/auth/login.tsx:135 + src/lib/auth-password.ts:5 or mount PasswordSettingsFold on You; fix scripts/auth-password-check.ts;
(4) Divecore's own notification ask (src/play/pet-reminder.ts, pet-screen.tsx ~1601) respects the app's one-time ask and
"Not now" (Play commit on its own); (5) docs/app-store-pack.md review notes: where AI consent, Report, Block, Delete are;
(6) rewrite Box 68 B1/B3 and write Box 76.
DONE WHEN: copy matches AI_USE_DISCLOSURE (pin it in a check with pass/fail pairs), Report visible in chat, password promise
true, gate green, reviewer PASS, ONE OTA after emci's OK (runtime 1.1.0), Box 76 written. Update NOW.md + this roadmap.
RULES: no dependency/auth/env changes without emci's OK; Play and app in separate commits; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step AN0: Merge the art PR (82)
Model: Sonnet
```
Repo emci-hub/ATO. Read PROJECT_CONTEXT.md, CLAUDE.md, docs/art/PIXELLAB_GUIDE.md, and on branch claude/happy-fermi-k9x2um:
docs/art/animation-batch-plan.md ("Replan", "Art engine") + docs/art/animation-pipeline-research.md.
TASK (step AN0): PR #82 is a draft with merge conflicts (221 files). Merge master INTO that branch (no rebase, no force push),
resolve conflicts keeping master's app files and the branch's art/docs, run art:sync, check:art-registry --fresh,
check:play-isolation, the gate once. Show emci the Kael + Morwen Idle GIFs before asking to merge. No OTA, no PixelLab calls.
DONE WHEN: PR #82 is conflict-free and green, emci merged it (or said no), docs point to the batch plan on master.
RULES: Play/art scope only, never mixed with app work; ask before merge; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step A2: Legal and support go final
Model: Opus
```
Repo emci-hub/ATO, branch master (pull first). Read PROJECT_CONTEXT.md, CLAUDE.md, docs/ato-finish-roadmap.md (v2 §1.6, §3
M1-M3, Step A2), docs/legal/OPEN-QUESTIONS.md, src/app/legal/*.md, landing/*.html, docs/app-store-pack.md §8-9.
COMPLIANCE RULE (CLAUDE.md, emci 2026-10-22): follow the roadmap's "Compliance path" table: official sources first,
label mandatory / recommended / optional, describe only what the code does, no lawyer default, no provider change without
emci. NEEDS FIRST from emci: legal name for "operated by", support inbox confirmed, D26 (keep or drop DeepSeek), D27 (Gemini
paid tier?), OPEN-QUESTIONS 10 + 16 choices.
TASK (step A2): propose retention numbers and the other [CONFIRM] fills in ONE table for emci's OK (never guess a fact),
then fill every [CONFIRM], set "Last updated", remove "Draft, pending lawyer review", add the privacy-contact / access-request
(30 days) paragraph and a "not therapy or medical advice" line, fix item 8 (chat exists in 1.1), the landing access_requests
form (item 10), add landing/support.html, write the encryption reasoning (no-lawyer table) into app-store-pack.md §9, a
one-page breach plan in docs/, keep src/app/legal and landing in sync; if D26 = yes, remove DeepSeek from
_shared/ai-vendors.ts + text + check:floor (deploy ai-library after emci's OK, emci removes the secret); check:floor and
check:founder-access rewritten to the new text with pass/fail pairs.
DONE WHEN: grep finds 0 "[CONFIRM" and 0 "Draft" in landing/ and src/app/legal/, gate green, reviewer PASS, emci redeployed
the landing site, Box 77 (open Privacy/Terms/Support from the app on a phone) written. No OTA unless in-app text changed.
RULES: not legal advice — use only emci's/lawyer's answers; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step AN1: Art engine v1 + Maldrath pilot
Model: Sonnet
```
Repo emci-hub/ATO, branch master (pull; PR #82 must be merged). Read PROJECT_CONTEXT.md, CLAUDE.md,
docs/art/PIXELLAB_GUIDE.md, docs/art/animation-batch-plan.md ("Replan" row AN1 + "Art engine"),
docs/art/animation-pipeline-research.md, PIXELLAB_ANIMATION.md §0.
TASK (step AN1): build the art engine in build tooling only (scripts/art-engine/, specs in art-src/rigs/), never in the app
bundle: rig format, breathing-idle recipe, gates (foot row, height band, silhouette overlap, palette ⊆ atlas, prop pixels,
loop seam), ONE PixelLab config file the pre-flight updates. Pilot Maldrath E+W incl. the sword mask; show emci GIF vs current
vs skeleton-v3. 0 PixelLab generations. Nothing installed, no OTA.
DONE WHEN: engine + gates run on Maldrath, emci saw the comparison and said go/no-go for AN2, check:play-isolation green.
RULES: Play scope only; no dependency changes without emci's OK; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step A3: Server cleanup + safety
Model: Opus
```
Repo emci-hub/ATO, branch master (pull first). Read PROJECT_CONTEXT.md, CLAUDE.md, docs/ato-finish-roadmap.md (v2 §1.3,
§1.4, §1.6, §3 S1-S7, D24), docs/master-plan.md (Ledger C D13-D15), docs/circle-safety.md, supabase/migrations/wave92*,
wave39*, wave101*, wave104*, wave108*, supabase/functions/ai-library/, _shared/rate-limit.ts.
TASK (step A3): one migration set (copy live function bodies via read-only SQL before restating): refund_ai_tokens refunds only
a recorded failure (S2); allow-list show_up / talk_style on the server, after counting existing rows that would fail (S3);
drop play_dev_logs + wave101 inert policies (S5, deletes rows: emci OK). Drop kind 'story' from ai-library and the "Write as
Sage" prompts, bump LIBRARY_VERSION only if a served shape changes, gen:ai-library + deploy (S4). Read-only SQL: verify cron
jobs profile-history-monthly, chat-retention-30d, ai-library-fill (S6). S1 report alert per D24 (emci OK first: new pattern
if pg_net). S7: ask emci about mint-session-once / apple-secrets-check.
DONE WHEN: migrations applied by emci and verified read-only, deploys done, checks with pass/fail pairs, reviewer PASS, Box 78.
RULES: ask before every apply/deploy/deletion; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step A4: Copy decision
Model: Sonnet
```
Repo emci-hub/ATO, branch master (pull first). Read PROJECT_CONTEXT.md, CLAUDE.md, docs/copy-review-rules.md,
docs/ato-finish-roadmap.md (v2 §1.6 copy flags, M8, D21), every *_COPY_REVIEWED constant (grep src/).
TASK (step A4): give emci ONE table: each of the 17 false flags → surface, how many lines, who sees it, review doc, your
recommendation (accept / read / hide). After his answers: flip accepted flags with the date in a comment, hide surfaces he
wants hidden (a NEW gating pattern: plan it, ask first), fix master-plan line 302 and the v1 "unread surfaces get hidden" line.
DONE WHEN: every flag has emci's decision recorded in docs/master-plan.md Ledger A, checks pinning flags updated with pairs,
gate green, one OTA only if something is hidden, Box 79.
RULES: never edit copy meaning without a concrete problem (copy-review-rules); no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step AN2: All hero Idles
Model: Sonnet
```
Repo emci-hub/ATO, branch master (pull; AN1 done with emci's go). Read PROJECT_CONTEXT.md, CLAUDE.md,
docs/art/PIXELLAB_GUIDE.md, docs/art/animation-batch-plan.md (row AN2), the AN1 notes.
TASK (step AN2): rigs for every hero (auto-guessed lines, hand-checked prop/cape masks), Idle through the engine, ONE contact
sheet (identity 4x, current vs new) + one GIF per hero; emci marks approve/keep; install approved (archive old Idle via
art-decisions, replaces, art:sync, anim:library), Idle ms[] holds. 0 PixelLab generations.
DONE WHEN: approved Idles installed, check:art-registry --fresh + gate green, ONE Play-only OTA after emci's OK, Box 80.
RULES: Play scope only; never with app work; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step A5: Dead code + docs truth
Model: Sonnet
```
Repo emci-hub/ATO, branch master (pull first). Read PROJECT_CONTEXT.md, CLAUDE.md, docs/ato-finish-roadmap.md (v2 §1, S11,
S12), docs/sage-cleanup.md, docs/master-plan.md (D11, D14).
TASK (step A5): remove the ai-generate client path (src/lib/ai/edge.ts generateText + callers incl. category-deep-dive
writeOld, legend-figures/generate.ts, pingProvider), then emci deletes the function (D14); remove EXPO_PUBLIC_AI_PROVIDER /
MODEL_PROVIDER reads, rolls/* and legends64/store.ts dead files, BANK_MARKDOWN, stale comments; delete list "saved facts" +
delete-link accessibilityRole. Docs: NOW.md:32/:62 + "Left", sage-cleanup §4, OPEN-QUESTIONS 8, obsolete device boxes
(8, 11, 18-39, 29-32) marked obsolete, new box for Change answers / Undo / Start Fresh / card compare; list stale branches and
PRs #16 #17 #20 for emci to close.
DONE WHEN: checks rewritten (ai-provider etc.) never weakened, gate green, reviewer PASS, ONE OTA after OK, Box 81.
RULES: no Bash cd, no && chains; ask before deleting the function or branches.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step A6: Insight depth + earlier first insight
Model: Sonnet (Opus for the D22 design only)
```
Repo emci-hub/ATO, branch master (pull first). Read PROJECT_CONTEXT.md, CLAUDE.md, src/lib/voice/clear-voice.ts,
src/lib/insight-bank/ (pick.ts, index.ts), docs/insight-bank-review.md, docs/ato-finish-roadmap.md (v2 §1.1, S9, S10, D22).
TASK (step A6): (1) more stored ideas per lean so a single-lean person is not cycling 5 (target and count in the plan), plus
"mixed" ideas for people with no clear lean; new ids only (ftw_<axis>_<h|l>_<nn>, never reuse), clear voice, tipRuleViolation;
(2) per D22, the first insight after set 1 with an honest "early read" line. No model call (check:insights-no-ai).
DONE WHEN: check:insight-bank counts updated with pairs, review doc lists the new ideas for emci, gate green, reviewer PASS,
ONE OTA after OK, Box 82.
RULES: no streak or pressure copy; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step AN3: Clip timing holds
Model: Sonnet
```
Repo emci-hub/ATO, branch master (pull; AN2 on phones). Read PROJECT_CONTEXT.md, CLAUDE.md, docs/art/animation-batch-plan.md
(row AN3), docs/ANIMATION-AUDIT.md.
TASK (step AN3): first check whether play code reads per-frame ms[] or a flat fps; if code must change, say so and plan it as
its own Play step. Then per-frame holds for Walk/Run/Dash/Attack/Skill/Hurt/Faint/Death (the audit's "flat timing").
0 PixelLab generations.
DONE WHEN: timings in the library, art:sync + gate green, ONE Play-only OTA after OK, Box 83.
RULES: Play scope only; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step A7: Native 1.2 build
Model: Sonnet
```
Repo emci-hub/ATO, branch master (pull first). Read PROJECT_CONTEXT.md, CLAUDE.md, docs/app-store-pack.md,
docs/ato-finish-roadmap.md (v2 §1.5 widget, §1.6 encryption/camera, S13, S14), targets/widget/widgets.swift, app.json.
TASK (step A7): widget labels READ/DO → the insight's own words, description line; remove expo-camera plugin + permission
text + dependency (D16, emci OK); encryption key per the A2 answer; bump version/runtime; write the backup decision (S14).
emci runs the EAS production build, TestFlight, Box 84, ASC (What's New, notes), submit.
DONE WHEN: release-mode + gate green on the build commit, reviewer PASS, build submitted (emci), Box 84 passed.
RULES: dependency change only with emci's OK; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Step AN4: Creep / boss / tower Idles
Model: Sonnet
```
Repo emci-hub/ATO, branch master (pull; AN2 done). Read PROJECT_CONTEXT.md, CLAUDE.md, docs/art/PIXELLAB_GUIDE.md,
docs/art/animation-batch-plan.md (row AN4).
TASK (step AN4): rigs + Idle for the 7 creep / boss / tower characters with the engine, one contact sheet, emci approves,
install, art:sync. 0 PixelLab generations.
DONE WHEN: installed, gate green, ONE Play-only OTA after OK, Box 85.
RULES: Play scope only; no Bash cd, no && chains.
END THIS CHAT THE SAME WAY: assessment, next step, new-chat prompt.
```

### Credit cost summary
PixelLab: 0 generations for every step above; AN5 is the only paid one (~3 per direction, emci picks clips; 2026-10-22 balance
3,521.95, resets 2026-11-11). Chat size: S ≈ a short chat (few reads), M ≈ one normal chat with 2 agents, L ≈ split it.
Opus only for A2 (legal accuracy), A3 (SQL on live functions) and design calls; everything else Sonnet.

## Sources (web, 2026-10-22)
- https://developer.apple.com/app-store/review/guidelines/ (1.2, 5.1.1, 5.1.2(i))
- https://developer.apple.com/forums/thread/820209 (AI consent not seen by reviewer)
- https://www.igeeksblog.com/apple-app-store-ai-data-disclosure-guidelines (5.1.2(i) change, Nov 2025)
- https://www.iphoneincanada.ca/2025/07/25/updated-app-store-age-ratings (age tiers)
- https://supabase.com/docs/guides/deployment/going-into-prod
- https://expo.dev/blog/the-production-playbook-for-ota-updates ; https://docs.expo.dev/eas-update/rollouts/
- https://www.lazyweb.com/research/longest-onboarding-quizzes-benchmark
- https://makeheadway.com/blog/finch-app-review/ ; https://www.blick.ch/life/tamagotchi-fuer-die-seele-psychisch-gesund-dank-selfcare-app-id21160050.html
- https://screensdesign.com/articles/mobile-app-streak-design-examples/
- No-lawyer path: https://termly.io/resources/articles/do-i-need-a-lawyer-for-a-privacy-policy ;
  https://getterms.io/blog/do-i-need-a-lawyer-for-a-privacy-policy ; https://www.revenuecat.com/blog/engineering/creating-a-privacy-policy-for-your-app ;
  https://www.clym.io/regulations/pipa-ab ; https://www.mondaq.com/canada/privacy-protection/1113606/is-your-app-privacy-compliant-four-key-questions ;
  https://simonwillison.net/2024/Oct/17/gemini-terms-of-service ; https://lists.proxmox.com/pipermail/pve-devel/2025-September/075587.html (2021 BIS change, secondary) ;
  https://ucalgary.ca/news/ucalgary-pro-bono-student-law-clinic-and-uceed-team-support-new-ventures

---

# Archive: v1 (2026-10-19). Kept unchanged; every step below is done (see docs/master-plan.md rows 0-15).

# ATO finish roadmap (everything outside Divecore, to launch-ready)

Status: **PLAN APPROVED 2026-10-19 (scope: must + should-fix, steps 1-10).** Written by the outside-Divecore assessment chat
(docs only, no code, no OTA). One chat per step, one OTA (or SQL apply, or binary build) per step, one phone box per step.
This doc holds the plan's state; a new chat never needs an old chat's history.

## Decisions (emci, 2026-10-19; do not re-ask)

1. **Scope:** must + should-fix. Nice-to-have is out unless emci adds it.
2. **Hero economy at the flip: clean slate.** When `PRE_LAUNCH_DEV` goes `false`, every tester save is reset to the real
   economy (owned heroes, auras, finishes). No grandfathering. Matches the clean-slate policy.
3. **Remove invite-only: public signup.** emci: "remove invite only so it doesn't limit anyone to get it." Set
   `signup_mode = 'public'`; the invite field disappears (logic `src/app/auth/index.tsx:54-57`, field drawn `:151-156`). Referral codes may stay as an
   optional bonus, never a gate. Because signup is then open to the internet, step 1 (rate limits, OTP abuse) comes first.
4. **Unreviewed copy:** emci reads only the copy that a launch surface shows; any set he does not read gets its surface
   hidden at launch (flag stays `false`, nothing ships unreviewed by accident).
5. Already decided in the repo (still binding): no draft badges (2026-10-07), static helpline row, no streak guilt,
   token prices, AI library design, wave80 "apply only after the OTA reached phones".

Sources: six read-only investigators on master `7350e283` (file:line below are as of that commit) + web research (end).
Items marked GUESS were not proven from code; the step that touches them verifies first.

---

## 1. Findings per area

### 1. Daily insight + Home
- **Works.** Pick is pure and deterministic (`src/lib/insight-bank/pick.ts:70-114`: fnv1a of `userId|ymd|id`, no-repeat
  window `min(60, 0.8 × pool)`, falls back to 16 starters). Loaded on a tap (`today-focus-card.tsx:68-116`), saved by
  `insert_daily_insight`, cached, written to the widget. Old AI rows are hidden. No model call (`check:insights-no-ai`).
- **The insight is on the Insights tab, not Home.** Home has Today's Pick, week strip, check-in and one link
  (`src/app/(tabs)/index.tsx:50, 62-70`). The Check row is parked (`:67-71`).
- **No guilt found.** Check-in copy: "A missed day never resets the count" (`daily-checkin-card.tsx:20-26`). Small
  inaccuracy: "N of 7 this week" is lifetime count mod 7 (`:82`).
- **Unreviewed:** `INSIGHT_BANK_COPY_REVIEWED = false` (`insight-bank/index.ts:49`); `docs/insight-bank-review.md` has 208
  ideas, none ticked (~1,600 strings). Voice rules are mechanical (`scripts/insight-bank-check.ts:83-107`,
  `clear-voice.ts:98-120`); tone and diagnosis-adjacency need emci's read. Live to everyone, no badge.
- **Leftovers:** stale `DAILY_INSIGHT_COPY_REVIEWED` (`generate-insight.ts:25`) listed in the dev panel instead of the real
  flag (`dev-hub-panels.tsx:59,570`); `DAILY_INSIGHT_META` in `ai/call-sites.ts:86` likely dead; a failed save and a
  failed read show the same error, and a hung network leaves a skeleton up to 45 s (`today-focus-card.tsx:26,110-112`).
  The card label `SAGE_NPC_LABEL` renders "Focus · try · watch" (`sage-copy.ts:16`), so no Sage copy shows (checked).
- **Widget:** card-era keys kept on purpose (`today-insight.ts:23-40`); the widget shows a neutral line for worry/struggle
  leans (`ideaShareable`, `:79-94`): good for the Health module.
- **Phone boxes:** the Home boxes in `ATO_DEVICE_TESTS.md` describe the removed Read+Do/Sage and are unusable; only the
  check-in box (~:317-322) is current. No box for Load insight, the earlier-day label, offline tap, widget, the 7th-day +10.

### 2. Trait profile, questions, history
- **Writes are server-side:** `src/lib/trait-checkpoint.ts` → wave79 RPCs; maths in `trait_ewma_step`
  (`wave79_trait_checkpoint.sql:145-181`), parity pinned by `check:trait-checkpoint`.
- **wave80 (the lock) is NOT applied** (`wave80_trait_lock.sql`; `GOTCHAS.md:113`). Until it is, a signed-in client can still
  write `trait_tracks`/`trait_history` (`wave20_trait_tracks_titles.sql:47-53`, `wave19_trait_history_tokens.sql:55-58`).
  Real harm is tokens and gates keyed on `answer_count` (`wave78_staged_intake.sql:18-21`: the +15 full-profile payout).
  Applying it breaks any phone on an old bundle that writes directly, so it goes after the OTA reached phones.
- **Question bank:** 400 ids stable, voice gate in `scripts/question-bank-check.ts:49-78`. `BANK_COPY_REVIEWED = false`
  (`questions/bank-sets.ts:26`): 352 unreviewed (the 48 intake questions are approved). `STAGED_INTAKE_COPY_REVIEWED =
  false`. Attachment and conflict axes are the most sensitive (GUESS: no clinical-word list in the check).
- **History:** monthly cron `profile-history-monthly` (`wave86:453-508`) only NOTICEs if pg_cron is missing, so **verify it
  is registered in prod** (`select * from cron.job`). Snapshots never auto-deleted (design); delete-account relies on
  `ON DELETE CASCADE` (`delete-account/index.ts:137`), not proven per table.
- **Privacy:** personality-style scores incl. attachment/conflict, answer log, snapshots: sensitive, not health. Likely a
  privacy-label line under "Other User Content"/"Sensitive Info" (GUESS: confirm in the label step).
- **Boxes:** none for wave85/86 (set flow, Change answers, Undo, Start Fresh, cards, monthly).
- Leftovers: Retest wording (`trait-checkpoint.ts:12`, `bank_retest` kind): harmless.

### 3. Explore, deep dive, Story, Legends, AI, tokens
- **Live AI:** only through `ai-library` (`supabase/functions/ai-library/index.ts:55-137`): JWT, valid bucket, `ai_consent`,
  `claim_library_write`, model, checks, `library_add_cards`, refund on failure. The phone sends `{kind, bucket, mode}` only,
  so no typed text reaches a prompt. Triggers: deep dive (5 tokens), Legends (free reveal cap 2/day or 5 tokens).
  `ai-library-fill` runs every 10 min from pg_cron, capped 5/run and 400/day (`wave94_ai_library_fill.sql:33-35`;
  not named in CLAUDE.md). CLAUDE.md claims (no vendor key in bundle; fresh bundle) hold.
- **Consent:** `AI_USE_DISCLOSURE` (`ai-consent-card.tsx:24`) names Legends cards and deep dives = the only live uses;
  consent is checked on the server in both functions. `library_serve` serves existing cards without consent (fine, no model call).
- **Open proxy (must-fix):** `ai-generate` still accepts any prompt (≤24k chars), 6 providers including `claude`, 1024 output
  tokens; only gate is consent + 20/day, 200/month. No live feature needs it. Worst case ≈ $0.7/user/day (estimate).
- **Check-in farming (GUESS):** `claim_daily_checkin` uses `me.timezone` for "today" (`wave92:319-323`) and no write guard on
  that column was found: switching timezone could give ~3 check-ins/day. Verify, then freeze or validate the column.
- **Refund** after a good call: accepted by emci 2026-10-09 (`wave92:229-233`). Leave.
- **Dead/orphaned:** `_library_crisis` reads `crisis_flags`, which nothing writes (`wave93:99-110`) and the privacy label still
  declares it (`app-privacy-labels.md:20`); no callers for `runRoll`, `reroll.ts`, `generateCategoryStatements`,
  `generateLegendStory`; Story kind/claim RPC orphaned; stale Boxes 30 and 32 text.
- **AI cards served after 24 h with no human review** (`wave93:193`); two reports retire a card. Legends cards state things
  about real people with only a shape check (judgement: should-fix).
- **Unreviewed flags (all `false`):** `CATEGORY_DEEP_DIVE`, `CATEGORY_BANK`, `LEGEND_FIGURES` (120 unticked), `TEAM`,
  `STORY`/`STORY_BANK`, plus the other sets in section 6. Boxes 29-32 (Legends, deep dive, Story, tokens) are unticked and
  the library OTA was "not device-verified".

### 4. Circle + social safety
- **Today:** `connections` rows (reverse by trigger), `peer_profile`, `peer_checks`, per-friend `category_share`, Divecore visits
  and gifts (`wave97`, both-sides switch, pet look + 3 decor slots, shape-checked, no text). The **Circle tab and chat are
  parked placeholders** (`(tabs)/circle.tsx:32`, `chat.tsx:31`); no add-friend, chat or compare UI is reachable.
- **App Store 1.2 gaps:** `blocks`/`mutes`/`reports` tables exist (`stage7_chat_report.sql:20-293`) but nothing in `src`
  writes them: no block, no report, no filter, no moderation workflow. NOW.md still lists report/block as in progress.
- **High-risk exposure (GUESS until checked against the live database; source is the 2026-09-03 red-team doc):** consentless connect: any signed-in user who knows a handle can create a mirrored connection and
  read that person's checks/profile (`red-team-2026-09-03.md:36-54`); `peer_checks`/`peer_profile` ignore blocks
  (`peer_checks.sql:24-26`); `public_profile` and `handle_taken` enumerate handles with no rate limit.
- **Base tables (`me`, `connections`, `public_profile`) are not in the repo** (red-team S18): none of this is provable
  without the live schema. Deletion: all Circle tables cascade from `auth.users`; a deleted reported user erases the report.
- Age: 18+ at signup (was 16+; emci 2026-10-19, server migration wave99b_min_age_18.sql written, not applied) from a self-declared birthday (`age.ts:76-77`).
- NOW.md lines 66/74 still describe Circle compare as live (stale).

### 5. You tab, sign-up, onboarding, notifications, widget
- **First run:** blank until session/me/fonts, then auth → onboarding (one form: code if invite-only, birthday 18+, name,
  handle, city) → Home (`_layout.tsx:73-107`, `onboarding.tsx`). Apple sign-up without a code passes `auth/index.tsx:59-63`
  and is rejected later at `complete_signup` (moot once signup is public).
- **BUG (verified):** `src/app/_layout.tsx:109-118` puts the `play` route inside `Stack.Protected guard={PRE_LAUNCH_DEV}`;
  Divecore is meant to ship in every build. Flip the flag and **Divecore becomes unreachable**. `check:release-mode` has no
  pin for it.
- **Missing:** no Privacy Policy or Terms link anywhere in the app (grep finds none; text only in `src/app/legal/*.md`).
  No data export (not an Apple rule). Present: in-app Delete account (typed confirm, Apple revoke), Sign out, feedback mailto,
  AI consent toggle, static helpline row.
- **Push:** permission is asked only when `checkCount >= 1` (`push-policy.ts:12`) and the Check loop is parked, so most users
  are likely never asked and the morning/Sunday pushes never fire (GUESS, not run). Copy is clean (`copyHasFakeUrgency`,
  Sunday only if the app was opened). Evening push off.
- **Widget:** static header "SAGE · COACH", "READ"/"DO" labels (`targets/widget/widgets.swift:45-61`); fix needs a native build.
- **Accessibility:** `src/app/auth/*` has zero accessibility labels/roles; Larger Text/Reduce Motion not audited here.

### 6. Launch readiness
- **`PRE_LAUNCH_DEV = true`** (`src/lib/dev-mode.ts:15`); `DEV_TOOLS_AVAILABLE` (`:23`) and `PLAY_EVERYTHING_FREE` (`:31`) follow
  it; ~59 files reference it. `check:release-mode` (RELEASE_MODE unset): 43 gates, 44 checks pass, flag not enforced; it is
  enforced only on EAS production builds, not on OTA (`GOTCHAS.md:40`).
- **Hero economy at the flip:** `airportFree` (`playStore.ts:6716`) stops granting every hero but never revokes; saved
  `owned_hero_ids` sync to the cloud save, so testers keep everything unless reset (decision 2: reset). New players start with
  `DEFAULT_AVATAR_HERO_ID` (`:1515`). Premium gate is a TODO (`playStore.ts:4377`). Free aura/finish costs also turn paid
  (`:2048,2056,2929-3017`): run `check-finishes`, `check-auras`.
- **Signup:** `signup_mode` ∈ {`invite_only` (default), `public`} (`stage8_invite_referral.sql:24-28`), enforced in
  `complete_signup`; client fails closed (`invite.ts:36-45`). `assert_invite_usable` is anon-callable, no rate limit; the QA
  override code is a short dictionary word (`PROJECT_CONTEXT.md:576-588`).
- **Security pass (never done):** no `supabase/config.toml` (no committed `verify_jwt`); 8+ Edge Functions, `dev-unlock` and
  `password-login` unauthenticated by design; `play_dev_logs` grants select to anon (`wave73:38`); dev-test password and
  `DEV_UNLOCK_PASSWORD` short, the first in git history; ~78 migrations use SECURITY DEFINER (search_path not machine-checked);
  Supabase advisors not run; two JWT-shaped strings (`landing/index.html:110`, `scripts/apple-endpoint-probe.ts:50`) likely the
  public anon key (verify the role claim).
- **Legal:** `docs/legal/*.DRAFT.md` say "NEEDS EMCI REVIEW", with brackets for the date, which AI providers are live and
  whether old `sage_messages`/`crisis_flags`/`me.facts` are deleted. The shipped `src/app/legal/privacy.md`, `terms.md`,
  `app-privacy-labels.md`, `landing/privacy.html` still mention Sage and crisis logging and omit the Divecore cloud save.
  `app.json` `privacyManifests` hand-written. Age-rating/UGC answers not in the repo (GUESS: unset). Support
  `support@asstrollogs.com`; App Store Connect needs the URL.
- **delete-account** (`index.ts:79-157`) revokes Apple, deletes the auth user (cascade), then `count_user_rows` proof; the proof
  missed six tables at wave88, so run `check:delete-account` live and re-verify coverage.
- **Build:** `com.emgens.ato`, 1.0.0, `runtimeVersion "1.0.0"`, `ITSAppUsesNonExemptEncryption` false. New binary needed for:
  haptics, widget header, any plugin/entitlement/`app.json` change. Everything in `src` is OTA.
- **Branches:** `feature/insights-replace-sage` is already merged (`git log master..branch` empty): nothing to do.
- **Sentry:** `sendDefaultPii` false, traces 0, no `beforeSend` scrubber (breadcrumbs/Supabase errors could carry PII).
- **`*_COPY_REVIEWED = false`:** TEAM, CATEGORY_BANK, DAILY_PICK, CATEGORY_STATEMENTS, CATEGORY_DEEP_DIVE, DAILY_INSIGHT,
  PROFILE_CARD, INSIGHT_BANK, POLISH, LEGEND_FIGURES, STORY, TITLE, CATEGORY_READ, STORY_BANK, BANK (questions), STAGED_INTAKE.
  Reviewed `true`: CIRCLE_VISITS, VISITORS, POLE, CATEGORY_BAND, CATEGORY, BUDDY, DAILY_LINE, NAME_STYLES_V2, LEGENDS64,
  PROFILE_FILL, EIGHT_BALL, PET_KNOWS_YOU, CONCEPT, QUESTION_VOICE.
- **Open phone boxes:** 43, 53, 54, 55, 56, 58 (Divecore), and Boxes 29-32 plus the wave85/86 gaps above. Many older boxes (5-13,
  16-37, 70, 140-143, 234-253) describe Sage/Read+Do and are stale.

## 2. What comparable apps do (web, treat as hints)

- **Account deletion (Apple 5.1.1(v)):** the app must let people start deletion in-app; deactivation alone is not enough; a
  slow/manual process is acceptable ([Apple](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/)).
- **AI (5.1.2):** disclose where personal data goes to third-party AI and get explicit permission
  ([Apple news](https://developer.apple.com/news/?id=ey6d8onl)). ATO's consent screen already names the live uses.
- **Social/UGC (1.2):** filter, report with timely response, block abusive users
  ([Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)). Contact info is in older wording; publish it anyway.
- **Mental-wellness data:** the FTC Health Breach Notification Rule covers non-HIPAA wellness apps incl. mental health, and
  "breach" includes sharing without consent; enforcement cases were about third-party sharing
  ([FTC](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)). Practical
  rule for ATO: no third-party SDKs that see profile data, no ad IDs, say so in the policy. Not legal advice; have a lawyer read the policy.
- **Daily-content apps:** Finch uses streaks with "forgiving" repairs and optional reminders; Daylio has no streak mechanic,
  stores locally, and collects only anonymized usage/crash
  ([Finch](https://apps.apple.com/us/app/finch-self-care-pet/id1528595748), [Daylio](https://daylio.net/faq/privacy-policy/)).
  ATO's "missed day never resets" already sits at the kind end; keep it and keep push copy free of loss framing.
- **Supabase go-live:** RLS on every table, publishable key only in the client, auth rate limits, pre-request checks for
  per-user/IP limits, run the Security Advisor ([Supabase](https://supabase.com/docs/guides/deployment/going-into-prod),
  [Rate limits](https://supabase.com/docs/guides/auth/rate-limits)).

---

## 3. Ranked list

Effort S ≤ 1 chat-hour, M ≈ one chat, L = needs emci's reading time. Risk = harm if left / if wrong.

### Must-fix
| # | Item | Effort | Risk | Step |
|---|---|---|---|---|
| M1 | Close the `ai-generate` open proxy (remove or whitelist) | S-M | high | 1 |
| M2 | Rate limits: `assert_invite_usable`, `public_profile`, `handle_taken`, OTP/signup (signup is public) | M | high | 1 |
| M3 | Rotate QA invite code, dev-test password, `DEV_UNLOCK_PASSWORD`; drop `play_dev_logs` anon select | S | high | 1 |
| M4 | Security pass: advisors, anon RPC list, `verify_jwt` + in-code `getUser()`, anon-key check, commit baseline schema | M | high | 1 |
| M5 | Circle consent: pending/accepted connect (no consentless peer reads) | M | high | 3 |
| M6 | Block + Report UI and data path; peer RPCs refuse a blocked pair; keep reports after account deletion | M | high | 3 |
| M7 | Rewrite privacy policy, terms, privacy labels, `privacyManifests`; fill AI-provider/deletion brackets | M | high | 7 |
| M8 | Privacy/Terms links on You + auth | S | low | 7 |
| M9 | emci reads must-ship copy (insight bank 208, 352 questions, deep dive, Legends, categories); hide surfaces he does not read | L | med | 2 |
| M10 | Fix the `play` route guard + pin it in `check:release-mode` | S | med | 9 |
| M11 | Flip `PRE_LAUNCH_DEV=false`, hero clean-slate reset, premium TODO decision, `signup_mode=public` | M | high | 9 |
| M12 | Apply wave80 (only once old bundles are gone; **the repo has no minimum-app-version mechanism**, so step 9 builds a tiny one or emci accepts the risk) | S | high | 9 |
| M13 | Production binary + store submission (age rating, UGC answers, support URL) | M | med | 10 |

### Should-fix
| # | Item | Effort | Risk | Step |
|---|---|---|---|---|
| S1 | Check-in timezone farming: verify, then freeze/validate `me.timezone` | S | med | 1 |
| S2 | Sentry `beforeSend` scrubber | S | med | 1 |
| S3 | Name and handle filter; in-app support contact | S | med | 3 |
| S4 | Notification permission ask moved to a real trigger (after first insight / intake set) | S-M | low | 4 |
| S5 | Auth + onboarding accessibility labels; Larger Text / Reduce Motion pass on You, auth, Explore | S-M | low | 4 |
| S6 | Insight/Home polish: split read vs save error, "N of 7" wording, dev-panel flag (`DAILY_INSIGHT_META` removal belongs to step 6) | S | low | 5 |
| S7 | AI cleanup: dead crisis gate, orphaned callers, Story plumbing, `call-sites.ts`; Legends fact accuracy; unreviewed-AI-card policy | M | med | 6 |
| S8 | Live delete-account check, `count_user_rows` coverage, verify trait/snapshot cascades, cron registered | S | med | 7 |
| S9 | Rewrite stale device boxes; add boxes for everything below; one full pass | M | low | 8 |
| S10 | Widget header (native build, rides with step 10) | M | low | 10 |

### Nice-to-have (out of scope unless added)
Data export (L); mute (S); branch cleanup; refresh stale NOW.md Circle lines; access-request screen (not needed: signup is
public); Undo-rolls-back-Today's-Pick copy; onboarding timeout copy.

### Cut
Token refund-after-good-call (accepted 2026-10-09); renaming the card-era widget keys (needs a native build for no user value);
Retest leftovers.

---

## 4. ATO IS LAUNCH-READY WHEN

- [ ] `ai-generate` cannot be used as an open model proxy; every anon/unauthenticated endpoint is rate limited (1)
- [ ] Supabase advisors security findings: none open, or each one written down as accepted (1)
- [ ] No short/guessable code or password remains: QA code, dev-test, dev-unlock rotated; `play_dev_logs` closed (1)
- [ ] Circle: connect needs acceptance; Block and Report work in the UI; a blocked pair reads nothing; reports survive
      deletion; names/handles filtered; support contact visible (3)
- [ ] Privacy policy, terms, privacy labels and `privacyManifests` match what the app does today (no Sage/crisis, includes
      Divecore cloud save, real AI providers); links in You and auth; a lawyer has read the policy (7)
      (the Larger Text + Reduce Motion pass is built in step 4, boxed in 8 and 10)
- [ ] `check:delete-account` live: account, rows, Apple token all gone; cron job registered (7)
- [ ] Every copy set that ships is reviewed by emci; every other set's surface is hidden; no flag is `false` on a shown surface (2)
- [ ] Divecore reachable with `PRE_LAUNCH_DEV=false` (route fixed and pinned); hero economy is the real one after the reset (9)
- [ ] `signup_mode = public`; invite field gone; the full sign-up flow works for a brand-new email on a clean phone (9)
- [ ] wave80 applied; direct trait writes refused; old bundles no longer in use (9)
- [ ] `RELEASE_MODE=1 npm run check:release-mode` and `check:ota-gate` green on the release commit; production EAS build
      installed on a phone via TestFlight and run end to end (10)
- [ ] Phone boxes for steps 1-10 passed; stale boxes rewritten; Larger Text + Reduce Motion pass done (8, 10)
- [ ] App Store Connect: age rating (UGC answers), support URL, privacy URL, labels, review notes, screenshots (10)

---

## 5. Step order (one chat each; one OTA / SQL / build per step; one phone box each)

Why this order: signup becomes public, so the server is hardened first (1). Copy reading (2) is emci's slow part and runs
alongside steps 3-6. Circle safety (3) before anything invites strangers together. App-side polish (4-6) uses the OTA path.
Legal (7) needs the final behaviour of 1-6. Boxes (8) cover everything built. The flip (9) is last-but-one because it removes
dev tools and resets heroes; the build (10) is the first moment `PRE_LAUNCH_DEV=false` is enforced.

| # | Step | Tag | Server / SQL | Binary | Phone box |
|---|---|---|---|---|---|
| 1 | **Server hardening** (M1-M4, S1, S2) | must | **yes**: rate-limit mechanism is a NEW pattern (ask emci); `ai-generate` change = function deploy; `me.timezone` guard; drop `play_dev_logs` anon grant; committed baseline schema. Secret rotations are done by emci (steps listed, never printed) | no | 59 |
| 2 | **Copy reading** (M9) | must | none (flag flips + surface hides are OTA) | no | 60 |
| 3 | **Circle safety** (M5, M6, S3) | must | **yes**: accept state, block/report RPCs use tested patterns (`blocks`/`reports` tables exist), `peer_*` refuse blocked pairs | no | 61 |
| 4 | **Notifications + accessibility** (S4, S5) | should | none | no | 62 |
| 5 | **Insight / Home polish** (S6) | should | none | no | 63 |
| 6 | **AI cleanup** (S7) | should | possible: retire `_library_crisis`, orphaned claim RPCs: ask emci (alters existing objects) | no | 64 |
| 7 | **Legal, privacy, deletion** (M7, M8, S8) | must | none; live delete-account check uses the dev-test user only | no | 65 |
| 8 | **Device boxes rewrite + full pass** (S9) | should | none | no | 66 (the full run) |
| 9 | **Launch flip** (M10-M12) | must | **yes**: hero clean-slate reset RPC/migration (alters data: ask emci), `signup_mode='public'`, wave80 apply (timing gate) | no (OTA) | 67 |
| 10 | **Production build + submission** (M13, S10) | must | none | **yes**: EAS production build (widget header, haptics) | 68 (TestFlight run) |

Box numbers 59-68 continue after Divecore's Box 58; Box 58 and the open Divecore boxes (43, 53-56) can be closed any time.

Step 9 is in two halves so nothing breaks mid-way: (a) OTA with the route fix and flag work, wait until phones are on it;
(b) apply wave80, flip `signup_mode`, set `PRE_LAUNCH_DEV=false` and run the hero reset, all in half (b) (one moment,
no reset in step 10; step 10 builds from that commit).

### Step details

**1. Server hardening.** Plan shows: the rate-limit mechanism (per-user/IP counter table + `pre-request` check vs Supabase
auth limits; recommend reusing `claim_ai_call`'s advisory-lock pattern), the `ai-generate` decision (recommend delete the
generic path and keep only the library path), and the list of rotations for emci. Run `get_advisors` (security + performance)
and paste findings into this doc. DONE: all M1-M4/S1/S2 items ticked or listed as accepted by emci, `check:ota-gate` green,
live checks `invite`, `quota`, `password-login` run by hand with the dev-test user.

**2. Copy reading.** Build a single "read it" doc per set (ticked boxes live in `docs/*-review.md`), ordered by what a new
user sees first: intake 48 (approved) → insight bank (208) → the 352 questions (attachment and conflict first) → deep dive →
Legends (120) → categories. emci reads in his own time. Each ticked set flips its flag; each set not read gets its surface
hidden (list in the plan before building). DONE: no shown surface has an unreviewed flag.

**3. Circle safety.** Decision for the plan (recommend, then wait for OK): ship Circle at launch as **connect-with-accept +
Divecore visits + Block/Report**; chat and trait compare stay parked (they need more moderation), and say so in NOW.md. If emci
wants compare at launch, step 3 grows by one chat. DONE: Block and Report reachable in ≤2 taps from any friend row, a blocked
pair reads nothing, reports table viewable in the dashboard with a one-line triage routine documented, `check:circle-safety`.

**4. Notifications + accessibility.** New ask trigger (recommend: after the first insight is loaded, with a plain explanation
screen first, never at cold start); labels/roles on auth + onboarding; one Larger Text (×1.2/×2) + Reduce Motion + VoiceOver
pass over You, auth, onboarding, Explore, Insights. DONE: no clipped text at ×2 on those screens.

**5. Insight / Home polish.** Small and mechanical (S6). Also decide whether Home shows the insight (today it only links).
Recommend leave as is.

**6. AI cleanup.** Remove dead callers and call-site entries; retire `_library_crisis` and fix the privacy-label line;
decide Legends accuracy (recommend: ship Legends only from reviewed figure lists, AI writes the line not the facts, or hide
AI Legends until a fact check exists) and the 24 h auto-serve rule (recommend: AI cards need `source='reviewed'` or a
second report-free week). Bundle regen + `deploy ai-library` if prompts change (`check:ai-library`).

**7. Legal, privacy, deletion.** Start from `docs/legal/*.DRAFT.md`; replace brackets with facts from the code (AI providers
live, deletion coverage). Update `src/app/legal/*`, `landing/*`, `app.json` `privacyManifests`, label doc. Add links in You and
on the auth screen (open `landing` URLs). Run `check:delete-account` live and extend `count_user_rows` if short. DONE: emci has
read the policy; lawyer review recommended before the store submit.

**8. Device boxes rewrite + full pass.** Replace stale boxes (5-13, 16-37, 70, 140-143, 234-253) with current ones; add
wave85/86, insight, tokens, auth, push, Circle, Block/Report, delete-account. Mark old ones SUPERSEDED, never delete. emci runs
the full pass once.

**9. Launch flip.** Plan shows the exact diff list first. (a) OTA: route guard → its own always-on screen, `check:release-mode`
pin, premium TODO decision, hero-reset RPC prepared. (b) After phones are on (a): apply wave80, `signup_mode='public'`,
run the reset at build time. DONE: `PRE_LAUNCH_DEV=false` on master, `RELEASE_MODE=1 npm run check:release-mode` green,
Divecore reachable on a phone running the production-mode bundle, a fresh account sees the real economy.

**10. Production build + submission.** `eas build --profile production` (flag enforced), TestFlight run, App Store Connect
metadata, age rating, UGC answers, review notes with a demo account (a real test account made for Apple review, not a tester's).

---

## 6. Step prompts (copy one per new chat)

Standing rules for every step (also in each prompt): pull before commit and again before publish; no dependency/auth/env
change without emci's ok; SQL or a NEW pattern = ask first, a copy of a tested path = build and report; commit code and
docs separately (message in a file); never print keys or tokens; end with assessment → next → prompt.

### Step 1: Server hardening
Model: Sonnet 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull, then branch
feature/ato-server-hardening. Read PROJECT_CONTEXT.md, CLAUDE.md, docs/GOTCHAS.md and docs/ato-finish-roadmap.md (Decisions,
findings 2, 3, 6, step 1). Do not re-ask decisions listed there.

Step 1 of the ATO finish roadmap: server hardening, because signup is going public.
Do: M1 close the ai-generate open proxy; M2 rate limits on assert_invite_usable, public_profile, handle_taken and sign-up/OTP;
M3 list the rotations emci must do (QA invite code, dev-test password, DEV_UNLOCK_PASSWORD) as numbered steps, drop the
play_dev_logs anon select; M4 run the Supabase security + performance advisors, check every Edge Function for verify_jwt
and getUser(), confirm the landing anon-key line is role anon, commit a baseline schema for me/connections/public_profile
if it can be read live; S1 test whether changing me.timezone farms check-ins and fix it; S2 Sentry beforeSend scrubber.
Done when: every item above is ticked or listed as accepted, findings pasted into the roadmap, check:ota-gate green, one
reviewer pass, live checks (invite, quota, password-login) run by hand with the dev-test user only.
Plan first: show the rate-limit design, the ai-generate decision and the full list of SQL and function deploys, all
approvals in one message, and wait for my OK. Then build, typecheck, lint, check:ota-gate once, reviewer once, draft PR into
master, update docs/ato-finish-roadmap.md Progress + docs/NOW.md + PROJECT_CONTEXT.md, write phone Box 59. No merge, no OTA
unless I say so. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one code
block), same format as this one.
```

### Step 2: Copy reading
Model: Sonnet 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull, then branch
feature/ato-copy-review. Read PROJECT_CONTEXT.md, CLAUDE.md, docs/ato-finish-roadmap.md (Decisions 4, finding lists of
*_COPY_REVIEWED, step 2) and the review docs: docs/insight-bank-review.md, docs/category-deep-dive-review.md,
docs/legend-figures-review.md, docs/category-bank-review.md, docs/team-names-review.md, docs/story-review.md.

Step 2 of the ATO finish roadmap: copy reading. emci reads only what a launch surface shows; anything not read gets its
surface hidden. Do: (1) a one-page reading list in the order a new user sees things, with counts and time estimates, and the
exact surface each flag gates; (2) a reading helper emci can use on the phone or in the doc (tick = reviewed, edit = replace
line, X = remove); (3) after emci's ticks: flip each reviewed flag, replace edited lines, remove X lines (a removed question
or idea keeps its id forever), hide each unread surface behind its flag, regenerate bundles if needed (gen:ai-library +
supabase functions deploy ai-library, ask first), update CLAUDE.md "unreviewed copy" lines.
Done when: no shown surface has a false *_COPY_REVIEWED flag, check:ota-gate green, one reviewer pass, Box 60 written.
Plan first: show the reading list and the hide-list, wait for my OK. This step is mostly my reading time: stop and wait for me
after (2). Never print keys or tokens. No merge, no OTA unless I say so.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one code
block), same format as this one.
```

### Step 3: Circle safety
Model: Opus 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull, then branch
feature/ato-circle-safety. Read PROJECT_CONTEXT.md, CLAUDE.md, docs/GOTCHAS.md, docs/red-team-2026-09-03.md and
docs/ato-finish-roadmap.md (Decisions, finding 4, step 3). Read supabase/migrations/stage7_chat_report.sql, peer_checks.sql,
wave97_circle_visits.sql, src/lib/circle.ts. Do not re-ask decisions listed there.

Step 3 of the ATO finish roadmap: Circle safety (App Store 1.2).
Do: M5 connect needs acceptance (pending/accepted, mirror row only on accept); M6 Block and Report UI + data path
(blocks/reports tables exist: reuse them), peer_checks / peer_profile / peer_category_pack refuse a blocked pair, reports
survive the reported user's deletion (stop the cascade on reports.user_id, keep a minimal record); S3 name/handle filter and a
visible support contact. Plan decision first: recommend ship connect-with-accept + Divecore visits + Block/Report, chat and
compare stay parked (say so in NOW.md); wait for my OK.
Done when: Block and Report are 2 taps from any friend row, a blocked pair reads nothing (RPC test with two dev-test-style
accounts, never real ones), reports readable in the dashboard with a triage note, check:circle-safety added, check:ota-gate
green, one reviewer pass, Box 61 written.
Plan first, with all SQL named in one message (copies of tested paths are built without asking, anything that alters or
deletes existing data asks first). Then build, typecheck, lint, check:ota-gate once, reviewer once, draft PR into master,
update roadmap Progress + docs/NOW.md + PROJECT_CONTEXT.md. No merge, no OTA unless I say so. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one code
block), same format as this one.
```

### Step 4: Notifications + accessibility
Model: Sonnet 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull, then branch
feature/ato-notify-a11y. Read PROJECT_CONTEXT.md, CLAUDE.md, docs/ato-finish-roadmap.md (finding 5, step 4). Do not re-ask
decisions listed there.

Step 4 of the ATO finish roadmap: notification ask + accessibility.
Do: S4 move the notification permission ask (src/lib/push-policy.ts:12 is gated on a parked Check count) to a real trigger,
recommend after the first insight is loaded, with a short plain screen first and an easy "not now", never at cold start;
verify what actually fires today. S5 add accessibility labels/roles to src/app/auth/* and onboarding; run one Larger Text
(x1.2 and x2), one Reduce Motion and one VoiceOver-label pass over You, auth, onboarding, Explore, Insights and fix clipped
text. Copy stays no-guilt (copyHasFakeUrgency).
Done when: a fresh account is asked once at the right moment, labels exist on every auth/onboarding control, no clipped
text at x2 on those screens (previews at 430x932 + 375x667), check:ota-gate green, one reviewer pass, Box 62 written.
Plan first: show the trigger and the screen text, wait for my OK. Then build, typecheck, lint, check:ota-gate once, reviewer
once, draft PR into master, update roadmap Progress + NOW + PROJECT_CONTEXT. No merge, no OTA unless I say so. Never print
keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one code
block), same format as this one.
```

### Step 5: Insight / Home polish
Model: Sonnet 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull, then branch
feature/ato-insight-polish. Read PROJECT_CONTEXT.md, CLAUDE.md, docs/ato-finish-roadmap.md (finding 1, step 5). Do not re-ask
decisions listed there.

Step 5 of the ATO finish roadmap: insight / Home polish (S6).
Do: split the read-failed vs save-failed error in src/components/insights/today-focus-card.tsx and shorten the 45 s skeleton
with a retry; fix the "N of 7 this week" wording (lifetime count mod 7, daily-checkin-card.tsx:82); list INSIGHT_BANK_COPY_REVIEWED
(not the stale DAILY_INSIGHT_COPY_REVIEWED) in the dev panel (DAILY_INSIGHT_META removal is step 6's);
confirm the useBuddyStreak milestone copy (3/7/21 days) has no loss framing.
Done when: the above is done, check:insights-no-ai + check:ota-gate green, one reviewer pass, Box 63 written (Load insight,
earlier-day label, offline tap, widget try line / private line, the 7th-day +10).
Plan first: list the exact edits, wait for my OK. Smallest safe change, no refactors. Build, typecheck, lint, check:ota-gate once, reviewer once, draft PR into master, update
roadmap Progress + NOW + PROJECT_CONTEXT. No merge, no OTA unless I say so. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one code
block), same format as this one.
```

### Step 6: AI cleanup
Model: Opus 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull, then branch
feature/ato-ai-cleanup. Read PROJECT_CONTEXT.md, CLAUDE.md (AI invariants), docs/ato-finish-roadmap.md (finding 3, step 6),
supabase/functions/ai-library, supabase/migrations/wave93_ai_library.sql. Do not re-ask decisions listed there.

Step 6 of the ATO finish roadmap: AI cleanup (S7).
Do: remove dead callers and call-site entries (runRoll, reroll.ts, generateCategoryStatements, generateLegendStory,
src/lib/ai/call-sites.ts) after a grep proves no callers; retire the always-false _library_crisis gate and the
crisis_flags line in the privacy-label doc (alters an existing function: ask me first); decide Legends accuracy (recommend:
AI writes the line, never the facts, or hide AI Legends until a check exists) and the 24 h auto-serve of AI cards
(recommend: needs a report-free week or a reviewed source); refresh CLAUDE.md for ai-library-fill and the new rules; fix the
stale Boxes 30 and 32. Any prompt/check edit needs npm run gen:ai-library + supabase functions deploy ai-library (ask first),
bump LIBRARY_VERSION when a card shape changes.
Done when: check:ai-library, check:ai-tokens, check:ota-gate green, one reviewer pass, Box 64 written.
Plan first: all SQL, deploys and the two decisions in one message, wait for my OK. Then build, draft PR into master, update
roadmap Progress + NOW + PROJECT_CONTEXT. No merge, no OTA unless I say so. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one code
block), same format as this one.
```

### Step 7: Legal, privacy, deletion
Model: Opus 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull, then branch
feature/ato-legal. Read PROJECT_CONTEXT.md, CLAUDE.md, docs/BUSINESS.md, docs/legal/ (both DRAFT files),
src/app/legal/*.md, src/app/legal/app-privacy-labels.md, landing/privacy.html, landing/terms.html, app.json (privacyManifests),
supabase/functions/delete-account/index.ts and docs/ato-finish-roadmap.md (Decisions, finding 6, step 7).
Do not re-ask decisions listed there.

Step 7 of the ATO finish roadmap: legal, privacy, deletion.
Do: M7 rewrite privacy policy, terms and the privacy-label doc from what the code does today (Sage and crisis logging gone;
Divecore cloud save, trait data, Circle visits, AI library with the real providers, Sentry crash data included; no ad SDKs);
fill the draft brackets from the code and list anything only I can answer; update app.json privacyManifests; M8 add Privacy and
Terms links on You and on the auth screen; S8 run check:delete-account live with the dev-test user only, extend count_user_rows
to every user table, confirm trait/snapshot/circle cascades and the cron job registration.
Done when: the live text, in-app text, landing pages and manifests agree, I have read the policy (say plainly it is not legal
advice and a lawyer should read it before submit), delete-account proof passes, check:ota-gate green, one reviewer pass,
Box 65 written. A privacy-label table "data type / linked / used for tracking" is part of the doc.
Plan first: show the diff list and the questions only I can answer, wait for my OK. Then build, typecheck, lint,
check:ota-gate once, reviewer once, draft PR into master, update roadmap Progress + NOW + PROJECT_CONTEXT. No merge, no OTA
unless I say so. Never print keys or tokens.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one code
block), same format as this one.
```

### Step 8: Device boxes rewrite + full pass
Model: Sonnet 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull. Read
PROJECT_CONTEXT.md, docs/ato-finish-roadmap.md (step 8, boxes 59-65), docs/ATO_DEVICE_TESTS.md. Do not re-ask decisions
listed there. Docs only, no code.

Step 8 of the ATO finish roadmap: device boxes rewrite + one full pass.
Do: mark stale boxes SUPERSEDED (5-13, 16-37, 70, 140-143, 234-253: never delete) and write current boxes for sign-up on a
clean phone, the 48 and the sets, Change answers + Undo + Start Fresh, profile cards + monthly card, insight (Load, earlier day,
offline), tokens (+5, 7th +10, AI view 5), Explore deep dive, Legends, Circle connect/accept/Block/Report, You tab + helpline,
notifications ask, widget, delete account. Add Box 66: one full run as a brand-new user and one on an old save, plus a Larger
Text and Reduce Motion pass. Each box: steps, expected, PASS/FAIL line.
Plan first: show the box list outline, wait for my OK. Done when: every open box from steps 1-7 is in one ordered list with an estimated 20-minute grouping, one reviewer pass, docs
committed and pushed (docs-only: no OTA), I am asked to run Box 66.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one code
block), same format as this one.
```

### Step 9: Launch flip
Model: Opus 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull, then branch
feature/ato-launch-flip. Read PROJECT_CONTEXT.md (the pre-launch checklist near lines 557-588), CLAUDE.md, docs/GOTCHAS.md
(release mode, wave80), docs/ato-finish-roadmap.md (Decisions, findings 5-6, step 9), src/lib/dev-mode.ts,
src/app/_layout.tsx, src/play/playStore.ts (airportFree, owned_hero_ids, TODO(A5)), supabase/migrations/wave80_trait_lock.sql.
Do not re-ask decisions listed there (clean-slate hero reset; public signup, no invite gate).

Step 9 of the ATO finish roadmap: launch flip, in two halves.
Half (a), OTA: move the play route out of Stack.Protected guard={PRE_LAUNCH_DEV} so Divecore is always reachable; add a pin to
check:release-mode so it cannot come back; decide the Premium hero TODO (recommend: no purchase path at launch, heroes come
from eggs and band clears, say so in copy); prepare the hero clean-slate reset (RPC or migration that resets owned heroes,
auras and finishes for existing saves, ask me first, it alters data) and a confirm-free way for the new bundle to re-seed the
cloud save at v33; run check-finishes and check-auras with the flag off.
Half (b), after (a) has reached phones (the repo has no minimum-app-version check: build a tiny one in (a), or ask me to
accept the risk): apply wave80, set signup_mode='public', run the hero reset once, set PRE_LAUNCH_DEV=false on master
(step 10 does not reset again). Verify with RELEASE_MODE=1 npm run check:release-mode.
Done when: master has PRE_LAUNCH_DEV=false, the release-mode check passes, Divecore opens in a bundle built with the flag
off (static web export check), a fresh account sees no dev tool and the real hero economy, no tester save keeps free heroes,
check:ota-gate green, one reviewer pass, Box 67 written.
Plan first: the exact diff list, the SQL, the timing between (a) and (b), all approvals in one message, wait for my OK.
Never print keys or tokens. No merge, no OTA unless I say so.

End this chat with: a 3-5 line assessment, the next step, and a ready prompt for the next chat (Model: line + one code
block), same format as this one.
```

### Step 10: Production build + submission
Model: Sonnet 5
```
Repo emci-hub/ATO (C:\Users\lil_e\Desktop\ATO). First: git fetch origin, git checkout master, git pull, then branch
feature/ato-release-build. Read PROJECT_CONTEXT.md, CLAUDE.md, docs/ato-finish-roadmap.md ("ATO IS LAUNCH-READY WHEN", step 10), app.json, eas.json,
docs/BUSINESS.md. Do not re-ask decisions listed there.

Step 10 of the ATO finish roadmap: production build + store submission.
Do: go through the "ATO IS LAUNCH-READY WHEN" list line by line with evidence; fix only small gaps and list anything bigger;
widget header ("SAGE · COACH" to the current label) and haptics ride in this binary (native build; show me the exact app.json
or widget diff first); run RELEASE_MODE=1 npm run check:release-mode and npm run check:ota-gate on the release commit; write
the App Store Connect pack: age-rating answers (UGC, report/block present), support URL, privacy URL, labels from the step 7
table, export compliance (ITSAppUsesNonExemptEncryption false), review notes + a dedicated demo account for Apple review,
screenshots list; then the EAS production build and TestFlight steps as numbered actions for me.
Done when: the checklist is ticked or each open line is accepted by me, the build is green, I am asked to run Box 68 on the
TestFlight build.
Plan first: show the checklist status and the build diff, wait for my OK before any build. Never print keys or tokens.

End this chat with: a 3-5 line assessment, then "ATO is ready to submit" or the one blocker, and the submission steps.
```

---

## Progress

- 2026-10-19: assessment written (this doc). Scope and three decisions recorded above.
- 2026-10-19: **Step 1 (server hardening) built on `feature/ato-server-hardening`, draft PR into master. NOT applied to the live
  project: the live SQL apply, the three function deploys and the live checks are waiting for emci** (the sandbox refused
  every write to the live database, even the approved migration; see "Step 1 status" below). No OTA, no merge.
  Steps 3-10 not started.
- 2026-10-19: **Step 2 (copy reading) in progress on `feature/ato-copy-review`, nothing merged, no flag flipped yet.** Nine agent
  reviews (`docs/copy-review-agent/`) feed a phone reading helper (`npm run gen:copy-reading`; 353 cards, 23 marked as
  possibly softening a real limitation). emci added the **honest-weaknesses rule** (CLAUDE.md): real limitations may be
  stated plainly, Strengths/Weaknesses labels stay, "you may…" for a possible drawback, a clear lean before a weakness is
  shown, no shame/diagnosis/jargon. Done in code: profile card Weakness + Try from the insight bank; deep-dive prompt v3
  (`deep_dive` library `l2`), Story prompt gets the same both-poles rule (`story` `l4`); pet check no longer bans ordinary
  words. **Waiting on:** emci's reading export, then flag flips, question-wording migration (ask), and ONE
  `gen:ai-library` + `supabase functions deploy ai-library --use-api` (ask). `check:ota-gate` is green except
  `check:ai-library` (stale bundle) until that regen. **Release order:** deploy `ai-library` and `ai-library-fill` right
  BEFORE the OTA that asks for `l2`/`l4`, never after (old function writes `l1`/`l3`, the new app would offer rewrites).
- 2026-10-19 (later): emci refocused the review on clarity, accuracy and honesty (`docs/copy-review-rules.md`), made the
  app **18+** and allowed **dark humor** (topic bans replaced by `JOKE_HARM_FILTER`). Agents applied every set
  (logs `docs/copy-review-agent/applied-*.md`): questions 61, insight bank 43, category bank 13, small sets 23, Story + deep
  dive 35, Legends 31 facts corrected against sources and 39 tags dropped. Not applied yet: `wave99_question_wording.sql`,
  `wave99b_min_age_18.sql`; `legend` library bumped to `l2`. Gate: green except `check:ai-library` (stale bundle). Open:
  emci's decision list in the chat (Legends tags, reused question ids, 16-17 testers, Daily Pick migration, swearing,
  team endings, Story samples, deploy).
- 2026-10-20: emci's follow-ups built (no deploy): everyday feeling words allowed everywhere, one shared diagnosis/label
  list (`src/lib/voice/clinical.ts`); 🎯 tasks judged by action and risk (free, solo, <15 min, safe); Legends re-audited
  (229 guessed tags removed, coverage quota became a warning, 3 trait sides empty); questions: 46 wording fixes, 15 scene
  changes HELD at their original text until emci approves a retire mechanism (attachment_avoidance_09, location sharing,
  is still live); Daily Pick p25 retired for new p65 (`wave99c`). New unapplied migrations: `wave99`, `wave99b`,
  `wave99c`, `wave99d` (library backstop vocabulary). Gate: green except `check:ai-library` (stale bundle).
- 2026-10-20 (PAUSED by emci, credits): nothing applied, deployed or committed. Built and parked on this branch:
  core content policy (`docs/copy-review-rules.md`, replaces earlier writing rules); under-18 block + Confirm-your-age
  + Delete option (`docs/under18-access.md`, previewed on synthetic fixtures); server 18+ gate `wave101` (110 guarded
  functions, `docs/under18-server.md`); question retire marker `wave100`/`wave100b` (19 questions retired);
  `wave99`/`99b`/`99c`/`99d`. NOT done: the policy audit of old prompts/checks (agent stopped at the usage limit; report is
  partial in `docs/copy-review-agent/policy-audit-2026-10-20.md` if written), the full gate re-run, the reviewer pass on the
  last round, `gen:ai-library` + deploy, any migration apply. emci's new asks (next chats, one per step): profile
  character set-up, scrub Sage and crisis leftovers, 18+ nights gate for missing/blank birthdays. Gate state is UNVERIFIED
  until re-run after all agents finish; treat every failure as unresolved.

### Step 1 status (M1-M4, S1, S2)

| Item | State | Evidence |
|---|---|---|
| M1 close `ai-generate` | **Code done, deploy pending.** `supabase/functions/ai-generate/index.ts` is a 410 stub (no vendor key, no prompt field). Live function still the old proxy until `supabase functions deploy ai-generate`. | `check:ai-provider` rewritten to pin the stub; nothing real depends on it (`ai-library` is the only model path; deep dive and Legends reach `ai-generate` only as an old-bundle fallback when `ai-library` answers "missing") |
| M2 rate limits | **SQL written, not applied.** `wave98_server_hardening.sql`: `rate_limit_hits` + `_rate_limit_check` (advisory lock, fixed window) used by `public_profile` (60 / 10 min per user or IP) and `handle_taken` (30 / 10 min). `password-login` (30 / 15 min per IP, 10 / 15 min per hashed identifier) and `dev-unlock` (5 / 15 min per account) call `rate_limit_hit` (service role). | `check:server-hardening`. **Accepted limits: see "Rate limits that cannot be counted" below** |
| M3 rotations, `play_dev_logs` | **emci to rotate** (steps below). `play_dev_logs` select policy + grants dropped in wave98 (not applied yet). | `check:server-hardening`; nothing reads the table in code |
| M4 advisors | **Run.** Findings below. | `supabase db advisors --linked --type all` |
| M4 `verify_jwt` / `getUser()` | **Done.** Table below. | `supabase functions list`; code read |
| M4 anon key | **Done.** `landing/index.html:110` decodes to role `anon` (the public key, fine to ship). `scripts/apple-endpoint-probe.ts:50` has no `role` claim and no project ref: not a Supabase key. | local decode, claims only |
| M4 baseline schema | **Done (reference).** `supabase/baseline/me_connections_public_profile.sql`, read from the live database 2026-10-19. Not a `pg_dump` (no Docker on this machine) and not a migration. | file + README |
| S1 timezone farming | **SQL written, not applied.** Reproduction test was refused by the sandbox; reasoning below. | wave98 |
| S2 Sentry scrubber | **Done.** `src/lib/sentry-scrub.ts`, wired as `beforeSend` / `beforeBreadcrumb`, 30 breadcrumbs. Ships with the next OTA. | `check:server-hardening` |

**Edge Functions (live, `supabase functions list`, 2026-10-19):**

| Function | gateway `verify_jwt` | In-code auth | Note |
|---|---|---|---|
| ai-generate | true | none needed (410 stub after deploy) | delete in step 9 |
| ai-library | true | `getUser()` | |
| ai-library-fill | false | `library_fill_token_ok` (Vault token) | by design (cron) |
| apple-link | true | `getUser()` | |
| delete-account | true | `getUser()` | |
| dev-unlock | true | `getUser()` | GOTCHAS line saying it has no JWT was stale, fixed |
| review-access | true | `getUser()` + `is_root` | |
| refresh-around | false | bearer secret compare | by design (cron) |
| password-login | false | none (pre-login) | throttled in wave98 |
| **mint-session-once** | true | **no source in the repo** | deployed v11, not in `supabase/functions/`. emci: what is it? Download or delete. |
| **apple-secrets-check** | true | **no source in the repo** | deployed v9, same question |

**Advisors (security + performance, 224 findings, nothing at ERROR level):**
- *Security WARN, `anon_security_definer_function_executable` x9:* `assert_invite_usable` (accepted until step 9: it returns true in public
  mode; invite codes are 40 random bits, so guessing is not practical; the QA override code gets rotated), `public_profile` (public by
  design for `/@handle`, now throttled), `handle_taken` (wave98 revokes anon), and `peer_profile`, `get_or_create_thread`,
  `delete_message_for_me`, `is_message_party`, `mirror_connection`, `unmirror_connection` (wave98 revokes anon; they already returned
  nothing without a user, this removes the surface).
- *Security WARN, `authenticated_security_definer_function_executable` x124:* **accepted.** The app talks to Postgres through RPCs, so
  signed-in users must reach them. Each function's own `auth.uid()` check was not re-audited here; step 3 re-checks the Circle ones.
- *Security WARN, `function_search_path_mutable` x7* (`recipe_from_account_id`, `trait_is_direct_source`, `_bank_premium_price`,
  `trait_ewma_step`, `daily_pick_position`, `_profile_code`, `_profile_changed`): **accepted for now.** Pure helpers, not `SECURITY DEFINER`.
  Fix is `alter function … set search_path = public`; left for step 6 because the trait functions are pinned by parity checks.
- *Security WARN, `auth_leaked_password_protection`:* **emci**: Supabase dashboard, Authentication, Password security, turn on "Prevent use of
  leaked passwords" if the plan allows it. Passwords are the secondary sign-in (the emailed code is primary).
- *Security INFO, `rls_enabled_no_policy` x17:* **accepted, deny-all on purpose** (RPC / service-role only): account_deletions, ai_library_cards,
  ai_library_fill_days, ai_library_fill_fails, ai_library_reports, ai_library_seen, ai_library_wanted, app_secrets, apple_credentials,
  circle_gifts, dev_access_grants, dev_trace_events, dev_trace_sessions, intake_questions, play_counters_daily, question_bank, trait_answer_changes.
- *Performance WARN, `auth_rls_initplan` x59:* **deferred (not security).** Policies call `auth.uid()` per row instead of `(select auth.uid())`.
  With 9 accounts it costs nothing; do it as one mechanical migration before real traffic (own step; alters existing policies, so ask).
- *Performance INFO:* 19 unindexed foreign keys, 6 unused indexes: deferred, same reason.

**New findings (not fixed in step 1; owner in brackets):**
- `public_profile` ignores `me.visible` although `src/lib/me.ts:675` and the wave64 comment say it is "visibility-filtered": a hidden account is still
  returned by handle to anyone, signed out. [step 3]
- `me_update_own` has no `with check`; the guard triggers cover `is_root`, tokens, invite, born_on, trait columns, but a signed-in user can update
  any other column of their own row directly (e.g. `is_founder`, `referred_by` are covered by `me_invite_guard`; `visible`, `recipe`, `facts` are not meant to be protected). [step 3 / wave80]
- `connections_insert_own` lets any signed-in user insert (self, anyone) and a trigger mirrors it: the consentless connect (M5). [step 3]
- `handle_taken` was anon-callable although wave64 says authenticated only (Supabase default privileges). Fixed in wave98.

**Rate limits that cannot be counted (accepted).** A Postgres function that raises an error rolls back its own counter row, so a throttle
inside `assert_invite_usable` or `complete_signup` would only ever count *successful* calls. Counting failed guesses there needs a status-returning
replacement, which old app bundles cannot read. Instead: the QA override code gets rotated to a long random value (below), invite codes are 40 random
bits, and step 9 sets `signup_mode = 'public'`, after which `assert_invite_usable` returns true before it reads anything. Sign-up e-mail / OTP floods are
limited by Supabase Auth itself (per-IP and per-address caps, 60 s resend wait): **emci: read the live numbers in the dashboard, Authentication,
Rate limits, and write them next to this line.**

**Client IP.** `_client_key()` reads `cf-connecting-ip`, then the first `x-forwarded-for` value from PostgREST's `request.headers`. Not yet proven on this
project (the probe was refused). If no address arrives, signed-out callers share one `noip` bucket with 20x the room, so a missing header can never lock
everyone out. Proof step after the apply: call `public_profile` with the anon key and read the `key` column of `rate_limit_hits` (should show `ip:…`, not `noip`).

**Timezone farming (S1), reasoning.** The check-in day comes from `me.timezone`, which a client could write freely (no guard, no validation against real zone names;
`me_update_own` allows it). A fake POSIX zone such as `XXX-100` puts "today" days ahead, so each flip claims a new future date: unbounded. Real zones span
UTC-12..+14, so a flip-and-claim gains at most about two days of lead. wave98 (a) stores only real zone names (an invalid value keeps the old one, no error), and (b) clamps
the check-in day to UTC +-1 inside `claim_daily_checkin`: claims by any moment are then at most "days elapsed + 2". A rolled-back reproduction (switch the dev-test user to `XXX-100` and claim, inside a transaction that is rolled back) was
refused by the sandbox; whoever applies wave98 can run it before and after. Box 59 only proves a normal check-in still pays once
(the app writes `timezone` just at onboarding and device sync, so the phone cannot show the old hole).

**Rotations emci must do (M3).** Values are never written in chat or in the repo.
1. QA invite code. Supabase dashboard, SQL editor. Either make it a long random value, or turn it off (recommended once signup is public):
   `update public.app_secrets set qa_override_invite_code = null where id = 1;`
2. Dev-test password. Dashboard, Authentication, Users, `ato-dev@example.com`, set a new long password; put the same value in `.env.local` as `ATO_LIVE_PASSWORD`
   (and `ATO_LIVE_EMAIL` stays `ato-dev@example.com`). The old one stays in git history, which is why it must change.
3. `DEV_UNLOCK_PASSWORD`. In a terminal: `supabase secrets set DEV_UNLOCK_PASSWORD=<new long value>` (no redeploy needed).
4. (Optional) leaked-password protection, see above.
Then tell me "rotated" and I (or the next chat) run `check:auth-password`, `check:invite`, `check:quota` once with the dev-test user.

**UPDATE 2026-10-19 (later): wave98 IS APPLIED to the live project** (emci ran `supabase db query --linked -f supabase/migrations/wave98_server_hardening.sql`, no error). Read-only check afterwards: `rate_limit_hits` exists, trigger `me_timezone_guard` exists, `public_profile` / `handle_taken` / `claim_daily_checkin` are volatile, the `play_dev_logs_select` policy is gone, `handle_taken` is executable by authenticated + service_role only. Still open: item 1 below is done; items 2-4 remain (function deploys, rotations + live checks, advisors re-run), plus the client-IP proof (`ip:` not `noip`) and the timezone reproduction.

**UPDATE 2026-10-19 (later still): the three function deploys are LIVE** (emci ran them with `--use-api`, because there is no Docker on this machine; without that flag the first attempt silently changed nothing). Confirmed from `supabase functions list`: `ai-generate` v12 to v13 (the open proxy is closed), `dev-unlock` v2 to v3, `password-login` v3 to v4 with `verify_jwt` still `false`. Use `--use-api` for every deploy from this machine. **Still open:** the three rotations, the live checks (`invite`, `quota`, `auth-password`), the client-IP proof (`ip:` not `noip`), the timezone reproduction, and the advisors re-run.

**PROOFS 2026-10-19 (after the rotations, all run against the live project):**
- `check:invite` 7/7 and `check:quota` 6/6 pass (signed-out probes, public key only; the invite check still sees `invite_only`).
- `password-login` throttle: 12 wrong tries on a throw-away identifier gave `401` x10, then `429` on the 11th and 12th; a wrong password on the dev-test handle gives the normal generic `invalid_credentials`, no email in the body.
- Client address: the `public_profile` bucket recorded an `ip:` key (not `noip`), so PostgREST does pass `cf-connecting-ip`; `password-login` keys on a real address too. Signed-out `handle_taken` now answers `401`; signed-out `public_profile` still answers `200`.
- Timezone: inside a rolled-back transaction as the dev-test user, five zones (Denver, Kiritimati, Pago_Pago, `XXX-100`, `XXX-200`) claimed only two days (2026-10-19 and 2026-10-20 with the UTC day 2026-10-19). The two fake zones were refused and added nothing. Nothing was saved. (The "before" run was not possible: the SQL was already applied.)
- Advisors re-run (security, WARN and up): `anon_security_definer_function_executable` **9 to 2** (`assert_invite_usable`, `public_profile`, both accepted above); authenticated-executable 124 to 122; 7 mutable search_path and the leaked-password toggle unchanged (accepted / emci). No new findings.
- **Not run:** the good dev-test password sign-in (`ATO_LIVE_PASSWORD` was not found in `.env.local` by name, so the proof script skipped it; emci to check where the new value lives), and `check:auth-password` as written (see next line).
- **Found:** `scripts/auth-password-check.ts` is stale and cannot run: line 62 still asserts a `PasswordSettingsFold` on the You screen that no longer exists, and its live half signs in as the review account `@riley` (`ATO_REVIEW_PASSWORD`), not the dev-test user. Not changed in step 1; fix it (and point it at the dev-test user) before relying on it.

**What still has to be done by hand for step 1 to close** (all need a live write, which the sandbox refused; each one is a single command):
1. `supabase db query --linked -f supabase/migrations/wave98_server_hardening.sql`
2. Three deploys, one command each: `supabase functions deploy ai-generate`, `supabase functions deploy dev-unlock`, and
   `supabase functions deploy password-login --no-verify-jwt` (its gateway setting is `false` live because it runs before login; deploying it
   without the flag would turn the check on and break password sign-in).
3. The rotations above, then the live checks `check:invite`, `check:quota`, `check:auth-password` (dev-test user only).
4. Re-run `supabase db advisors --linked --type security --level warn` and paste the delta here.

## Research sources

[Apple 5.1.1(v)](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/) ·
[Apple 5.1.2 news](https://developer.apple.com/news/?id=ey6d8onl) ·
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) ·
[FTC HBNR](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0) ·
[Finch](https://apps.apple.com/us/app/finch-self-care-pet/id1528595748) ·
[Daylio privacy](https://daylio.net/faq/privacy-policy/) ·
[Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) ·
[Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits)
