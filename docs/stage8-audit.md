# Stage 8 codebase audit

Read-only discovery of the ATO repo (not docs). Status is **exists**, **partial**, or **does not exist**. One-line assessments are about what the code actually implements, not TestFlight/device confirmation.

## 1. Referral / invite system

**Status:** exists

**Paths:**
- `supabase/migrations/stage8_invite_referral.sql` — `app_config.signup_mode`, `invite_codes`, `me.referred_by`, `complete_signup` consume, `pause_branch` / `unpause_branch` / `delete_branch` (service_role only)
- `supabase/migrations/stage8_invite_revoke_execute.sql` — execute grants
- `supabase/migrations/founder_access_requests.sql` — founder unlimited codes + `access_requests`
- `src/lib/invite.ts` — `fetchSignupMode`, `fetchMyInviteCodes`, `fetchMyReferrals`
- `src/app/auth.tsx`, `src/app/onboarding.tsx` — invite code field when `signup_mode = invite_only`
- `src/app/(tabs)/you.tsx` — own codes + who-I-referred list
- `src/lib/me.ts` — `referred_by` on ME; `complete_signup` takes `p_invite_code`

**Assessment:** Full invite-only gate, codes table, hidden `referred_by`, and branch pause/delete RPCs are in; the app never calls pause/delete (service_role by design).

## 2. Push notifications

**Status:** partial

**Paths:**
- `src/lib/push.ts` — permission check + one-time `requestPermissionsAsync`, local `scheduleNotificationAsync` for morning/evening/Sunday
- `src/lib/push-copy.ts` — payloads (`Sage · coach` morning title)
- `src/lib/push-policy.ts` — when to ask (after first Check)
- `src/components/push-runtime.tsx` — mounted on authed stack in `src/app/_layout.tsx`
- `src/app/+native-intent.ts` — last-notification deep link
- `app.json` — `expo-notifications` plugin
- `package.json` — `expo-notifications`

**Assessment:** Local scheduling and a one-shot iOS permission ask exist; there is no Expo/APNs token registration and no server-side send path.

## 3. Home screen widget

**Status:** exists

**Paths:**
- `targets/widget/expo-target.config.js` — WidgetKit target `ATOWidget`, App Group `group.com.emgens.ato`
- `targets/widget/widgets.swift` — Read + Do widget (`AtoCard`), empty state, `ato:///` deep link
- `targets/widget/index.swift`, `targets/widget/Info.plist`, `targets/widget/PrivacyInfo.xcprivacy`
- `plugins/with-widget-appicon-scope.js`
- `app.json` — `@bacons/apple-targets`

**Assessment:** A real iOS widget extension is in the project and reads today's card from the App Group UserDefaults suite.

## 4. Sentry / crash reporting

**Status:** exists

**Paths:**
- `src/lib/sentry.ts` — `Sentry.init` (JS + native crash handling off web), DSN from `EXPO_PUBLIC_SENTRY_DSN`
- `src/app/_layout.tsx` — `initSentry()` + `Sentry.wrap`
- `app.json` — `@sentry/react-native/expo` plugin
- `metro.config.js` — `getSentryExpoConfig`
- `src/components/sentry-test-card.tsx` — `__DEV__` JS + native crash probes
- `package.json` — `@sentry/react-native`

**Assessment:** Client crash/error reporting is wired end-to-end; whether native stacks symbolicate is an ops/build fact, not missing code.

## 5. PrivacyInfo.xcprivacy

**Status:** exists

**Paths:**
- `PrivacyInfo.xcprivacy` — app manifest (`NSPrivacyTracking` false, collected types)
- `targets/widget/PrivacyInfo.xcprivacy` — widget (includes App Group UserDefaults reason C56D.1)
- `app.json` — `ios.privacyManifests` duplicate of the collected-types list

**Assessment:** Both the main app and the widget ship a privacy manifest; types are also mirrored in `app.json`.

## 6. App Privacy nutrition label content

**Status:** exists

**Paths:**
- `src/app/legal/app-privacy-labels.md` — App Store Connect paste-in answers (11 types, tracking = no)
- `PrivacyInfo.xcprivacy` / `app.json` `ios.privacyManifests` — same type identifiers

**Assessment:** Draft answers live in-repo as a fill-in sheet; nothing here proves they have been pasted into App Store Connect.

## 7. Rate limiting on the router (per-user call limits)

**Status:** partial

**Paths:**
- `supabase/migrations/stage8_ai_quota.sql` — `app_config.ai_daily_cap` (20) / `ai_monthly_cap` (200), `claim_ai_call()`
- `src/lib/voice/quota-server.ts` — `claimAiCall()` RPC wrapper
- `src/lib/voice/talk.ts` — Talk claims once before generate
- `src/app/(tabs)/sage.tsx` — production Talk passes `claimAiCall`
- `src/lib/voice/router.ts` — Home/Dawn card generate path; **no** `claimAiCall`

**Assessment:** Talk is capped per user in Postgres; generated Home/Dawn cards call Gemini without that claim.

## 8. Explicit age question in onboarding

**Status:** exists

**Paths:**
- `src/app/onboarding.tsx` — field label `"When were you born?"` (YYYY / MM / DD), hint 16+
- `src/lib/age.ts` — `MIN_APP_AGE_YEARS = 16`, `AGE_REQUIRED_MESSAGE`, `signupAgeMessage`
- `src/lib/me.ts` — `born_on` required on `createMe` / `complete_signup`

**Assessment:** Onboarding asks for a calendar birthday (not a yes/no age chip) and blocks signup under 16.

## 9. "Coach" labeling for Sage in the UI

**Status:** exists

**Paths:**
- `src/lib/sage-copy.ts` — `SAGE_COACH_LABEL` (`Sage · coach`), Dawn/Talk/consent ledes
- `src/app/(tabs)/sage.tsx` — Talk header uses `SAGE_COACH_LABEL`
- `src/app/(tabs)/index.tsx` — Home card uses `homeSageLabel` (Quest → `Sage · npc`, else coach)
- `src/app/dawn.tsx` — `DAWN_SAGE_LEDE` (“Sage is a coach, not a person”)
- `src/components/ai-consent-card.tsx`, `src/lib/crisis/copy.ts`, `src/app/chat.tsx` (Teach Sage)
- `src/lib/push-copy.ts` — morning title `Sage · coach`
- `targets/widget/widgets.swift` — `"SAGE · COACH"`

**Assessment:** Live Talk/Home/Dawn/consent/crisis/push/widget copy names Sage a coach; Quest Home is the one npc exception.

## 10. Legal / landing page content

**Status:** partial

**Paths:**
- `src/app/legal/privacy.md`, `src/app/legal/terms.md` — drafts, `[DATE — fill in on publish]`, marked pending lawyer review
- `landing/index.html` — public landing + invite request form (`access_requests`)
- `landing/privacy.html`, `landing/terms.html`, `landing/style.css`
- No in-app route under `src/app/` that renders privacy/terms

**Assessment:** Landing + privacy/terms drafts exist on disk; they are unpublished drafts (no date, no in-app legal screens).

## 11. `ai_usage` table (AI call logging / quota)

**Status:** exists

**Paths:**
- `supabase/migrations/stage8_ai_quota.sql` — table `(user_id, day, calls)`, RLS select-own, writes via `claim_ai_call`
- `supabase/migrations/voice_preset_jargon.sql` — `jargon_flag` / `jargon_at` + `log_jargon_guard` (does not increment `calls`)
- `src/lib/voice/quota-server.ts` — `claimAiCall`, `fetchSageUsage`, `logJargonGuard`

**Assessment:** Per-user per-UTC-day usage rows exist; Talk quota increments `calls`, jargon hits only stamp flag + timestamp.
