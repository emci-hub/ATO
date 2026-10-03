/**
 * The Divecore Guide (v26, Part C; v27 Part D adds the Den, egg pacing, pity,
 * Shine Stones and styles) — one place to learn everything.
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
  diveTierRolls,
  findKind,
  type DiveTier,
} from '@/play/dive-loot';
import { DEN_MAX_SLOTS, DEN_SLOT_PRICES, DEN_START_SLOTS } from '@/play/den';
import {
  EXPEDITION_LADDER_MS,
  EXPEDITION_POWER_BY_STEP,
  EXPEDITION_STEPS,
  EXPEDITION_STONE_CHANCE,
  EXPEDITION_STONE_STEP,
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
  COLLECT_TIMELINES,
  DAILY_EGG_BONUS,
  DYE_STARS,
  EGGS_PER_DAY_MAX,
  EGG_LABEL,
  EGG_POOLS,
  EGG_TYPES,
  EXTRA_EGG_PRICES,
  FREE_EGGS_PER_DAY,
  GLIMMER_PITY,
  GRADES,
  GRADE_LABEL,
  PITY_HARD,
  PITY_SOFT_FROM,
  PRISM_STYLES,
  PRISM_STYLE_COST,
  STAR_PEARL_PITY,
  SHARDS_PER_TICKET,
  SHINY_ODDS,
  SHINY_STYLE_LABEL,
  STAR_MAX,
  STONE_EVERY_DAYS,
  STONE_ODDS,
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
import { DEFAULT_WINDOW, MILESTONES, STREAK_DAYS, STREAK_REWARDS, STREAK_SHELLS } from '@/play/play-settings';
import { tideShopRows, paidShopRows } from '@/play/shop';
import { TIDE_PASS_DAYS, TIDE_PASS_MAX_DAYS, TIDE_PITY_STEP, TIDE_PRISM_GIFT } from '@/play/tide';
import { DIVE_BUST_FLOOR, DIVE_BUST_TABLE, DIVE_CHARGE_CAP, DIVE_CHARGE_REFILL_MS } from '@/play/playStore';
import { finishColors, finishPrice } from '@/play/finishes';
import { heroName } from '@/play/heroes-data';

export const GUIDE_SECTIONS = ['pet', 'eggs', 'den', 'stones', 'tide', 'dive', 'expeditions', 'games', 'buffs', 'collection', 'td'] as const;
export type GuideSection = (typeof GUIDE_SECTIONS)[number];

export const GUIDE_TITLE: Record<GuideSection, string> = {
  pet: 'Your pet',
  eggs: 'Eggs & grades',
  den: 'The Den',
  stones: 'Shine Stones & styles',
  tide: 'Tide Pass & Shop',
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
const WEEK_WORDS = ['a week', 'two weeks', 'three weeks', 'four weeks', 'five weeks'];
/** A day count in plain words ("about three weeks"). */
function aboutWeeks(days: number): string {
  const w = Math.max(1, Math.min(WEEK_WORDS.length, Math.round(days / 7)));
  return `about ${WEEK_WORDS[w - 1]}`;
}
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
/** The Shine Stone share of a zone's finds (from the loot table itself). */
function stoneShare(tier: DiveTier): number {
  const rolls = diveTierRolls(tier);
  const total = rolls.reduce((a, r) => a + r.weight, 0);
  return total > 0 ? rolls.filter((r) => findKind(r.id) === 'stone').reduce((a, r) => a + r.weight, 0) / total : 0;
}

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
    `Eggs a day: the first ${FREE_EGGS_PER_DAY} are free, then ${EXTRA_EGG_PRICES.join(', ')} shells — ${EGGS_PER_DAY_MAX} at most, starting over at local midnight. Passing a daily challenge adds ${DAILY_EGG_BONUS} free egg, once a day (it counts toward the ${EGGS_PER_DAY_MAX}). A ticket egg is always free and never counts. "Change egg" keeps the egg you paid for — pick again at no cost.`,
    `Legendary pity: every egg that reaches ${PET_STAGE_LABEL.child} without a Legendary adds one to the count; a Legendary sets it back to zero. Release, swaps, rebirth and the clock never change it. From egg ${PITY_SOFT_FROM} the Legendary share climbs each egg, and egg ${PITY_HARD} is always Legendary. The odds the picker shows already include it.`,
    `How long: playing every day with a few eggs and the daily egg, most players find a Legendary in ${aboutWeeks(COLLECT_TIMELINES.legendaryRegularDays)}. With only the free eggs, one is certain within ${COLLECT_TIMELINES.legendaryCertainDays} days (${aboutWeeks(COLLECT_TIMELINES.legendaryCertainDays)}).`,
    `A Tide Pass can make an egg count for more than one toward that guarantee. The odds table stays the same — see Tide Pass & Shop.`,
  ];
}

function denSection(): string[] {
  const prices = DEN_SLOT_PRICES.map((p, i) => `${ordinal(DEN_START_SLOTS + i + 1)} ${p}`).join(', ');
  return [
    `The Den keeps your pets: ${DEN_START_SLOTS} slots to start (the active pet counts as one). More slots cost shells — ${prices}; ${DEN_MAX_SLOTS} at most.`,
    `One pet is active: it lives in the room and gives the perks, the pounce and Pumped. The others rest, frozen — they don't grow, get hungry, lose mood or lose warmth, and an egg's care only counts while it is active.`,
    `Swap from the Den any time except during a dive, while your pet is away on an expedition, or while a mini-game is open. Buffs, the expedition ladder, tokens, the Power ceiling, records and pity are yours — a swap never changes them.`,
    `A new egg needs a free slot; it becomes the active pet and the old one rests. From the Den you can also view a card, rename, favourite (★ sorts to the top), sort by grade or shiny, and release (a shard, as always). Resting pets count in the Collection.`,
  ];
}

function stonesSection(): string[] {
  const rewards = MILESTONES.filter((m) => m.reward.kind === 'stone' || (m.stones ?? 0) > 0)
    .map((m) => m.label)
    .join(', ');
  return [
    `A Shine Stone gives a revealed pet (${PET_STAGE_LABEL.child} and up) a ${pct(STONE_ODDS)} chance to turn shiny — your active pet or one resting in the Den, never one that is already shiny. Looks only: it never changes stats.`,
    `Glimmers: every miss adds a glimmer (they are yours, not the pet's) and that pet keeps a faint glow. With ${GLIMMER_PITY} glimmers the next Stone always works; a success clears them. Each Stone's roll is set in advance, so closing the app can't change it.`,
    `Where Stones come from: the first daily-challenge Gold each day (either game) · the ${tripLabel(EXPEDITION_LADDER_MS[EXPEDITION_STONE_STEP])} expedition, ${pct(EXPEDITION_STONE_CHANCE)} (its Power chance is unchanged) · ${DIVE_TIER_LABEL.abyss} ${pct(stoneShare('abyss'))} and ${DIVE_TIER_LABEL.hadal} ${pct(stoneShare('hadal'))} of charged-dive finds · every ${ordinal(STONE_EVERY_DAYS)} day you play · milestones: ${rewards}.`,
    `Shiny styles: ${SHINY_STYLE_LABEL.classic} is the hero's own shiny colour — natural shinies and Shine Stones. It is never sold. Prism styles are pass-only — see Tide Pass & Shop. Styles are looks only, and dyes never cover a shiny. The Collection shows the styles each hero has.`,
    `Finishes are a look you pick — holo on the pet, or reverse holo behind it — in a named colour (${finishColors().map((c) => c.name).join(', ')}). They are never rolled, so the odds on the egg picker stay the odds the egg uses. ${SHINY_STYLE_LABEL.classic} is still the only shiny you earn. Holo or reverse holo is ${finishPrice('holo', false)} tokens and includes one new colour; each extra colour is ${finishPrice('extra_color', false)}. A Tide Pass discounts those prices. Starpearl is the pass colour.`,
    `How long: with a Stone every few days, most players have a shiny in ${aboutWeeks(COLLECT_TIMELINES.shinyRegularDays)} (natural shinies are one in ${Math.round(1 / SHINY_ODDS)}).`,
  ];
}

function tideSection(): string[] {
  const tideEggs = Math.ceil(PITY_HARD / TIDE_PITY_STEP);
  const tideSoft = Math.ceil(PITY_SOFT_FROM / TIDE_PITY_STEP);
  const styles = PRISM_STYLES.map((s) => `${SHINY_STYLE_LABEL[s]} ${PRISM_STYLE_COST[s]}`).join(' · ');
  const shelf = tideShopRows()
    .map((r) => `${r.name}: ${r.price} tokens, ${r.per_pass_limit} per pass`)
    .join(' · ');
  const pass = paidShopRows().find((r) => r.kind === 'pass');
  const day1 = STREAK_REWARDS[1];
  const shells = day1?.kind === 'shells' ? day1.amount : STREAK_SHELLS;
  return [
    `The Tide Pass lasts ${TIDE_PASS_DAYS} days you play. A day counts the first time you open Divecore that day, and days you skip don't count. Hold up to ${TIDE_PASS_MAX_DAYS} days.`,
    `Legendary progress ×${TIDE_PITY_STEP}: every egg revealed with the pass counts ${TIDE_PITY_STEP} toward the guarantee. From zero, egg ${tideEggs} is always Legendary, rising from egg ${tideSoft}. The odds table doesn't change; the bar fills faster. An egg counts double if it was picked or woken while the pass was on. An egg still incubating keeps that count if the pass ends; one woken after the pass ends counts as one.`,
    `Prism styles are pass only. Each pass brings ${TIDE_PRISM_GIFT} Prism Stone. Pick a style: ${styles}. Classic shinies are never sold. They come from play (one in ${Math.round(1 / SHINY_ODDS)}, and Shine Stones).`,
    `Tide shelf (soft tokens, while a pass is on): ${shelf}. A Star Pearl adds ${STAR_PEARL_PITY} Legendary progress, and it never skips the guarantee.`,
    `What it never changes: Powers, the ${DIVECORE_POWERS_PER_DAY} daily Power ceiling, TD help (${pct(TD_HELP_BAND.min)}–${pct(TD_HELP_BAND.max)}), Dive odds, how fast your pet grows, and free eggs (${FREE_EGGS_PER_DAY} a day, ${EGGS_PER_DAY_MAX} at most).`,
    `Without the pass, everything else is the same, and a Legendary is still certain by egg ${PITY_HARD}. Day ${STREAK_DAYS} of your streak gives a Tide day. The first day gives ${shells} shells.`,
    `How long: with one pass, most regular players find a Legendary in ${aboutWeeks(COLLECT_TIMELINES.legendaryTideDays)}.`,
    `Buying: not for sale yet${pass ? ` (${pass.price_label})` : ''}.`,
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
    `Collection: every hero you've raised — the active pet and every pet resting in the Den — its copies and stars, grades, shinies, shiny styles and the forms it reached. A hero with every style gets a foil frame.`,
    `Hall: up to ${PET_HALL_MAX} retired pets (Legendary and shiny ones are always kept).`,
    `Logbook: every find your pet's dives and expeditions turned up, with how deep it was first found.`,
    `Journal: your Divecore numbers — dives, surfaces, busts, eggs, eggs since your last Legendary, Shine Stones and glimmers, styles owned, mini-game ranks and milestones.`,
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
    den: denSection,
    stones: stonesSection,
    tide: tideSection,
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
