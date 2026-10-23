# Copy review — set 9–10: Category deep dive + Story (2026-10-19)

Flags: `CATEGORY_DEEP_DIVE_COPY_REVIEWED`, `STORY_COPY_REVIEWED`, `STORY_BANK_COPY_REVIEWED`. Read-only review; no source edited.

**Summary**
1. Deep-dive prompt is mostly safe, but it pastes the whole `MOMENT_VOICE_BLOCK` (numbers, quotes, "describe and stop") and then overrides it. The model gets mixed signals, so expect more rejects and retries.
2. The GENTLE (Love) card feeds the model the raw axis ids `attachment_avoidance` / `attachment_anxiety`, which nudges it toward the exact words the validator bans.
3. The validator's `CLINICAL` list has real gaps (depress, panic, obsess, narciss, ADHD/OCD, abandon, boundaries, healing, overthink, worry…). "should" is the only advice word it catches.
4. Story bank: 66 cards, generally warm and well-made. 22 need small FIXes (no REMOVE): mismatched titles and set-ups, "guilt" and slang, "refugees", drinking, lots of death imagery, and Love cards that read like anxious attachment.
5. v3 templates: kindness is lopsided. High-lean cards get "Captain/Saint" titles and "Tip:". Low-lean cards get "Professor/Ol'" titles and a scolding "Watch out:". Two low reveals say "messy… always". The revolt grammar uses binder/two-taps "other way" lines for the wrong categories.

---

## A. Deep dive: prompt, validator, UI, consent

Any edit to `src/lib/category-deep-dive/dive.ts` prompt text needs `npm run gen:ai-library` + `supabase functions deploy ai-library` + a `LIBRARY_VERSION.deep_dive` bump. emci approves these.

**A1. Conflicting voice block (FIX).** `DIVE_PROMPT_STATIC` embeds `MOMENT_VOICE_BLOCK`, whose register examples contain quotes ("k.", "on my way") and numbers ("eleven ways", "47 tabs"). The RULES then ban both, and STYLE overrides "describe and stop". Replace `${MOMENT_VOICE_BLOCK}` with a deep-dive-only block:
```
VOICE
- Plain, warm, modern English, like a smart friend texting an observation. No slang.
- Examples from how people live now (texts, group chats, calendars, a free evening), never a strange one-off scene.
- Tease kindly at most. Nothing that would sting if someone read it over the reader's shoulder.
- No advice, no lesson, no question to reflect on, no psychology words.
```

**A2. GENTLE card leaks clinical axis ids (FIX, code + prompt).** `cardBlock` prints `axis "attachment_avoidance"` / `"attachment_anxiety"`, and "Watchful" is described as "Did I say something wrong?". Send neutral aliases for `cat_love` (e.g. `closeness_reach`, `closeness_watch`) and map them back in `parseDiveCard`. Also extend the GENTLE rule to:
```
- A card marked GENTLE is about closeness with friends, family and partners. Describe everyday habits warmly and plainly
  (replying, checking in, making plans, needing a quiet evening). Never diagnose, never suggest anything is wrong, never
  describe worry, fear of being left, or reassurance. Nothing physical or romantic-sexual. Words like anxious, insecure,
  avoidant, attachment, needy, clingy, worried, overthinking or abandoned never appear.
```

**A3. othersNotice can turn into judgement (FIX).** Change the line to:
`"othersNotice" — …: what the people around the reader probably notice and like about them here. Kind, specific. Never what others find hard, distant or too much.`

**A4. Validator gaps (FIX, `CLINICAL` in dive.ts, not prompt text, but the bundle still needs regen + deploy).** Suggested replacement:
```ts
const CLINICAL = /\b(anxious|anxiety|insecur|avoidan|avoidant|attachment|disorder|trauma|toxic|needy|clingy|codependen|diagnos|therap|symptom|red flag|depress|panic|obsess|compulsi|ocd|adhd|autis|bipolar|narciss|neurotic|paranoi|manic|psycho|mental health|abandon|people[- ]pleas|gaslight|dysfunction|unhealthy|emotionally unavailable|boundaries|healing|trigger(ed|ing)|cope|coping|overthink|spiral|meltdown|worri|worry|lonel|damaged|broken|baggage|lazy|selfish|stubborn|flaky|cold-hearted|control freak|too much)/i;
const ADVICE = /\b(should|try to|try not|consider|make sure|remember to|don['’]t forget|you might want|it['’]s okay to|give yourself|need to|work on|let yourself)\b/i;
```
Use `ADVICE` in `diveLineViolation` in place of the bare `should` test. Also note that today `codependent` misses "codependency" and `avoidant` misses "avoids".

**A5. Fixed UI wording (`src/components/category-deep-dive-card.tsx`).**

| Const | Original | Verdict | Replacement |
|---|---|---|---|
| DEEP_DIVE_LEGEND | "…Tap for each trait. The small letters are the traits behind it." | FIX | "One number for each part of you: how strongly you lean overall, with your surest answers counting most. Tap a row to see the traits behind it." |
| DEEP_DIVE_AI_OFF | "Turn on AI on You to get…" | FIX | "Turn on AI in the You tab to get the written deep dive. Your leanings show either way." |
| DEEP_DIVE_FAILED | "ATO couldn't write this one just now. Try again tomorrow." | FIX | "ATO couldn't write this one just now. Your tokens are back. Try again tomorrow." (refund already happens) |
| DEEP_DIVE_EMPTY / NEW_LABEL | "Or write one now." / "Write me a brand-new one" | FIX | Name the price: "Or write one now for 5 tokens." / "Write a brand-new one · 5 tokens" (unless the price is shown elsewhere) |
| others | — | OK | — |

**A6. Consent (`AI_USE_DISCLOSURE`).** OK: it names "category deep dives" correctly. Minor FIX in `COPY.home.body`: "ATO uses AI, based on your answers" reads as if it contradicts "never include… your answers". Use "based on which way your answers lean". Risk to check: `src/lib/ai-library/story.ts` still builds a Story polish prompt (`STORY_AI_POLISH = false`). If the server ever serves `kind: 'story'`, the consent copy (which says Story is not AI) would be wrong.

**A7. Review doc (FIX).** `docs/category-deep-dive-review.md` is stale. It says "on Home" (the deep dive moved to Explore), says "one new card a day" (it is library-first now), and its prompt samples are missing the "in the middle" and ANGLE rules. Regenerate with `scripts/gen-category-deep-dive-review.ts`. The `dive.ts` header also still says "pick on Home". Out of copy scope: `generate.ts` falls back to `ai-generate`, which is a closed 410 stub, so that path can only fail and refund.

---

## B. Story bank (`src/lib/story-bank/stories.json`): FIX only (no REMOVE)

| id / beat | Original | Verdict | Replacement | Reason |
|---|---|---|---|---|
| steadiness_friends_high / title, move, punchline | "The Hold Music Host" / "…a ranking of worst hold-music covers…" / "The ranking is at verse nine." | FIX | "The Waiting-Room Host" / "…start a ranking of the worst birthday songs until the table fills itself with chips and stories." / "The ranking is at song nine." | No hold music in the story; "verse nine" doesn't parse |
| steadiness_work_high / reveal, next | "A snag is just a job with a shorter fuse to you." / "Next: a call that drops, twice, then you." | FIX | "To you, a snag is just a job with a shorter fuse." / "Next: a call that drops twice. You dial back first." | Grammar; next is unclear |
| openness_work_high / twist | "…a delay email with too many sorry." | FIX | "…a delay email with too many sorrys." | Grammar |
| openness_work_low / hook, move | "the old link is a tombstone" / "…take names the way the building learned before the software did." | FIX | "the old link leads nowhere" / "…take names the old way, the way that worked before the software." | Death imagery; tangled sentence |
| openness_friends_high / twist | "mouths the stop name like a eulogy" | FIX | "mouths the stop name like bad news" | Death imagery (banned-topic family) |
| drive_home_high / reveal | "…than keep it as furniture guilt." | FIX | "You would rather build the thing than keep walking around it." | "Guilt" framing (no-guilt rule) |
| agency_home_high / move | "hold it for the counted ten" | FIX | "hold it for a slow count of ten" | Grammar |
| social_friends_low / punchline | "Your counter collects the refugees." | FIX | "Your counter collects everyone who needed a breather." | Insensitive word |
| social_work_high / punchline | "Busy had to wait one song." | FIX | "Busy had to wait two minutes." | No song set up |
| social_home_high / punchline | "The hallway mouth learns to smile." | FIX | "The housemate in the hallway ends up with a slice." | Unclear image |
| communication_friends_high / title | "The Split-The-Bill Speech" | FIX | "The Table-For-Four Line" | Story is about the booking, not the bill; near-duplicate of drive "Split-Check Architect" |
| communication_work_high / next | "You send three bullets back." | FIX | "You send three bullet points back." | Reads as violent out of context |
| love_friends_high / twist, reveal | "The unread bubble still feels like weather." / "You care loudly, then you practice letting the room be enough." | FIX | "The read receipt still feels like weather." / "You care out loud, and you still enjoy the room you're in." | It says "on read" and then "unread"; "practice" frames caring as something to manage (diagnosis-adjacent) |
| love_friends_low / hook, punchline | "a long voicey paragraph" / "…just not a panicked one." | FIX | "a long voice note, then a second one that starts with anyway" / "…just not a rushed one." | Unclear; "panicked" is clinical-adjacent |
| love_work_high / reveal, otherWay | "You notice the gap, then you give it less oxygen." / "…proof that caring less is safer." | FIX | "You notice when someone goes quiet, and you keep it light." / "The other way, you would not have noticed the quiet until tomorrow." | Reads as anxious-attachment rumination; GENTLE rule |
| love_home_high / move | "…until they want company or until the kettle is honest enough." | FIX | "…until they want company or the kettle clicks." | Unclear |
| love_home_low / twist, next | "You can feel the cushions closing in." / "Next: a heavy talk. You pick a bench, not the sink." | FIX | "You'd like a minute before the whole day." / "Next: a big talk. You suggest doing it on a walk." | Casts closeness as a threat; next is unclear |
| independence_friends_low / title | "The We-Can-Walk-It" | FIX | "The Plus-One Finder" | Unclear title |
| levity_work_high / otherWay | "…added a fourth greyscale box…" | FIX | "…added a forty-first greyscale box…" | Hook says 40 boxes |
| structure_friends_high / hook, punchline, reveal, otherWay | "only vibes" / "The vibes survive…" / "You hide a spine under a day so the fun can actually occur." / "followed the vibes" | FIX | "only good intentions" / "The good intentions survive because they had a clock." / "You slip a quiet plan under the day so the fun can actually happen." / "followed the good intentions" | Slang (moment-voice rule); odd image |
| structure_work_high / next | "Next: a trip nobody plotted. Pack the charger anyway." | FIX | "Next: a trip nobody planned. You already packed the charger." | Imperative = advice |
| structure_work_low / move | "park the other ten in a later parking lot that is allowed to exist" | FIX | "park the other ten on a later list that is allowed to exist" | Redundant |
| resilience_friends_low / move | "leave one drink early" | FIX | "head home a little early" | Audience is 16+ |
| resilience_work_high / twist, punchline, reveal | "post-mortem… The inbox wants a funeral." / "The funeral inbox waits." / "…not a tombstone." | FIX | "a what-went-wrong doc… The inbox wants a long apology." / "The apology draft waits." / "…not a final word." | Three death images in one card |

Pattern notes (no single-card verdict): "novel" is used as a metaphor 6+ times, "kettle" appears in ~8 cards, and both love_home cards are kettle titles ("Kettle Check-In" / "Kettle Timer"). levity_home_high (burnt toast + alarm) and resilience_home_low (burnt dinner + alarm) are near-duplicate premises. "eulogy" also appears in levity_home_high ("before bread gets a eulogy"); I'd let that one stay as absurd, but the banned-topic regex (`story-v3/banned.ts`) should add `funeral|eulogy|tombstone|grave` so the count stays low.

## B2. v3 templates (`story-v3/topics.ts`, `slots.ts`, `render.ts`)

| Where | Original | Verdict | Replacement | Reason |
|---|---|---|---|---|
| all low-lean titles | "Professor Decoy Meme", "Professor Mime Hour", "Ol' Legend", "Professor Tea Towel"… vs high "Captain/Saint…" | FIX | Give lows the same honorifics as highs (e.g. "Captain Decoy Meme", "The Mime Hour Hero") | Equal kindness: the lows read as the comic loser |
| low-lean card 6 tips + `KEYED_TIPS` lows | "Watch out: … A disappearing act is not." / "Silence can look like leaving." / "…not the same as disappearing." / "mime works once. Next time, find the button." | FIX | Use "Tip:" with an upside for both leans, e.g. social low "Tip: a smaller room is a real choice. A quick 'heading off' text makes it easy." love low "Tip: a little room is kind. One line keeps people close." | Lows are scolded and highs are encouraged; shame framing |
| surprise-party-early low + surprise-guest low / reveal | "Your plans are messy, yet you always beat the clock." | FIX | "You skip the perfect version and still open the door on time." | "always" + "messy" |
| forgot-name low / reveal | "You recharge in quieter company, then still save the bit." | FIX | "You keep it low-key and still save the moment." | Doesn't match the move |
| phone-died high / title, reveal | "The Seven Minute Host" / "When a plan stalls, you turn the wait into motion." | FIX | "Captain Seven Minutes" / "You stay even when the clock wobbles." | No host; reveal is off-story |
| wrong-group-chat / twist, high reveal, high move | "like a tiny firing squad" / "You can always send better ones." / "I'm bringing a $60-bill cake." | FIX | "like a tiny jury" / "You can send better ones." / "Real message: I'm in. I'm bringing the cake." | Violence image; "always"; unclear |
| liked-old-photo / hook, twist | "photos from 2016" / "That like is from 2016." | FIX | "photos from years ago" / "That like is from years ago." | For a 16-year-old reader the crush would have been a child in 2016 |
| forgot-birthday high / title | "Captain Gas Station Cake" | FIX | "Captain Midnight Muffin" | Story uses a muffin from home |
| seat-neighbour high / move | "You say you have a deadline sleep to catch." | FIX | "You say you need to sleep before a big day." | Grammar |
| `render.ts` revolt otherWay | High: "…two taps and a bow." Low: "…opened the binder and followed page four." for every category | FIX | Key it per category like `KEYED_EVIDENCE` (resilience high: "…let it win and draped a tea towel"; agency high: "…let it have the round and set out cups") | Wrong for resilience and agency |
| `slots.ts` reveal resilience low | "You pick your battles, yet you never lose the match." | FIX | "You pick your battles and still come out fine." | Absolute claim |
| `render.ts` scoreLine | "You scored ${traitScore}." | FIX | Drop it, or "You lean this way ${traitScore}%." | Score/test word |
| `polish.ts` prompt | — | OK (off) | — | `STORY_AI_POLISH=false`. If it is ever turned on, it needs gen + deploy + consent update |
| `lean-phrases.ts` | — | OK | — | Map-category leans are still provisional (TODO noted) |

## Spot-check OK (story bank)

1. stbank_steadiness_work_low: "You feel the spike, then you give it a smaller job." Kind low-steadiness framing.
2. stbank_steadiness_home_high: blackout/fuse box. Clean, funny, no shame.
3. stbank_openness_friends_low: the noodle counter. A low-openness card with a clear upside.
4. stbank_drive_friends_low: "ride a decent plan than invent a perfect one." Equal kindness.
5. stbank_agency_home_low: roast becomes stew. Good move and payoff.
6. stbank_social_home_low: "You love your people in doses that let you return." Best line in the set.
7. stbank_levity_friends_low: apology before the bit. Warm, clear moral without advice.
8. stbank_independence_home_low: "A night counts more when a pot has more than one spoon."
