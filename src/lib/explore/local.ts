import { TRAIT_POLE_LINES, traitBand, type TraitAxis } from '@/lib/traits';

import type { ExploreDraft, ExploreFocus, ExploreMeSlice } from './types';

function poleLine(me: ExploreMeSlice, axis: TraitAxis): string | null {
  const band = traitBand(me[axis]);
  if (band === 'high' || band === 'low') return TRAIT_POLE_LINES[axis][band];
  return null;
}

/**
 * Deterministic Explore copy when Gemini is unavailable. Hedge inside the
 * sentence. No completeness talk. No agency triple.
 */
export function composeLocalExplore(me: ExploreMeSlice, focus: ExploreFocus): ExploreDraft {
  const signal = focus.signal;
  const traits = focus.traits.slice(0, 3);
  const chipCue = me.morning_cue?.trim() || 'getting up';
  const focusChip = me.current_focus ?? 'show_up';

  let body: string;
  if (traits.length >= 2) {
    const a = poleLine(me, traits[0]!) ?? 'They tend to move a certain way.';
    const b = poleLine(me, traits[1]!) ?? 'Another pattern sits next to it.';
    const signalBit = signal
      ? signal.kind === 'check'
        ? 'A few skips this week sat next to that.'
        : signal.kind === 'knock'
          ? `${signal.detail} showed up in this week's Reads.`
          : `You told Sage something that's still around.`
      : '';
    body = `${signalBit} ${a.replace(/^They /, 'You ')} ${b.replace(/^They /, 'And you ')} Maybe those two are in the same week, not a type.`.replace(
      /\s+/g,
      ' ',
    ).trim();
  } else if (traits.length === 1) {
    const a = poleLine(me, traits[0]!) ?? 'A pattern is sitting there.';
    body = `${a.replace(/^They /, 'You ')} Noticing it next to ${chipCue} — maybe not a coincidence.`;
  } else {
    body = `After ${chipCue} is when the day starts, and what you're mostly trying to do right now is ${focusChip.replace(/_/g, ' ')}. Noticing that the same window is being asked to do both.`;
  }

  return {
    body,
    traits,
    chips: focus.chips,
    signalKind: signal?.kind ?? null,
  };
}
