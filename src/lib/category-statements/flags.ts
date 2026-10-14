/**
 * The category-statements review flag, on its own so a push or a screen can
 * read it without pulling the AI generator (and the model client) into its
 * import graph. `generate-statements.ts` re-exports it unchanged.
 */
export const CATEGORY_STATEMENTS_COPY_REVIEWED = false;
