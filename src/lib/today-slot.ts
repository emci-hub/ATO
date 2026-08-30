/**
 * Pure resolver for the single slot below Home's Today card.
 * First match wins. `{ kind: 'none' }` means render nothing — never a filler.
 */

export type TodaySlot =
  | { kind: 'crisis' }
  | { kind: 'missed_check' }
  | { kind: 'note' }
  | { kind: 'ask' }
  | { kind: 'week' }
  | { kind: 'none' };

export type TodaySlotInput = {
  crisisActive: boolean;
  missedCheck: boolean;
  noteAvailable: boolean;
  noteOpenedToday: boolean;
  askPending: boolean;
  isSunday: boolean;
};

export function resolveTodaySlot(input: TodaySlotInput): TodaySlot {
  if (input.crisisActive) return { kind: 'crisis' };
  if (input.missedCheck) return { kind: 'missed_check' };
  if (input.noteAvailable && !input.noteOpenedToday) return { kind: 'note' };
  if (input.askPending) return { kind: 'ask' };
  if (input.isSunday) return { kind: 'week' };
  return { kind: 'none' };
}
