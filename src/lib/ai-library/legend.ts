/**
 * Shared library — Legends AI cards (wave93).
 *
 * Bucket: the legend + the angle + the moment the card leads with + the
 * reader's matched sides (in order, "!" = a contrast pair) + the side the
 * legend doesn't share. Everything the prompt needs comes from the
 * hand-written legend entry, so the server rebuilds it from the key alone.
 * "Matched on" stays worked out on the reader's own phone.
 */
import { legendById } from '@/lib/legend-figures/roster';
import {
  STORY_MAX_PAIRS,
  buildLegendPrompt,
  parseLegendStoryResult,
  parseStoredLegendStory,
  shownMoments,
  type LegendDiffer,
  type LegendPair,
  type LegendStory,
} from '@/lib/legend-figures/story';
import type { LegendAngle, LegendFigure } from '@/lib/legend-figures/types';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';
import { cardJokeStyle } from '@/lib/voice/card-joke';

import type { LibraryKindSpec, LibraryParse } from './types';

export interface LegendBucket {
  key: string;
  legend: LegendFigure;
  angle: LegendAngle;
  momentId: string;
  pairs: LegendPair[];
  differ: LegendDiffer | null;
}

const side = (lean: TraitLean) => (lean === 'high' ? 'h' : 'l');

/** The reader's bucket for one reveal (pairs and differ exactly as the screen built them). */
export function legendBucketKey(input: {
  legend: LegendFigure;
  angle: LegendAngle;
  momentId: string;
  pairs: readonly LegendPair[];
  differ: LegendDiffer | null;
}): string {
  const pairs = input.pairs.map((p) => `${p.axis}.${side(p.lean)}${p.contrast ? '!' : ''}`).join(',');
  const differ = input.differ ? `${input.differ.axis}.${side(input.differ.lean)}` : '-';
  return `lg|${input.legend.id}|${input.angle.id}|${input.momentId}|p:${pairs}|d:${differ}`;
}

function readSide(part: string): { axis: TraitAxis; lean: TraitLean; contrast: boolean } | null {
  const m = /^([a-z_]+)\.([hl])(!?)$/.exec(part);
  if (!m || !(TRAIT_AXES as readonly string[]).includes(m[1]!)) return null;
  return { axis: m[1] as TraitAxis, lean: m[2] === 'h' ? 'high' : 'low', contrast: m[3] === '!' };
}

export function parseLegendBucket(key: string): LegendBucket | null {
  const m = /^lg\|(lf_[a-z0-9_]{2,40})\|(a[1-6])\|(m[1-3])\|p:([a-z_.!,]{3,120})\|d:([a-z_.]{1,40}|-)$/.exec(key);
  if (!m) return null;
  const legend = legendById(m[1]!);
  if (!legend) return null;
  const angle = legend.angles.find((row) => row.id === m[2]);
  if (!angle) return null;
  if (!shownMoments(legend).some((row) => row.id === m[3])) return null;

  const pairs: LegendPair[] = [];
  for (const part of m[4]!.split(',')) {
    const row = readSide(part);
    if (!row || pairs.some((p) => p.axis === row.axis)) return null;
    // A contrast pair is the legend's first tag (legendPairs); a match is the same side's tag.
    const tag = row.contrast ? legend.tags[0] : legend.tags.find((t) => t.axis === row.axis && t.lean === row.lean);
    if (!tag) return null;
    pairs.push({ axis: row.axis, lean: row.lean, strength: 0, tag, contrast: row.contrast });
  }
  if (pairs.length === 0 || pairs.length > STORY_MAX_PAIRS) return null;
  if (pairs.some((p) => p.contrast) && pairs.length !== 1) return null;

  let differ: LegendDiffer | null = null;
  if (m[5] !== '-') {
    const row = readSide(m[5]!);
    if (!row || row.contrast || pairs.some((p) => p.axis === row.axis)) return null;
    // Never a side the legend shares (legendDiffer: an opposite tag, or a trait the label never shows).
    if (legend.tags.some((t) => t.axis === row.axis && t.lean === row.lean)) return null;
    differ = { axis: row.axis, lean: row.lean, tag: legend.tags.find((t) => t.axis === row.axis && t.lean !== row.lean) ?? null };
  }
  return { key, legend, angle, momentId: m[3]!, pairs, differ };
}

function ctx(bucket: LegendBucket) {
  return {
    legend: bucket.legend,
    angle: bucket.angle,
    momentId: bucket.momentId,
    pairs: bucket.pairs,
    differ: bucket.differ,
    // Seeded by the bucket, never the person: the card is shared.
    jokeStyle: cardJokeStyle(bucket.key),
  };
}

export const LEGEND_LIBRARY: LibraryKindSpec<LegendBucket, LegendStory> = {
  kind: 'legend',
  parseBucket: parseLegendBucket,
  // The angle is already in the bucket: one shape per bucket, several cards over time.
  angles: () => ['x'],
  cardsPerCall: 1,
  buildPrompt(bucket) {
    const c = ctx(bucket);
    return {
      prompt: buildLegendPrompt({ ...c, focusMomentId: c.momentId }),
      maxOutputTokens: 600,
    };
  },
  parse(raw, bucket): LibraryParse<LegendStory> {
    const res = parseLegendStoryResult(raw, ctx(bucket));
    return res.story ? { cards: [{ angle: 'x', card: res.story }], reason: null } : { cards: [], reason: res.reason ?? 'no card' };
  },
  readCard(raw) {
    const story = parseStoredLegendStory(raw);
    return story && story.source === 'ai' ? story : null;
  },
};
