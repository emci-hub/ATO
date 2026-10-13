/** Writer bible §2 + §5. Used by CI and the polish prompt. */
export const STORY_BANNED_TOPICS: readonly RegExp[] = [
  /\bsuicid/i,
  /\bself[- ]harm\b/i,
  /\b(abuse|abused|abusive)\b/i,
  /\btrauma\b/i,
  /\b(illness|cancer|disease)\b/i,
  /\b(war|warfare)\b/i,
  /\baddict(ion|ed)?\b/i,
  /\b(weight|overweight|fat-shame)\b/i,
  /\b(politics|political|republican|democrat)\b/i,
  /\b(religion|religious|church|mosque|synagogue)\b/i,
  /\b(die|dies|died|dying|dead|death|deaths)\b/i,
];

export const STORY_BANNED_CLICHES: readonly RegExp[] = [
  /\blittle did they know\b/i,
  /\bin a world\b/i,
  /\bchaos ensued\b/i,
  /\bplot twist\b/i,
  /\bthe rest is history\b/i,
  /\band that(?:'|’)s okay\b/i,
  /\bjourney\b/i,
  /\bvibe check\b/i,
  /\bmain character energy\b/i,
  /\bit(?:'|’)s giving\b/i,
  /\bslay\b/i,
  /\bunhinged\b/i,
  /\bwe(?:'|’)ve all been there\b/i,
  /\bplot armor\b/i,
  /\bliving rent-free\b/i,
  /\babsolute legend\b/i,
];

export const STORY_CLINICAL_CARD6 = /\b(attachment|anxiety|trauma|healing|boundaries|toxic|disorder)\b/i;
export const STORY_HOROSCOPE_CARD6 = /\b(the universe|energy is shifting|you may find that)\b/i;

export const STORY_GENDERED_PRONOUNS = /\b(he|she|him|her|his|hers|himself|herself)\b/i;
export const STORY_ROMANCE_LABELS = /\b(girlfriend|boyfriend|wife|husband|birthday girl|two-man)\b/i;
