import { AROUND_CITIES } from '@/constants/around-cities';

/**
 * Typed city → slug. "Calgary, AB" and "Calgary AB" both become `calgary`
 * when that city is in the Around registry. Empty / junk → null.
 */
export function slugifyCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const head = raw.trim().split(',')[0]?.trim() ?? '';
  if (!head) return null;
  const known = AROUND_CITIES.find((city) => {
    const label = city.label.toLowerCase();
    const typed = head.toLowerCase();
    return typed === label || typed === city.slug || typed.startsWith(`${label} `);
  });
  if (known) return known.slug;
  const slug = head
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug.length > 0 ? slug : null;
}
