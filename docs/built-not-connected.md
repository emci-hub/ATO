# Built, Not Connected

Real working features that are buried or single-surfaced. Built from the screen-by-screen pass in `docs/screen-map.md`.

## Access requests (`src/lib/access-requests.ts`)

`listPendingAccessRequests`, `approveAccessRequest`, `denyAccessRequest` are fully implemented, but the only place they're wired in is `dev-lab.tsx` — a dev-only, `PRE_LAUNCH_DEV`-gated screen (screen-map.md, Auth/Signup + Dev Tools sections).

**What this means:** if `app_config.signup_mode` were ever switched from `invite_only` to a public+request-gate mode, there is currently no user-facing screen where someone could submit or where a non-dev could review an access request — only a dev opening dev-lab can act on the `access_requests` table. Fine as-is while the app stays invite-only; would need a real screen the day `signup_mode` changes.

## Category statements (already resolved, kept here for the record)

Per field-inventory.md's "Already-answered question": the category Q&A → statements conversion was already built and shipped (`category_statements` table, wave59; `generate-statements.ts`; rendered by `categories-fold.tsx` and `category-statement-archive-fold.tsx` on Explore). This was the concrete case that motivated this whole exercise — a real, live feature that emci didn't know existed because it only surfaces on Explore's Categories fold. Confirmed still connected in the screen-map pass (Categories section) — no action needed, just documenting that this is what "built but hard to find" looks like in practice.

## Observations worth watching (not yet confirmed as "buried," just noted)

- **`VoiceCardResult.dev` trace fields** (`providerLabel`, `checkCount`, `fromBankFile`, `fromModel`) are duplicated across four separate dev surfaces (`dawn.tsx`, `dev-lab.tsx`, `ai-lab.tsx`, `voice-lab.tsx`) rather than one shared view — a duplication pattern, not a connectivity gap (all four are already reachable, just redundant).
- **`around-lab.tsx`** only exercises `fetchWeekendJson` (the listing fetch) — it has no dev-lab coverage of the `going`/colors/faces feature (`fetchNight`/`setGoing`/`night_snapshot`). Not "built but disconnected" in the user-facing sense (the real Around screen uses it fine) — it's a dev-tooling coverage gap, flagged here in case the Opus judgment pass wants to weigh in on dev-lab completeness.
