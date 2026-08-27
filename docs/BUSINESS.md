# BUSINESS — legal, brand & cost roadmap (Calgary, AB)

Not legal or financial advice. This is a tracker so nothing gets missed while building fast with AI tools — for anything with real money or liability on the line, confirm with an accountant or lawyer before acting.

This runs parallel to the technical Stages/Waves in ATO_PLAN_v2.md. It does not block them. Move to the next milestone when its trigger is true, not on a calendar date.

---

## Milestone roadmap

### M0 — Right now (building, no revenue, no public users)
- **Status:** sole proprietor by default. Operating under your own legal name. No registration required.
- **Do today:** start keeping every AI subscription and tool receipt (Claude, Cursor, Perplexity, Supabase, Resend, Expo/EAS, domain) in one folder or spreadsheet. Even before anything is "official," these become expense records once there's a business to attach them to — ask an accountant later how far back pre-registration costs can be claimed, don't assume.
- **Apple Developer account:** enrolled (Team ID `Q2UF7F6N36`). Individual vs Organization still open — see log below. Stage 8 Apple Sign-In + delete/revoke is **verified on a real device** (Key ID `3JKLGRJ586`; Edge Function `APPLE_CLIENT_ID` = App ID `com.emgens.ato`; Services ID `com.emgens.ato.signin` stays for Supabase Auth / web). Invite/referral gate, push + widget, and floor-requirements sweep are **done** (pushed `ea2b4f3`; Sentry JS ingest re-confirmed; EAS production source-map auto-upload is on for the next build — org `emgens`, project `ato-app`; nutrition labels match privacy.md including Date of Birth; Talk cap live 20/day 200/month). Self-reported `me.born_on` is on ME (16+ at signup; ships to testers on build 7). Legal + landing drafted and mostly live (`src/app/legal/` + `ato.emgens.com`); ASC paste, support inbox, and lawyer pass are parked in NOW.md **Public release readiness** — not active TestFlight work. **TestFlight build 6 shipped**, installed on a real device; Beta App Review for the Friends external testing group is **pending**. Next binary: **build 7** (app icon swap, age-field rollout, Sentry source-map confirmation). Gemini key stays client-embedded until a later Edge Function box — not a TestFlight blocker, required before `signup_mode` flips to `public`.
- **Trademark:** the search flagged in Wave 0 — do it now if not already done. Free, fast. Don't file yet.
- **Landing page:** live at `ato.emgens.com` (Vercel project `ato` under the `em-gens` team, not yet connected to a git repo — updates go through manual redeploy until linked).
- **Kenney CC0:** in-app Credits on You lists Shape Characters only (the pack actually bundled). Attribution is not legally required; credited anyway. Other Kenney families stay off the list until imported.
- **Crisis card:** region from device locale/timezone (manual override in Settings). Confirmed number is 988 for US and Canada only; unconfirmed regions get an honest fallback, never a guessed hotline.
- **Around (Wave 2 Stage 1):** city is typed at setup, not GPS. Weekend shows come from Edmtrain into a static JSON file; tickets open on Edmtrain / RA / Shotgun / DICE. No in-app checkout. Live refresh waits on an Edmtrain API key (apply while signed in at edmtrain.com/developer-api).

### M1 — TestFlight (Stage 8, friends-only testing)
- **Trigger:** ready to submit a build to TestFlight. **Met** — build 6 is in TestFlight, installed on a real device; Beta App Review for the Friends external testing group is pending (as of Aug 26, 2026).
- **Do:** Apple Developer Program already enrolled (see M0). Remaining: Individual vs Organization still open; wait on Beta App Review; cut **build 7** for the app icon swap, age-field rollout, and Sentry source-map confirmation (build 6 native frames stay unsymbolicated). $99 USD/yr already in play. Wave 1.5 (Understanding & Delight, Stages 9–14) can build during friends-only TestFlight and is not blocked on public App Store readiness — Stage 9 (intake core) is next once those four Stage 8 floor items close. AI capacity hardening stays a public-launch backlog item, not Wave 1.5.
- Trade name, GST/HST, incorporation: still not required. Not public yet, no real revenue.
- **Social handles — decided:** primary handle across X, Instagram, and TikTok is **`@whatsyourato`** (the tagline, not the bare acronym). The bare `@ato` is effectively unavailable everywhere and collides semantically with unrelated orgs (e.g. the Australian Taxation Office already operates under "ATO" on X). Per-platform fallback, only where `@whatsyourato` is actually taken: `emgensato`, `atoapp`, or `heyato` — cross-link accounts in each bio if handles end up inconsistent across platforms. Reserve these now, before public visibility increases squatting risk.

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
- **Palette:** five appearance modes — Soft (default) / Zen / Quest / Neon / Anime — selected in You-tab Settings, stored on-device. Replaces the discarded Ink / Paper / Steel / Bloom named palette (intentional plan deviation; see NOW.md housekeeping).
- **Voice:** Sage (in-app), Drake (this collaboration) — already named.
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
