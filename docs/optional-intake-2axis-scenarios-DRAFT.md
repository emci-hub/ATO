# Optional-intake 2-axis scenario questions — DRAFT for emci review

**Status: UNREVIEWED.** Not wired into any screen. No code changed. This is copy + mapping only, for a review pass before anyone touches `vibe-check.ts` / `optional-intake.tsx`.

**Goal:** 8 forced-choice scenario questions, each covering exactly 2 of the confirmed 16 axes (`PROJECT_CONTEXT.md`), sized to sit in the existing "Want to add a bit more?" optional-intake flow (1-2 pages, tappable chips, no sliders). 8 questions × 2 axes = all 16 axes touched exactly once — no overlap, no axis left out.

Tone match: casual, second-person, concrete everyday scenes (group chat, texts, a plan going sideways) — same register as the existing `VIBE_QUESTIONS` bank and `intake-sweep-copy-DRAFT.md`. No framework names, no scores shown to the user.

Numbers next to each option are **illustrative direction tags** (0 = low pole, 0.5 = mid, 0.8 = high pole), not final weights — same convention as `intake-sweep-copy-DRAFT.md`. Actual blend math is an implementation decision, not made here.

---

## Coverage at a glance

| # | Axes | Scenario theme |
|---|---|---|
| 1 | openness + conscientiousness | locked-in plan vs. new find |
| 2 | extraversion + playfulness | flat energy / pointless detour |
| 3 | agreeableness + conflict_cooperativeness | group can't agree where to eat |
| 4 | conflict_assertiveness + autonomy | someone decides for you without asking |
| 5 | steadiness + locus_of_control | a plan falls apart, nobody's fault |
| 6 | attachment_anxiety + attachment_avoidance | a slow reply from someone you're into |
| 7 | competence + self_efficacy | handed something new, no instructions |
| 8 | growth_mindset + relatedness | you mess up in front of people |

---

## 1 — openness + conscientiousness

**You've had a plan locked in for weeks — everyone knows the spot. Right before, the group finds something new and everyone's suddenly into that instead.**

- New thing, I'm dropping the old plan — *openness 0.8 / conscientiousness 0.2*
- I'll go if we can still make the old plan happen after — *openness 0.5 / conscientiousness 0.5*
- We already committed, we're doing the original plan — *openness 0.2 / conscientiousness 0.8*

## 2 — extraversion + playfulness

**Group's already running late, and someone suggests a pointless, kind of silly detour on the way.**

- I'm the one pushing for it, more people the better — *extraversion 0.8 / playfulness 0.8*
- I'll go along, but I'm quiet about it — I don't need it to be a whole thing — *extraversion 0.3 / playfulness 0.6*
- I skip the detour, but I'll clown on it from the sidelines — *extraversion 0.5 / playfulness 0.4*
- Not worth it, let's just get where we're going — *extraversion 0.2 / playfulness 0.1*

## 3 — agreeableness + conflict_cooperativeness

**Group can't agree where to eat and it's dragging on.**

- Honestly, wherever — I just want it decided — *agreeableness 0.8 / conflict_cooperativeness 0.4*
- I say what I actually want, then help find something everyone's okay with — *agreeableness 0.3 / conflict_cooperativeness 0.8*
- I push my pick until people come around — *agreeableness 0.1 / conflict_cooperativeness 0.1*

## 4 — conflict_assertiveness + autonomy

**Someone close to you makes a call on your behalf — signs you up, agrees to something for you — without checking first.**

- I tell them straight up I wanted to decide that myself — *conflict_assertiveness 0.8 / autonomy 0.8*
- I mention it, but let it ride since it's already done — *conflict_assertiveness 0.4 / autonomy 0.4*
- I let it go — honestly easier that someone else handled it — *conflict_assertiveness 0.1 / autonomy 0.1*

## 5 — steadiness + locus_of_control

**A plan you were counting on falls apart last minute — nobody's fault in particular.**

- Throws me for a bit, and I wonder what I should've done differently — *steadiness 0.2 / locus_of_control 0.8*
- Throws me for a bit, but honestly it was always going to happen this way — *steadiness 0.2 / locus_of_control 0.2*
- I shake it off fast, and it was bound to happen either way — *steadiness 0.8 / locus_of_control 0.2*
- I shake it off fast, but I do think about what I'd change next time — *steadiness 0.8 / locus_of_control 0.8*

## 6 — attachment_anxiety + attachment_avoidance

**You're texting with someone you're into and they take way longer than usual to reply.**

- I don't think much of it, they're probably just busy — *attachment_anxiety 0.2 / attachment_avoidance 0.2*
- I start wondering if I did something wrong — *attachment_anxiety 0.8 / attachment_avoidance 0.2*
- Honestly kind of a relief — less pressure to reply fast myself — *attachment_anxiety 0.2 / attachment_avoidance 0.8*
- I notice, but I'm not about to be the one who double-texts — *attachment_anxiety 0.6 / attachment_avoidance 0.6*

## 7 — competence + self_efficacy

**You get handed something you've never done before, basically no instructions, due soon.**

- I figure I can handle it, I just start — *competence 0.8 / self_efficacy 0.8*
- I think I can get through it, but I want someone to check my work — *competence 0.6 / self_efficacy 0.5*
- I'm not sure I'm the right person for this — *competence 0.2 / self_efficacy 0.2*

## 8 — growth_mindset + relatedness

**You mess up in a way people around you actually notice.**

- I want to talk it through with someone right after — *relatedness 0.8 / growth_mindset 0.6*
- I go over what happened on my own so I don't do it again — *relatedness 0.2 / growth_mindset 0.8*
- I just want to move past it — replaying it doesn't help — *relatedness 0.4 / growth_mindset 0.2*

---

## Open questions for review (not decided here)

- **Where these screens live.** Right now optional-intake is 8 screens (0-7: 5 sliders + 2 close-pattern + 1 disagree — see [NOW.md](NOW.md) / `traits.ts`). This draft is a *second, separate* set of 8 covering the same 16 axes from a different angle (paired scenario vs. single-axis slider). Whether these replace, extend, or partially overlap the existing flow is a product call, not made here.
- **Write source / merge priority.** Existing screens write `self_slider` (direct, sticky) or `self_situation` (inferred). A 2-axis scenario answer would presumably also be `self_situation` — meaning it would never overwrite a direct slider/tap answer on either axis, only fill nulls or blend with other inferred writes. Flagging in case that's not the intended behavior for these.
- **Option-count consistency.** Six questions use 3 options, two (5 and 6) use 4 to cover a fuller combination spread — matches the precedent set by the existing close-pattern screens (4 options) vs. sliders (3 options), but worth confirming that's still the intended pattern.
- **Numeric weights are placeholders.** The 0 / 0.5 / 0.8-style tags mark direction and rough strength only, copied from the convention in `intake-sweep-copy-DRAFT.md`. They have not been calibrated against anything (no `TYPE_R`-style validated correlations, since this is forced-choice, not a published instrument mapping).
- **Length check.** 8 questions × ≤4 short chip options each is the same shape as the current 8-screen optional-intake flow, which already ships at "1-2 pages" — so this set should fit the same footprint, but hasn't been laid out in the actual `OptionalStep` component to confirm.
