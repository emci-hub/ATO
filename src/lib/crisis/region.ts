/**
 * Crisis-card region. Only US and Canada have a confirmed number (988).
 * Everything else fails closed to "other" — never guess a hotline.
 */

export const CRISIS_REGIONS = ['US', 'CA', 'other'] as const;
export type CrisisRegion = (typeof CRISIS_REGIONS)[number];

export type DeviceRegionHints = {
  regionCode?: string | null;
  languageRegionCode?: string | null;
  timeZone?: string | null;
};

/** US territories where 988 is the confirmed line. */
const US_TERRITORY_CODES = new Set(['PR', 'GU', 'VI', 'AS', 'MP', 'UM']);

const US_TIME_ZONES = new Set([
  'America/New_York',
  'America/Detroit',
  'America/Kentucky/Louisville',
  'America/Kentucky/Monticello',
  'America/Indiana/Indianapolis',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Indiana/Marengo',
  'America/Indiana/Petersburg',
  'America/Indiana/Vevay',
  'America/Indiana/Tell_City',
  'America/Indiana/Knox',
  'America/Chicago',
  'America/Menominee',
  'America/North_Dakota/Center',
  'America/North_Dakota/New_Salem',
  'America/North_Dakota/Beulah',
  'America/Denver',
  'America/Boise',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Juneau',
  'America/Sitka',
  'America/Metlakatla',
  'America/Yakutat',
  'America/Nome',
  'America/Adak',
  'Pacific/Honolulu',
  'America/Honolulu',
  'America/Puerto_Rico',
  'America/St_Thomas',
  'Pacific/Guam',
  'Pacific/Saipan',
  'Pacific/Pago_Pago',
  'Pacific/Midway',
  'Pacific/Wake',
  'America/Fort_Wayne',
  'America/Indianapolis',
  'America/Louisville',
  'America/Shiprock',
  'Navajo',
  'US/Alaska',
  'US/Aleutian',
  'US/Arizona',
  'US/Central',
  'US/East-Indiana',
  'US/Eastern',
  'US/Hawaii',
  'US/Indiana-Starke',
  'US/Michigan',
  'US/Mountain',
  'US/Pacific',
  'US/Samoa',
]);

const CA_TIME_ZONES = new Set([
  'America/St_Johns',
  'America/Halifax',
  'America/Glace_Bay',
  'America/Moncton',
  'America/Goose_Bay',
  'America/Blanc-Sablon',
  'America/Toronto',
  'America/Montreal',
  'America/Nipigon',
  'America/Thunder_Bay',
  'America/Iqaluit',
  'America/Pangnirtung',
  'America/Atikokan',
  'America/Coral_Harbour',
  'America/Winnipeg',
  'America/Rainy_River',
  'America/Resolute',
  'America/Rankin_Inlet',
  'America/Regina',
  'America/Swift_Current',
  'America/Edmonton',
  'America/Cambridge_Bay',
  'America/Yellowknife',
  'America/Inuvik',
  'America/Creston',
  'America/Dawson_Creek',
  'America/Fort_Nelson',
  'America/Whitehorse',
  'America/Dawson',
  'America/Vancouver',
  'Canada/Atlantic',
  'Canada/Central',
  'Canada/Eastern',
  'Canada/Mountain',
  'Canada/Newfoundland',
  'Canada/Pacific',
  'Canada/Saskatchewan',
  'Canada/Yukon',
]);

export function isCrisisRegion(value: string | null | undefined): value is CrisisRegion {
  return value === 'US' || value === 'CA' || value === 'other';
}

/**
 * Map a locale/region code to US, CA, or other.
 * Returns null only when the code is missing — a present non-US/CA code is
 * "other", never a timezone fallback.
 */
function regionFromCountryCode(raw: string | null | undefined): CrisisRegion | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const code = extractCountryCode(trimmed);
  if (code === 'US' || US_TERRITORY_CODES.has(code ?? '')) return 'US';
  if (code === 'CA') return 'CA';
  // Any other non-empty locale (GB, FR, en-GB, GBR, …) is unconfirmed.
  return 'other';
}

function extractCountryCode(raw: string): string | null {
  const upper = raw.toUpperCase().replace(/_/g, '-');
  const tagged = upper.match(/^[A-Z]{2,3}-([A-Z]{2})$/);
  if (tagged) return tagged[1];
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  if (upper === 'USA') return 'US';
  if (upper === 'CAN') return 'CA';
  return null;
}

function regionFromTimeZone(timeZone: string | null | undefined): CrisisRegion {
  if (!timeZone) return 'other';
  if (CA_TIME_ZONES.has(timeZone)) return 'CA';
  if (US_TIME_ZONES.has(timeZone)) return 'US';
  return 'other';
}

/**
 * Detect US / Canada / other from device locale, then timezone.
 * Locale country wins, including when it is an unconfirmed country — a UK
 * locale with a US timezone is still "other". Timezone is only used when
 * locale does not name a country (common on web). Unknown → other.
 */
export function detectCrisisRegion(hints: DeviceRegionHints): CrisisRegion {
  const fromRegion = regionFromCountryCode(hints.regionCode);
  if (fromRegion) return fromRegion;

  const fromLanguage = regionFromCountryCode(hints.languageRegionCode);
  if (fromLanguage) return fromLanguage;

  return regionFromTimeZone(hints.timeZone);
}

/** Manual override wins; otherwise the stored/detected auto region. */
export function resolveCrisisRegion(
  auto: CrisisRegion,
  override: CrisisRegion | null,
): CrisisRegion {
  return override ?? auto;
}

export function crisisRegionLabel(region: CrisisRegion): string {
  if (region === 'US') return 'United States';
  if (region === 'CA') return 'Canada';
  return 'Other region';
}
