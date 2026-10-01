/**
 * Mini-game records (v26, Part C) — personal bests, medals, unlocks, ranks and
 * the daily challenge. Pure; playStore saves it, the Play sheet and Guide read it.
 *
 *   - A best score per game per level; only a PASSED round counts (a failed
 *     round never sets a record, a medal or an unlock).
 *   - Bronze / Silver / Gold by score (thresholds per game and level, tuned by
 *     `npm run sim:games`: Bronze ≈ a casual round, Silver ≈ a good one, Gold ≈
 *     a great one; Gold on Insane needs an expert on a good day). Every bar
 *     rises level by level.
 *   - Unlocks come straight from saved medals (nothing else is stored): Easy
 *     and Normal are open; Hard needs Silver on Normal; Insane needs Gold on Hard.
 *   - Rank per game from medals: 0 → first title, Silver on Normal → 2nd,
 *     Gold on Hard → 3rd, Gold on Insane → 4th.
 *   - Daily challenge: one fixed pattern per game per local date (Normal
 *     rules); its own best; +DAILY_BONUS_SHELLS the first time each day you
 *     beat your daily best with a pass. The day uses the same rule as the token
 *     cap (a clock set back doesn't reopen a day).
 */
import { petDayHolds } from '@/play/pet';
import { DIFFICULTIES, type Difficulty } from '@/play/pet-game-rules';

export type Game = 'catch' | 'train';
export const GAMES: readonly Game[] = ['catch', 'train'];
export const GAME_LABEL: Record<Game, string> = { catch: 'Catch the food', train: 'Tap to train' };

export const MEDALS = ['bronze', 'silver', 'gold'] as const;
export type Medal = (typeof MEDALS)[number];
export const MEDAL_LABEL: Record<Medal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
export const MEDAL_ICON: Record<Medal, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' };

/** [bronze, silver, gold] score per game and level (sim:games). */
export const MEDAL_SCORES: Record<Game, Record<Difficulty, readonly [number, number, number]>> = {
  // Catch: medians of casual / good / great players (Insane Gold: an expert's).
  catch: {
    easy: [35, 50, 80],
    normal: [60, 85, 125],
    hard: [85, 110, 160],
    insane: [140, 170, 295],
  },
  // Train: a pass already needs 8+ hits, so passing scores bunch up — Gold is
  // a great player's best-in-ten round (p90), Insane Gold an expert's.
  train: {
    easy: [145, 195, 290],
    normal: [175, 220, 300],
    hard: [265, 315, 420],
    insane: [400, 460, 600],
  },
};

/** What a level needs to open. */
export const UNLOCK_RULE: Record<Difficulty, { level: Difficulty; medal: Medal } | null> = {
  easy: null,
  normal: null,
  hard: { level: 'normal', medal: 'silver' },
  insane: { level: 'hard', medal: 'gold' },
};

export const RANK_TITLES: Record<Game, readonly [string, string, string, string]> = {
  catch: ['Food Catcher', 'Snack Hunter', 'Feast Master', 'Legendary Chef'],
  train: ['Rookie', 'Fighter', 'Champion', 'Grandmaster'],
};
/** What each rank after the first needs: [level, medal]. */
export const RANK_NEEDS: readonly [Difficulty, Medal][] = [
  ['normal', 'silver'],
  ['hard', 'gold'],
  ['insane', 'gold'],
];

export const DAILY_LEVEL: Difficulty = 'normal';
export const DAILY_BONUS_SHELLS = 3;

export type LevelRecord = { best: number; medal: Medal | null };
export type GameRecords = Record<Game, Record<Difficulty, LevelRecord>>;
export type DailyEntry = { best: number; bonus: boolean };
/** v27: `egg` = today's daily-challenge free egg was earned (a pass);
 * `stone` = today's first daily Gold already gave its Shine Stone. */
export type DailyGames = { ymd: string | null; catch: DailyEntry; train: DailyEntry; egg: boolean; stone: boolean };

const EMPTY_LEVEL: LevelRecord = { best: 0, medal: null };
export function emptyRecords(): GameRecords {
  const one = () =>
    Object.fromEntries(DIFFICULTIES.map((d) => [d, { ...EMPTY_LEVEL }])) as Record<Difficulty, LevelRecord>;
  return { catch: one(), train: one() };
}
export const EMPTY_DAILY: DailyGames = {
  ymd: null,
  catch: { best: 0, bonus: false },
  train: { best: 0, bonus: false },
  egg: false,
  stone: false,
};

function medalRank(m: Medal | null): number {
  return m == null ? 0 : MEDALS.indexOf(m) + 1;
}

/** The medal a score earns at a level (a failed round earns none). */
export function medalFor(game: Game, level: Difficulty, score: number, pass: boolean): Medal | null {
  if (!pass) return null;
  const [b, s, g] = MEDAL_SCORES[game][level];
  return score >= g ? 'gold' : score >= s ? 'silver' : score >= b ? 'bronze' : null;
}

/** Is a level open for a game? (Derived from saved medals only.) */
export function levelUnlocked(records: GameRecords, game: Game, level: Difficulty): boolean {
  const rule = UNLOCK_RULE[level];
  if (!rule) return true;
  return medalRank(records[game][rule.level].medal) >= medalRank(rule.medal);
}

/** "Get Silver on Normal to unlock". */
export function unlockHint(level: Difficulty): string | null {
  const rule = UNLOCK_RULE[level];
  if (!rule) return null;
  const cap = (d: Difficulty) => d.charAt(0).toUpperCase() + d.slice(1);
  return `Get ${MEDAL_LABEL[rule.medal]} on ${cap(rule.level)} to unlock`;
}

/** Rank index 0..3 for a game. */
export function rankIndex(records: GameRecords, game: Game): number {
  let r = 0;
  RANK_NEEDS.forEach(([level, medal], i) => {
    if (medalRank(records[game][level].medal) >= medalRank(medal)) r = i + 1;
  });
  return r;
}
export function rankTitle(records: GameRecords, game: Game): string {
  return RANK_TITLES[game][rankIndex(records, game)];
}

export type RoundRecord = {
  records: GameRecords;
  medal: Medal | null;
  /** A passed round that beat the saved best (and the best was above 0). */
  newRecord: boolean;
  prevBest: number;
  rankUp: boolean;
  /** A level this round unlocked (Hard / Insane), or null. */
  unlocked: Difficulty | null;
};

/** Save a finished round. Only a pass can set a best, a medal or an unlock. */
export function recordRound(
  records: GameRecords,
  game: Game,
  level: Difficulty,
  score: number,
  pass: boolean,
): RoundRecord {
  const prev = records[game][level];
  const medal = medalFor(game, level, score, pass);
  if (!pass) return { records, medal: null, newRecord: false, prevBest: prev.best, rankUp: false, unlocked: null };
  const best = Math.max(prev.best, score);
  const keep = medalRank(medal) > medalRank(prev.medal) ? medal : prev.medal;
  const next: GameRecords = { ...records, [game]: { ...records[game], [level]: { best, medal: keep } } };
  const unlocked =
    DIFFICULTIES.find((d) => !levelUnlocked(records, game, d) && levelUnlocked(next, game, d)) ?? null;
  return {
    records: next,
    medal,
    newRecord: prev.best > 0 && score > prev.best,
    prevBest: prev.best,
    rankUp: rankIndex(next, game) > rankIndex(records, game),
    unlocked,
  };
}

/** Today's daily state (a new day starts empty; a clock set back keeps today). */
export function dailyFor(daily: DailyGames, today: string): DailyGames {
  return petDayHolds(today, daily.ymd) ? daily : { ...EMPTY_DAILY, ymd: today };
}

/** Save a daily-challenge round: its best, and the once-a-day bonus. */
export function recordDaily(
  daily: DailyGames,
  today: string,
  game: Game,
  score: number,
  pass: boolean,
): { daily: DailyGames; newBest: boolean; bonusShells: number } {
  const d = dailyFor(daily, today);
  const entry = d[game];
  if (!pass || score <= entry.best) return { daily: d, newBest: false, bonusShells: 0 };
  const bonusShells = entry.bonus ? 0 : DAILY_BONUS_SHELLS;
  return { daily: { ...d, [game]: { best: score, bonus: true } }, newBest: true, bonusShells };
}

function parseLevel(raw: unknown): LevelRecord {
  if (typeof raw !== 'object' || raw == null) return { ...EMPTY_LEVEL };
  const r = raw as Record<string, unknown>;
  const best = typeof r.best === 'number' && Number.isFinite(r.best) ? Math.max(0, Math.floor(r.best)) : 0;
  const medal = typeof r.medal === 'string' && (MEDALS as readonly string[]).includes(r.medal) ? (r.medal as Medal) : null;
  return { best, medal };
}

export function parseRecords(raw: unknown): GameRecords {
  const out = emptyRecords();
  if (typeof raw !== 'object' || raw == null) return out;
  const r = raw as Record<string, unknown>;
  for (const g of GAMES) {
    const row = r[g];
    if (typeof row !== 'object' || row == null) continue;
    for (const d of DIFFICULTIES) out[g][d] = parseLevel((row as Record<string, unknown>)[d]);
  }
  return out;
}

export function parseDaily(raw: unknown): DailyGames {
  if (typeof raw !== 'object' || raw == null) return { ...EMPTY_DAILY };
  const r = raw as Record<string, unknown>;
  const entry = (v: unknown): DailyEntry => {
    if (typeof v !== 'object' || v == null) return { best: 0, bonus: false };
    const e = v as Record<string, unknown>;
    return {
      best: typeof e.best === 'number' && Number.isFinite(e.best) ? Math.max(0, Math.floor(e.best)) : 0,
      bonus: e.bonus === true,
    };
  };
  return {
    ymd: typeof r.ymd === 'string' ? r.ymd : null,
    catch: entry(r.catch),
    train: entry(r.train),
    egg: r.egg === true,
    stone: r.stone === true,
  };
}

/** v27 (Part D): a PASSED daily-challenge round earns today's free egg (once
 * a day, either game), and the first daily Gold of the day a Shine Stone. */
export function dailyRewards(
  daily: DailyGames,
  today: string,
  medal: Medal | null,
): { daily: DailyGames; egg: boolean; stone: boolean } {
  const d = dailyFor(daily, today);
  const egg = !d.egg;
  const stone = medal === 'gold' && !d.stone;
  return { daily: egg || stone ? { ...d, egg: true, stone: d.stone || stone } : d, egg, stone };
}
