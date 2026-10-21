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
