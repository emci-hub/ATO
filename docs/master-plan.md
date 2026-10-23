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
| 6 | RELEASE A (needs my approvals, in order): OTA → migrations → bundle regen + deploy → phone check | Sonnet 5 | [x] 2026-10-20: all applied + published (see checklist). Advisors run 2026-10-20 (0 errors, see Step 6); phone check passed (emci: "nothing wrong") |

Order re-sorted 2026-10-20 (emci OK): leak closed server-side first; steps 7–10 ship as ONE app update (Release B) followed by
one phone pass; 8 + 9 run as one chat. Rows are in run order; numbers kept so old references still work.

| # | Step | Model | Status |
|---|---|---|---|
| 7 | Roadmap step 3: Circle safety = Circle option A (accept, block/report, filters, visits) + data shape for B/C + advisor fixes (`docs/circle-design.md`). Apply `wave104` as soon as it is built (closes the live peer-read leak, server only); app side waits for Release B | Opus 5 | [x] 2026-10-20: built; wave104 + wave104b APPLIED by emci; app side UNCOMMITTED, ships in Release B (see checklist) |
| 7b | Circle option B: per-friend opt-in compare, shareable strengths only, consent copy names what friends see. No OTA (Release B) | Sonnet 5 (Opus reviewer) | [x] 2026-10-20: built; `wave105` APPLIED by emci 2026-10-20 (in Step 10, before wave106); UNCOMMITTED (see checklist) |
| 8+9 | ONE chat: roadmap 4 (notification ask + accessibility + D10 date-row fix) and roadmap 5+6 (insight/Home polish, AI cleanup, dead callers, `sage-*` renames, the old "No framework names" prompt lines in `sage-title.ts:214` + `explore/prompt.ts:192`). No OTA (Release B) | Sonnet 5 | [x] 2026-10-20: built, UNCOMMITTED (see checklist) |
| 10 | Roadmap step 7: privacy policy, labels, deletion proof; describes Circle A+B as built. No OTA (Release B) | Opus 5 | [x] 2026-10-20: built; `wave105` + `wave106` APPLIED by emci; UNCOMMITTED (see checklist) |
| RB | RELEASE B: pull, gate, ONE OTA for 7–10 + their migrations + one `gen:ai-library`/deploy if prompts changed (each needs my OK) | Sonnet 5 | [x] 2026-10-20: 4 commits pushed (9f1fc02c Play, 2ea66d4f migrations, 39a6de47 app, e02916b5 docs/checks/legal); gate fully green (189 checks); no bundle regen needed; OTA published, production group `b9c891db-5587-46c0-bef4-2b1ddadd5d06` (iOS `01a15bd8-13f4-7714-9027-8504894d9915`, Android `01a15bd8-13f4-757c-9a5e-7f6b299c6349`), git e02916b5. Phone not checked |
| 11 | Roadmap step 8: device boxes rewrite + one full phone pass (Box 66) covering Release B (Boxes 60-65) | Sonnet 5 | [x] 2026-10-20: Box 66 written (pre-step + Parts A-G + results table); phone pass run by emci 2026-10-20: A-G all pass, no fixes |
| 12 | Roadmap step 9: launch flip (PRE_LAUNCH_DEV=false, hero clean-slate, wave80, public signup) + Supabase Auth "Leaked password protection" switch (emci, dashboard) | Opus 5 | [x] 2026-10-21: half (a) built, reviewed, pushed (5b6abd8b app, c690636c Play) and OTA PUBLISHED: production group `6307ece1-85fc-4e59-bc1f-7bb651356744` (iOS `01a15c5e-2147-7f25-8a2a-a256206dc68e`, Android `01a15c5e-2147-7300-818b-f3285e680f5d`), runtime 1.0.0, git c690636c. Half (b) by emci: rotations, wave80 + wave107 APPLIED, leaked-password switch, Box 67 passed; SQL verified read-only 2026-10-21 (see checklist) |
| 13 | Roadmap step 10: production build + store submission | Sonnet 5 | [x] 2026-10-21: prep done (checklist, gates, ASC pack, reviewer, Box 68); NOT yet done by emci: D12, demo account, EAS build, TestFlight, Box 68 (see Step 13 checklist) |
| 14 | Circle option C (LAST, emci 2026-10-20): end-to-end encrypted 1:1 chat (Signal-style: libsodium keys per phone, reporter's phone sends reported messages, on-phone filter, block reuses step 7). Needs: new native dependency OK, a new store build (not OTA), encryption export answer, emci owns daily report triage. Brief: `docs/circle-design.md` | Opus 5 | [x] 2026-10-21: built, committed on `feature/circle-chat` (d0bcd6c2 Play + app commit), NOT pushed; 1.0 tagged `v1.0.0` = 6af79d2f; `wave108` NOT applied; no build; reviewer FAIL → fixed (see checklist) |
| 15 | RELEASE C (after 1.0 is submitted from tag `v1.0.0`): push + merge `feature/circle-chat`, apply `wave108`, EAS 1.1 build → TestFlight → Box 69 → submit 1.1 with `app-store-pack.md` §9 | Sonnet 5 | [x] 2026-10-21: gate green (191); PR #81 merged (master f2fd6b0f); `wave108` + `wave109` (D18) APPLIED by emci and verified read-only (`docs/release-c-verify.sql`, 8/8 true); 1.1 build on TestFlight; Box 69 A-E all pass (emci). emci still does in ASC: the `app-store-pack.md` §9 changes + submit 1.1 (+ D12 lawyer read on encryption export). 2026-10-21: 1.1 SUBMITTED by emci with `eas submit` (submission `9cc1261b-6b4f-4d9a-b6fd-f78541e8e0f4`); awaiting App Review. 2026-10-21: emci says 1.1 is complete |

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
**6.** [x] commits: `562370f2` (Play files alone), `45d51505` (steps 1-5), `3ebdfe7a` (regenerated bundle); pushed to
origin/feature/ato-copy-review after the first two (the bundle commit is NOT pushed yet) [x] `gen:ai-library`: versions were
already bumped in `8f786578` (deep_dive l2, story l4, legend l2, never deployed before), so no new bump; `check:ai-library` 14 pass
[x] pre-apply SQL: 9 accounts, 0 under 18, 0 no birthday; root `lazyemci`, `atodev`, `atodev2` adult; no `riley` row (D9 closed:
nothing to fix). Stale-copy md5 flagged 26 DIFFERENT, but it was formatting only (live bodies have blank lines/comments
stripped); a whitespace- and comment-insensitive check showed `same logic` for 23 and a real difference only for the 3 wave100
functions (expected, not applied then). No hand edits found [x] DEPLOYED `ai-library` + `ai-library-fill` (project
`aijzsmupaaaxjctfgwpl`) BEFORE the OTA, so phones asking for l2/l4/l2 find a matching server [x] OTA published to production:
group `891dca00-f86d-4500-b2d4-b607fdc7ae46`, iOS `01a15b12-cd42-72fd-9159-7d6011d852cf`, Android `01a15b12-cd42-7e21-86fc-c97d265ed137`,
runtime 1.0.0, built from `3ebdfe7a` (gate green; ota:publish refuses otherwise) [x] migrations applied by emci in the SQL editor,
in order: wave99b, wave99, wave99c, wave99d, wave100, wave100b, wave101, wave102, wave103 (emci OK'd wave103, which deleted the
`crisis_flags` rows). Verified: question_bank 19 retired / 400 active / every axis 25 active; 110 guarded functions, 2 triggers,
`is_adult(uuid)` not client-callable; `set_going` has guard + age test; only the 21 expected functions stay unguarded (19 left-open
+ `is_adult()` + `require_adult()`); `crisis_flags` and `_library_crisis` gone, `_library_paused` present, `home_bootstrap` without
`crisis_since` [x] security advisors run 2026-10-20: 0 errors; 137 warnings = 124 signed-in SECURITY DEFINER RPCs (by design, guarded),
2 anon RPCs by design (`assert_invite_usable`, `public_profile`, rate-limited), 2 always-true inserts by design
(`access_requests` landing form, `play_dev_logs`), 7 functions without `search_path` + `around` bucket listing (fixed in
wave104, Step 7), leaked-password protection off (Step 12) [x] phone check passed 2026-10-20 (emci: nothing wrong). Not verified: Box 60, an
under-18 block screen on a device (an under-18 account cannot be made through sign-up), the app against the changed server. Pre-existing
trap: wave101's `set_going` copy was later restated by wave102 (fine). Gemini key: emci said rotated.

**7.** [x] research: `docs/circle-design.md` (option A at launch; B after, opt-in per friend, strengths only; C = Step 14, encrypted)
[x] `wave104_circle_safety.sql` APPLIED (9 functions present, emci) + `wave104b_circle_safety_fixes.sql` APPLIED: requests with accept
(cap 20 friends / 20 pending / 20 asks per hour), `connections_insert_own` dropped, block (silent, drops friendship + pending),
report (6 fixed reasons, rate-limited, survives deletion: FKs set null, handle kept), blocked pair refused in share / status /
visit switch / thread / handle lookup, `peer_profile` + `peer_checks` return nothing (closed until 7b), name/handle filter
(slurs + staff names; swearing allowed), advisor fixes (7 search_path, `around` bucket listing) [x] app: ⋯ → Report / Block /
Remove on every friend row (2 taps to reach), Add by handle, Requests, Blocked, support line, in the Divecore Circle sheet
(`src/play/circle-visits-*.ts(x)`, `src/lib/circle.ts`); name filter on sign-up (`src/lib/name-filter.ts`, `me.ts`,
`onboarding.tsx`) [x] `check:circle-safety` (6 groups, pass/fail pairs), `check:circle-visits`, `under18-server`, `reset-account`
updated, none weakened [x] docs: `docs/circle-safety.md` (triage query, blocked-pair test), Box 61, NOW.md [x] gate run once:
3 failures, all traced and fixed (2 check lists, 1 expected `play-isolation`: commit `src/play/**` on its own) [x] Opus reviewer
PASS, no criticals; warnings fixed in wave104b except: (a) a hand-crafted API call can still see a block exists (accepted,
revisit in Step 14), (b) old apps already on phones get a raw error on add-by-scan until Release B, and no Requests screen,
(c) ~40 new `CIRCLE_UI` lines need emci's read (Box 61), `CIRCLE_VISITS_COPY_REVIEWED` is only a marker. Pending: blocked-pair
test result from emci (SQL on his clipboard, `docs/circle-safety.md`); commit (Play files alone) + push; phone Box 61 (Release B).
Not verified: the app screens on a device (typecheck/lint/offline checks only).

**7b.** [x] plan approved by me [x] `wave105_circle_compare.sql` = NEW, UNAPPLIED (copies wave97 `circle_visit_share` + wave104 `set_circle_visit_share` /
`circle_visit_allowed`): table `circle_compare_share` (off by default, RLS select-own, written only by the function), `set_circle_compare_share`,
`circle_compare_allowed` (accepted friend, not blocked, BOTH switches, each set since the friendship began), `circle_compare_friends` (my switches + a
preview of what a friend would see of me), `circle_compare` (keys only: `shared` ≤ 6 and `theirs` ≤ 3), internal `_compare_strengths` (report track,
3+ answers, lean ≥ 0.15). Private: both attachment axes, the LOW side of steadiness / competence / self_efficacy / growth_mindset / locus_of_control,
and (stricter than `isShareableLean`, my OK in the plan) the LOW side of both conflict axes. `peer_profile` / `peer_checks` stay closed [x] app: ⋯ →
"Compare strengths" panel in the Circle sheet (consent text, preview of what the friend sees, switch, waiting line, card "What you two share" +
"@x tends to…"), fixed phrases per key in `src/play/circle-compare.ts` (21 keys, a key outside the table is dropped), store
`circle-compare-store.ts`, UI in `circle-visits-ui.tsx` [x] `check:circle-compare` (8 groups, pass/fail pairs, SQL private list == TS list, never looser
than `isShareableLean`), `under18-server` (wave105 in `NOT_LIVE`), `reset-account` (`circle_compare_share` on KEEP like `category_share`: a choice about
a friend, the strengths come from `trait_tracks`, which Reset wipes; the dev reset and `count_user_rows` were not extended) [x] docs: Box 62
(`docs/ATO_DEVICE_TESTS.md`), compare test in `docs/circle-safety.md` [x] gate run once: only `play-isolation` (expected, Play files go in their own commit)
and `reset-account` (fixed, re-run green); typecheck + eslint clean [x] Opus reviewer PASS, no criticals; 4 warnings all fixed (server cap + order on
`shared`, stale-reply guard on the panel, card error shown, wrong comment). `CIRCLE_COMPARE_COPY_REVIEWED` stays false until I read Box 62's lines. Not
verified: wave105 against a real database (no SQL run), the screens on a device. Pending: my OK to apply `wave105` (Release B), commit (Play files alone).

**8+9.** [x] plan approved by me (rename only the dead `sage-*` files; in the end none were dead, see below) [x] notification ask: after the
first insight loads, a sheet ("Want a nudge now and then?" · Turn on / Not now), asked once ever (`ato.push.asked`), no sheet if the system
already decided (e.g. through Divecore's pet reminder), never at cold start or on web; the silent `checkCount` ask in `push-runtime.tsx` is
gone; `push-policy.ts` gate = insightCount ≥ 1; `check:push` rewritten with pairs [x] accessibility: label + role on all 17 controls in
`auth/index`, `auth/login`, `onboarding` plus the code screen `auth-otp-code.tsx`; new `check:a11y-auth` (4 files, synthetic pass/fail pair);
the native Apple button is natively accessible [x] D10: `born-on-fields.tsx` date row `minWidth: 0` on the inputs, `maxWidth: 100%`
(not previewed) [x] polish: read-failed vs save-failed copy split, skeleton 45 s → 10 s with tap retry, check-in line "N of 7 check-ins toward
your next bonus" (never "0 of 7"), Dev Hub lists the real `INSIGHT_BANK_COPY_REVIEWED` (one narrow exception for that file in
`insight-bank-check`, with a test pinning it); streak copy checked, no loss framing [x] AI cleanup: deleted `rolls/run.ts`, `rolls/generate.ts`,
`questions/reroll.ts`, `legends64/generate-story.ts`, `sage-title-store.ts`; `generateCategoryStatements` removed; `call-sites.ts` 7 → 4 entries;
checks rewritten (reroll, rolls-store, ai-provider, framework-fence) none weakened [x] the two prompt lines now use the D6 rule (neither is
in the `ai-library` bundle: no regen, no deploy; `check:ai-library` green) [x] `sage-*` renames: DEFERRED on purpose (internal names; ~40
importers and ~20 checks read them by path; `sage-eight-ball` is used by `intake-sweep`, `sage-story*` by the Story card and the bundle, so
none were dead). Do it as one codemod step later, or never [x] Boxes 63 (insight + ask + check-in line) and 64 (accessibility + birthday row)
[x] gate run once: only `play-isolation` (expected, Step 7 Play files go in their own commit); typecheck clean [x] Opus reviewer PASS, no
criticals; fixed: sheet skipped when the system already decided, otp file added to the a11y check. Open warnings: "asked" is saved only when a
button is tapped (killed mid-sheet = asked again once); `src/play/pet-screen.tsx:1560` still opens the system dialog directly on the first
Hideout build (Divecore, unchanged, shares the 'undetermined' guard); new copy (`INSIGHT_SAVE_FAILED_COPY`, check-in line, 10 s timeout) is not
pinned by a check; at total 7 the line reads "7 of 7 check-ins toward your next bonus"; stale comments in `ato-tokens-server.ts:49/65`,
`rolls/store.ts`, `legends64/store.ts`; `rolls/compose.ts` is now unused by app code (delete later). Not verified: the sheet, labels and
birthday row on a device or the web preview. No migration, deploy or OTA. Nothing committed.

**10.** [x] plan approved by me (all recommendations: wave106 with the dev-grant fix; links to ato.emgens.com) [x] legal text rewritten from
the code, not from the drafts: `src/app/legal/privacy.md`, `terms.md`, `app-privacy-labels.md` (table: data type / collected / linked /
tracking / purposes), mirrors `landing/privacy.html` + `terms.html`. Now says: Circle as built (requests with accept, silent block that ends
visits + compare, report with 6 fixed reasons kept after deletion with ids cleared, per-friend visits switch, Compare strengths only when
both switch it on, fixed phrases, never scores/attachment/conflict/low sides, name/handle filter), what anyone with your @handle sees
(`public_profile`: name, handle, show_up, talk_style, appearance; no switch, OPEN-QUESTIONS 16), no direct messages (chat parked; the
"not end-to-end encrypted" paragraph and "mute" removed), the notification ask (once, after the first insight; local only, no push token
uploaded), AI = Legends cards + deep dives, Gemini first / DeepSeek fallback, phone sends a trait group only, Divecore save + anonymous
counts, Sentry not linked (no user, PII scrubbed), Check read/do text kept 7 days [x] `app.json` / `PrivacyInfo.xcprivacy`: unchanged (the 11
types and Linked values already match; now pinned per row) [x] `docs/legal/OPEN-QUESTIONS.md` = 6 settled + 16 open items, "not legal
advice" first; DRAFT files marked superseded [x] M8: Privacy + Terms links on sign-up and You (`src/components/legal-links.tsx`,
`Linking.openURL`, role link + label) [x] deletion proof: `count_user_rows` was missing `circle_compare_share`, `ai_library_seen`,
`ai_library_reports`, `ai_library_wanted` (all cascade; the proof could not see them) → `wave106_delete_proof.sql` adds them plus the
shared-content authors (`created_by`) and `me.referred_by`; REAL BUG fixed: `dev_access_grants.granted_by` had no ON DELETE, so deleting
anyone who had granted dev access (root) failed → ON DELETE SET NULL, nullable. emci APPLIED wave105 then wave106 (first try of wave106
alone failed and rolled back: it needs wave105's table); verified: 4 compare functions, table present, granted_by nullable, on delete `n`
[x] checks: new `check:delete-proof` (every per-account table counted or skipped with a reason, no account FK without ON DELETE incl.
later `alter table`, wave106 keeps every wave104 term, pass/fail pairs); `check:floor` rewritten to the new rule (Circle/AI/Divecore/notification
statements required in app + landing policy, no chat/mute, every push-token sentence must be a denial, label Linked column = app.json,
links pinned; pairs), none weakened; `check:delete-account` (live) now also makes a pending request to @atodev and asserts `ok`;
`under18-server` NOT_LIVE += wave106 [x] Box 65 [x] gate run once: only `play-isolation` (expected: Step 7/7b Play files go in their own
commit); typecheck + lint clean [x] Opus reviewer PASS, no criticals; 5 warnings all fixed (block claim scoped to "in the app", the live
check asserts `ok`, Check text disclosed, two cross-refs, push-token and alter-table loopholes closed). NOT run: `check:delete-account`
live (needs the seeded `ato-delete-check@example.com`, SQL in its header; Box 65). Not verified: the links on a device; the landing
pages are not redeployed yet (OPEN-QUESTIONS 15). No OTA, nothing committed. A lawyer must read the policy + terms before submission.

**11.** [x] plan approved by me [x] `docs/ATO_DEVICE_TESTS.md`: new **Box 66** (bottom) = pre-step 1 (live `check:delete-account` with the full
seed SQL for `ato-delete-check@example.com`, copied from the tested wave31 user + identity insert, never run by the agent), pre-step 2
(accounts/phone), Parts A-G in run order (sign-up/links/date row, insight + notification ask + check-in line, Circle, Compare, the words you
see, accessibility, delete a throwaway last), each tap with an expected result, plus a results table; a pointer above Box 60 says use Box 66
(Boxes 60-65 kept as detail, not deleted) [x] every item of Boxes 60-65 is in Box 66 (self-check; the unchanged "earlier-day label / widget /
7th-day +10" line is marked optional, B9) [x] docs only: no code, no gate, no reviewer. NOT done: the phone pass and the delete-check run
(emci). Note: the delete check needs `ATO_INVITE_CODE` in `.env.local` if signup is invite-only (agent never edits env).
Phone pass: emci 2026-10-20, Parts A-G all pass, no fixes.

**12.** [x] Box 66 all pass (no fix steps) [x] plan approved by me (approvals A-E; still ask before commit, OTA, SQL) [x] `play` route
out of the `PRE_LAUNCH_DEV` guard, under the age guard only (`_layout.tsx`), pinned by 3 new `check:release-mode` pins [x]
`PRE_LAUNCH_DEV = false` (`dev-mode.ts`); `RELEASE_MODE=1 npm run check:release-mode` = 47 pass [x] hero clean slate ON THE PHONE,
no server change: `launchCleanSlate` + additive v33 `launch_reset` in `src/play/playStore.ts`, once per save on load: owned heroes →
Corvus (pets hatched from eggs keep theirs via `heroOwned`), Avatar hero → Corvus unless still owned, hero bindings to unowned heroes
dropped, no offer, every aura/finish owned + worn cleared; tokens kept; fresh saves start true; an old cloud save resets when it loads;
new `check:launch-clean-slate` (7 pass) [x] Premium TODO(A5) closed: no purchase path at launch, heroes from eggs + band clears (no
screen text mentions buying, so no copy change) [x] `src/app/sage.tsx` deleted (cold-start `/sage` still → /insights via
`legacyRedirect`); `check:tab-rename` + `check:sage-load` pin it gone [ ] `ai-generate` delete DEFERRED: `src/lib/ai/edge.ts:24` still
invokes it and `check:ai-provider` pins the 410 stub; deleting needs the client path removed first (its own small step, or never) [x]
old PROJECT_CONTEXT pre-launch checklist: items 2-4, 6-9, 11, 13 are covered by the flag or already gone (Dawn trace, draft badge, crisis
preview no longer exist); left for emci: 12 (rotate QA invite code, dev-test password, `DEV_UNLOCK_PASSWORD`), 14 (drop
`play_dev_logs`, deletes rows, needs OK) [x] checks rewritten to the flag-off rule, none weakened: `age` (layout regex), `auras`
(fixture tokens 1000→2000, prices unchanged), `preview-mode` (flag off = preview can never be on, wrapper untouched) [x] wave80 safe:
no client code writes trait tables or calls `answer_question_item`; wave80 runs after wave101 so its revoke wins [x]
`wave107_signup_public.sql` written (one config row; NOT applied) [x] gate run once: only `play-isolation` (expected: commit
`src/play/playStore.ts` + `scripts/check-auras.ts` alone); typecheck clean, lint 0 errors [x] Opus reviewer PASS, no criticals
[x] Box 67 written. One comment edit in `scripts/prod-you-check.ts` (stale "invert before launch" note) was blocked by the harness;
the check itself is correct as is (You loads no probe). Not verified: on a device. Open after OTA: SQL below, Box 67.
**Half (b) SQL (emci, SQL editor, AFTER the OTA is on phones, in order):** 1. the whole of `supabase/migrations/wave80_trait_lock.sql`
· 2. `supabase/migrations/wave107_signup_public.sql`. Dashboard (emci): Auth → "Leaked password protection" ON. Before step 2: rotate
the QA override invite code, the dev-test password and `DEV_UNLOCK_PASSWORD`.
[x] half (b), emci 2026-10-21: rotations done, wave80 then wave107 applied, leaked-password protection ON, Box 67 A-C passed
(emci: "Passed") [x] verified read-only on the live project 2026-10-21: `app_config.signup_mode = 'public'`; no anon/authenticated
INSERT/UPDATE/DELETE grant on `trait_tracks` or `trait_history`; `answer_question_item` not executable by authenticated. (A
first check the same day found neither file applied; emci re-ran both in the SQL editor.) Leftover, harmless: wave101's
`trait_tracks_adult_insert/_update` + `trait_history_adult_insert` policies still exist but grant nothing without the table grant
(D15).

**13.** [x] plan approved by me [x] "ATO IS LAUNCH-READY WHEN" checked line by line (table below) [x] widget header already "ATO"
(`targets/widget/widgets.swift:45,68`, Step 3): no widget or `app.json` diff needed [x] haptics already in code (`street-feel.ts`,
`try-today-card.tsx`) and `expo-haptics` already a dependency: they ship with the next native build, no diff [x]
`RELEASE_MODE=1 npm run check:release-mode` = 47 pass; `check:ota-gate` exit 0 (green) on HEAD fc854296 + docs-only edits [x]
`docs/app-store-pack.md` written (URLs, age rating with UGC, labels, export compliance, review notes, demo-account steps,
6 screenshots, blockers) [x] Opus reviewer: FAIL on the pack's wording (QR scan, camera, Circle tab, tab names) → all fixed;
cartoon violence now "Infrequent/Mild"; `check:floor` re-run green [x] Box 68 written (`docs/ATO_DEVICE_TESTS.md`).
Launch-ready table (evidence):
 1. `ai-generate` closed + rate limits: DONE (410 stub wave98; Step 1). 2. advisors: DONE (Step 6 run, 0 errors; leaked-password ON, line 280).
 3. guessable codes: DONE (rotations 2026-10-21, line 280; Gemini rotated, line 166); `play_dev_logs` still open = D13, not blocking.
 4. Circle safety: DONE in code (Step 7, Box 66 pass); Block/Report live in the Circle tab (moved from the Divecore Circle sheet 2026-10-21; visits and gifts stay in Divecore).
 5. Privacy/terms/labels/manifests: manifests + labels DONE (`check:floor`); **OPEN-YOURS: D12 + lawyer read, 46 `[CONFIRM]` tags
    (23 in `src/app/legal`, 23 in `landing`), landing redeploy, support inbox confirmed monitored.**
 6. Live `delete-account` check: **OPEN-YOURS** (never run live; Box 68 E2 covers the in-app path).
 7. Copy reviewed / flags: **DECIDED 2026-10-23 (roadmap v2 step A4, Ledger A)**. A false flag never hid a surface: with
    `PRE_LAUNCH_DEV` off the copy is live with no badge (the only flag with an effect was the category push). emci accepted 9
    flags (now `true`), will read 4 (still `false`), 4 are retired, nothing is hidden. Table in Ledger A.
 8. Divecore reachable, real economy: DONE (Step 12, Box 67). 9. public signup: DONE (wave107); brand-new-email on a clean phone = Box 68 A.
 10. wave80: DONE (verified read-only 2026-10-21). "Old bundles not in use": accepted risk (Ledger A).
 11. gates green: DONE (this step). TestFlight run: **OPEN-YOURS** (Box 68).
 12. Phone boxes: 59-67 passed; Larger Text + Reduce Motion pass = Box 68 F (**OPEN-YOURS**).
 13. App Store Connect: pack written; **OPEN-YOURS** to enter it + demo account + screenshots.
**Found (bigger, not fixed):** (a) `app.json` still has the `expo-camera` plugin + camera permission text ("scan a friend's QR")
but nothing in `src` uses the camera and friends are added by @handle. I corrected the label doc only. Removing the plugin
(and `expo-camera` from `package.json`) is a native/dependency change = needs emci's ok; risk if left: a reviewer may ask
why the app asks for camera access (it never prompts). (b) Support URL is the landing page; no /support page.
**Blockers still open for submission:** D12 (legal answers + lawyer read) and the confirmations above. D8: recorded rotated.

**14.** [x] plan approved by me (libsodium; chat in a 1.1 build after 1.0; triage: emci daily, 24 h, warn → chat off → ban,
reported message + last 5, 30-day ciphertext) [x] `react-native-libsodium` 1.7.0 pinned + `allowScripts` (its postinstall
unpacks the native lib; npm blocked it), config plugin; `app.json` 1.1.0 / runtime 1.1.0 / `ITSAppUsesNonExemptEncryption
true` [x] `wave108_circle_chat.sql` (NOT applied): `chat_keys`, `chat_messages` (ciphertext + nonce + both public keys,
participants-only select for Realtime, no client write), `chat_restrictions`, `reports.context` + restrictive insert policy
(only `chat_report` writes context), RPCs `chat_set_key/peer_key/send/thread/report/my_status/ack_warning`,
`admin_chat_restrict` (root), `_chat_allowed` = friends + not blocked, 18+, rate limits (send 200/h, report 10/day, key 10/day),
daily cron deletes ciphertext > 30 days, `count_user_rows` restated + 3 tables [x] phone: `src/lib/chat/*` (crypto, filter,
rules, store), `src/app/chat.tsx` thread screen (long-press report, two-tap block, blur + second-tap filter, warning banner,
chat-off), Circle ⋯ → Message (`circle-visits-ui.tsx`, `pet-screen.tsx` `onOpenChat`, `play.tsx` push) [x] disclosure:
`app-store-pack.md` §9 (1.1 answers; §1-8 = the 1.0 commit), labels + manifest + `PrivacyInfo.xcprivacy` gain Emails or Text
Messages, `privacy.md`/`terms.md` + landing copies say "app version 1.1 and later", triage SQL in `docs/circle-safety.md`,
Box 69, system map [x] checks: new `check:circle-chat` (7, filter pass/fail pairs), `floor`, `delete-proof`, `reset-account`,
`under18-server`, `rebuilt` moved to the new rule; typecheck + lint clean; `check:ota-gate` once = only `play-isolation`
(needs the Play/app commit split) after the two rule fixes [x] Opus reviewer FAIL → fixed: forged chat reports via the old
stage7 insert policy (restrictive `context is null` policy), plus 9 warnings fixed (re-runnable publication add, null text key,
token refresh reloading, key-pair race, Load older jump, block disarm, peer key late, Keychain error copy, privacy wording).
Not verified: wave108 on a real database, any device run (needs the 1.1 build), web render.

## Review ledger (a reviewer skips anything listed here unless those files changed afterward)

| Step | Scope | Verdict | Open warnings |
|---|---|---|---|
| 1 | profile character files (`profile-character.ts/.tsx`, `questions-fold.tsx`, `profile-card.tsx`, lab, `profile-history-check.ts`) | PASS (Opus) | 4 fixed |
| 2 | `age.ts`, `around-lab.tsx`, `age-check.ts`, `under18-server-check.ts`, `wave102` | PASS (Opus, Step 5) | Feb-29 test, live-check seed, UTC vs local, no begin/commit (see Step 5) |
| 3 | Sage/crisis scrub, legal text, `wave103` | FAIL → fixed (Opus) | `ai-library-check` still names `_library_crisis` in wave93/94 (describes past state) |
| 4 | content-policy audit, filters, new checks | FAIL → fixed (Opus) | known label gaps listed in Step 4 |
| 5 | no code changes | n/a | none |
| 6 | release steps only (no new code beyond the regenerated bundle) | n/a | none (advisors + phone check done) |
| 7 | `wave104`, `wave104b`, Circle sheet files, `name-filter.ts`, `circle-safety-check.ts` | PASS (Opus) | blocks existence visible to a hand-made API call; old apps' add-by-scan error until Release B; new Circle lines unread |
| 7b | `wave105_circle_compare.sql`, `src/play/circle-compare.ts`, `circle-compare-store.ts`, Compare panel in `circle-visits-ui.tsx`, `circle-compare-check.ts` | PASS (Opus) | 4 warnings fixed; open: dev reset + `count_user_rows` not extended for `circle_compare_share` (cascades with the account); compare copy unread (Box 62) |
| 8+9 | push ask (`push-policy.ts`, `push.ts`, `push-runtime.tsx`, `notification-ask-sheet.tsx`, `today-focus-card.tsx`), a11y labels (`auth/*`, `onboarding.tsx`, `auth-otp-code.tsx`), `born-on-fields.tsx`, deleted rolls/reroll/generate-story files, `call-sites.ts`, the two prompt lines, `push-check`, `a11y-auth-check`, `insight-bank-check`, `reroll-check`, `rolls-store-check`, `ai-provider-check`, `framework-fence-check` | PASS (Opus) | 2 fixed; open: asked-once only on tap, Divecore direct ask, new copy unpinned, "7 of 7" wording |

| 10 | `src/app/legal/*` (privacy, terms, labels), `landing/privacy.html` + `terms.html`, `docs/legal/OPEN-QUESTIONS.md`, `wave106_delete_proof.sql`, `delete-proof-check.ts`, `floor-check.ts`, `delete-account-check.ts`, `under18-server-check.ts` (NOT_LIVE), `legal-links.tsx`, `auth/index.tsx` + `you.tsx` (links only), Box 65 | PASS (Opus) | 5 fixed; open: live delete check not run, landing not redeployed, lawyer read |

| 11 | `docs/ATO_DEVICE_TESTS.md` (Box 66 + pointer only) | n/a (docs only, self-checked against Boxes 60-65) | none: phone pass A-G passed 2026-10-20 |

| 12 | `_layout.tsx`, `dev-mode.ts`, `sage.tsx` (deleted), `playStore.ts` (`launchCleanSlate`, `launch_reset`, TODO(A5) comments), `release-mode-check.ts`, `check-launch-clean-slate.ts`, `tab-rename-check.ts`, `sage-load-check.ts`, `age-check.ts`, `check-auras.ts`, `preview-mode-check.ts`, `wave107_signup_public.sql`, Box 67 | PASS (Opus) | reset reaches the cloud on the next change (restore re-runs it); an old-bundle phone re-grants free heroes until it takes the OTA; gear left on unowned heroes (Locker can still remove it); preview wrapper blocking untested while the flag is off |

| 13 | `docs/app-store-pack.md`, `app-privacy-labels.md` (one line), Box 68 | FAIL → fixed (Opus) | pack wording corrected; open: `expo-camera` plugin unused (needs emci's ok), demo account fresh-save Circle path untested |

| 14 | `wave108_circle_chat.sql`, `src/lib/chat/*`, `src/app/chat.tsx`, `circle-visits(-ui)`, `pet-screen.tsx`, `play.tsx`, `package.json`, `app.json`, `PrivacyInfo.xcprivacy`, legal md + landing html, `app-store-pack.md` §9, `circle-safety.md`, Box 69, `circle-chat-check`, `floor-check`, `delete-proof-check`, `reset-account-check`, `under18-server-check`, `rebuilt-check`, system map | FAIL → fixed (Opus) | open: ciphertext rows stay readable to the two people by direct API for ≤30 days after a block (encrypted, own messages); old `blocks` two-sided read (D18); release order (D17) |

## Ledger A: settled decisions (never re-ask)

- Release B is live and phone-checked: Box 66 Parts A-G all pass (emci, 2026-10-20), no fix steps.
- Launch flip (Step 12, emci 2026-10-20): one OTA with the flag off + route fix + clean slate, then wave80 + public signup by SQL;
  no minimum-app-version gate (risk accepted: ~9 accounts, OTA on second open); no hero purchase path at launch; clean slate runs on
  the phone (no server rewrite of `play_saves`); `ai-generate` stays a 410 stub for now.
- Launch flip is LIVE (2026-10-21): OTA `6307ece1`, wave80 trait lock + wave107 public sign-up applied and verified, Box 67 passed.
  Dev reset RPCs that check `signup_mode` now refuse (on purpose).

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
- **Copy flags (step A4, emci 2026-10-23: "accept all my picks"; pinned by `check:copy-flags`).** A `false` flag hides nothing
  (draft badge only while `PRE_LAUNCH_DEV`, which is off); nothing is hidden. Flag flips need no OTA by themselves (no visible change).
  - **ACCEPTED, now `true`:** `INSIGHT_BANK` (208 ideas), `CATEGORY_BANK` (~37), `STORY_BANK` (66), `DAILY_PICK` (64), `BANK`
    (352 questions), `STAGED_INTAKE` (+ `UNLOCK` alias), `POLISH`, `TEAM` (48 + 10), `CATEGORY_DEEP_DIVE` (prompt + card).
    Accepted on the existing review docs and checks; an edit only for a specific problem (copy-review-rules).
  - **READ (stay `false` until emci reads them):** `PROFILE_CARD` (profile card + history, read the render), `CIRCLE_COMPARE`
    (friends' compare lines, Box 62), `LEGEND_FIGURES` (a sample of the 120), `CATEGORY_STATEMENTS` (flipping it turns ON the
    category push line on the lock screen, `push-insight.ts`; flip only after he reads real statements).
  - **RETIRED (gate nothing, not a decision):** `DAILY_INSIGHT` (replaced by the insight bank), `TITLE`, `STORY` (old AI prompt;
    the live Story is the story bank), `CATEGORY_READ` (old roll, no screen). **Deleted with their dead code in step A5 (2026-10-23).**
  - **HIDDEN:** none. (The v1 rule "unread surfaces get hidden" was never true in code and is withdrawn.)
- Legal (Step 10, emci 2026-10-20): Privacy/Terms links open `https://ato.emgens.com/{privacy,terms}.html`; the legal text names
  Gemini + DeepSeek fallback; `dev_access_grants.granted_by` ON DELETE SET NULL (wave106). Legal text stays a lawyer draft.
- Release order (D17, emci 2026-10-21): 1.0 is built from tag `v1.0.0` (6af79d2f, local, not pushed); Step 14 lives on
  `feature/circle-chat` (two commits, not pushed) and merges only after 1.0 is submitted.
- Circle chat (Step 14, emci 2026-10-21): libsodium (`react-native-libsodium`), one key pair per account per phone; ships in
  a 1.1 store build AFTER 1.0 (runtime 1.1.0, never by OTA); `ITSAppUsesNonExemptEncryption = true`, standard algorithms /
  mass-market; emci owns report triage daily, 24 h target; ladder warn → chat off → ban; a report sends the reported
  message + the 5 before it; ciphertext deleted after 30 days.
- Applied 2026-10-20 outside Release B: `wave104`, `wave104b` (Step 7), `wave105`, `wave106` (Step 10). Release B had NO migration left
  from steps 7-10; it was the OTA only, published 2026-10-20 (group `b9c891db`). Landing pages redeployed first (emci confirmed).

## Ledger B: APPLIED 2026-10-20 (Step 6). Every migration below is now live; the bundle is deployed; the OTA is published.

(The text below is kept as the record of the order that was used. "NOT applied" wording in it is historical.)

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
| D10 | Web date row overflows at 375 px (`born-on-fields.tsx`); native not run | FIXED in step 8 (style only, `minWidth: 0`); check on a device in Box 64 |
| D12 | Legal facts only you/a lawyer can answer (entity, AI vendor training/retention + DeepSeek, retention periods, kept reports, law, age rating, label categories, landing form, Kenney/PixelLab, public card with no hide switch): `docs/legal/OPEN-QUESTIONS.md` items 1-16 | answer before Step 13 (store submission); lawyer reads policy + terms |
| D13 | Drop `public.play_dev_logs` (wave73 dev test results; deletes rows) before launch? | yes, one small migration after Step 12 |
| D14 | Delete the `ai-generate` stub: needs `src/lib/ai/edge.ts` + `generateText` callers removed first (**DONE 2026-10-23: client path removed in step A5; emci confirmed the A5 OTA reached his phone and said delete; `supabase functions delete ai-generate` run and `supabase/functions/ai-generate/` removed**) | done |
| D15 | wave101's `*_adult_insert/_update` write policies on `trait_tracks`/`trait_history` outlived wave80 (inert: no client grant). Drop them? | yes, fold into the D13 cleanup migration after launch |
| D16 | Remove the unused `expo-camera` plugin (camera permission text) from `app.json` and the dependency before the production build? Native/dependency change. | yes if you want a clean permission list; safe either way (no code calls the camera). Decide before the EAS build. |
| D18 | Chat no longer reads `blocks` through RLS (it uses `_circle_blocked`), so the two-sided `blocks` read noted in Step 7 could become blocker-only (hides that a block exists). Policy change on a live table. | DONE 2026-10-21: `wave109_blocks_blocker_only.sql` applied + verified |
| D19 | A Dev Hub (root) button for the chat ladder (`admin_chat_restrict` is ready); today it is SQL in `circle-safety.md`. | later, if triage gets busy |
| D11 | Rename the internal `sage-copy` / `sage-knows` / `sage-title` files (~40 importers, ~20 checks read them by path)? Invisible to users. | skip, or one codemod step after launch |

## Original roadmap steps still ahead

Steps 3–10 of `docs/ato-finish-roadmap.md` are rows 7–13 above (Circle safety; notifications + a11y; insight polish; AI
cleanup; legal/privacy/deletion; device boxes; launch flip; production build). Their findings and prompts stay in that file.
