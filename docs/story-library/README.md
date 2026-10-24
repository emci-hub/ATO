# Story Library and Trait Bank

Design for taking runtime AI text out of ATO and Divecore. An admin authors a library offline. The app only fills slots. Nothing here is wired into the app.

Read in this order:

1. [AUDIT.md](AUDIT.md) — every runtime model path, and the banks that already exist.
2. [DESIGN.md](DESIGN.md) — templates, typed slots, the trait bank, branching endings.
3. [GUARDRAILS.md](GUARDRAILS.md) — why a combo cannot drift into nonsense.
4. [STYLE.md](STYLE.md) — the frozen style guide and the admin-only prompt.
5. [MIGRATION.md](MIGRATION.md) — what to switch, in impact order, and what the admin screen needs.
6. [prototype/](prototype/) — a working filler, a sample library, and the 360-render test.

Run the prototype:

```bash
npx tsx docs/story-library/prototype/render-matrix.ts
```

It writes [prototype/sample-output.md](prototype/sample-output.md) and exits non-zero if any render fails. The current run is 360 renders, 0 failures.

This is a draft. It does not change production code, the live AI functions, or the save format.
