/**
 * Full Profile Depth: which capture mechanic a token spend fires.
 * Extra six → gut-call (self_game). First nine → forced ranking pick (self_tap).
 * IQ stays available via the intake sweep / Tell Sage more — not this spend.
 */
import { EXTRA_AXES, type TraitAxis } from '@/lib/traits';

export type DepthKind = 'ranking' | 'scenario';

export function depthKindFor(axis: TraitAxis): DepthKind {
  return (EXTRA_AXES as readonly string[]).includes(axis) ? 'scenario' : 'ranking';
}

export const DEPTH_AXES: readonly TraitAxis[] = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'steadiness',
  'attachment_anxiety',
  'attachment_avoidance',
  'conflict_assertiveness',
  'conflict_cooperativeness',
  'autonomy',
  'competence',
  'relatedness',
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
];
