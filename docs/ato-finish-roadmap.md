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
- Age: 16+ at signup from a self-declared birthday (`age.ts:76-77`).
- NOW.md lines 66/74 still describe Circle compare as live (stale).

### 5. You tab, sign-up, onboarding, notifications, widget
- **First run:** blank until session/me/fonts, then auth → onboarding (one form: code if invite-only, birthday 16+, name,
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
  Steps 2-10 not started.

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
