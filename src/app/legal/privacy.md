# Privacy Policy — ATO

**Last updated:** [DATE — fill in on publish]

ATO ("the app," "we," "us") is made by [CONFIRM: legal entity name — "AsTrollOGs" until confirmed]. This policy explains what we collect, why, who can see it, and how you control it.

This is not legal advice. This draft is written from what the app does today and must be reviewed by a lawyer before ATO is publicly available.

---

## What we collect

**Account & profile**
- Your email address (to sign in), or the address Apple gives us if you use Sign in with Apple
- Name, @handle, timezone (read from your device, not asked)
- City for Around (you pick it; we do not use GPS)
- Date of birth (self-reported at sign-up). We store the date, not a frozen age, so we can confirm you're 18 or older to use the app and to be marked "going" on an 18+ night
- Your sign-up answers and your answers to ATO's questions, which build your trait profile
- Your color and pixel appearance

**Usage**
- Daily Checks: the day's read and do text (kept for 7 days) and whether you did or skipped it (kept)
- Your saved profiles and history, so you can see how your answers changed
- Your Circle: friend requests, who you are friends with, who you blocked, the reports you file, and your per-friend switches for visits and compare (see "Circle" below)
- Your Divecore game save (your pet, its rooms, items and progress), stored with your account so it survives a new phone. Kept if you reset your profile; deleted when you delete your account
- Anonymous daily counts of Divecore actions (for example, how many times the Hideout was opened today), with no account or device attached, so we can see which parts of the game get used
- An AI usage log: which AI feature was used on which day and how many times, and your ATO token activity. It does not contain the text of any request or reply
- Referral relationships (who invited you), if invite or referral links are in use — used only to prevent abuse, never shown publicly
- [CONFIRM: email form on the public landing page. Today it stores an email address to request an invite until the request is reviewed. Keep, change or remove this line to match the launch landing page.]

**Device**
- Crash and error reports through Sentry. The app sends no name, email, handle or account ID with them, and strips free text before sending, so a report is not tied to your account. [CONFIRM: Sentry region and how long it keeps reports.]
- Notifications are scheduled on your phone. ATO does not upload a push token to its servers.

**What we never collect or store:** guesses about your mood or personality that you didn't give us, health data from your device, your exact location, your contacts, or advertising identifiers. ATO has no ads and does no tracking across other apps or websites.

**What we do not do with what you type:** we do not scan, flag or log it for safety or crisis detection. Nothing you type is sent to an AI model.

---

## Who can see what

- **Anyone with your @handle** (for example, from a card you share) can see your name, @handle, two of your sign-up answers (how you show up, how you talk) and your pixel appearance. Nothing else.
- **Friends in your Circle.** Someone becomes a friend only when you accept their request (or they accept yours). A friend can:
  - visit your Divecore Hideout and send you preset gifts, only while visits are switched on for that friend;
  - see "Compare strengths" only if you **both** switch it on for each other. They then see a few of your clear strengths, as fixed phrases. Never your scores, your answers, your attachment or conflict style, the lower side of any trait, your Checks, or anything you typed.
  Each switch is per friend, off by default for compare, and you can turn it off at any time.
- **Nobody** sees your answers, your trait scores, your Checks or your saved profiles.

## Circle: blocking and reporting

- **Block** a friend or anyone who sent you a request from the ⋯ menu. A block is silent: the other person is not told. It removes the friendship and any pending requests, ends visits and compare between you, and stops them finding you by handle in the app or sending you a new request. (Your public card, described under "Who can see what", can still be opened by anyone who has your @handle.)
- **Report** someone from the same menu by picking one of six fixed reasons. We keep the report (the reason, when it was filed and the reported @handle) even if either account is later deleted, so we can act on abuse. The reporter's identity is removed from the report if the reporter deletes their account.
- **Names and handles** are checked at sign-up and when changed: slurs and names that pretend to be ATO staff are refused.
- **Chat (app version 1.1 and later).** You can message a friend one to one from the ⋯ menu. Messages are end-to-end encrypted: they are locked on your phone and can only be unlocked on your phone and your friend's phone, so ATO cannot read them. Our server keeps the locked message, who sent it to whom and when, for 30 days, then deletes it. It keeps that the two of you have a chat (no content) and each phone's public lock key until an account is deleted. If you report a message (same six fixed reasons), your phone sends us that message and up to 5 before it, readable, so we can act on it; we keep that with the report. On your phone, a message that may contain a slur or explicit sexual words is hidden behind "Tap to show"; nothing is scanned on our server. Block works from the chat too and ends it. [CONFIRM: lawyer read of the chat wording.]

## Who else processes your data

We use a small number of service providers to run ATO. We don't sell your data to anyone, ever.

- **Supabase** — hosts our database and handles sign-in. Your profile, answers, Checks, Circle data and Divecore save live here.
- **AI model providers: Google (Gemini API), with DeepSeek as a fallback.** ATO uses AI in two places only: Legends cards and category deep dives. Everything else in the app, including Insights and the Story, is written ahead of time and picked on your phone; no model is called for it. When a card is written, the request goes from our server to Google's Gemini API; if Gemini fails, our server may send the same request to DeepSeek. Your phone never talks to a provider and holds no provider key. The phone sends only the kind of card and a trait group (a short key worked out from your leanings), never text you typed. The server builds the prompt from that group alone: for a deep dive, each trait in the category marked as leaning one way, the other way, or in the middle; for a Legends card, the one to three trait sides you share with that legend. The prompt contains no name, handle, email, user ID, device ID, exact scores or answers, and everyone in the same group gets the same prompt. The provider receives the request from our server, not from your phone, so it does not get your IP address or device details. Cards are stored in a shared library and shown to other people with similar leanings. ATO itself keeps, linked to your account, which AI features you used and when, and which library cards you were shown; it does not keep the prompt or the reply text. [CONFIRM: that the Gemini and DeepSeek API terms on the account ATO uses bar training on requests, how long each keeps requests, and that sending requests to DeepSeek (based in China) is acceptable — see docs/legal/OPEN-QUESTIONS.md.]
- **Resend** — sends the one-time sign-in codes to your email. [CONFIRM: any other email ATO sends, and Resend's retention.]
- **Sentry** — receives crash and error reports (see Device, above).
- **Apple** — if you sign in with Apple, Apple may relay a private email address instead of your real one. We store a token from Apple so we can revoke it when you delete your account.

[CONFIRM: that each provider's contract bars it from using your data for its own purposes. This cannot be verified from the app's code.]

---

## Help if you're struggling

ATO is not a counselling or emergency service. On the You tab there is a fixed list of support lines: 988 for the US and Canada, findahelpline.com elsewhere, and your local emergency number. It is the same for everyone. It is not triggered by anything you type, and nothing about it is logged. **If you are in immediate danger or crisis, contact local emergency services or a crisis line directly.**

## Age requirement

ATO is for people 18 and older. Marking yourself as "going" to an 18+ night also requires a valid birthday showing you are 18 or older. Age is self-reported; we do not verify it beyond what you tell us at sign-up.

## How long we keep things

We keep your data while your account exists and delete it when you delete your account, except the report and deletion records described below. [CONFIRM: any shorter retention you want to promise (for example for Checks or the AI usage log), and how long database backups and provider logs (Sentry, Resend, AI providers) keep data.]

## Your controls

- **Circle:** accept or decline requests, remove a friend, block, report, and switch visits and compare on or off per friend.
- **Notifications:** ATO asks once, after your first insight, and you can change it in your phone's settings or on the You tab at any time.
- **ATO's AI:** you can turn ATO's AI on or off on the You tab.
- **Delete your account:** always available in-app, at the bottom of the You tab. It deletes your account and the data stored under it: profile, answers, Checks, saved profiles, Circle links, requests and switches, Divecore save, AI usage log and token history. It revokes your Sign in with Apple token. This is permanent and cannot be undone. Two things are kept:
  - a short deletion record (an ID, whether an Apple identity existed, and the result of the Apple revoke; no profile content), so we can prove the deletion happened;
  - reports you filed or that were filed about you, without your account ID (the reported @handle and reason stay, see above).
  Cards you helped add to the shared AI library stay in the library with no link to you. [CONFIRM: retention of the deletion record, the reports and backups.]

## Changes to this policy

If we make a material change to this policy, we'll tell you in the app before it takes effect.

## Contact

Questions about this policy or your data: **support@asstrollogs.com** [CONFIRM: domain spelling and that the inbox is monitored]
