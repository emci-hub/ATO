# Applied: set 9–10, Category deep dive + Story (2026-10-19)

1. Deep dive: `CLINICAL` now catches real clinical and diagnostic terms only (depression, narciss*, ADHD, OCD, PTSD, codependency, therap*, panic attack, mental health…). Ordinary words (worry, fear, stress, lonely, lazy, selfish, "avoids", "a depressing Monday") stay allowed, and the `should` advice test is unchanged. Three screen lines are clearer. The prompt was not touched.
2. Story: both leans are now treated the same. No "Professor/Ol'" titles for lows. Every v3 tip is a plain "Watch out:" that names a real cost on both sides ("can"/"may" for highs). Revolt "other way" lines are keyed per category. The score line now reads as a lean, not a test score. Titles that didn't match their stories and grammar slips are fixed.
3. Dark and adult jokes are kept per the Humor rule (eulogy, funeral, tombstone, drink, refugees, 2016, firing squad). No ids or shapes changed except one added map, `KEYED_OTHER_WAY` (story template text only). `LIBRARY_VERSION.story` is already `l4` and was not bumped again.

Checks: story-bank, story-templates, story-card6, story-clarity, story-gender, category-deep-dive (with new pins), wave20/21/22 and typecheck all pass. `check:ai-library` fails only on the stale bundle (`dive.ts` CLINICAL changed), which is expected: `gen:ai-library` + deploy was not run.

## Deep dive

| key | action | final text | what it fixes |
|---|---|---|---|
| dd.deep-dive-a4.validator-gaps | FIX (partial) | `CLINICAL` adds `codependen`, `therap`, `depressed\|depression\|depressive`, `narciss`, `adhd`, `ocd`, `ptsd`, `bipolar`, `autis`, `obsessive[- ]compulsive`, `panic attack`, `psychopath`, `sociopath`, `neurotic`, `mental health`, `mental illness` | Real gaps: "codependency", "therapeutic", diagnoses. The suggested ordinary words (worry, lonely, lazy, selfish, stubborn, cope, spiral, boundaries…) and the extra ADVICE list are not added (honesty rule). "avoids" is not added because it is ordinary. Pinned in `category-deep-dive-check.ts` both ways (rejects 8 terms, allows 6 ordinary words). |
| dd.deep_dive_legend | FIX | "One number for each part of you: how strongly you lean overall, counting your surest answers most (strongest first). Tap a row to see each trait. The small letters next to a name are the traits behind it." | Unclear: "Tap for each trait". The small trait codes are still on screen, so their explanation stays. |
| dd.deep_dive_ai_off | FIX | "Turn on AI in the You tab to get the written deep dive. Your leanings show either way." | Unclear ("on You"). Checked: the consent switch is on the You tab (`you.tsx` AiConsentCard). Pinned. |
| dd.deep_dive_failed | KEEP | "ATO couldn't write this one just now. Try again tomorrow." | "Your tokens are back" would not always be true. The same message shows for free library failures, where nothing was charged, and `refund_ai_tokens` refunds only once per day per feature (wave92 `on conflict … local_day`). See UNRESOLVED. |
| dd.deep_dive_empty-new_label | FIX / KEEP | EMPTY: "…check back in about an hour. Or write one now for 5 tokens." (uses `AI_PRICE_LABEL`). NEW_LABEL kept, because the button already renders `{DEEP_DIVE_NEW_LABEL} · {AI_PRICE_LABEL}`. | The note now names the price. Pinned. |
| dd.deep-dive-a1 / a2 / a3 | not mine (KEEP) | — | Prompt text belongs to the lead, who already rewrote it. No genuine contradiction found: STYLE explicitly overrides "describe and stop" and the register counts. A2's ban on worry/overthinking words and A3's upside-only othersNotice conflict with the honesty rule, so neither was applied. |
| dd.deep-dive-a6 / a7 | not mine | — | Consent copy and the review doc regeneration are outside this set. Stale comments remain: the `dive.ts` header says "pick on Home", and the `category-deep-dive-card.tsx` header says "One new card a day". |

## Story bank (`src/lib/story-bank/stories.json`)

| key | action | final text | what it fixes |
|---|---|---|---|
| steadiness_friends_high | FIX | title "The Wait-It-Out Host"; move "…start a ranking of the worst birthday songs until…"; punchline "…The ranking is at song nine." | Title and set-up mismatch (no hold music); "verse nine" doesn't parse |
| steadiness_work_high | FIX | reveal "To you, a snag is just a job with a shorter fuse."; next "Next: a call that drops twice. You call back first." | Grammar; unclear next |
| openness_work_high | FIX | "…a delay email with too many sorrys." | Grammar |
| openness_work_low | FIX move / KEEP hook | move "…take names the old way, the way it worked before the software."; "the old link is a tombstone" kept | Tangled sentence. The tombstone image is clear (Humor rule). |
| openness_friends_high | KEEP | "mouths the stop name like a eulogy" | Clear, funny, adult |
| drive_home_high | FIX | "You would rather make the thing real than keep stepping around it." | "furniture guilt" was unnatural. Meaning kept (finish it rather than leave it hanging). |
| agency_home_high | FIX | "hold it for a slow count of ten" | Grammar |
| social_friends_low | KEEP (restored) | "Your counter collects the refugees." | Common idiom for people escaping a party. It does not demean a group (Humor rule), so the softening was undone. |
| social_work_high | FIX | "Busy had to wait two minutes." | No song was set up; ties back to the two-minute tour |
| social_home_high | FIX | "The housemate in the hallway ends up with a slice." | "hallway mouth" was unclear |
| communication_friends_high | FIX | title "The Table-For-Four Line" | Title mismatch (the story is about the booking); near-duplicate of "Split-Check Architect" |
| communication_work_high | KEEP | "You send three bullets back." | Clear in a work-brief context |
| love_friends_high | FIX | twist "The silence still feels like weather."; reveal "You care out loud, then work at letting the room be enough." | "On read" then "unread" contradicted itself ("read receipt" is rejected by the parser as a niche phone detail). The reveal is clearer and keeps the honest limitation, as the honesty note asked. |
| love_friends_low | FIX hook / KEEP punchline | hook "A friend sends a long paragraph, then a second one that starts with anyway."; "just not a panicked one" kept | "voicey paragraph" was unclear; "panicked" is an ordinary word |
| love_work_high | KEEP | "You notice the gap, then you give it less oxygen." / "…proof that caring less is safer." | Clear and honest; the honesty note flagged the softer replacement |
| love_home_high | FIX | "…until they want company or the kettle clicks." | "the kettle is honest enough" was unclear |
| love_home_low | KEEP twist / FIX next | "You can feel the cushions closing in." kept; next "Next: a heavy talk. You suggest having it on a walk." | The twist is an honest feeling; the old next ("bench, not the sink") was unclear |
| independence_friends_low | FIX | title "The Plus-One Finder" | Unclear title |
| levity_work_high | FIX | "…added a forty-first greyscale box…" | The hook says 40 boxes |
| structure_friends_high | FIX | "only good intentions" / "The good intentions survive because they had a clock." / "You slip a quiet plan under the day so the fun can actually happen." / "followed the good intentions" | Slang ("vibes"); odd image ("hide a spine") |
| structure_work_high | FIX | next "Next: a trip nobody planned. You already packed the charger."; otherWay "…and called it going with the flow." | Imperative advice; slang ("a vibe", found in the pass) |
| structure_work_low | FIX | "park the other ten on a later list that is allowed to exist" | Redundant ("later parking lot") |
| resilience_friends_low | KEEP | "leave one drink early" | Adults; clear |
| resilience_work_high | KEEP | post-mortem / funeral inbox / tombstone | Clear dark humor, no boundary broken |
| levity_home_high | KEEP | "before bread gets a eulogy" | Absurd, fine |
| agency_work_low (pass) | FIX | title "The One-Question Card" | "After-The-Storm Note" didn't match the story (an urgent invite and one question card) |

## Story v3 templates (`topics.ts`, `slots.ts`, `render.ts`, `references.ts`)

| key | action | final text | what it fixes |
|---|---|---|---|
| dd.all-low-lean-titles | FIX | Captain Decoy Meme, Captain Mime Hour, Captain Legend, Captain Drawer Banner, Captain Fashionably Late, Saint of Please Wait, Captain Empty Carton, Captain Next Train, Captain Unlike It Now; revolt: Captain Tea Towel, Captain Side Door | Same honorifics on both leans. Reference "Professor Closet Door" not changed (see UNRESOLVED). |
| dd.low-lean-card-6-tips-keyed_tips-lows | FIX (honest on both sides, not upside-only) | Every high "Tip:" is now a "Watch out:" with a possible cost, e.g. social high "Watch out: a lot of energy can fill the room. Leave a quiet person a turn." and love high "Watch out: checking in a lot can feel like pressure to someone who needs space." Scolding lows are rewritten plainly: social low "Watch out: slipping away quietly can leave friends wondering where you went. A quick text helps."; love low "Watch out: needing room is fine, but a long quiet can read as pulling away. One line helps."; agency low "…can leave the choices to someone else."; resilience low "Watch out: letting one go is fine. Letting every one go can mean giving up on things you want."; independence low "Watch out: waiting for company can mean missing things you would enjoy alone."; openness low "…can mean missing a better one."; levity low "Watch out: a straight face can read as cold. One kind word helps."; muted low "Watch out: the mime gets a laugh, but the update only lands once you unmute."; wrong-chat low "Watch out: memes can bury a slip, but the person it was about may still want a "my bad.""; self-checkout low "Watch out: stepping aside works. Walking off without the bags would cost you the whole trip."; running-train low "…but work needs that text before you sit down." Topic high tips are all "Watch out:" (muted, called-on, forgot-name, party, phone-died, self-checkout, empty-milk, birthday, train, seat, old-photo). | Lows were scolded and highs encouraged. Both sides now get a plain, honest cost. Plain lows already fine are kept (drive, communication, structure, steadiness lows; menu, offline, legend, drawer, fashionably-late, wow, late-text, five-minutes, unlike-dance). |
| dd.surprise-party-early-low…reveal | FIX (topic) | "Your plans run messy, and you still beat the clock." | "always" overclaimed; "messy" kept as honest. Reference copy not changed (UNRESOLVED). |
| dd.forgot-name-low-reveal | FIX | "You keep it low-key and still save the moment." | Didn't match the move |
| dd.phone-died-high-title-reveal | FIX | "Captain Seven Minutes" / "When the clock gets tight, you stay calm and keep moving." | No host in the story; there was no wait |
| dd.wrong-group-chat…(twist, high reveal, high move) | KEEP | "like a tiny firing squad" / "You can always send better ones." | Clear dark image; "can always" means "it's always possible", not an absolute label. The high move "$60-bill cake" is in the approved reference (UNRESOLVED). |
| dd.liked-old-photo-hook-twist | KEEP | "photos from 2016" / "That like is from 2016." | 18+ now; the specific year is the joke (Humor rule). The high tip no longer mentions 2016 because it was rewritten as a Watch out. |
| dd.forgot-birthday-high-title | FIX | "Captain Midnight Muffin" | The story uses a muffin from home |
| dd.seat-neighbour-high-move | FIX | "You say you need to sleep before a big day." | Grammar |
| dd.render.ts-revolt-otherway | FIX | new `KEYED_OTHER_WAY` in `slots.ts`: each category's other way is the opposite lean's move, e.g. resilience high "…let it win and draped a tea towel over it.", agency low "…tried one careful fix, then a silly one." (the old line is kept as a fallback) | Wrong for resilience and agency |
| dd.slots.ts-reveal-resilience-low | FIX | "You pick your battles and let this one go." | Absolute claim; now matches the move |
| dd.render.ts-scoreline | FIX | "How strongly you lean here: {score}%." (`render.ts` + the unused reference template) | Test/score wording. The number is `categoryScore`, 50–100. |

## UNRESOLVED (for emci)

1. **Deep-dive failure message.** Should the failure note say "Your tokens are back"? Today it would be false for free library failures and for a second paid failure on the same day (one refund per day). Saying it accurately needs a paid-only message, a code change in the card.
2. **Approved reference stories** (`references.ts`, pinned by `check:story-templates` and `docs/story/full-samples.md`). May they be edited to match the template fixes? That means the title "Professor Closet Door" → "Captain Closet Door", the reveal "Your plans are messy, yet you always beat the clock." → "Your plans run messy, and you still beat the clock.", the unclear "I'm bringing a $60-bill cake." → "I'm in. I'm bringing the cake.", and the high-lean tips. Changing them also means updating the samples doc and the check.
3. **Out of my set:** `src/components/story-v2-view.tsx:89` still has a fallback `You scored ${score}.`. The stale comments in the `dive.ts` and card headers are noted in A6/A7 above.
