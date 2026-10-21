# Core content policy (emci, 2026-10-20)

The one rule set for anyone who writes, edits or reviews ATO content: people, agents, prompts, validators, checks and
server filters. It **replaces every conflicting earlier writing rule** (the 2026-10-19 rounds are folded in below). If a
prompt, word list, check or doc disagrees with this page, the other thing is wrong: remove or rewrite it, don't add an
exception.

Our goal is clarity: natural language, accurate meaning, honest feedback and adult humor. Do not optimize for making
everything gentle, positive or inoffensive.

## 1. Judge meaning, not keywords

A word or topic alone is never a reason to reject content. Evaluate what the sentence actually says, who it targets, what
an action asks someone to do, and its context.

- **Weaknesses and uncomfortable truths are allowed** when the answers support them. Do not invent certainty, soften a
  limitation into a meaningless trait, or force an upside. A strong trait alone does not prove its usual drawback: a
  possible cost is worded "you may…" / "can…", and stated flatly only when the answers show it. The labels "Strengths" and
  "Weaknesses" are fine.
- **Adult humor is allowed**: dark, absurd and unhinged jokes, strong swearing, and references to death, drinking, money,
  relationships and other realities. Preserve the punchline.
- **Everyday language.** Explain a necessary technical term. Do not ban a word merely because it also has a clinical use.
  Do not assign an unsupported diagnosis or psychological label to the reader.
- **Tasks** (🎯): assess the actual action, consent, cost, time and safety, not the topic.
- **Questions**: score the intended trait, never reasonable privacy, safety, financial boundaries or personal preferences.
- **Historical figures**: separate sourced facts from interpretation. A documented event does not automatically prove a
  psychological trait. Never invent tags to meet coverage quotas.

## 2. When to change content

Change it for a **specific problem**: confusing wording, a factual error, an unsupported inference, misleading scoring,
targeted degradation, or an action that encourages harm. Discomfort, negativity, profanity and sensitive topics alone
are not defects.

Make the smallest change that fixes the problem and keeps the meaning, the personality and the humor. If it already
works, leave it alone. Never bulk-accept edits; check each one keeps its meaning.

Every flagged item states the concrete problem beyond "this contains X" (which of the problems above, and why).

## 3. What this looks like in practice

**Labels (who is it about?).** Words like toxic, clingy, needy, avoidant, trauma, bipolar or therapy are vocabulary.
- Pass: "a toxic workplace", "my clingy cat", "attachment to old photos", "bipolar weather", "the group chat needs
  therapy", "trauma-bonded by a bad haircut", "you may feel needy when the chat goes quiet" (a feeling, not a verdict).
- Fail: a verdict about the reader, such as "You're clingy", "Your avoidant attachment style explains this", "You have
  ADHD", "so narcissistic of you", "a classic narcissist", "people like you are needy". Also a diagnosis claim and
  clinical advice ("get therapy", "stop your meds").
- Code: `src/lib/voice/clinical.ts` (`readerLabelHit`); pinned with pass/fail pairs in the checks; server backstop
  `wave99d` (clear verdict forms only).

**Humor.** Fix a joke only for a specific problem and keep its edge. Real boundaries: it must not encourage a dangerous
act (self-harm, drunk driving, real harm), must not turn someone's disclosed trauma into the punchline at their expense,
must not present an invented claim about a real person as fact, no slurs or demeaning a group for who they are, nothing
sexually explicit (App Store). Mentioning death or alcohol does none of these. Swearing is allowed, strong swearing
included; it has to earn its place. Craft rules stay: joke about the situation, land it last, no stock clichés, never
explain the joke. Code backstop: `JOKE_HARM_FILTER` (`src/lib/voice/card-joke.ts`) and `wave99d`: encouragement, slurs
and explicit terms only, never a topic or a swear word.

**Tasks.** Small, practical, optional. Refuse a task for its actual risk: dangerous acts, substance pressure, gambling,
a large or irreversible money move, quitting, contacting someone who has not invited contact, meeting a stranger from the
internet, or a long block of time. A small optional purchase for yourself, an ordinary outing or a light invitation to a
friend is fine.

**Questions.** Keep the trait and its direction. A privacy, safety or money boundary (location, passwords, accounts, a
joint account, declining) is never scored as emotional distance; measure closeness through feelings, support and
responding to a bid for connection. A changed scenario gets a new id and the old one is retired (CLAUDE.md).

**Facts.** Every factual claim (Legends, figures, dates, places, quotes, "first", "invented", numbers) is checked against
at least one reliable source; wrong = corrected to the source, unconfirmable = UNRESOLVED, never guessed and never
quietly kept. Prefer the careful form ("brought movable-type printing to Europe"). A tag on a real person describes
documented behaviour, never a diagnosis and never blames them for what others did. A new roster passes this before its
`*_COPY_REVIEWED` flag flips.

## 4. Kept on purpose (separate requirements, not content taste)

Age (sign-up is 18+, see `docs/under18-access.md`), privacy (shareable titles, push and widget lines keep struggle-side
lines out via `isShareableLean`: a person's private struggle must not appear on a public snippet), security, App Store
and platform rules. These are not weakened by anything above.

## 5. Reviewer output

For each item: KEEP (already works), FIX (new text; say the concrete problem; meaning unchanged) or UNRESOLVED (one plain
question for emci). Only UNRESOLVED items go to emci, once. Every rule change adds paired tests: contextual uses that
must pass and genuinely problematic uses that must fail.
