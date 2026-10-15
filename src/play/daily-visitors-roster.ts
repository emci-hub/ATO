/**
 * Daily visitors — the roster (roadmap step 4, plan approved by emci 2026-10-15).
 * Pure data, no React and no art imports, so the sticker bake script can read it too.
 *
 * Only heroes whose packed cast art has BOTH an idle and a walk clip can visit ("room-ready";
 * `check:daily-visitors` re-checks every id against the real kits). aurex (no idle, no walk) and
 * morwen (no walk) stay out. 12 rotate; 2 stand in on a day the visitor would be your own pet's hero.
 */

/** The 12 that rotate, in visiting order. Ids are forever: saves point at them. */
export const VISITOR_ROTATION: readonly string[] = [
  'kael',
  'kitsune',
  'corvus',
  'neon-viper',
  'archangel',
  'oni',
  'elowen',
  'maldrath',
  'cyber-shinobi',
  'raven',
  'frost-lich',
  'sak',
];

/** Stand-ins: visit only when the day's visitor is the same hero as your pet. */
export const VISITOR_STAND_INS: readonly string[] = ['velkhar', 'void-raven'];

/** Every hero that can drop by, so every hero that has a sticker and a rare look. */
export const VISITOR_STICKER_HEROES: readonly string[] = [...VISITOR_ROTATION, ...VISITOR_STAND_INS];

/** Each visitor's rare look: a pet tint in that hero's colours (never sold, never a Dive find). */
export const VISITOR_TINT_COLOR: Readonly<Record<string, string>> = {
  kael: '#6FA8FF',
  kitsune: '#FF6F7D',
  corvus: '#9DB56E',
  'neon-viper': '#FF4FD8',
  archangel: '#FFF0B3',
  oni: '#E2424B',
  elowen: '#6FD39A',
  maldrath: '#FF8A3D',
  'cyber-shinobi': '#4FD8E8',
  raven: '#8C9CC8',
  'frost-lich': '#C4E6FF',
  sak: '#C99B6B',
  velkhar: '#9D7BFF',
  'void-raven': '#5E4FC9',
};

/** The rare look's cosmetic id for a visitor hero (`cos_tint_visit_<hero>`), forever. */
export function visitorTintId(heroId: string): string {
  return `cos_tint_visit_${heroId.replace(/-/g, '_')}`;
}
