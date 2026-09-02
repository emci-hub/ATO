# BUSINESS — legal, brand & cost roadmap (Calgary, AB)

Not legal or financial advice. This is a tracker so nothing gets missed while building fast with AI tools — for anything with real money or liability on the line, confirm with an accountant or lawyer before acting.

This runs parallel to the technical Stages/Waves in ATO_PLAN_v2.md. It does not block them. Move to the next milestone when its trigger is true, not on a calendar date.

---

## Milestone roadmap

### M0 — Right now (building, no revenue, no public users)
- **Status:** sole proprietor by default. Operating under your own legal name. No registration required.
- **Do today:** start keeping every AI subscription and tool receipt (Claude, Cursor, Perplexity, Supabase, Resend, Expo/EAS, domain) in one folder or spreadsheet. Even before anything is "official," these become expense records once there's a business to attach them to — ask an accountant later how far back pre-registration costs can be claimed, don't assume.
- **Apple Developer account:** enrolled (Team ID `Q2UF7F6N36`). Individual vs Organization still open — see log below. Stage 8 Apple Sign-In + delete/revoke is **verified on a real device** (Key ID `3JKLGRJ586`; Edge Function `APPLE_CLIENT_ID` = App ID `com.emgens.ato`; Services ID `com.emgens.ato.signin` stays for Supabase Auth / web). Auth primary paths stay email OTP + Apple on separate Sign up / Log in screens; password is optional (You Settings after first login; GoTrue hash; `signInWithPassword` on Log in only). Aug 28, 2026 schema pass: ME is hard-deleted (no flag); owned rows cascade; `account_deletions` is the only intentional leftover; Apple proof is the post-revoke refresh-token check. Invite/referral gate, push + widget, and floor-requirements sweep are **done** (pushed `ea2b4f3`; Sentry JS ingest re-confirmed; EAS production source-map upload is on; binary 8 native crash event `e7bed112` ingested, symbolication **unconfirmed** — org `emgens`, project `ato-app`; nutrition labels match privacy.md including Date of Birth; Talk cap live 20/day 200/month). Self-reported `me.born_on` is on ME (16+ at signup). Legal + landing drafted and mostly live (`src/app/legal/` + `ato.emgens.com`); ASC paste, support inbox, and lawyer pass are parked in NOW.md **Public release readiness** — not active TestFlight work. **TestFlight build 6 shipped**; Friends Beta App Review still **pending**. **Binary 8** (`d40e57a9`) was submitted and installed (theme / Around / Home fix / age field verified). **Binary 10** (`1d0d1041`) is the OTA + icon cut — submit that IPA, not 8 or 9. Gemini / NVIDIA / Perplexity keys stay client-embedded; Claude / Grok keys live on the `ai-generate` Edge Function — moving the remaining client keys off-device is still required before `signup_mode` flips to `public`.
- **Trademark:** the search flagged in Wave 0 — do it now if not already done. Free, fast. Don't file yet.
- **Landing page:** live at `ato.emgens.com` (Vercel project `ato` under the `em-gens` team, not yet connected to a git repo — updates go through manual redeploy until linked). Invite request form (email → `access_requests`) lives in this repo under `landing/`.
- **Kenney CC0:** in-app Credits on You lists Shape Characters only (the pack actually bundled). Attribution is not legally required; credited anyway. Other Kenney families stay off the list until imported.
- **Crisis card:** region from device locale/timezone (manual override is "If you need someone now" on You, after Weeks — region picker only, not a second card). Sage has an always-visible Support tap under the composer (and when Talk is off) that opens this same static card with no keyword. Confirmed number is 988 for US and Canada only; unconfirmed regions get an honest fallback, never a guessed hotline. The keyword-triggered Talk interrupt is unchanged. AI consent is a Dawn/Sage interstitial plus a You Account row.
- **Around (Wave 2):** city is typed at setup, not GPS. Stage 1: weekend shows from Edmtrain into a static JSON file; tickets open on Edmtrain / RA / Shotgun / DICE; no in-app checkout. Live refresh waits on an Edmtrain API key. Stage 2: "I'm going" + friend colors (≥3 of a hue, no counts, 18+ gate) is in. Type `fixture` as city for seeded test shows.
- **Home:** Stage 1 fake poster / fake card / "open box" chrome is off the production Home route. No card → honest empty, not fixture copy (consent-off past day 3 is a dedicated honest-empty line; Did/Skip still saves and counts). Fresh install with today's Check already logged hydrates Home from that row (not empty local storage). You-tab Sentry/push probes are `__DEV__` + Metro production stub — not on TestFlight. `/dev-lab` is visible to root and granted testers on TestFlight (local `__DEV__` always). Trace is own-account pipeline capture (Dawn / Talk / Explore steps; generic viewer). Live pixel is the small top-right nav companion, not a large centered face. Shape is hashed per account from 6 shape-family recipes; color still from `show_up`. Tap plays a short coherent mood. Home is card + Did/Skip + a primary slot, plus a collapsed category teaser when that slot is not crisis or missed-check (deliberate Aug 31, 2026 override of the one-slot Box 8 rule; no badge strip, no inner tabs). Milestone badges and growth bars live on You. You-tab poster is name / handle / visibility / QR (no large pixel); name is not repeated in a profile row under it. Filled trait axes can be opened as phrase-endpoint bands (no numbers). You also has a private Full Profile fold (all currently-defined axes, `N of K settled`, last source in plain language, 2-letter codes, shift timeline, draft poles) and a Categories fold — not on the public poster. Notes are earned only (`me.tokens`); they never paywall viewing Full Profile or Home / Check / crisis / widget. You lists stored Sage facts (read/delete; teaching stays Chat). Talk-style and voice-preset rows show a local sample line; Explore reaction taps ack "Noted." on-device only. Questions are "Tell Sage more" off You (cached, separate regen quota). Sage is `Sage · coach` on Talk/Dawn/widget/push and on Home except Quest, where the Home card reads `Sage · npc`. Sage shows a collapsible 8-ball, Explore observations at the top of the thread, and reply room as `X of 20 today` (no "AI"/"tokens"). Talk answers the typed question first; the day's Home card is background, not the reply. Home Reads rotate knocks/facts/focus instead of paraphrasing one story. Home may show a Nudge card from a real recent signal; Circle/widget/push never do. Peer clients cannot read `nudge_text` (`peer_checks` RPC; connected SELECT on `checks` dropped). Latest production OTA: group `d5332b8b-7d5d-4898-bb5f-df121933b499` (Legends dev-test personas; binary 10+).

### M1 — TestFlight (Stage 8, friends-only testing)
- **Trigger:** ready to submit a build to TestFlight. **Met** — build 6 is in TestFlight, installed on a real device; Beta App Review for the Friends external testing group is pending (as of Aug 26, 2026).
- **Do:** Apple Developer Program already enrolled (see M0). Remaining: Individual vs Organization still open; wait on Beta App Review; **binary 10** (`1d0d1041`) is **already submitted and in TestFlight** (submission `c0c6342d`, ASC app id `6805614731`) — install + confirm on a real device, and get testers off binary 8 (it cannot receive OTA and shows the stale "Dev only." cold-start bug); Sentry native symbolication on event `e7bed112` is unconfirmed. $99 USD/yr already in play. **Wave 1.5 and Wave 3 start now in parallel** (intentional deviation). Wave 2 Stage 2 ("I'm going") is in, so Night wall is unblocked. Stage 9–13 delight is in. IA reorganization (15 boxes) shipped Aug 30 — device pass is `docs/ATO_DEVICE_TESTS.md`, then invite/referral. You Settings and `/dev-lab` show the running OTA group / update id (latest `d5332b8b-7d5d-4898-bb5f-df121933b499`). AI capacity hardening stays a public-launch backlog item.
- Trade name, GST/HST, incorporation: still not required. Not public yet, no real revenue.
- **Social handles — decided:** primary handle across X, Instagram, and TikTok is **`@whatsyourato`** (the tagline, not the bare acronym). The bare `@ato` is effectively unavailable everywhere and collides semantically with unrelated orgs (e.g. the Australian Taxation Office already operates under "ATO" on X). Per-platform fallback, only where `@whatsyourato` is actually taken: `emgensato`, `atoapp`, or `heyato` — cross-link accounts in each bio if handles end up inconsistent across platforms. Reserve these now, before public visibility increases squatting risk.
- **Plan framing:** ATO_PLAN_v2.md is a working reference, not a locked spec. All 16 trait axes are in (Playfulness added Wave 21), with direct-vs-inferred `trait_sources` (inferred damps toward the signal; direct full-replaces), `last_touched`, and a confirm-upgrade path that cannot change the number. **Shared friend-voice style checklist (6 rules + approved anchors) is live across all five generation surfaces** (Dawn Read, Explore, Title, Category summaries, Story), superseded on OTA by `af9b56ee` (Explore tab). Talk output fence is in. Library copy is in (`src/app/copy/library.md`; Sage reads For Sage lines when a knock, trait, fact, or typed line connects, and restates the idea in its own words). Explore is its own bottom tab (Sep 1, 2026 — pulled out of the Sage chat thread; Sage tab is clean chat; nav is customizable via long-press edit mode — Home/Sage pinned, More fixed rightmost, the rest reorderable; gated tabs such as Circle sit in "Not unlocked yet" until their condition is met). Three-path intake / Reload are decided in that file, not built. Does-Sage-know-you / ranking / Gut call share one weekly Home Ask. IA reorganization (15 boxes) shipped Aug 30. Device pass is `docs/ATO_DEVICE_TESTS.md`. Aug 28 Grok review locks (Explore combine, Does-Sage-know-you, completeness split, Talk fence, soft-ask budget) live in the Understanding spec. After the device pass: Stage 8 invite/referral. You-tab Full Profile depth count shipped (`N of 16 settled`); Categories fold (including Levity) and Home category teaser shipped Wave 21 (Home 2-slot is a deliberate Box 8 override, Aug 31, 2026). Dawn category Read + Explore two-category combine + The Story (own quota, no fallback) shipped Wave 22 — Story copy is unreviewed and diagnosis-adjacent. **Test accounts wiped Aug 31, 2026** — only `emci2` remains (handle is not `emci`, so `require_root()` doesn't recognize it; EMCIRETEST is now owned by emci2 and unlimited). You weekly completeness slot / 3-month Settings remain later Wave 1.5. Crisis / coach-label / diagnosis-avoidance / App Store floor items in the plan are compliance-grounded. Sage-generated personality-style titles sit next to the existing 16+ / loot-box proximity concern — legal/copy review before treating title copy as final (draft poles + samples in `docs/wave20-copy-DRAFT.md`).

### M2 — Going public (App Store, real users, no revenue yet)
- **Trigger:** Wave 1 gate passed, ready to move `signup_mode` toward public.
- **Do:** file the CIPO trademark application now, even though registration itself won't come through for a long while — protection backdates to your filing date, and copycat apps have historically won disputes by registering first. Don't wait until you feel like you "need" it.
- If "AsTrollOGs" is used as the public-facing operating name (not your own legal name): register the Alberta trade name. Cheap, same-day.
- Revisit Individual vs Organization Apple account only if you now want the company name as seller — remember, you cannot convert Individual → Organization later, only re-enroll from scratch.

### M3 — Real revenue starts (Wave 3 plugs/affiliate income)
- **Trigger:** actual money moving through the app.
- **Do:** register for GST/HST once revenue crosses (or you expect to cross) $30k/yr — mandatory at that point, voluntary before it.
- Talk to an accountant about incorporating. This is the point where liability separation and tax treatment start to matter financially — not before.

---

## Pricing ballpark (CAD unless noted — order of magnitude, confirm current pricing before budgeting hard)

| Item | Cost | When |
|---|---|---|
| Apple Developer Program | $99 USD/yr | Stage 8 (TestFlight) |
| Alberta trade name registration | ~$50–70, one-time (renews ~5yr) | Only if using "AsTrollOGs" as public name, at public launch |
| CIPO trademark filing, DIY, 1 class | ~$491 CAD, one-time (non-refundable if refused) | Around public launch — file early, full registration can take a year or more |
| CIPO trademark with agent/lawyer | + $1,000–2,500 CAD professional fee | Optional, if you want help with the filing itself |
| GST/HST registration | Free | Mandatory once revenue > $30k/yr, voluntary before |
| Alberta incorporation, if/when | ~$275 govt fee + NUANS report + ~$53/yr annual return | Only once real revenue + liability protection matters |
| Domain (astrollogs.com) | ~$15–20/yr | Already have it |
| Subdomain (ato.emgens.com) | $0 — uses existing emgens.com Vercel/DNS | Already live |
| Supabase / Resend / Sentry / EAS | Free tiers cover early testing; paid tiers scale with usage | Check current pricing on each site before assuming a number |

---

## Branding note — the Twitch-streamer instinct is right

Streamers build a recognizable brand by locking one consistent identity early and reusing it everywhere before they're big — name, colors, voice, tagline — so recognition compounds instead of resetting every time they show up somewhere new. You already have the actual pieces, just spread across the plan:

- **Name/tagline:** ATO — "What's your ATO?" — already set.
- **Palette:** five appearance modes — Soft (default) / Zen / Quest / Neon / Anime — selected in You-tab Settings, stored on-device. Bottom tab bar uses the live appearance background in all five. Replaces the discarded Ink / Paper / Steel / Bloom named palette for app chrome (intentional plan deviation; see NOW.md housekeeping). The You-tab share poster still uses Ink / Paper / Steel / Bloom as a fixed shareable artifact.
- **Voice:** Sage (in-app coach; Home in Quest may label the card `Sage · npc`), Drake (this collaboration) — already named.
- **Social handle:** `@whatsyourato` — decided, see M1 above. Reserve across X, Instagram, TikTok now, before public launch increases squatting risk.
- **Landing page:** `ato.emgens.com` — live.

Nothing new to invent. The only thing left is applying that same name/palette/voice/handle consistently anywhere outside the app too — landing page, any early marketing. The earlier that starts, the more it compounds. Costs nothing but consistency.

---

## AI subscriptions as a business expense — what's actually true

General principle (not a final answer — confirm with an accountant): a cost is deductible against business income if it was incurred to earn that income and is reasonable given the business. Software/AI tool subscriptions used to build ATO fit that description once there's a business to attach them to. The part worth a real accountant conversation: exactly how pre-revenue "startup costs" get treated in the year the business officially starts (deducted outright vs. carried forward) — that's a timing/technical question, not something to guess at. Keeping receipts from today (M0, above) means you'll have the records ready whenever that conversation happens, instead of reconstructing them later.

---

## Open decisions log (revisit, don't let these get lost)

- [ ] Apple Individual vs Organization account
- [ ] Operate under "AsTrollOGs" as a registered trade name, or just your own legal name
- [ ] When to file the CIPO trademark application
- [ ] Whether/when to incorporate
- [x] Social handle across platforms — `@whatsyourato`, decided
- [ ] Confirm `@whatsyourato` actually secured on X, Instagram, TikTok (per-platform fallback: `emgensato` / `atoapp` / `heyato`)
- [ ] Confirm `support@asstrollogs.com` is a real, monitored inbox (used in privacy.md / terms.md / landing footer)
- [ ] Link `ato.emgens.com` Vercel project to a git repo, if Cursor needs to touch the landing page directly
- [ ] Legal/copy review: Sage-generated personality-style titles (16+ proximity, same concern as rejected loot-box mechanics). Draft poles + sample titles unreviewed. No extra code. Same lane as the crisis disclaimer lawyer pass.
