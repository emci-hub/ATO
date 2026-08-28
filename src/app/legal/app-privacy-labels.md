# App Privacy nutrition labels

Copy these answers into App Store Connect → App Privacy. They must match `PrivacyInfo.xcprivacy`, `app.json` `ios.privacyManifests`, and `src/app/legal/privacy.md`. No ATT / cross-app tracking in v1 (`NSPrivacyTracking = false`).

## Tracking

- **Do you or your third-party partners use data for tracking purposes?** No.

## Data collected

| Apple type | Collect? | Linked to identity | Tracking | Purposes | What ATO actually stores (privacy.md) |
|---|---|---|---|---|---|
| Email Address | Yes | Linked | No | App Functionality | Supabase Auth email (OTP via Resend) and Apple Hide My Email relay address |
| Name | Yes | Linked | No | App Functionality, Product Personalization | `me.name` |
| Date of Birth | Yes | Linked | No | App Functionality | `me.born_on` (self-reported at onboarding). Age is computed from the date — 16+ to create an account, 18+ later for Wave 2 "going". Not a frozen age or boolean. |
| User ID | Yes | Linked | No | App Functionality | Auth UUID, `@handle`, Apple `sub`, invite `referred_by` (abuse prevention only; never shown publicly) |
| Other User Content | Yes | Linked | No | App Functionality, Product Personalization | Chat messages; Sage messages; ME free text (`show_up`, `knocks_you_off`, `morning_cue`, `talk_style`, `evening_wind_down`, `energy_pattern`, `recovery_style`, `support_style`, `current_focus`, `facts`, typed `city` for Around, IANA `timezone`); pixel `recipe`; Check read/do text. Gemini receives ME + recent checks +, for Talk, a short window of recent Sage turns — not the full thread. |
| Customer Support | Yes | Linked | No | App Functionality | `reports` (reason + target) on Chat and Sage |
| Product Interaction | Yes | Linked | No | App Functionality, Product Personalization | Checks (`did`/`skip`), AI consent, invite-code uses, `ai_usage` counts |
| Other Usage Data | Yes | Linked | No | App Functionality | `crisis_flags` (user + timestamp only, never the message) |
| Crash Data | Yes | Not linked | No | App Functionality | Sentry crash/error reports |
| Other Diagnostic Data | Yes | Not linked | No | App Functionality | Sentry device/OS/app context on a crash |
| Device ID | Yes | Not linked | No | App Functionality | Sentry installation id (not IDFA; no ATT) |

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

Health, Fitness, Location (precise or coarse), Photos or Videos (camera is on-device QR scan only — nothing is uploaded), Contacts, Browsing History, Search History, Purchases, Advertising Data, Sensitive Info, Payment Info, Phone Number.

Timezone is an IANA string on `me` for local day/pushes — not GPS, so not Location.

Push notification token: `privacy.md` says we collect one if notifications are enabled. v1 schedules **local** notifications only and does not upload an APNs/Expo token to our servers. Device ID above is the Sentry installation id, not a push token. Revisit this row if remote push is added.

## Third parties (named in privacy.md)

- **Supabase** — database, auth, profile, Checks, chat, facts, reports, crisis-flag timestamps, referrals.
- **Google (Gemini API)** — Sage coach replies and generated daily cards; relevant context only. Talk may include a short window of recent Sage turns, not the full thread.
- **Resend** — one-time login codes to email.
- **Apple** — Sign in with Apple (may relay a private email); Hide My Email address is what we store.
- **Sentry** — crash/diagnostic data, not linked to the ATO account.

We do not sell data. Chat is not end-to-end encrypted (TLS + database access controls only) — that is a policy disclosure, not a separate Apple data type.

## Required-reason APIs (must stay in PrivacyInfo.xcprivacy)

- UserDefaults: `CA92.1` (app-only defaults) and `C56D.1` (App Group `group.com.emgens.ato` for the widget)
- File timestamp: `3B52.1` (app / app-group container) and `C617.1` (Sentry SDK)
- System boot time: `35F9.1` (Sentry / elapsed-time)
- Widget target: UserDefaults `C56D.1` only, no collected data, tracking false
