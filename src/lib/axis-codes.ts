/**
 * Two-letter axis codes. Tap the code to reveal the full category name.
 * Never MBTI branding — these are internal shorthand for the 16 axes.
 */
import type { TraitAxis } from '@/lib/traits';

export const AXIS_CODES: Record<TraitAxis, string> = {
  openness: 'OP',
  conscientiousness: 'CO',
  extraversion: 'EX',
  agreeableness: 'AG',
  steadiness: 'ST',
  attachment_anxiety: 'AX',
  attachment_avoidance: 'AV',
  conflict_assertiveness: 'CA',
  conflict_cooperativeness: 'CC',
  autonomy: 'AU',
  competence: 'CM',
  relatedness: 'RE',
  growth_mindset: 'GM',
  locus_of_control: 'LC',
  self_efficacy: 'SE',
  playfulness: 'PL',
};

export const AXIS_CODE_ORDER = [
  'OP',
  'CO',
  'EX',
  'AG',
  'ST',
  'AX',
  'AV',
  'CA',
  'CC',
  'AU',
  'CM',
  'RE',
  'GM',
  'LC',
  'SE',
  'PL',
] as const;

export type AxisCode = (typeof AXIS_CODE_ORDER)[number];

export function codeForAxis(axis: TraitAxis): AxisCode {
  return AXIS_CODES[axis] as AxisCode;
}

export function axisForCode(code: string): TraitAxis | null {
  const needle = code.trim().toUpperCase();
  for (const [axis, value] of Object.entries(AXIS_CODES) as Array<[TraitAxis, string]>) {
    if (value === needle) return axis;
  }
  return null;
}
