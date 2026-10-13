/** Approved non-romantic side-character names (writer bible §2c). */
export const STORY_APPROVED_NAMES = [
  'Sam',
  'Alex',
  'Jordan',
  'Kim',
  'Ari',
  'Rory',
  'Casey',
  'Jamie',
  'Taylor',
  'Riley',
  'Quinn',
  'Rowan',
  'Avery',
  'Morgan',
  'Blair',
  'Drew',
  'Reese',
  'Sky',
  'Parker',
  'Emerson',
  'Remy',
  'Shay',
  'Dakota',
  'Hayden',
  'Kai',
  'Phoenix',
] as const;

export type StoryApprovedName = (typeof STORY_APPROVED_NAMES)[number];

export const STORY_FAMILY_ROLES = ['Aunt', 'Uncle', 'Mom', 'Dad', 'Grandma', 'Grandpa'] as const;

const APPROVED = new Set<string>(STORY_APPROVED_NAMES);

export function isApprovedStoryName(name: string): boolean {
  return APPROVED.has(name);
}

export function isFamilyRoleLabel(speaker: string): boolean {
  return STORY_FAMILY_ROLES.some((role) => speaker === role || speaker.startsWith(`${role} `));
}
