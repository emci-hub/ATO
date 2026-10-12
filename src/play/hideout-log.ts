/**
 * Local Hideout event log helpers. The ring lives on the Play save
 * (`hideout.log`); this file only names kinds and formats lines for the
 * check / a future tuner. No Sentry, no network.
 */
import type { HideoutEvent, HideoutEventKind } from '@/play/hideout-progress';

export const HIDEOUT_LOG_KINDS: readonly HideoutEventKind[] = [
  'room_unlock_ready',
  'build_start',
  'speedup_applied',
  'build_done',
  'room_swipe',
  'call_used',
  'pet_asleep_tap',
];

export function hideoutLogLine(e: HideoutEvent): string {
  const room = e.room ? ` ${e.room}` : '';
  const n = e.n != null ? ` ${e.n}` : '';
  const src = e.source ? ` ${e.source}` : '';
  return `${e.kind}${room}${n}${src}`;
}
