/**
 * Small builders so each roster file reads like a museum label, not like
 * plumbing. `verified` is true only when every `check` phrase was found in the
 * downloaded source text (batch check, 2026-10-08); `unverified(...)` marks a
 * point that could not be confirmed — the app never shows it or sends it to AI.
 */
import type { TraitAxis, TraitLean } from '@/lib/traits';

import type { LegendAngle, LegendFact, LegendMoment, LegendSource, LegendTag } from '../types';

/** English Wikipedia page URL for a page title (spaces as underscores). */
export function wiki(page: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURI(page)}`;
}

export function src(url: string, ...check: string[]): LegendSource {
  return { url, check, verified: true };
}

export function unverified(url: string, ...check: string[]): LegendSource {
  return { url, check, verified: false };
}

export function fact(id: string, text: string, source: LegendSource): LegendFact {
  return { id, text, source };
}

export function moment(id: string, text: string, source: LegendSource): LegendMoment {
  return { id, text, source };
}

export function angle(id: string, name: string, teaser: string, meaning: string): LegendAngle {
  return { id, name, teaser, meaning };
}

export function tag(axis: TraitAxis, lean: TraitLean, them: string, why: string): LegendTag {
  return { axis, lean, them, why };
}
