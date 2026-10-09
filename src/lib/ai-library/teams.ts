/**
 * Deep-dive teams (emci 2026-10-09): everyone in the same deep-dive group is on
 * the same team, so friends can ask "which team are you on?".
 *
 * A team is built from the reader's sides in that category: each trait gives
 * one short everyday phrase and one mini icon (the same phrase and icon for
 * that side in EVERY category, so "same icons, same team" is easy to spot),
 * and each category has its own ending (Club, Era, Energy…).
 *   Your Social Battery, Reserved + Frank + Playful → "Night-In Hot-Take Chaos Club"
 *
 * Rules: everyday modern phrases, not slang (the moment voice); a quieter side
 * gets an image with an upside, never a flaw; no pole or test words. No team
 * for "How You Love" (closeness habits are too personal to show by accident).
 * Hidden by default: the card shows one plain team icon, the reader taps for
 * the description and chooses to show the icons. Pure, no I/O.
 *
 * 42 phrases (14 traits × 3 sides; the two closeness traits only live in
 * "How You Love") + 10 endings. Draft copy, waiting on emci's read: TEAM_COPY_REVIEWED = false, review doc
 * docs/team-names-review.md. Pinned by check:ai-library (every team unique,
 * names stable).
 */
import { AXIS_POLE_NAME } from '@/lib/axis-poles';
import { categoryById } from '@/lib/categories';
import type { TraitAxis } from '@/lib/traits';

import { parseDiveBucket, type DiveAxisState } from './deep-dive';

export const TEAM_COPY_REVIEWED = false;

export interface TeamSide {
  phrase: string;
  /** A MaterialCommunityIcons name (the icon set the app already ships). */
  icon: string;
}

type Sides = Record<DiveAxisState, TeamSide>;

/** h = leans to the high side, m = in the middle, l = leans to the low side. */
export const TEAM_SIDES: Partial<Record<TraitAxis, Sides>> = {
  openness: {
    h: { phrase: 'Side-Quest', icon: 'compass-outline' },
    m: { phrase: 'Try-Once', icon: 'directions-fork' },
    l: { phrase: 'Usual-Order', icon: 'home-heart' },
  },
  conscientiousness: {
    h: { phrase: 'Color-Coded', icon: 'calendar-check' },
    m: { phrase: 'Loose-Plan', icon: 'pencil-ruler' },
    l: { phrase: 'Wing-It', icon: 'run-fast' },
  },
  extraversion: {
    h: { phrase: 'Plus-One', icon: 'account-multiple-plus' },
    m: { phrase: 'Maybe-Later', icon: 'clock-outline' },
    l: { phrase: 'Night-In', icon: 'sofa-outline' },
  },
  agreeableness: {
    h: { phrase: 'Whatever-Works', icon: 'thumb-up-outline' },
    m: { phrase: 'It-Depends', icon: 'scale-balance' },
    l: { phrase: 'Hot-Take', icon: 'fire' },
  },
  steadiness: {
    h: { phrase: 'Unbothered', icon: 'shield-check-outline' },
    m: { phrase: 'Mostly-Chill', icon: 'weather-partly-cloudy' },
    l: { phrase: 'Feels-It-All', icon: 'water-outline' },
  },
  conflict_assertiveness: {
    h: { phrase: 'Says-It', icon: 'bullhorn-outline' },
    m: { phrase: 'Picks-Battles', icon: 'message-text-outline' },
    l: { phrase: 'Soft-Spoken', icon: 'feather' },
  },
  conflict_cooperativeness: {
    h: { phrase: 'Meet-Halfway', icon: 'handshake-outline' },
    m: { phrase: 'Give-and-Take', icon: 'account-switch-outline' },
    l: { phrase: 'Holds-Ground', icon: 'pillar' },
  },
  autonomy: {
    h: { phrase: 'Own-Lane', icon: 'steering' },
    m: { phrase: 'Co-Pilot', icon: 'map-marker-path' },
    l: { phrase: 'Group-Plan', icon: 'account-group' },
  },
  competence: {
    h: { phrase: 'Got-This', icon: 'trophy-outline' },
    m: { phrase: 'Figuring-It-Out', icon: 'magnify' },
    l: { phrase: 'Double-Check', icon: 'binoculars' },
  },
  relatedness: {
    h: { phrase: 'Group-Chat', icon: 'account-heart-outline' },
    m: { phrase: 'Inner-Circle', icon: 'account-group-outline' },
    l: { phrase: 'Solo-Mode', icon: 'island' },
  },
  growth_mindset: {
    h: { phrase: 'Level-Up', icon: 'sprout-outline' },
    m: { phrase: 'Learn-As-I-Go', icon: 'seed-outline' },
    l: { phrase: 'Tried-and-True', icon: 'bookshelf' },
  },
  locus_of_control: {
    h: { phrase: 'My-Call', icon: 'ship-wheel' },
    m: { phrase: 'Steer-Some', icon: 'sail-boat' },
    l: { phrase: 'Go-With-the-Flow', icon: 'waves' },
  },
  self_efficacy: {
    h: { phrase: 'Go-For-It', icon: 'rocket-launch-outline' },
    m: { phrase: 'Test-Run', icon: 'airplane-takeoff' },
    l: { phrase: 'Small-Steps', icon: 'shoe-print' },
  },
  playfulness: {
    h: { phrase: 'Chaos', icon: 'party-popper' },
    m: { phrase: 'Low-Key', icon: 'headphones' },
    l: { phrase: 'Deadpan', icon: 'emoticon-neutral-outline' },
  },
};

/** Each category's own ending. "How You Love" has none: no team there. */
export const TEAM_ENDINGS: Readonly<Record<string, string>> = {
  cat_steadiness: 'Energy',
  cat_openness: 'Squad',
  cat_drive: 'Crew',
  cat_agency: 'Society',
  cat_social: 'Club',
  cat_communication: 'Collective',
  cat_independence: 'Alliance',
  cat_levity: 'Department',
  cat_structure: 'Era',
  cat_resilience: 'League',
};

/** The plain icon shown while the team is hidden. */
export const TEAM_HIDDEN_ICON = 'shield-outline';

export interface TeamWhy {
  axis: TraitAxis;
  icon: string;
  phrase: string;
  /** "you lean Reserved" / "you’re in the middle". */
  line: string;
}

export interface Team {
  bucket: string;
  name: string;
  icons: string[];
  why: TeamWhy[];
}

/** The team for a deep-dive bucket key (from `diveBucketKey`), or null (no team here). */
export function teamForBucket(bucket: string): Team | null {
  const parsed = parseDiveBucket(bucket);
  if (!parsed) return null;
  const ending = TEAM_ENDINGS[parsed.categoryId];
  if (!ending) return null;
  const def = categoryById(parsed.categoryId);
  if (!def) return null;
  // The category's own trait order (its formula), not the bucket's sort order.
  const order = def.axes.map((axis) => parsed.states.find((row) => row.axis === axis)).filter((row) => row != null);
  const why: TeamWhy[] = [];
  for (const row of order) {
    const side = TEAM_SIDES[row.axis]?.[row.state];
    if (!side) return null;
    why.push({
      axis: row.axis,
      icon: side.icon,
      phrase: side.phrase,
      line:
        row.state === 'm'
          ? 'you’re in the middle'
          : `you lean ${AXIS_POLE_NAME[row.axis][row.state === 'h' ? 'high' : 'low']}`,
    });
  }
  return {
    bucket,
    name: `${why.map((row) => row.phrase).join(' ')} ${ending}`,
    icons: why.map((row) => row.icon),
    why,
  };
}

/** "You moved from Night-In Hot-Take Chaos Club to Plus-One Hot-Take Chaos Club." */
export function teamMovedLine(from: Team | null, to: Team | null): string | null {
  if (!from || !to || from.name === to.name) return null;
  return `You moved from ${from.name} to ${to.name}.`;
}

/** The screen-reader version of the icon row. */
export function teamA11y(team: Team): string {
  return `${team.name}: ${team.why.map((row) => `${row.phrase}, ${row.line}`).join('; ')}`;
}
