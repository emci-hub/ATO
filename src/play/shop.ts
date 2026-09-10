/**
 * Shop catalog (GAME_SPEC §9i shops, §18 F).
 *
 * Two shelves, both authored as JSON under `src/play/data/shops/`:
 * - `token.json` — the soft-`tokens` shop. Rows buy a real effect now
 *   (one Dive charge, a merge-fuel Power crate) or sit as "Coming soon"
 *   stubs (cosmetic / decor). It NEVER sells uncapped wave_power or a
 *   cycle_power skip — those would break the Conquered climb (§9i).
 * - `paid.json` — the Apple IAP shelf. v0 is STUBS ONLY: every row carries a
 *   display price label and `available: false`, so the UI shows "Soon" and
 *   nothing ever charges Apple. Fill real products later.
 *
 * Pure data + parse: no store import, no side effects. `playStore.purchaseShopRow`
 * consumes a `ShopTokenRow`, and the shop screen renders both shelves.
 */
import rawPaid from './data/shops/paid.json';
import rawToken from './data/shops/token.json';

/** What a token row actually does when bought. */
export type ShopEffectKind =
  /** +`amount` Dive charges (bounded by the 10-charge cap). */
  | 'dive_charge'
  /** Grant `amount` random Power item(s) — the merge-fuel crate. */
  | 'merge_crate'
  /** No effect yet — a "Coming soon" cosmetic/decor row. */
  | 'stub';

export type ShopTokenRow = {
  id: string;
  kind: ShopEffectKind;
  name: string;
  /** One-line honest "what it does". */
  blurb: string;
  /** Soft-token price; null = not priced yet (renders "Coming soon"). */
  price: number | null;
  /** Max buys per device-local day; null = no daily cap (the effect itself
   * may still bound it, e.g. the Dive charge cap). */
  daily_limit: number | null;
  /** Units granted per buy. */
  amount: number;
};

/** What a paid row would sell once real IAP lands. All v0 rows are stubs. */
export type ShopPaidKind = 'paid_unique' | 'hero' | 'stub';

export type ShopPaidRow = {
  id: string;
  kind: ShopPaidKind;
  name: string;
  blurb: string;
  /** Display-only price ("$2.99"). Never charged in v0. */
  price_label: string;
  /** False in v0 → the row renders disabled with a "Soon" pill. */
  available: boolean;
  /** Short tag next to the name ("Paid Unique", "Hero"). */
  badge: string | null;
};

/** Valid effect kinds for a token row. Declared BEFORE the module-eval
 * `TOKEN_ROWS` / `PAID_ROWS` initializers below, which run at import time and
 * read this (calling a parser earlier would hit the temporal dead zone). */
const TOKEN_KINDS: readonly ShopEffectKind[] = ['dive_charge', 'merge_crate', 'stub'];
const PAID_KINDS: readonly ShopPaidKind[] = ['paid_unique', 'hero', 'stub'];

const TOKEN_ROWS: readonly ShopTokenRow[] = parseTokenRows(rawToken);
const PAID_ROWS: readonly ShopPaidRow[] = parsePaidRows(rawPaid);

/** The soft-token shelf, in authored order. */
export function tokenShopRows(): readonly ShopTokenRow[] {
  return TOKEN_ROWS;
}

/** The paid (IAP) shelf, in authored order. Stubs in v0. */
export function paidShopRows(): readonly ShopPaidRow[] {
  return PAID_ROWS;
}

/** One token row by id, or undefined when unknown. */
export function getTokenShopRow(id: string): ShopTokenRow | undefined {
  return TOKEN_ROWS.find((row) => row.id === id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseTokenRows(raw: unknown): readonly ShopTokenRow[] {
  const rowsRaw = isRecord(raw) && Array.isArray(raw.rows) ? raw.rows : [];
  const rows: ShopTokenRow[] = [];
  const seen = new Set<string>();
  for (const entry of rowsRaw) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : null;
    if (!id || seen.has(id)) continue;
    const kind = TOKEN_KINDS.includes(entry.kind as ShopEffectKind)
      ? (entry.kind as ShopEffectKind)
      : null;
    if (!kind) continue;
    seen.add(id);
    const price = finite(entry.price);
    const daily = finite(entry.daily_limit);
    const amount = finite(entry.amount);
    rows.push({
      id,
      kind,
      name: typeof entry.name === 'string' && entry.name.length > 0 ? entry.name : id,
      blurb: typeof entry.blurb === 'string' ? entry.blurb : '',
      // A missing/negative price means "not priced yet" → Coming soon.
      price: price != null && price > 0 ? Math.floor(price) : null,
      daily_limit: daily != null && daily > 0 ? Math.floor(daily) : null,
      // Never 0 — a fractional/zero amount still grants at least one unit.
      amount: amount != null && amount > 0 ? Math.max(1, Math.floor(amount)) : 1,
    });
  }
  return rows;
}

function parsePaidRows(raw: unknown): readonly ShopPaidRow[] {
  const rowsRaw = isRecord(raw) && Array.isArray(raw.rows) ? raw.rows : [];
  const rows: ShopPaidRow[] = [];
  const seen = new Set<string>();
  for (const entry of rowsRaw) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : null;
    if (!id || seen.has(id)) continue;
    const kind = PAID_KINDS.includes(entry.kind as ShopPaidKind)
      ? (entry.kind as ShopPaidKind)
      : 'stub';
    seen.add(id);
    rows.push({
      id,
      kind,
      name: typeof entry.name === 'string' && entry.name.length > 0 ? entry.name : id,
      blurb: typeof entry.blurb === 'string' ? entry.blurb : '',
      price_label:
        typeof entry.price_label === 'string' && entry.price_label.length > 0
          ? entry.price_label
          : '—',
      // v0 is stub-only: anything not explicitly `true` stays disabled.
      available: entry.available === true,
      badge: typeof entry.badge === 'string' && entry.badge.length > 0 ? entry.badge : null,
    });
  }
  return rows;
}
