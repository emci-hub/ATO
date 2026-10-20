# App Privacy nutrition labels

Copy these answers into App Store Connect → App Privacy. They must match `PrivacyInfo.xcprivacy`, `app.json` `ios.privacyManifests` and `src/app/legal/privacy.md` (`check:floor` compares the data types and the Linked column). No ATT / cross-app tracking (`NSPrivacyTracking = false`). This is not legal advice; open items are in `docs/legal/OPEN-QUESTIONS.md`.

## Tracking

- **Do you or your third-party partners use data for tracking purposes?** No. No ad SDKs, no advertising identifier, no data broker.

## Data collected (data type / linked / used for tracking)

| Apple type | Collected | Linked to identity | Used for tracking | Purposes | What ATO actually stores |
|---|---|---|---|---|---|
| Email Address | Yes | Linked | No | App Functionality | Supabase Auth email (sign-in codes via Resend), or Apple's Hide My Email relay address. [CONFIRM: the landing-page email form stays or goes at launch] |
| Name | Yes | Linked | No | App Functionality, Product Personalization | `me.name` (checked by the name filter) |
| Date of Birth | Yes | Linked | No | App Functionality | `me.born_on` (self-reported). Age is computed from the date: 18+ to use the app, a valid 18+ birthday for "going" to an 18+ night. |
| User ID | Yes | Linked | No | App Functionality | Auth UUID, `@handle`, Apple `sub`, referral `referred_by` if used (abuse prevention only) |
| Other User Content | Yes | Linked | No | App Functionality, Product Personalization | Trait and sign-up answers; typed `city` for Around, IANA `timezone`; pixel `recipe`; Check read/do text; Circle friend requests, friendships, blocks and the per-friend visit / compare switches; Divecore game save (pet, rooms, items, progress). No messages between people. Typed text is never sent to an AI model. |
| Customer Support | Yes | Linked | No | App Functionality | Circle reports (one of six fixed reasons + the reported handle). Kept after either account is deleted, with the account ids cleared. |
| Product Interaction | Yes | Linked | No | App Functionality, Product Personalization | Checks (`did`/`skip`), AI consent, invite-code uses, `ai_usage` counts, ATO token activity, AI library cards seen, `ai_provider_log` (provider + time only; no prompt or reply text) |
| Other Usage Data | Yes | Linked | No | App Functionality | AI usage log (feature + day + count). The anonymous Divecore daily counts carry no account or device id and are not linked. Nothing a person types is scanned, flagged or logged. [CONFIRM: keep this type or fold it into Product Interaction — OPEN-QUESTIONS 9a] |
| Crash Data | Yes | Not linked | No | App Functionality | Sentry crash reports. `sendDefaultPii: false`, no `setUser`, email / handle / ids / free text scrubbed before sending (`src/lib/sentry.ts`) |
| Other Diagnostic Data | Yes | Not linked | No | App Functionality | Sentry device / OS / app context on a crash |
| Device ID | Yes | Not linked | No | App Functionality | Sentry installation id (not the IDFA; no ATT). Not a push token. |

## PrivacyInfo identifiers (must match the plist)

NSPrivacyCollectedDataTypeEmailAddress
NSPrivacyCollectedDataTypeName
NSPrivacyCollectedDataTypeDateOfBirth
NSPrivacyCollectedDataTypeUserID
NSPrivacyCollectedDataTypeOtherUserContent
NSPrivacyCollectedDataTypeCustomerSupport
NSPrivacyCollectedDataTypeProductInteraction
NSPrivacyCollectedDataTypeOtherUsageData
NSPrivacyCollectedDataTypeCrashData
NSPrivacyCollectedDataTypeOtherDiagnosticData
NSPrivacyCollectedDataTypeDeviceID

## Declared Not Collected

Health, Fitness, Location (precise or coarse), Photos or Videos (the camera is an on-device QR scan only; nothing is uploaded), Contacts, Emails or Text Messages, Browsing History, Search History, Purchases, Advertising Data, Sensitive Info, Payment Info, Phone Number, Audio.

Timezone is an IANA string on `me` for the local day — not GPS, so not Location.

Push token: not collected. Notifications are scheduled on the phone (`expo-notifications`, local only); nothing uploads an APNs / Expo push token. Revisit this line if remote push is ever added.

## Who can see a person's data inside the app (policy disclosure, not an Apple type)

- Anyone with the @handle: name, handle, two sign-up answers (show up / talk style), pixel appearance (`public_profile`, rate-limited; a blocked pair sees nothing).
- Accepted friends: the Hideout visit and preset gifts while visits are on for that friend; "Compare strengths" only when both switched it on (fixed phrases for up to a few clear strengths; never scores, attachment, conflict lows or any struggle-side lean). Blocking ends both.

## Third parties (named in privacy.md)

- **Supabase** — database, sign-in, profile, answers, Checks, Circle, reports, Divecore save, AI usage log, referrals.
- **Google (Gemini API)**, with **DeepSeek** as a fallback — Legends cards and category deep dives only, called from the server (`supabase/functions/_shared/ai-vendors.ts`: Gemini first, DeepSeek if Gemini fails). The phone sends `{kind, bucket, mode}`; the server builds the prompt and it contains nothing personal. [CONFIRM: no-training and retention terms for both, and DeepSeek as a China-based processor]
- **Resend** — one-time sign-in codes to email. [CONFIRM: other email uses, retention]
- **Apple** — Sign in with Apple (may relay a private email); the Apple refresh token is stored to revoke it on account deletion.
- **Sentry** — crash/diagnostic data, not linked to the ATO account.

We do not sell data. ATO has no messaging between people, so there is no message content to disclose; if chat ships later (master plan Step 14), add it here and in privacy.md first.

## Required-reason APIs (must stay in PrivacyInfo.xcprivacy)

- UserDefaults: `CA92.1` (app-only defaults) and `C56D.1` (App Group `group.com.emgens.ato` for the widget)
- File timestamp: `3B52.1` (app / app-group container) and `C617.1` (Sentry SDK)
- System boot time: `35F9.1` (Sentry / elapsed-time)
- Widget target: UserDefaults `C56D.1` only, no collected data, tracking false
