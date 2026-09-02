# Eight Quick Taps — copy review (DRAFT, not applied)

Source: `CORE_INTAKE_QUESTIONS` in [src/lib/intake.ts](../src/lib/intake.ts). This is a
review of wording only — no chip *values* (stored ids) change, only prompts, helper
lines, and chip *labels* shown on screen. Nothing here is applied to code yet.

Format per question: **current** → **suggested**, then flags.

---

## Q1 — talk_style

**Current prompt:** "Quiet, even, or a bit more direct — you already picked this, editable anytime."
**Chips:** Quiet / Even / Loud

**Flag:** the prompt describes the third option as "a bit more direct," but the chip
itself says "Loud." Those aren't the same word, and "direct" undersells what "loud"
actually produces (energetic, exclamation points, punchy). Someone reading the prompt
and picking based on it may be surprised by the Loud chip's actual effect.

**Suggested prompt:** "Quiet, even, or loud — you already picked this at signup; change it anytime."

Reason: names the real chip word so the prompt and the chips agree, and "you already
picked this at signup" is more concrete than "you already picked this" (which doesn't
say *when* or *why* it's showing up again).

---

## Q2 — show_up

**Current prompt:** "What's this week feel like? This colors your face on Home."
**Chips:** Building something / Getting through it / Finding my feet / Showing up anyway / Clearing space / Running hot

**Flag:** "What's this week feel like?" is a grammar slip — "what's" = "what is," so
this reads as "what is this week feel like." Minor, but it's the kind of thing that
reads as a typo on a screen this visible.

**Suggested prompt:** "What does this week feel like? This colors your face on Home."

Chips are fine as-is — concrete, varied, no overlap.

---

## Q3 — knocks_you_off

**Current prompt:** "What actually gets in the way of a good day? Pick everything that's true, not just one."
**Chips:** Sleep / Workload / People / conflict / Health / Money / Something else

No flags. Clear question, clear multi-select instruction, chips are concrete and
non-overlapping.

---

## Q4 — morning_cue

**Current prompt:** "The one thing you already do every morning — your daily nudge hangs off this."
**Chips:** After I make coffee / After I brush my teeth / After I check my phone / After I get out of bed / After I pour water / After I put on music / After I take a shower

**Flag (real, not just style):** "your daily nudge hangs off this" is inaccurate.
"Nudge" is an existing, specific in-app term — a separate Home-screen element
(`src/lib/voice/nudge.ts`, user-facing label "Nudge") triggered by skip patterns,
knocks, or remembered facts. `morning_cue` actually anchors the **Do** line of the
daily card, not the Nudge. Someone who later sees an actual Nudge on Home may be
confused about which feature this question was describing.

**Suggested prompt:** "The one thing you already do every morning — today's Do hangs off this."

("Do" is also an existing in-app term for the actionable line on the daily card, so
this stays accurate without introducing new vocabulary.)

---

## Q5 — evening_wind_down

**Current prompt:** "What already happens at the end of your day? The evening Check nudge hangs off this."
**Chips:** When I put my phone down / When I shut off the lights / When I get in bed / When I wash up / When I stretch / When I watch one thing

**Flag (same terminology issue as Q4):** "evening Check nudge" isn't a real in-app
name — the actual feature is the evening push notification reminding the user to log
today's Check (`eveningPush()` in `src/lib/push-copy.ts`). Calling it a "nudge" here
collides with the unrelated Nudge feature from Q4/Home.

**Suggested prompt:** "What already happens at the end of your day? Your evening reminder to log Check hangs off this."

**Separate flag (grammar, affects generated copy, not just this screen):** the stored
chip *values* are first-person infinitives ("put my phone down," "shut off the
lights"), matching their "When I …" chip labels. But downstream copy (the evening
push body, as of this fix) drops them into a second-person template: "When you put
**my** phone down" — wrong pronoun. This same pattern already existed for
`morning_cue` ("After you brush **my** teeth") before this review. Not something to
silently fix in this pass, since it touches stored data shapes, but worth a deliberate
follow-up: either store cues without a possessive ("put the phone down," "brush
teeth") or write the downstream templates as "When it's time to {cue}" to sidestep
pronoun agreement entirely.

---

## Q6 — energy_pattern

**Current prompt:** "When do you have the most energy during the day?"
**Helper:** "Helps us pick a good time to check in with you."
**Chips:** Morning / Afternoon / Evening / Night owl

No flags. Clear, and the helper line explains the "why" without over-explaining.

---

## Q7 — support_style

**Current prompt:** "When you're in it, what helps more?"
**Chips:** A nudge to keep going / Space to sit with it / Someone to listen / A plan to fix it

**Flag:** "When you're in it" is vague on its own — "in it" isn't defined anywhere on
screen (in what? a bad day? a hard moment?). It reads fine in context right after Q3
(knocks) and Q5 (evening), but as a standalone screen it's the least concrete prompt
of the eight.

**Flag (terminology, smaller than Q4/Q5):** the first chip is literally labeled "A
nudge to keep going," which — unlike Q4/Q5 — is describing a *preference*, not
naming a feature, so it's less likely to confuse. Still sits oddly next to the real
Nudge feature; consider whether it's worth avoiding the word here too for consistency.

**Suggested prompt:** "When things get hard, what actually helps?"

---

## Q8 — current_focus

**Current prompt:** "Right now you're mostly trying to…"
**Chips:** Build a habit / Get through something hard / Feel more like myself / Just show up

No flags. The ellipsis-continuation format reads naturally with the chip labels.

---

## Cross-question consistency notes

- Voice is consistently second-person ("you") throughout — good, no drift.
- Three questions use an em-dash aside to explain "why this matters" (Q1, Q2, Q4,
  Q5); the other four don't. Not necessarily a problem — Q3/Q6/Q7/Q8 are
  self-explanatory without one — but if this is meant to be a deliberate pattern, Q7
  ("support_style") is the one place a short aside might help most, since its prompt
  is also the vaguest (see flag above).
- "Nudge" is used informally in two prompts (Q4, Q5) to mean two different things,
  neither of which is the actual Nudge feature. This is the one flag in this review
  that's more than wording taste — it's a naming collision that could misinform a
  user who later encounters the real Nudge on Home. Worth prioritizing over the
  smaller grammar/tone fixes if only one thing from this doc gets picked up.

---

## Summary table

| Q | Field | Priority flag |
|---|---|---|
| 1 | talk_style | Prompt says "direct," chip says "Loud" — mismatched word |
| 2 | show_up | "What's this week feel like?" — grammar |
| 3 | knocks_you_off | none |
| 4 | morning_cue | "nudge" terminology collision (real feature exists) |
| 5 | evening_wind_down | "nudge" terminology collision; separate pronoun-grammar issue in stored cue values |
| 6 | energy_pattern | none |
| 7 | support_style | Vague prompt ("in it" undefined) |
| 8 | current_focus | none |

Nothing in this document has been applied. Say the word on any row and it goes into
`intake.ts` as an actual prompt/chip-label edit.
