/**
 * refresh-around — pull Edmtrain and write /around/{city}/weekend.json.
 *
 * Phone never calls Edmtrain. This job writes a public Storage object.
 * Auth: Bearer AROUND_REFRESH_SECRET (cron + check script). Not the anon key.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  AROUND_CITIES,
  eventsForLocation,
  locationIdFor,
  mapEdmtrainEvents,
  weekendWindow,
  type AroundCity,
  type WeekendJson,
} from './around.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function authorized(request: Request): boolean {
  const secret = Deno.env.get('AROUND_REFRESH_SECRET') ?? '';
  if (!secret) return false;
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token === secret;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!authorized(request)) return json({ error: 'unauthorized' }, 401);

  const clientKey = Deno.env.get('EDMTRAIN_CLIENT_KEY') ?? '';
  if (!clientKey) return json({ error: 'edmtrain_key_missing' }, 503);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let onlySlug: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.city === 'string') onlySlug = body.city;
  } catch {
    // empty body is fine
  }

  const cities = onlySlug ? AROUND_CITIES.filter((c) => c.slug === onlySlug) : AROUND_CITIES;
  if (cities.length === 0) return json({ error: 'unknown_city' }, 400);

  const results: { city: string; shows: number; weekendStart: string; weekendEnd: string }[] = [];

  for (const city of cities) {
    const payload = await refreshCity(city, clientKey);
    const bytes = new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
    const { error } = await admin.storage.from('around').upload(`${city.slug}/weekend.json`, bytes, {
      contentType: 'application/json',
      cacheControl: '3600',
      upsert: true,
    });
    if (error) return json({ error: 'storage_write_failed', detail: error.message }, 500);
    results.push({
      city: city.slug,
      shows: payload.shows.length,
      weekendStart: payload.weekendStart,
      weekendEnd: payload.weekendEnd,
    });
  }

  return json({ ok: true, results });
});

async function refreshCity(city: AroundCity, clientKey: string): Promise<WeekendJson> {
  const { start, end } = weekendWindow(city.timeZone);
  const locationId = await locationIdFor(city, clientKey);
  const events = await eventsForLocation(locationId, start, end, clientKey);
  return mapEdmtrainEvents(city.slug, start, end, events);
}
