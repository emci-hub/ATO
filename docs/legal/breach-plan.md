# Breach plan (one page)

Written 2026-10-22 (roadmap v2 step A2). Owner: Michael Malig (emci), support@emgens.com.
Rule: Alberta PIPA s.34.1. An organization must notify the Information and Privacy Commissioner "without unreasonable
delay" of any loss of, unauthorized access to, or disclosure of personal information where "a reasonable person would
consider that there exists a real risk of significant harm" to someone. The Commissioner can order notice to the people
affected (s.37.1). Source: OIPC Alberta, *Guidance for Notifying the OIPC about a Privacy Breach Under PIPA* (April 2024).
Label: **mandatory** (the law). The steps below are a **recommended safeguard** for meeting it.

## 1. Stop it (same day)
- Rotate whatever leaked: Supabase service key / JWT secret (dashboard), `GEMINI_API_KEY`, `RESEND_API_KEY`, Apple key,
  `DEV_UNLOCK_PASSWORD` (`supabase secrets set ...`). Never paste values in chat or the repo.
- If an account was taken over: ban it in Supabase Auth, revoke its sessions.
- If a function is the hole: redeploy a 410 stub (the `ai-generate` pattern) until fixed.

## 2. Write down the facts (same day, in `docs/legal/breach-log.md`)
When it started, when it was found, how, which tables / fields, how many accounts, whether chat ciphertext only
(unreadable without the phones) or readable data, who could have seen it, what was done to stop it.

## 3. Decide: real risk of significant harm?
Ask: how sensitive (email + birthday + trait answers + reports is sensitive; locked chat ciphertext alone is not readable),
how many people, was it taken by someone with bad intent, how long was it exposed, could it enable fraud, embarrassment or
harassment. When unsure, treat it as yes.

## 4. If yes: notify (without unreasonable delay; aim for 72 hours from knowing)
- **OIPC Alberta:** use the breach report form on oipc.ab.ca. Include the facts from step 2, the harm assessment, the
  steps taken, and a contact (support@emgens.com).
- **People affected:** email each one directly (the sign-in address), plain words: what happened, what data, what we did,
  what they can do (change Apple / email password if relevant, watch for phishing), how to reach us.
- **Canadian users outside Alberta:** PIPEDA has the same "real risk of significant harm" test; report to the Office of the
  Privacy Commissioner of Canada too (priv.gc.ca breach form). **US users:** check the state of each affected person;
  most states require notice to the person.

## 5. After
Keep the record at least 2 years (PIPEDA requires a record of every breach for 24 months, even ones not reported). Fix the
cause, add a check that would have caught it, and update the privacy policy if anything it says changed.
