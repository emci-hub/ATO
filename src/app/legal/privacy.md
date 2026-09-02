# Privacy Policy — ATO

**Last updated:** [DATE — fill in on publish]

ATO ("the app," "we," "us") is made by AsTrollOGs. This policy explains what we collect, why, and how you can control it.

This is not a substitute for legal advice. This draft is intended for review by a lawyer before ATO is publicly available.

---

## What we collect

**Account & profile**
- Name, @handle, timezone (read from your device, not asked)
- City for Around (you type it at setup or in Settings — we do not use GPS)
- Date of birth (self-reported at sign-up). We store the date, not a frozen age, so we can confirm you're 16 or older to use the app and 18 or older before you can be marked "going" on an 18+ night
- Onboarding answers: what you're in this week, what usually knocks you off, your morning anchor, your talk style
- Your color and pixel appearance (derived from the above — not personal data on its own)

**Usage**
- Daily Checks (did/skip on your Do)
- Facts you've explicitly asked Sage to remember ("Teach Sage this") — nothing else from your conversations is stored as a fact
- Messages you send in Chat with people in your Circle
- Referral relationships (who invited you, who you've invited) — used only to prevent abuse, never shown publicly, never shared
- Email address if you request an invite from the public landing page (ato.emgens.com), stored until the request is reviewed

**Device**
- Push notification token, if you enable notifications
- Crash and error reports (flag + timestamp only for safety-related flags; see Crisis section below)

**What we never collect or store:** guesses about your mood or personality that you didn't confirm, raw health data from your device, a model's freeform narrative written about you, your exact location.

---

## Who else sees your data

We use a small number of service providers to run ATO. We don't sell your data to anyone, ever.

- **Supabase** — hosts our database and handles authentication. Your profile, Checks, chat messages, and facts live here.
- **Google Gemini** and **DeepSeek** — power Sage, the in-app AI coach. Gemini is the default provider; if a Gemini request is blocked by its usage or rate limits, ATO retries the same request once through DeepSeek. When you talk to Sage or receive a daily card, relevant context is sent to whichever provider is active: ME, recent Checks, and for Talk a short window of recent Sage turns so a follow-up can be answered (not the full thread). That provider's own privacy terms govern how they process the request. ATO logs only which provider was called and when, not the prompt or the reply. No other AI provider is configured at this time.
- **Resend** — sends the one-time login codes to your email, and invite codes when a landing-page access request is approved.
- **Apple** — if you sign in with Apple, Apple may relay a private email address instead of your real one. We only see whatever Apple gives us.

None of these providers are permitted to use your data for their own purposes beyond providing the service to us.

---

## Sage is a coach, not a person

Sage is an AI feature, not a human, and not a licensed therapist or counselor. Sage reflects on what you share and offers coaching-style suggestions. It cannot provide medical, psychological, or emergency care, and it should not be relied on as a substitute for either.

## Crisis support

If a message you send contains language associated with a safety crisis, ATO shows you a static support card instead of sending your message to Sage. In the United States and Canada that card includes 988. If we don't have a confirmed local crisis line for your region, the card says so — we do not invent a number. That flag (that a message was flagged, and when) is logged so we can improve detection — the content of the message itself is not stored for this purpose, and this logging is not used to moderate or monitor you generally.

**If you are in immediate danger or crisis, please contact local emergency services or a crisis line directly — ATO is not equipped to respond to emergencies.**

## Chat is not end-to-end encrypted

Messages between you and people in your Circle are encrypted in transit (TLS) and protected by access controls in our database, but they are not end-to-end encrypted. This means it is technically possible for us to access message content if required (for example, to investigate a report of abuse). We don't read your messages otherwise.

## Referral tracking

If you were invited to ATO, we keep a record of who invited you. This is used only to prevent abuse — for example, to disable a cluster of accounts created by one bad actor — and is never shown publicly or shared with other users beyond your own choice to disclose who you've invited.

## Age requirement

ATO is intended for people 16 and older. Marking yourself as "going" to an 18+ night requires you to be 18 or older. These are self-reported; we do not currently verify age beyond what you tell us at sign-up.

## Your controls

- **Visibility:** you control whether your profile is discoverable and whether you show up to people who search for you.
- **Block, mute, report:** available on any Chat conversation and on Sage responses.
- **Delete your account:** available in-app, under Settings. Deleting your account removes your profile and revokes your Sign in with Apple access token — this is permanent and cannot be undone.

## Changes to this policy

If we make a material change to this policy, we'll notify you in-app before it takes effect.

## Contact

Questions about this policy or your data: **support@asstrollogs.com**
