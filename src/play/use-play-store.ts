/**
 * Grove local economy hook (Play step 2). Wraps `playStore` for the Grove
 * screen:
 * - hydrates the AsyncStorage doc on mount,
 * - re-reads on app foreground (offline accrual while backgrounded),
 * - re-derives every 30s while mounted so refill / research countdowns move
 *   without user input.
 *
 * All time-dependent numbers are derived from `doc` + `Date.now()` at render;
 * only real mutations write back to AsyncStorage. `claim` is the game-code
 * path; `commit` is the generic persistence primitive (used by Claim and by
 * the Grove Dev kit's test transitions). `grantRandomFind` is the Dev kit's
 * one-off item grant for step 2b; `beginDive` / `surfaceRun` / `pushDeeper`
 * drive the step-3 Dive push-your-luck loop. Step 4 (Dress) adds `equip` /
 * `unequip` / `sell` plus the Dev kit's `grantRandomPower` / `clearEquipped` /
 * `fillJunkLooks`.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { ItemSlot } from '@/play/items';
import {
  claimResearch,
  deeperDive,
  devCampaignReset,
  devClearEquipped,
  devDefendResetClears,
  devDefendSetClearsFive,
  devFillJunkLooks,
  devForceConquered,
  devForceFinal,
  devGrantAvatarStarToken,
  devGrantMilestoneWaveFive,
  devGrantRandomFind,
  devGrantRandomPower,
  devGrantTideBlades,
  devResetAvatarStarCycle,
  devResetMilestones,
  devSellAllJunk,
  devSetCampaignSeat,
  devSetCycleTint,
  equipItem,
  loadPlayStore,
  mergeItem,
  playView,
  recordDefendWin as persistDefendWin,
  savePlayStore,
  sellItem,
  spendAvatarStarToken,
  startDive,
  surfaceDive,
  unequipItem,
  type CampaignPhase,
  type ClaimResult,
  type DeeperOutcome,
  type DefendWinContext,
  type DefendWinResult,
  type EquipOutcome,
  type MergeOutcome,
  type MergeTarget,
  type PlayStoreDoc,
  type PlayView,
  type SellOutcome,
} from '@/play/playStore';
import type { TypeTag } from '@/play/engine/type-match';

/** Rough tick for countdowns; refills/research are minutes-long, 30s is plenty. */
const TICK_MS = 30_000;

/** Pure store transition: derive a next doc from the current one at `now`, or
 * return null to refuse the change. */
export type PlayTransition = (doc: PlayStoreDoc, now: number) => PlayStoreDoc | null;

export function usePlayStore() {
  const [doc, setDoc] = useState<PlayStoreDoc | null>(null);
  const docRef = useRef<PlayStoreDoc | null>(null);
  const [, tick] = useReducer((n: number) => n + 1, 0);

  const hydrate = useCallback(async () => {
    const next = await loadPlayStore();
    docRef.current = next;
    setDoc(next);
  }, []);

  useEffect(() => {
    let alive = true;
    hydrate();
    const interval = setInterval(() => {
      if (alive) tick();
    }, TICK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') hydrate();
    });
    return () => {
      alive = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [hydrate]);

  /** Run a pure transition, persist the result, re-render. False when no doc yet
   * or the transition refused. */
  const commit = useCallback((transition: PlayTransition): boolean => {
    const current = docRef.current;
    if (!current) return false;
    const next = transition(current, Date.now());
    if (!next) return false;
    docRef.current = next;
    setDoc(next);
    savePlayStore(next).catch(() => {
      // Keep the in-memory economy on save failure; next open re-reads storage.
    });
    return true;
  }, []);

  const claim = useCallback(async (): Promise<ClaimResult | null> => {
    let result: ClaimResult | null = null;
    const ok = commit((current, now) => {
      const claimed = claimResearch(current, now);
      result = claimed ? claimed.result : null;
      return claimed ? claimed.doc : null;
    });
    return ok ? result : null;
  }, [commit]);

  /** Dev kit only (the screen PRE_LAUNCH_DEV-gates its caller): grant one
   * random research-bag find into inventory. Returns the granted item id. */
  const grantRandomFind = useCallback(async (): Promise<string | null> => {
    let grantedId: string | null = null;
    const ok = commit((current) => {
      const granted = devGrantRandomFind(current);
      grantedId = granted.grantedId;
      return granted.doc;
    });
    return ok ? grantedId : null;
  }, [commit]);

  /** Spend 1 dive charge and roll the first find. True when a run started. */
  const beginDive = useCallback(async (): Promise<boolean> => {
    let started = false;
    commit((current, now) => {
      const next = startDive(current, now);
      started = next != null;
      return next ? next.doc : null;
    });
    return started;
  }, [commit]);

  /** Surface: bank the whole haul into inventory. Returns the banked ids. */
  const surfaceRun = useCallback(async (): Promise<string[] | null> => {
    let banked: string[] | null = null;
    const ok = commit((current) => {
      const next = surfaceDive(current);
      banked = next ? next.banked : null;
      return next ? next.doc : null;
    });
    return ok ? banked : null;
  }, [commit]);

  /**
   * Roll one Deeper press. Pass `forceBust` only from the Dev kit's "force
   * bust next Deeper" toggle — it swaps in a rng that always busts.
   */
  const pushDeeper = useCallback(
    async (forceBust: boolean): Promise<DeeperOutcome | null> => {
      let outcome: DeeperOutcome | null = null;
      const ok = commit((current) => {
        const next = forceBust ? deeperDive(current, () => 0) : deeperDive(current);
        outcome = next ? next.outcome : null;
        return next ? next.doc : null;
      });
      return ok ? outcome : null;
    },
    [commit],
  );

  const view: PlayView | null = doc ? playView(doc, Date.now()) : null;

  /** Equip one owned (bagged) copy of (itemId, star) into its slot. */
  const equip = useCallback(
    async (itemId: string, star: number): Promise<EquipOutcome> => {
      let outcome: EquipOutcome = { ok: false, reason: 'not_owned' };
      commit((current) => {
        const next = equipItem(current, itemId, star);
        outcome = next.outcome;
        return next.outcome.ok ? next.doc : null;
      });
      return outcome;
    },
    [commit],
  );

  /** Take an equipped item off its slot. */
  const unequip = useCallback(async (slot: ItemSlot): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = unequipItem(current, slot);
      ok = next.doc !== current;
      return ok ? next.doc : null;
    });
    return ok;
  }, [commit]);

  /** Sell one Look copy of (itemId, star) for tokens. */
  const sell = useCallback(
    async (itemId: string, star: number): Promise<SellOutcome> => {
      let outcome: SellOutcome = { ok: false, reason: 'not_owned' };
      commit((current) => {
        const next = sellItem(current, itemId, star);
        outcome = next.outcome;
        return next.outcome.ok ? next.doc : null;
      });
      return outcome;
    },
    [commit],
  );

  /**
   * Roll one risky merge. `force` is Dev kit only: pin the rng so the merge
   * always succeeds or always fails for fast testing.
   */
  const mergeItems = useCallback(
    async (
      target: MergeTarget,
      force: 'success' | 'fail' | 'none' = 'none',
    ): Promise<MergeOutcome | null> => {
      let outcome: MergeOutcome | null = null;
      commit((current) => {
        const next =
          force === 'success'
            ? mergeItem(current, target, () => 0)
            : force === 'fail'
              ? mergeItem(current, target, () => 1)
              : mergeItem(current, target);
        outcome = next ? next.outcome : null;
        return next ? next.doc : null;
      });
      return outcome;
    },
    [commit],
  );

  /** Dev kit only: grant one random Power into the bag. Returns its id. */
  const grantRandomPower = useCallback(async (): Promise<string | null> => {
    let grantedId: string | null = null;
    commit((current) => {
      const granted = devGrantRandomPower(current);
      grantedId = granted.grantedId;
      return granted.doc;
    });
    return grantedId;
  }, [commit]);

  /** Dev kit only: clear every equipped slot. */
  const clearEquipped = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devClearEquipped(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  /** Dev kit only: fill junk Looks just past the soft cap. */
  const fillJunkLooks = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devFillJunkLooks(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  /** Dev kit only: grant 3 copies of Tide Blade into one stack. */
  const grantTideBlades = useCallback(async (): Promise<string | null> => {
    let grantedId: string | null = null;
    commit((current) => {
      const granted = devGrantTideBlades(current);
      grantedId = granted.grantedId;
      return granted.doc;
    });
    return grantedId;
  }, [commit]);

  /** Dev kit only: sell every Look copy in the bag. */
  const sellAllJunk = useCallback(async (): Promise<{
    sold: number;
    gainedTokens: number;
  } | null> => {
    let result: { sold: number; gainedTokens: number } | null = null;
    commit((current) => {
      const next = devSellAllJunk(current);
      result = { sold: next.sold, gainedTokens: next.gainedTokens };
      return next.doc;
    });
    return result;
  }, [commit]);

  /** A Defend wave cleared → persist rewards + XP + level, count the lifetime
   * clear, and advance the campaign seat (or stay put for a replay). Returns
   * what the win actually paid so the overlay is honest. */
  const recordDefendWin = useCallback(
    async (ctx: DefendWinContext): Promise<DefendWinResult | null> => {
      let result: DefendWinResult | null = null;
      commit((current, now) => {
        const next = persistDefendWin(current, ctx, now);
        result = next.result;
        return next.doc;
      });
      return result;
    },
    [commit],
  );

  /** Dev kit only: reset the campaign to a fresh Trial wave 1 (no cycles). */
  const resetCampaign = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devCampaignReset(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  /** Dev kit only: park the campaign seat at a phase + next wave. */
  const setCampaignSeat = useCallback(
    async (phase: CampaignPhase, wave: number): Promise<boolean> => {
      let ok = false;
      commit((current) => {
        const next = devSetCampaignSeat(current, phase, wave);
        ok = next !== current;
        return ok ? next : null;
      });
      return ok;
    },
    [commit],
  );

  /** Dev kit only: force one more Conquered cycle (power + seat reset). */
  const forceConquered = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devForceConquered(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  /** Dev kit only: zero today's clear counter. */
  const resetDailyClears = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devDefendResetClears(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  /** Dev kit only: set today's clears to 5 (next win is halved). */
  const setClearsTodayFive = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devDefendSetClearsFive(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  /** Dev kit only: force the wave-5 milestone Look (fires once). Returns the
   * granted item id so the row can toast the name. */
  const grantMilestoneWaveFive = useCallback(async (): Promise<string | null> => {
    let grantedId: string | null = null;
    commit((current) => {
      const next = devGrantMilestoneWaveFive(current);
      grantedId = next.grantedId;
      return next.doc;
    });
    return grantedId;
  }, [commit]);

  /** Dev kit only: clear milestone flags so 5/10/25 can fire again. */
  const resetMilestones = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devResetMilestones(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  /** Spend one Avatar star token → +1 star (§9h). Returns true when gained. */
  const spendStarToken = useCallback(async (): Promise<boolean> => {
    let gained = false;
    commit((current) => {
      const next = spendAvatarStarToken(current);
      gained = next.gainedStar;
      return next.gainedStar ? next.doc : null;
    });
    return gained;
  }, [commit]);

  /** Dev kit only: grant one Avatar star token. */
  const grantStarToken = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devGrantAvatarStarToken(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  /** Dev kit only: set the cycle boss tint. */
  const setCycleTint = useCallback(
    async (tint: TypeTag): Promise<boolean> => {
      let ok = false;
      commit((current) => {
        const next = devSetCycleTint(current, tint);
        ok = next !== current;
        return ok ? next : null;
      });
      return ok;
    },
    [commit],
  );

  /** Dev kit only: park the seat at the Final band (Main wave 20). */
  const forceFinal = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devForceFinal(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  /** Dev kit only: reset Avatar-star cycle flags (re-test 25% + pity). */
  const resetAvatarStarCycle = useCallback(async (): Promise<boolean> => {
    let ok = false;
    commit((current) => {
      const next = devResetAvatarStarCycle(current);
      ok = next !== current;
      return ok ? next : null;
    });
    return ok;
  }, [commit]);

  return {
    view,
    claim,
    commit,
    grantRandomFind,
    beginDive,
    surfaceRun,
    pushDeeper,
    equip,
    unequip,
    sell,
    mergeItems,
    grantRandomPower,
    clearEquipped,
    fillJunkLooks,
    grantTideBlades,
    sellAllJunk,
    recordDefendWin,
    resetCampaign,
    setCampaignSeat,
    forceConquered,
    resetDailyClears,
    setClearsTodayFive,
    grantMilestoneWaveFive,
    resetMilestones,
    spendStarToken,
    grantStarToken,
    setCycleTint,
    forceFinal,
    resetAvatarStarCycle,
  };
}
