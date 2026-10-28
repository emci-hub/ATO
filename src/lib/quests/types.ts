import type { TraitAxis } from '@/lib/traits';

/**
 * Quests content model (ATO-BUILD PHASE-12). Pure types: no copy, no I/O.
 * A choice nudges a trait only through `tags`; the player sees `approach`
 * (an icon), never the trait.
 */

/** Axes a Quest may tag. Excluded on purpose: attachment_*, steadiness, competence, relatedness, growth_mindset. */
export const QUEST_AXES = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'conflict_assertiveness',
  'conflict_cooperativeness',
  'autonomy',
  'playfulness',
  'self_efficacy',
  'locus_of_control',
] as const satisfies readonly TraitAxis[];

export const EXCLUDED_QUEST_AXES = [
  'attachment_anxiety',
  'attachment_avoidance',
  'steadiness',
  'competence',
  'relatedness',
  'growth_mindset',
] as const satisfies readonly TraitAxis[];

export type AxisTag = { axis: TraitAxis; pole: 1 | -1; w: 1 | 0.4 };

export const STATS = ['supplies', 'morale', 'renown'] as const;
export type Stat = (typeof STATS)[number];
export type StatDelta = Partial<Record<Stat, -2 | -1 | 1 | 2>>;

export const APPROACHES = ['explore', 'steady', 'talk', 'act', 'wait'] as const;
export type Approach = (typeof APPROACHES)[number];

export interface StoryLine {
  kind: 'narrator' | 'dialogue' | 'inner';
  speaker?: string;
  text: string;
  /** 1-2 words per beat that get tinted. */
  keywords?: string[];
}

export interface QuestCheck {
  stat: Stat;
  /** d20 + stat >= dc */
  dc: number;
  /** Scene id on success. */
  success: string;
  /** Scene id on failure: a different story, never a dead end. */
  fail: string;
}

export interface QuestChoice {
  id: string;
  /** First person, 60 chars or fewer. */
  label: string;
  approach: Approach;
  /** Short cost note such as "costs supplies". */
  hint?: string;
  result: StoryLine[];
  /** 0-2 trait tags. */
  tags: AxisTag[];
  stats?: StatDelta;
  setFlags?: string[];
  /** Scene id to go to; omitted = the scene's own `next`. */
  next?: string;
  check?: QuestCheck;
}

export interface FlagGate {
  flags?: string[];
  notFlags?: string[];
}

export interface QuestScene {
  id: string;
  chapter: 1 | 2 | 3 | 4;
  /** The axis this scene mainly measures; it must offer both poles. */
  primaryAxis?: TraitAxis;
  /** Entry gate (secret scene). Unmet = the scene is skipped to `next`. */
  requires?: FlagGate;
  variants?: { requires: FlagGate; lines: StoryLine[] }[];
  lines: StoryLine[];
  /** 2-4 choices. */
  choices: QuestChoice[];
  /** Default way on; null = the story ends here. */
  next: string | null;
  art: { location: string; props?: { id: string; x: number }[]; tint?: string; cast?: string[] };
  /** Retired scenes keep their id forever and send players to `redirect`. */
  retired?: true;
  redirect?: string;
}

export interface QuestEnding {
  id: string;
  title: string;
  when: FlagGate & { minStat?: Partial<Record<Stat, number>> };
  lines: StoryLine[];
  art: string;
}

export interface QuestCampaign {
  id: string;
  title: string;
  setting: 'fantasy' | 'city';
  minutes: number;
  contentVersion: number;
  /** Scene ids that must always exist (saves point at them). */
  sceneIdsFrozen: string[];
  /** 3-4 axes. */
  targetAxes: TraitAxis[];
  /** Each 0-6. */
  startStats: Record<Stat, number>;
  firstScene: string;
  scenes: QuestScene[];
  /** 3-4 endings; the first match wins and the last is the fallback. */
  endings: QuestEnding[];
  isSample?: true;
}

export interface QuestState {
  stats: Record<Stat, number>;
  flags: string[];
  sceneId: string;
  chapter: 1 | 2 | 3 | 4;
}
