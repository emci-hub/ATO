import type { AroundLoad, WeekendJson } from '@/lib/around/types';

const EMPTY_COPY = 'nothing this weekend';

export function aroundEmptyCopy(): string {
  return EMPTY_COPY;
}

export function aroundJsonUrl(citySlug: string): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/around/${citySlug}/weekend.json`;
}

export async function fetchWeekendJson(citySlug: string): Promise<AroundLoad> {
  const url = aroundJsonUrl(citySlug);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.status === 400 || response.status === 404) {
      return { status: 'empty', city: citySlug };
    }
    if (!response.ok) {
      return { status: 'error', message: "Couldn't load Around. Try again." };
    }
    const payload = (await response.json()) as WeekendJson;
    if (!payload || !Array.isArray(payload.shows) || payload.shows.length === 0) {
      return { status: 'empty', city: citySlug };
    }
    return { status: 'ok', payload };
  } catch {
    return { status: 'error', message: "Couldn't load Around. Try again." };
  }
}
