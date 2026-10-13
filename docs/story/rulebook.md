# ATO Story Rulebook: Structure + Rules for Slot Writers (v1)

> Purpose: any writer, human or AI, can add slot options that **always combine smoothly and funnily**. Companion files: `ato-story-writer.md` (voice and format), `ato-story-sources.md` (licenses), `ato-story-grammar-demo.json` (reference implementation).

## 1. Skeleton contract
Order follows the Story Spine (Adams 1991): *Every day → But one day → Because of that → Until finally → And ever since then.* Each beat is one swipe card.

| Card | Line | Content | Fixed or slot | Spine step |
|---|---|---|---|---|
| tag | – | `📍 *{room}. {time}. {day}.*` | slots | – |
| hook | H1 | `{deadline}` | slot (from guest bundle) | Every day / But one day |
| | H2 | `{Object} {objectQuirk}.` | slot | Every day |
| | H3 | `{objectTrigger}` | slot | But one day |
| twist | T1 | `Your {rel} {person} watches {object} and backs away slowly.` | fixed frame + slots | Because of that |
| | T2 | `**{person}:** "{objectSideLine}"` | slot | |
| | T3 | `**{person}:** "{panicLine}"` | slot | |
| | T4 | `{grudgeLine}` **[jokeDark]** | slot | |
| move | M1–M3 (+M4 `{objectWin}`) | `move[categoryId][lean]` | keyed slot | Until finally |
| punchline | P1 | `{guestPayoff}` | slot (from guest bundle) | |
| | P2–P3 | `punchlineVariant` (object callback + sting) **[jokeDarkSecondary]** | slot | |
| next | N1 | `Next: {next}.` | slot | |
| reveal | R1 | `*{reveal[categoryId][lean]}*` | keyed slot | And ever since then |
| title | – | `title[categoryId][lean]` | keyed slot | – |

| card6 | W1–W4 | `This is your {categoryName}: {leanPhrase}.` / `{scoreLine}` / `Proof: {evidenceMove}.` / `{tipOrWatchOut}` | fixed frames + keyed slots (see §1b) | – |

**Required callbacks.** Every setup names its payoff, and CI fails any unpaid setup:
- `guest.deadline` (H1) → `guest.guestPayoff` (P1). Each guest bundle ships both lines.
- `object.objectQuirk` (H2) → `objectTrigger` (H3) → `grudgeLine` (T4) → `objectWin` (inside the move, when the move "fixes" the object) → `objectSting` (P2–P3 via the punchline variant naming `{object}`).
- `sideCharacter` (T1) → appears again in T2/T3, and optionally in the move (e.g. "a small bow for {person}").
- `objectSideLine` must react to *this* object's quirk, never to something not yet shown.

## 1b. Card 6: "Why this is you" (v7, approved by emci)
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

## 2. Slot spec
For every slot: **frame** = the exact sentence it plugs into. **Tags**: `article` (a|an|the|none), `plural` (bool), `pronoun` (it|they|he|she). Limits are in words.

| Slot | Purpose | Frame / form | Limit | Tone | Must include / avoid | Compatibility tags | ✅ Good ×2 | ❌ Bad (why) |
|---|---|---|---|---|---|---|---|---|
| **situation** | Picks the skeleton's premise (Polti-style: deadline + adversary, rivalry, mistaken identity) | Metadata only; selects which guest and object pools apply | – | – | Must create a *ticking clock* | settings[] | "deadline+adversary"; "rivalry over a shared thing" | "a bad day" (no clock, no adversary) |
| **objectVillain** | The petty antagonist | Noun phrase with article: `{the toaster}`. Used as `{object}` and `{Object}` | 1–4 | – | Household or office object. Never a person, animal, or safety device (smoke alarm, stove flame). | rooms[], settings[], pronoun | "the toaster"; "the washing machine" | "the smoke alarm" (the tea-towel move would teach covering it, which is unsafe) |
| **objectQuirk** | Its everyday crime | Predicate after the subject: `{Object} ___.` Present tense, 3rd person singular. | ≤12 | light-dark | A specific behaviour + exaggerated precision | per object | "burns the left side of every slice, and only the left side"; "clicks off exactly one degree before the water boils" | "is annoying" (vague, no image) |
| **objectTrigger** | Why you need it *now* | A full sentence, 2nd person, present | ≤10 | neutral | A tiny need that ties to the deadline | per object | "You need one cup of hot water, just one."; "You need your only matching pair of socks, fast." | "Tonight, it picks the worst possible moment." (vague; says nothing happened) |
| **grudgeLine** | The DARK joke | A full sentence; subject = object or "It" | ≤14 | **dark** | A human villain motive, said deadpan. Escalates the quirk. | per object | "It clicks off four times in a row, like it's counting your mistakes."; "It has kept every sock it ever took, and it will never say where." | "It breaks." (no motive, no joke) |
| **objectWin** | The object finally works | A full sentence | ≤10 | light | Resolves the trigger exactly | per object | "It spits out both socks, damp but matching."; "The water finally boils, with a sulky little hiss." | "It works." (doesn't name what was resolved) |
| **room** | Setting tag | Capitalized noun: `📍 *{Room}. …*` | 1–2 | – | Must be in object.rooms | setting=home → Kitchen, Laundry room, Living room, Home office, Bathroom | "Kitchen"; "Laundry room" | "Garage" for the kettle (incompatible) |
| **guest** | Ticking-clock person (bundle) | `guest` = noun phrase with "your" ("your aunt"). Bundle = {deadline, guestPayoff} | – | – | Relationship-only label, no surname. Must appear in the payoff. | settings[] | "your aunt"; "your landlord" | "Karen" (unintroduced; also a loaded name) |
| **deadline** | H1 | `Your {guest} {verb phrase} in {number-word} minutes.` | ≤14 | neutral | A number, written as a word | per guest | "Your aunt is coming over for tea in twenty minutes."; "Your landlord arrives for an inspection in fifteen minutes." | "Someone is coming soon." (no who, no number) |
| **guestPayoff** | P1: the guest arrives and reacts | `Your {guest} arrives, {action}, and {reaction}.` | ≤14 | light | Calls back the deadline's purpose (tea, inspection, ladder) | per guest | "Your landlord arrives and ticks every box on his clipboard."; "Your new neighbour arrives, takes the ladder, and says the place smells nice." | "The guest leaves." (no callback to their purpose) |
| **sideCharacter** | Witness + dialogue | `Your {rel} {Name}`, then `**{Name}:**` | name 1 word | – | Introduced in T1 before speaking | rel ∈ roommate, sibling, partner (home); coworker (work) | "[p:Sam][rel:roommate]"; "[p:Rowan][rel:sibling]" | "[p:Mr. Dobson]" with no relation (reader asks "who?") |
| **objectSideLine** | T2: reaction to *this* quirk | `**{Name}:** "___"` | ≤12 | light-dark | Refers only to things already shown | per object | "It's doing it on purpose. Look at it."; "I think it's building something in there." | "It heard you." when nobody said anything (missing context) |
| **panicLine** | T3: raises the stakes | `**{Name}:** "___"` | ≤12 | light | Works with any object/guest | any | "We have minutes. Minutes!"; "Should I hide? I feel like I should hide." | "This toaster is evil." (object-specific in a generic slot) |
| **move[categoryId][lean]** | Trait-shaped action | 3 lines, 2nd person present; may end with `{objectWin}` | ≤14/line | **light** (jokeLight line marked) | A trait-shaped action, a rule of three, last item absurd. Uses `{object}`/"it", never specific object parts (no "plug", "lid"). | categoryId, lean, settings[] | structure/high: "binder… diagrams… bomb squad with a label maker"; structure/low: "two firm taps, like it owes you money" | "You unplug it" (breaks for the shower; see the swap test) |
| **punchlineVariant** | P2–P3 object callback + sting | 2 lines after P1; must name `{Object}` | ≤12/line | **dark** sting | A callback to the setup noun + a status flip, funny word last | any | "Nobody mentions {object} once. / {Object} has noticed that nobody mentions it."; "…behaves perfectly until the front door closes. / Then it does its thing again, just for you." | "Everything was fine." (no callback, no sting) |
| **reveal[categoryId][lean]** | The trait insight | One italic sentence (or "X. Y."); 2nd person | ≤15 | warm | An "X yet Y" paradox or a flip. No therapy-speak, no rhetorical questions. | categoryId, lean | "You don't win first. You win last."; "No system, yet somehow everything works. That's your system." | "It's okay to take your time on your journey." (therapy-speak, cliché) |
| **title[categoryId][lean]** | Nickname | Patterns: The ___ Whisperer / Captain ___ / Saint of ___ / Professor ___ | ≤4 | fun | Passes "you're such a ___"; echoes the story | categoryId, lean | "Captain Two Taps"; "Professor Tea Towel" | "The Warm-Page Runner" (made-up compound job) |
| **next** | Teaser | `Next: ___.` A noun phrase + a hint of doom | ≤12 | light-dark | A new object, not used in this story | settings[] | "a fitted sheet, and it refuses to be folded"; "a doorbell that rings when nobody is there" | "more adventures" (generic) |

## 3. Humor formulas per slot
- **objectQuirk** = specific mundane behaviour + exaggerated precision ("exactly", "only", numbers).
- **objectTrigger** = the smallest possible need, stated humbly ("just one").
- **grudgeLine** = the object given a human villain motive, deadpan, escalating the quirk ×3 or ×4.
- **objectSideLine** = the side character treats the object as sentient.
- **panicLine** = overreaction to tiny stakes.
- **move** = a trait-shaped action, rule of three, last item absurd (or a simile with a social motive: "like it owes you money").
- **objectWin** = success with a tiny cost or attitude ("damp but matching", "sulky little hiss").
- **guestPayoff** = the guest's purpose fulfilled + a backhanded or oblivious reaction.
- **punchlineVariant** = a callback to the setup noun + status flip (the object now has feelings or plans), funny word last.
- **reveal** = "X yet Y" or "not X, Y", ≤15 words.
- **title** = a honorific + an absurdly specific noun from the story.

## 4. Compatibility and coherence rules
1. **Tags must match:** room ∈ object.rooms; setting ∈ every slot's settings; the move must not assume object parts.
2. **Every setup is paid off:** the guest appears in P1, the object appears in P2/P3, and if the move "fixes" the object, `objectWin` states the result.
3. **No repeated nouns** within a story except deliberate callbacks (object, guest, person). Use "it" for the second mention inside a beat. Avoid echoes like "washing machine… like a vending machine".
4. **Tense/POV:** narration is present tense, 2nd person for the user, 3rd person for others. Dialogue can be any tense.
5. **Every named person is introduced** with their relation before speaking. "You" never speaks in quotes.
6. **No nested double quotes.** Use single quotes inside dialogue.
7. **Safety:** never imply disabling safety devices; never use dangerous fixes (water + electrics, climbing on furniture).
8. **One dark + one light minimum.** The dark joke lives in T4 (and optionally the P3 sting); the light joke in the move's marked line.

## 4b. Gender-neutral rule (v6, approved by emci)
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

## 5. QA gates
**Automated (CI `check:story-templates`), all must pass:**
- Render **every combination** of compatible slots (cartesian product filtered by tags).
- Length: words per line ≤14 (≤12 for dialogue), story ≤120, reveal ≤15, title ≤4.
- Grammar: articles from tags, `.cap` at sentence start, no unfilled `#…#`, no doubled spaces or punctuation.
- Clarity: flag 3+ comma items before the main verb, two sentences on one line (reveal and dialogue exempt), and any undefined speaker.
- Banned topics and clichés list (writer bible §2, §5).
- Repeated nouns: any content noun appearing twice outside the callback whitelist → flag.
- Unpaid setups: a guest without a payoff, an object not named in the punchline, a move that fixes the object without `objectWin`.
- Gender: `check:story-gender` (§4b).
- Card 6: `check:story-card6` (§1b).
- Joke tags: jokeLight and jokeDark exist, sit on different lines, and point to existing lines.

**Human funny-test** (3 readers, or 1 reader + an AI judge, with a blind random sample of 20 renders per new option): score funny / captivating / makes-sense 1–10. **Cutoff: median ≥8 on all three.** Rewrite or cut below that.

**Swap test:** each new option is rendered against *every* compatible partner (all objects × all moves × all punchlines × all guests). One broken combo fails the option, so either fix the option or narrow its tags.

## 6. Option-writing workflow checklist
1. Pick the slot type and read its frame in §2. Write *into the frame*, not freestyle.
2. Apply the humor formula (§3).
3. Fill the tags: article, plural, pronoun, rooms, settings, categoryId/lean.
4. If it's a setup, write its payoff in the same bundle (guest → payoff; object → quirk, trigger, grudge, win, sideLine).
5. Run the clarity rule: one idea per line, ≤14 words, named objects, introduced people.
6. Check safety: no real harm, no disabling safety devices, no cruelty to the user.
7. Run `check:story-templates` and fix all flags.
8. Read 5 random renders that include the option aloud. Does it still make sense and get a laugh?
9. Submit for the human funny-test (median ≥8).
10. Add to the bank with an `addedBy` / `addedAt` stamp. Retire any option that keeps scoring under 8 in live feedback.

## 7. Reference renders (from the rebuilt demo grammar, after self-critique)
Fixed in this rebuild:
- The guest is now always paid off (P1 `guestPayoff`).
- The vague "picks the worst possible moment" is replaced by a per-object `objectTrigger`.
- There are 4 punchline variants.
- Objects carry `rooms` tags.
- Each object has an `objectWin`, so fix-type moves resolve the trigger.
- The repeated-noun "vending machine" simile became "like it owes you money".
- "It heard you" (missing context) became "Don't say the word 'episode.' It's listening."
- The tea-towel move uses "it" for the second mention.

| Render | v1 score (F/C/S) | Problem | Final |
|---|---|---|---|
| 1 structure/high | 8/8/9 | – | 8/8/9 |
| 2 structure/low | 6/7/7 | "machine… vending machine" repeat; the socks were never recovered | 8/8/9 |
| 3 resilience/high | 7/8/7 | The move never fixed the toaster | 8/8/9 (adds objectWin) |
| 4 resilience/low | 7/7/7 | "It heard you" had no context; the router was named 3× | 8/8/8 |

**Chief of House Rules** (cat_structure / home / high)
📍 *Kitchen. 9:05 PM. Saturday.*

Your aunt is coming over for tea in twenty minutes.
The toaster burns the left side of every slice, and only the left side.
You drop in two slices for a quick snack.

Your roommate Sam watches the toaster and backs away slowly.
**Sam:** "It's doing it on purpose. Look at it."
**Sam:** "We have minutes. Minutes!"
It fires both slices at the ceiling, like a warning shot. [DARK]

You pull out your binder of household instructions.
Page four covers the toaster, with diagrams.
You follow them like a bomb squad with a label maker. [LIGHT]
The next slice pops up golden on both sides.

Your aunt arrives, sips her tea, and calls the place "very lived in."
Nobody mentions the toaster once.
The toaster has noticed that nobody mentions it. [DARK sting]

Next: a doorbell that rings when nobody is there.

*Your systems aren't fussy. They're armour.*

**Captain Two Taps** (cat_structure / home / low)
📍 *Laundry room. 6:50 PM. Wednesday.*

Your new neighbour is coming by in ten minutes to borrow a ladder.
The washing machine eats exactly one sock per load, never two.
You need your only matching pair of socks, fast.

Your sibling Rowan watches the washing machine and backs away slowly.
**Rowan:** "I think it's building something in there."
**Rowan:** "Should I hide? I feel like I should hide."
It has kept every sock it ever took, and it will never say where. [DARK]

You give the washing machine two firm taps, like it owes you money. [LIGHT]
It spits out both socks, damp but matching.
You take a small bow for Rowan.

Your new neighbour arrives, takes the ladder, and says the place smells nice.
The washing machine stays silent the whole visit.
It is clearly saving its energy for you. [DARK sting]

Next: a doorbell that rings when nobody is there.

*No system, yet somehow everything works. That's your system.*

**Saint of Round Four** (cat_resilience / home / high)
📍 *Kitchen. 7:40 PM. Wednesday.*

Your landlord arrives for an inspection in fifteen minutes.
The toaster burns the left side of every slice, and only the left side.
You drop in two slices for a quick snack.

Your roommate Sam watches the toaster and backs away slowly.
**Sam:** "It's doing it on purpose. Look at it."
**Sam:** "We have minutes. Minutes!"
It fires both slices at the ceiling, like a warning shot. [DARK]

You try again, then again, then a third time with snacks.
On try four, you start humming a training-montage song.
Sam joins in, badly, on the harmony. [LIGHT]
The next slice pops up golden on both sides.

Your landlord arrives and ticks every box on his clipboard.
Nobody mentions the toaster once.
The toaster has noticed that nobody mentions it. [DARK sting]

Next: a fitted sheet, and it refuses to be folded.

*You don't win first. You win last.*

**Professor Tea Towel** (cat_resilience / home / low)
📍 *Living room. 7:40 PM. Wednesday.*

Your aunt is coming over for tea in twenty minutes.
The Wi-Fi router drops the internet whenever someone says "one more episode".
You need it to play some calm background music.

Your sibling Rowan watches the Wi-Fi router and backs away slowly.
**Rowan:** "Don't say the word 'episode.' It's listening."
**Rowan:** "Please tell me you have a plan."
Its little light turns red and stays red, like an evil eye. [DARK]

You decide the Wi-Fi router can win this one.
You drape a tea towel over it, like a white flag.
The tea towel has a duck on it, which feels respectful. [LIGHT]

Your aunt arrives, sips her tea, and calls the place "very lived in."
The Wi-Fi router behaves perfectly until the front door closes.
Then it does its thing again, just for you. [DARK sting]

Next: a fitted sheet, and it refuses to be folded.

*You pick your battles, yet you never lose the war.*

