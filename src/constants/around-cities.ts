/**
 * Cities Around knows how to refresh. Wave 2 ships Calgary only.
 * Adding Edmonton later is a new row here plus a new weekend.json — the
 * phone never branches on a city name.
 */
export type AroundCity = {
  slug: string;
  label: string;
  edmtrainCity: string;
  edmtrainState: string;
  timeZone: string;
};

export const AROUND_CITIES: readonly AroundCity[] = [
  {
    slug: 'calgary',
    label: 'Calgary',
    edmtrainCity: 'Calgary',
    edmtrainState: 'Alberta',
    timeZone: 'America/Edmonton',
  },
];

export const DEFAULT_AROUND_CITY = AROUND_CITIES[0];

export function aroundCityBySlug(slug: string | null | undefined): AroundCity | null {
  if (!slug) return null;
  return AROUND_CITIES.find((city) => city.slug === slug) ?? null;
}
