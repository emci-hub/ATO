const EDMTRAIN_API = 'https://edmtrain.com/api';

type Envelope = { success?: boolean; message?: string; data?: unknown };

export async function edmtrainGet(
  path: string,
  params: Record<string, string>,
  clientKey: string,
): Promise<unknown> {
  const url = new URL(`${EDMTRAIN_API}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('client', clientKey);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  let body: Envelope;
  try {
    body = JSON.parse(text) as Envelope;
  } catch {
    throw new Error(`edmtrain_http_${response.status}`);
  }
  if (!body.success) throw new Error(body.message || `edmtrain_http_${response.status}`);
  return body.data;
}

export async function edmtrainLocationId(
  city: string,
  state: string,
  clientKey: string,
): Promise<number> {
  const data = await edmtrainGet('locations', { city, state }, clientKey);
  const rows = Array.isArray(data) ? data : [];
  const match = rows.find((row) => {
    if (!row || typeof row !== 'object') return false;
    const rec = row as { id?: unknown; city?: unknown };
    return typeof rec.city === 'string' && rec.city.toLowerCase() === city.toLowerCase() && typeof rec.id === 'number';
  });
  if (!match || typeof (match as { id: number }).id !== 'number') {
    throw new Error(`edmtrain_location_missing:${city}`);
  }
  return (match as { id: number }).id;
}

export async function edmtrainEvents(
  locationId: number,
  startDate: string,
  endDate: string,
  clientKey: string,
): Promise<unknown[]> {
  const data = await edmtrainGet(
    'events',
    {
      locationIds: String(locationId),
      startDate,
      endDate,
      livestreamInd: 'false',
    },
    clientKey,
  );
  return Array.isArray(data) ? data : [];
}
