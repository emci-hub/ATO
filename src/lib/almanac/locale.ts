/**
 * Almanac region and hemisphere (ATO-BUILD PHASE-11b, red team M7). Pure apart
 * from the injected key-value store.
 *
 * - Region comes from the device locale via `Intl` (`en-GB` → GB). `expo-localization`
 *   is NOT imported: nothing proves it is linked in the shipped binary, and a native
 *   change would force a 1.3 build. No locale region = no regional events.
 * - Hemisphere (north | south | tropics) is worked out from the IANA zone ONCE and
 *   stored under `ato.almanac.locale.v1`, so travelling never flips the seasons.
 *   Settings can override it later (PHASE-11f calls `setHemisphere`).
 * - Tropics: the four named seasons stay, but summer / solstice flips, snow and
 *   leaf-fall moments are off.
 * - Region and hemisphere never leave the phone.
 */
import type { Hemisphere } from './events';
import type { KeyValueStore } from './types';

export const ALMANAC_LOCALE_KEY = 'ato.almanac.locale.v1';
export const ALMANAC_LOCALE_VERSION = 1;

export interface StoredLocale {
  v: typeof ALMANAC_LOCALE_VERSION;
  hemisphere: Hemisphere;
  /** `user` = chosen in Settings, never overwritten by the zone. */
  source: 'auto' | 'user';
}

/** `en-GB` → `GB`, `zh-Hans-CN` → `CN`, `en` → null, `es-419` → null. */
export function regionFromLocale(locale?: string | null): string | null {
  if (!locale) return null;
  const parts = locale.replace(/_/g, '-').split('-');
  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i] ?? '';
    if (part.length === 1) break; // -u- / -x- extensions start here
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
  }
  return null;
}

/** The phone's locale tag, or null when `Intl` cannot say. */
export function deviceLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || null;
  } catch {
    return null;
  }
}

export function deviceRegion(): string | null {
  return regionFromLocale(deviceLocale());
}

const SOUTH_ZONES = new Set([
  'Pacific/Auckland',
  'Pacific/Chatham',
  'Africa/Johannesburg',
  'Africa/Maseru',
  'Africa/Mbabane',
  'Africa/Windhoek',
  'Africa/Gaborone',
  'Africa/Maputo',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'America/Santiago',
  'America/Punta_Arenas',
  'America/Montevideo',
  'America/Asuncion',
  'America/Cuiaba',
  'America/Campo_Grande',
  'Atlantic/Stanley',
  'Atlantic/South_Georgia',
  'Indian/Antananarivo',
]);

const TROPICS_ZONES = new Set([
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Kuching',
  'Asia/Brunei',
  'Asia/Jakarta',
  'Asia/Pontianak',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Dili',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Saigon',
  'Asia/Phnom_Penh',
  'Asia/Vientiane',
  'Asia/Manila',
  'Asia/Colombo',
  'Asia/Yangon',
  'Australia/Darwin',
  'Africa/Nairobi',
  'Africa/Kampala',
  'Africa/Dar_es_Salaam',
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Abidjan',
  'Africa/Kinshasa',
  'Africa/Libreville',
  'Africa/Douala',
  'Africa/Addis_Ababa',
  'Africa/Mogadishu',
  'Africa/Djibouti',
  'Africa/Kigali',
  'Africa/Bujumbura',
  'Africa/Lusaka',
  'Africa/Harare',
  'America/Bogota',
  'America/Panama',
  'America/Lima',
  'America/Guayaquil',
  'America/Caracas',
  'America/Guyana',
  'America/Paramaribo',
  'America/Cayenne',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/La_Paz',
  'America/Costa_Rica',
  'America/Managua',
  'America/Guatemala',
  'America/El_Salvador',
  'America/Tegucigalpa',
  'America/Santo_Domingo',
  'America/Port_of_Spain',
  'America/Jamaica',
  'Pacific/Honolulu',
  'Pacific/Fiji',
  'Pacific/Tahiti',
  'Pacific/Guam',
  'Pacific/Port_Moresby',
  'Indian/Maldives',
  'Indian/Mauritius',
]);

/** Hemisphere for an IANA zone. Unknown zones read as north. */
export function hemisphereFromZone(zone: string | null | undefined): Hemisphere {
  if (!zone) return 'north';
  if (TROPICS_ZONES.has(zone)) return 'tropics';
  if (
    zone.startsWith('Australia/') ||
    zone.startsWith('Antarctica/') ||
    zone.startsWith('America/Argentina/') ||
    SOUTH_ZONES.has(zone)
  ) {
    return 'south';
  }
  return 'north';
}

const HEMISPHERES: readonly Hemisphere[] = ['north', 'south', 'tropics'];

export function parseLocale(raw: string | null): StoredLocale | null {
  if (!raw) return null;
  try {
    const row = JSON.parse(raw) as Partial<StoredLocale> | null;
    if (
      !row ||
      row.v !== ALMANAC_LOCALE_VERSION ||
      !HEMISPHERES.includes(row.hemisphere as Hemisphere) ||
      (row.source !== 'auto' && row.source !== 'user')
    ) {
      return null;
    }
    return { v: ALMANAC_LOCALE_VERSION, hemisphere: row.hemisphere as Hemisphere, source: row.source };
  } catch {
    return null;
  }
}

async function save(store: KeyValueStore, value: StoredLocale): Promise<void> {
  try {
    await store.setItem(ALMANAC_LOCALE_KEY, JSON.stringify(value));
  } catch {
    // Storage can fail (private mode, full disk). The computed value still works for this run.
  }
}

/**
 * The stored hemisphere. The first call works it out from `zone` and stores it;
 * every later call returns the stored value, whatever zone the phone is in now.
 */
export async function loadLocale(store: KeyValueStore, zone: string | null | undefined): Promise<StoredLocale> {
  let raw: string | null = null;
  try {
    raw = await store.getItem(ALMANAC_LOCALE_KEY);
  } catch {
    raw = null;
  }
  const stored = parseLocale(raw);
  if (stored) return stored;
  const fresh: StoredLocale = { v: ALMANAC_LOCALE_VERSION, hemisphere: hemisphereFromZone(zone), source: 'auto' };
  await save(store, fresh);
  return fresh;
}

/** Settings override: a hemisphere, or `auto` to work it out from the zone again. */
export async function setHemisphere(
  store: KeyValueStore,
  choice: Hemisphere | 'auto',
  zone: string | null | undefined,
): Promise<StoredLocale> {
  const next: StoredLocale =
    choice === 'auto'
      ? { v: ALMANAC_LOCALE_VERSION, hemisphere: hemisphereFromZone(zone), source: 'auto' }
      : { v: ALMANAC_LOCALE_VERSION, hemisphere: choice, source: 'user' };
  await save(store, next);
  return next;
}
