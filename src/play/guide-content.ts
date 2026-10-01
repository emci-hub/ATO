/**
 * The Divecore Guide (v26, Part C) — one place to learn everything.
 *
 * EVERY number here comes from the same code constant the game uses: the
 * prose has no digits of its own (`check:guide` scans this file's strings and
 * fails on a hand-typed number), so the Guide can never drift from the rules.
 * Pure: the Guide screen renders `guideSections()`; "?" buttons open a section.
 */
import {
  DIVECORE_POWERS_PER_DAY,
  DIVE_GEAR,
  DIVE_GEAR_BLURB,
  DIVE_GEAR_COST,
  DIVE_GEAR_LABEL,
  DIVE_OXYGEN_BUST,
  DIVE_PATH_SHIFT,
  DIVE_TIERS,
  DIVE_TIER_LABEL,
  FREE_DIVE_BASE_SHELLS,
  FREE_DIVE_DECAY,
  FREE_DIVE_FULL,
  NET_MIN_DEPTH,
  PANTRY_MAX,
  POWER_OVERFLOW_SHELLS,
  SHELLS_PER_CLEAR,
  SHELLS_PER_REPLAY,
} from '@/play/dive-loot';
import {
  EXPEDITION_LADDER_MS,
  EXPEDITION_POWER_BY_STEP,
  EXPEDITION_STEPS,
  expectedPowersPerDay,
  tripLabel,
} from '@/play/expedition-ladder';
import {
  DAILY_BONUS_SHELLS,
  GAMES,
  GAME_LABEL,
  MEDAL_SCORES,
  RANK_TITLES,
  UNLOCK_RULE,
  unlockHint,
} from '@/play/game-records';
import {
  PET_BRANCHES,
  PET_BRANCH_LABEL,
  PET_BRANCH_POUNCE,
  PET_BUST_CUT_PP,
  PET_DEEP_BUST_CUT_PP,
  PET_GRACE_MS,
  PET_HALL_MAX,
  PET_HUNGER_TICK_MS,
  PET_LUCKY_UPGRADE,
  PET_METER_MAX,
  PET_MOOD_TICK_MS,
  PET_POUNCE_BASE,
  PET_REBIRTH_CAP,
  PET_REBIRTH_STEP,
  PET_RESCUE_KEEP,
  PET_RESCUE_MAX,
  PET_STAGES,
  PET_STAGE_LABEL,
  PET_STAGE_MS,
  PET_TOKENS_DAILY_CAP,
  PET_TOKENS_PER_ROUND,
  PET_TRIP_BETTER_FROM,
  PET_TRIP_MULT,
  type PetStage,
} from '@/play/pet';
import {
  BAND_WEIGHTS,
  CARE_ACT_POINTS,
  CARE_BANDS,
  CARE_BAND_LABEL,
  CARE_BAND_MIN,
  CARE_EGG_POINTS,
  CARE_ROUND_POINTS,
  CARE_SKILL_POINTS,
  CARE_SKILL_SHARE,
  DYE_STARS,
  EGG_LABEL,
  EGG_POOLS,
  EGG_TYPES,
  GRADES,
  GRADE_LABEL,
  SHARDS_PER_TICKET,
  SHINY_ODDS,
  STAR_MAX,
  WARMTH_DROP_MS,
  WARMTH_MAX,
  gradeTag,
} from '@/play/pet-eggs';
import {
  CATCH,
  COMBO_MULTS,
  COMBO_STEPS,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  PASS_SHARE,
  SCORE_MULT,
  TRAIN,
} from '@/play/pet-game-rules';
import {
  BUFF_HOW,
  BUFF_ICON,
  BUFF_IDS,
  BUFF_LABEL,
  BUFF_USES,
  PET_POUNCE_CAP,
  TD_HELP_BAND,
} from '@/play/play-buffs';
import { DEFAULT_WINDOW } from '@/play/play-settings';
import { DIVE_BUST_FLOOR, DIVE_BUST_TABLE, DIVE_CHARGE_CAP, DIVE_CHARGE_REFILL_MS } from '@/play/playStore';
import { heroName } from '@/play/heroes-data';

export const GUIDE_SECTIONS = ['pet', 'eggs', 'dive', 'expeditions', 'games', 'buffs', 'collection', 'td'] as const;
export type GuideSection = (typeof GUIDE_SECTIONS)[number];

export const GUIDE_TITLE: Record<GuideSection, string> = {
  pet: 'Your pet',
  eggs: 'Eggs & grades',
  dive: 'Dive',
  expeditions: 'Expeditions',
  games: 'Mini-games',
  buffs: 'Buffs',
  collection: 'Collection & Journal',
  td: 'How Divecore helps TD',
};

/* ----------------------------------------------------------- helpers --- */

const MIN = 60_000;
const HOUR = 60 * MIN;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const pts = (x: number) => `${Math.round(x * 100)}`;
function span(ms: number): string {
  if (ms >= 24 * HOUR && ms % (24 * HOUR) === 0) return `${ms / (24 * HOUR)}d`;
  if (ms >= HOUR) return `${Math.round((ms / HOUR) * 10) / 10}h`;
  return `${Math.round(ms / MIN)}m`;
}
const clock = (minuteOfDay: number) =>
  `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;
const grown = PET_STAGES.filter((s): s is Exclude<PetStage, 'egg'> => s !== 'egg');

/* ---------------------------------------------------------- sections --- */

function petSection(): string[] {
  const timeline = (Object.keys(PET_STAGE_MS) as Exclude<PetStage, 'god'>[])
    .map((s) => `${PET_STAGE_LABEL[s]} ${span(PET_STAGE_MS[s])}`)
    .join(' → ');
  return [
    `Stages (real time, even when the app is closed): ${timeline} → ${PET_STAGE_LABEL.god}. It never dies.`,
    `Forms (picked from Teen on, by what you did in the stage before): ${PET_BRANCHES.map((b) => PET_BRANCH_LABEL[b]).join(', ')}. Lots of care mistakes make it Scruffy, lots of TD waves Battle, lots of deep dive surfaces Deep, good care and training Bright; otherwise Standard.`,
    `Needs: hunger drops a heart every ${span(PET_HUNGER_TICK_MS)} and mood every ${span(PET_MOOD_TICK_MS)} (each up to ${PET_METER_MAX} hearts). A meter left empty for ${span(PET_GRACE_MS)} is a care mistake. Feed it from the pantry or with Catch the food; cheer it up with Tap to train, dives and TD waves.`,
    `Sleep: it sleeps from ${clock(DEFAULT_WINDOW.from)} to ${clock(DEFAULT_WINDOW.to)} by default (Settings → Bedtime). That is looks only — hunger still drops overnight.`,
    `Rebirth (God) or Release (Child and up) retires it to the Hall; each rebirth adds +${pct(PET_REBIRTH_STEP)} TD damage for good, up to +${pct(PET_REBIRTH_CAP)}.`,
  ];
}

function eggsSection(): string[] {
  const pools = EGG_TYPES.map((e) => `${EGG_LABEL[e]}: ${EGG_POOLS[e].map(heroName).join(', ')}`).join(' · ');
  const odds = CARE_BANDS.map(
    (b) =>
      `${CARE_BAND_LABEL[b]} (${CARE_BAND_MIN[b]}+): ${GRADES.map((g) => `${GRADE_LABEL[g]} ${BAND_WEIGHTS[b][g]}%`).join(', ')}`,
  ).join(' · ');
  return [
    `Three eggs, each hero an even chance — ${pools}.`,
    `Warmth: ${WARMTH_MAX} pips; one is lost every ${span(WARMTH_DROP_MS)} of egg time — tap the egg to warm it.`,
    `Care score: warmth up to ${CARE_EGG_POINTS}, a skilled Baby round ${CARE_SKILL_POINTS} (a pass with ${pct(CARE_SKILL_SHARE)}+ on Normal or harder), any other pass ${CARE_ROUND_POINTS}, and ${CARE_ACT_POINTS} each for feeding, training and diving.`,
    `Grade odds by care band — ${odds}. Grades are looks only: ${GRADES.map(gradeTag).join(' · ')}.`,
    `Shiny: one in ${Math.round(1 / SHINY_ODDS)}, any hero, any grade.`,
    `Stars: every copy of a hero adds a star, up to ${STAR_MAX}★; ${DYE_STARS}★ unlocks its dye.`,
    `Shards: a pet that leaves gives a shard of its grade; ${SHARDS_PER_TICKET} shards trade up to a ticket for the next grade or better on your next egg.`,
  ];
}

function diveSection(): string[] {
  const zones = DIVE_TIERS.map((t) => DIVE_TIER_LABEL[t]).join(' → ');
  const table = DIVE_BUST_TABLE.map(pct).join(', ');
  const stage = grown.map((s) => `${PET_STAGE_LABEL[s]} −${PET_BUST_CUT_PP[s]}`).join(' · ');
  const lucky = grown.filter((s) => PET_LUCKY_UPGRADE[s] > 0).map((s) => `${PET_STAGE_LABEL[s]} ${pct(PET_LUCKY_UPGRADE[s])}`).join(' · ');
  const gear = DIVE_GEAR.map((g) => `${DIVE_GEAR_LABEL[g]} (${DIVE_GEAR_COST[g]} shells): ${DIVE_GEAR_BLURB[g]}`).join(' ');
  return [
    `Zones by depth: ${zones} (the last needs Oxygen). Deeper zones hold more Powers, and the only rings and auras.`,
    `Bust chance per Deeper: ${table} (a ${pct(DIVE_OXYGEN_BUST)} last Deeper with Oxygen). Two paths: Safer is ${pts(DIVE_PATH_SHIFT)} points lower with finds from one zone up; Richer ${pts(DIVE_PATH_SHIFT)} points higher, one zone down. The % on the button is always the real roll.`,
    `Stage power — your pet takes bust points off every Deeper: ${stage} (Deep form −${PET_DEEP_BUST_CUT_PP} more). Nothing ever takes a chance below ${pct(DIVE_BUST_FLOOR)} of its table value.`,
    `Rarer finds — an older pet sometimes brings a find up one step (more shells, Glow shrimp, a rare Look, a cosmetic; never a Power): ${lucky}.`,
    `Rescue: on a bust it saves your best finds — ${grown.filter((s) => PET_RESCUE_KEEP[s] > 0).map((s) => `${PET_STAGE_LABEL[s]} ${PET_RESCUE_KEEP[s]}`).join(' · ')} (never more than ${PET_RESCUE_MAX}).`,
    `Gear (yours for good): ${gear} The Net works from depth ${NET_MIN_DEPTH}.`,
    `Charges: up to ${DIVE_CHARGE_CAP}, one back every ${span(DIVE_CHARGE_REFILL_MS)}. With none left, a free dive keeps only shells and mood: ${FREE_DIVE_BASE_SHELLS} + the depth, full for the first ${FREE_DIVE_FULL} free dives a day, then ×${FREE_DIVE_DECAY} each.`,
    `Powers today: Divecore gives at most ${DIVECORE_POWERS_PER_DAY} Powers a day (dives, rescues, the Net, Hearty meal and expeditions together) — the Dive screen shows "Powers today". Each Power past that becomes ${POWER_OVERFLOW_SHELLS} shells.`,
    `Food goes to the pantry (up to ${PANTRY_MAX}); your pet only eats when you tap Feed.`,
  ];
}

function expeditionsSection(): string[] {
  const ladder = EXPEDITION_LADDER_MS.map(tripLabel).join(' → ');
  const powerSteps = Object.entries(EXPEDITION_POWER_BY_STEP)
    .map(([step, p]) => `the ${tripLabel(EXPEDITION_LADDER_MS[Number(step)])} trip ${pct(p)}`)
    .join(', ');
  const stage = grown.filter((s) => PET_TRIP_MULT[s] < 1).map((s) => `${PET_STAGE_LABEL[s]} ${pct(1 - PET_TRIP_MULT[s])} shorter`).join(' · ');
  return [
    `From Child on, it can go alone. ${EXPEDITION_STEPS} trips a day, each longer than the last: ${ladder}. The ladder starts over at local midnight.`,
    `What comes back grows with the trip: food and shells early, then finds; a chance of a Power only on ${powerSteps} — about ${Math.round(expectedPowersPerDay() * 100) / 100} Powers a day.`,
    `Stage power: ${stage}. From ${PET_STAGE_LABEL[PET_TRIP_BETTER_FROM]} on, every trip brings back one step better (more shells, shrimp, a deeper zone's find) — the Power chances never change.`,
    `A trip's length is fixed when it leaves. While it is away: no pounce, no bust cut, no rescue, and your dives don't count as its care.`,
  ];
}

function gamesSection(): string[] {
  const combo = GAMES.map(
    (g) => `${GAME_LABEL[g]}: ${COMBO_STEPS[g].map((n, i) => `${n} in a row ×${COMBO_MULTS[i + 1]}`).join(', ')}`,
  ).join(' · ');
  const levels = DIFFICULTIES.map((d) => {
    const rule = UNLOCK_RULE[d];
    return `${DIFFICULTY_LABEL[d]} (score ×${SCORE_MULT.catch[d]} / ×${SCORE_MULT.train[d]})${rule ? ` — ${unlockHint(d)}` : ' — open'}`;
  }).join(' · ');
  const medals = GAMES.map(
    (g) =>
      `${GAME_LABEL[g]}: ${DIFFICULTIES.map((d) => `${DIFFICULTY_LABEL[d]} ${MEDAL_SCORES[g][d].join('/')}`).join(', ')}`,
  ).join(' · ');
  const ranks = GAMES.map((g) => `${GAME_LABEL[g]}: ${RANK_TITLES[g].join(' → ')}`).join(' · ');
  return [
    `Pass rules (every level): Catch the food — catch ${pct(PASS_SHARE)} of the food that falls in ${span(CATCH.roundMs)}; ${CATCH.bombStrikes} bombs end the round as a fail. Tap to train — ${TRAIN.passHits} hits out of ${TRAIN.taps}; ${TRAIN.missStreakEnd} misses in a row end it. A pass feeds or trains your pet and pays ${PET_TOKENS_PER_ROUND} tokens (${PET_TOKENS_DAILY_CAP} a day). A fail gives nothing.`,
    `Egg care: only a pass with ${pct(CARE_SKILL_SHARE)}+ on Normal or harder is "skilled". An Easy pass counts as a plain pass, and harder levels never give more care than Normal.`,
    `Combo: ${combo}. A miss or a bomb resets it.`,
    `Levels: ${levels}.`,
    `Medals (bronze/silver/gold score, passed rounds only): ${medals}. Silver and Gold also give a buff — see Buffs.`,
    `Daily challenge: one fixed pattern per game per day (on Normal rules, the same for everyone that date). Replay it as much as you like — your best counts, and the first time each day you beat your daily best you get ${DAILY_BONUS_SHELLS} shells.`,
    `Ranks (from your best medals): ${ranks}. Shown on your pet's card and in the Journal.`,
  ];
}

function buffsSection(): string[] {
  return [
    ...BUFF_IDS.map((b) => `${BUFF_ICON[b]} ${BUFF_LABEL[b]} — ${BUFF_HOW[b]}`),
    `How to get them: Catch the food Silver → Snack, Gold → Hearty meal; Tap to train Silver → Focused, Gold → Pumped.`,
    `One of each at a time: a new medal refreshes the uses, it never stacks. Buffs count uses, not time, and they are yours, not the pet's — they carry through release and rebirth.`,
    `Maxed aura: Pumped can't push the pounce past ${PET_POUNCE_CAP}, so the TD help stays inside the band. When a strong pet (like a Battle God) is already that close, Pumped adds nothing — it shows as a gold "Maxed aura" glow instead and keeps its ${BUFF_USES.pumped} uses.`,
  ];
}

function collectionSection(): string[] {
  return [
    `Collection: every hero you've raised, its copies and stars, grades, shinies and the forms it reached.`,
    `Hall: up to ${PET_HALL_MAX} retired pets (Legendary and shiny ones are always kept).`,
    `Logbook: every find your pet's dives and expeditions turned up, with how deep it was first found.`,
    `Journal: your Divecore numbers — dives, surfaces, busts, eggs, mini-game ranks and milestones.`,
  ];
}

function tdSection(): string[] {
  const pounce = grown
    .filter((s) => PET_POUNCE_BASE[s] > 0)
    .map((s) => `${PET_STAGE_LABEL[s]} ${PET_POUNCE_BASE[s]}`)
    .join(' · ');
  return [
    `Pet pounce: once a wave, from Child — ${pounce} damage at wave one, growing with the wave (Battle ×${PET_BRANCH_POUNCE.battle}).`,
    `Inside one TD run, everything the pet and Dive add stays between ${pct(TD_HELP_BAND.min)} and ${pct(TD_HELP_BAND.max)} less damage needed — it helps, it's never required. Pumped is capped (pounce ${PET_POUNCE_CAP}) to keep it there.`,
    `Powers from Dive and expeditions go into the same gear slots under the same gear caps — at most ${DIVECORE_POWERS_PER_DAY} a day from Divecore.`,
    `TD gives back: ${SHELLS_PER_CLEAR} shells a cleared wave (${SHELLS_PER_REPLAY} on a replay) for Dive gear, and every wave feeds your pet a heart.`,
    `Rebirth's +${pct(PET_REBIRTH_CAP)} is long-term progress, outside that band.`,
  ];
}

export function guideSections(): { id: GuideSection; title: string; lines: string[] }[] {
  const body: Record<GuideSection, () => string[]> = {
    pet: petSection,
    eggs: eggsSection,
    dive: diveSection,
    expeditions: expeditionsSection,
    games: gamesSection,
    buffs: buffsSection,
    collection: collectionSection,
    td: tdSection,
  };
  return GUIDE_SECTIONS.map((id) => ({ id, title: GUIDE_TITLE[id], lines: body[id]() }));
}

/** The stage-power line the status card and Dive Info show. */
export function stagePowerLine(p: { bustPp: number; lucky: number; tripMult: number; tripBetter: boolean }): string {
  if (p.bustPp <= 0 && p.lucky <= 0 && p.tripMult >= 1) return 'Your pet’s stage gives nothing extra yet — it grows into it.';
  const parts = [`−${p.bustPp} bust points`];
  if (p.lucky > 0) parts.push(`rarer finds (${pct(p.lucky)} lucky upgrades)`);
  if (p.tripMult < 1) parts.push(`trips ${pct(1 - p.tripMult)} shorter`);
  if (p.tripBetter) parts.push('trip rewards one step better');
  return `Your pet’s stage gives: ${parts.join(', ')}.`;
}
