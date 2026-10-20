# ATO master plan (the one list: nothing lives only in chat)

Written 2026-10-20 (emci paused the work to stop credit burn). This file is the source of truth for ORDER, RULES, DECISIONS
and PARKED WORK. `PROJECT_CONTEXT.md` is the project memory; `docs/ato-finish-roadmap.md` has the original findings;
`docs/copy-review-rules.md` is the content policy. If chat and this file disagree, this file wins.

## How to run it (one step per chat)

Paste the same one-line prompt every time (Model line from the step):

```
Repo emci-hub/ATO, branch feature/ato-copy-review. Read docs/master-plan.md and do the step marked ▶ (or Step N).
Follow "Rules of the road". Plan first (short), wait for my OK, then build. When done: tick the step's checklist,
move ▶ to the next step, update the ledgers, and end with assessment → next → handoff.
```

A step is done only when its checklist is ticked in THIS file. The chat then ends. The next chat starts from the file, not
from memory.

## Rules of the road (anti-loop, anti-burn)

1. **One step per chat.** Don't start the next step in the same chat.
2. **Read little:** PROJECT_CONTEXT.md, this file, and only the docs the step lists. No "read everything" briefs.
3. **Plan first, ≤15 lines:** what, which files, which model, which agents, what needs my OK. Wait.
4. **Agents:** at most 2 at a time. Each gets a ≤1-page brief: the files it OWNS, the done-criteria, "do not touch" list.
   Two agents never own the same file. Reads/searches: investigator (Sonnet). Builds: Sonnet. Opus only for: design
   decisions, copying core SQL functions, and the one final reviewer pass. Agents report in ≤30 lines; the lead writes the
   result into this file, never pastes whole reports.
5. **Attempts:** two tries per problem, the second with a new hypothesis. Then the architect agent once. Then STOP and ask me
   one question. No retry loops.
6. **Checks:** run the targeted check while building; run `check:ota-gate` ONCE at the end of the step. A failure is
   unresolved until its own check passes. Never weaken a check; rewrite it to the new rule with pass/fail pairs.
7. **One reviewer pass per step** (Opus, read-only). Fix its criticals; list its warnings.
8. **Ask first, always:** applying any migration, `gen:ai-library` + `supabase functions deploy`, publishing an OTA, any
   merge, any commit/push unless I say so, anything touching auth/secrets/dependencies/env, anything that deletes or alters
   existing data, new kinds of database pattern. Copying a tested path = build it and report it.
9. **Never re-ask a settled decision** (ledger below). Put new decisions in "Open decisions" with a recommendation.
10. **Play/Divecore and app files go in separate commits** (`check:play-isolation`).
11. **Handoff at the end of every chat:** 3–5 line assessment, the next step, anything I must do first.

## Status board

Legend: [x] done · ▶ next · [ ] not started · [P] parked (built, waiting on my approval)

| # | Step | Model | Status |
|---|---|---|---|
| 0 | Save the work: group the uncommitted tree into logical commits on this branch (I say "commit") | Sonnet 5 | [x] 2026-10-20: 5 commits (9fdc1e92 18+, ab9ee5f7 questions, 8f786578 policy/rules, c16812f7 content fixes, 6f923c7d tooling+reports), nothing pushed |
| 1 | Profile character after the first group of questions | Sonnet 5 (Opus only if the design is contested) | [x] 2026-10-20: built, UNCOMMITTED (see checklist); phone/browser render not verified |
| 2 | 18+ nights gate for missing/blank/invalid birthdays (client + server) | Sonnet 5 | [x] 2026-10-20: built, UNCOMMITTED (see checklist); wave102 NOT applied |
| 3 | Scrub Sage and crisis everywhere + update Terms of Service and the other legal text | Sonnet 5 | [x] 2026-10-20: built, UNCOMMITTED (see checklist); wave103 NOT applied |
| 4 | Finish the content review: policy audit (rest), flags, Box 60 | Sonnet 5 + one Opus reviewer | [x] 2026-10-20: built, UNCOMMITTED (see checklist); bundle + wave99d NOT applied; flags unchanged |
| 5 | Full gate, fix every failure with evidence, reviewer pass | Sonnet 5 + Opus reviewer | [x] 2026-10-20: gate = only the 2 expected failures; reviewer PASS (Step 2); D8 checked; nothing changed in code |
| 6 | RELEASE A (needs my approvals, in order): OTA → migrations → bundle regen + deploy → phone check | Sonnet 5 | ▶ (first: commit split incl. Play files on their own, then `gen:ai-library`; rotate the Gemini key) |
| 7 | Roadmap step 3: Circle safety (accept, block/report, filters) | Opus 5 | [ ] |
| 8 | Roadmap step 4: notifications + accessibility (+ the web date-row overflow fix) | Sonnet 5 | [ ] |
| 9 | Roadmap steps 5 + 6: insight/Home polish, AI cleanup (retire `_library_crisis`, dead callers) | Sonnet 5 | [ ] |
| 10 | Roadmap step 7: privacy policy, labels, deletion proof (builds on step 3's legal pass) | Opus 5 | [ ] |
| 11 | Roadmap step 8: device boxes rewrite + one full phone pass (Box 66) | Sonnet 5 | [ ] |
| 12 | Roadmap step 9: launch flip (PRE_LAUNCH_DEV=false, hero clean-slate, wave80, public signup) | Opus 5 | [ ] |
| 13 | Roadmap step 10: production build + store submission | Sonnet 5 | [ ] |

### Step checklists (done-criteria)

**0.** [x] commits grouped (content/questions, age+under-18 client, server migration FILES, rules/voice, tooling+docs; Play files
separate: none changed) [x] nothing pushed. Left uncommitted on purpose: `.claude/agent-memory/**`.
**1.** [x] investigation (no standalone old character; the collectible ProfileCard with 8 shared Divecore heroes, shown only after
set 25) [x] plan approved by me (after the 48 = sets 1–3; 8 shared heroes + per-user name/accents; text-only evolve) [x] shows
after the 48, 16 stats at honest confidence (<3 answers = empty bar, "Still early"), name from answers ("Still forming" until all 9
type axes are settled), "could grow into" only from near-line type axes (±0.08) worded "If … tips" — closeness to the line, NOT a
trend (tracks hold no history) [x] no invented stats; weakness via `cardStrengthWeakness` ("You may…", lean ≥0.15) [x] public
line = `characterPublicLine` (strength only, skips private leans; the in-app card still shows weakness) [~] synthetic previews are in
`/profile-card-lab` (3 users) but the web render is NOT verified: Metro crashed twice with EMFILE (Windows file-handle limit) —
look at it on the phone/lab [x] `check:profile-history` (9 pass), typecheck, eslint, Opus reviewer = PASS (4 warnings fixed)
[x] `PROFILE_CARD_COPY_REVIEWED` stays false until emci reads the render. Files: `src/lib/profile-character.ts`,
`src/components/profile-character.tsx`, `questions-fold.tsx`, `profile-card.tsx` (HERO_ART exported), `profile-card-lab.tsx`,
`scripts/profile-history-check.ts`. Not committed (waiting for "commit").
**2.** [x] read-only finding: null/blank/malformed `born_on` was already fail-closed in SQL (`is_at_least_age(null)` = false; the
column is a `date`) and in `ageGateFor`/around-lab; the real holes were (a) `set_going` only tested age when the caller-supplied
`p_ages` looked like "18+", so null/''/"All Ages" skipped it (open in the DB today), and (b) client `isAtLeastAge` /
`signupAgeMessage` didn't validate the date (`signupAgeMessage('2000-13-45')` returned null = allowed) [x] every 18+ gate listed in
`docs/under18-server.md` "Nights (18+) gate" [x] blank/malformed/future/17y364d refused, exactly 18 allowed; around-lab shows
"Confirm your age first" for a missing birthday [x] server fix = NEW unapplied `wave102_nights_18_gate.sql` (`set_going`, copy of
wave101's + an age test that ignores `p_ages`; applies AFTER wave101) [x] paired tests in `scripts/age-check.ts` (31 pass) [x] fits
the wave101 order (item 7) [x] `check:under18-server` (6 pass; wave102 added to `NOT_LIVE` there), typecheck. Files:
`src/lib/age.ts`, `src/app/around-lab.tsx`, `scripts/age-check.ts`, `scripts/under18-server-check.ts`, `docs/under18-server.md`,
`supabase/migrations/wave102_nights_18_gate.sql`. [ ] full gate + Opus reviewer run in Step 5 (not run here).
Not verified: wave102 against a real database (no SQL run; apply is step 6, my OK).
**3.** [x] inventory + counts shown, plan approved [x] user-visible Sage/crisis copy removed (widget header now "ATO", credits line,
`EXPLORE_EMPTY_PAUSED`); dead code deleted: `sage.txt` (content moved to `voice-reference.txt`, generator + `content.generated.ts`
regenerated without `SAGE_VOICE`), `gen-sage-icon.ts`, `sage-mask.png`, every client `crisis_flags`/`crisis_since` read. KEPT on
purpose: `src/app/sage.tsx` (1-line redirect to /insights for old links, pinned by `check:tab-rename`; drop at the launch flip) and
the internal `sage-*` module names (~40 importers, invisible; deferred to Step 9) [x] static HelplineRow untouched [x] tests
rewritten, none weakened (floor/push/preview-mode/jargon/reset-account/no-sage-copy tightened; new `check:no-crisis-reads`)
[x] `wave103_drop_crisis_plumbing.sql` = UNAPPLIED (one transaction; renames `_library_crisis` → `_library_paused`, drops
`crisis_since`, drops table `crisis_flags` = deletes tester rows; apply after wave102; in `NOT_LIVE`; not run against Postgres)
[x] Terms, Privacy Policy, privacy labels, `landing/*.html` rewritten from the DRAFTs (no Sage/crisis logging, 18+, real AI uses,
Divecore save, delete scope read from `delete-account`); "Reset account" deliberately NOT promised (root-only, pre-launch) [x]
`docs/legal/OPEN-QUESTIONS.md` = 18 items only I/a lawyer can answer, opens "This is not legal advice"; 47 `[CONFIRM]` tags remain
in the legal text (AI vendor + no-training terms, retention, entity, governing law, email form, Sentry/Resend, launch wording) [x]
Opus reviewer: FAIL on one legal-accuracy item (Reset account) → fixed, plus 3 warnings fixed; open warning: `ai-library-check`
still names `_library_crisis` in wave93/94 (describes past state, passes). Not verified: wave103 SQL on a real DB; widget text needs
a native build; `check:ota-gate` was run by the builder (2 expected failures: stale ai-library bundle; `play-isolation` because
`src/play/credits.ts` must be its own commit). Re-run the gate in Step 5. Play file for its own commit: `src/play/credits.ts`.
Also decide (OPEN-QUESTIONS 10): `OtherUsageData` in PrivacyInfo/app.json/labels was justified by `crisis_flags`.
**4.** [x] policy audit finished: ~35 rules/lists audited (22 KEEP, 8 CONFLICT, 5 UNCLEAR) and every conflict fixed with PAIRED
tests; kept filters were verified with real pass/fail examples, not trusted by name (`check:filter-behavior`: found + fixed 3
real bugs: drunk-driving mentions blocked/encouragement missed, "Donate your old jacket" refused, two risky tasks missed)
[x] D6 settled (emci, B): framework names allowed when relevant, accurate, explained; never a diagnosis, never an implied
validated assessment, never a type code as ATO's own result; trademark handled narrowly. New checks: `framework-fence`,
`label-context`, `filter-behavior`, `style-rules`. Label classes (discussion / quotation / figurative / behavior / verdict):
the code tells discussion, behavior and common verdict phrasings apart; known gaps: a bare name as subject ("Dave is a
narcissist"), "sounds like ADHD", a claim split across two sentences, "She called you a narcissist" (untested), a speaker verb
inside a joke [x] style bans ("boundar*", "you are", "should", "maybe", "try to", CRUEL_PHRASES, phone-detail ban, pet "bet")
replaced by contextual rules; honest uncertainty allowed in observations, vague filler refused only in Do tasks [x] live
instruction docs updated (CLAUDE.md, DATA_AI_MAP, GOTCHAS, deep-dive review; the deep-dive "gentle block" is removed);
historical docs untouched [x] read list: `docs/copy-review-agent/step4-read-list.md` [x] flags: NONE flipped, no new gating
code (false still shows the surface; hiding it would be a new pattern) [x] Box 60 drafted at the end of `docs/ATO_DEVICE_TESTS.md`
[x] Opus reviewer FAIL on 1 critical (drunk-driving filter passed encouragement) + 4 weakened filters → all fixed with pairs;
open known gaps listed above. [x] full gate run once: exactly 2 failures — `ai-library` (stale bundle, expected) and
`play-isolation` (Play + app files in one tree: commit `src/play/**`, `scripts/check-pet-talk` + circle-visits, daily-visitors,
pet-knows-you, dive-fx, and `src/play/credits.ts` on their own). Nothing committed/applied/deployed.
LIVE-SERVER GAP (unchanged until Step 6): the deployed `ai-library` bundle still has the OLD fence (drops "anxious", "secure",
"avoidant") and the DB backstop is still the wave93 keyword filter (drops "anxious", "therapy", any swearing, "insecure"). Local
fixes do NOT protect or relax the live server. Needs: `gen:ai-library` (+ bump LIBRARY_VERSION: dive, story-card, legend
story, directive-advice, moment-voice, fence/jargon/clinical changed) + deploy `ai-library` and `ai-library-fill`, and `wave99d`.
Untouched on purpose: `sage-title.ts` (live components import it; its prompt line 214 says "No framework names. No clinical
words." and `explore/prompt.ts:192` says "No framework names" — both still say the OLD rule: update in Step 9) and
`docs/daily-insights/README.md:29`.
**5.** [x] `check:ota-gate` once (log kept only in scratchpad): exactly 2 failures, both traced: `ai-library` = stale bundle
(fixed by `gen:ai-library` + deploy, Step 6); `play-isolation` = `src/play/credits.ts` + `src/play/pet-talk.ts` mixed with app
files (fixed by committing Play files on their own; asked-before-commit rule still holds) [x] lint 0 errors / 35 warnings (not
touched), typecheck clean [x] reviewer pass (Opus, Step 2 only; see Review ledger): PASS, no criticals. Warnings, none fixed:
(a) `age-check.ts:401` `exact18` via `shiftYears` breaks only on 29 Feb (test wrong that day, not the gate); (b) live check
`around-going-live-check.ts` needs a seeded account with an 18+ birthday once wave102 is applied; (c) server UTC date vs phone
local date differs for a few hours on an 18th birthday (server fails closed, documented); (d) wave102 has no begin/commit (harmless)
[x] D8: `.env.local` gitignored and untracked; no `EXPO_PUBLIC_*` secret read in `src/`/app config (only Supabase URL + anon key,
provider flags, site URL, Sentry DSN); harness blocked reading `.env.local`, so its key NAMES are unverified — and git history
shows a client Gemini key path before `c9bb71f2`, so builds/OTAs older than that may have carried it → rotate it (emci).
**6.** [ ] I approve each of: OTA; each migration in the order below; `gen:ai-library` + deploy [ ] pre-apply read-only SQL run
(stale-copy md5, counts, root/dev/review accounts have an 18+ birthday) [ ] post-apply SQL + security advisors [ ] phone check.

## Review ledger (a reviewer skips anything listed here unless those files changed afterward)

| Step | Scope | Verdict | Open warnings |
|---|---|---|---|
| 1 | profile character files (`profile-character.ts/.tsx`, `questions-fold.tsx`, `profile-card.tsx`, lab, `profile-history-check.ts`) | PASS (Opus) | 4 fixed |
| 2 | `age.ts`, `around-lab.tsx`, `age-check.ts`, `under18-server-check.ts`, `wave102` | PASS (Opus, Step 5) | Feb-29 test, live-check seed, UTC vs local, no begin/commit (see Step 5) |
| 3 | Sage/crisis scrub, legal text, `wave103` | FAIL → fixed (Opus) | `ai-library-check` still names `_library_crisis` in wave93/94 (describes past state) |
| 4 | content-policy audit, filters, new checks | FAIL → fixed (Opus) | known label gaps listed in Step 4 |
| 5 | no code changes | n/a | none |

## Ledger A: settled decisions (never re-ask)

- Content policy: `docs/copy-review-rules.md` (clarity, accuracy, honesty, adult humor; judge meaning not keywords; supported
  weaknesses allowed; strong swearing allowed; labels only blocked when pinned on the reader; tasks by action/consent/cost/
  time/safety; questions never score privacy/safety/financial boundaries; sourced facts, no invented Legends tags).
- App is 18+. Existing under-18 testers: non-destructive block, automatic return at 18, Delete my account stays available,
  server-side enforcement (wave101). Missing birthday = Confirm-your-age flow, not silent access. 18+ nights need a valid
  18+ birthday.
- Question changes: scenario change = retire the old id (kept forever) + a new id (retire marker approved).
- Team endings "Spirit"/"Camp" fine. Approved Story samples stay unless a concrete clarity/accuracy problem.
- Profile weaknesses: Strengths/Weaknesses labels stay; "you may…" and only for a clear lean; one practical step.
- No Sage in the app; crisis system gone (static helpline row stays).
- Framework fence (D6): names of psychology frameworks/theories are allowed when relevant, accurate and explained; never a
  diagnosis, never an implied validated assessment, never a type code as ATO's own result. Labels are judged in context for
  everyone (discussion, quotation, figurative, behavior vs a verdict on a real or addressed person). Style rules are contextual
  guidance, not blanket word bans; honest uncertainty is allowed.
- Public signup, no invite gate (launch flip). One chat per step. Plan + model per step.

## Ledger B: parked, built but NOT applied (nothing deployed)

Migrations, apply order (full detail in `docs/under18-server.md` and `docs/copy-review-agent/applied-set2-questions.md`):
1. App update (OTA) first: block + Confirm-your-age + retired-question handling + new question/pick ids.
2. `wave99b_min_age_18` (sign-up and birthday guard 18) · 3. `wave99` (46 question wordings) · `wave99c` (Daily Pick p65) ·
`wave99d` (library backstop vocabulary) · 4. `wave100` then `wave100b` (question retire marker + 19 retired/new) ·
5. set an 18+ birthday on root, dev-test and review/Apple-demo accounts · 6. `wave101` (under-18 server gate, 110 guarded
functions) after the OTA is on phones · 7. `wave102_nights_18_gate` (set_going ignores `p_ages`) right after wave101 · 8. `wave103_drop_crisis_plumbing` (drops
`crisis_flags` rows, `crisis_since`, renames `_library_crisis`) right after wave102 — needs my explicit OK (deletes tester rows).
Bundle: `LIBRARY_VERSION` deep_dive l2, story l4, legend l2 → `gen:ai-library` + deploy `ai-library` and `ai-library-fill`
BEFORE the OTA that asks for them. `check:ai-library` fails only on the stale bundle until then.
Flags still false: INSIGHT_BANK, CATEGORY_BANK, DAILY_PICK, BANK (questions), STAGED_INTAKE, POLISH, PROFILE_CARD, TEAM,
CATEGORY_DEEP_DIVE, LEGEND_FIGURES, STORY, STORY_BANK (+ dead: TITLE, CATEGORY_READ, DAILY_INSIGHT, CATEGORY_STATEMENTS).

## Ledger C: open decisions (answer once, with my recommendation)

| # | Question | Recommendation |
|---|---|---|
| D1 | Retired questions in Change answers: read-only, or re-answerable? | read-only |
| D2 | Retire `attachment_avoidance_23` (houseguest, "I suggest a hotel")? | keep |
| D3 | wave101 leaves reads of the caller's own rows open (no cost, no other person's data). Accept? | accept |
| D4 | Per-function gate (built) vs one central request hook (new pattern)? | keep the per-function gate |
| D5 | Legends: three trait sides have no legend, many thin. Accept warnings, add sourced legends later? | accept, add later |
| D6 | SETTLED 2026-10-20 (emci: option B): framework names allowed when relevant, accurate, explained; no diagnosis, no implied validated assessment, no type code as ATO's result | moved to Ledger A |
| D7 | Story sample reveal "you always beat the clock" (overclaims): fix? | leave unless you want it |
| D8 | `.env.local` exports an `EXPO_PUBLIC_GEMINI_API_KEY`: anything `EXPO_PUBLIC_` can ship in the bundle. Check and rotate. | CHECKED in step 5: current code does not read it, file is gitignored. Still ROTATE it (old builds may have shipped it) and delete the line from `.env.local` (emci does both; I never touch secrets) |
| D9 | Apple-demo/review accounts need an 18+ birthday before wave101 | set before step 6 |
| D10 | Web date row overflows at 375 px (`born-on-fields.tsx`); native not run | fix in step 8 |

## Original roadmap steps still ahead

Steps 3–10 of `docs/ato-finish-roadmap.md` are rows 7–13 above (Circle safety; notifications + a11y; insight polish; AI
cleanup; legal/privacy/deletion; device boxes; launch flip; production build). Their findings and prompts stay in that file.
