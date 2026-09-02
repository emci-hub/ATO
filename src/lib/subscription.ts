/**
 * Subscription gate for appearance modes.
 *
 * NO BILLING IS WIRED. This is the decision layer only: it says which modes are
 * free and answers "is this unlocked for this viewer", so the UI and the theme
 * provider have one place to ask. `useSubscription()` currently returns a fixed
 * inactive state — swapping in a real entitlement source (StoreKit /
 * RevenueCat / a `me` column) means changing only that hook.
 *
 * Free: Soft (the light default) and Quest (the dark default — `Colors.dark`
 * has always aliased to it). Zen / Neon / Anime are subscriber modes.
 *
 * Fail-open on the *product* side, fail-safe on the *user* side: a viewer whose
 * subscription lapses is moved back to a free mode rather than being shown a
 * broken or locked screen (see AppearanceProvider).
 */
import { DEFAULT_APPEARANCE, type AppearanceId } from '@/constants/appearance';

/** Modes that never require a subscription. */
export const FREE_APPEARANCE_IDS = ['soft', 'quest'] as const satisfies readonly AppearanceId[];

/** Product name shown on locked rows. */
export const SUBSCRIPTION_LABEL = 'ATO+';

/** Shown under a locked row. Never promises a date. */
export const SUBSCRIPTION_LOCKED_NOTE = `Part of ${SUBSCRIPTION_LABEL}. Not available yet.`;

export interface SubscriptionState {
  /** True when the viewer has an active entitlement. Always false until billing exists. */
  active: boolean;
  /** True while a real entitlement source is still resolving. */
  loading: boolean;
}

export const INACTIVE_SUBSCRIPTION: SubscriptionState = { active: false, loading: false };

export function isFreeAppearance(id: AppearanceId): boolean {
  return (FREE_APPEARANCE_IDS as readonly AppearanceId[]).includes(id);
}

/** The only question the UI should ask. */
export function isAppearanceUnlocked(id: AppearanceId, subscriptionActive: boolean): boolean {
  return isFreeAppearance(id) || subscriptionActive;
}

/**
 * Resolves a stored mode against the viewer's entitlement. A locked mode falls
 * back to the default rather than stranding a lapsed subscriber on a mode they
 * can no longer pick.
 */
export function resolveAllowedAppearance(
  stored: AppearanceId,
  subscriptionActive: boolean,
): AppearanceId {
  return isAppearanceUnlocked(stored, subscriptionActive) ? stored : DEFAULT_APPEARANCE;
}

/**
 * Entitlement source. Stub by design — no billing SDK, no network, no store.
 * Replace the body (not the signature) when billing lands.
 */
export function useSubscription(): SubscriptionState {
  return INACTIVE_SUBSCRIPTION;
}
