# Screen Isolation Plan — park everything outside the active spine

**Status: §7 Cards A-G ALL SHIPPED 2026-09-15** (commits `ecd0c49` → `449e772`),
on top of the earlier Cards 1-3 and 5. Gate green (typecheck + lint + 80 offline
checks). Not yet OTA-published — the device pass in Card G is outstanding. What
was deliberately left undone: the deletion sweep stopped at modules with no
check-script coverage (16 files); ~20 more are unreachable but still carry
verified logic in a check script, and deleting those means deleting that
coverage — emci's call, not a side effect. See §7.6.

**Earlier status: Cards 1-3 and 5 shipped 2026-09-15. §1-§6 below are the original park-only
plan and are kept as the record. §7 (added 2026-09-15, awaiting emci's OK) REVISES the
remaining work — the goal grew from "park the edges" to "ship the gated three-screen
spine via OTA while the backend is rebuilt". Where §7 and §1-§6 disagree, §7 wins.
Remaining cards are renumbered in §7.4; the old Card 4 / 6 / 7 are absorbed there.**

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

## 0. Decisions locked by emci, 2026-09-15 — do not re-litigate

1. **The daily Check loop is parked, knowingly.** `record_check` ends up with zero
   client callers. Confirmed intended; it comes back when the loop is rebuilt.
2. **Tokens: Story is free while parked.** The token system is **not designed yet** —
   emci is researching it separately. So do NOT move the earn site, do NOT write a
   balance migration, and do NOT treat the economy as real. Story generates without
   a token cost until the system is actually designed. See §4 risk 2 for mechanism.
3. **`CrisisCard` stays Active.** Not parked.
4. **`AiConsentCard` stays Active on Home**, as Insight infrastructure.
5. **`ProfileFillFold` stays Active** on Explore — it counts as part of "full profile".

**Standing reminder for emci: the ATO token system still needs to be researched and
designed from scratch.** Nothing in this plan should be read as endorsing the current
earn/spend wiring — it is placeholder economics that happens to exist in the code.

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
| 7a | `CrisisCard` | `components/crisis-card.tsx` | **ACTIVE** — emci 2026-09-15: keep. Safety surface, static copy, no model call. |
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
| 5 | `ProfileFillFold` | `explore.tsx:169` | **ACTIVE** — emci 2026-09-15: keep, counts as part of "full profile". |
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
- `crisisToday` / `crisisYesterday` -> `reveal` + `slotKind` (`index.tsx:191-269`) — **mixed.** The Reveal / Missed / Ask branches are parked, but the **crisis branch stays Active** (locked decision 3), so these two fields stay connected.
- `tracks` -> insight generator input (`index.tsx:322`) and `SageStoryFold` (`index.tsx:634`) — **both active**

**Severing method:** do not change the RPC or its shape. Stop consuming **`checks` only**. Post-park, Home reads `tracks` (Insight + Story) and `crisis*` (CrisisCard). `home_bootstrap` is called by no other screen, so narrowing it is risk-free.

**Care point for Card 4:** `slotKind` (`index.tsx:250-269`) currently picks *one* card from {crisis, missed, reveal, ask}. After parking it is no longer a chooser — it collapses to "render CrisisCard when the crisis flag is set, otherwise nothing." Rewrite it as that, per the standing edit-vs-rewrite rule; do not leave a four-branch selector with three dead arms.

### 2.2 `record_check` — hard invariant, becomes fully client-unused
Called only from the Home Check row (`index.tsx:390`) and `MissedCheckCard`. Both parked means **nothing in the client calls `record_check` any more.** CLAUDE.md lists it as a hard invariant ("the only write path for a Check"); the invariant stays true, it just stops being exercised. The daily Check loop therefore leaves the app until it is rebuilt. **Confirmed intended by emci, 2026-09-15** (locked decision 1).

### 2.3 `updateTraits` / `mergeTraitWrite` — shared across parked and active
Writers today: `QuestionsFold` (`questions-fold.tsx:351, 707`) **active**, `IntakeSweep` **active**, `FullProfileFold` (`full-profile-fold.tsx:82`) **active**, `OptionalIntakeFill` (`optional-intake.tsx:314`) **parked**, plus `AskSheet` sub-cards **parked**.

**Severing method:** never touch `lib/traits.ts` or `updateTraits`. Delete the *call sites* inside the parked components only. The shared function keeps working identically for the three active writers.

### 2.4 `fetchTraitTracks` (`lib/trait-tracks-store.ts`)
Imported by Explore, Questions, Legends (`legends.tsx:204`), Roll, dev-lab. Same rule: leave the lib alone, drop the call from parked screens.

### 2.5 `RollHistoryFold` — the one component shared across two screens
Rendered on Home (`types:['story']`) *and* Explore (`types:['legend','category']`), and reused inside `category-statement-archive-fold.tsx` and `legend-history-fold.tsx`. It is parked on **both** screens, so the component itself can be parked wholesale rather than per-call-site. Its only backend call is `fetchRevealedRollItems` (`lib/rolls/store.ts`).

### 2.6 ATO tokens — **the sharpest entanglement**
- The only *wired* earn site was `claimFullProfileComplete()` at `legends.tsx:341` (`claim_full_profile_complete`) — now unreachable, Legends is parked (Card 3). `claimOngoingRoundComplete` exists but its caller (`ongoing-round`) has zero `src/` importers.
- Spend sites: `spendAtoTokensLegendReroll` (Legends, parked), `spendAtoTokensCategoryReroll` (Categories — **active**), `spendAtoTokensQuestionReroll`. `claimStoryGenerate` -> `claim_story_generate` at `sage-story-fold.tsx:92` is **NOT a token spend** — corrected 2026-09-15, see below.

**Consequence: parking Legends removes the only connected way to earn tokens, while Categories reroll still spends them.** Categories reroll degrading to unaffordable was already accepted as non-blocking (§5.2 build order, "not a required path"). **Story is unaffected — it was never priced in ATO tokens.** `claim_story_generate` is a daily-quota guard against `ai_usage`/`app_config` (default 1/day), unrelated to the `ato_tokens` table. This was verified by reading the RPC's SQL directly (`wave22_levity_story.sql:30-84`) during Card 3 — no code change was needed for Story, and Card 4 as originally scoped (§5.2's "ship together" concern) turned out to be a no-op.

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

**Risk 2 — the token economy breaks silently (§2.6). RESOLVED: Story is free while parked.** Parking Legends removes the only wired earn site while Story and Categories reroll keep spending, which would leave Story permanently unaffordable. emci's call (2026-09-15): the token system is not designed yet, so it is not worth preserving — make Story free rather than inventing an earn path.

**Mechanism, decided at Card 4 not before:** `claimStoryGenerate()` (`lib/sage-story-store.ts:12`) calls the `claim_story_generate` RPC, which does both the token spend *and* plausibly a quota/rate guard. Do **not** blanket-remove the call — check first whether it is the only thing bounding Story generation. Preferred order: (a) if the RPC is purely a token spend, skip it client-side and generate directly; (b) if it also guards quota, keep calling it and make the price zero. A price change means a migration, which per locked decision 6 stops for emci's review. Categories reroll (`spendAtoTokensCategoryReroll`) is a *reroll*, not a required path — leaving it unaffordable is acceptable and is not a blocker.

**RESOLVED 2026-09-15, folded into Card 3's commit:** the RPC is case (b) but doesn't touch tokens at all. `claim_story_generate` (`supabase/migrations/wave22_levity_story.sql:30-84`) checks and increments a `story_daily_cap` (default 1/day) against `ai_usage`/`app_config` — no `ato_tokens` table is read or written anywhere in the Story path. Story was never actually priced in tokens, so there was no price to zero and no migration needed. This whole risk was based on a stale reading of the code; §2.6's "Spend sites" listing of Story is corrected below.

**Risk 3 — `me` is a shared god-object and this plan does not fix that.** `useMeContext` is imported by every screen including You, and `me.celebrated_milestone_ids`, `me.ato_tokens`, `me.facts`, `me.ai_consent` are all fields written by one surface and read by others. Parking severs the *calls* but leaves the *shared mutable shape*. **True screen isolation is not achievable without splitting `me` into per-feature slices, which is a deeper rewrite than this plan.** This plan reduces ripple substantially; it does not eliminate it. Anyone editing `lib/me.ts` can still break every screen at once.

**Risk 4 — `CrisisCard`. RESOLVED: keep it Active.** CLAUDE.md treats the crisis card as a hard invariant ("static — never a generated number, never a guessed region"). emci's call (2026-09-15): keep it. **Consequence for §2.1: Home must keep consuming `home_bootstrap`'s `crisisToday`/`crisisYesterday` fields after all** — so the narrowing there is to `tracks` + `crisis*`, dropping only `checks`. The rest of the `slotKind` machinery (Reveal / Missed / Ask) still goes; only the crisis branch survives.

**Risk 5 — `SettingsFold` is shared by ~15 components.** It is pure layout, so this is low-risk, but a styling change there still touches every screen. Acceptable; noted so "isolated" is not overclaimed.

**Net:** this plan buys real behavioural isolation (no parked screen writes data an active screen reads, once §2.6 is resolved) and real *call-graph* isolation. It does not buy *type* isolation, because `Me` and `TraitState` remain shared shapes. That is the honest ceiling without a deeper rewrite.

---

## 5. Suggested build order — one card per session

Convention: each card is a standalone session, `/clear` between. Per the standing cadence rule, run `check:ota-gate` plus the `reviewer` subagent **once at the end of each card**, not per file.

- **Card 0 — decisions. DONE 2026-09-15.** All five resolved; see §0. No longer blocking.
- **Card 1 — the pattern. DONE 2026-09-15.** `src/components/rebuilt-notice.tsx` (exports
  `RebuiltNotice` + `REBUILT_NOTICE_COPY`), `scripts/rebuilt-check.ts` (`PARKED_SCREENS`
  list; asserts route export, `<RebuiltNotice` rendered, zero backend reach), wired in as
  `check:rebuilt` — the gate auto-discovers `check:*`, so `ota-gate.ts` needed no edit.
  `sage.tsx` now renders the shared component; `check:sage-load` still passes unmodified.
  Adding a screen to `PARKED_SCREENS` is the whole of a later card's check work.
- **Card 2 — Around.** Whole-screen park. Zero entanglement, so this is the clean rehearsal of the full procedure end to end.
- **Card 3 — Legends (plus Roll).** Whole-screen park for both. Carries the token resolution from Card 0. Watch `nav-check.ts:170` and `legends64-check.ts`.
- **Card 4 — Home.** Largest card. Park folds 6, 7b–7d, 9, 10, 11. Keep 7a (`CrisisCard`). Narrow `home_bootstrap` consumption to `tracks` + `crisis*`, dropping `checks`. Park the `/week` route. Carries the Story-free-while-parked mechanism from §4 risk 2. Home ends as: greeting, Insight, consent, questions link, CrisisCard slot, Story.
- **Card 5 — Explore. DONE 2026-09-15.** Parked `SageTitleCard`'s Explore call site,
  `IntakeSettings`, `RollHistoryFold`'s Explore call site (`types=['legend','category']`;
  Home's `types=['story']` call site is still active — Card 4 hasn't shipped, so the
  component itself stays wired), `SageInsightSpend`, and `SageExploreObservations`. Kept
  `TraitBandsFold`, `ProfileFillFold`, `FullProfileFold`, `CategoriesFold`. `SageTitleCard`
  and `intake-settings.tsx` turned out not to be single-importer — see PROJECT_CONTEXT.md's
  Card 5 entry for the delete-vs-edit call on each. Inverted (not deleted) assertions in
  `explore-check.ts`, `wave19-check.ts`, `wave20-check.ts`, `intake-check.ts`,
  `trait-bands-check.ts`.
- **Card 6 — Questions.** Smallest of the three screens: park `OptionalIntakeFill` and `MilestoneToast`; leave `QuestionsFold` and `IntakeSweep` fully wired.
- **Card 7 — sweep plus device pass.** Full `check:ota-gate`, one real device walk of every tab confirming every parked surface reads `(Rebuilt)` and nothing reads as a crash. Then one OTA.

Cards 2–6 are *mostly* independent once Card 1 lands and can be reordered — with two
exceptions found in the 2026-09-15 red-team pass:

**5.1 `RollHistoryFold` is parked per call site, NOT wholesale.** §2.5 suggests parking the
shared component itself since both consumers are parked. Do not — gutting the component
during Card 4 (Home) would silently change Explore before Card 5 exists, which breaks the
independence the card order relies on. Follow §3.3 rule 2 instead: drop Home's call site in
Card 4, Explore's in Card 5. Only once both parents have dropped it does the component
become dead code, and per §3.3 rule 4 it is then left in place, uncalled.

**5.2 Cards 3 and 4 must ship together.** Card 3 parks Legends, removing the only wired
token *earn* site; Card 4 carries the mechanism that makes Story free. Landing Card 3 alone
leaves Story spending tokens that can no longer be earned — not a crash, but a permanently
unaffordable active feature, and a confusing state for whoever picks up the next session.
Zero live users makes this cheap, not harmless. Do not reorder these two apart.

**5.3 Scope limit on `rebuilt-check.ts`.** The generic check asserts a parked file imports
`RebuiltNotice` and has **no backend imports at all** — that is only true of *whole-file*
parks (Sage, Around, Legends, Roll, Week). Home / Explore / Questions keep legitimate
backend imports for their still-active folds, so they must never be added to
`PARKED_SCREENS`. Fold-level parks (Cards 4–6) get bespoke assertions in each screen's own
check script, following the `explore-check.ts` pattern.

---

## 6. Open questions

None outstanding — all five resolved in §0 on 2026-09-15.

The one thing deliberately left undesigned: **the ATO token system itself.** emci is
researching it separately. Until then, treat every `ato_tokens` earn/spend in the
codebase as placeholder economics, not a contract to preserve.

---

## 7. REVISION — the OTA spine flow (added 2026-09-15, NOT yet approved)

emci's goal changed shape. It is no longer only "park the edges to reduce ripple". It is:
**ship a working, honest three-screen app over OTA (JS-only) while the backend is
rebuilt from a clean slate.** Everything in §1-§6 that still serves that survives;
the rest is superseded here.

### 7.0 The flow, as stated

1. Register goes **straight to Home** — no onboarding screen in between.
2. Home **before** the full profile is complete shows **only**: the AI consent
   approvals, and a button to Questions. Nothing else.
3. **Questions** is where the full profile gets completed.
4. **After** the full profile is complete, four things unlock:
   Home "Load insight", Home "Load story", Questions "next 25 questions",
   Explore > Categories "Load categories".
5. **No AI call ever fires automatically.** Every model call is behind a user tap.
   Rationale: not UX polish — token cost. An auto-firing effect on a screen that
   every user lands on is the single most expensive bug this app can have.
6. Kept screens: **Home, Questions, Explore**. Everything else parked behind
   `(Rebuilt)`.
7. **Parked code is deleted**, not preserved, unless a kept screen still imports it.

### 7.1 New locked decisions (supersede where they conflict)

6. **Delete-by-default replaces §3.3 rule 4.** §3.3 rule 4 said a lib that ends up
   with zero importers is left in place, uncalled. emci's clean-slate call reverses
   that: **zero-importer code from a parked surface gets deleted.** Guardrail kept from
   §3.3: a lib is only deletable once *no kept screen* imports it — verified by grep,
   per file, not by assumption (`lib/around/slug.ts` is the cautionary case: parked
   Around's lib, but `lib/me.ts`, `city-picker.tsx`, `onboarding.tsx` import it). And
   deletion is its own card (§7.4 Card F), not smeared through the flow cards, or the
   diff stops being reviewable.
7. **"Parked" now means parked *and* not a place a user wanders into by accident.**
   The §0 definition (route stays registered, `(Rebuilt)` label, zero backend) is
   unchanged and still correct. Open question O-2 asks whether parked tabs should also
   leave the tab bar.
8. **One canonical `fullProfileDone` signal.** There are two today and they disagree
   (§7.3 conflict C-2). Exactly one becomes the gate for all four unlocks.
9. **OTA means JS-only.** No new dependency, no native module, no `app.json` /
   config-plugin change anywhere in this work — any of those forces a store build and
   breaks the whole premise. This is a hard constraint on every card in §7.4.

### 7.2 What already exists vs. what needs building

**Already exists, no work needed:**
- The `(Rebuilt)` pattern, the shared `RebuiltNotice` component, and the generic
  `check:rebuilt` gate (Card 1) — including the `PARKED_SCREENS` list that makes
  adding a screen a one-line change.
- Whole-screen parks already shipped: **Sage, Around, Legends, Roll** (Cards 1-3).
- Explore's fold-level park already shipped (Card 5): Today's Read, Intake settings,
  past reads, insight spend, observations are gone.
- **Questions' 25-round is already tap-gated.** `QuestionsFold` only loads from
  `handleOpen()` via the `SettingsFold` expand tap; `alwaysOpen` defaults `false` and
  `intake-sweep.tsx` does not pass it. No auto AI call here today.
- **Categories already has a tap-gated generate.** `categories-fold.tsx:222`
  (`onPress={() => void handleGenerateStatements()}`) — nothing auto-generates on
  mount. "Load categories" is largely a *labelling and gating* job, not new plumbing.
- The 50-question bank (`IntakeSweep`) and the 25-question bank are **local/static**
  for the bank path — no model call is needed to *show* questions.
- Consent already exists and is already Active on Home (`AiConsentCard`, §0 decision 4),
  and Insight is already gated on `consentGranted`.

**Needs building:**
- **B-1. A canonical `fullProfileDone`.** One exported derivation (or one persisted
  column) that Home, Questions, and Explore all read. See C-2.
- **B-2. Home's pre-profile state.** Home today renders ~12 elements; it needs a hard
  two-state split: pre-profile = consent + Questions button only; post-profile = that
  plus Load insight + Load story.
- **B-3. "Load insight" as a tap.** Home's insight `useEffect`
  (`src/app/(tabs)/index.tsx:298-365`) becomes a button handler. Keep the existing
  once-per-day / `generatingForYmd` de-dupe; only the *trigger* changes.
- **B-4. "Load story" as a tap.** `sage-story-fold.tsx:66-132` auto-runs
  `generateStoryBody` on mount once `storyReady(tracks)`. Worst offender — no tap gate
  and (unlike Insight) **no `ai_consent` check in that path**. Becomes a button; add the
  consent guard while in there.
- **B-5. Questions' "next 25 questions" button.** An explicit affordance replaces
  "expand the fold and a round appears". Also the unlock point.
- **B-6. Explore Categories "Load categories".** Relabel + gate the existing generate
  button on `fullProfileDone`.
- **B-7. Register → Home.** See C-1 — the one card with a real constraint behind it.
- **B-8. Park the remaining live non-spine surfaces**: `/week`, `/chat`,
  `(tabs)/circle.tsx`, and Home's own parked folds (the old Card 4 list). `you.tsx` is
  the exception — see O-1.
- **B-9. Per-screen gate assertions** for the three kept screens: assert the
  pre-profile Home renders no insight/story surface, and — the durable one — assert
  **no `generateText` / `ai-generate` call is reachable from a `useEffect`** in the kept
  screens. Without that check an auto-fire creeps back in three sessions from now and
  nobody notices until the bill arrives. Per §5.3, the kept screens must **never** be
  added to `PARKED_SCREENS`.

### 7.3 Conflicts in the current code

- **C-1 — "register → Home" collides with invite-only signup. Sharpest issue.**
  `_layout.tsx:76-78` hard-routes any authed user with no `me` row to `onboarding`, and
  the `me` row is created only by `createMe()` (`lib/me.ts:247`), which calls the
  **`complete_signup` RPC** with handle, `born_on`, and `invite_code`. Those are
  server-enforced (unique/reserved handle, age gate, invite validity) — this is an
  invite-only app, so they are not skippable client-side. So "straight to Home" cannot
  mean "no account step". **Recommendation: keep handle + date of birth + invite code
  *in the register screen itself*, and delete onboarding's 9-question `CoreIntakeSweep`
  step** — those questions move to Questions, where the flow says they belong. Register
  then ends at Home, with no schema change, no RPC change, and no `_layout` guard
  removal (the guard goes unreachable because `me` exists the moment register succeeds).
  The alternative — creating `me` with placeholder handle/DOB — needs an RPC/schema
  change plus emci's explicit sign-off, and would let an under-age or invite-less user
  reach Home. See Q-1.
- **C-2 — two "full profile complete" signals that disagree.** Home derives
  `fullProfileDone` from `bankTotalProgress(tracks)` (answered >= the 50-item local
  bank, `index.tsx:158-166`). Explore / Story / Categories use the stricter
  `storyReady` / `settledAxisLabel` / `missingAxis` in `lib/trait-stability.ts` (all 16
  axes *settled*). Neither is persisted; both are re-derived client-side every render.
  Under the new flow they gate the *same* four unlocks, so they cannot stay different —
  a user could hit an enabled "Load story" that then has nothing to say, or a disabled
  one after answering every question. **Recommendation: make bank progress canonical**
  (it is what Questions can actually complete and what a user can understand: "answer
  the questions"), and treat axis-settledness as *content readiness* inside the Story
  generator rather than as a gate on the button. See Q-2.
- **C-3 — Story auto-fires with no consent check** (`sage-story-fold.tsx:66-132`).
  Both a cost bug and a consent bug. Fixed by B-4.
- **C-4 — Insight auto-fires** (`index.tsx:298-365`). Consent-guarded, but still spends
  on mount. Fixed by B-3.
- **C-5 — empty-profile rendering.** Nothing currently exercises Home/Explore with a
  brand-new account whose traits are entirely empty (onboarding always seeded 9 answers
  first). Dropping onboarding's intake means the kept screens meet a genuinely empty
  `tracks` for the first time. Must be walked on device with a fresh dev-test account,
  not just typechecked — folded into Card G.
- **C-6 — check scripts that will break.** Precedent set by Cards 2/3/5: invert the
  assertion, never delete it. Expect to touch `explore-check.ts`,
  `trait-bands-check.ts`, `intake-check.ts`, `milestones-check.ts`,
  `wave19/20/21/22-check.ts` (Home/Explore fold presence), `nav-check.ts` (only if O-2
  removes tabs — it asserts on `nav-order.ts` ids), plus any onboarding/intake check
  asserting `CoreIntakeSweep` lives in `onboarding.tsx`. `sage-load-check.ts` and
  `rebuilt-check.ts` must stay green untouched.
- **C-7 — `release-mode` / `PRE_LAUNCH_DEV`.** Home's dev-tools box and the dev-test
  presets stay, but pre-profile Home must not render them for a real account — the flow
  says that state shows *only* consent + button. Keep the dev box behind
  `PRE_LAUNCH_DEV` and out of that state.
- **C-8 — already known, unchanged:** `me` stays a shared god-object (§4 risk 3) and
  `SettingsFold` stays shared (§4 risk 5). This revision fixes neither.

### 7.4 Revised card order — replaces §5 for everything not yet shipped

Cards 1-3 and 5 of the old numbering are **shipped, unchanged**. Old **Card 4** is
absorbed into Card C (its fold-park list survives; its "Story free while parked" half is
**dropped as moot** — §2.6/§4 risk 2: Story was never priced in tokens). Old **Card 6**
is absorbed into Card D. Old **Card 7** becomes Card G.

- **Card A — the `fullProfileDone` signal.** Build B-1, settle C-2. One exported
  derivation, one import in each kept screen, no UI change yet. Must be first: Cards C,
  D, E all gate on it. Small.
  *Check:* `npm run typecheck` + a new `check:full-profile-signal` asserting a single
  definition and that the divergent call sites are gone.
- **Card B — kill every auto-firing AI call.** B-3 + B-4 + C-3 + C-4, plus B-9's
  no-AI-in-`useEffect` gate check. Buttons may be unstyled placeholders here; this card
  is about the *trigger*, not the layout. Do it **before** Card C so the expensive bug
  dies at the earliest possible commit — if emci stops after one card, this is the one
  worth having. Medium.
  *Check:* new `check:no-auto-ai` + on-device confirmation that landing on Home spends
  nothing (`ai_usage` row count unchanged).
- **Card C — Home to its final two-state shape.** Old Card 4's park list (folds 6,
  7b-7d, 9, 10, 11; keep `CrisisCard` per §0 decision 3) **plus** B-2's pre/post-profile
  split **plus** the finished "Load insight" / "Load story" buttons. Narrow
  `home_bootstrap` consumption to `tracks` + `crisis*` (§2.1). Drop Home's
  `RollHistoryFold` call site — with Explore's already gone (Card 5), that component
  becomes dead and is deleted in Card F. Largest card.
  *Check:* `check:ota-gate` + bespoke Home assertions (§5.3: not `PARKED_SCREENS`).
- **Card D — Questions.** B-5's "next 25 questions" button gated on Card A's signal,
  plus old Card 6's park of `OptionalIntakeFill` and `MilestoneToast`. `QuestionsFold`
  and `IntakeSweep` stay fully wired. Small-medium.
- **Card E — Explore Categories.** B-6: relabel to "Load categories", gate on Card A's
  signal, confirm no mount-time generate. Keep `TraitBandsFold`, `ProfileFillFold`,
  `FullProfileFold`. Small.
- **Card F — park the rest, then delete.** B-8: park `/week`, `/chat`, `circle.tsx`
  (pending O-1 on `you.tsx`), then execute decision 6's deletion sweep across everything
  Cards 2-5 and C-E stranded (`lib/around/*` except `slug.ts`, `lib/legends64/*`,
  `lib/rolls/*`, `roll-history-fold.tsx`, `category-teaser.tsx`, `reveal-card.tsx`,
  `missed-check-card.tsx`, `ask-sheet.tsx` / `lib/ask.ts`, `optional-intake.tsx`,
  `updateIntake`, …). **Grep each file for kept-screen importers immediately before
  deleting it.** Medium and mechanical, but the highest-blast-radius diff in the plan —
  its own commit, so a revert is clean.
- **Card G — register → Home, then ship.** B-7 / C-1 (needs Q-1 answered first: it
  touches the auth flow), then old Card 7: full `check:ota-gate`, a fresh-account device
  walk covering C-5's empty-profile case and every parked tab reading `(Rebuilt)`, then
  one OTA.  Medium.

Sequencing rules that still hold: §5.1 (`RollHistoryFold` per call site — Card C drops
the last one) and §5.3 (kept screens never in `PARKED_SCREENS`). §5.2 (ship Cards 3+4
together) is **void** — the token concern behind it was moot.

### 7.5 Open questions for emci

- **O-1 / Q-1 — `you.tsx`.** The flow says park everything except Home, Questions,
  Explore. §1 says You is **DO NOT TOUCH**. These cannot both hold. You also hosts the
  only other `AiConsentCard` mount (§2.8) and `TalkStylePicker`. Needs emci's call.
- **O-2 — tab bar.** Parked tabs currently stay in the tab bar showing `(Rebuilt)`.
  Ship it that way, or hide Sage / Around / Legends / Circle from the bar (touches
  `nav-order.ts` + `nav-check.ts`)?
- **O-3 — register fields.** Confirm C-1's recommendation: handle + DOB + invite code
  move into register, and onboarding's 9-question step is deleted rather than relocated.

### 7.6 What actually shipped, 2026-09-15

All seven cards landed in order, one commit each, each behind a green
`check:ota-gate`.

- **Card A** — `src/lib/full-profile-gate.ts` is the one place the unlock is
  derived (`isFullProfileDone` = every bank question answered). `check:full-
  profile-signal` fails if any other file re-derives the comparison, and pins
  every consumer.
- **Card B** — Home's insight and the Story fold became taps.
  `check:no-auto-ai` follows local calls to a fixpoint, so an effect that
  generates through a helper fails too. It found a third case nobody had
  listed: `SageTitleCard` generated on mount and still reached Explore inside
  `FullProfileFold` long after Explore's own call site was parked.
- **Card C** — Home is two states. Parked: the Check row, MissedCheck, Reveal,
  Ask, RollHistory, "This week", CategoryTeaser. `record_check` now has zero
  client callers, knowingly. A third state was added after review: a failed
  `home_bootstrap` is NOT an unfinished profile, and says so with a retry.
- **Card D** — the 25-round is behind "Next 25 questions". It had been
  auto-starting from its own load effect (several chunked model calls on
  mount), and `QuestionsFold` had two more auto-load effects.
- **Card E** — Categories is one gated "Load categories" press.
- **Card F** — Circle, `/week`, `/chat` parked; You parked down to AI consent,
  sign out and delete account (App Store 5.1.1(v)), which `check:rebuilt` now
  pins. Parked tabs leave the bar, More and the edit pool while keeping hidden
  triggers, so every route still lands on its notice.
- **Card G** — register goes straight to Home. The nine core-intake taps were
  **verified not to feed trait scoring** (they write `me` context columns; no
  trait module reads them) before being deleted, per emci's Q1 condition.
  Handle / DOB / invite stay in register: `complete_signup` enforces them
  server-side and all eight intake columns are nullable, so no schema change.

**One hole the reviewer caught that the cards had not:** `routeQuestions`
allowed a paid batch once `isProfileComplete` passed (one answer per axis,
~20 questions in) while every visible unlock was still locked — so expanding
the Questions fold out of curiosity spent a call. Both gates are now required,
with a behavioural test.

**Remaining, for emci:**
1. The device pass (fresh account, empty profile) and the OTA publish.
2. The rest of the deletion sweep — ~20 unreachable modules whose behaviour a
   check script still covers (`rolls/*`, `sage-title-card`, `category-teaser`,
   `optional-intake`, `intake-settings`, `crisis-region-picker`, `sage-facts`,
   `sage-usage`, kenney credits, `milestone-toast`, `explore-panel`,
   `core-intake-sweep`, password settings, voice picker, `birthday-row`,
   `dev-unlock-gate`). Deleting them deletes that coverage too.
3. The tab bar now reads Home / Explore / You / More — **Questions is reachable
   from More and from Home's main button, but is not a visible tab**, because
   the slot engine keeps 2 pinned + 2 pool slots and parked Sage still occupies
   one. Changing that means re-doing the pinned/pool split.
4. `logCrisisFlag` has had zero callers since before this work, so nothing
   writes `crisis_flags` — which means `crisisToday` is always false and the
   `CrisisCard` kept Active per §0 decision 3 can never actually render.
   Pre-existing, not caused here, but it makes decision 3 moot until fixed.
