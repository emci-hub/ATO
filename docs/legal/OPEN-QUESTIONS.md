This is not legal advice. It lists what only emci or a lawyer can answer before the privacy policy, terms and App Store labels are published. Each item matches a `[CONFIRM: ...]` tag in `src/app/legal/*.md`, `landing/*.html` or `app-privacy-labels.md`. A lawyer should read the policy and terms before App Store submission.

# Open questions (updated 2026-10-20, master plan Step 10)

## Settled from the code in Step 10 (no longer open)

- **AI vendor:** Gemini first, DeepSeek if Gemini fails (`supabase/functions/_shared/ai-vendors.ts`). Both are named. What is still open about them is item 2.
- **Push token:** none is uploaded. Notifications are local only (`src/lib/push.ts`), so the "push token" line was removed.
- **Sentry linkage:** the app sets no user, uses `sendDefaultPii: false` and scrubs email, handle, ids and free text (`src/lib/sentry.ts`). Crash data is "Not linked". Region and retention are still open (item 11).
- **Chat:** parked (`src/app/chat.tsx` is a notice and no screen links to it). The text now says there are no direct messages between people, and "mute" (never built) is gone.
- **Deletion scope (old item 4c/4d):** every per-account table cascades. Reports are kept with the ids cleared (wave104). `sage_messages` (wave71) and `crisis_flags` (wave103) are dropped. `count_user_rows` now sees every table (wave106, `check:delete-proof`).
- **Privacy/Terms links:** on sign-up and You, opening `https://ato.emgens.com/{privacy,terms}.html`.

## Still open

1. **Company / legal entity name.** Every document says "AsTrollOGs". Is that the registered entity? Confirm the contact domain spelling `support@asstrollogs.com` and that the inbox is monitored. Is an address or other contact info required for privacy law (PIPEDA / Alberta PIPA, GDPR / UK if you accept users there)?
2. **AI vendor terms (lawyer).** Do the Gemini API terms (paid tier?) and the DeepSeek API terms bar training on requests, and how long does each keep them? Is DeepSeek, a China-based processor, acceptable as a fallback? If not, remove DeepSeek from the server secrets and from the text together. `check:floor` requires both names today, so that check changes with it.
3. **Retention periods.** No retention period is stated in code. The text promises only "while your account exists". Decide whether to promise more for:
   - the deletion record (`account_deletions`)
   - kept reports
   - Supabase backups
   - Sentry and Resend logs
   - the AI providers' request logs
   - `access_requests` emails
4. **Reports kept after deletion.** A report keeps the reported @handle, the reason and the time, with both account ids cleared. Is that acceptable, and for how long? Do you want to state a report-review time (terms §5)?
5. **"Reset account."** It is root-only and pre-launch, so the text does not mention it. If it is ever offered publicly, the text must say what it keeps (consent, Circle, AI usage log, Divecore save).
6. **Governing law and disputes (lawyer).** Is Alberta, Canada right? Arbitration or courts? Is the damages exclusion enforceable for consumers in your target countries? Do Apple's standard EULA terms need to be referenced?
7. **Privacy-law scope at public launch (lawyer).** Which countries can sign up? Do you need any of these?
   - a GDPR / UK representative
   - a CCPA notice
   - a lawful-basis statement
   - an access / export / correction process beyond in-app delete
   - a statement about data hosted abroad (Supabase, AI vendors)
8. **Age-rating answers (App Store Connect).** The app is 18+ with no chat, has user-to-user Circle features (handles, preset gifts, friends' strengths), AI-generated cards, "going" to 18+ nights, and adult humor and strong swearing under the content policy. Pick the questionnaire answers and confirm the rating. Report and block now exist, and the support email is the contact point.
9. **Label categories.**
   - (a) Keep `OtherUsageData` (it now covers only the AI usage log) or fold it into `ProductInteraction`? Changing it means editing the plist, `app.json`, the labels doc and `check:floor` together.
   - (b) Is the Divecore save right under `OtherUserContent`?
   - (c) Device ID = the Sentry installation id. Confirm with the Sentry project settings that it is sent; if not, the type can be removed from all three files.
10. **Landing-page email form.** `landing/index.html` still posts an email to `access_requests` (the invite request). Keep it as a waitlist, change it, or remove it at the launch flip? `scripts/founder-access-check.ts` asserts the form exists. Also decide whether invites and referral codes continue after launch (terms §7).
11. **Resend and Sentry.** What does Resend store (address, message bodies, retention)? Which region does Sentry use, and how long does it keep reports? Are data processing agreements in place?
12. **Third-party art.** Is any Kenney.nl (CC0) art still shipped? The landing footer and the in-app credits still credit Kenney. Do the PixelLab terms allow commercial use of generated art (https://pixellab.ai/termsofservice)? (Lawyer / emci.)
13. **Helpline wording (lawyer).** Is "not triggered by anything you type, and nothing about it is logged" the exact statement you want? Is having no crisis detection acceptable for the app category and stores?
14. **"Last updated" date and in-app notice.** Fill in the date at publish. Since Sage, crisis scanning and chat are gone and Circle sharing is new, decide whether to show an in-app notice of the policy change when Release B ships.
15. **Hosting of the legal pages.** `landing/*.html` is published at ato.emgens.com by a process outside this repo. Confirm it is deployed before the Release B OTA, so the new in-app links don't open old text. The in-app links open those pages; `src/app/legal/*.md` is the source text and is not rendered in the app.
16. **Public handle lookup.** Anyone with an @handle (signed out too, rate-limited) sees name, handle, two sign-up answers and pixel appearance (`public_profile`, for shared cards). There is no switch to turn this off. Is that acceptable, or should a "hide my card" switch exist before launch?
