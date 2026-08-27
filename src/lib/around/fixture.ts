import type { AroundShow, WeekendJson } from '@/lib/around/types';

/** Typed test city — not Calgary. Production CityPicker still lists Calgary. */
export const FIXTURE_CITY = 'fixture';

const ALL_AGES: AroundShow = {
  id: 'ato:test-warehouse',
  name: 'Warehouse (test)',
  date: '2026-08-29',
  ages: 'All Ages',
  venueName: 'Test Palais',
  artists: ['ATO Fixture'],
  links: [{ kind: 'edmtrain', url: 'https://edmtrain.com/calgary-ab?event=0' }],
};

const EIGHTEEN_PLUS: AroundShow = {
  id: 'ato:test-18plus',
  name: 'Late night (test)',
  date: '2026-08-29',
  ages: '18+',
  venueName: 'Test Palais',
  artists: ['ATO Fixture'],
  links: [{ kind: 'edmtrain', url: 'https://edmtrain.com/calgary-ab?event=0' }],
};

/** Seeded shows for Wave 2 Stage 2 going tests. Not written to calgary/weekend.json. */
export const FIXTURE_WEEKEND: WeekendJson = {
  city: FIXTURE_CITY,
  weekendStart: '2026-08-28',
  weekendEnd: '2026-08-30',
  fetchedAt: '2026-08-27T00:00:00.000Z',
  source: 'edmtrain',
  shows: [ALL_AGES, EIGHTEEN_PLUS],
};
