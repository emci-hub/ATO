# Copy review log

`npm run copy:review` appends a section here when it rewrites a player-facing line. Each rewrite is the old line, the new line, and the reason.

A run with no `GEMINI_API_KEY` and no `DEEPSEEK_API_KEY` does not write here. It warns and leaves the source alone, so a build is not blocked. The voice guide is the rubric. `check:player-copy` and `check:story-library` still run after any rewrite.
