/**
 * Divecore notices (v24, 2026-09-30) — WHAT to schedule and WHEN, as pure
 * data; `pet-reminder.ts` does the scheduling (expo-notifications, no new
 * packages). Four kinds, one toggle each (Divecore Settings):
 *
 *   hunger      when hunger runs out, at most one per 20h (as before);
 *   egg         the next hatch or Child reveal;
 *   expedition  when the pet is back from its expedition;
 *   charges     all charges full again — only after every charge was spent
 *               (0 → full), at most once per 6h, off by default.
 *
 * Anything landing inside quiet hours waits until they end. The pet's name
 * (or the hero's) is used in the text.
 */
import { EXPEDITION_NOTICE_MIN_MS } from './expedition-ladder';
import { PET_STAGE_MS, petReminderTarget, type PetState } from './pet';
import { chargesNoticeAt, deferForQuiet, type NotifKind, type PlaySettings } from './play-settings';

export type PlannedNotice = { kind: NotifKind; at: number; title: string; body: string };

export type NoticeInput = {
  settings: PlaySettings;
  pet: PetState;
  /** Shown name ("Kiki", "Raven", or "Your egg"). */
  name: string;
  /** Counted time until the expedition is back (null = not away). */
  expeditionBackInMs: number | null;
  /** v25 — the current trip's length (a phone notice only from 30 min). */
  expeditionTripMs: number | null;
  chargesFullAt: number | null;
  chargesArmed: boolean;
  /** Last fired hunger / charges notices (device log). */
  hungerLastFiredAt: number | null;
  chargesLastFiredAt: number | null;
  now: number;
};

/** Every notice to schedule right now (after quiet hours). */
export function planPlayNotices(input: NoticeInput): PlannedNotice[] {
  const { settings, pet, name, now } = input;
  const quiet = (at: number) => deferForQuiet(at, settings.quiet);
  const out: PlannedNotice[] = [];

  if (settings.notif.hunger) {
    const at = petReminderTarget(pet, now, input.hungerLastFiredAt);
    if (at != null) {
      out.push({
        kind: 'hunger',
        at: quiet(at),
        title: `${name} is getting hungry`,
        body: 'A cleared wave, the pantry or a round of Catch the food will fill it up.',
      });
    }
  }

  if (settings.notif.egg && pet.egg != null) {
    if (pet.stage === 'egg') {
      out.push({
        kind: 'egg',
        at: quiet(now + Math.max(0, PET_STAGE_MS.egg - pet.stage_age_ms)),
        title: `${name} hatched!`,
        body: 'Your Baby is here — play with it and feed it to raise the odds before the reveal.',
      });
    } else if (pet.stage === 'baby' && pet.hero == null) {
      out.push({
        kind: 'egg',
        at: quiet(now + Math.max(0, PET_STAGE_MS.baby - pet.stage_age_ms)),
        title: 'Your hero is revealed!',
        body: `Open Divecore to see who ${name} grew into.`,
      });
    }
  }

  // Short trips (under 30 min) only show the in-app banner.
  if (
    settings.notif.expedition &&
    input.expeditionBackInMs != null &&
    input.expeditionBackInMs > 0 &&
    (input.expeditionTripMs ?? 0) >= EXPEDITION_NOTICE_MIN_MS
  ) {
    out.push({
      kind: 'expedition',
      at: quiet(now + input.expeditionBackInMs),
      title: `${name} is back!`,
      body: 'It brought something back from its expedition.',
    });
  }

  const charges = chargesNoticeAt({
    on: settings.notif.charges,
    armed: input.chargesArmed,
    fullAt: input.chargesFullAt,
    lastFiredAt: input.chargesLastFiredAt,
    now,
  });
  if (charges != null) {
    out.push({ kind: 'charges', at: quiet(charges), title: 'Dive charges full', body: 'Every charge is back — time for a dive.' });
  }

  // Never schedule into the past (a few seconds out at least).
  return out.filter((n) => n.at > now + 5_000);
}
