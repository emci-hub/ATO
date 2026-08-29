import { TRAIT_AXES } from '@/lib/traits';
import { selectLibraryEntries, type SelectLibraryOpts } from '@/lib/voice/library';
import type { VoiceMe } from '@/lib/voice/types';

export type DevTraceSurface = 'sage' | 'explore' | 'dawn';

export interface DevTraceSession {
  active: boolean;
  expiresAt: string | null;
  remaining: number;
}

export interface DevTraceEvent {
  id: string;
  createdAt: string;
  surface: DevTraceSurface;
  libraryLines: unknown;
  traitSignals: unknown;
  rawBefore: string | null;
  rawAfter: string | null;
  guardFired: string | null;
}

export interface DevTraceRecordInput {
  surface: DevTraceSurface;
  libraryLines: unknown;
  traitSignals: unknown;
  rawBefore: string | null;
  rawAfter: string | null;
  guardFired: string | null;
}

export function traitSignalsFromMe(me: VoiceMe): Record<string, number> {
  const out: Record<string, number> = {};
  for (const axis of TRAIT_AXES) {
    const value = me[axis];
    if (typeof value === 'number') out[axis] = value;
  }
  return out;
}

export function libraryLinesFor(me: VoiceMe, opts: SelectLibraryOpts): Array<{ id: string; paraphrases: string[] }> {
  return selectLibraryEntries(me, opts).map((entry) => ({
    id: entry.id,
    paraphrases: entry.paraphrases,
  }));
}
