# Step 4 read list: what emci must actually read (2026-10-20)

Only copy a launch surface shows. Everything else was reviewed under the core content policy (`docs/copy-review-rules.md`) and
is KEEP unless a specific problem is named. Flags stay false until emci approves a set; false does NOT hide a surface (no draft
badge), so approving a set is a statement that the copy is fine to ship, not a switch.

| Surface (flag) | Items | Read | Where |
|---|---|---|---|
| Daily insight tips (INSIGHT_BANK) | 208 | a sample of ~10; 0 unresolved | `docs/insight-bank-review.md`, `applied-set6` |
| Explore category cards (CATEGORY_BANK) | 37 | a sample of ~5; 0 unresolved | `docs/category-bank-review.md`, `applied-set5` |
| Today's Pick (DAILY_PICK) | 64 | 3 prompts: p14, p25, p50 (wave99c not applied) | `applied-set1-small.md` |
| Questions (BANK) | 400 | 3 notes: D1 retired read-only?, D2 houseguest, curly-quote style | `applied-set2-questions.md` |
| Legends (LEGEND_FIGURES) | 120 | U1–U4 (U5 is the lead's) | `applied-set8-legends.md` |
| Story (STORY, STORY_BANK) | 66 | 3 items: failure message, reference edits, "You scored …" fallback | `applied-set9-10` |
| Deep dive (CATEGORY_DEEP_DIVE) | prompt | the rewritten prompt wording (no gentle block, framework names allowed if explained) | `docs/category-deep-dive-review.md` |
| STAGED_INTAKE, POLISH, PROFILE_CARD, TEAM | strings | short read of the strings in the files named in the master plan; no review docs | see master plan Ledger B |

Dead flags, not shown anywhere, skip: TITLE, CATEGORY_READ, DAILY_INSIGHT, CATEGORY_STATEMENTS.

Filter behavior was verified with real pass/fail examples (`check:filter-behavior`, `check:label-context`,
`check:framework-fence`, `check:style-rules`), not trusted by name.
