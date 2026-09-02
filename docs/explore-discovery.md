# Explore — discovery

Read-only search of this repo (code, comments, TODOs, markdown). No reconstruction of a Co-Star-like screen beyond what the files actually say.

**Summary:** Explore is specified as a later Wave 1.5 box (Home inner tab, periodic Sage observations). There is no route, component, filename, SQL table, or comment in `src/` that implements or stubs it.

---

## 1. Files / routes / components named "explore"

**None in code.** Grep of `src/` for `Explore` / `explore` returned 0 matches. Expo routes under `src/app/` have no `explore` segment. No `explore` table or RPC in `supabase/migrations/`. Glob `**/*explore*` matched only this discovery note.

---

## 2. Docs mentioning Explore as a planned feature

All mentions are **plan text, not built**. Source of truth is `docs/archive/OLD_PLAN.md` (Understanding spec). Tracked docs repeat “decided, not built.”

### `docs/archive/OLD_PLAN.md`

**Inventory table (line 37):**

> | Explore | Home inner tab | Periodic Sage observations (weekly, or on a meaningful trait/signal change) — not daily. Cached between regenerations. Existing per-user quota. Cap: **1 regeneration per calendar day**. Combines 2–3 traits only when at least one is tied to a recent signal (fact / knock / Check pattern); never the three agency axes (`growth_mindset`, `locus_of_control`, `self_efficacy`) together. Library-grounded. Same output fence as cards/Talk. Completeness is never an Explore input. Never empty of extra-axis data: the 9 core chips are enough. Separate from Read/Do/Nudge and from the You tab. Decided; later box. |

**A normal day (line 65):**

> Widget: Read + if-then Do. Home: face from yesterday's Check, one line in their style (lift / even / cut), one finishable Do, optional Nudge when a real signal exists, More → Sage. Inner tab **Explore** (periodic, not daily). Evening: Check **today** (did/skip). Face moves. Result strip. Stop. Reload, when built, cycles stored variants of today's pack — it is not a new dawn.

**Rules (lines 90, 93, 95):**

> Sage: reflect more than ask, ~4 sentences, coach not doctor. Root writing rule, inherited everywhere Sage writes: *Reflect patterns as maybes, not facts. No "you are." No framework names. One trait at a time. Notice, don't correct.* Explore may combine 2–3 traits per entry **only when at least one is tied to a recent signal**; never combine `growth_mindset` + `locus_of_control` + `self_efficacy` in one entry; the other clauses still apply. Crisis keyword hit → static resource card (see Crisis spec below), stop, no model call.

> You tab = poster (name, @handle, show_up visibility label, QR, Share — no large pixel; the live face is the nav companion; name appears once, on the poster). Settings below the fold: the 9 identity chips are editable (same chip UI as onboarding), plus appearance / credits. Profile completeness (decided; later box) lives near those fields as **two separate things**: the 9 core chips are always complete (never shown as a percentage of a person); the 15 axes are a separate depth layer, invitation not deficit. No completeness signal on Home, Explore, Talk, widget, or push. Sage reply room is shown as `X of [limit]` (e.g. `6 of 20 today`) with no "AI" or "tokens" in the copy — compact on Sage, collapsed by default in Settings. The crisis-line region picker is a collapsible reference at the bottom of Settings, above credits; it is not the active Talk crisis card.

> Home may show a third daily category, **Nudge**, from a real recent signal only. Empty when there isn't one. Never Circle, widget, or morning push. **Explore** is a separate inner tab on Home, not a fourth daily card and not on the You tab. Completeness is never an Explore input. Explore inherits the same output fence; regen cap is 1 per calendar day.

**Home box table (line 121):**

> | Home | card | Check **today** (did/skip) + result strip. Optional Nudge. Explore is a separate inner tab (periodic). Pixel is the global nav companion, not inline on Home. |

**ME never stores (line 138):**

> **ME never stores:** guessed vibes, raw chat logs, raw HealthKit data, a model's freeform narrative about the user. Explore "did this land?" reactions live in their own table — never a write path into trait scores.

**Sage writing rule exception (line 269):**

> Exception: **Explore** may combine up to 2–3 traits per entry, and only when at least one is tied to a recent signal. Never combine the three agency axes in one entry. Same no-framework-names and exploratory-language rules still apply. This replaces per-feature prompt instructions.

**Talk fence (line 273):**

> Talk's prompt already includes trait-derived paraphrase lines (fenced going in). Post-generation: `containsFrameworkTerm` on Gemini's reply before it is shown — the same check cards already use. On a match, retry once; if it still fails, fall back to honest-empty / try-again (`kind: 'empty'`) rather than showing a blocked line. The retry is a **quality pass**, not a second `claim_ai_call`. No new ME fetch — same shared row already in context. Read/Do/Nudge and Teach-Sage facts already had this fence. **Explore inherits it too** when that box ships — do not add a second unfenced Sage writer.

**Full Explore section (lines 279–287):**

> ### Explore (new Home inner tab — decided; later box)
>
> Not on the You tab. Separate from daily Read/Do/Nudge. Periodic generation only (weekly, or on a meaningful trait/signal change) — never daily. Cached between regenerations. Uses the existing per-user quota. **Cap: 1 regeneration per calendar day** (a swipe-deck binge batches into one rebuild after the session, not one per axis).
>
> Combines 2–3 traits per entry (relaxed vs. Nudge's strict 1), grounded in the Library, **only when at least one of those traits is tied to a recent signal** (a fresh fact, a knock that showed up, a Check pattern). No recent signal → stay at one trait, or generate from the 9 chips — do not manufacture a 2–3 combo from unused axes. **Never combine** `growth_mindset`, `locus_of_control`, and `self_efficacy` in one entry (they are one agency idea). Completeness is **never** an Explore input: no remaining-gap copy, no "richer because they filled the bar."
>
> Never empty of extra-axis data: if only the 9 core onboarding fields exist, Explore still generates from that baseline and deepens as more axes fill in. Consent / quota / crisis still honest-empty (same gates as Talk). Same output fence as cards and Talk.
>
> **Feedback loop:** simple "did this land?" on Explore entries. May only influence future phrasing / angle-selection for that user. Must **never** adjust or reclassify a trait score. Log reactions in their own table — no shared write path with traits.

**Guardrails (lines 348–349):**

> - Explore's 2–3 trait combine is still exploratory language ("maybe," "noticed"), never a type profile, and only when at least one trait is event-grounded. Completeness must not become a test-to-finish: the 9 chips are already complete (not a % of a person); extra axes are a separate depth layer, invitation not deficit.
> - Feedback on Explore never writes the trait table.

**Where this fits (line 354):**

> **Where this fits:** Stages 9, 11, and 12 shipped (intake, axes, Library grounding). Talk output fence shipped. Stage 13 badges, Does-Sage-know-you, reveal, ranking, and scenarios shipped. Remaining work is several later boxes (Explore, feedback, 3-month Settings prompt, completeness, three-path extra-axis intake chooser, Reload) — not one box. Locks from the Aug 28 Grok review live in the sections above.

**Nudge vs Explore (line 414):**

> Home may also show a third daily category, **Nudge** (internal zGlitch): personality-informed encouragement from a real recent signal only (skip pattern, a `knocks_you_off` chip that actually showed up in recent Read/Do, or a stored fact still safe to reference). Never from `talk_style` alone. If no real signal, the slot is empty. Home only — never Circle, widget, or morning push. Enforced at `peer_checks` + dropped connected SELECT on `checks`, not UI hide. Inherits cut's safety gates (not after a crisis-flagged day, not two days in a row, cruel-content filter, always with that day's Do); does not inherit cut's skip-streak valence trigger. **Explore** is a separate inner tab on Home (periodic, not a fourth daily card) — decided, later box.

**Completeness vs Explore (line 310):**

> Lives on the You tab near the existing editable fields. Each depth gap is tappable into the quick-answer form or a relevant scenario card. Pressure-free: deterministic like badges, no red/urgent framing, no streak mechanic, no guilt copy. **No completeness signal on Home, Explore, Talk, widget, or push.** Do not wire it into pixel depth glow (`facts` stays that axis).

**Stage 12 (line 342):**

> The trait backbone shapes *tone* (who Sage is talking to). Coaching quality is grounded by pulling relevant Library **For Sage** lines into generation (Gottman complaint-vs-attack and small bids; Rosenberg's saw → felt → would-help → one ask — never the teaching/source copy, never the names in Sage output). **Do not fold Explore / Reload into Stage 12.**

**Decided Aug 28 (line 465):**

> **Decided Aug 28, 2026 — later boxes, not Stage 12, not one combined box:** Explore (Home inner tab) + phrasing-only feedback; 3-month Settings prompt; intake three-path for the extra axes (core 9 unchanged); profile completeness indicator; Dawn Reload with the locks already closed. Talk output fence **shipped**. Six extra trait axes + direct-vs-inferred `trait_sources` + `last_touched` **shipped**. Library copy **shipped**. Sage reads Library For Sage lines **shipped** (Stage 12). Stage 13 badges **shipped** (7 Checks / first fact / week without a cut). Does-Sage-know-you **shipped** (banked check-in). Home reveal **shipped**. Forced ranking **shipped**. Scenario swipe-deck **shipped**. **Locks from the Aug 28 Grok review are in the Understanding spec** (Explore combine + regen cap + fence; Does-Sage-know-you confirm rules; completeness split; direct-vs-inferred `trait_sources`; Talk fence phrases + retry-is-not-quota; soft-ask budget). Do not fold remaining items into Stage 12.

**Stage 12 open box (line 485):**

> Ground Sage's system prompt in the Library's fence-clean **For Sage** lines (Gottman / NVC live in Conflict and Communication entries). Prompt-engineering only. Sequenced after Stage 9 so Sage has real trait data to calibrate against. Talk fence already shipped separately. **Not** Explore or Reload.

**Stage 13 open box (line 491):**

> Reveal card (real content only, no randomized-value mechanic), milestone badges, "Does Sage know you?" active-learning loop (confirm/correct + 3-month Settings prompt; locks in Understanding spec), forced-ranking sort, scenario reaction cards with light time pressure. Explore is a separate Home inner tab (Understanding spec), not this box's reveal card. Soft-ask budget: at most one optional-depth prompt visible at a time.

**Co-Star (line 59) — non-goal, not an Explore description:**

> Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp.

**Library row (line 39) — last clause:**

> Sage generation (Read/Do/Talk) may use only **For Sage** paraphrase lines, and only when a knock, filled trait, fact, or typed line connects — never teaching/source copy, never a visible "library" section.

### `docs/NOW.md`

Line 68:

> **Decided Aug 28, 2026 (plan, not built — later boxes, not Stage 12):** Explore as a Home inner tab; intake three-path for extra axes (core 9 unchanged); profile completeness indicator; Dawn Reload with locks already closed. **Grok review locks are in archive/OLD_PLAN.md** (Explore 2–3 requires a recent signal + no three-agency combo + fence + 1 regen/day; Does-Sage-know-you confirm never moves the number; completeness is 9-complete vs 15-depth, not one % of a person; Talk fence retry is not a second quota charge; banned phrases for the new six, not autonomy/competence/relatedness as words; soft-ask budget of one). archive/OLD_PLAN.md is a working reference, not a locked spec — these are recorded there as current design.

Line 71:

> - Wave 1.5 later boxes — Explore, completeness indicator, 3-month Settings prompt (Stage 13 delight is in)

Line 96:

> - **Decided, later Wave 1.5 boxes (see OLD_PLAN Understanding spec):** three-path extra-axis intake (play path shipped as scenarios); Explore + phrasing-only feedback; 3-month Settings prompt; completeness indicator (9 complete / 15 depth); Dawn Reload. Library copy, Sage-reads-Library (Stage 12), Stage 13 badges, Does-Sage-know-you check-in, Home reveal, forced ranking, scenario swipe-deck, six extra axes, source rank, `last_touched`, confirm-upgrade lock, and Talk output fence shipped. Locks from the Aug 28 Grok review are in that spec (do not reopen in a later box).

Line 115:

> Open new Cursor chat. Founder codes + access requests are in. Landing form is live on ato.emgens.com. `/dev-lab` approve emails a single-use code (`RESEND_API_KEY` is set; live approve returned `emailed: true`). Next Wave 1.5 work: Explore, completeness, 3-month Settings. Wave 3 (plugs + Night wall) is unblocked now that going exists. Confirm binary 10 submitted/installed if not already done.

### `docs/ME.md`

From line 11:

> Plan framing (Aug 28): archive/OLD_PLAN.md is a working reference, not a locked spec. Decided in that file, not built: Explore, three-path extra-axis intake chooser, completeness indicator (9 complete / 15 depth), Dawn Reload, 3-month Settings prompt. Six extra axes, source rank, `last_touched`, confirm-upgrade lock, Talk fence, Library copy, Stage 12 grounding, Stage 13 badges, Does-Sage-know-you (banked check-in, Still fits / Not quite), Home reveal, forced ranking, and scenario swipe-deck shipped. Grok review locks (Explore combine, Does-Sage-know-you, fence phrases/quota, soft-ask budget) are in the Understanding spec. Next Wave 1.5 work: Explore, completeness, 3-month Settings.

From line 19:

> Next Wave 1.5 work: Explore, completeness, 3-month Settings. archive/OLD_PLAN.md is a working reference — Aug 28 design (Explore, three-path intake chooser, Reload) and the Grok review locks are recorded there; extra axes + source rank + confirm-upgrade lock + Talk fence + Library copy + Stage 12 grounding + Stage 13 badges + Does-Sage-know-you + Home reveal + ranking + scenarios have shipped.

### `docs/BUSINESS.md`

From line 27:

> Explore / three-path intake / Reload are decided in that file, not built. Does-Sage-know-you check-in is in. Aug 28 Grok review locks (Explore combine, Does-Sage-know-you, completeness split, Talk fence, soft-ask budget) live in the Understanding spec. Next Wave 1.5 work remains Explore / completeness / 3-month Settings (Stage 13 badges, Does-Sage-know-you, reveal, ranking, and scenarios shipped).

**Not found in:** `src/` comments, `AGENTS.md`, `landing/`, `src/app/copy/`, `docs/copy-audit.md`, `docs/sage-copy-pass2-source.md`, `docs/mostme-gutcall-source.md`, `docs/stage8-audit.md`.

---

## 3. Existing screens that might be Explore under another name

**None found that match the spec** (Home inner tab of periodic Sage observations combining 2–3 traits, cached, 1 regen/day, “did this land?” table).

Surfaces the spec **names as not Explore**, so they are not aliases:

| What exists | Path | Spec relation |
|---|---|---|
| Home daily Read / Do / Nudge | `src/app/(tabs)/index.tsx` | Explore is “not a fourth daily card” and “separate from daily Read/Do/Nudge.” |
| Home reveal (Note unfold) | same Home route; Stage 13 reveal | “Explore is a separate Home inner tab (Understanding spec), not this box's reveal card.” |
| Library markdown (no visible library UI) | `src/app/copy/library.md` | “never a visible library section”; Stage 12 is “**Not** Explore or Reload.” |
| Does Sage know you | Home/Sage toys | Banked Still fits / Not quite; zero quota; not periodic generated observations. |
| You tab poster + Settings chips | `src/app/(tabs)/you.tsx` | Spec: “Not on the You tab.” You.tsx has no OCEAN / attachment / conflict axis readout. |
| Forced ranking / Gut-call scenarios | Home / Sage / You toys | Intake writes (`self_tap` / `self_game`), not a generated dive-deep view. Spec puts them in Stage 13, not Explore. |
| Growth-tier pixel markers | `src/components/growth-markers.tsx` | Presence/depth glow on the face; not an Explore tab. |

No hidden `/explore` route, no unshipped component, no Home inner-tab UI, no reaction table for “did this land?”.

---

## Current state

| Item | State |
|---|---|
| Explore UI / route / inner tab | **does not exist** |
| Explore stub / TODO in code | **does not exist** |
| Explore reaction table | **does not exist** (specified only) |
| Spec | **exists** — `docs/archive/OLD_PLAN.md`, status “Decided; later box” |
