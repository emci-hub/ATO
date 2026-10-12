/**
 * Pet presence across Hideout rooms: priority, schedule, Call, tap-to-wake.
 *
 * Schedule is local time, recomputed every call — safe across TZ/DST. It
 * never pays out. Peekaboo is once per counted tend/play day (caller stamps
 * `peekaboo_ymd`). Egg and baby skip the schedule and stay in the Hideout.
 *
 * Priority (top wins):
 *   1. interaction (sheet, mini-game, touch, Dive)
 *   2. expedition-away
 *   3. needs (hungry → Hideout bowl; tired → Loft bed if unlocked)
 *   4. Call (stay put for 10 counted minutes)
 *   5. schedule
 */
import { isBedtime, type DayWindow } from '@/play/play-settings';
import { PET_STAGES, type PetState } from '@/play/pet';
import {
  HIDEOUT_CALL_STAY_MS,
  HIDEOUT_WAKE_MS,
  type HideoutRoomId,
  type HideoutState,
} from '@/play/hideout-progress';

export type PresenceReason =
  | 'interaction'
  | 'expedition'
  | 'hungry'
  | 'tired'
  | 'call'
  | 'schedule'
  | 'home';

export type Presence = {
  room: HideoutRoomId;
  reason: PresenceReason;
  /** Sleep pose in this room (bed top in the Loft). */
  asleep: boolean;
  /** Hungry walk-to-bowl in the Hideout. */
  hungry: boolean;
  /** Peekaboo pose (once per counted day, Hideout). */
  peekaboo: boolean;
  /** Expedition-away: empty bed/bowl + travel tag. */
  away: boolean;
};

export type PresenceInput = {
  pet: PetState;
  hideout: HideoutState;
  /** Sheet open, mini-game, touch in progress, or Dive underway. */
  interaction: boolean;
  expeditionAway: boolean;
  bedtime: DayWindow;
  now: Date;
  /** Counted local day stamp (YYYY-MM-DD) for peekaboo. */
  todayYmd: string;
};

function unlocked(h: HideoutState, id: HideoutRoomId): boolean {
  return h.rooms_unlocked[id] === true;
}

function skipSchedule(pet: PetState): boolean {
  return PET_STAGES.indexOf(pet.stage) < PET_STAGES.indexOf('child');
}

export function wokeUp(h: HideoutState, pet: PetState): boolean {
  return h.wake_until_age_ms != null && pet.total_age_ms < h.wake_until_age_ms;
}

export function callActive(h: HideoutState, pet: PetState): boolean {
  return h.call_until_age_ms != null && pet.total_age_ms < h.call_until_age_ms;
}

/**
 * Cosmetic schedule from local time. Never grants tokens or care.
 *   sleep window → Loft bed if unlocked, else Hideout cushion
 *   07–10 → Hideout (bowl)
 *   10–14 → Hideout
 *   14–17 → Loft if unlocked
 *   17–19 → Hideout peekaboo (once per counted day)
 *   19–sleep → Hideout
 */
export function scheduleRoom(
  h: HideoutState,
  bedtime: DayWindow,
  now: Date,
  peekabooToday: boolean,
): { room: HideoutRoomId; peekaboo: boolean; asleep: boolean } {
  if (isBedtime(now, bedtime)) {
    return { room: unlocked(h, 'loft') ? 'loft' : 'hideout', peekaboo: false, asleep: true };
  }
  const hour = now.getHours();
  if (hour >= 7 && hour < 10) return { room: 'hideout', peekaboo: false, asleep: false };
  if (hour >= 14 && hour < 17 && unlocked(h, 'loft')) return { room: 'loft', peekaboo: false, asleep: false };
  if (hour >= 17 && hour < 19 && !peekabooToday) return { room: 'hideout', peekaboo: true, asleep: false };
  return { room: 'hideout', peekaboo: false, asleep: false };
}

export function resolvePresence(input: PresenceInput): Presence {
  const { pet, hideout: h, interaction, expeditionAway } = input;
  const home: Presence = {
    room: 'hideout',
    reason: 'home',
    asleep: false,
    hungry: false,
    peekaboo: false,
    away: false,
  };
  if (interaction) {
    return { ...home, room: h.viewed_room, reason: 'interaction', asleep: false };
  }
  if (expeditionAway) {
    return { ...home, room: h.viewed_room, reason: 'expedition', away: true };
  }
  if (skipSchedule(pet)) {
    return { ...home, reason: 'home' };
  }
  const hungry = pet.hunger <= 1;
  if (hungry) {
    return { ...home, room: 'hideout', reason: 'hungry', hungry: true };
  }
  const tired = pet.mood <= 1 && unlocked(h, 'loft') && !wokeUp(h, pet);
  if (tired) {
    return { ...home, room: 'loft', reason: 'tired', asleep: true };
  }
  if (callActive(h, pet)) {
    return { ...home, room: h.viewed_room, reason: 'call' };
  }
  const peekDone = h.peekaboo_ymd === input.todayYmd;
  const night = isBedtime(input.now, input.bedtime) && !wokeUp(h, pet);
  const sched = scheduleRoom(h, input.bedtime, input.now, peekDone);
  return {
    room: sched.room,
    reason: 'schedule',
    asleep: night || sched.asleep,
    hungry: false,
    peekaboo: sched.peekaboo,
    away: false,
  };
}

export function startCall(h: HideoutState, pet: PetState, room: HideoutRoomId): HideoutState {
  return {
    ...h,
    viewed_room: room,
    call_until_age_ms: pet.total_age_ms + HIDEOUT_CALL_STAY_MS,
  };
}

export function tapWake(h: HideoutState, pet: PetState): HideoutState {
  return {
    ...h,
    wake_until_age_ms: pet.total_age_ms + HIDEOUT_WAKE_MS,
  };
}

export function stampPeekaboo(h: HideoutState, today: string): HideoutState {
  return { ...h, peekaboo_ymd: today };
}

/** Call copy while the pet is on an Expedition. */
export function expeditionCallCopy(backMs: number): string {
  const mins = Math.max(1, Math.ceil(backMs / 60_000));
  return `Out on a trip, back in ${mins}m`;
}
