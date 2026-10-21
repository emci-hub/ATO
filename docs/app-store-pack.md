# App Store Connect pack (Step 13)

Written 2026-10-21 for ATO 1.0.0, bundle `com.emgens.ato`, ASC app id `6805614731`. Copy these answers into App Store
Connect. This is not legal advice; open legal items are in `docs/legal/OPEN-QUESTIONS.md` (D12). Nothing secret lives in
this file: the demo password is typed by emci into ASC and never written anywhere in the repo.

## 1. URLs and contact

| Field | Value |
|---|---|
| Support URL | `https://ato.emgens.com/` (the landing footer has a Support mailto). **Gap:** there is no dedicated /support page; ASC accepts the landing page, but Apple wants a way to reach you on it. It has `mailto:support@asstrollogs.com`. |
| Marketing URL | leave empty |
| Privacy Policy URL | `https://ato.emgens.com/privacy.html` (must be redeployed from `landing/` first, see blockers) |
| Terms (EULA) | Apple's standard EULA, or paste `https://ato.emgens.com/terms.html` in the App Description |
| Contact email for review | `support@asstrollogs.com` [CONFIRM the spelling and that the inbox is monitored: BUSINESS.md line 86 is still unticked] |

## 2. Age rating (Apple's questionnaire)

ATO is 18+ by its own rule (sign-up and birthday guard), so choose the highest rating and declare it honestly.

| Question | Answer | Why |
|---|---|---|
| Cartoon or fantasy violence | **Infrequent/Mild** | Divecore has cartoon combat (Turf War, enemies, bosses). Do not under-declare. |
| Realistic violence | None | |
| Profanity or crude humor | Infrequent/Mild to Frequent (pick **Frequent/Intense** if unsure) | Content policy allows strong swearing and dark adult humor. |
| Mature/suggestive themes | Infrequent/Mild | Adult humor, drinking references. |
| Alcohol, tobacco or drug use or references | Infrequent/Mild | Drinking references, and "nights" (18+). |
| Sexual content or nudity | None | |
| Horror/fear | None | |
| Gambling (simulated) | None | No casino mechanics. |
| Medical/treatment information | None | Trait profile is not diagnosis; a static helpline row only. |
| Unrestricted web access | No | Links open the privacy/terms pages only. |
| **User-generated content** | **Yes** | People choose a name and @handle that other people see; Circle requests (added by @handle, the other person must accept); Circle reports. No chat, no posting, no photos. |
| Messaging / chat between users | No | ATO has no messaging (chat is Step 14, and would change this answer first). |
| Age-restricted content/features gate | Yes: 18+ only | |

UGC safeguards to state in the review notes (all built and pinned by checks):
- Block and Report in the Circle sheet (Divecore → Hideout → Circle button → the ⋯ menu on a friend; six fixed report reasons); a blocked pair sees nothing of each other.
- Names and handles pass the name filter before they are saved.
- Circle needs acceptance from both sides; reports survive account deletion.
- Published contact: `support@asstrollogs.com` (You tab, legal pages).
- In-app account deletion: More → You → "Delete account" (final button "Delete my account forever"; also revokes the Apple token).

Expected result: **18+** (a "17+" or "18+" band in Apple's current scheme). Do not select a lower band.

## 3. App Privacy labels

Copy from `src/app/legal/app-privacy-labels.md` (the table there is the source of truth and is pinned by `check:floor`).
Summary:

- Tracking: **No**. No ATT prompt, no advertising identifier.
- Linked to the person, App Functionality (some also Product Personalization): Email Address, Name, Date of Birth, User ID,
  Other User Content, Customer Support (Circle reports), Product Interaction, Other Usage Data.
- Not linked: Crash Data, Other Diagnostic Data, Device ID (Sentry).
- Not collected: copy the full list from `app-privacy-labels.md` "Declared Not Collected" (Health, Fitness, Location,
  Photos/Videos, Contacts, Messages, Browsing/Search History, Purchases, Advertising Data, Sensitive Info, Payment Info,
  Phone Number, Audio).
- `ios.privacyManifests` in `app.json` already matches this table (checked by `check:floor`).

## 4. Export compliance

`ITSAppUsesNonExemptEncryption = false` is set in `app.json` `ios.infoPlist`. In ASC: "Does your app use encryption?" is
already answered by the plist, so the build skips the export-compliance prompt. (ATO only uses HTTPS/OS encryption. Step 14's
end-to-end chat would change this: revisit it then.)

## 5. App Review notes (paste into "Notes")

```
ATO is a free 18+ personality-profile app. No purchase is required and there are no in-app purchases.

Sign in: on the sign-in screen choose "Log in", then enter the handle and password below (the app signs in with a handle +
password through our own server). Email codes are not needed for this account.
  Handle:   <DEMO HANDLE>
  Password: <DEMO PASSWORD>   (entered by the developer in App Store Connect)

The demo account is over 18, has finished sign-up and the first question set, and has one accepted Circle friend so you
can see Block and Report.

What to look at (bottom bar: Home, Insights, Questions, Explore, More):
- Home: one daily insight, loaded on a tap.
- Questions: the multiple-choice profile questions; answers build the trait profile.
- More → Divecore: the pixel-art pet game. Circle lives here: Hideout → Circle button. A person is added by @handle and
  must accept. Every friend row has a ⋯ menu with Block and Report. There is no chat or messaging between people.
- More → You: account, legal links (Privacy, Terms), "Delete account" (works in-app, confirms by typing DELETE), and a
  fixed helpline row.

AI: a few cards (Legends cards and category deep dives) are written by a language model on our server (Google Gemini, with
DeepSeek as a fallback); the phone sends no typed text and no personal data. The app asks for consent first.
Sign in with Apple is offered on the sign-in screen.
Age: the app is 18+ only and checks the birthday at sign-up.
```

Demo account (emci does this; I never touch accounts):
1. Create the account the normal way on a phone (or the dev-test route), with an 18+ birthday, then finish the first set.
2. Befriend a second account by @handle (the second account accepts) so the Hideout Circle sheet shows a friend. Check a
   fresh Divecore save (launch clean slate) can reach the Hideout Circle button before you submit.
3. Type the handle/password into ASC's "Sign-in required" fields. Never put them in this repo.

## 6. Screenshots (iPhone 6.9" and 6.5" are required; capture on a real phone from TestFlight)

No screenshots exist in the repo. Capture these 6, light mode, no personal data, a demo account:

1. Home: the daily insight card opened.
2. Questions: one question with answers visible.
3. Profile: the profile card with the character.
4. Divecore → Hideout → Circle: a friend row with the ⋯ menu (Block / Report) open.
5. Divecore: the pet in its room.
6. More → You: legal links, "Delete account" and the helpline row.

## 7. Store text defaults

- Name `ATO`; category Lifestyle (primary), Entertainment (secondary); copyright `© 2026 emgens` [CONFIRM the entity, D12].
- Promotional text and description: write from `docs/ME.md`; do not claim diagnosis, therapy or clinical results.
- Version 1.0.0; "What's New": "First release."
- Pricing: Free. Availability: your choice; the privacy and terms text names no country-specific law yet [CONFIRM, D12].

## 8. Submission blockers (as of 2026-10-21)

| # | Blocker | Who | State |
|---|---|---|---|
| D12 | Legal facts + lawyer read (`docs/legal/OPEN-QUESTIONS.md` items 1-16; 46 `[CONFIRM]` tags in `src/app/legal/*` and `landing/*.html`) | emci + lawyer | **OPEN** |
| LP | Landing pages (`landing/privacy.html`, `terms.html`) redeployed so the privacy URL shows the Step 10 text | emci (Vercel redeploy) | confirm |
| SUP | `support@asstrollogs.com` is a real, monitored inbox (BUSINESS.md:86) | emci | confirm |
| DEMO | Apple demo account created with an 18+ birthday | emci | open |
| D8 | Gemini key rotation | emci | recorded as rotated (master plan line 166, 2026-10-20/21); confirm and delete the line in `.env.local` |
| D13 | Drop `play_dev_logs` (small migration) | emci OK needed | open, not a blocker if you accept it |

## 9. Version 1.1 (Circle chat, master plan Step 14): what changes on the day 1.1 is submitted

Sections 1-8 describe **the 1.0 commit** (build 1.0 from that commit or its tag: after Step 14 is merged, `app.json` on the
branch says 1.1.0, `ITSAppUsesNonExemptEncryption = true` and 12 privacy types, so §3 line "already matches" and §4 hold only
for the 1.0 commit). Change these in ASC only when you submit the 1.1 build (it is a new store build:
`runtimeVersion` 1.1.0, new native module `react-native-libsodium`; an OTA can never deliver it to 1.0 phones).

| Where in ASC | 1.0 answer | 1.1 answer |
|---|---|---|
| Age rating: User-generated content | Yes (names, handles, requests, reports) | Yes, plus 1:1 chat between accepted friends |
| Messaging / chat between users | No | Yes |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` | key left out of `app.json` (2026-10-21; `true` was rejected, see below); answer ASC's questions per build |
| App Privacy | 11 types | add **Emails or Text Messages** (Linked, App Functionality); copy from `src/app/legal/app-privacy-labels.md` |
| Version / What's New | 1.0.0 / "First release." | 1.1.0 / "Message friends in your Circle. End-to-end encrypted." |
| Screenshot 4 | Circle ⋯ menu | Circle ⋯ menu showing Message, or a chat thread (demo text only) |

**Export compliance (1.1).** ATO now encrypts chat itself with libsodium (X25519 + XSalsa20-Poly1305, standard published
algorithms). When ASC asks after upload: "Does your app use encryption?" Yes. "Does it qualify for an exemption?" Choose the
answer for **standard encryption algorithms** (not proprietary, not Apple-OS-only); this is the mass-market case, so no
documents are uploaded. [CONFIRM with the lawyer (D12): whether a France encryption declaration is needed if ATO is
offered in France, and whether a US annual self-classification report applies. Not legal advice.]

**Update 2026-10-21 (emci).** Build 17 (`true`, no compliance code) was rejected by Apple on upload: error 90592, "Invalid Export
Compliance Code". ASC had no encryption document on file. Apple's table
(developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/) lists no
upload for standard algorithms when the app is not distributed in France; ATO is available in USA and Canada only (2 available,
173 not). So the `ITSAppUsesNonExemptEncryption` key is now LEFT OUT of `app.json` (a common fix for 90592; it also avoids an
exemption claim we cannot back) and 1.1 ships as build 18. Each build then shows "Missing Compliance" in TestFlight until you
answer ASC's questions: uses encryption = Yes; standard algorithms; not distributed in France. Open: the legal read (D12) and
whether XSalsa20-Poly1305 counts as a published standard (X25519 does). If Apple or the lawyer says a document is needed,
upload it, take the code, and set `ITSAppUsesNonExemptEncryption` true with `ITSEncryptionExportComplianceCode`.

**UGC safeguards to add to the 1.1 review notes:**
- Chat is only between accepted friends who have not blocked each other (checked on the server for every read and send).
- Report on any received message (long-press, six fixed reasons): the reporter's phone sends that message + up to 5 before it.
- Block from the chat header (silent). On-phone filter hides slurs and explicit sexual words behind "Tap to show" and asks
  for a second tap before sending one.
- Moderation: reports are read daily by the developer (24 h target); ladder warn → chat off → ban (`admin_chat_restrict`,
  root only; a ban also uses the Supabase Auth ban). Messages auto-delete after 30 days.

Review-notes line to replace for 1.1: "There is no chat or messaging between people." → "Friends can message each other
one to one (⋯ → Message). Chat is end-to-end encrypted; long-press a received message to report it."
Demo account (1.1): the demo friend must open chat once (it publishes their key) and send one message, so the reviewer
sees a thread.
