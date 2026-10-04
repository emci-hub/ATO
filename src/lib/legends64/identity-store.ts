/**
 * What the phone remembers about the identity card — the locked letters, the
 * chosen name style, and which styles are unlocked — plus the token spend that
 * unlocks a style.
 *
 * ON THE DEVICE ONLY (emci, 2026-10-01): no new table or column. The payment
 * itself IS on the server: unlocking a style spends through the existing
 * `spend_ato_tokens_legend_reroll` function (-10, once a day), which had no
 * caller since Legends became a placeholder. So if the phone loses this state,
 * the ledger still knows how many styles were paid for, and
 * `fetchPaidStyleCount` lets the person pick that many again for free.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { spendAtoTokensLegendReroll } from '@/lib/ato-tokens-server';
import { DEFAULT_LEGEND_SKIN, isLegendSkin, type LegendSkin } from '@/lib/legends64/archetypes';
import { IDENTITY_AXES, type LockedPoles } from '@/lib/legends64/identity';
import { supabase } from '@/lib/supabase';

export const IDENTITY_STATE_KEY = 'ato.identity.v1';

/**
 * Every name style is pickable for free while this is true (emci, 2026-10-04:
 * "remove that for now so I can see all the names"). Nothing is spent, nothing
 * is rate-limited, no price is shown. Flip it to `false` to put the 10-token,
 * one-a-day unlock back — the paid path (`payForStyleUnlock`, the `unlocked`
 * list and the paid-style credits) is untouched, and styles anyone paid for
 * while it was on stay owned either way. Same temporary-override pattern as
 * `ATO_PLUS_FOR_ALL` (lib/subscription.ts).
 */
export const NAME_STYLES_FREE = true;
/** The ledger reason `spend_ato_tokens_legend_reroll` writes (wave51). */
export const STYLE_UNLOCK_LEDGER_REASON = 'legend_reroll';

export interface IdentityState {
  userId: string;
  poles: LockedPoles;
  skin: LegendSkin;
  /** Paid styles. The default style is free and never listed here. */
  unlocked: LegendSkin[];
}

function emptyState(userId: string): IdentityState {
  return { userId, poles: {}, skin: DEFAULT_LEGEND_SKIN, unlocked: [] };
}

export async function loadIdentityState(userId: string): Promise<IdentityState> {
  try {
    const raw = await AsyncStorage.getItem(IDENTITY_STATE_KEY);
    if (!raw) return emptyState(userId);
    const parsed = JSON.parse(raw) as Partial<IdentityState> | null;
    if (!parsed || parsed.userId !== userId) return emptyState(userId);
    const poles: LockedPoles = {};
    for (const axis of IDENTITY_AXES) {
      const pole = parsed.poles?.[axis];
      if (pole === 'H' || pole === 'L') poles[axis] = pole;
    }
    const unlocked = Array.isArray(parsed.unlocked)
      ? parsed.unlocked.filter((s): s is LegendSkin => isLegendSkin(s) && s !== DEFAULT_LEGEND_SKIN)
      : [];
    // While styles are free, a picked style needs no `unlocked` entry to survive a reload.
    const skin =
      isLegendSkin(parsed.skin) &&
      (NAME_STYLES_FREE || parsed.skin === DEFAULT_LEGEND_SKIN || unlocked.includes(parsed.skin))
        ? parsed.skin
        : DEFAULT_LEGEND_SKIN;
    return { userId, poles, skin, unlocked };
  } catch {
    return emptyState(userId);
  }
}

export async function saveIdentityState(state: IdentityState): Promise<void> {
  try {
    await AsyncStorage.setItem(IDENTITY_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.log('[identity] save skipped:', err);
  }
}

/** How many style unlocks this account has paid for, ever (owner-only read). */
export async function fetchPaidStyleCount(): Promise<number> {
  const { count, error } = await supabase
    .from('ato_token_events')
    .select('id', { count: 'exact', head: true })
    .eq('reason', STYLE_UNLOCK_LEDGER_REASON);
  if (error) throw error;
  return count ?? 0;
}

export type StyleUnlockOutcome = 'unlocked' | 'not_enough' | 'already_today' | 'failed';

/**
 * Pays for one style. `already_today` is the server's once-a-day limit: a
 * second style has to wait until tomorrow.
 */
export async function payForStyleUnlock(): Promise<StyleUnlockOutcome> {
  try {
    const result = await spendAtoTokensLegendReroll();
    if (result.ok) return 'unlocked';
    return result.already ? 'already_today' : 'failed';
  } catch (err) {
    // The spend function raises P0040 for an insufficient balance (wave51).
    if ((err as { code?: string } | null)?.code === 'P0040') return 'not_enough';
    console.log('[identity] style unlock error:', err);
    return 'failed';
  }
}
