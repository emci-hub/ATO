# Legal open questions (updated 2026-10-22, roadmap v2 step A2)

Under the compliance rule (CLAUDE.md, emci 2026-10-22) these were answered from official sources and emci's answers, with
no lawyer. The published text is `landing/*.html`; `src/app/legal/*.md` is the same text kept in the repo. Keep both in sync
(`check:floor`).

## Settled in A2 (2026-10-22)

1. **Operator:** "ATO, operated by Michael Malig" (emci). Copyright "© 2026 Michael Malig".
2. **Contact:** `support@emgens.com` (ImprovMX forwarding, live). In-app mailto lines (You, Circle, Under-18) changed too.
   Resend still *sends* sign-in codes from `noreply@asstrollogs.com`; that is only a sending address.
3. **AI provider:** Gemini only (emci). emci unset `DEEPSEEK_API_KEY` (confirmed by emci at the start of step A5, 2026-10-23).
   The old `ai-generate` client path (and its DeepSeek fallback) was removed from the app in step A5; the only model
   path is `ai-library` (the AI-removal work is PR #84). The text is true both before and after #84: cards come from a
   shared library, some written ahead of time with Gemini, and a new one may be written on request while the writer is on.
4. **Gemini training:** the text states Google's terms for both plans (paid: not used to improve products; free: may be
   used and human-reviewed; both logged a limited time). Source: ai.google.dev/gemini-api/terms, updated 2026-04-28. If
   emci confirms the paid plan, the free-plan sentence can go.
5. **Retention:** account data until deletion; chat 30 days; read/do text 7 days; reports 2 years; deletion record 2 years;
   backups within 30 days (Supabase free plan has none, Pro 7, Enterprise 30); Resend 30 days; Sentry up to 90 days;
   ImprovMX logs 7 days. Reports / deletion record / leftover access requests are purged daily by `wave111_retention.sql`.
6. **Reports after deletion:** kept with ids cleared, 2 years. Review target 24 hours (Apple 1.2, matches the review notes).
7. **Access / correction requests:** email, answered within 30 days (PIPA / PIPEDA). Privacy contact: Michael Malig.
8. **Breach plan:** `docs/legal/breach-plan.md` (PIPA s.34.1).
9. **Governing law:** Alberta and Canadian federal law, Alberta courts, local consumer rights kept. No arbitration.
10. **Landing invite form:** removed (emci); stored requests deleted by wave111.
11. **Sign-up:** public, 18+; invite links kept as an optional record for abuse prevention.
12. **Kenney art:** still shipped (`assets/kenney`, `assets/play/kenney-icons`); CC0 credit kept.
13. **Public card:** stays as is and is disclosed ("no switch to hide this card yet"). A hide switch can come later.
14. **Encryption export:** settled from Apple + BIS, see `docs/app-store-pack.md` §9. `false` stays.
15. **Policy-change notice:** none for this first final version (earlier versions were drafts).
16. **Label categories:** `OtherUsageData` kept (folding it would need a native plist change).

## Still open (not blockers)

- **Gemini billing plan:** emci says he checked it (2026-10-23) but the result is not recorded here. If it is the paid
  plan, the free-plan sentence can go from both `landing/privacy.html` and `src/app/legal/privacy.md` (keep them in sync,
  `check:floor`). Only shortens one sentence.
- **Age-rating answers for 1.1:** `docs/app-store-pack.md` §2 and §9 (chat = Yes).
- **"Reset account"** is root-only; if it is ever offered to everyone, the policy must say what it keeps.
- **Hide-my-card switch** (item 13), later.
