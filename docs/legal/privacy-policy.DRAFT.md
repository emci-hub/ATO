> **NEEDS EMCI REVIEW — do not ship.**
> Draft for the post-Sage / post-crisis app. Derived from `src/app/legal/privacy.md`.
> Not legal advice; a lawyer still reads it before public launch. Do not copy into
> `src/app/legal/` or `landing/privacy.html` until emci approves.
> Items in [brackets] need a decision or a fact only emci can confirm.

# Privacy Policy — ATO

**Last updated:** [DATE — fill in on publish]

ATO ("the app," "we," "us") is made by AsTrollOGs. This policy explains what we collect, why, and how you can control it.

---

## What we collect

**Account & profile**
- Name, @handle, timezone (read from your device, not asked)
- City for Around (you type it at setup or in Settings — we do not use GPS)
- Date of birth (self-reported at sign-up). We store the date, not a frozen age, so we can confirm you're 18 or older to use the app and 18 or older before you can be marked "going" on an 18+ night
- Onboarding answers and the answers you give to ATO's questions, which build your trait profile
- Your color and pixel appearance (derived from the above — not personal data on its own)

**Usage**
- Daily Checks (did/skip on your Do)
- Your saved profiles and history, so you can see how your answers changed
- Messages you send in Chat with people in your Circle
- Referral relationships (who invited you, who you've invited) — used only to prevent abuse, never shown publicly, never shared
- Email address if you request an invite from the public landing page (ato.emgens.com), stored until the request is reviewed
- Your Divecore game save (your pet, its rooms, items and progress), stored with your account so it survives a new phone. Kept if you reset your profile; deleted when you delete your account
- Anonymous daily counts of Divecore actions (for example, how many times the Hideout was opened today), with no account or device attached, so we can see which parts of the game get used

**Device**
- Push notification token, if you enable notifications
- Crash and error reports

**What we never collect or store:** guesses about your mood or personality that you didn't confirm, raw health data from your device, a model's freeform narrative written about you, your exact location.

[REMOVED vs. current text: "Facts you've explicitly asked Sage to remember ('Teach Sage this')", and the crisis flag line under Device.]

---

## Who else sees your data

We use a small number of service providers to run ATO. We don't sell your data to anyone, ever.

- **Supabase** — hosts our database and handles authentication. Your profile, Checks and chat messages live here.
- **An AI model provider** — ATO uses AI in two places only: the Legends cards and the category deep dives (and any AI view you spend ATO tokens on). Everything else in the app, including Insights, is written ahead of time and picked on your phone; no model is called for it. When you ask for a Legends card or a deep dive, the request is sent through our server to the model provider. [CONFIRM: which provider(s) are live for `ai-generate` / `ai-library` today — Google Gemini, DeepSeek, or both — and name only those.] Shared library cards are written from your trait bucket, not from your identity: the server builds the prompt and nothing personal is included. A deep dive uses your category leanings. The provider's own privacy terms govern how it processes the request. ATO logs which feature was called and when, not the prompt or the reply.
- **Resend** — sends the one-time login codes to your email, and invite codes when a landing-page access request is approved.
- **Apple** — if you sign in with Apple, Apple may relay a private email address instead of your real one. We only see whatever Apple gives us.

None of these providers are permitted to use your data for their own purposes beyond providing the service to us.

[REMOVED: "Google Gemini and DeepSeek — power Sage, the in-app AI coach", the Talk/recent-turns sentence, and the daily-card sentence.]

---

## Help if you're struggling

ATO is not a counselling or emergency service. On the You tab there is a fixed list of support lines (for example 988 in the US and Canada). It is the same for everyone, it is not triggered by anything you type, and nothing about it is logged. **If you are in immediate danger or crisis, contact local emergency services or a crisis line directly.**

[REMOVED: "Sage is a coach, not a person" and "Crisis support" sections, including the line that a flagged message and its time were logged. Confirm: do old `crisis_flags` rows still exist? If so keep a retention sentence until they are deleted — see `docs/sage-cleanup.md` §1.]

## Chat is not end-to-end encrypted

Messages between you and people in your Circle are encrypted in transit (TLS) and protected by access controls in our database, but they are not end-to-end encrypted. This means it is technically possible for us to access message content if required (for example, to investigate a report of abuse). We don't read your messages otherwise.

## Referral tracking

If you were invited to ATO, we keep a record of who invited you. This is used only to prevent abuse — for example, to disable a cluster of accounts created by one bad actor — and is never shown publicly or shared with other users beyond your own choice to disclose who you've invited.

## Age requirement

ATO is intended for people 18 and older. Marking yourself as "going" to an 18+ night requires you to be 18 or older. These are self-reported; we do not currently verify age beyond what you tell us at sign-up.

## Your controls

- **Visibility:** you control whether your profile is discoverable and whether you show up to people who search for you.
- **Block, mute, report:** available on any Chat conversation.
- **Delete your account:** available in-app, under Settings. Deleting your account removes your profile and revokes your Sign in with Apple access token — this is permanent and cannot be undone. [CONFIRM: `delete-account` also removes old `sage_messages`, `crisis_flags` and `me.facts` rows. If not, say how long they are kept.]

## Changes to this policy

If we make a material change to this policy, we'll notify you in-app before it takes effect. [Because Sage is going away, plan an in-app notice at the OTA that removes it.]

## Contact

Questions about this policy or your data: **support@asstrollogs.com**
