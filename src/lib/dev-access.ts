/**
 * Dev Tools Hub visibility. Pure helpers so check:dev-access can pin the
 * grantable vs root-only split without a session.
 */

export const ROOT_HANDLE = 'emci';

export const GRANTABLE_CAPABILITIES = ['card', 'traits', 'quota', 'fence', 'trace'] as const;

export type DevCapability = (typeof GRANTABLE_CAPABILITIES)[number];

/** Hardcoded root-only. Must never appear in dev_access_grants. */
export const NEVER_GRANTABLE = ['profile-pause', 'profile-delete', 'access-review'] as const;

export type RootOnlyAction = (typeof NEVER_GRANTABLE)[number];

export const GRANTABLE_DESCRIPTIONS: Record<DevCapability, string> = {
  card: 'Run the local Sage generator simulator (no real AI call, no cost)',
  traits: 'View your own trait/ME data in raw form',
  quota: 'View your own AI usage against caps',
  fence: 'Test text against the jargon/phrase guards manually',
  trace: 'See real input/output from your own recent Sage/Explore/Dawn generations',
};

export const ROOT_ONLY_DESCRIPTIONS: Record<RootOnlyAction, string> = {
  'profile-pause': 'Pause/disable a specific account’s login (reversible)',
  'profile-delete': 'Hard-delete a specific account (irreversible — root only, never grantable)',
  'access-review': 'Approve/deny landing-page signups (root only, never grantable)',
};

export type HubSection =
  | DevCapability
  | 'access'
  | 'grants'
  | 'profiles';

export function isGrantableCapability(value: string): value is DevCapability {
  return (GRANTABLE_CAPABILITIES as readonly string[]).includes(value);
}

export function canSeeDevLab(input: {
  isDev: boolean;
  isRoot: boolean;
  capabilities: readonly string[];
}): boolean {
  if (input.isDev || input.isRoot) return true;
  return input.capabilities.some((cap) => isGrantableCapability(cap));
}

export function canSeeHubSection(
  section: HubSection,
  input: { isDev: boolean; isRoot: boolean; capabilities: readonly string[] },
): boolean {
  if (section === 'access' || section === 'grants' || section === 'profiles') {
    return input.isRoot;
  }
  if (input.isDev || input.isRoot) return true;
  return input.capabilities.includes(section);
}

export function isRootHandle(handle: string | null | undefined): boolean {
  return handle === ROOT_HANDLE;
}
