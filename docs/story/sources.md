# ATO Story: Existing Structures, Engines & Data We Can Reuse (licenses checked 2026-10-13)

> Not legal advice. Each license below was read from the source's own LICENSE or README, or from an authoritative page. Before shipping, have someone confirm the usable rows and keep a credits screen.

## 1. Recommendation (plain)
**Don't license a story generator. None of the usable ones is better than writing our own, and the good-quality text sources (TV Tropes, Mad Libs) can't be used commercially.**
Copy *proven structures* (ideas aren't copyrightable) and *open code and data*, then write the words ourselves:
- **Skeleton order:** a compressed Story Spine (Kenn Adams), plus kishōtenketsu's "ten" twist, mapped to our 6 beats (table §4).
- **Situation pool:** pick ~20 of Polti's 36 Dramatic Situations (public domain) and a handful of Plotto conflicts (US public domain), re-skinned as tiny household or work stakes ("deadline + adversary", "mistaken identity", "rivalry").
- **Engine:** the Tracery grammar format (Apache-2.0) plus our trait-keyed sub-symbols. Or Ink (MIT) if we ever want branching.
- **Object, place and job banks:** Darius Kazemi's `corpora` (CC0) as a *raw source*, filtered by hand into our funny, role-written slot entries.
- **Optional semantic help:** WordNet (permissive, needs its notice kept) and ATOMIC 2020 (CC BY 4.0, needs credit), for "what objects are in a kitchen" or "what happens if X". Writer-side tooling only.
- **Randomize per story:** situation, villain object (with its own grudge line), room or location, guest/deadline, side character. Trait keys (categoryId + lean) drive the move, reveal and title.

## 2. Proven structures (all usable as ideas; we write our own text)
| Structure | Source | How we use it |
|---|---|---|
| Story Spine: "Once upon a time / Every day / But one day / Because of that ×3 / Until finally / And ever since then" | Created by Kenn Adams in 1991; spread via Pixar (Emma Coats' "22 rules", #4). https://www.aerogrammestudio.com/2013/06/05/back-to-the-story-spine/ , https://www.npr.org/2026/06/23/nx-s1-5750619/meet-the-creator-of-the-story-spine-an-8-sentence-tool-to-create-and-analyze-stories , https://improvarchive.org/exercises/story-spine | Hook = Every day + But one day; Twist = Because of that; Move = Until finally; Reveal = And ever since then |
| Kishōtenketsu (introduction, development, twist, conclusion), the 4-panel yonkoma structure | A traditional form, so no license applies. Overview: https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu | The "ten" twist = an unexpected angle, not just conflict. Good for the low-lean "sideways win" |
| Dan Harmon story circle (8 steps) | Harmon's own write-ups (Channel 101 wiki). The idea is free; don't copy his text. | A cross-check that the user *wants*, *pays a price* and *changes* |
| Save the Cat beats (Blake Snyder) | The book is copyrighted and the trademark is "Save the Cat!" Use the concept only, never the beat-sheet text or the name in the product. | Too long for 100 words; only "opening image / catalyst / finale" are useful |
| Sitcom cold open + A-plot | Common TV craft | The hook works as a cold open; one A-plot, no B-plot |
| Improv "Yes, and" / "game of the scene" (UCB) | Common improv craft (*UCB Comedy Improvisation Manual*). The idea is free. | The "game" = the funny pattern (object with a grudge), heightened 3 times |
| Joke forms: setup/punch, rule of three, callback, misdirection | Common craft | Already in our bible §4 |

## 3. Engines and data: license table (paid iOS app)
| Source | License (verified) | Commercial in a paid app? | Notes / URL |
|---|---|---|---|
| **Tracery** (Kate Compton) | **Apache-2.0** (GitHub API) | ✅ Yes | Keep the NOTICE/attribution. https://github.com/galaxykate/tracery |
| **Ink** (inkle) | **MIT** (LICENSE.txt) | ✅ Yes | https://github.com/inkle/ink |
| **Darius Kazemi `corpora`** | **CC0** (README) | ✅ Yes, no attribution needed | Lists of objects, rooms, occupations, foods. Raw material only; it's not funny on its own. https://github.com/dariusk/corpora |
| **Polti, *36 Dramatic Situations*** | **Public domain in the US.** French 1895 is Gutenberg #72036; the English Ray translation (1916/1921) was published before 1931. | ✅ Yes | https://www.gutenberg.org/ebooks/72036 , https://archive.org/details/thirtysixdramati00poltuoft |
| **Plotto** (W. W. Cook, 1928) | **Public domain in the US** (all US works published before 1931 are PD per the Copyright Office's Circular 15A; the book bears "Copyright, 1928"). The author died in 1933, so it's also life+70 PD in most countries. | ✅ Yes (US; check the EU/UK edition if needed) | https://archive.org/details/plottonewmethodo00cook , https://www.copyright.gov/circs/circ15a.pdf |
| **WordNet** (Princeton) | WordNet License (permissive; OSI/SPDX listed) | ✅ Yes; keep the copyright notice, don't use "Princeton" in ads | https://wordnet.princeton.edu/license-and-commercial-use |
| **ATOMIC 2020** (AllenAI) | **Dataset CC BY**, code Apache-2.0 (README) | ✅ Yes, with attribution | https://github.com/allenai/comet-atomic-2020 |
| **ConceptNet 5** | **Data CC BY-SA 4.0** (DATA-CREDITS.md) | ⚠️ Risky. Share-alike could attach to a shipped derived word bank. Use only as a writer's reference, and never ship derived data. | https://github.com/commonsense/conceptnet5 |
| **RimWorld** rulepacks/grammar | Ludeon game content; the modding wiki describes the format | ❌ Don't copy the content. ✅ Copying the *idea* (subsymbols for articles) is fine. | https://rimworldwiki.com/wiki/Modding_Tutorials/GrammarResolver |
| **Wildermyth** events | Worldwalker Games game content | ❌ Content no. ✅ The role-casting/variant *idea* is fine. | https://www.wildermyth.com/wiki/Modding_variant_text |
| **Improbable Island** | **CC BY-NC-SA 2.0** (repo states) | ❌ Non-commercial | https://github.com/Cousjava/Improbable-Island |
| **TV Tropes** | **CC BY-NC-SA 3.0** | ❌ Non-commercial; also share-alike | https://tvtropes.org/pmwiki/pmwiki.php/MediaNotes/CreativeCommons |
| **Mad Libs** | © Penguin Random House; "Mad Libs" is a trademark | ❌ Don't copy the stories or use the name. The fill-in-the-blank *concept* is free. | — |
| **Reddit WritingPrompts** (Fan et al. 2018) | The paper states no license; the stories are Reddit users' copyrighted posts. A HF mirror (WritingPromptsX) *labels* itself CC0, but the uploader can't relicense users' posts. | ❌ Don't ship or copy the text | https://arxiv.org/abs/1805.04833 , https://huggingface.co/datasets/euclaise/WritingPromptsX |
| Humor/joke datasets (Kaggle "short jokes", rJokes, etc.) | Mostly scraped from Reddit/Twitter; unclear or no rights. **Not individually verified.** | ❌ Avoid shipping; OK only as private inspiration | — |
| Improv prompt / sitcom situation lists | Scattered blog lists with no clear license. **Not verified.** | ⚠️ Inspiration only; write our own | — |

## 4. Mapping: proven structure → our beats → our axes
| Our beat | Story Spine | Kishōtenketsu | Randomized from | Keyed by |
|---|---|---|---|---|
| settingTag | – | – | room/location bank (seeded from corpora CC0, then hand-filtered) | setting |
| hook | Every day + But one day | Ki (intro) | villain object + its habit; deadline/guest (Polti "obstacle", "pursuit") | setting |
| twist (+dialogue, DARK) | Because of that | Shō (development) | villain's grudge line; side character | setting |
| move (LIGHT) | Because of that → Until finally | **Ten** (twist) | – | **categoryId + lean** |
| punchline (callback) | Until finally | Ketsu (conclusion) | guest/deadline payoff | – |
| next | – | – | teaser bank | setting |
| reveal | And ever since then | – | – | **categoryId + lean** |
| title | – | – | – | **categoryId + lean** (pattern bank) |

Variety per user (example): 4 villains × 3 guests × 3 people × 3 times × 3 days × 3 teasers ≈ 2,900 renders for each categoryId/lean, from one skeleton. Scale to 20 villains and 10 guests per setting, then multiply by skeletons.

## 5. Demo
Grammar: `/workspace/ato-story-grammar-demo.json`. Tracery syntax, plus our extension: keyed sub-symbols `name__categoryId__lean`. Rendered with a 25-line Tracery-style expander (seeded).

**Copied vs ours.** Copied: Tracery's `#symbol#` / `[push:value]` / `.cap` syntax (Apache-2.0). Borrowed ideas, no text: the Story Spine order, a Polti-style "deadline + adversary" situation, rule of three, callback. **Every word is ours.** No corpora entries were used verbatim in this demo.

**The swap test caught 2 bugs** while I built this, which is exactly why we need the CI render-all check:
- "You unplug it" made no sense for the shower. It's now "drape a tea towel over #v#, like a white flag".
- "bow to an empty room" contradicted the side character being present. It's now "take a small bow for #p#".

Known weakness: in render 1, "borrow a ladder" goes nowhere. Guest bundles need a callback line, which is a v2 grammar item.

### 3 random renders (final)
**Chief of House Rules** (cat_structure / home / high)
📍 *Laundry room. 7:40 PM. Wednesday.*

Your new neighbour is stopping by in ten minutes to borrow a ladder.
The washing machine eats exactly one sock per load.
Tonight, the washing machine picks the worst possible moment.

Your roommate Ari backs away from it slowly.
**Ari:** "I think it's building something in there."
**Ari:** "Please tell me you have a plan."
It has kept every sock it ever took, and it will never say where. [DARK]

You pull out your binder of household instructions.
Page four covers the washing machine, with diagrams.
You follow them like a bomb squad with a label maker. [LIGHT]

Your new neighbour walks in right on time.
Everything looks perfectly normal.
The washing machine stays quiet, but it is clearly plotting. [DARK sting, secondary]

Next: a jar lid that has never been opened by anyone.

*Your systems aren't fussy. They're armour.*


**Professor Tea Towel** (cat_resilience / home / low)
📍 *Bathroom. 8:15 PM. Saturday.*

Your new neighbour is stopping by in ten minutes to borrow a ladder.
The shower goes ice-cold the moment you add shampoo.
Tonight, the shower picks the worst possible moment.

Your sibling Jess backs away from it slowly.
**Jess:** "Why is it screaming? Showers don't scream."
**Jess:** "Please tell me you have a plan."
It waits until you are fully committed, then strikes. [DARK]

You decide the shower can keep this one.
You drape a tea towel over the shower, like a white flag.
The tea towel has a duck on it, which feels respectful. [LIGHT]

Your new neighbour walks in right on time.
Everything looks perfectly normal.
The shower stays quiet, but it is clearly plotting. [DARK sting, secondary]

Next: a jar lid that has never been opened by anyone.

*Some fights aren't worth it, and you know which ones.*


**Captain Two Taps** (cat_structure / home / low)
📍 *Living room. 9:05 PM. Sunday.*

Your landlord arrives for an inspection in fifteen minutes.
The Wi-Fi router drops the internet whenever someone says 'one more episode'.
Tonight, the Wi-Fi router picks the worst possible moment.

Your sibling Jess backs away from it slowly.
**Jess:** "It heard you. It always hears you."
**Jess:** "Please tell me you have a plan."
Its little light turns red and stays red, like an evil eye. [DARK]

You have no plan and no manual.
You smack the Wi-Fi router twice, gently, like a vending machine.
It works, and you take a small bow for Jess. [LIGHT]

Your landlord walks in right on time.
Everything looks perfectly normal.
The Wi-Fi router stays quiet, but it is clearly plotting. [DARK sting, secondary]

Next: a smoke alarm that only beeps at 3 AM.

*You don't need a system. You need two taps and nerve.*


