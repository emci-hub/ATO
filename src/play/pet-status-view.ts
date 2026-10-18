/**
 * Pet status badge data, one shape for every screen (pet team roadmap P2, emci 2026-10-18).
 *
 * (Not `pet-status.ts`: that file is the care status, hungry / sleepy / happy.) This is the HERO status: its
 * STARS (one per copy, max 5), its GRADE and its SHINY mark. The Den card, the Hideout name tag and (later)
 * the Turf picker all read `petStatusView` and draw it with `PetStatusBadge` (`pet-status-badge.tsx`), so the
 * same pet never looks different in two places. The grade is never colour alone: the word rides with the
 * frame. The 3★ dye rule lives in `pet-eggs.ts` (`DYE_STARS`) and is untouched.
 */
import { GRADE_COLOR, GRADE_LABEL, STAR_MAX, heroStars, type Grade } from './pet-eggs';

export interface PetStatusView {
  /** Filled stars (0–5) = the hero's copies. */
  stars: number;
  starMax: number;
  /** '★★★☆☆': always `starMax` glyphs, so the row never changes width. */
  starText: string;
  grade: Grade;
  gradeLabel: string;
  /** Frame + star colour. */
  color: string;
  shiny: boolean;
  /** Screen-reader text: "Epic, 3 of 5 stars, shiny". */
  label: string;
}

/** `null` while the pet has no grade yet (egg / baby / unrevealed): nothing to show. */
export function petStatusView(input: { grade: Grade | null; copies: number; shiny: boolean }): PetStatusView | null {
  if (!input.grade) return null;
  const stars = heroStars(input.copies);
  return {
    stars,
    starMax: STAR_MAX,
    starText: '★'.repeat(stars) + '☆'.repeat(STAR_MAX - stars),
    grade: input.grade,
    gradeLabel: GRADE_LABEL[input.grade],
    color: GRADE_COLOR[input.grade],
    shiny: input.shiny,
    label: `${GRADE_LABEL[input.grade]}, ${stars} of ${STAR_MAX} stars${input.shiny ? ', shiny' : ''}`,
  };
}
