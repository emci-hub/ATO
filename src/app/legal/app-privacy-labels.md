# App Privacy nutrition labels

Copy these answers into App Store Connect → App Privacy. They must match `PrivacyInfo.xcprivacy` and `app.json` `ios.privacyManifests`. No ATT / cross-app tracking in v1 (`NSPrivacyTracking = false`).

## Tracking

- **Do you or your third-party partners use data for tracking purposes?** No.

## Data collected

| Apple type | Collect? | Linked to identity | Tracking | Purposes | What ATO actually stores |
|---|---|---|---|---|---|
| Email Address | Yes | Linked | No | App Functionality | Supabase Auth email (OTP) and Apple Hide My Email relay address |
| Name | Yes | Linked | No | App Functionality, Product Personalization | `me.name` |
| User ID | Yes | Linked | No | App Functionality | Auth UUID, `@handle`, Apple `sub`, invite `referred_by` |
| Other User Content | Yes | Linked | No | App Functionality, Product Personalization | Chat messages; Sage messages; ME free text (`show_up`, `knocks_you_off`, `morning_cue`, `facts`); pixel `recipe`; Check read/do text |
| Customer Support | Yes | Linked | No | App Functionality | `reports` (reason + target) |
| Product Interaction | Yes | Linked | No | App Functionality, Product Personalization | Checks (`did`/`skip`), AI consent, invite-code uses, `ai_usage` counts |
| Other Usage Data | Yes | Linked | No | App Functionality | `crisis_flags` (user + timestamp only, never the message) |
| Crash Data | Yes | Not linked | No | App Functionality | Sentry crash/error reports |
| Other Diagnostic Data | Yes | Not linked | No | App Functionality | Sentry device/OS/app context on a crash |
| Device ID | Yes | Not linked | No | App Functionality | Sentry installation id (not IDFA; no ATT) |

## PrivacyInfo identifiers (must match the plist)

NSPrivacyCollectedDataTypeEmailAddress
NSPrivacyCollectedDataTypeName
NSPrivacyCollectedDataTypeUserID
NSPrivacyCollectedDataTypeOtherUserContent
NSPrivacyCollectedDataTypeCustomerSupport
NSPrivacyCollectedDataTypeProductInteraction
NSPrivacyCollectedDataTypeOtherUsageData
NSPrivacyCollectedDataTypeCrashData
NSPrivacyCollectedDataTypeOtherDiagnosticData
NSPrivacyCollectedDataTypeDeviceID

Health, Fitness, Location (precise or coarse), Photos or Videos (camera is on-device QR scan only), Contacts, Browsing History, Search History, Purchases, Advertising Data, Sensitive Info, Payment Info. Timezone is stored on `me` as an IANA string for local day/pushes — not GPS, so not declared as Location.

## Third parties

Crash/diagnostic data is sent to Sentry. Account, profile, chat, Sage, checks, reports, invites, and crisis-flag timestamps are stored in Supabase. Model calls (Gemini) receive the Talk/card prompt derived from ME + recent checks; they are not a separate Apple "data type" beyond Other User Content already declared.

## Required-reason APIs (must stay in PrivacyInfo.xcprivacy)

- UserDefaults: `CA92.1` (app-only defaults) and `C56D.1` (App Group `group.com.emgens.ato` for the widget)
- File timestamp: `3B52.1` (app / app-group container) and `C617.1` (Sentry SDK)
- System boot time: `35F9.1` (Sentry / elapsed-time)
- Widget target: UserDefaults `C56D.1` only, no collected data, tracking false
