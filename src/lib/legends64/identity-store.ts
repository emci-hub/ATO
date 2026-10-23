/**
 * What the phone remembers about the identity card — the locked letters, the
 * chosen name style, and which styles are unlocked — plus the token spend that
 * unlocks a style.
 *
 * The letters and the chosen style stay on the device. The payment itself
 * is on the server (`spend_ato_tokens_legend_reroll`). Legend history
 * (wave115 `legend_forms`) is saved here too, and mirrored to the server
 * when that migration is applied. The phone still shows it if the table
 * is not there yet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { spendAtoTokensLegendReroll } from '@/lib/ato-tokens-server';
import { DEFAULT_LEGEND_SKIN, isLegendSkin, type LegendSkin } from '@/lib/legends64/archetypes';
import { IDENTITY_AXES, type LockedPoles } from '@/lib/legends64/identity';
import {
  emptyLegendHistory,
  parseLegendHistory,
  type LegendHistory,
  type LegendReveal,
} from '@/lib/legends64/legend-forms';
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
  /**
   * When the name is borderline, the existing legend the person picked
   * to display. It is not a collected legend. Absent means the balanced
   * title, or "Between A and B" until they pick.
   */
  pickedCode?: string | null;
  /** Computed names only. A picked code is never written here. */
  legendHistory: LegendHistory;
  /** Set when an archived name matches again. The animation PR clears it. */
  reveal: LegendReveal | null;
}

function emptyState(userId: string): IdentityState {
  return { userId, poles: {}, skin: DEFAULT_LEGEND_SKIN, unlocked: [], legendHistory: emptyLegendHistory(), reveal: null };
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
      if (pole === 'H' || pole === 'L' || pole === 'M') poles[axis] = pole;
    }
    const pickedCode =
      typeof parsed.pickedCode === 'string' && /^[HL]{3}-[HL]{3}$/.test(parsed.pickedCode)
        ? parsed.pickedCode
        : null;
    const unlocked = Array.isArray(parsed.unlocked)
      ? parsed.unlocked.filter((s): s is LegendSkin => isLegendSkin(s) && s !== DEFAULT_LEGEND_SKIN)
      : [];
    // While styles are free, a picked style needs no `unlocked` entry to survive a reload.
    const skin =
      isLegendSkin(parsed.skin) &&
      (NAME_STYLES_FREE || parsed.skin === DEFAULT_LEGEND_SKIN || unlocked.includes(parsed.skin))
        ? parsed.skin
        : DEFAULT_LEGEND_SKIN;
    const reveal =
      parsed.reveal &&
      parsed.reveal.kind === 'restored' &&
      typeof parsed.reveal.legendId === 'string' &&
      /^[HL]{3}-[HL]{3}$/.test(parsed.reveal.legendId)
        ? { kind: 'restored' as const, legendId: parsed.reveal.legendId }
        : null;
    return { userId, poles, skin, unlocked, pickedCode, legendHistory: parseLegendHistory(parsed.legendHistory), reveal };
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

/**
 * Server copy of the history, or null when wave115 is not applied yet.
 * A new phone uses this so the one-time archive does not run twice.
 */
export async function fetchRemoteLegendHistory(): Promise<LegendHistory | null> {
  try {
    const [formsRes, stateRes] = await Promise.all([
      supabase.from('legend_forms').select('legend_id, first_earned_at, archived_at, restored_at'),
      supabase.from('legend_form_state').select('migrated_at').maybeSingle(),
    ]);
    if (formsRes.error || stateRes.error) return null;
    const forms = (formsRes.data ?? [])
      .map((row) => {
        const item = row as {
          legend_id?: unknown;
          first_earned_at?: unknown;
          archived_at?: unknown;
          restored_at?: unknown;
        };
        return {
          legendId: item.legend_id,
          firstEarnedAt: item.first_earned_at,
          archivedAt: item.archived_at,
          restoredAt: item.restored_at,
        };
      });
    const history = parseLegendHistory({ forms, migrated: stateRes.data != null });
    return history.migrated || history.forms.length > 0 ? history : null;
  } catch {
    return null;
  }
}

/**
 * Mirror one computed code. `archiveId` is sent only on the scoring
 * migration. A picked display name is never passed.
 */
export async function recordLegendForm(current: string | null, archiveId: string | null): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_legend_form', {
      p_current: current,
      p_archive: archiveId,
    });
    if (error) console.log('[identity] legend form sync skipped:', error.message);
  } catch (err) {
    console.log('[identity] legend form sync skipped:', err);
  }
}
