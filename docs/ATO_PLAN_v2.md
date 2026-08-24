# ATO — one plan for any AI (Claude, Cursor, DeepSeek, whoever's building)

Fresh build. Nothing carries over from the old Bolt version except the domain (astrollogs.com) — that's a link, not a foundation. Code starts here.

---

## Glossary (read this before anything else)

If a field isn't defined here, don't guess its shape — ask.

| Term | Type | Meaning |
|---|---|---|
| `ME` | row (Supabase) | The user's profile. See fields below. |
| `show_up` | string, free text | Answer to onboarding Q3: "What are you in this week?" One sentence, user's own words. |
| `knocks_you_off` | string, free text | Answer to onboarding Q5. One sentence. |
| `morning_cue` | string, free text | Answer to onboarding Q6: "What do you already do every morning?" Anchors the if-then Do. |
| `talk_style` | enum: `quiet`/`even`/`loud` | Derived from onboarding Q4 + Q5. Set once at onboarding, editable later in Settings. |
| `this_week` | string, free text, resets weekly | Sunday + Sage use only. Never a matching signal. |
| `recipe` | object `{base, hair, top, palette}` | Kenney asset selections that render the pixel. All 4 fields required once Pixel is built. |
| `valence` | enum: `lift`/`even`/`cut` | Computed from last 7 Checks. See formula in Rules. |
| Check | row `{user_id, do_id, date, outcome}` | `outcome` is `did` or `skip`. One per day max. No partial state in v1 — keep it binary. |
| `check_count` | integer, derived | Count of all-time Checks. Gates bank-vs-model content and the paywall (7). |
| `host` | boolean on ME | You flip this manually (admin). Not self-serve in v1. |

---

## Two jobs, never one screen

**Spine (the app).** Learn about you. Home card + Sage + a pixel face. Alone: Home, Sage, You.

**Around (later).** Get out with people who match. Circle, then Calgary nights, then plugs. Never on Home.

If Home is stale, fix Home. Do not open extras because they are in this file.

**ATO** = the app and a profile (screen name "What's your ATO?" = @handle). Legal entity: **AsTrollOGs** (used only in About/legal copy). Sage = voice. Pixel = body.

Not Co-Star, not a feed, not therapy, not Great Sage, not Yelp.

---

## A normal day (build this)

Widget: Read + if-then Do. Home: face from yesterday's Check, one line in their style (lift / even / cut), one finishable Do, More → Sage. Evening: Check **today** (did/skip). Face moves. Result strip. Stop.

Circle hidden until a QR scan adds the first friend — "a scan" and "first add" are the same event; there is one gate, not two. QR lives on the You tab. After a scan: today's faces. Chat is a tap from a Circle card. Thread stays.

---

## Dies if (read before every stage)

- Card matches last 7, or Do is vague → they won't open tomorrow.
- Around opens with 0 shows or a wall with 0 writers → they never come back to Around.
- A Tickets / Food / Hosts tab with 0 live rows → catalog. Apple can bounce it. Interest is already gone.
- Paid before 7 Checks, or paywall on Home / Check / crisis / widget → they feel tricked.
- Home sells, or a city-wide wall, or live "who's here" → spine is dead.
- Chat ships with no working block/mute/report → Apple rejects it (Guideline 1.2, user-generated content). This isn't optional polish — it's a submission blocker.
- A crisis message gets a model-generated reply instead of the static resource card → real harm, not just a bad review.

Honest empty: "nothing this weekend" / "wall opens when the night does" / "no ATO price yet." Never a fake crowd.

---

## Rules (once)

- One dawn write. No refresh luck.
- Do is if-then, anchored to `morning_cue`. Miss → smaller Do next time.
- `talk_style` set once at onboarding from Q4+Q5. Valence from Checks: 2+ `did` in last 7 → lift; mix → even; 2+ `skip` → one cut, then even. Cut = habit, not worth. No cut after crisis. No two cuts in a row.
- Sage: reflect more than ask, ~4 sentences, coach not doctor. Crisis keyword hit → static resource card (see Crisis spec below), stop, no model call.
- Home is solo. Friends never write the dawn line.
- Chat: TLS + RLS. History stays. No homemade crypto. Sage reads chat only when the user taps "Teach Sage this" on a specific message — never ambient access.
- You tab = poster (pixel, @handle, **their color named**, QR, Share). Settings / credits / human-contact info below the fold.
- Share = hold or tap. Stories-size image. Caption: "What's your ATO?"
- Colors: Ink / Paper / Steel / Bloom. (No fifth color named "Void" — that word is reserved for the "not Void" competitor callout above, kept out of the palette so the two don't collide in copy.)
- Assets: Kenney CC0, same-family sets only (Modular / Toon / 1-Bit / Animal Remastered — don't mix families in one recipe). No AI-generated faces, no scraped art.
- Age: 16+ to use the app. 18+ required to be marked "going" on a night. Both are self-reported at onboarding — accepted MVP risk, not a build task. Don't try to "solve" verification inside a Wave 1 stage; if it needs solving, that's its own ticket.
- Model provider: the router box reads one env var (`MODEL_PROVIDER=gemini` or `groq`) — pick one before Stage 4, but build the router so switching providers is a config change, not a rewrite. Don't hardcode a provider name into Dawn or Talk directly.
- One box per stage. First line of a build message: `Open box: …`. Two stages requested in one turn → undo the second, finish the first.

```
app/contracts/
app/boxes/home auth me theme pixel dawn router talk share circle chat report
         around wallet   ← empty until that wave
app/voice/sage.txt           BEFORE STAGE 4
app/copy/first_cards.md      BEFORE STAGE 4
app/legal/privacy.md
```

Write those two copy files first. 3 styles × 3 valences. 3 mornings × 3 styles, real if-then Dos. No placeholder lorem — these are what new users see before check_count hits 3.

---

## Packets (ordered to match the build order below — same order everywhere in this doc)

| Box | In | Out |
|---|---|---|
| Home | card + pixel | Check **today** (did/skip) + result strip |
| Auth | Apple (TestFlight). Email before. | user_id (link, don't fork) |
| ME | user_id + onboarding answers | ME row |
| Theme | `show_up` | Ink / Paper / Steel / Bloom |
| Pixel | form + vibe + Check | `recipe` + look |
| Dawn | ME + yesterday + last 7 Checks | valence, read, if-then Do. Must differ from last 7 |
| Router | job + packet | text, capped length, model-provider-agnostic. Asks AI consent first, once |
| Talk | ME + card + sage.txt | short reply + optional one fact. Crisis check runs before router call |
| Share | me | /@handle + QR + image |
| Circle | me + them | hidden until first scan |
| Chat | from, to, words | thread |
| Report | from, target (message_id or user_id), reason | row in Reports table, visible to admin only |

**ME fields:** name, handle, timezone, `this_week`, `morning_cue`, `show_up`, `knocks_you_off`, `talk_style`, color, `recipe`, theme_id, facts they've told Sage, all-time Checks, `check_count`, last_7_card_ids, `show` (visibility toggle), `allow_search`, `host` (admin-flipped).

**ME never stores:** guessed vibes, raw chat logs, raw HealthKit data, a model's freeform narrative about the user.

`this_week` is for Sunday recap + Sage context only. It is **not** a dating graph. Matching (later) = same show both people tapped "going" on. Don't build interest-based matching — it's not in scope and nothing here asks for it.

---

## Crisis spec (resolve before Stage 5 — flagged, not yet built)

This needs your sign-off, not an AI's guess:
1. **Detection**: static keyword/phrase list (starter list, expand over time) checked against the user's message *before* it reaches the router. No sentiment model in v1 — keyword match is auditable and fails safe.
2. **Response**: a static, non-AI-generated card with a regional crisis line (e.g. 988 Suicide Crisis Helpline in Canada) and a line making clear Sage is a coach, not a person who can help in an emergency.
3. **No model call happens on a crisis-flagged message.** The router must short-circuit before hitting Gemini/Groq.
4. **Logging**: crisis flags get logged (flag + timestamp only, not the message content) so you can see if the keyword list needs tuning — not for moderation of the user.

Write the actual keyword list and card copy yourself or with someone qualified — an AI drafting the trigger list for a safety feature without your review is the wrong way to build this one piece.

---

## Report spec (new — was missing)

Minimal, not a dashboard:
- `Report` row: `from, target, reason, at`. `target` is either a `message_id` or a `user_id`.
- Block: sets a `blocked_by/blocked_user` pair; blocked user's messages stop rendering for the blocker, both directions stop sending.
- Mute: local to the muter, no notification to the muted.
- No admin UI needed for Wave 1 — query the Reports table directly in Supabase. Build a real admin view only if report volume makes that painful.

---

## Wave 0 — before code

Apple developer account: have it. Still need: Kenney zips, one model API key (`MODEL_PROVIDER` decided), a support email you'll actually answer, domain pointed at the new build (astrollogs.com — DNS only, nothing else reused), trademark search on ATO / AsTrollOGs (do this now, not after launch — the domain being live doesn't mean the name is clear).

---

## Wave 1 — spine (ship). Finish or park.

### 1 Home shell
**Open box: home, theme, contracts.**
Three tabs: Home, Sage, You. Fake card. Fake poster. No Circle tab at all — not hidden, not present.
**Done:** Expo Go shows Home with exactly 3 tabs and no Circle tab in the tab bar.

### 2 Sign-in + ME + Theme
**Open box: auth, me, theme.**
1. What should we call you?
2. Unique @handle (reserved: ato, sage, admin, support, you, astrollogs).
3. What are you in this week? → `show_up`
4. quiet / even / loud
5. What usually knocks you off? → `knocks_you_off`
6. What do you already do every morning? → `morning_cue`
`talk_style` from Q4+Q5. Color from `show_up`. Timezone from phone, not asked.
**Done:** ME row exists with all 6 fields non-null. A duplicate handle attempt shows a clear inline error, not a silent overwrite or a crash.

### 3 Pixel
**Open box: pixel.**
Kenney Modular / Toon / 1-Bit / Animal Remastered — one family per recipe, never mixed. 6 recipes. Looks: even, tired, set, listen, glow.
**Done:** Face renders on Home from `ME.recipe`. Card is still fake data.

### 4 Dawn + Router
**Open box: dawn, router.**
**Ask once** before any model call (Apple 5.1.2 requires this). No → bank content only, Talk stays off for that user.
`check_count < 3` → bank (`first_cards.md`). `check_count >= 3` → model, via router, provider set by `MODEL_PROVIDER`. Drop repeats, vague Dos, cruel cuts before showing anything.
**Done:** Day 4's Do and read text are not string-identical to Day 3's. For a user with `check_count < 2`, confirm (via a dev-only response flag) that content came from the bank file, not a model call.

### 5 Sage (Talk)
**Open box: talk.**
Chips: today / this week / something else. "More" surfaces the card. Crisis keyword hit → static card per Crisis spec, no model call.
**Done:** Two users with different `talk_style` get visibly different tone on the same prompt. A test message containing a crisis keyword returns the static resource card, verifiably without a router/model call firing (check logs).

### 6 Share + Circle
**Open box: share, circle.**
Share lives on You: QR + copy link + Share sheet.
Circle tab does not exist until a scan happens. On scan: Circle tab appears for both accounts, each showing the other's honest card and face.
**Done:** Fresh install → 3 tabs. After account A scans account B's QR (or vice versa) → both accounts now show a 4th tab (Circle) with each other visible.

### 7 Chat + Report
**Open box: chat, report.**
Chat opens only from a Circle card — never build a chat inbox that can be empty. History stays. Delete-a-line available. Block, mute, report each do something observable (see Report spec). "Teach Sage this" on a specific message = one stored fact, nothing more.
**Done:** Two test accounts exchange messages via a Circle-card-initiated thread. Blocking one hides their messages from the other and stops sending in both directions. Reporting a message creates a visible row in the Reports table.

### 8 TestFlight
**Open box: polish, push, legal, EAS, landing.**
Widget = Read + Do. Morning push = Read. Evening push = Check today. Sunday push = `this_week` recap + "you showed up N." Deep links from push into the right screen.
Delete account **in-app** + revoke Sign in with Apple token. Ask about notifications once, after the user's first card exists — app works fully if they say no.
Landing page: ATO name, "What's your ATO?" tagline, working support email, privacy policy, terms, © AsTrollOGs, Kenney asset credits. Same footer on the You tab.
Apple Sign In: hide-my-email maps to exactly one user, no fork.

Floor requirements (non-negotiable, not features):
- Privacy policy names Supabase and the model provider by name.
- Chat is explicitly labeled not end-to-end encrypted (until Fridge item ships).
- App Privacy nutrition labels + `PrivacyInfo.xcprivacy` filled out accurately.
- Report/block work on both Chat *and* Sage (a user can report a Sage response too).
- Sage is labeled "coach," never implies it's a person, in the UI itself, not just in a policy doc.
- App Review notes include a demo login and a sample QR code reviewers can actually scan.
- Real app icon — not the Expo default splash.
- Empty states, offline state, and "dawn missed a day" state are all designed, not just the happy path.
- Crash/error reporting via Sentry (or equivalent) wired up before submission.
- No ATT prompt (you're not tracking across apps in v1).
- Router is rate-limited per user.

**Done:** A build is installed via TestFlight on a real device. Delete-account flow actually removes the ME row and revokes the Apple token — verify both, not just the UI toast. **Stop here.**

### Gate
You + friends, one real week, real devices. Home stayed new day to day. Dos were actually doable. Sage's tone fit each tester. Circle stayed hidden until a scan for everyone who didn't scan. The widget brought people back into the app at least once.
**Only after that gate passes** → Wave 2.

---

## Wave 2 — city (one product)

**Around, Calgary only.** A room they open on purpose. Never surfaces on Home.

- City is typed at setup, not pulled from live GPS.
- edmtrain first. Link out to RA / Shotgun / DICE for tickets — no scraping, no unified calendar you maintain by hand.
- "I'm going" is opt-in. Faces show only if they marked going and visibility allows it.
- Colors on a show: shown once ≥3 people of that color are going; hidden below that. No raw counts displayed. Heat map = venue blobs, not pins.
- Phone fetches a static `/around/{city}/weekend.json`. Adding Edmonton later = new JSON file, same code — don't hardcode Calgary logic.
- 0 shows that weekend → honest empty state, never a fabricated map.
- 18+ enforcement here specifically: don't let a user marked 16/17 show as "going" on an 18+ night.

**Admin (you) sees:** opens, Checks, shares, new friend connections. Not chat message bodies. Later: on/off toggles for plugs and hosts.

Do not open plugs, hosts, or walls in this wave. City has to work while honestly empty most weekends before anything gets layered on top.

---

## Wave 3 — plug (only if Wave 2 has real nights happening)

**Paid tier.** Unlocks after 7 Checks: weekly Read, 30-day trail, more Talk. Never paywall Home, More, Check, crisis response, or the widget.

**Plugs.** Same row shape, `kind` = show | food | shop. You add and remove rows manually. No deal → no row. Not a Yelp clone.
Row shape: `kind, name, city, url, code, who (sub|everyone), starts, ends, on`.
Phone shows an ATO-price chip on that card → taps through to their page or shows the code. The app never touches payment.
0 live rows for a category → no ATO-price UI shows at all for that category.
Affiliate disclosure: say you may earn a bit, generically, until a specific brand agrees to be named (e.g. Insomniac applies, then gets a named row).

**Hosts.** You flip `host` on their ME row manually. Badge shows on their poster and Circle face. One editable note per poster (visible in Circle or on the public `/@handle` page). It overwrites, it's not a feed.

**Night wall.** Only exists if that specific show has people marked going — don't render an empty wall button for a night nobody's going to. One thread per night. Writers = people going + hosts. Live from 24h before the show to 24h after, then **locks** (read-only). History stays. "Lost & found" becomes a pinned chip for +7 days, then goes read-only too. Sort by newest. No citywide wall — every wall is scoped to one specific night.

---

## Fridge (only touch if explicitly asked for)

Real E2E encryption (libsignal or Matrix). HealthKit-informed smaller Dos. NFC. A second Sage persona. Circle-only highlight reel. Custom pixel uploads. RSS feeds. Bring-your-own-key model access. Streak flames. Live maps. Group chat. In-app Instagram-style feed. Native ticket checkout. Creator/influencer feed. Yelp-style reviews. OpenTable integration. Live "who's here right now."

---

## What you say

"Do stage 1. Spine only."

"Write sage.txt and first_cards.md, then do stage 4. Do not touch Circle."

"Do stage 8. Stop. Wait for the gate."

"Open Wave 2. Around, Calgary only. Honest empty."

"Open Wave 3. Plugs as rows. Wall only if people are going."

If any AI builds Wave 2 or 3 in the same turn as stages 1–8, send it back here.
