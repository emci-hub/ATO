---
name: circle-social-safety-facts
description: Circle data model, report/block UI absence, consentless connect (S2), parked circle/chat tabs, wave97 visits RPCs
metadata:
  type: project
---
- connections/me/public_profile are baseline tables NOT in migrations (red-team S18); connect = client inserts connections row, DB mirrors reverse (consentless, red-team S2 docs/red-team-2026-09-03.md:36).
- stage7_chat_report.sql has blocks/mutes/threads/messages/reports with RLS; NO client code writes blocks/reports (grep src: none). (tabs)/circle.tsx and chat.tsx are RebuiltNotice placeholders (Card F park), so Circle UI is unreachable except wave97 Divecore visits (src/play/circle-visits*).
- peer_checks (peer_checks.sql) has no block check; wave97 circle_visit_allowed does (wave97:75-106).
- Age gate: src/lib/age.ts MIN_APP_AGE_YEARS 16 at signup.
