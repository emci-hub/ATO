/**
 * Full Profile Depth: which capture mechanic a token spend fires.
 * EXTRA_AXES → gut-call (self_game). Everything else in TRAIT_AXES → ranking
 * pick (self_tap). Membership, not a frozen nine/six count.
 * IQ stays available via the intake sweep / Tell Sage more — not this spend.
 */
import { EXTRA_AXES, TRAIT_AXES, type TraitAxis } from '@/lib/traits';

export type DepthKind = 'ranking' | 'scenario';

export function depthKindFor(axis: TraitAxis): DepthKind {
  return (EXTRA_AXES as readonly string[]).includes(axis) ? 'scenario' : 'ranking';
}

export const DEPTH_AXES: readonly TraitAxis[] = TRAIT_AXES;
