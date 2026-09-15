# Screen Isolation Plan — park everything outside the active spine

**Status: ASSESSMENT ONLY. Nothing implemented. Written 2026-09-15.**

Goal (emci, 2026-09-15): reduce entanglement so editing one screen cannot ripple
into another. Keep a small active spine; **park** everything else. No live users —
deleting, rewiring, and breaking parked behavior is explicitly fair game.

**"Parked"** means all four of:
1. The screen/component still exists and is still reachable (no route removal, no nav change).
2. It renders a visible **`(Rebuilt)`** label so an on-device pass never reads it as a bug.
3. Every backend call it makes today is **disconnected** — no Supabase table read/write,
   no RPC, no `ai-generate`, no `generateText`.
4. Nothing active depends on its behavior or its data shape, so it can later be
   renamed, repurposed, or rebuilt freely.

---

## 1. Full inventory

### Home — `src/app/(tabs)/index.tsx`

| # | Element | File:line | Verdict |
|---|---|---|---|
| 1 | Header greeting | `index.tsx:430` | **Active** (trivial, no backend) |
| 2 | **Today's insight card** | `index.tsx:436-505` (inline JSX + `useDailyInsight`) | **ACTIVE** |
| 3 | AI-use disclosure text | `index.tsx:514` | **Active** (static string) |
| 4 | `AiConsentCard` inline | `index.tsx:527` / `components/ai-consent-card.tsx` | **Active — forced.** See §4 risk 1 |
| 5 | "Answer a few questions" row | `index.tsx:541` | **Active** (local-only, links to Questions) |
| 6 | Check log / skip buttons | `index.tsx:566-608` -> `record_check` | **PARK** |
| 7a | `CrisisCard` | `components/crisis-card.tsx` | **PARK** (see §4 risk 4) |
| 7b | `MissedCheckCard` | `components/missed-check-card.tsx` -> `record_check` | **PARK** |
| 7c | `RevealCard` | `components/reveal-card.tsx` | **PARK** |
| 7d | `AskSheet` (Ranking / SageKnows / Scenario) | `components/ask-sheet.tsx`, `lib/ask.ts` | **PARK** |
| 8 | **`SageStoryFold` ("Story")** | `index.tsx:634` / `components/sage-story-fold.tsx` | **ACTIVE** |
| 9 | `RollHistoryFold` (`types=['story']`) | `index.tsx:635` | **PARK** |
| 10 | "This week" row -> `/week` | `index.tsx:644` | **PARK** |
| 11 | `CategoryTeaser` | `index.tsx:651` / `components/category-teaser.tsx` | **PARK** |
| 12 | Dev tools box | `index.tsx:653-707` | **Leave as-is** (dev-only, `PRE_LAUNCH_DEV`) |

### Explore — `src/app/(tabs)/explore.tsx`

| # | Element | File:line | Verdict |
|---|---|---|---|
| 1 | Header + settled-axis link | `explore.tsx:136-160` | **Active** (local calc only) |
| 2 | `SageTitleCard` in "Today's Read" fold | `explore.tsx:164` | **PARK** (makes an `ai-generate` call) |
| 3 | `IntakeSettings` | `explore.tsx:167` | **PARK** |
| 4 | **`TraitBandsFold`** — the 16-axis full profile | `explore.tsx:168` | **ACTIVE** ("full profile") |
| 5 | `ProfileFillFold` | `explore.tsx:169` | **PARK** — *judgment call, see §6 open question* |
| 6 | **`FullProfileFold`** — label is literally `How you're currently leaning` (`lib/full-profile.ts:16`) | `explore.tsx:170` | **ACTIVE** |
| 7 | **`CategoriesFold`** | `explore.tsx:171` | **ACTIVE** |
| 8 | `RollHistoryFold` (`types=['legend','category']`) | `explore.tsx:172` | **PARK** |
| 9 | `SageInsightSpend` | `explore.tsx:178` | **PARK** |
| 10 | `SageExploreObservations` (in-file, `explore.tsx:264-447`) | `explore.tsx:264` | **PARK** (`ai-generate` + `claimAiCall`) |

### Questions — `src/app/(tabs)/intake-sweep.tsx`

| # | Element | File:line | Verdict |
|---|---|---|---|
| 1 | `MilestoneToast` overlay | `intake-sweep.tsx:247` | **PARK** (writes `me.celebrated_milestone_ids`) |
| 2 | **`QuestionsFold`** — the rotating 25-question round | `intake-sweep.tsx:272` / `components/questions-fold.tsx` | **ACTIVE** |
| 3 | `OptionalIntakeFill` | `intake-sweep.tsx:285` / `components/optional-intake.tsx` | **PARK** |
| 4 | **`IntakeSweep`** — the 50-question full sweep | `intake-sweep.tsx:293` / `components/intake-sweep.tsx` | **ACTIVE** |

Note: `IntakeSweep` is also mounted standalone in `onboarding.tsx` — keeping it active is required there anyway.

### Other screens

| Screen | File | Verdict |
|---|---|---|
| **Sage** | `(tabs)/sage.tsx` | **Already parked correctly.** Zero supabase/AI imports; copy reads "Talk is being rebuilt". `scripts/sage-load-check.ts:69-84` already pins this. Only change: align its label to the `(Rebuilt)` convention. |
| **Legends** | `(tabs)/legends.tsx` | **PARK (full screen)** |
| **Around** | `(tabs)/around.tsx` | **PARK (full screen).** Identified with certainty — a real route, the local live-music / "what's around you" tab. Related: `src/app/around-lab.tsx` (dev harness, `PRE_LAUNCH_DEV`-gated) and `supabase/functions/refresh-around` (server cron that writes `around/{city}/weekend.json` to Storage; the phone only reads it). |
| **You** | `(tabs)/you.tsx` | **DO NOT TOUCH** — per instruction. |
| **Circle** | `(tabs)/circle.tsx` | Out of scope, untouched. |
| `/roll` | `(tabs)/roll.tsx` | **PARK** — it is Legends' reveal screen; parking Legends strands it. |
| `/week` | `app/week.tsx` | **PARK** — its only entry point is Home's parked "This week" row. |
| `/chat` | `app/chat.tsx` | Out of scope — Circle's, untouched. |

---

## 2. Dependency map for each parked item — the real entanglement

Only overlaps with *active* code matter. Listed worst-first.

### 2.1 `home_bootstrap` — ONE RPC feeding many Home folds
`fetchHomeBootstrap` (`lib/home-bootstrap.ts:47`) returns `{checks, tracks, crisisToday, crisisYesterday}` in a single call. Field consumers:
- `checks` -> Check row, `MissedCheckCard`, `alreadyLogged` (`index.tsx:143-153, 566-608`) — **all parked**
- `crisisToday` / `crisisYesterday` -> `reveal` + `slotKind` (`index.tsx:191-269`) — **all parked**
- `tracks` -> insight generator input (`index.tsx:322`) and `SageStoryFold` (`index.tsx:634`) — **both active**

**Severing method:** do not change the RPC or its shape. Stop *consuming* `checks` and `crisis*`. Post-park, Home reads only `tracks`. `home_bootstrap` is called by no other screen, so narrowing it is risk-free.

### 2.2 `record_check` — hard invariant, becomes fully client-unused
Called only from the Home Check row (`index.tsx:390`) and `MissedCheckCard`. Both parked means **nothing in the client calls `record_check` any more.** CLAUDE.md lists it as a hard invariant ("the only write path for a Check"); the invariant stays true, it just stops being exercised. Flagging because it means the daily Check loop is gone from the app until rebuilt. **Confirm this is intended** — "Home: Insight + Story only" implies yes.

### 2.3 `updateTraits` / `mergeTraitWrite` — shared across parked and active
Writers today: `QuestionsFold` (`questions-fold.tsx:351, 707`) **active**, `IntakeSweep` **active**, `FullProfileFold` (`full-profile-fold.tsx:82`) **active**, `OptionalIntakeFill` (`optional-intake.tsx:314`) **parked**, plus `AskSheet` sub-cards **parked**.

**Severing method:** never touch `lib/traits.ts` or `updateTraits`. Delete the *call sites* inside the parked components only. The shared function keeps working identically for the three active writers.

### 2.4 `fetchTraitTracks` (`lib/trait-tracks-store.ts`)
Imported by Explore, Questions, Legends (`legends.tsx:204`), Roll, dev-lab. Same rule: leave the lib alone, drop the call from parked screens.

### 2.5 `RollHistoryFold` — the one component shared across two screens
Rendered on Home (`types:['story']`) *and* Explore (`types:['legend','category']`), and reused inside `category-statement-archive-fold.tsx` and `legend-history-fold.tsx`. It is parked on **both** screens, so the component itself can be parked wholesale rather than per-call-site. Its only backend call is `fetchRevealedRollItems` (`lib/rolls/store.ts`).

### 2.6 ATO tokens — **the sharpest entanglement**
- The only *wired* earn site is `claimFullProfileComplete()` at `legends.tsx:341` (`claim_full_profile_complete`). `claimOngoingRoundComplete` exists but its caller (`ongoing-round`) has zero `src/` importers.
- Spend sites: `spendAtoTokensLegendReroll` (Legends, parked), `spendAtoTokensCategoryReroll` (Categories — **active**), `spendAtoTokensQuestionReroll`, and `claimStoryGenerate` -> `claim_story_generate` at `sage-story-fold.tsx:92` (**Story — active**).

**Consequence: parking Legends removes the only connected way to earn tokens, while two active surfaces (Story, Categories reroll) still spend them.** A fresh account reaches zero and Story can never be revealed. This does not crash — it degrades to a permanently-unaffordable state — but it silently breaks an active feature. **Must be resolved before parking Legends** (see §5, Card 0).

### 2.7 Milestones — `me.celebrated_milestone_ids`
Written by `legends.tsx:344` and by Questions' `MilestoneToast` path (`intake-sweep.tsx:19-20`). Both parked. `checkMilestones` (`lib/milestones.ts`) stays untouched; only the call sites go. No active reader breaks — the `legends_unlocked` toast simply never fires again.

### 2.8 `AiConsentCard` — shared Home / You
`components/ai-consent-card.tsx` is rendered on Home (`index.tsx:527`) and on `you.tsx`. You is off-limits, so the component **cannot** be parked. See §4 risk 1.

### 2.9 Around — cleanly isolated
`lib/around/*` (`fetch.ts`, `going.ts`, `ages`, `tickets`, `types`) is imported by nothing outside `around.tsx` and `around-lab.tsx`. Backend surface: a public Storage JSON read, plus RPCs `night_snapshot` and `set_going` — read by no other screen. `refresh-around` is server-side cron and is untouched by client parking. **Around is the easiest park in the codebase; it has essentially zero entanglement.**

### 2.10 Legends — `lib/legends64/*`
`archetypes`, `classify`, `generate-story`, `store` are imported only by `legends.tsx`, `legend-card.tsx`, `legend-history-fold.tsx`, and `scripts/legends64-check.ts`. Aside from tokens (§2.6) and milestones (§2.7), Legends is self-contained. It reads traits but never writes them (verified: `legends.tsx` does not import `updateTraits`/`mergeTraitWrite`).

### 2.11 Navigation registries that name these screens
- `src/lib/nav/nav-order.ts:56,58,66` — `NAV_TABS` names `around`, `circle`, `legends`; `sage` is in `PINNED_IDS:71`.
- `src/components/app-tabs.tsx:47-49` — `HIDDEN_TAB_ROUTES` names `roll`.
- `scripts/nav-check.ts:71-79,170` — asserts on `nav-order.ts` data **and** on `legends.tsx` source text (`doesNotMatch(/as Href/)`).

Because parking keeps every route registered under the same id and href, **no nav registry needs to change.** That is a deliberate property of this plan.

### 2.12 Gate scripts that will fail when screens are gutted

| Script | Asserts | In `check:ota-gate`? |
|---|---|---|
| `scripts/nav-check.ts` | `legends.tsx` source has no `as Href`; nav ids incl. `around`/`legends`/`sage` | **Yes** |
| `scripts/sage-load-check.ts` | `sage.tsx` exports a route, no supabase/AI imports, no consent UI | **Yes** |
| `scripts/legends64-check.ts` | pure logic in `lib/legends64/*`, not the screen | **Yes** |
| `scripts/around-check.ts` | `supabase/functions/refresh-around/*`, not the screen | **Yes** |
| `scripts/explore-check.ts`, `wave21/22-check` | Explore contains `CategoriesFold`, no `/categories` string | **Yes** |
| `around-going-check`, `around-going-live-check` | live RPC contract | No (live-only) |

Any check asserting a *parked* fold's presence must be **inverted, not deleted** — the same convention already used for the `/categories` retirement (see PROJECT_CONTEXT T-E1).

---

## 3. The `(Rebuilt)` placeholder pattern

**Recommendation: one reusable component plus a per-screen gutting rule. Not per-screen bespoke placeholders.**

### 3.1 The component
New file `src/components/rebuilt-notice.tsx`:

```tsx
export function RebuiltNotice({ title, note }: { title: string; note?: string })
```

Renders a `SettingsFold`-styled card:
- a heading: `` `${title} (Rebuilt)` ``
- a fixed body line, exported as a constant so checks can grep it:
  `REBUILT_NOTICE_COPY = 'This is being rebuilt. Nothing is running behind it yet.'`

It imports **only** `themed-text`, `themed-view`, `hooks/use-theme`, `lib/theme/chrome`. No supabase, no lib data, no props carrying live data. That import restriction is the whole point and is machine-checkable.

This mirrors the pattern already proven on `sage.tsx:31-63` ("Talk is being rebuilt"), which `scripts/sage-load-check.ts` already pins. We are generalising an existing, working pattern rather than inventing one.

### 3.2 Two parking modes
- **Whole-screen park** (Legends, Around, Roll, Week): replace the screen body with `<RebuiltNotice title="Legends" />`. Delete every import of data libs from that file. The route, its default export, and its nav registration stay untouched.
- **Fold-level park** (individual Home/Explore/Questions folds): replace the fold's JSX with `<RebuiltNotice title="Today's Read" />` **at the parent screen**, and delete the now-unrendered fold's call sites. Prefer deleting the parked fold's own file entirely where nothing else imports it (`CategoryTeaser`, `SageInsightSpend`, `IntakeSettings`, `ProfileFillFold`, `OptionalIntakeFill` are all single-importer) — per the standing "edit vs. rewrite" rule, retired code gets deleted, not preserved.

### 3.3 How backend calls get disconnected without breaking active screens
The rule, in order of preference:

1. **Never modify a shared lib function.** `updateTraits`, `fetchTraitTracks`, `record_check`, `home_bootstrap`, `claimAiCall`, `generateText` all stay exactly as they are.
2. **Delete the call site, not the callee.** Parking is subtraction at the screen/component layer only.
3. **Narrow consumption, don't narrow contracts.** `home_bootstrap` keeps returning four fields; Home just stops reading three of them.
4. **A lib that ends up with zero importers is left in place, uncalled**, and logged here — except where it is unambiguously dead (`lib/around/*`, `lib/legends64/*` once Legends is gutted). Deleting those is a separate, later decision; parking should not also be a deletion pass, or the diff becomes unreviewable.
5. **One new gate check per parked screen**, modelled on `sage-load-check.ts`: assert the route still exports a component, assert the file contains `RebuiltNotice`, and assert it imports no `supabase` / `generateText` / `claimAiCall` / RPC helper. This is what makes "disconnected" a durable property instead of a one-time cleanup that drifts back.

---

## 4. Honest read — does this actually achieve isolation?

**Mostly yes, with four places where it genuinely does not.**

**Where it genuinely works:** Around (§2.9) and Legends (§2.10) are near-perfectly isolatable — their libs have no active importers, they write no trait data, and their routes stay registered so nav is untouched. Explore's parked folds are all single-importer components. This is a real, cheap win.

**Risk 1 — `AiConsentCard` cannot be parked, and Insight depends on it.** The card lives on both Home and You; You is off-limits. Worse, the *active* Insight card is gated on `consentGranted`. So Home cannot be reduced to literally "Insight + Story" — the consent card is load-bearing infrastructure for Insight. **Recommendation: keep it on Home, tagged Active, and treat it as part of the Insight feature rather than a separate element.** The alternative — consent grantable only from You — makes Home dead for any new account and is worse. This is the one place the stated scope has to bend.

**Risk 2 — the token economy breaks silently (§2.6).** Parking Legends removes the only wired earn site while Story and Categories reroll keep spending. Nothing crashes; Story just becomes permanently unaffordable. **This is not solvable by parking alone.** Options: (a) make Story free while parked, (b) grant a standing balance server-side, (c) move the earn onto an active surface such as finishing the 50-question sweep. (c) is the most honest but is a real feature change, not a park. **Needs emci's call.**

**Risk 3 — `me` is a shared god-object and this plan does not fix that.** `useMeContext` is imported by every screen including You, and `me.celebrated_milestone_ids`, `me.ato_tokens`, `me.facts`, `me.ai_consent` are all fields written by one surface and read by others. Parking severs the *calls* but leaves the *shared mutable shape*. **True screen isolation is not achievable without splitting `me` into per-feature slices, which is a deeper rewrite than this plan.** This plan reduces ripple substantially; it does not eliminate it. Anyone editing `lib/me.ts` can still break every screen at once.

**Risk 4 — parking `CrisisCard` removes a safety surface.** CLAUDE.md treats the crisis card as a hard invariant ("static — never a generated number, never a guessed region"). It is currently a Home slot and therefore falls outside "Insight + Story only". **Recommendation: do not park it.** Keep it rendering from a simple local flag, or keep just the `crisis*` fields of `home_bootstrap` connected for it alone. It is static copy with no model call, so it costs nothing to keep, and removing it should be a deliberate decision rather than a side effect of a layout call. **Flagging rather than deciding.**

**Risk 5 — `SettingsFold` is shared by ~15 components.** It is pure layout, so this is low-risk, but a styling change there still touches every screen. Acceptable; noted so "isolated" is not overclaimed.

**Net:** this plan buys real behavioural isolation (no parked screen writes data an active screen reads, once §2.6 is resolved) and real *call-graph* isolation. It does not buy *type* isolation, because `Me` and `TraitState` remain shared shapes. That is the honest ceiling without a deeper rewrite.

---

## 5. Suggested build order — one card per session

Convention: each card is a standalone session, `/clear` between. Per the standing cadence rule, run `check:ota-gate` plus the `reviewer` subagent **once at the end of each card**, not per file.

- **Card 0 — decisions (no code).** Resolve §6's open question, Risk 2 (tokens), Risk 4 (crisis card), and §2.2 (Check loop goes away). Short, emci-driven. **Blocks every other card.**
- **Card 1 — the pattern.** Build `RebuiltNotice` plus `scripts/rebuilt-check.ts` (generic: for each file in a `PARKED_SCREENS` list, assert `RebuiltNotice` present and no backend imports). Add to `check:ota-gate`. Prove it on `sage.tsx` by aligning Sage's existing placeholder to the shared component. Smallest possible first card, and it de-risks all the rest.
- **Card 2 — Around.** Whole-screen park. Zero entanglement, so this is the clean rehearsal of the full procedure end to end.
- **Card 3 — Legends (plus Roll).** Whole-screen park for both. Carries the token resolution from Card 0. Watch `nav-check.ts:170` and `legends64-check.ts`.
- **Card 4 — Home.** Largest card. Park folds 6, 7b–7d, 9, 10, 11 (and 7a only if Card 0 says so); narrow `home_bootstrap` consumption to `tracks`; park the `/week` route. Home ends as: greeting, Insight, consent, questions link, Story.
- **Card 5 — Explore.** Park `SageTitleCard`, `IntakeSettings`, `RollHistoryFold`, `SageInsightSpend`, `SageExploreObservations`, and `ProfileFillFold` (pending §6). Invert, don't delete, any `explore-check`/`wave21`/`wave22` assertions that break.
- **Card 6 — Questions.** Smallest of the three screens: park `OptionalIntakeFill` and `MilestoneToast`; leave `QuestionsFold` and `IntakeSweep` fully wired.
- **Card 7 — sweep plus device pass.** Full `check:ota-gate`, one real device walk of every tab confirming every parked surface reads `(Rebuilt)` and nothing reads as a crash. Then one OTA.

Cards 2–6 are independent of each other once Card 1 lands, so they can be reordered freely if emci wants Home first.

---

## 6. Open question for emci

**Explore's "full profile" and "how you're currently leaning" are two different components, and a third sits between them.**
- `FullProfileFold` is literally labelled `How you're currently leaning` (`lib/full-profile.ts:16`) — clearly Active.
- `TraitBandsFold` is the 16-axis profile view — read as "full profile", Active.
- `ProfileFillFold` is the progress/CTA toward *completing* that profile. It is arguably part of "full profile" and arguably a separate nudge. **Defaulted to PARK in the tables above; one word from emci flips it.**
