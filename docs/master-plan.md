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
| 0 | Save the work: group the uncommitted tree into logical commits on this branch (I say "commit") | Sonnet 5 | ▶ |
| 1 | Profile character after the first group of questions | Sonnet 5 (Opus only if the design is contested) | [ ] |
| 2 | 18+ nights gate for missing/blank/invalid birthdays (client + server) | Sonnet 5 | [ ] |
| 3 | Scrub Sage and crisis everywhere + update Terms of Service and the other legal text | Sonnet 5 | [ ] |
| 4 | Finish the content review: policy audit (rest), flags, Box 60 | Sonnet 5 + one Opus reviewer | [P] |
| 5 | Full gate, fix every failure with evidence, reviewer pass | Sonnet 5 + Opus reviewer | [ ] |
| 6 | RELEASE A (needs my approvals, in order): OTA → migrations → bundle regen + deploy → phone check | Sonnet 5 | [ ] |
| 7 | Roadmap step 3: Circle safety (accept, block/report, filters) | Opus 5 | [ ] |
| 8 | Roadmap step 4: notifications + accessibility (+ the web date-row overflow fix) | Sonnet 5 | [ ] |
| 9 | Roadmap steps 5 + 6: insight/Home polish, AI cleanup (retire `_library_crisis`, dead callers) | Sonnet 5 | [ ] |
| 10 | Roadmap step 7: privacy policy, labels, deletion proof (builds on step 3's legal pass) | Opus 5 | [ ] |
| 11 | Roadmap step 8: device boxes rewrite + one full phone pass (Box 66) | Sonnet 5 | [ ] |
| 12 | Roadmap step 9: launch flip (PRE_LAUNCH_DEV=false, hero clean-slate, wave80, public signup) | Opus 5 | [ ] |
| 13 | Roadmap step 10: production build + store submission | Sonnet 5 | [ ] |

### Step checklists (done-criteria)

**0.** [ ] commits grouped (content/questions, age+under-18 client, server migration FILES, rules/voice, tooling+docs; Play files
separate) [ ] nothing pushed unless I say so.
**1.** [ ] investigation: what the old character was, what exists, what is missing [ ] plan approved by me (sample render) [ ]
character appears after the first read (confirm which set), shows current stats at honest confidence, a unique character from
answers, and what it could evolve into from the direction of answers [ ] no invented stats; weaknesses per the policy [ ]
public snippets skip struggle-side lines [ ] synthetic-user preview in the browser pane [ ] checks + one reviewer pass [ ]
`PROFILE_CARD_COPY_REVIEWED` decision recorded.
**2.** [ ] read-only finding: what a null/blank `born_on` does today (client + SQL) [ ] every 18+ gate listed [ ] blank/
malformed/under-18 cannot go to 18+ nights or see gated details; prompt to confirm age [ ] server fix = NEW unapplied migration
(tested path) [ ] paired tests (blank, malformed, 17y364d refused; exactly 18 allowed) [ ] fits the wave101 order.
**3.** [ ] inventory + counts shown, plan approved [ ] user-visible Sage/crisis copy removed; dead code deleted (sage.tsx,
sage.txt, content.generated.ts, crisis_flags reads) [ ] static HelplineRow kept (it is NOT crisis detection) [ ] tests rewritten,
none weakened [ ] `_library_crisis` rename = unapplied migration only [ ] Terms of Service, Privacy Policy, privacy labels,
landing pages, legal drafts match the app today (no Sage/crisis logging, 18+, real AI uses, Divecore save) [ ] list of
questions only I/a lawyer can answer; say it is not legal advice.
**4.** [ ] finish the policy audit that stopped at the usage limit (prompts, reviewer instructions, checks, word lists,
server filters, docs) with paired tests [ ] resolved: the framework-fence question [ ] short list of what I must actually
read (only what a launch surface shows) [ ] flags flipped only for sets I approve; the rest hidden behind their flag [ ] Box 60.
**5.** [ ] `check:ota-gate` once, every failure traced to a cause [ ] reviewer pass [ ] the stale-bundle failure is the only
expected one.
**6.** [ ] I approve each of: OTA; each migration in the order below; `gen:ai-library` + deploy [ ] pre-apply read-only SQL run
(stale-copy md5, counts, root/dev/review accounts have an 18+ birthday) [ ] post-apply SQL + security advisors [ ] phone check.

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
- Public signup, no invite gate (launch flip). One chat per step. Plan + model per step.

## Ledger B: parked, built but NOT applied (nothing deployed)

Migrations, apply order (full detail in `docs/under18-server.md` and `docs/copy-review-agent/applied-set2-questions.md`):
1. App update (OTA) first: block + Confirm-your-age + retired-question handling + new question/pick ids.
2. `wave99b_min_age_18` (sign-up and birthday guard 18) · 3. `wave99` (46 question wordings) · `wave99c` (Daily Pick p65) ·
`wave99d` (library backstop vocabulary) · 4. `wave100` then `wave100b` (question retire marker + 19 retired/new) ·
5. set an 18+ birthday on root, dev-test and review/Apple-demo accounts · 6. `wave101` (under-18 server gate, 110 guarded
functions) after the OTA is on phones.
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
| D6 | The type-code/Big Five/attachment-style fence on generated text: product choice or keyword ban? | step 4 asks one plain question |
| D7 | Story sample reveal "you always beat the clock" (overclaims): fix? | leave unless you want it |
| D8 | `.env.local` exports an `EXPO_PUBLIC_GEMINI_API_KEY`: anything `EXPO_PUBLIC_` can ship in the bundle. Check and rotate. | security check in step 5; I never print the value |
| D9 | Apple-demo/review accounts need an 18+ birthday before wave101 | set before step 6 |
| D10 | Web date row overflows at 375 px (`born-on-fields.tsx`); native not run | fix in step 8 |

## Original roadmap steps still ahead

Steps 3–10 of `docs/ato-finish-roadmap.md` are rows 7–13 above (Circle safety; notifications + a11y; insight polish; AI
cleanup; legal/privacy/deletion; device boxes; launch flip; production build). Their findings and prompts stay in that file.
