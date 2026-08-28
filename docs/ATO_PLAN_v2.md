# ATO — one plan for any AI (Claude, Cursor, DeepSeek, whoever's building)

Fresh build. Nothing carries over from the old Bolt version except the domain (astrollogs.com) — that's a link, not a foundation. Code starts here.

**Working reference, not a locked spec.** This document reflects current design thinking and is expected to change as the app evolves through real testing and research. Significant deviations get noted here or in NOW.md — they are updates, not violations. Build against the current text; do not treat an older paragraph as a constraint once this file has moved on.

**Compliance-grounded — not style choices.** These rest on external law, Apple/App Store policy, or harm-prevention architecture. Do not casually revise them because a later feature wants a looser tone:
- **Crisis spec** — keyword detection before the router, static resource card, no model call on a flagged message, flag-only logging.
- **Sage labeled "coach"** in the live UI (the Quest Home-card `Sage · npc` exception is the only locked exception).
- **Diagnosis-avoidance** — self-report only; no raw clinical/framework labels stored or shown as identity (Understanding spec guardrails).
- **App Store / Apple floor requirements** (Stage 8) — privacy labels, AI consent, per-user rate limits, report/block, age gates, no ATT, crash reporting, honest empty states.

---

## Glossary (read this before anything else)

If a field isn't defined here, don't guess its shape — ask.

| Term | Type | Meaning |
|---|---|---|
| `ME` | row (Supabase) | The user's profile. See fields below. |
| `show_up` | string | Onboarding chip (color-seed vibe). Stored as the chip's phrase. Still seeds the Home/poster color. Editable later in Settings. |
| `knocks_you_off` | string | Multi-select chips joined with `", "` (sleep / workload / people/conflict / health / money / something else). Editable later in Settings. |
| `morning_cue` | string | Chip phrase that inserts into the if-then Do (`After you {morning_cue}, …`). Editable later in Settings. |
| `talk_style` | enum: `quiet`/`even`/`loud` | Direct onboarding tap. Editable later in Settings. |
| `evening_wind_down` | string, nullable on pre-intake rows | Chip phrase. Times the evening Check push (wiring not in Stage 9). Editable later in Settings. |
| `energy_pattern` | enum: `morning`/`afternoon`/`evening`/`night_owl`, nullable on pre-intake rows | Self-report. Helps pick the check_count < 3 bank card. Not a diagnosis. Editable later in Settings. |
| `recovery_style` | enum: `movement`/`sleep`/`talking`/`alone_time`/`music`, nullable on pre-intake rows | Self-report. Not a diagnosis. Never shown on the public poster. Editable later in Settings. |
| `support_style` | enum: `nudge`/`space`/`listen`/`plan`, nullable on pre-intake rows | Self-report. Helps pick the check_count < 3 bank card. Not a diagnosis. Never shown on the public poster. Editable later in Settings. |
| `current_focus` | enum: `habit`/`through_it`/`like_yourself`/`show_up`, nullable on pre-intake rows | Self-report. Not a diagnosis. Never shown on the public poster. Editable later in Settings. |
| Optional trait axes | numeric 0–1, all nullable | 15-axis backbone, separate from the 9 chips. Shipped: `openness`, `conscientiousness`, `extraversion`, `agreeableness`, `steadiness`; `attachment_anxiety`, `attachment_avoidance`; `conflict_assertiveness`, `conflict_cooperativeness`; `autonomy`, `competence`, `relatedness`; `growth_mindset`; `locus_of_control`; `self_efficacy`. Plus `trait_sources`: **direct** (`self_slider`, `self_tap`, `self_confirm`, `self_settings`) is sticky and cannot be overwritten by **inferred** (`self_grid`, `self_situation`, `self_game`); skip/null has no source row. Per-axis `last_touched` lives in `trait_touched_at` (ISO, null axes have no key). Raw labels discarded at write. Never on poster, `peer_profile`, `public_profile`, or `night_snapshot`. |
| `this_week` | string, free text, resets weekly | Plan field. Not a ME column in v1 — Sunday recap + Sage read the checks table (`logged_on` + status; Read/Do only while in the 7-day keep window). Never a matching signal. |
| `recipe` | object `{base, hair, top, palette}` | Kenney asset selections that render the pixel. All 4 fields required once Pixel is built. |
| `valence` | enum: `lift`/`even`/`cut` | Computed from last 7 Checks. See formula in Rules. |
| Check | row `{user_id, day, logged_on, outcome}` | `outcome` is `did` or `skip`. One per calendar day max. Log today or up to 2 days back; older days are closed. No partial state in v1 — keep it binary. Read/Do text kept for a rolling 7 days, then nulled; outcome stays. Home-only `nudge_text` (user-facing "Nudge", internal zGlitch) is pruned on the same 7-day window; never Circle, widget, or morning push. Peer reads go through `peer_checks` (day, status, `read_text`, `do_text`); `checks_select_connected` is dropped so `nudge_text` cannot appear in a peer response. Owner Home still selects own `checks` rows. |
| Nudge | Home-only daily card | Third daily category (internal zGlitch). Real recent signal only — skip pattern, a knock that showed up in recent Read/Do, or a safe stored fact. Never from `talk_style` alone. Empty when there is no signal. Inherits cut's safety gates (not after a crisis-flagged day, not two days in a row, cruel-content filter, always with that day's Do); does not inherit cut's skip-streak valence trigger. |
| Explore | Home inner tab | Periodic Sage observations (weekly, or on a meaningful trait/signal change) — not daily. Cached between regenerations. Existing per-user quota. Cap: **1 regeneration per calendar day**. Combines 2–3 traits only when at least one is tied to a recent signal (fact / knock / Check pattern); never the three agency axes (`growth_mindset`, `locus_of_control`, `self_efficacy`) together. Library-grounded. Same output fence as cards/Talk. Completeness is never an Explore input. Never empty of extra-axis data: the 9 core chips are enough. Separate from Read/Do/Nudge and from the You tab. Decided; later box. |
| Reload | Home presentation | Cycles up to 3 pre-stored **paired** Read/Do variants for the same day. Cap 3 uses/day. No live model call. Same underlying truth (tone, shrink, signal) — presentation only. Locks in Understanding spec. Bank days 1–3: off. Decided; later box. |
| Library | static copy | Written-once, reviewed, public-domain/academic grounding. Lives in `src/app/copy/library.md` (same pattern as `first_cards.md`). Domain entries: Sleep, Workload, Conflict, Communication, Health, Money. Framework entries: Self-Determination Theory (Deci & Ryan), growth mindset (Dweck), locus of control (Rotter), self-efficacy (Bandura). People may read Library, so framework names are allowed there. Sage generation (Read/Do/Talk) may use only **For Sage** paraphrase lines, and only when a knock, filled trait, fact, or typed line connects — never teaching/source copy, never a visible "library" section. Output still runs `containsFrameworkTerm`. |
| `check_count` | integer, derived | Count of all-time Checks. Gates bank-vs-model content and the paywall (7). |
| `host` | boolean on ME | You flip this manually (admin). Not self-serve in v1. |
| `referred_by` | uuid, nullable, FK → ME | Which ME row invited this user. Hidden field. See Referral spec. |
| `born_on` | date, self-reported, nullable only on pre-field accounts | Date of birth. Required at new signup. Age is computed from this — 16+ to create an account, 18+ later for Wave 2 going. Never stored as a number or boolean. |
| `signup_mode` | config value: `invite_only`/`public` | Global switch gating whether a valid invite code is required to create an account. See Referral spec. |

---

## Two jobs, never one screen

**Spine (the app).** Learn about you. Home card + Sage + a pixel face (small, fixed top-right). Alone: Home, Sage, You.

**Around (later).** Get out with people who match. Circle, then Calgary nights, then plugs. Never on Home.

If Home is stale, fix Home. Do not open extras because they are in this file.

**ATO** = the app and a profile (screen name "What's your ATO?" = @handle). Legal entity: **AsTrollOGs** (used only in About/legal copy). Sage = voice. Pixel = body.

Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp.

---

## A normal day (build this)

Widget: Read + if-then Do. Home: face from yesterday's Check, one line in their style (lift / even / cut), one finishable Do, optional Nudge when a real signal exists, More → Sage. Inner tab **Explore** (periodic, not daily). Evening: Check **today** (did/skip). Face moves. Result strip. Stop. Reload, when built, cycles stored variants of today's pack — it is not a new dawn.

Circle hidden until a QR scan adds the first friend — "a scan" and "first add" are the same event; there is one gate, not two. QR lives on the You tab. After a scan: today's faces. Chat is a tap from a Circle card. Thread stays.

---

## Dies if (read before every stage)

- Card matches last 7, or Do is vague → they won't open tomorrow.
- Around opens with 0 shows or a wall with 0 writers → they never come back to Around.
- A Tickets / Food / Hosts tab with 0 live rows → catalog. Apple can bounce it. Interest is already gone.
- Paid before 7 Checks, or paywall on Home / Check / crisis / widget → they feel tricked.
- Home sells, or a city-wide wall, or live "who's here" → spine is dead.
- Chat ships with no working block/mute/report → Apple rejects it (Guideline 1.2, user-generated content). This isn't optional polish — it's a submission blocker.
- A crisis message gets a model-generated reply instead of the static resource card → real harm, not just a bad review.

Honest empty: "nothing this weekend" / "wall opens when the night does" / "no ATO price yet." Never a fake crowd.

---

## Rules (once)

- One dawn write per day (one pack). No live refresh luck. **Reload** (decided) cycles pre-stored variants of that same pack — not a new model call, not a new signal, not a softer Do. Shared content pools and live reroll stay rejected.
- Do is if-then, anchored to `morning_cue`. Miss → smaller Do next time.
- `talk_style` set at onboarding; editable later in Settings. Valence from Checks: 2+ `did` in last 7 → lift; mix → even; 2+ `skip` → one cut, then even. Cut = habit, not worth. No cut after crisis. No two cuts in a row.
- Sage: reflect more than ask, ~4 sentences, coach not doctor. Root writing rule, inherited everywhere Sage writes: *Reflect patterns as maybes, not facts. No "you are." No framework names. One trait at a time. Notice, don't correct.* Explore may combine 2–3 traits per entry **only when at least one is tied to a recent signal**; never combine `growth_mindset` + `locus_of_control` + `self_efficacy` in one entry; the other clauses still apply. Crisis keyword hit → static resource card (see Crisis spec below), stop, no model call.
- Home is solo. Friends never write the dawn line.
- Chat: TLS + RLS. History stays. No homemade crypto. Sage reads chat only when the user taps "Teach Sage this" on a specific message — never ambient access.
- You tab = poster (name, @handle, show_up visibility label, QR, Share — no large pixel; the live face is the nav companion; name appears once, on the poster). Settings below the fold: the 9 identity chips are editable (same chip UI as onboarding), plus appearance / credits. Profile completeness (decided; later box) lives near those fields as **two separate things**: the 9 core chips are always complete (never shown as a percentage of a person); the 15 axes are a separate depth layer, invitation not deficit. No completeness signal on Home, Explore, Talk, widget, or push. Sage reply room is shown as `X of [limit]` (e.g. `6 of 20 today`) with no "AI" or "tokens" in the copy — compact on Sage, collapsed by default in Settings. The crisis-line region picker is a collapsible reference at the bottom of Settings, above credits; it is not the active Talk crisis card.
- Sage Talk answers what the person typed; the day's Home Read/Do is light background, not the reply. Home Reads rotate among knocks / facts / focus instead of paraphrasing one story. Talk replies get the same framework-echo fence as cards (post-generation `containsFrameworkTerm`; retry once as a quality pass, **not** a second `claim_ai_call`; else honest empty). Banned phrases include the new six-axis names; do not ban `autonomy` / `competence` / `relatedness` as standalone words. Prompt paraphrases traits going in. "Does Sage know you?" never runs inside Talk replies.
- Home may show a third daily category, **Nudge**, from a real recent signal only. Empty when there isn't one. Never Circle, widget, or morning push. **Explore** is a separate inner tab on Home, not a fourth daily card and not on the You tab. Completeness is never an Explore input. Explore inherits the same output fence; regen cap is 1 per calendar day.
- Pixel companion: one small live face, fixed top-right at the tab shell (does not scroll or remount on tab switch). Current-you on Home/Around/You; aspirational glow on Sage. Tap plays a short coherent mood (wave / thumbs-up / happy bounce / hug); re-taps interrupt-and-restart, never queue.
- Share = hold or tap. Stories-size image. Caption: "What's your ATO?"
- Appearance: five user-selectable modes in Settings — Soft (default) / Zen / Quest / Neon / Anime. Replaces the discarded Ink / Paper / Steel / Bloom named palette for app chrome. Bottom tab bar uses the live appearance background in all five (opaque; no system material). The You-tab share poster still uses those four as a fixed shareable artifact. Spec lives in `src/constants/appearance.ts`. "Void" stays reserved for the competitor callout, not a mode name.
- Assets: Kenney CC0, same-family sets only (Modular / Toon / 1-Bit / Animal Remastered — don't mix families in one recipe). No AI-generated faces, no scraped art.
- Age: 16+ to use the app. 18+ required to be marked "going" on a night. Self-reported date of birth (`me.born_on`) is collected at onboarding; age is computed from that date so the 18+ gate can recompute later. Verification beyond self-report is accepted MVP risk — don't try to "solve" it inside a Wave 1 stage; if it needs solving, that's its own ticket.
- Model provider: the router box reads one env var (`MODEL_PROVIDER=gemini` or `groq`) — pick one before Stage 4, but build the router so switching providers is a config change, not a rewrite. Don't hardcode a provider name into Dawn or Talk directly.
- One box per stage. First line of a build message: `Open box: …`. Two stages requested in one turn → undo the second, finish the first.

```
app/contracts/
app/boxes/home auth me theme pixel dawn router talk share circle chat report invite intake
         around wallet   ← empty until that wave
app/voice/sage.txt           BEFORE STAGE 4
app/copy/first_cards.md      BEFORE STAGE 4
app/legal/privacy.md
```

Write those two copy files first. 3 styles × 3 valences. 3 mornings × 3 styles, real if-then Dos. No placeholder lorem — these are what new users see before check_count hits 3.

---

## Packets (ordered to match the build order below — same order everywhere in this doc)

| Box | In | Out |
|---|---|---|
| Home | card | Check **today** (did/skip) + result strip. Optional Nudge. Explore is a separate inner tab (periodic). Pixel is the global nav companion, not inline on Home. |
| Auth | Apple (TestFlight). Email before. | user_id (link, don't fork) |
| ME | user_id + onboarding answers | ME row |
| Theme | Settings picker (local) | Soft / Zen / Quest / Neon / Anime |
| Pixel | form + vibe + Check | `recipe` + look |
| Dawn | ME + yesterday + last 7 Checks | valence, read, if-then Do. Must differ from last 7 |
| Router | job + packet | text, capped length, model-provider-agnostic. Asks AI consent first, once |
| Talk | ME + card + sage.txt | short reply + optional one fact. Crisis check runs before router call |
| Share | me | /@handle + QR + image |
| Circle | me + them | hidden until first scan |
| Chat | from, to, words | thread |
| Report | from, target (message_id or user_id), reason | row in Reports table, visible to admin only |
| Invite | signup attempt + code | account created (or rejected) + code consumed |
| Intake | onboarding taps + optional extra axes (three-path for new axes; Stage 11 extra-4 for the first 9) | trait backbone fields on ME (see Understanding spec) |

**ME fields:** name, handle, timezone, `city` (typed slug for Around, never GPS; Wave 2 refreshes Calgary), `born_on` (self-reported date of birth; age computed, never stored as a number/boolean), `this_week`, `morning_cue`, `show_up`, `knocks_you_off`, `talk_style`, `evening_wind_down`, `energy_pattern`, `recovery_style`, `support_style`, `current_focus` (last five: self-report chips from Stage 9; nullable on pre-intake rows; energy/recovery/support/focus never shown on the public poster), color, `recipe`, theme_id, facts they've told Sage, all-time Checks, `check_count`, last_7_card_ids, `show` (visibility toggle; column is `me.visible` because SHOW is reserved), `allow_search`, `host` (admin-flipped), `referred_by` (hidden, nullable).

**ME never stores:** guessed vibes, raw chat logs, raw HealthKit data, a model's freeform narrative about the user. Explore "did this land?" reactions live in their own table — never a write path into trait scores.

`this_week` is for Sunday recap + Sage context only. In v1 it is derived from the checks table (not a stored ME string). It is **not** a dating graph. Matching (later) = same show both people tapped "going" on. Don't build interest-based matching — it's not in scope and nothing here asks for it.

---

## Crisis spec (built; **compliance-grounded** — not a style choice)

This needs your sign-off, not an AI's guess. Architecture is live; do not loosen it for a feature:
1. **Detection**: static keyword/phrase list (starter list, expand over time) checked against the user's message *before* it reaches the router. No sentiment model in v1 — keyword match is auditable and fails safe.
2. **Response**: a static, non-AI-generated card. Region is detected from device locale/timezone at launch (manual override is a collapsible reference at the bottom of Settings, above credits — not the active Talk card). Confirmed numbers only: US (`988 Suicide & Crisis Lifeline`) and Canada (`988 Suicide Crisis Helpline`) — call or text 988. Any other region gets an honest fallback, never a guessed number. The card also makes clear Sage is a coach, not a person who can help in an emergency.
3. **No model call happens on a crisis-flagged message.** The router must short-circuit before hitting Gemini/Groq.
4. **Logging**: crisis flags get logged (flag + timestamp only, not the message content) so you can see if the keyword list needs tuning — not for moderation of the user.

Write the actual keyword list and card copy yourself or with someone qualified — an AI drafting the trigger list for a safety feature without your review is the wrong way to build this one piece.

---

## Report spec (new — was missing)

Minimal, not a dashboard:
- `Report` row: `from, target, reason, at`. `target` is either a `message_id` or a `user_id`.
- Block: sets a `blocked_by/blocked_user` pair; blocked user's messages stop rendering for the blocker, both directions stop sending.
- Mute: local to the muter, no notification to the muted.
- No admin UI needed for Wave 1 — query the Reports table directly in Supabase. Build a real admin view only if report volume makes that painful.

---

## Referral spec (new — added post-Wave-1, before public App Store release)

**Purpose:** control who can create an account while testing, and give you a cheap way to cut off bad actors as a cluster rather than one account at a time.

**Not the same gate as TestFlight.** TestFlight already restricts installs to testers you've added — this spec matters starting at the point you submit for public App Store review, not before. Build it whenever; it does not block Stage 8.

1. **Mode**: one config value, `signup_mode: invite_only | public`. Default `invite_only`. Flipping it later is the entire "go public" switch — no rebuild, no fork.
2. **Codes**: `invite_codes` table — `code, owner_id, max_uses, uses_count, status, created_at`. Every ME row gets a small default allotment (3–5) issued automatically on account creation. You (root) seed manually, no `referred_by`.
3. **ME addition**: `referred_by` — nullable, hidden field, FK to another ME row. Not shown publicly. A user *may* see their own list of who they referred (their choice to show it or not) — never who referred *them* beyond their own account, never anyone else's tree.
4. **Signup enforcement**: Auth box — if `signup_mode = invite_only`, a valid unused code is required to create an account; code is consumed on success.
5. **Moderation** (no admin UI — same discipline as the Report spec, query Supabase directly):
   - `pause_branch(user_id)` — recursive walk down `referred_by`, disables login for that user and every descendant. Reversible. Use first.
   - `delete_branch(user_id)` — same walk, hard delete, cascades. Only after a paused branch has actually been reviewed.
6. **Disclaimer**: one line added to the privacy policy: referral relationships are tracked only for abuse prevention, not shared or used elsewhere.

**Done:** invite-only signup rejects a missing/used/invalid code. A seeded test tree (you → A → B, C) can be paused as one action and B/C both lose access without touching A's or your own account. Flipping `signup_mode` to `public` allows signup with no code, no other change required.

**Where it fits:** own box (`invite`), touching Auth + ME only. Sequence right after the Apple Sign-In/delete-account handoff in Stage 8 (both are Auth-box work). Required before public App Store submission — not required before TestFlight.

---

## Understanding spec (Wave 1.5 — living; Stages 9 and 11 shipped the first layer)

**Purpose:** give Sage a real trait backbone to calibrate tone and coaching against, instead of `talk_style` alone — without turning ATO into a personality test or a diagnosis machine. Stage 9 replaced the original 3 vague free-text fields with 9 required chips. Stage 11 added the first 9 optional 0–1 axes. This spec is the current design for that backbone as it expands; it is not a locked inventory.

**Why scoped separately from Stage 8:** schema + UI + Sage-prompting, not a wording tweak. Doesn't block TestFlight.

### The trait backbone (15 axes)

All nullable, all self-report / translate-and-discard. Raw label never stored. One canonical 0–1 scale. Per-axis `trait_sources`. Never on poster, `peer_profile`, `public_profile`, or `night_snapshot`.

**Source rank (shipped):**
- **Direct** (sticky — inferred cannot overwrite): slider (`self_slider`), tap-form (`self_tap`), Settings edit (`self_settings`), confirm-upgrade (`self_confirm`). Confirm is `confirmTraitSource`: source token + `last_touched` only, never a new 0–1 number. `mergeTraitWrite` cannot take `self_confirm`. Does-Sage-know-you UI is shipped (Stage 13 part 2).
- **Inferred**: 16-grid (`self_grid`), situation tap (`self_situation`), game/swipe (`self_game`). Last-write among inferred is fine.
- **Skip / null**: no source row, no `last_touched` key.

**Shipped (Stage 11):** `openness`, `conscientiousness`, `extraversion`, `agreeableness`, `steadiness`; `attachment_anxiety`, `attachment_avoidance`; `conflict_assertiveness`, `conflict_cooperativeness`.

**Shipped (this box):** `autonomy`, `competence`, `relatedness` (Self-Determination Theory); `growth_mindset`; `locus_of_control`; `self_efficacy`. Game/scenario writes are inferred (same rank as grid/situation). Three-path intake UI for these axes is still a later box.

**Per-axis `last_touched`:** shipped as `me.trait_touched_at` jsonb. Bumps on any successful write to that axis, regardless of source. A rejected inferred write does not bump it. Needed by the 3-month re-ask (later box).

Big Five (OCEAN) is the scientific backbone — of every framework considered, it has the strongest test-retest reliability, the broadest cross-cultural validation, and the only one with real predictive validity for relationship outcomes. The other doors fill it in; they are not stored as themselves:

- **MBTI → OCEAN**, when known (published correlations, McCrae & Costa 1989): Introversion↔Extraversion (r=-0.74), Intuition↔Openness (r=0.72), Feeling↔Agreeableness (r=0.44), Perceiving↔Conscientiousness (r=-0.49). **MBTI has no Neuroticism equivalent — this is a known, real gap.**
- **Attachment style fills that exact gap.** Anxious attachment tracks closely with high Neuroticism; avoidant attachment tracks with lower Extraversion/Agreeableness. Also adds relationship-specific behavioral nuance beyond trait level.
- **Conflict style** (collaborative / compromising / competitive / avoidant / accommodating) adds situational specificity for disagreement scenarios — the actual "help me talk to my coworker" use case.
- **SDT / growth mindset / locus of control / self-efficacy** add how someone relates to agency, setbacks, and "can I do this" — coaching-relevant, still not a diagnosis. Framework names stay in the Library (people may read those entries) and in this spec; they never appear in Sage-generated copy or stored labels.

None of these get stored as raw labels. Every path — type tap, slider, situation tap, tap-form, or game choice — translates into the same underlying fields. A person who types nothing technical and one who taps "INFJ" end up feeding the same columns.

**Data sources — free, public domain, no licensing needed:**
- **IPIP** (International Personality Item Pool, Oregon Research Institute) — the public-domain item bank most Big Five tools are quietly built on.
- **TIPI** (Ten-Item Personality Inventory) — the standard short-form Big Five measure, ~10 items, ~1 minute, free and validated. Use this, not the 120/300-item research versions.
- **ECR** (Experiences in Close Relationships) — standard free instrument for attachment style.
- Open-source scoring implementations already exist (IPIP-NEO Python libraries on GitHub) — reference/adapt rather than build scoring math from scratch.
- No paid API needed for v1. (Sentino exists as a paid commercial option covering IPIP/MBTI/DISC via one API call, noted for later if ever wanted — not required.)

### Intake structure

**Required (unchanged):** name, handle, timezone (auto, not asked).

**Core tappable — 9 total, UNCHANGED, never add the new frameworks here.** Each chip-based, each feeding something real, each phrased in plain language with the "why" baked into the wording rather than a separate explainer:
1. `talk_style` (quiet/even/loud) — existing.
2. `show_up` — chips (color-seed vibe).
3. `knocks_you_off` — multi-select chips (sleep / workload / people/conflict / health / money / something else).
4. `morning_cue` — chips, single concrete anchor, not a routine ("After I make coffee" not "what do you do every morning").
5. Evening wind-down — same shape as morning_cue, times the evening Check push.
6. Energy pattern — morning/afternoon/evening/night owl, times push notifications.
7. Recovery style — what pulls you back when you're off track (movement/sleep/talking to someone/alone time/music).
8. Support style — nudge to keep going / space to sit with it / someone to listen / a plan to fix it. Sharper signal than `talk_style` alone.
9. Current focus — "right now you're mostly trying to..." (build a habit / get through something hard / feel more like yourself / just show up).

One question per screen, tappable, with a visible progress indicator ("3 of 9"). All 9 are editable afterward from the You tab.

**Optional extra axes — two layers:**

1. **Shipped (Stage 11):** skippable `extra N of 4` after signup succeeds — 16-grid, sliders, close-pattern, disagreement. Writes the first 9 trait axes. Skip = those columns stay null. Merge is **direct vs inferred** (slider / tap / confirm / Settings sit in the direct rank). "Love language" reframed platonic remains a lower-priority optional add, not Chapman categories.

2. **Three-path (decided; supersedes treating the new frameworks as onboarding or as a single extra quiz).** SDT / growth mindset / locus of control / self-efficacy are never part of the required 9. User's choice, no pressure. Soft-ask budget applies to path (b) resurfacing (see below).
   - **(a) Answer directly** — simple tap-form, plain language, no clinical/framework terms. Writes as **direct** (`self_tap`; sticky, same rank as slider).
   - **(b) Skip now** — resurfaces occasionally later without pressure. Not a push notification, not urgent framing. Null stays null, no source row.
   - **(c) Play instead** — scenario swipe-deck, forced-choice "implicit trait policy" (same UI pattern as the original swipe-deck idea). Each scenario signals one axis without naming it. Writes as **inferred** (`self_game`; same rank as grid/situation — below a later direct answer on that axis). Sample formats:
     - Locus of control: "A project falls apart. First thought: 'I could've done something differently' vs 'that was bound to happen.'"
     - Growth mindset: "You bomb a presentation. Gut reaction: 'guess I'm not good at this' vs 'let me figure out what went wrong.'"
     - Self-efficacy: "Big task, tight deadline. You feel: 'I've got this' vs 'not sure I can pull this off.'"
     - SDT: "Best day at work is one where: 'I did it my way' / 'I nailed something hard' / 'I actually connected with people.'"

### Day 1 payoff — shipped with Stage 9/10

`check_count < 3` bank cards insert the person's own `morning_cue` into the if-then Do and pick the quiet/even/loud slot from `energy_pattern` / `support_style`. Still no live model call for those days.

### Library

Written once, public-domain/academic sourcing only, reviewed before publish, never per-user generated. Storage: `src/app/copy/library.md`. Sage generation may use only **For Sage** paraphrase lines, and only when a knock, filled trait, fact, or (Talk) the typed line connects. Teaching/source copy never enters the prompt. No visible "library says" section. Output still runs `containsFrameworkTerm`. People may read Library directly, so entry titles may name a framework. Sage-generated copy still must not.

**Domain entries (shipped; align with `knocks_you_off` chips):** Sleep (CDC/AASM sleep-hygiene basics); Workload (Karasek demand-control, Sonnentag recovery); Conflict (Gottman: specific complaint vs global attack, small bids to cool down); Communication (Rosenberg: what you saw → how it felt → what would help → one ask); Health (Wood/Lally: cue and small repeat); Money (Thaler mental buckets, Kahneman & Tversky losses-loom-larger, present-bias). No licensed instrument items.

**Framework entries (shipped):** Self-Determination Theory (Deci & Ryan); growth mindset (Dweck); locus of control (Rotter); self-efficacy (Bandura). No licensed instrument items.

**Sage reads the Library (Stage 12, shipped):** `selectLibraryEntries` + `libraryGroundingBlock` on card and Talk prompts; local provider and Nudge paraphrase those concepts in Sage's own words when the day's signal matches (never paste a For Sage sentence into Read, Do, and Talk). Existence in the file is not enough.

### Sage writing rule (root-level, inherited everywhere Sage writes)

*Reflect patterns as maybes, not facts. No "you are." No framework names. One trait at a time. Notice, don't correct.*

Exception: **Explore** may combine up to 2–3 traits per entry, and only when at least one is tied to a recent signal. Never combine the three agency axes in one entry. Same no-framework-names and exploratory-language rules still apply. This replaces per-feature prompt instructions.

### Talk output fence (shipped)

Talk's prompt already includes trait-derived paraphrase lines (fenced going in). Post-generation: `containsFrameworkTerm` on Gemini's reply before it is shown — the same check cards already use. On a match, retry once; if it still fails, fall back to honest-empty / try-again (`kind: 'empty'`) rather than showing a blocked line. The retry is a **quality pass**, not a second `claim_ai_call`. No new ME fetch — same shared row already in context. Read/Do/Nudge and Teach-Sage facts already had this fence. **Explore inherits it too** when that box ships — do not add a second unfenced Sage writer.

Banned **phrases** for the new six axes: `growth mindset`, `fixed mindset`, `locus of control`, `self-efficacy`, `self-determination`. Do **not** ban `autonomy` / `competence` / `relatedness` as standalone words — they are ordinary English and will false-positive.

**Done:** a provider that always names a type returns `kind: 'empty'` after two generates and one quota claim; a provider that names a type then recovers returns the clean retry. Sage never persists the blocked line.

### Explore (new Home inner tab — decided; later box)

Not on the You tab. Separate from daily Read/Do/Nudge. Periodic generation only (weekly, or on a meaningful trait/signal change) — never daily. Cached between regenerations. Uses the existing per-user quota. **Cap: 1 regeneration per calendar day** (a swipe-deck binge batches into one rebuild after the session, not one per axis).

Combines 2–3 traits per entry (relaxed vs. Nudge's strict 1), grounded in the Library, **only when at least one of those traits is tied to a recent signal** (a fresh fact, a knock that showed up, a Check pattern). No recent signal → stay at one trait, or generate from the 9 chips — do not manufacture a 2–3 combo from unused axes. **Never combine** `growth_mindset`, `locus_of_control`, and `self_efficacy` in one entry (they are one agency idea). Completeness is **never** an Explore input: no remaining-gap copy, no "richer because they filled the bar."

Never empty of extra-axis data: if only the 9 core onboarding fields exist, Explore still generates from that baseline and deepens as more axes fill in. Consent / quota / crisis still honest-empty (same gates as Talk). Same output fence as cards and Talk.

**Feedback loop:** simple "did this land?" on Explore entries. May only influence future phrasing / angle-selection for that user. Must **never** adjust or reclassify a trait score. Log reactions in their own table — no shared write path with traits.

### "Does Sage know you?" (recurring engagement + profile update — shipped Stage 13 part 2)

Sage checks in on one filled axis. The user taps **Still fits** or **Not quite**. Never inside Talk replies — Talk answers the typed line first. Home and Sage toys only.

Shipped:
- **Banked copy only.** High/low lines from `TRAIT_POLE_LINES` / `traitPromptLines`. No live Gemini call, no quota. A recent Nudge signal (skip pattern, knock in recent Read/Do, fact) can flavor the line as this-week; no signal → plain check-in, not a discovery.
- **Still fits** calls `confirmTraitSource` (source + `last_touched` only; number unchanged). **Not quite** is a single-axis Settings write (`self_settings`).
- **Eligible:** non-null, past 14-day cooldown, not mid-band (0.33–0.67), not a cruel pole (low `self_efficacy` / `growth_mindset` / `competence`, high `attachment_anxiety`), not the last axis shown. Round-robin among eligible; inferred and direct sit in the same pool. Oldest `last_touched` is a first-pick tiebreak only.
- **At most one per week.** Yields while any of the 15 axes is still null (completeness / game invite win). Dismiss ends that week; does not deal another axis. Home/Sage: this OR a game invite, never both the same week (`me.sage_knows.week_slot`).
- **Per-axis streak:** two consecutive Still fits on the same axis graduates it off this surface until the 3-month Settings re-ask (later). A correction resets that axis's streak.
- Confirming **inferred** data upgrades its source to **direct** but does not move the number.
- Confidence, if tracked, stays **internal**: never shown, never allowed to make the language more certain.

Still later: the 3-month Settings "still feel right?" prompt. Clock is `me.trait_touched_at` (shipped). Confirm is a touch, not a lifetime lock.

### Profile completeness indicator (You tab — decided; later box)

**Two separate things, never one bar that measures a person:**
- The 9 core chips are always **complete** after onboarding. Never shown as a percentage of a person. Never "37% profile."
- The 15 axes are a separate **depth** layer, framed as invitation not deficit (e.g. "Sage can get more specific about how you handle setbacks" — never "we don't know much yet," never "locus of control"). Inferred-from-game data **counts as filled**.

Lives on the You tab near the existing editable fields. Each depth gap is tappable into the quick-answer form or a relevant scenario card. Pressure-free: deterministic like badges, no red/urgent framing, no streak mechanic, no guilt copy. **No completeness signal on Home, Explore, Talk, widget, or push.** Do not wire it into pixel depth glow (`facts` stays that axis).

### Soft-ask budget (shipped split; completeness / 3-month / game invite UIs later)

At most **one** optional-depth prompt visible to a user at a time. Split:
- **Home/Sage:** Does-Sage-know-you OR a game invite, never both the same week.
- **You/Settings:** completeness gap OR the 3-month re-ask, never both. Completeness wins while any axis is null.

Does-Sage-know-you yields entirely while any of the 15 axes is still null.

### Reload (Dawn presentation — decided; locks are closed; later box)

Not a live reroll. At generation time (when the prior day's outcome is actually known — Check logged, or that day has closed past the 2-day window — **never** at midnight while yesterday is still open), produce 3 **paired** Read/Do variants in one call, stored for that day. User gets Reload, capped at 3 uses per day, cycling those pairs. No new model call.

Locks (not open for debate):
- All 3 variants of a given day reflect the same underlying truth. A cut day stays cut-flavored in every variant; Reload cannot be a path to a softer Do than that day's shrink-state.
- Store 3 paired cards and cycle the pair. Do not mix Read₂ with Do₁.
- Re-apply crisis gates **at display**. Invalidate the pack if a crisis flag is newer than `generated_at`. Do not serve a stored cut on a crisis-flagged day.
- Nudge stays computed at display time from live flags + history, not frozen on the pack.
- Catch-up: do not precompute a stack for unopened days. Discard packs whose `day` is now closed. On open, generate today plus each still-open catch-up slot.
- Bank days 1–3: Reload is off (those never hit the model).
- Fail the whole batch if any pair breaks cut/even or shrink; retry the one call. Do not accept 2 good + 1 soft.

Shared pools and live "generate me another" stay rejected.

### Progressive depth — games

The swipe-deck is now intake path (c) for the extra axes, not a Wave 3 token sink. Multiplayer stays later:
- **Multiplayer, once Circle exists:** "guess how your friend answered." Peer-ratings often predict real-world behavior as well as or better than self-report. A second data source only once friends are in the loop.

### Sage's coaching content — separate work from the intake (Stage 12)

The trait backbone shapes *tone* (who Sage is talking to). Coaching quality is grounded by pulling relevant Library **For Sage** lines into generation (Gottman complaint-vs-attack and small bids; Rosenberg's saw → felt → would-help → one ask — never the teaching/source copy, never the names in Sage output). **Do not fold Explore / Reload into Stage 12.**

### Guardrails (**compliance-grounded** — same weight as the Crisis spec; not a style choice)

- Self-report only. Never framed as the app diagnosing or clinically assessing anyone.
- Attachment style especially: treat as a soft, adjustable starting point, not a fixed lifetime label — attachment patterns are understood to shift over time. "Does Sage know you?" confirm/correct is the intended update path. Confirming must not ossify a score into a lifetime label — confirm never changes the number; confidence (if tracked) is internal and never affects language certainty; axes rotate; two consecutive Still fits on the same axis graduates it until the 3-month Settings prompt; that prompt still fires after confirms so silence is not treated as permanence.
- Explore's 2–3 trait combine is still exploratory language ("maybe," "noticed"), never a type profile, and only when at least one trait is event-grounded. Completeness must not become a test-to-finish: the 9 chips are already complete (not a % of a person); extra axes are a separate depth layer, invitation not deficit.
- Feedback on Explore never writes the trait table.
- No raw psychological labels shown publicly, ever — consistent with the existing rule that only a derived color (not raw answer text) appears on the You tab poster.
- Same extra-care review discipline that applies to the Crisis spec applies here before shipping — this touches real psychological categories, not just cosmetic personalization.
- "MBTI" branding avoided in UI copy (trademarked by the Myers-Briggs Company) — use generic phrasing like "your type" or "16 personality types," same approach 16Personalities uses.

**Where this fits:** Stages 9, 11, and 12 shipped (intake, axes, Library grounding). Talk output fence shipped. Stage 13 badges, Does-Sage-know-you, reveal, and ranking shipped. Remaining work is several later boxes (Explore, feedback, 3-month Settings prompt, completeness, three-path extra-axis intake, Reload, scenarios) — not one box. Locks from the Aug 28 Grok review live in the sections above.

### Delight & engagement mechanics (red-teamed this session)

**The reveal mechanic — the actual "brain rot" answer, built honestly.** A daily/recurring reveal moment on Home. Surprise is in *what* you get, never in *whether* it's worth anything. Pool: a fresh angle on this week's actual Read/Do pattern, a stored fact reflected back, or badge-proximity (1–3 remaining). Priority-pick like Nudge. Content is selected before render. Motion is one short unfold (200–400ms) tied to the tap, the same for every kind — no worth-signaling chrome, no delay-then-reveal, Reduce Motion skips to the copy. Honest-empty: if nothing real exists, there is no sealed object — a plain calm line, never a wrapped miss and never the quota "back tomorrow" cadence. **Explicitly rejected: a literal randomized-value mechanic (slot machine / loot box style) where outcomes vary in worth, including token-only versions with no real money attached.** Reasoning on record: (1) variable-ratio reinforcement — reward decoupled from real value, sometimes nothing — is the specific mechanism that makes gambling compulsive, not a metaphor for it; (2) Apple's App Store guidelines (3.1.1) require odds disclosure for randomized-reward mechanisms, and this category has drawn real legislative attention aimed at minors specifically (ATO's 16+ floor sits close to that population); (3) it would directly contradict the plan's own existing "no fake urgency, honest empty states" principle. The empty day is visible before any tap so "sometimes nothing" is not hidden behind the ritual.

**Badges** — fully fine, no reservation. Tied to real accomplished milestones (7 Checks, first "Teach Sage this" fact, a full week without a cut) — deterministic recognition of something that actually happened, not randomized chance. Different mechanism entirely from the rejected slot-machine idea.

**Game mechanics — fun and useful as the same action, not fun wrapped around a form:**
- **"Does Sage know you?"** — shipped. Sage checks in from an existing axis; user taps Still fits or Not quite (confirm does not change the number; correct / Settings edit does). Recurring, self-improving "it gets me" payoff — not a one-shot quiz, not inside Talk replies. Two Still fits on the same axis graduates it. Untouched 3+ months → passive Settings prompt (later), not a push. Locks in Understanding spec.
- **Forced-ranking sort** — shipped. Drag 4–5 short statements into order from "most me" to "least me." One axis per round, plain behavioral lines, `self_tap` write. Same optional-depth surfaces as the later swipe-deck. Soft-ask: yields if Does-Sage-know-you or completeness already has the week.
- **Scenario reaction cards, light time pressure** — quick scenario, 3-4 tap options, mild timer. Gut reactions under light time pressure tend to be more revealing than slowly deliberated ones.
- **Friend-guessing game (Circle, once it exists)** — real market precedent for this exact "who knows you best" category. A friend guesses how you'd answer, you see if they're right. Where self-report and a friend's guess *disagree* is often the most interesting signal of all — worth Sage noticing and reflecting back.

### Honest-feedback delivery (valence/cut refinement)

The app was never meant to be pure positivity — `valence`'s existing `cut` state already handles this. The opportunity is refining *delivery*, not adding negativity that doesn't exist: keep cuts specific and behavior-focused ("you've skipped 3 mornings" not "you're not trying"), always paired with a smaller next step (existing Do-shrinking rule already does this), never framed as judgment of the person. Same information, healthier delivery.

### AI capacity — multi-provider fallback + per-user quota (fold into Stage 8 floor-requirements sweep)

- `ai_usage` table: log calls per user per day.
- Config-driven per-user daily/monthly cap.
- Fallback chain across providers (router is already provider-agnostic via `MODEL_PROVIDER`) — primary fails or user hits quota → try a second provider → if all fail, honest in-app message ("Sage's out of things to say for today, back tomorrow"), never a silent break. Same "honest empty state" principle as the rest of the Dies-if list, applied to AI capacity instead of an empty Around wall.

---

## Wave 0 — before code

Apple developer account: have it. Still need: Kenney zips, one model API key (`MODEL_PROVIDER` decided), a support email you'll actually answer, domain pointed at the new build (astrollogs.com — DNS only, nothing else reused), trademark search on ATO / AsTrollOGs (do this now, not after launch — the domain being live doesn't mean the name is clear).

---

## Wave 1 — spine (ship). Finish or park.

### 1 Home shell
**Open box: home, theme, contracts.**
Three tabs: Home, Sage, You. Fake card. Fake poster. No Circle tab at all — not hidden, not present.
**Done:** Expo Go shows Home with exactly 3 tabs and no Circle tab in the tab bar.

### 2 Sign-in + ME + Theme
**Open box: auth, me, theme.**
1. What should we call you?
2. Unique @handle (reserved: ato, sage, admin, support, you, astrollogs).
3. What are you in this week? → `show_up`
4. quiet / even / loud
5. What usually knocks you off? → `knocks_you_off`
6. What do you already do every morning? → `morning_cue`
`talk_style` from Q4+Q5. Color from `show_up`. Timezone from phone, not asked.
**Done:** ME row exists with all 6 fields non-null. A duplicate handle attempt shows a clear inline error, not a silent overwrite or a crash.

### 3 Pixel
**Open box: pixel.**
Kenney Modular / Toon / 1-Bit / Animal Remastered — one family per recipe, never mixed. 6 recipes. Looks: even, tired, set, listen, glow.
**Done:** Face renders on Home from `ME.recipe`. Card is still fake data.

### 4 Dawn + Router
**Open box: dawn, router.**
**Ask once** before any model call (Apple 5.1.2 requires this). No → bank content only, Talk stays off for that user.
`check_count < 3` → bank (`first_cards.md`). `check_count >= 3` → model, via router, provider set by `MODEL_PROVIDER`. Drop repeats, vague Dos, cruel cuts before showing anything.
Generation is per-user only (existing 20/day, 200/month quota). No shared content pools, no bucketed generation, no live reroll. **Reload** (decided, later box) cycles up to 3 pre-stored paired variants of that day's pack — same truth, different words; locks in Understanding spec. System labels stay **Read** and **Do** on Home, Dawn, widget, push, and Circle — no ATOsophy/Sync in the UI.
Home may also show a third daily category, **Nudge** (internal zGlitch): personality-informed encouragement from a real recent signal only (skip pattern, a `knocks_you_off` chip that actually showed up in recent Read/Do, or a stored fact still safe to reference). Never from `talk_style` alone. If no real signal, the slot is empty. Home only — never Circle, widget, or morning push. Enforced at `peer_checks` + dropped connected SELECT on `checks`, not UI hide. Inherits cut's safety gates (not after a crisis-flagged day, not two days in a row, cruel-content filter, always with that day's Do); does not inherit cut's skip-streak valence trigger. **Explore** is a separate inner tab on Home (periodic, not a fourth daily card) — decided, later box.
**Done:** Day 4's Do and read text are not string-identical to Day 3's. For a user with `check_count < 2`, confirm (via a dev-only response flag) that content came from the bank file, not a model call.

### 5 Sage (Talk)
**Open box: talk.**
Chips: today / this week / something else. "More" surfaces the card. Crisis keyword hit → static card per Crisis spec, no model call. Talk output fence (`containsFrameworkTerm` after generate; retry once as a quality pass, not a second quota charge) **shipped** — later than Stage 5 Done.
**Done:** Two users with different `talk_style` get visibly different tone on the same prompt. A test message containing a crisis keyword returns the static resource card, verifiably without a router/model call firing (check logs).

### 6 Share + Circle
**Open box: share, circle.**
Share lives on You: QR + copy link + Share sheet.
Circle tab does not exist until a scan happens. On scan: Circle tab appears for both accounts, each showing the other's honest card and face.
**Done:** Fresh install → 3 tabs. After account A scans account B's QR (or vice versa) → both accounts now show a 4th tab (Circle) with each other visible.

### 7 Chat + Report
**Open box: chat, report.**
Chat opens only from a Circle card — never build a chat inbox that can be empty. History stays. Delete-a-line available. Block, mute, report each do something observable (see Report spec). "Teach Sage this" on a specific message = one stored fact, nothing more.
**Done:** Two test accounts exchange messages via a Circle-card-initiated thread. Blocking one hides their messages from the other and stops sending in both directions. Reporting a message creates a visible row in the Reports table.

### 8 TestFlight
**Open box: polish, push, legal, EAS, landing.**
Widget = Read + Do. Morning push = Read. Evening push = Check today. Sunday push = `this_week` recap + "you showed up N." Deep links from push into the right screen. **Push + widget is built and device-verified** (local morning/evening/Sunday, iOS WidgetKit Read+Do, App Group `group.com.emgens.ato`). **Floor requirements in this box are built and re-verified** (pushed `ea2b4f3`): Sentry wired (`ato-app`; live JS ingest; TestFlight build 6 native frames expected unsymbolicated; EAS production source-map upload is on; binary 8 native crash event `e7bed112` ingested, stack symbolication **unconfirmed**), App Privacy nutrition labels aligned with `privacy.md` + `PrivacyInfo.xcprivacy` (11 types including Date of Birth, `NSPrivacyTracking = false`), Sage labeled coach in the UI (Talk/Dawn/consent/crisis/morning push/widget/Teach Sage; Home Soft/Zen/Neon/Anime). Home in Quest appearance uses `Sage · npc` on the card only, with no disclosure sentence there. Talk router rate-limited per user server-side (`claim_ai_call`, live 20/day 200/month). Crisis card is region-aware (device locale/timezone at launch, Settings override): 988 for US/Canada only, honest fallback otherwise — never a guessed number. Privacy/terms are in `src/app/legal/`; landing is live at `ato.emgens.com`. **TestFlight build 6 shipped**; Friends Beta App Review still pending. **Binary 8** (`d40e57a9`) was submitted and installed (theme / Around / Home fix / age field verified on-device). **Binary 10** (`1d0d1041`, git `dc9ae77`) is the OTA + real-icon cut — submit that IPA, not 8 or 9. Legal loose ends (App Store Connect paste, `support@asstrollogs.com` inbox, lawyer pass) are parked in NOW.md **Public release readiness** — do not start until public launch is imminent.
Delete account **in-app** + revoke Sign in with Apple token. Ask about notifications once, after the user's first card exists — app works fully if they say no. Re-verified Aug 28, 2026: ME is hard-deleted (no flag); owned rows cascade including later tables (`ai_usage`, `going`, Stage 11 axes on ME); `account_deletions` is the surviving audit row (no FK). Apple proof is `confirmRevoked` (refresh token no longer grants), not `/auth/revoke` 200.
Landing page: ATO name, "What's your ATO?" tagline, support email (`support@asstrollogs.com` — used in copy, inbox not yet confirmed monitored), privacy policy, terms, © AsTrollOGs, Kenney asset credits. Same footer on the You tab.
Apple Sign In: hide-my-email maps to exactly one user, no fork. Bundle ID `com.emgens.ato` (App ID) / `com.emgens.ato.signin` (Services ID). Edge Function `APPLE_CLIENT_ID` for native code exchange must be the **bundle ID** (`com.emgens.ato`), not the Services ID.

Floor requirements (**compliance-grounded**, non-negotiable, not features):
- Privacy policy names Supabase and the model provider by name.
- Chat is explicitly labeled not end-to-end encrypted (until Fridge item ships).
- App Privacy nutrition labels + `PrivacyInfo.xcprivacy` filled out accurately.
- Report/block work on both Chat *and* Sage (a user can report a Sage response too).
- Sage is labeled "coach," never implies it's a person, in the UI itself, not just in a policy doc. Exception (locked): Home card in Quest appearance only may read `Sage · npc` and skip the disclosure sentence on that card. Talk, Dawn, consent, crisis, morning push, widget, and Home in Soft/Zen/Neon/Anime stay `Sage · coach` with the existing disclosure. **Compliance-grounded** — do not widen the npc exception.
- App Review notes include a demo login and a sample QR code reviewers can actually scan.
- Real app icon — not the Expo default splash. **Wired:** `ios.icon` = `./assets/AppIcon.icon` (SDK 54 Icon Composer). Fallback PNG `assets/AppIcon-fallback-1024.png` (RGB). In EAS binary 10 (`1d0d1041`); not in binary 8.
- Empty states, offline state, and "dawn missed a day" state are all designed, not just the happy path.
- Crash/error reporting via Sentry (or equivalent) wired up before submission.
- No ATT prompt (you're not tracking across apps in v1).
- Router is rate-limited per user.

**Done:** A build is installed via TestFlight on a real device. Delete-account flow actually removes the ME row and revokes the Apple token — verify both, not just the UI toast. **Re-verified Aug 28, 2026** table-by-table on the live schema: ME is a hard delete; owned rows cascade (including `ai_usage`, `going`, Stage 11 axes on ME); `account_deletions` is the retained audit row. Apple proof is `confirmRevoked`, not `/auth/revoke` 200. **Stop here.**

### Gate
You + friends, one real week, real devices. Home stayed new day to day. Dos were actually doable. Sage's tone fit each tester. Circle stayed hidden until a scan for everyone who didn't scan. The widget brought people back into the app at least once.
**Only after that gate passes** → Wave 2.

---

## Wave 1.5 — Understanding & Delight (Stages 9-14)

Not blocked on public App Store readiness. **Intentional sequencing deviation (Aug 27, 2026):** Wave 1.5 and Wave 3 both start now, in parallel, instead of waiting for the Wave 1 Gate then Wave 2 Stage 2. Stage 9 first pass is in (9 chip questions + Day 1 bank wiring). Wave 2 Stage 2 ("I'm going") is in. Stage 11 optional fast-entry is in (all 15 trait axes; direct vs inferred; `last_touched`). Stage 12 Library grounding is in. Stage 13 badges (part 1), Does-Sage-know-you (part 2), reveal (part 3), and ranking (part 4) are in. Remaining Stage 13: scenarios. Full spec detail lives in "Understanding spec" above; this section is sequencing only.

**Decided Aug 28, 2026 — later boxes, not Stage 12, not one combined box:** Explore (Home inner tab) + phrasing-only feedback; 3-month Settings prompt; intake three-path for the extra axes (core 9 unchanged); profile completeness indicator; Dawn Reload with the locks already closed. Talk output fence **shipped**. Six extra trait axes + direct-vs-inferred `trait_sources` + `last_touched` **shipped**. Library copy **shipped**. Sage reads Library For Sage lines **shipped** (Stage 12). Stage 13 badges **shipped** (7 Checks / first fact / week without a cut). Does-Sage-know-you **shipped** (banked check-in). Home reveal **shipped**. Forced ranking **shipped**. **Locks from the Aug 28 Grok review are in the Understanding spec** (Explore combine + regen cap + fence; Does-Sage-know-you confirm rules; completeness split; direct-vs-inferred `trait_sources`; Talk fence phrases + retry-is-not-quota; soft-ask budget). Do not fold remaining items into Stage 12.

### 9 Intake core
**Open box: intake, me.**
Schema + UI for the 9 required tappable onboarding fields (talk_style, show_up, knocks_you_off, morning_cue, evening wind-down, energy pattern, recovery style, support style, current focus). Replaces the 3 existing free-text fields. Self-report only, translates into the trait-backbone structure per Understanding spec.
**Done:** all 9 fields save to ME, one question per screen with progress indicator, no raw psychological labels shown publicly. **First pass shipped (Aug 27, 2026):** 9 chip screens + 5 new ME columns + Day 1 bank selection from energy_pattern/support_style with the person's `morning_cue` phrase in the Do. **Settings edit shipped:** all 9 chips are editable afterward from the You tab. Delight mechanics are still later stages.

### 10 Day 1 payoff
**Open box: intake, dawn.**
Wire new answers into check_count < 3 bank-card selection — real morning_cue phrase inserted into if-then Do text, card selection driven by energy-pattern/support-style instead of fixed sequence. No live model call needed.
**Done:** two different onboarding answer sets produce visibly different Day 1 card content from the same bank file.

### 11 Optional fast-entry
**Open box: intake.**
Skippable 16-grid / slider / close-pattern / disagreement layer, up to 4 extra questions, fully optional. Writes the first 9 nullable 0–1 ME axes (not the 9 chips). No raw diagnostic labels stored. Runtime fence on Read/Do/Nudge + Teach-Sage facts. Three-path intake UI for the extra six axes is a later box (Understanding spec).
**Done (Aug 27, 2026):** Skip after question 9 goes to Home with `complete_signup` already succeeded; optional is a separate `extra N of 4` phase; slider-sticky merge (a later type tap cannot overwrite a slider axis); untouched sliders stay null; `peer_profile` / poster / `night_snapshot` unchanged; generated cards that name a framework are dropped.
**Done (Aug 28, 2026):** all 15 axes exist on live ME with 0–1 CHECKs; `trait_sources` is direct vs inferred across those axes (`self_tap` / `self_confirm` / `self_settings` / `self_game` labels exist; three-path UI not built); `me.trait_touched_at` bumps on a successful write. A rejected inferred write does not bump it. Confirm-upgrade is `confirmTraitSource` / `confirmTraits` (source + timestamp only; never a new number).

### 12 Sage's coaching content
**Open box: talk, router.**
Ground Sage's system prompt in the Library's fence-clean **For Sage** lines (Gottman / NVC live in Conflict and Communication entries). Prompt-engineering only. Sequenced after Stage 9 so Sage has real trait data to calibrate against. Talk fence already shipped separately. **Not** Explore or Reload.
**Done (Aug 28, 2026):** a workload-heavy generated card is shaped by Workload For Sage, but Read, Do, and Talk each restate the idea in different words — they do not share a stock Library sentence. Talk on "the pile at work never ends" is grounded the same way; a flowers question does not pull Workload. Teaching/source copy never appears in the prompt or the card. `containsFrameworkTerm` still passes on Library-grounded output.

### 13 Delight mechanics (single-player)
**Open box: intake, dawn.**
Reveal card (real content only, no randomized-value mechanic), milestone badges, "Does Sage know you?" active-learning loop (confirm/correct + 3-month Settings prompt; locks in Understanding spec), forced-ranking sort, scenario reaction cards with light time pressure. Explore is a separate Home inner tab (Understanding spec), not this box's reveal card. Soft-ask budget: at most one optional-depth prompt visible at a time.
**Done (Aug 28, 2026, badges):** Home check-count chip is a collapsible milestone strip for 7 Checks, first Teach-Sage fact, and 7 consecutive calendar days without a cut. Deterministic from logged Checks and stored facts — no chance mechanic, no popup.
**Done (Aug 28, 2026, Does Sage know you?):** Home/Sage check-in from banked high/low trait lines, zero quota. Still fits / Not quite. Weekly; yields while any axis is null; cruel/mid/fresh axes excluded; two Still fits graduates that axis. 3-month Settings prompt remains later.
**Done (Aug 28, 2026, reveal):** Home tap-to-open Note. Week pattern / fact / badge-proximity, Nudge-style priority. One 300ms unfold, same motion for every kind. Reduce Motion skips to copy. Empty days are a plain line, no sealed object.
**Done (Aug 28, 2026, ranking):** Home/Sage/You drag sort, 4–5 lines, one unfilled axis. `self_tap` write. Yields if Does-Sage-know-you or a completeness claim already has the week. Scenarios remain later.

### 14 Multiplayer (friend-guessing)
**Open box: circle, intake.**
"Guess how your friend answered" — Circle-dependent, two-account testing surface.
**Done:** two connected Circle accounts can complete a guess-round and see accuracy compared.

Not in this sequence: AI capacity hardening (multi-provider fallback + quota) stays a separate public-launch backlog item, not part of Wave 1.5.

---

## Public App Store readiness (do before flipping `signup_mode` to `public` / submitting for public review)

TestFlight ≠ public. TestFlight already gates installs via Apple's own tester list — none of this blocks Stage 8 or the TestFlight gate above. This checklist is the bar for the *next* step: open App Store listing, anyone can download.

**Account & rights:**
- [ ] Apple Developer account type decided: Individual (personal legal name as seller, no entity needed) or Organization (requires a real registered legal entity + D-U-N-S number, cannot convert from Individual later — decide once, decide early if there's any chance you'll want it). Not legally required to be Organization for ATO's current scope (no payment handling in-app, no licensed health service) — this is a branding/liability call, not a compliance one.
- [ ] Trademark search on ATO / AsTrollOGs closed out (flagged in Wave 0 — confirm it actually got done, not just planned).
- [x] Kenney asset attribution page live — You-tab Settings Credits card, generated from `KENNEY_REGISTRY`. Currently Shape Characters only (the bundled pack). CC0 noted; kenney.nl + pack page linked. Other plan-allowed families are not listed until they are actually imported.
- [ ] No other third-party IP in the build (fonts, sounds, icons) without a checked license.

**Referral/access:**
- [x] Referral spec built and tested (`signup_mode` flag, invite codes, `pause_branch`/`delete_branch`).
- [ ] Conscious decision made on when to flip `signup_mode` from `invite_only` to `public` — this doesn't have to happen at App Store submission; you can ship publicly-listed but still invite-gated if you want a slower ramp.

**Legal/compliance:**
- [ ] Privacy policy + terms finalized (lawyer pass on the crisis disclaimer specifically — already flagged as outstanding in the Crisis spec).
- [ ] App Store Connect tax/banking info filled out (required before a public listing can go live, separate from the developer account itself).
- [ ] All Wave 1 TestFlight floor requirements still hold at public scale (rate limiting, Sentry, privacy labels) — a bigger user base stresses these differently than a friends-only test group did.
- [x] Sentry DSN connected (`EXPO_PUBLIC_SENTRY_DSN` in `.env.local` and EAS) and a test JS error confirmed in Issues (`ato-app`). EAS production has `SENTRY_AUTH_TOKEN` (sensitive), `SENTRY_ORG=emgens`, `SENTRY_PROJECT=ato-app`, `SENTRY_DISABLE_AUTO_UPLOAD=false`. Binary 8 native crash event `e7bed112` ingested; stack symbolication **unconfirmed**. TestFlight build 6 was built with upload disabled, so that binary stays unsymbolicated.
- [ ] Gemini API key moved off the client (Edge Function) so a patched client cannot skip `claim_ai_call()` and hit Gemini directly. Not a TestFlight blocker; required before flipping `signup_mode` to `public`.

**Done:** every box above checked, not assumed. This list gets reviewed once, deliberately — not folded silently into a Cursor handoff.

---

## Wave 2 — city (one product)

**Around, Calgary only.** A room they open on purpose. Never surfaces on Home.

- City is typed at setup, not pulled from live GPS.
- edmtrain first. Link out to RA / Shotgun / DICE for tickets — no scraping, no unified calendar you maintain by hand.
- "I'm going" is opt-in. Faces show only if they marked going and visibility allows it.
- Colors on a show: shown once ≥3 people of that color are going; hidden below that. No raw counts displayed. Heat map = venue blobs, not pins.
- Phone fetches a static `/around/{city}/weekend.json` (Supabase Storage public object). A backend job (`refresh-around` Edge Function, twice daily) pulls Edmtrain and writes that file — the phone never calls Edmtrain. Adding Edmonton later = new JSON file, same code — don't hardcode Calgary logic.
- **Stage 1 (data layer):** city typed at onboarding/Settings, weekend JSON, Around tab list, honest empty. Plumbing is in (`me.city`, `refresh-around`, public `around/{city}/weekend.json`). The first live Storage write waits on an Edmtrain client API key. Heat map stays venue blobs, not pins — not opened in Stage 2.
- **Stage 2 (I'm going + colors):** in. Opt-in `going` via `set_going`. Colors at ≥3 of a `show_up` hue; no raw counts. Faces when going + `me.visible` + not blocked. 18+ nights call `is_at_least_age(born_on, 18)`. Seeded tests use typed city `fixture` (not written to Calgary's JSON).
- 0 shows that weekend → honest empty state, never a fabricated map.
- 18+ enforcement here specifically: `is_at_least_age(me.born_on, 18)` — don't let a user who is 16/17 today show as "going" on an 18+ night. The date is already on ME; this wave only has to call the helper.

**Admin (you) sees:** opens, Checks, shares, new friend connections. Not chat message bodies. Later: on/off toggles for plugs and hosts.

Do not open plugs, hosts, or walls in this wave. City has to work while honestly empty most weekends before anything gets layered on top.

---

## Wave 3 — plug (building in parallel with Wave 1.5; Night wall unblocked — Wave 2 Stage 2 going is live)

**Paid tier.** Unlocks after 7 Checks: weekly Read, 30-day trail, more Talk. Never paywall Home, More, Check, crisis response, or the widget.

**Plugs.** Same row shape, `kind` = show | food | shop. You add and remove rows manually. No deal → no row. Not a Yelp clone.
Row shape: `kind, name, city, url, code, who (sub|everyone), starts, ends, on`.
Phone shows an ATO-price chip on that card → taps through to their page or shows the code. The app never touches payment.
0 live rows for a category → no ATO-price UI shows at all for that category.
Affiliate disclosure: say you may earn a bit, generically, until a specific brand agrees to be named (e.g. Insomniac applies, then gets a named row).

**Hosts.** You flip `host` on their ME row manually. Badge shows on their poster and Circle face. One editable note per poster (visible in Circle or on the public `/@handle` page). It overwrites, it's not a feed.

**Night wall.** Only exists if that specific show has people marked going — don't render an empty wall button for a night nobody's going to. One thread per night. Writers = people going + hosts. Live from 24h before the show to 24h after, then **locks** (read-only). History stays. "Lost & found" becomes a pinned chip for +7 days, then goes read-only too. Sort by newest. No citywide wall — every wall is scoped to one specific night. Wave 2 Stage 2 going is live, so the wall may surface with this wave.

---

## Fridge (only touch if explicitly asked for)

Real E2E encryption (libsignal or Matrix). HealthKit-informed smaller Dos. NFC. A second Sage persona. Circle-only highlight reel. Custom pixel uploads. RSS feeds. Bring-your-own-key model access. Streak flames. Live maps. Group chat. In-app Instagram-style feed. Native ticket checkout. Creator/influencer feed. Yelp-style reviews. OpenTable integration. Live "who's here right now."

---

## What you say

"Do stage 1. Spine only."

"Write sage.txt and first_cards.md, then do stage 4. Do not touch Circle."

"Do stage 8. Stop. Wait for the gate."

"Open Wave 2. Around, Calgary only. Honest empty."

"Open Wave 3. Plugs as rows. Wall only if people are going."

If any AI builds Wave 2 or 3 in the same turn as stages 1–8, send it back here.
