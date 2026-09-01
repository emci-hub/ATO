# Copy audit — clinical / technical / diagnostic voice

**Status:** proposal only. No app files were edited. Nothing was committed.

**Voice to match:** specific and plain, like something that actually happened — not a punchline, not slang, not a survey question. Category labels and explainers get the same treatment: concrete and human, no clinical or technical terms on screen.

**Out of scope (untouched):** crisis card, crisis-disclaimer copy, `src/lib/crisis/**`, `src/components/crisis-card.tsx`, `src/components/crisis-region-picker.tsx`, and everything under `src/app/legal/`.

**Also skipped on purpose:** `/dev-lab` and other `__DEV__` labs (not production UI). Ranking *body lines* that already read as lived behavior (e.g. “Quiet time is how I reset”) — the round *titles*, Likert chrome, and third-person check-in bank are flagged instead of reprinting every row. 8-ball answers are a toy, not an assessment.

---

## Onboarding — identity

### “A few facts first, then nine taps…”

- **Where:** Introduce-yourself screen, before the 9 chips.
- **Current:** `A few facts first, then nine taps so ATO knows how to talk to you.`
- **File:** `src/app/onboarding.tsx:544`
- **Why it reads wrong:** Form / intake framing (“facts,” “taps,” the product studying you).
- **Rewrite:** `Your name, a birthday, then nine quick choices about your week — so Sage talks like a person who already met you.`

### “When were you born?”

- **Where:** Same screen. Also the error string `AGE_REQUIRED_MESSAGE`.
- **Current:** `When were you born?`
- **File:** `src/app/onboarding.tsx:582` · `src/lib/age.ts:11`
- **Why it reads wrong:** Medical-form field. Age gate is real; the wording is clinic clipboard.
- **Rewrite:** `Birthday` as the label. Keep the under-16 error as it is (`ATO is for people 16 and older.`) — that’s a rule, not a diagnosis.

---

## Onboarding — 9 core chips

Prompts live in `CORE_INTAKE_QUESTIONS`. Same copy is reused when a Settings row is expanded (`IntakeSettings` renders `question.prompt`).

### Talk style

- **Where:** Onboarding screen 1 of 9; You → How you show up.
- **Current (prompt):** `How should Sage talk to you? Sage matches this — quiet, even, or loud.`
- **File:** `src/lib/intake.ts:160`
- **Current (settings label):** `Talk style`
- **File:** `src/lib/intake.ts:234`
- **Why it reads wrong:** Product survey + a named “style.”
- **Rewrite (prompt):** `When Sage writes back, should it be quiet, even, or a bit louder?`
- **Rewrite (label):** `How Sage talks`

### Show up

- **Where:** Onboarding 2 of 9; You settings.
- **Current (prompt):** `What's this week feel like? This colors your face on Home.`
- **File:** `src/lib/intake.ts:166`
- **Current (label):** `Show up`
- **File:** `src/lib/intake.ts:235`
- **Why it reads wrong:** Internal field name on the You tab. Prompt is mostly fine.
- **Rewrite (label):** `This week`
- **Prompt:** keep, or drop the second sentence if “colors your face” feels like a system talking.

### Knocks you off

- **Where:** Onboarding 3 of 9; You settings.
- **Current (prompt):** `What usually knocks you off? Pick every one that actually does.`
- **File:** `src/lib/intake.ts:172`
- **Current (label):** `Knocks you off`
- **File:** `src/lib/intake.ts:236`
- **Current (chip):** `People / conflict`
- **File:** `src/lib/intake.ts:66`
- **Why it reads wrong:** Prompt is close. Label is jargon. Slash-chip reads like a form category.
- **Rewrite (label):** `What throws the day`
- **Rewrite (chip):** `People` (or `A fight with someone`)
- **Prompt:** `What usually throws the day off? Tap every one that’s actually true.`

### Morning cue / evening wind-down

- **Where:** Onboarding 4–5; You settings.
- **Current (prompts):**
  - `What do you already do every morning? The daily Do hangs off this one thing, not a whole routine.` (`src/lib/intake.ts:179`)
  - `What already happens at the end of your day? The evening Check nudge hangs off this.` (`src/lib/intake.ts:185`)
- **Current (labels):** `Morning cue` · `Evening wind-down` (`src/lib/intake.ts:237–238`)
- **Why it reads wrong:** “Cue,” “wind-down,” “Do,” “Check nudge” are product internals.
- **Rewrite (labels):** `Mornings` · `End of the day`
- **Rewrite (prompts):**
  - `What’s one thing you already do in the morning? Tomorrow’s small step can hang off that.`
  - `What’s one thing that already happens before you sleep?`

### Energy / recovery / support / focus

- **Where:** Onboarding 6–9; You settings.
- **Current (prompts):**
  - `When do you usually have the most in the tank? This times when ATO nudges you.` (`src/lib/intake.ts:191`)
  - `When you're off track, what actually pulls you back?` (`src/lib/intake.ts:197`)
  - `When you're in it, what helps more?` (`src/lib/intake.ts:203`)
  - `Right now you're mostly trying to…` (`src/lib/intake.ts:209`)
- **Current (labels):** `Most energy` · `What pulls me back` · `What helps` · `Right now` (`src/lib/intake.ts:239–242`)
- **Why it reads wrong:** 6–9 prompts are mostly human. “This times when ATO nudges you” is the system talking. Chip `Night owl` (`src/lib/intake.ts:99`) and `Movement` (`src/lib/intake.ts:103`) are category-ish; `A nudge to keep going` (`src/lib/intake.ts:111`) collides with the Home “Nudge” card.
- **Rewrite (prompt 6, drop the product clause):** `When do you usually have the most in the tank?`
- **Rewrite (chip):** `Night` instead of `Night owl`; `A walk` or `Moving around` instead of `Movement`; `Someone to keep me going` instead of `A nudge to keep going`.

---

## Onboarding — optional extra (Stage 11)

This is the loudest personality-test block in the app.

### Gate

- **Where:** After the 9 chips, before Home.
- **Current:** `Want to add a bit more?` / `If you already know more about how you show up, you can add it. Totally optional. This is a starting point. It can change.`
- **File:** `src/components/optional-intake.tsx:55–58`
- **Why it reads wrong:** “How you show up” + “starting point” still sounds like an inventory intro.
- **Rewrite:** `Want to say a little more about how a regular day goes? You can skip this.`

### Progress

- **Where:** Extra screens 1–4.
- **Current:** `extra ${n} of 4` via `optionalProgressLabel`
- **File:** `src/lib/traits.ts:367–368`
- **Why it reads wrong:** Form chrome.
- **Rewrite:** `1 of 4` (drop “extra”).

### Four-letter type grid

- **Where:** Optional screen 0.
- **Current (title):** `If you already know a four-letter type, tap it`
- **File:** `src/components/optional-intake.tsx:121`
- **Current (lede):** `16 personality types. Skip if you don't use one.`
- **File:** `src/components/optional-intake.tsx:123`
- **Current (chips):** `INTJ`, `INTP`, `ENTJ`, … `ESFP` (shown as the tap labels)
- **File:** `src/lib/traits.ts:104–120` (via `TYPE_CHIPS` in `optional-intake.tsx:32`)
- **Why it reads wrong:** This *is* a personality test on screen. Type codes are diagnostic categories.
- **Rewrite:** Prefer **removing the grid**. If a shortcut must stay: title `If you already use a four-letter shorthand for yourself, you can tap it.` Lede: `Skip if you don’t.` Still show the codes only as the person’s own nickname for themselves — never “16 personality types.”

### Trend sliders (Big Five poles, unnamed)

- **Where:** Optional screen 1; same chrome on Does-Sage-know-you “Not quite.”
- **Current (title):** `If you already know how you trend, mark it`
- **File:** `src/components/optional-intake.tsx:130`
- **Current (lede):** `Leave a row blank if you're not sure. Blank stays blank — we do not fill in the middle for you.`
- **File:** `src/components/optional-intake.tsx:132`
- **Current (rows):** e.g. `New ideas` / `Left = stick with what I know. Right = try the untried path.`
- **File:** `src/components/optional-intake.tsx:34–39` (same bank as `AXIS_EDITOR_COPY` in `src/lib/sage-knows.ts:62–81`)
- **Why it reads wrong:** Likert form. “How you trend” is psych-speak. Left/Right scale is a questionnaire.
- **Rewrite (title):** `If a line below is already true, tap where you sit. Skip a row if it isn’t.`
- **Rewrite (lede):** `Empty means we don’t guess.`
- **Rewrite (hint shape):** drop Left/Right. Example for New ideas: `I stick with what I know` … `I try the path nobody around me has used.` (two poles as words, not a scale legend)

### Close / disagreement

- **Where:** Optional screens 2–3.
- **Current (titles):**
  - `When you're close to someone, what usually shows up?` (`optional-intake.tsx:150`)
  - `When there's a disagreement, what's your first move?` (`optional-intake.tsx:164`)
- **Current (ledes):**
  - `A starting point, not a lifetime label. Skip if none of these fit.` (`:152`)
  - `About this kind of moment, not who you are. Skip if none of these fit.` (`:166`)
- **Why it reads wrong:** Titles are almost lived-in. Ledes protest too much (“lifetime label,” “not who you are”) — that’s assessment-disclaimer voice. Attachment/conflict inventories use the same structure.
- **Rewrite (ledes):** `Skip if none of these is what actually happens.`
- **Titles:** keep, or `When you’re close to someone, what usually happens?`

---

## You tab — settings

### Section header

- **Where:** Settings card wrapping the 9 chips.
- **Current:** `How you show up` / `Tap a row to change it. Same answers as when you signed up.`
- **File:** `src/components/intake-settings.tsx:72–75`
- **Why it reads wrong:** Mild. “Answers” = questionnaire.
- **Rewrite:** `This week and the usual day` / `Tap a row to change it.`

Row labels: same as `INTAKE_SETTINGS_LABELS` above.

---

## Home / Sage — Does Sage know you?

### Card kicker

- **Where:** Home and Sage, when a check-in is up.
- **Current:** `Does Sage know you?`
- **File:** `src/lib/sage-copy.ts:51` (rendered `sage-knows-card.tsx:81`)
- **Why it reads wrong:** Sounds like a personality product, or Sage evaluating you.
- **Rewrite:** `Still true?`

### The note (third person)

- **Where:** Body of the same card (`prompt.line`).
- **Current (pattern, whole bank):** `They tend to get energy from being around people.` (and the rest of `TRAIT_POLE_LINES`)
- **File:** `src/lib/traits.ts:420–480` — example extraversion high at **422**; attachment high at **442** (`They tend to worry people will pull away.`)
- **Why it reads wrong:** Case-file voice. Talks *about* the person. “Tend to” is inventory language. Same strings also go into Sage’s model prompt.
- **Rewrite (same example, second person, one real pattern):** `You get going when people are around.` / `You worry people will pull away.`
- Apply that pass to the full `TRAIT_POLE_LINES` + `TRAIT_MID_LINES` bank (`src/lib/traits.ts:483–501`).

### Buttons / editor

- **Where:** Same card.
- **Current:** `Still fits` · `Not quite` · `Not this week` · `Keep the note`
- **File:** `src/components/sage-knows-card.tsx:112, 124, 132, 100`
- **Why it reads wrong:** “Still fits / Not quite” is survey confirm/deny. Editor reuses Left/Right `AXIS_EDITOR_COPY` (see sliders).
- **Rewrite:** `That’s still true` · `Not like that` · `Skip this week` · `Leave it`

### Axis titles on this card (when editing)

Shown as `AxisTaps` labels from `AXIS_EDITOR_COPY`. The most clinical:

| Current label | File | Rewrite |
|---|---|---|
| `Even keel` | `sage-knows.ts:79` | `When things wobble` |
| `Closeness worry` | `sage-knows.ts:84` | `Worry they’ll leave` |
| `A bit of distance` | `sage-knows.ts:88` | `Keeping some space` |
| `In a disagreement` | `sage-knows.ts:92` | `In a fight` |
| `Room for the other person` | `sage-knows.ts:96` | `Their way through too` |
| `Connection` | `sage-knows.ts:108` | `Needing people that day` |
| `After a miss` | `sage-knows.ts:112` | `After it goes badly` |
| `When it falls apart` | `sage-knows.ts:116` | `When a project falls apart` |
| `A big task` | `sage-knows.ts:120` | `A big pile of work` |

Hints that start `Left =` / `Right =` (`sage-knows.ts:63–121`, same as optional sliders): rewrite as two lived poles, not a scale.

---

## Home / You — Most me (forced ranking)

- **Where:** Home and You, optional weekly card.
- **Current (kicker):** `Most me` — `src/lib/sage-copy.ts:60` (`ranking-card.tsx:92`)
- **Current (axis title):** `copy.label` from `AXIS_EDITOR_COPY` — `ranking-card.tsx:94` (same table as above)
- **Current (lede):** `Drag into order. Most you at the top.` — `sage-copy.ts:62`
- **Current (ends):** `Most you` / `Least you` — `ranking-card.tsx:99, 103`
- **Current (save):** `That's me` — `sage-copy.ts:64`
- **Why it reads wrong:** The mechanic is a ranked inventory (4–5 graded items, high pole → low pole). Chrome says “most/least you.” Attachment rounds are the rawest (`I worry people will pull away` — `ranking.ts:97`).
- **Rewrite (kicker):** `What sounds like you`
- **Rewrite (lede):** `Put the true one at the top.`
- **Rewrite (ends):** `True` / `Not really`
- **Rewrite (save):** `This is the order`
- Axis titles: same rewrites as the table above.
- Ranking *items* that already sound lived-in can stay; the attachment/conflict/agency rounds should get a second pass so they don’t read like scale items (`I tend to…` / `I do not spend time worrying…`).

---

## Home / You — Gut call (scenario swipe)

- **Where:** Home and You, extra-axis weeks.
- **Current (kicker):** `Gut call` — `sage-copy.ts:69`
- **Current (lede):** `Swipe or tap. One pick.` — `sage-copy.ts:71`
- **Current (setups):** e.g. `A project falls apart. First thought:` · `You bomb a presentation. Gut reaction:` · `Big task, tight deadline. You feel:` · `Best day at work is one where:`
- **File:** `src/lib/scenario.ts:64–99`
- **Why it reads wrong:** Forced-choice vignettes are textbook psych items (locus / mindset / efficacy / SDT), even without the names. “Gut reaction” / “You feel:” are inventory stems. Three cards share `Best day at work is one where:` — that is a scale battery.
- **Rewrite (kicker):** `This or that`
- **Rewrite (lede):** `Pick the one that happened last time.`
- **Rewrite (setups), examples:**
  - `The thing you were building came apart last week. What showed up first?`
  - `The talk in the room went badly. What did you tell yourself?`
  - `The deadline was close and the pile was big. What was true?`
  - Split the three “best day at work” items into three different real days (`The day you left on time` / `The day a hard thing actually shipped` / `The day you ate lunch with someone`), not one repeated stem.

---

## Home — Sage card chrome

### Coach / npc labels

- **Where:** Home Read kicker; Talk/Dawn/push stay coach.
- **Current:** `Sage · coach` · `Sage · npc` (Quest Home only)
- **File:** `src/lib/sage-copy.ts:9–12` (Home uses `homeSageLabel`)
- **Why it reads wrong:** `npc` is game-dev jargon on a live card. `coach` is a floor requirement — keep it, just don’t pair it with `npc` if that reads as a type.
- **Rewrite:** Keep `Sage · coach`. Quest: `Sage` only, or `Sage · today` — not `npc`.

### Home lede

- **Current:** `Today's Read and Do from Sage, a coach — not a person.`
- **File:** `src/lib/sage-copy.ts:16–17`
- **Why it reads wrong:** Disclosure is required; “not a person” is a bit legal-technical (not diagnostic). Optional soften: `Today’s Read and Do, from Sage in the app.`
- **Quest lede** `Today's Read and Do.` (`:20`) is already plain.

### Nudge

- **Where:** Third Home card kicker.
- **Current:** `Nudge`
- **File:** `src/lib/sage-copy.ts:23`
- **Why it reads wrong:** Internal product name (also `zGlitch` in code, not shown). Mild.
- **Rewrite:** `A push` or `Keep going` — only if “Nudge” feels like a feature brand. Not clinical; include because it’s a category label.

### Quest HP / MP

- **Where:** Home in Quest appearance.
- **Current:** `HP` · `MP`
- **File:** `src/components/quest-growth-bars.tsx:28–29`
- **Why it reads wrong:** Score meters. Game-technical, not a psych test. Tied to presence/depth counts.
- **Rewrite:** `Showing up` · `What you’ve told Sage` — or drop the letter codes and keep the bars unlabeled.

---

## Home — milestone strip

- **Where:** Collapsible Checks strip.
- **Current (kickers / a11y):** `7 checks` · `fact` · `week`
- **Current (labels):** `First fact taught to Sage, unlocked.` · `A full week without a cut, unlocked.`
- **File:** `src/components/check-milestone-badge.tsx:99–117`
- **Why it reads wrong:** `fact` and `cut` are internals. “Taught to Sage” is lab-notebook.
- **Rewrite:** `7 days logged` · `Told Sage one thing` · `A week with no skip on the habit` (avoid “cut”).

---

## Home — first three days (banked Read)

User-facing on Home when `check_count < 3`.

- **Current:** `Day one. This is just information gathering — nothing to perform yet.`
- **File:** `src/app/copy/first_cards.md:18`
- **Why it reads wrong:** “Information gathering” is assessment.
- **Rewrite:** `Day one. Nothing to prove yet — just see what the day actually was.`

(Other bank Reads are coaching-plain; this is the one that slipped.)

---

## Sage tab

### Talk ledes

- **Current:** `Sage is a coach in the app, not a person. Talk it out — Sage replies in your style.` · `Say hi, or tap a chip to get started. Sage is a coach, not someone in the chat.`
- **File:** `src/lib/sage-copy.ts:36–40`
- **Why it reads wrong:** Floor disclosure, not a psych test. Optional: `Sage replies in the app. Tap a chip or type.`
- **Keep** the coach line if legal/floor still wants it visible here.

### Consent (Dawn / Talk)

- **Current (titles):** `Can Sage use AI to write your card?` · `Can Sage use AI to talk with you?`
- **Current (body excerpt):** `…based on what you've logged and told us. Sage is a coach in the app, not a person.`
- **File:** `src/components/ai-consent-card.tsx:13–25`
- **Why it reads wrong:** “Logged and told us” is data-collection voice. Not diagnostic; still a clipboard.
- **Rewrite (body beat):** `Sage uses what you already typed and the days you marked done — not a file on you.`

---

## Circle — Teach Sage this

- **Where:** Chat message menu + confirm sheet.
- **Current:** `Teach Sage this` · `Exactly one fact, in your words. Sage is a coach, and only learns from these taps.` · `Saved as one fact. Sage is a coach — it only learns from these taps.`
- **File:** `src/app/chat.tsx:390, 454–456, 436–438`
- **Why it reads wrong:** “Fact” + “learns from these taps” is knowledge-base / training language.
- **Rewrite:** `Remember this for Sage` · `Sage will keep this one line, in your words.` · `Saved. Sage will keep that line.`

---

## Sage prompts (not on screen — labels the model sees)

These never render, but they shape what Sage says. User asked for prompt-facing labels too.

### Raw chip ids

- **Where:** Card + Talk generate prompts.
- **Current:** interpolates stored ids, e.g. `- Current focus chip: ${me.current_focus}` → `habit` / `through_it` / `night_owl` / `movement`
- **File:** `src/lib/voice/providers/prompt.ts:42, 59–65`
- **Why it reads wrong:** Internal enums. Sage can echo `habit` or `night_owl`.
- **Rewrite:** Pass the same human chip labels as the You tab (`Build a habit`, `Night`, …), never the id.

### “Self-report / diagnosis”

- **Current:** `- Treat the lines above as self-report, never as a diagnosis.`
- **File:** `src/lib/voice/providers/prompt.ts:67`
- **Why it reads wrong:** Puts “diagnosis” in the model’s mouth; it can leak.
- **Rewrite:** `- These are things they tapped. Not a type, not a score, not who they are.`

### Third-person trait bank

- **Current:** `traitPromptLines` injects `They tend to…` (`src/lib/traits.ts:514–519`, fed from `TRAIT_POLE_LINES`)
- **Rewrite:** Same second-person / concrete pass as the check-in card, or “This person already said: …” plus a lived line — still no “tend to,” no axis names.

### Library

- **Note:** `library.md` *contains* framework headings (`Self-Determination Theory`, `Growth mindset`, `Locus of control`, `Self-efficacy` — `src/app/copy/library.md` and `HEADING_TO_ID` in `src/lib/voice/library.ts:32–42`). Those headings are **not** shown in the app and are **not** sent to Sage (only `### For Sage` bullets). No UI rewrite unless you later ship a readable library. Keep it closed.

---

## Priority if you only approve a first pass

1. Optional intake: kill or hide “16 personality types” and the four-letter grid.
2. Does Sage know you?: stop third-person `They tend to…`; rename the kicker.
3. Left/Right slider legends → two lived poles.
4. You-tab labels: `Talk style`, `Morning cue`, `Knocks you off`, `Even keel`, `Closeness worry`.
5. Prompt.ts: human labels, no “diagnosis,” no raw chip ids.
6. `Sage · npc`, `cut` / `fact` on badges, `information gathering` on Day 1.

That’s the list. Approve line-by-line (or by section) and a later box can apply only what you keep.
