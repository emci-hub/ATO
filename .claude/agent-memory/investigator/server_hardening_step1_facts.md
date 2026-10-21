---
name: server-hardening-step1-facts
description: Step 1 hardening map - ai-generate callers/checks, invite/handle RPC grants, OTP, timezone farming, Sentry init, edge fn auth
metadata:
  type: project
---
- ai-generate live callers: category-deep-dive/generate.ts:57 (live, card-driven), legend-figures/generate.ts:123 (fallback only when library returns 'missing'), pingProvider (dev dot). rolls/legends64/category-statements = old paths. ai-library + ai-library-fill import _shared/ai-vendors.ts, NOT ai-generate.
- Checks pinning ai-generate source: scripts/ai-provider-check.ts:56-149 (regex on index.ts); live: scripts/live-ai.ts, style-live-check.ts.
- assert_invite_usable latest = wave42 (anon+authenticated, stable); handle_taken wave64 authenticated only; public_profile / me / connections base DDL NOT in repo.
- OTP: src/lib/auth-otp.ts signInWithOtp (shouldCreateUser param). No generic rate-limit table exists. No migration reads request.headers.
- claim_daily_checkin wave92:299; me.timezone updatable by client (syncDeviceTimezone me.ts:193), no guard trigger, no IANA validation.
- Sentry: src/lib/sentry.ts initSentry, no beforeSend; called _layout.tsx:28. check:sentry = live ingest only.
- Edge fn auth: dev-unlock does getUser (GOTCHAS.md says exception - stale); password-login none; ai-library-fill via library_fill_token_ok rpc; refresh-around bearer secret.
- landing/index.html JWT role=anon. .env.local unreadable to agent (permission denied). supabase CLI 2.116 installed, supabase/.temp/project-ref present (linked).
