# Intake & copy voice — FINAL (locked, approved)

Voice rule for the whole app: plain, specific, human — like something that actually happened or a real description, never a clinical single-word label standing alone. No slang, no punchlines, no scientific/diagnostic framing visible to the user.

This is Pass 1 (pure copy — safe to apply). Pass 2 (Sage's "Does Sage know you?" bank + raw chip ids inside Sage's prompt) is separate — held back for its own review since it touches model input, not just display text.

---

## A. Vibe-check questions (optional fast-entry — replaces old MBTI/sliders/attachment/conflict screens)

### 1. Openness
**"Someone in the group chat finds a spot that looks kinda sketchy but also kinda cool. Zero reviews."**
- "I'm in, that's kind of the fun part" → high
- "I'll go if someone's got a backup plan" → mid
- "I'd rather just go somewhere we know is good" → low

### 2. Conscientiousness
**"You committed to plans two weeks ago. Day comes and you're just not feeling it."**
- "I said I'd go, so I'm going" → high
- "Depends how hard I actually committed" → mid
- "I'm probably canceling" → low

### 3. Extraversion
**"Rough week, finally got a night to yourself."**
- "I'm texting people, let's do something" → high
- "Maybe one person, kept low-key" → mid
- "Phone off, door closed, that's it" → low

### 4. Agreeableness
**"Group chat's picking dinner and it's not going your way."**
- "I'll say something, that's a fair ask" → low
- "I'll mention it once, then just go with it" → mid
- "Honestly, whatever's fine" → high

### 5. Neuroticism
**"Plan falls through last minute. In the grand scheme, not a big deal."**
- "Genuinely doesn't touch me, I move on" → low
- "Annoying for a bit, then it's gone" → mid
- "Somehow ruins my whole day" → high

### 6. Attachment — primary
**"Someone goes quiet on you for a few days, no explanation. What's the actual gut reaction, not what you'd say out loud."**
- "They're probably just busy, I don't think much of it" → secure
- "I start replaying what I might've done" → anxious
- "Kind of nice not being checked on, if I'm honest" → avoidant
- "I notice, I miss it, but I'm still not the one texting first" → fearful-avoidant

### 7. Attachment — second read
**"A new group actually feels like your people. They start inviting you to a regular thing."**
- "I'm in, right away" → secure
- "I'll show up a few times before I let myself get attached" → secure/anxious lean
- "I keep it light, I don't want to need this" → avoidant
- "I want in more than I'm letting on" → fearful-avoidant

### 8. Conflict style
**"You and someone close to you just aren't seeing eye to eye on something. First move?"**
- "I say my piece, straight up" → competitive
- "We talk it out until it's actually settled for both of us" → collaborative
- "We meet in the middle" → compromising
- "I need to step away and come back to it" → avoidant
- "I drop it, it's not worth the friction" → accommodating

### MBTI / "your type"
- Label: "If you already know your type"
- Description: "Some people already know this about themselves from other quizzes — tap yours in if so, skip if not."
- Note: the 16-letter grid (INTJ, ESFP, etc.) stays as-is — external shorthand people bring in, not app-invented jargon. Only the framing around it changes.

---

## B. Core field labels (onboarding + You-tab Settings — same fields, both places, must match)

| Old label | New label | New description |
|---|---|---|
| Talk style | How Sage talks to you | Quiet, even, or a bit more direct — you already picked this, editable anytime. |
| Morning cue | Your morning anchor | The one thing you already do every morning — your daily nudge hangs off this. |
| Knocks you off | What actually throws off your day | The stuff that really gets in the way — pick everything that's true, not just one. |
| Even keel | How rattled a bad day gets you | Some people shake it off fast, some carry it longer — no wrong answer here. |
| Closeness worry | How you handle getting close to people | Everyone's a little different here — this just helps Sage read the room right. |

---

## Scope note for Cursor
- Apply to: onboarding screens AND You-tab Settings (same fields appear both places — must stay in sync).
- Do NOT touch: crisis card, crisis-disclaimer copy, anything in `app/legal/` — separate legal-review track.
- Do NOT touch: `app/voice/sage.txt`, `app/copy/first_cards.md`, the "Does Sage know you?" `They tend to…` bank, or any raw chip ids feeding Sage's prompt — held for Pass 2, separate review, since that content is model input, not just display text.
- Internal variable/field names in code can stay as they are (`talk_style`, `knocks_you_off`, etc.) — only user-facing display text and descriptions change.
