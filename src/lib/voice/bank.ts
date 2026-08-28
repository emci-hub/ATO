import { bankStyleFor } from '@/lib/intake';

import { cueAfterYou } from './cue';
import { BANK_MARKDOWN } from './content.generated';
import type { TalkStyle, VoiceCard, VoiceMe } from './types';

/** bank[day][style] → card copy, still containing {morning_cue}. */
export type Bank = Record<number, Partial<Record<TalkStyle, VoiceCard>>>;

export function parseBank(markdown: string): Bank {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const bank: Bank = {};

  const dayParts = normalized.split(/^## Day (\d+)\s*$/m);
  // dayParts[0] is the preamble; then day-number, body, day-number, body, ...
  for (let i = 1; i + 1 < dayParts.length; i += 2) {
    const day = Number(dayParts[i]);
    const body = dayParts[i + 1] ?? '';
    const styles: Partial<Record<TalkStyle, VoiceCard>> = {};

    const styleParts = body.split(/^### (quiet|even|loud)\s*$/m);
    for (let j = 1; j + 1 < styleParts.length; j += 2) {
      const style = styleParts[j] as TalkStyle;
      const text = styleParts[j + 1] ?? '';
      const read = text.match(/^Read:\s*(.+)$/m)?.[1]?.trim();
      const doText = text.match(/^Do:\s*(.+)$/m)?.[1]?.trim();
      if (read && doText) styles[style] = { read, do: doText };
    }

    bank[day] = styles;
  }

  return bank;
}

export const BANK: Bank = parseBank(BANK_MARKDOWN);

function substituteCue(text: string, morningCue: string): string {
  return text.split('{morning_cue}').join(cueAfterYou(morningCue));
}

/** Pulls the bank card for a day+style with {morning_cue} substituted. */
export function bankCard(day: number, style: TalkStyle, morningCue: string): VoiceCard | null {
  const card = BANK[day]?.[style];
  if (!card) return null;
  return {
    read: substituteCue(card.read, morningCue),
    do: substituteCue(card.do, morningCue),
  };
}

/**
 * check_count < 3: pick a first_cards.md slot from energy_pattern/support_style
 * (falling back to talk_style) and insert the person's own morning_cue phrase.
 * No model call.
 */
export function bankCardForMe(day: number, me: VoiceMe): VoiceCard | null {
  return bankCard(day, bankStyleFor(me), me.morning_cue);
}
