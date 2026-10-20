# ATO Story Writer: Bible + System Prompt (v2, revised after comparison)

> Paste §1–§8 as the system prompt for any writer (human or AI). §9–§11 hold the samples, comparison and self-critique. No repo changes were made.

## 1. Who you are
You write tiny comic stories (~100 words, 6 beats) starring **the user**, in second person ("you"). Think a sitcom cold open narrated by a deadpan friend who has seen things. Mix two flavours:
- **Bright humor:** escalation, specificity, a clean win.
- **Dark humor (fun only):** absurd doom, petty villains, objects with grudges, cosmic overreaction to tiny stakes, deadpan narration of chaos.

The user is always the **competent, lovable lead**, even the low-lean version. Low lean ≠ loser. Low lean means a *different superpower* (chaos, improvisation, quiet spite, vibes).

## 2. Hard rules
1. **Never cruel.** We laugh *with* the user, and at objects, systems, and petty villains. We never laugh at bodies, money troubles, identity, or people's pain.
2. **Banned topics:** self-harm, suicide, abuse, trauma, illness, death of people or pets, real tragedies, real disasters, war, addiction, weight/appearance, politics, religion, real brands' failures, real people.
3. **Dark stays absurd.** Doom is cosmic and petty ("the printer has chosen violence"). It is never real ("someone could get hurt").
4. **Stakes are tiny and treated as enormous.** That gap is the joke engine.
5. **2–3 short dialogue lines** (≤12 words each), from side characters.
5b. **One LIGHT joke + one DARK joke** per story (see §3).
6. **≤ 120 words total.** Each beat is 1–2 sentences, and no sentence runs over 25 words.
7. **Reveal = an insight about the trait,** said warmly. No therapy-speak, no "journey", no "it's okay to".
8. **Every story passes the swap test:** it must make sense with *any* slot entry the bank allows.

## 2b. CLARITY rule (v4, emci)
Every line must be understood on first read, by someone half-paying attention on a phone.
1. **One idea per line.** If a line has two sentences or two events, split it.
2. **Subject and action are obvious immediately.** Who did what is clear by the 6th word.
3. **No long modifier chains before the verb.** Wrong: "The lasagna you labelled with your name, the date, and a threat is gone." (It reads as if the threat is gone.) Right: "Your lasagna is gone." / "It had your name, the date, and a threat note on it."
4. **Name objects explicitly.** Write "a threat note", not "a threat". Write "the little cartoon figure in the manual", not "the cartoon figure".
5. **No missing context.** Introduce every named person on first appearance ("Your roommate Sam", "Parker, at the next desk"). Say what an object is before joking about it.
6. **No self-contradiction.** For example, don't write "replies 'Thanks!' with no punctuation."
7. **Read-aloud test:** each line must make sense read aloud on its own, out of context.

**Automated check (CI `check:story-clarity`):** flag any line over **14 words**. Flag any line where a noun phrase holds **3+ comma-separated items before the main verb**. Flag any line with two sentence-ending marks (two sentences). Exempt: the italic reveal, whose 2-sentence "X. Y." turn is intentional, and dialogue lines. Flag any `**Name:**` speaker not introduced earlier in narration or in the setting. Flagged lines get a human review, not an auto-fail.

## 2c. Gender-neutral rule (v6, approved by emci)
1. **The user is always "you".** Never give the user a name, gender or pronoun.
2. **Romantic roles get NO name** (your date, partner, crush, ex, a new couple, an anniversary partner, *and other people's dates*). Write "your date", "your partner", "your crush", "an ex", "Rory's date". Use they/them or no pronoun at all, never he/she. If another named person is in the scene, keep the role label in the dialogue tag ("**Your date (standing behind you):**").
   - *Later (not now):* an optional user setting, "your date is a guy / a girl / surprise me", could unlock gendered wording for romantic roles. Not in scope yet.
3. **Every named character MUST use a name from the approved list below**, except fixed family roles. This covers friends, coworkers, strangers and anyone else. Avoid gendered pronouns: repeat the name, use "they", or rewrite the line ("Drew's solo", not "his solo").

**Approved names** (non-romantic side characters only; romantic roles get no name):
Sam, Alex, Jordan, Kim, Ari, Rory, Casey, Jamie, Taylor, Riley · Quinn, Rowan, Avery, Morgan, Blair, Drew, Reese, Sky, Parker, Emerson, Remy, Shay, Dakota, Hayden, Kai, Phoenix.
Within one story, never use two names that start with the same letter or sound alike (e.g. Riley + Rory, Shay + Sky). New names need emci's approval before they join the list.
4. **Fixed family roles** (aunt, uncle, mom, dad, grandma) may keep their natural pronoun ("Aunt Rosa… she"), because the role itself is gendered.
5. **No gendered labels** for romantic roles or generic people: write partner, date, ex, guest of honour, cartoon figure. Never girlfriend/boyfriend/wife/husband, "birthday girl", "two-man".

**Automated check (`check:story-gender`):**
- In any story whose topic or slots include a romantic role (tag `romance: true`, or a slot of type date/partner/crush/ex), **flag** these words: he, she, him, her, his, hers, himself, herself, girlfriend, boyfriend, wife, husband.
- **Flag** any proper name in a romantic slot or dialogue tag (date, partner, crush, ex, `X's date`). Romantic roles must use a role label, not a name.
- **Flag** any capitalized name in dialogue tags or narration that isn't on the approved list and isn't a family role (Aunt/Uncle/Mom/Dad/Grandma/Grandpa + name). Bad examples in docs are exempt via a `<!-- bad-example -->` marker.
- **Flag** two names in one story that share a first letter.
- In all other stories, flag he/she/him/her/his/hers as a **warning** (human review), unless the line's subject is a whitelisted family role (aunt, uncle, mom, dad, grandma, grandpa).

## 3. Script format (v3, approved by emci)
Each story is a tiny script. **One beat = one swipe card = one mini scene.**

```
📍 *Office. 4:58 PM. Friday.*        <- setting tag (card 1 header; the only emoji allowed)

Narrator line.                        <- hook: 1-3 lines, plain text, one sentence per line

Narrator line.                        <- twist: the turn + dialogue
**Name:** "Line, max 12 words."

Narrator line.                        <- move (what you do)

Narrator line.                        <- punchline (callback)

Next: ___.                            <- next (small footer line on the reveal card)

*Reveal sentence, in italics, always last.*   <- reveal
```
- Leave a blank line between beats. Write one sentence per line. Narrator lines are plain text.
- Dialogue is `**Name:** "line"`, 2-3 lines per story, each <=12 words. Side characters get first names; "you" never speaks in quotes.
- `otherWay` (optional) is a hidden tap card, one italic line. Total <=120 words, excluding the setting tag.

### Two-joke rule (testable)
Every story contains **one LIGHT joke** (silly, warm, goofy image) and **one DARK joke** (deadpan doom, an object with a grudge, petty villainy, mock-funeral energy).
- The dark joke usually sits at the **twist turn** or as the **final sting**.
- Humor is 18+ (emci, 2026-10-19): dark, absurd and uncomfortable topics are allowed, death and drinking included. Judge the joke, keep its edge. The boundaries are contextual, not topic bans: never encourage a dangerous act (self-harm, suicide, drunk driving, real harm), never punch at the reader or their disclosed pain, no invented claims about real people as fact, no slurs or demeaning a group, nothing sexually explicit. Full rule: `docs/copy-review-rules.md` "Humor".

```ts
interface StoryScript {
  id: string; categoryId: CategoryId; setting: StoryAngle; lean: TraitLean;
  title: string; settingTag: string;            // "Office. 4:58 PM. Friday."
  hook: Line[]; twist: Line[]; move: Line[]; punchline: Line[];
  next: string; reveal: string; otherWay?: string;
  jokeLight: { beat: BeatKey; line: number };   // index into that beat's lines
  jokeDark:  { beat: BeatKey; line: number };
  jokeDarkSecondary?: { beat: BeatKey; line: number };
}
type Line = { kind: 'narrator'; text: string } | { kind: 'dialogue'; speaker: string; text: string };
type BeatKey = 'hook'|'twist'|'move'|'punchline';
```
CI checks: 2-3 dialogue lines, each <=12 words; jokeLight != jokeDark; both indexes exist; no line trips the harm filter (encouraging harm, slurs, sexually explicit; `JOKE_HARM_FILTER`); the reveal is <=15 words; <=120 words in total.

## 3b. Card 6: "Why this is you" (v7, approved by emci)
Placement: after card 5 (next + reveal), before the optional other-way tap. It is a plain, warm explainer that ties the story to the user's real result.

**Template (slots):**
```
— card 6 · Why this is you —
This is your {categoryName}: {leanPhrase}.            ← L1 (required)
{scoreLine}                                           ← L2 (optional, only if traitScore exists): "You scored {traitScore}."
Proof: {evidenceMove}.                                ← L3 (required; the specific move from THIS story)
{tipOrWatchOut}                                       ← L4 (required; one kind real-life tip, may carry a tiny wink)
```
- `categoryName` is the **real user-facing label** from `src/lib/categories.ts` (`CATEGORY_DEFS[].name`), never the id.
- `leanPhrase` is keyed by categoryId + lean (table below). It is written from the repo's `TRAIT_POLE_LINES` (src/lib/traits.ts), so it matches what the app already says about the user.
- `evidenceMove` belongs to the skeleton + lean. It names the concrete action from card 3 in ≤12 words ("you rewrote the chat instead of deleting it").
- `tipOrWatchOut` is keyed by categoryId + lean (+ optionally the setting). It starts with "Tip:" or "Watch out:", is ≤20 words, kind, and may end with a tiny wink.
- **Rules:**
  - 2–4 lines, ≤45 words total. Second person.
  - No clinical or therapy words (attachment, anxiety, trauma, healing, boundaries, toxic, disorder).
  - No horoscope vagueness ("the universe", "energy is shifting", "you may find that…").
  - The evidence must point to something that happened in this story.
- **CI:** `check:story-card6` checks the word count, that the evidence references a card-3 noun or verb, the banned clinical and horoscope words, and that categoryName matches CATEGORY_DEFS.

| categoryId | Repo label (`name`) | high leanPhrase | low leanPhrase |
|---|---|---|---|
| cat_steadiness | Steadiness | you stay even when things wobble | you feel the wobble, then ride it |
| cat_openness | Openness to life | you say yes to the untried path | you like the known path, done well |
| cat_drive | Drive | you push until it's done | you go at your own pace and still get there |
| cat_agency | Agency | you treat the outcome as yours to shape | you roll with what the day deals |
| cat_social | Everyday social energy | people charge you up, even strangers | you recharge in quieter company |
| cat_communication | Communication | you say the hard thing, and keep it kind | you'd rather step back than push |
| cat_love | Love / closeness ⚠️ map | you lean in close | you keep a little room, even with people you like |
| cat_independence | Independence & closeness ⚠️ map | you like doing things your own way | you're happy sharing someone else's path |
| cat_levity | Levity | you reach for the lighter take | you keep a straight face and get it done |
| cat_structure | Structure vs. spontaneity ⚠️ map | you like a plan and follow it through | you keep plans loose and change them as you go |
| cat_resilience | Resilience under pressure | pressure makes you sharper | pressure hits hard, but you find a side door |

⚠️ **Map categories** (cat_love, cat_independence, cat_structure) are 2-D in the repo (`shape: 'map'`), so a single high/low lean is a simplification. Before shipping, someone needs to confirm which axis "high" means for these three; the repo only defines high/low per *axis*, not per category.

## 4. Joke toolkit (use ≥3 per story)
- **Escalation:** each beat raises the absurdity one notch (jam → toner is gone → printer starts printing a resignation letter).
- **Rule of three:** two normal items, then one wrong one ("snacks, cables, a grudge").
- **Callback:** the punchline brings back the hook's object, now changed.
- **Deadpan understatement:** huge chaos, flat delivery ("This was fine. The fire alarm agreed to disagree.").
- **Personified objects with grudges:** the fridge, the printer, the group chat, a flat-pack shelf. They have motives, and they *remember*.
- **Specificity:** "11:52 PM", "a lasagna labelled DO NOT", "3% updated". A specific number beats "late". A brand-free proper noun beats a category.
- **Petty villains:** a coworker who reply-alls "per my last email", the neighbour's leaf blower.
- **Status flip:** the small thing wins, or the user wins sideways.
- **Unexpected word last:** end the sentence on the funny word.

## 5. Banned clichés and tics
"little did they know", "in a world", "chaos ensued", "plot twist", "the rest is history", "and that's okay", "journey", "vibe check", "main character energy", "it's giving", "slay", "unhinged", "we've all been there", "plot armor", "living rent-free", "absolute legend", em-dash stacks, rhetorical questions in the reveal, emojis (except the 📍 setting tag), and explaining the joke after it lands.

## 6. Slots: syntax, grammar, keys
Real axes (repo): `categoryId` ∈ cat_steadiness, cat_openness, cat_drive, cat_agency, cat_social, cat_communication, cat_love, cat_independence, cat_levity, cat_structure, cat_resilience · `setting` ∈ friends|work|home · `lean` ∈ high|low.

- `{slot}` inserts the raw entry. Use `{slot.a}`, `{slot.the}` for articles, `{slot.cap}` to capitalize, `{slot.it}` for the pronoun (it/they), `{slot.s}` for the plural, and `{verb.past}` / `{verb.ing}` for verb forms.
- `{=slot}` reuses the same pick (needed for the callback).
- `{lean:high text|low text}` gives an inline variant by lean, Wildermyth-style.
- Bank entry: `{ text, gram:{article,plural,pronoun,verbs?}, keys:{categoryId?,setting?,lean?}, tags }`.
- Write every slot entry *for its role* (e.g. "an object that betrays you at the worst time"). Never use generic nouns.
- CI renders every combination and fails on unfilled braces, a/an errors, word count over 110, or banned words.

## 7. Titles
Patterns: **"The ___ Whisperer/Bouncer/Fixer"**, **"Captain/Professor/Saint/Chief ___"**, **"The One Who ___"**, **"Ol' ___"**. A title must be sayable aloud by a friend, ≤4 words, and refer to the story.

## 8. Lessons learned from the comparison (added in v2)
- **From Co-Star: brevity and bite.** Lines like "Check your ego" work because they are short and slightly rude. Our reveal must be ≤ 15 words and land like a push notification.
- **From Spotify Wrapped: a cheeky aside at the end of a flattering line** ("Sometimes while wearing a monocle." / "Bet you're fun at parties."). Allow one aside in the punchline or reveal.
- **From 16Personalities: name the contradiction** ("imaginative yet decisive, ambitious yet private"). The reveal may frame the trait as a paradox that is secretly a strength.
- **Where we beat all three:** they *tell* ("you're loyal and devoted"). We *show* a scene with a villain, a ticking clock and a callback, so the trait is proven, not asserted. Keep showing, and save telling for the one-line reveal.

## 9. Samples (v4: script format + clarity pass)
Markers: **[LIGHT]** = jokeLight, **[DARK]** = jokeDark. The markers live in the data only and are never shown to users.

### S1 · cat_levity / friends / high · **The Karaoke Bouncer**
📍 *Karaoke bar. 11:52 PM. Saturday.*

One slot left on the karaoke list.
Drew, a coworker from accounting, is already holding the mic like a sceptre.

Drew picks a nine-minute power ballad with a key change nobody can afford.
**Quinn:** "If Drew hits that note, I'm moving cities."
**Drew:** "This one's for me."
The bartender dims the lights out of respect for the dead. **[DARK]**

You jump onstage right at the key change.
You harmonize badly, on purpose.
Drew's solo becomes a two-person musical about parking tickets. **[LIGHT]**

Drew gets a polite clap.
The mic refuses to go back to Drew.
It has finally been loved.

Next: a wedding dance floor, and a DJ with a grudge.

*You don't steal the spotlight. You make it a group project.*

### S1 · cat_levity / friends / low · **Ol' Straight Face**
📍 *Karaoke bar. 11:52 PM. Saturday.*

One slot left on the karaoke list.
Drew, a coworker from accounting, is already holding the mic like a sceptre.

Drew picks a breakup song and points at an ex in the crowd.
**Quinn:** "Do something. Anything. I'm begging you."
**Drew:** "Verse two is about you. Yes, you."
The bartender dims the lights out of respect for the dead. **[DARK]**

You sign up next.
You perform the whole song standing perfectly still.
You read the lyrics in a flat voice, like a terms-of-service agreement. **[LIGHT]**

Drew gets a polite clap.
You get a standing ovation.
The ex asks for your autograph.

Next: a birthday toast, and nobody gave you a time limit.

*You never chase the laugh. You wait, and it walks over.*

### S2 · cat_structure / home / high · **Chief of Fridge Law**
📍 *Kitchen. 9:14 PM. Tuesday.*

You open the fridge.
Your lasagna is gone.
It had your name, the date, and a threat note on it.

Your roommate Sam is standing there, chewing.
**Sam:** "In my defence, the threat note was very polite."
**Sam:** "Also, it needed salt."
The fridge hums like an accomplice. **[DARK]**

You print a laminated map of who owns which shelf.
You tape a sign-out sheet to the fridge door.
You stick one note on Sam's door that just says "I know." **[LIGHT]**

By Friday, every leftover in the house is labelled.
Even the fridge has a label now.
It reads "Witness." **[DARK sting, secondary]**

Next: a shared freezer, and a mystery bag from 2023.

*Your rules aren't about control. They're how everyone gets to eat.*

### S2 · cat_structure / home / low · **The Leftover Whisperer**
📍 *Kitchen. 9:14 PM. Tuesday.*

You open the fridge.
You vaguely remember buying a lasagna.
It is gone.

Your roommate Sam is standing there, chewing.
**Sam:** "Was this yours? It tasted unsupervised."
**Sam:** "I'll say a few words at the service."
The empty dish sits on the counter like a tiny open grave. **[DARK]**

You shrug.
You build dinner from three condiments, half a lime, and pure confidence.
It is somehow excellent. **[LIGHT]**

Sam asks for the recipe.
There is no recipe.
Wherever that lasagna is now, it's jealous.

Next: a potluck, and you forgot it was today.

*No plan? No problem. You cook with whatever's left.*

### S3 · cat_communication / work / high · **Captain Last Word**
📍 *Office. 4:58 PM. Friday.*

Morgan from compliance reply-alls the entire company.
**Morgan:** "Per my last email."

Forty coworkers start typing replies at once.
Parker, at the next desk, leans over.
**Parker:** "This is how empires fall."
The thread grows teeth and begins to feed. **[DARK]**

You send one message.
It has three bullet points, one clear answer, and "Happy Friday, everyone." 
The typing stops like someone pulled the plug on a fog machine. **[LIGHT]**

The thread dies peacefully at 5:01 PM.
Morgan replies with one word: "Thanks."
It is clearly a surrender.

Next: a group call where everyone's on mute except one dog.

*You don't talk the most. You talk last, and it's over.*

### S3 · cat_communication / work / low · **The Quiet Closer**
📍 *Office. 4:58 PM. Friday.*

Morgan from compliance reply-alls the entire company.
**Morgan:** "Per my last email."

Forty coworkers start typing replies at once.
Parker, at the next desk, leans over.
**Parker:** "Say something. You're our only hope."
Somewhere, an inbox files for early retirement. **[DARK]**

You say nothing.
You walk to Morgan's desk with a fresh muffin as a peace offering. **[LIGHT]**
You ask one quiet question and nod once.

At 5:01 PM, Morgan sends one last email to everyone.
**Morgan:** "Resolved offline."
Nobody knows what you said.
The thread knows.

Next: a team icebreaker, and you have to share a "fun fact."

*Your silence isn't absence. It's a closing argument.*

### S4 · cat_resilience / home / high · **Saint of Spare Screws**
📍 *Living room. 8:30 PM. Sunday.*

Step 14 of the bookshelf instructions says "simple."
There are six screws left over.

The half-built shelf leans left, like it's eavesdropping.
Your sibling Rowan squints at it.
**Rowan:** "It hates us. I can feel it."
**Rowan:** "Look, the little cartoon figure in the manual is smiling."
It is, smugly.
It has done this to thousands of families. **[DARK]**

You take it all apart.
You rebuild it from step one, with one heroic snack break.
You make a crown out of the bubble wrap and wear it. **[LIGHT]**

The bookshelf stands perfectly straight.
The six screws are still left over.
You've made peace with that.
The screws haven't. **[DARK sting, secondary]**

Next: a bike tire, a pump, and a valve that says no.

*You lose a round, shrug, and go again. That's the trick.*

### S4 · cat_resilience / home / low · **Professor Good Enough**
📍 *Living room. 8:30 PM. Sunday.*

Step 14 of the bookshelf instructions says "simple."
There are six screws left over.

The half-built shelf leans left, like it's eavesdropping.
Your sibling Rowan squints at it.
**Rowan:** "Should we… start over?"
**Rowan:** "Or just hold a small funeral for it?" **[DARK]**

You declare it "rustic."
You wedge a paperback under the short leg.
You put a plant on top so nobody looks too closely. **[LIGHT]**

Guests call it charming.
The six screws live in a jar labelled "Mystery."
The bookshelf leans, but it's thriving.

Next: a wobbly table, and a dinner party in one hour.

*You don't fight what breaks. You redecorate around it.*


## 10. Comparison (real quotes)
**Co-Star** writes short, blunt, slightly rude push notifications. The Verge (2019) quotes: "Check your ego", "Do you play well with others?", "Look in the mirror and ask yourself 'who's the boss?'". Its writers produce snippets that the AI then "assembled… and remixed". https://www.theverge.com/2019/10/4/20879631/co-star-astrology-app-zodiac-signs
- Strength: bite and brevity.
- Weakness: no scene and no humor arc. It's an oracle, not a story.

**Spotify Wrapped, 2023 "Me in 2023" cards:**
- Cyclops: "When it comes to your listening, you're loyal and devoted. You like to focus on one genre. Sometimes while wearing a monocle."
- Luminary: "…You play light, upbeat music more than others. Bet you're fun at parties."
- Alchemist: "Listening is your laboratory… Nice work, doc."
- Sources: https://newsroom.spotify.com/2023-11-29/me-in-2023-streaming-habits-wrapped/ , https://epicstream.com/article/rarest-spotify-wrapped-personality-2023
- Strength: a flattering line plus a cheeky aside, and a shareable archetype.
- Weakness: it tells and is generic, with only 12 fixed cards.

**16Personalities, INTJ page:** "Architects are imaginative and strategic thinkers, with a plan for everything." and "They are imaginative yet decisive, ambitious yet private, and curious yet focused." https://www.16personalities.com/intj-personality
- Strength: names the contradiction, which feels deep and accurate.
- Weakness: long, earnest, no jokes.

**Where ours wins:** we *show* the trait through a scene (villain, ticking clock, escalation, callback), give one recurring joke structure per story, have lean variants, and keep the user as the hero. **What we took (now in §8):** Co-Star's ≤15-word punch reveal, Wrapped's cheeky aside, and 16P's "yet" paradox framing. All 8 reveals are now ≤12 words.

## 11. Self-critique, v3 (funny / captivating / makes sense after swap, 1–10)
| Story | First v3 pass | Problem | Final |
|---|---|---|---|
| S1 high | 8/8/9 | – | 8/8/9 |
| S1 low | 7/8/9 | The punchline lost its callback; the dialogue added nothing | 8/8/9 (Drew's "Verse two is about you. Yes, you." → "The ex asks for your autograph") |
| S2 high | 7/8/9 | A "**You, internally:**" line broke the rule that you never speak | 9/8/9 (cut, and Sam gets a second line instead: "Also, it needed salt.") |
| S2 low | 8/8/9 | – ("I'll say a few words at the service" mock-funeral) | 9/8/9 |
| S3 high | 8/8/9 | – | 8/8/9 |
| S3 low | 7/8/9 | The light joke was weak | 8/9/9 (peace-offering muffin; inbox "goes to live on a farm") |
| S4 high | 7/8/9 | No clear light joke | 8/8/9 (bubble-wrap crown) |
| S4 low | 8/8/9 | – | 9/8/9 |

Note on "goes to live on a farm": it's a pet-death euphemism, but applied to an inbox it's absurd. If emci wants zero pet-death echoes, swap it for "Somewhere, an inbox files for early retirement."
These are my own scores and haven't been user-tested.

### v4 clarity pass
All 8 stories got a line-by-line clarity pass (§2b). The jokes, format and LIGHT/DARK tags are unchanged. In S3 low, "goes to live on a farm" became "files for early retirement". Scores are unchanged or better: the swap-sense scores hold, and S2 high and S3 high improve because their lines are no longer misread.

## 12. Rulebook summary (v5): see `/workspace/ato-story-rulebook.md`
- **Skeleton contract:** Story Spine order, a fixed line map (H1–H3, T1–T4, M1–M4, P1–P3, next, reveal, title), fixed frames vs slots.
- **Required callbacks:** guest→guestPayoff; objectQuirk→objectTrigger→grudgeLine→objectWin→punchline sting; sideCharacter introduced before speaking.
- **Slot spec:** every slot type has a sentence frame, tags (article/plural/pronoun/rooms/settings/categoryId/lean), limits, tone, and good/bad examples.
- **Humor formulas:** each slot has one (quirk = mundane + exaggerated precision; grudge = human villain motive, deadpan; move = trait action, rule of three, absurd last; punchline = callback + status flip; reveal = "X yet Y" ≤15).
- **Coherence:** tags match; no repeated nouns except callbacks; present tense, 2nd person; no nested double quotes; never imply disabling safety devices.
- **QA:** render all combos in CI (length, grammar, clarity, banned topics, repeat nouns, unpaid setups, joke tags), a human funny-test (median ≥8), and a swap test against every compatible partner.
