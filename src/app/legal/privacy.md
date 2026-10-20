# Privacy Policy — ATO

**Last updated:** [DATE — fill in on publish]

ATO ("the app," "we," "us") is made by [CONFIRM: legal entity name — "AsTrollOGs" until confirmed]. This policy explains what we collect, why, and how you can control it.

This is not a substitute for legal advice. This draft is intended for review by a lawyer before ATO is publicly available.

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
- Referral relationships (who invited you, who you've invited), if invite or referral links are in use — used only to prevent abuse, never shown publicly, never shared
- [CONFIRM: email form on the public landing page. Today it collects an email address to request an invite and stores it until the request is reviewed. Keep, change or remove this line to match the launch landing page.]
- Your Divecore game save (your pet, its rooms, items and progress), stored with your account so it survives a new phone. Kept if you reset your profile; deleted when you delete your account
- Anonymous daily counts of Divecore actions (for example, how many times the Hideout was opened today), with no account or device attached, so we can see which parts of the game get used
- An AI usage log: which AI feature was used on which day and how many times, and your ATO token activity. It does not contain the text of any request or reply. It is kept if you reset your profile

**Device**
- Push notification token, if you enable notifications [CONFIRM: the earlier labels doc says v1 schedules local notifications only and uploads no token — confirm which is true]
- Crash and error reports (through Sentry [CONFIRM: what Sentry receives and how long it keeps it])

**What we never collect or store:** guesses about your mood or personality that you didn't confirm, raw health data from your device, a model's freeform narrative written about you, your exact location.

**What we do not do with what you type:** we do not scan, flag or log what you type for safety or crisis detection. Nothing you type is sent to an AI model.

---

## Who else sees your data

We use a small number of service providers to run ATO. We don't sell your data to anyone, ever.

- **Supabase** — hosts our database and handles authentication. Your profile, Checks and chat messages live here.
- **An AI model provider** — ATO uses AI in two places only: the Legends cards and the category deep dives (and any AI view you spend ATO tokens on). Everything else in the app, including Insights, is written ahead of time and picked on your phone; no model is called for it. When a Legends card or a deep dive is written, the request goes from our server to the model provider; your phone never talks to the provider and holds no provider key. The phone sends only the kind of card and a trait bucket, never text you typed. Shared library cards are written from a trait bucket, not from your identity: the server builds the prompt and nothing personal (no name, no user ID, no answers) is included. A deep dive uses your category leanings. [CONFIRM: which provider(s) the server calls today — the code can call Google Gemini and DeepSeek; name only the live one(s), and confirm their terms on retention and on not training on API requests.] The provider's own privacy terms govern how it processes the request. ATO logs which feature was called and when, not the prompt or the reply.
- **Resend** — sends the one-time login codes to your email [CONFIRM: and any other email ATO sends, e.g. invite codes]. [CONFIRM: Resend retention.]
- **Sentry** — receives crash and error reports. [CONFIRM: what is sent, region, retention.]
- **Apple** — if you sign in with Apple, Apple may relay a private email address instead of your real one. We only see whatever Apple gives us.

[CONFIRM: that each provider's contract bars it from using your data for its own purposes. The earlier draft said so; it cannot be verified from the repo.]

---

## Help if you're struggling

ATO is not a counselling or emergency service. On the You tab there is a fixed list of support lines: 988 for the US and Canada, findahelpline.com elsewhere, and your local emergency number. It is the same for everyone. It is not triggered by anything you type, and nothing about it is logged. **If you are in immediate danger or crisis, contact local emergency services or a crisis line directly.**

## Chat is not end-to-end encrypted

Messages between you and people in your Circle are encrypted in transit (TLS) and protected by access controls in our database, but they are not end-to-end encrypted. This means it is technically possible for us to access message content if required (for example, to investigate a report of abuse). We don't read your messages otherwise.

## Referral tracking

If you were invited to ATO, we keep a record of who invited you. This is used only to prevent abuse — for example, to disable a cluster of accounts created by one bad actor — and is never shown publicly or shared with other users beyond your own choice to disclose who you've invited.

## Age requirement

ATO is for people 18 and older. Marking yourself as "going" to an 18+ night requires you to be 18 or older. Age is self-reported; we do not verify it beyond what you tell us at sign-up.

## How long we keep things

[CONFIRM: retention periods. Not stated anywhere in the repo for chat, Checks, AI usage log, deletion record, backups, Sentry or Resend. Until confirmed: we keep your data while your account exists, and delete your account data when you delete your account.]

## Your controls

- **Visibility:** you control whether your profile is discoverable and whether you show up to people who search for you.
- **Block, mute, report:** available on any Chat conversation.
- **Delete your account:** available in-app, under Settings, always. It deletes your account and the data stored under it (profile, answers, Checks, saved profiles, Circle and chat data, Divecore save, AI usage log) and revokes your Sign in with Apple access token. This is permanent and cannot be undone. A short deletion record (an ID, whether an Apple identity existed, and the result of the Apple revoke, with no profile content) is kept. [CONFIRM: retention of that record and of backups.]

## Changes to this policy

If we make a material change to this policy, we'll notify you in-app before it takes effect.

## Contact

Questions about this policy or your data: **support@asstrollogs.com** [CONFIRM: domain spelling]
