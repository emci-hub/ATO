# Circle design brief (2026-10-20)

## Summary and recommendation

Today anyone can add anyone by handle with no accept step, and the peer functions (`peer_profile`, `peer_checks`) then hand that person the target's profile "recipe", talk style and daily Read/Do text. That is the biggest gap: an unwanted "friend" can read a stranger's data. Apple 1.2 also requires report, block, a filter and published contact info for any app with user-to-user features.

Recommendation: **ship Option A at launch** (visits + mutual accept + block + report + a small gentle first layer), built on a data shape that already carries Options B and C so nothing is redone. Trait compare (B) comes after launch, strengths only, opt-in per friend. Chat (C) only when someone can triage reports daily.

## Launch must-haves vs after launch

Launch (Apple 1.2 + consent):
- Mutual accept before any data flows (a request is not a friendship).
- Block (instant, silent, hides both ways) and report (user or item, with reason).
- Filter for objectionable content on anything user-written that other people see (handle, display name, any note; gifts should be preset items, not free text).
- Published contact info (support email in app + App Store listing) and terms stating zero tolerance; act on reports promptly (reviewers and forum reports cite 24 hours, which is not in the public text, so treat it as a target).
- Peer RPCs must require an *accepted*, non-blocked link and a per-friend share flag; sharing between users names what is shared and who sees it (5.1.1/5.1.2: disclose, get permission).
- Unfriend and block never notify the other person.
- Admin view of reports (a SQL view or a root-only screen).

After launch: trait compare, invite links/QR polish, contacts matching, circle-size tuning, report dashboard, auto-hide on repeated reports, chat.

## Research takeaways

- **Co-Star**: add friends and contacts, compare charts, see "struggles" between you ([overview](https://uhighmidway.com/19616/features/astrology-app-co-star-provides-a-way-to-interact-with-friends/)). It leans into friction text, which is what we want to avoid with psychological traits.
- **Locket**: hard cap of about 20 friends; adding via contacts or invite link, and public links leak to strangers ([AirDroid](https://www.airdroid.com/parent-control/is-locket-widget-safe-for-kids/), [Bark](https://www.bark.us/app-reviews/apps/locket-widget-review/)). Lesson: a small cap helps, a public link needs an accept step.
- **BeReal**: friend request flow, remove friend with no notice (they just stop seeing new posts), re-adding needs a new request, report from a three-dot menu ([help](https://help.bereal.com/hc/en-us/articles/7538028244253-Remove-Friends), [eSafety](https://esafety.gov.au/key-topics/esafety-guide/bereal)).
- **Personality-test compare** (Clearer Thinking, others): compare works by the friend sharing results; result is side-by-side, not a verdict ([Clearer Thinking](https://www.clearerthinking.org/post/we-re-launching-the-ultimate-personality-test)). I could not verify 16Personalities/Truity or The Pattern details; treat as unverified.
- **Apple 1.2**: filter, report with timely response, block, published contact ([guidelines](https://developer.apple.com/app-store/review/guidelines/), [reviewer rejection examples](https://developer.apple.com/forums/thread/50259)). **5.1.1/5.1.2**: disclose what is shared and with whom and get permission; policy text alone is not enough ([forum](https://developer.apple.com/forums/thread/826199), [TechCrunch](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai)). Exact current wording should be re-read on Apple's page before submission.
- Abuse risk of sharing traits (my analysis, not sourced): attachment anxiety/avoidance and conflict style can be weaponised ("you're avoidant"), used to pressure partners, or read as diagnosis. Sharing is permanent in the viewer's memory even if later revoked.

## Options

**A. Visits + accept + block/report (size M).**
User sees: Circle list, add by handle or link/QR, incoming requests (accept/decline), friend's hideout visit, gifts, share switch, three-dot menu (unfriend, block, report). Screens: Circle list, requests inbox, add friend, report sheet, blocked list in settings. Server: new accept/decline/unfriend/block/report RPCs; add accepted+block checks inside `circle_visit_allowed` and every `peer_*`. Moderation: low (handles and preset gifts only). Risks: handle harassment (request spam, so rate-limit and cap pending requests). 

**B. A + gentle compare (size M-L, after launch).**
User sees: on a friend's page, "What you two share" built only from shareable strengths of both people, shown only if both opted in for that friend. No scores, no "who is more X", no struggle-side leans. Screens: per-friend share sheet, compare card. Server: `circle_compare(peer)` RPC computing a server-side card from `isShareableLean`-style data; never returns raw axis values. Moderation: low; risk: indirect inference (two people can still infer each other's lows). Mitigate: fixed copy templates, no numbers.

**C. B + chat (size L).**
User sees a thread per friend. Server: messages table, existing `stage7_chat_report.sql` schema, realtime, filters, report-message, retention. Moderation: high (free text between people; needs daily triage and a filter that catches slurs and sexual content). Risks: harassment, Apple scrutiny. Do not ship until reporting has an owner.

## Data shape that works for all options

- **Keep `connections` as the *accepted* edge only** (mirror rows stay, so existing peer functions keep working) and add a **`circle_requests`** table: `id, from_id, to_id, status (pending/accepted/declined/cancelled), created_at, decided_at`, unique on the ordered pair. Reason: a status column on the mirrored connections would let pending rows leak through every existing policy and RPC; a separate table means nothing is shared until the accept RPC writes the two mirror rows. Existing live connections are grandfathered (they predate launch; invite-only testers).
- **Blocks**: reuse `blocks(blocked_by, blocked_user)`. Blocking deletes the connection and pending requests, and one helper `is_blocked_either_way(a,b)` is called by `circle_visit_allowed`, every `peer_*`, request creation, and (later) chat. Block is silent; the blocked person just sees nothing/"unavailable". Re-request after block is refused.
- **Reports**: reuse `reports` (target is a message or user). Add `reason`, `status`, `context jsonb` (handle and display name snapshot at report time, so evidence survives rename). The `from`/target ids must have no cascading delete: on account deletion null the personal fields and keep the row (reason, snapshot, timestamps) so moderation history and repeat offenders survive. Check this against `delete-account`.
- **Per-friend share settings**: `circle_shares(owner_id, friend_id, visit bool, categories bool, compare bool, updated_at)`, defaults false except visit (which the user turns on at accept time, with plain text of what the friend sees). Reuse the existing `circle_visit_allowed` / `set_circle_visit_share` pattern; `compare` stays false and unused until B.
- **Circle size cap**: server-enforced (suggest 20, as Locket; adjust), plus a cap on pending outgoing requests (e.g. 10) and a rate limit.

## What trait info is safe to show friends

Default: nothing trait-related is visible. Allowed once the owner opts in per friend (and, for compare, both sides): name/handle, pet and hideout, shareable strengths and titles only (same `isShareableLean` / `WEAKNESS_MIN_LEAN` logic as push and widgets). Never to friends: raw axis values, attachment anxiety/avoidance, conflict-style lows, any struggle-side line, answer history, `show_up`/`talk_style` free text, or daily Read/Do text. **This means `peer_profile` (returns `recipe`, `show_up`, `talk_style`) and `peer_checks` (returns Read/Do text) should be narrowed or gated by share flags in the safety build**, since they are the current leak path. Opt-in rules: plain-language preview of exactly what the friend will see, easy off switch, revoking takes effect immediately, nothing forced by accepting a request.

## Changes to the safety build plan

1. Add `circle_requests` + accept/decline/cancel RPCs (accept flow is required, not optional).
2. Add block (silent, deletes edge, checked inside every peer RPC) and a report sheet writing to `reports`; surface a root-only report list.
3. Filter: apply the existing content checks to handle/display name now; keep gifts preset-only so no free text exists at launch.
4. Gate or narrow `peer_profile` / `peer_checks` by accepted + not blocked + share flag.
5. Contact email and terms line in app and App Store; update the AI/consent disclosure wording to say what friends can see.
6. Reports must survive account deletion (verify `delete-account`).

## Sources

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple forum, 1.2 rejection: https://developer.apple.com/forums/thread/50259 and https://developer.apple.com/forums/thread/807358
- Apple forum, 5.1.1(i): https://developer.apple.com/forums/thread/826199
- TechCrunch on Nov 2025 5.1.2 update: https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai
- Co-Star friends: https://uhighmidway.com/19616/features/astrology-app-co-star-provides-a-way-to-interact-with-friends/
- Locket: https://www.airdroid.com/parent-control/is-locket-widget-safe-for-kids/ , https://www.bark.us/app-reviews/apps/locket-widget-review/
- BeReal: https://help.bereal.com/hc/en-us/articles/7538028244253-Remove-Friends , https://esafety.gov.au/key-topics/esafety-guide/bereal
- Clearer Thinking compare: https://www.clearerthinking.org/post/we-re-launching-the-ultimate-personality-test
