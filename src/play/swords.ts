/**
 * Element swords — mix, merge, undo, drops, and the numbers combat reads.
 *
 * Every recipe, tier, name, drop weight, and effect value lives in
 * `data/swords.json`. This module only applies those rows. Names are built
 * from the config titles ("Cinder" + "Splinter"), never from another game.
 *
 * Design calls that the request left open (also listed in the red-team note):
 * - A mixed sword is first made by combining two different BASE swords of the
 *   same tier (Common, Rare, or Epic). Mixes are not dropped.
 * - 3-merge and 5-merge only climb Common → Rare and Rare → Epic.
 * - Legendary is mixed elements only: 1 Epic of that mix + 1 Relic of that mix.
 * - Divine is 1 Legendary + 3 Relics of the same element, or a boss drop.
 * - Base elements stop at Epic, except a boss may drop a Divine of any element.
 * - Undo reverses only the last merge, and only while every sword it created
 *   is still in the bag and not equipped. A later merge replaces the undo.
 * - Drops of Common / Rare are base elements only. Relics are mixed elements
 *   only, and only from a boss, a high wave, a deep dive, or a win streak.
 * - The hero has no health bar, so Dark's "life steal" returns 1 scrap per hit.
 */
import rawSwords from './data/swords.json';
import type { Element as KitElement } from '@/play/kits';

export const SWORD_TIERS = ['common', 'rare', 'epic', 'legendary', 'divine'] as const;
export type SwordTier = (typeof SWORD_TIERS)[number];

const KIT_ELEMENTS = ['ember', 'tide', 'root', 'spark', 'void'] as const;

export type SwordInst = { uid: number; element: string; tier: SwordTier };
export type RelicInst = { uid: number; element: string };

export type SwordUndo = {
  swordsBack: SwordInst[];
  relicsBack: RelicInst[];
  /** Uids this merge created. Undo requires each one still in the bag, unequipped. */
  added: number[];
};

export type SwordBag = {
  swords: SwordInst[];
  relics: RelicInst[];
  equipped: number | null;
  undo: SwordUndo | null;
  nextUid: number;
  /** Seed for the next drop. The same bag state rolls the same drop. */
  dropSeq: number;
  claimed: string[];
  winStreak: number;
  streakYmd: string | null;
};

export type SwordElementKind = 'base' | 'mix';

type CombatRow = {
  haste: number;
  boss: number;
  burn: number;
  burnMs: number;
  slow: number;
  slowMs: number;
  knock: number;
  scrap: number;
  chain: number;
  chainShare: number;
  splash: number;
  splashShare: number;
  shredMs: number;
};

type AuraRow = {
  speed: number;
  damage: number;
  boss: number;
  slow: number;
  slowMs: number;
  burn: number;
  knock: number;
  chain: number;
  scrap: number;
};

type ElementRow = {
  id: string;
  kind: SwordElementKind;
  title: string;
  color: string;
  status: KitElement;
  pair: readonly [string, string] | null;
  label: string;
  auraLabel: string;
  combat: CombatRow;
  aura: AuraRow;
};

type SwordConfig = {
  tiers: readonly SwordTier[];
  tierWord: Record<SwordTier, string>;
  tierTitle: Record<SwordTier, string>;
  tierScale: Record<SwordTier, number>;
  upgradeFrom: readonly SwordTier[];
  mixTiers: readonly SwordTier[];
  legendary: { from: SwordTier; relics: number; mixedOnly: boolean };
  divine: { from: SwordTier; relics: number };
  legendaryDamage: number;
  legendaryBump: number;
  super: { radius: number; damageMult: number };
  chainRange: number;
  caps: {
    cooldownMultMin: number;
    strikeMultMax: number;
    bossMultMax: number;
    burnDpsShareMax: number;
    burnMsMax: number;
    slowFactorMin: number;
    slowMsMax: number;
    knockFracMax: number;
    scrapOnHitMax: number;
    chainMax: number;
    chainShareMax: number;
    splashRadiusMax: number;
    splashShareMax: number;
    shredMsMax: number;
    auraRadius: number;
    auraSpeedMax: number;
    auraDamageMax: number;
    auraBossMax: number;
    auraSlowMin: number;
    auraSlowMsMax: number;
    auraBurnMax: number;
    auraKnockMax: number;
    auraChainMax: number;
    auraChainShare: number;
    auraScrapMax: number;
  };
  drops: {
    claimRing: number;
    bag: { swords: number; relics: number };
    highWaveAt: number;
    streakAt: number;
    minigameStreakAt: number;
    deepAt: number;
    mixWeight: number;
    baseWeight: number;
    weights: Record<string, { common: number; rare: number; relic: number; divine: number }>;
  };
  sim: {
    trials: number;
    maxDays: number;
    seed: number;
    defendWinsPerDay: number;
    bossChance: number;
    highWaveChance: number;
    minigameWinsPerDay: number;
    divesPerDay: number;
    deepChance: number;
  };
  elements: readonly ElementRow[];
};

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function combatOf(raw: unknown): CombatRow {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    haste: num(row.haste),
    boss: num(row.boss),
    burn: num(row.burn),
    burnMs: num(row.burnMs),
    slow: num(row.slow),
    slowMs: num(row.slowMs),
    knock: num(row.knock),
    scrap: num(row.scrap),
    chain: num(row.chain),
    chainShare: num(row.chainShare),
    splash: num(row.splash),
    splashShare: num(row.splashShare),
    shredMs: num(row.shredMs),
  };
}

function auraOf(raw: unknown): AuraRow {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    speed: num(row.speed),
    damage: num(row.damage),
    boss: num(row.boss),
    slow: num(row.slow),
    slowMs: num(row.slowMs),
    burn: num(row.burn),
    knock: num(row.knock),
    chain: num(row.chain),
    scrap: num(row.scrap),
  };
}

function loadConfig(raw: unknown): SwordConfig {
  if (!raw || typeof raw !== 'object') throw new Error('swords.json: not an object');
  const src = raw as Record<string, unknown>;
  const tiers = SWORD_TIERS;
  const word = src.tierWord as Record<string, string>;
  const title = src.tierTitle as Record<string, string>;
  const scale = src.tierScale as Record<string, number>;
  for (const tier of tiers) {
    if (!word?.[tier] || !title?.[tier] || typeof scale?.[tier] !== 'number') {
      throw new Error(`swords.json: tier ${tier} is missing a word, title, or scale`);
    }
  }
  if (!Array.isArray(src.elements)) throw new Error('swords.json: elements must be an array');
  const elements: ElementRow[] = src.elements.map((entry) => {
    const row = entry as Record<string, unknown>;
    const id = String(row.id ?? '');
    const kind = row.kind === 'mix' ? 'mix' : 'base';
    const pairRaw = Array.isArray(row.pair) ? row.pair : null;
    const status = String(row.status ?? '');
    if (!(KIT_ELEMENTS as readonly string[]).includes(status)) {
      throw new Error(`swords.json: ${id} has a bad status element`);
    }
    return {
      id,
      kind,
      title: String(row.title ?? id),
      color: String(row.color ?? '#FFFFFF'),
      status: status as KitElement,
      pair: pairRaw && pairRaw.length === 2 ? [String(pairRaw[0]), String(pairRaw[1])] : null,
      label: String(row.label ?? ''),
      auraLabel: String(row.auraLabel ?? ''),
      combat: combatOf(row.combat),
      aura: auraOf(row.aura),
    };
  });
  const caps = src.caps as SwordConfig['caps'];
  const drops = src.drops as SwordConfig['drops'];
  const sim = src.sim as SwordConfig['sim'];
  const legendary = src.legendary as SwordConfig['legendary'];
  const divine = src.divine as SwordConfig['divine'];
  return {
    tiers,
    tierWord: word as Record<SwordTier, string>,
    tierTitle: title as Record<SwordTier, string>,
    tierScale: scale as Record<SwordTier, number>,
    upgradeFrom: (src.upgradeFrom as SwordTier[]) ?? [],
    mixTiers: (src.mixTiers as SwordTier[]) ?? [],
    legendary,
    divine,
    legendaryDamage: num(src.legendaryDamage),
    legendaryBump: num(src.legendaryBump),
    super: src.super as SwordConfig['super'],
    chainRange: num(src.chainRange, 12),
    caps,
    drops,
    sim,
    elements,
  };
}

const CONFIG: SwordConfig = loadConfig(rawSwords);

const BY_ID = new Map(CONFIG.elements.map((row) => [row.id, row]));

function pairKey(a: string, b: string): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

const MIX_BY_PAIR = new Map<string, string>();
for (const row of CONFIG.elements) {
  if (row.kind === 'mix' && row.pair) MIX_BY_PAIR.set(pairKey(row.pair[0], row.pair[1]), row.id);
}

export function swordConfig(): SwordConfig {
  return CONFIG;
}

export function swordElements(): readonly ElementRow[] {
  return CONFIG.elements;
}

export function isSwordTier(value: unknown): value is SwordTier {
  return typeof value === 'string' && (SWORD_TIERS as readonly string[]).includes(value);
}

export function swordElement(id: string): ElementRow | undefined {
  return BY_ID.get(id);
}

export function baseElementIds(): string[] {
  return CONFIG.elements.filter((row) => row.kind === 'base').map((row) => row.id);
}

export function mixElementIds(): string[] {
  return CONFIG.elements.filter((row) => row.kind === 'mix').map((row) => row.id);
}

/** "Cinder Splinter" — both words come from the config, not from code. */
export function swordName(element: string, tier: SwordTier): string {
  const row = BY_ID.get(element);
  return `${row?.title ?? element} ${CONFIG.tierTitle[tier]}`;
}

export function relicName(element: string): string {
  const row = BY_ID.get(element);
  return `${row?.title ?? element} Relic`;
}

export function tierWord(tier: SwordTier): string {
  return CONFIG.tierWord[tier];
}

export function emptySwordBag(): SwordBag {
  return {
    swords: [],
    relics: [],
    equipped: null,
    undo: null,
    nextUid: 1,
    dropSeq: 1,
    claimed: [],
    winStreak: 0,
    streakYmd: null,
  };
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : min;
  return Math.max(min, Math.min(max, n));
}

/** A saved bag. Unknown rows are dropped. A broken undo is discarded so it
 * cannot restore items that were already used. */
export function parseSwordBag(raw: unknown): SwordBag {
  if (!raw || typeof raw !== 'object') return emptySwordBag();
  const src = raw as Record<string, unknown>;
  const swords: SwordInst[] = [];
  const seen = new Set<number>();
  if (Array.isArray(src.swords)) {
    for (const entry of src.swords) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      const uid = clampInt(row.uid, 1, 1_000_000_000);
      if (seen.has(uid) || !BY_ID.has(String(row.element)) || !isSwordTier(row.tier)) continue;
      seen.add(uid);
      swords.push({ uid, element: String(row.element), tier: row.tier });
    }
  }
  const relics: RelicInst[] = [];
  if (Array.isArray(src.relics)) {
    for (const entry of src.relics) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      const uid = clampInt(row.uid, 1, 1_000_000_000);
      const element = String(row.element ?? '');
      const def = BY_ID.get(element);
      if (seen.has(uid) || !def || def.kind !== 'mix') continue;
      seen.add(uid);
      relics.push({ uid, element });
    }
  }
  const maxUid = [...seen].reduce((best, uid) => Math.max(best, uid), 0);
  const nextUid = Math.max(clampInt(src.nextUid, 1, 1_000_000_000), maxUid + 1);
  const equipped = typeof src.equipped === 'number' && swords.some((s) => s.uid === src.equipped)
    ? src.equipped
    : null;
  let undo: SwordUndo | null = null;
  if (src.undo && typeof src.undo === 'object') {
    const saved = src.undo as Record<string, unknown>;
    const added = Array.isArray(saved.added)
      ? saved.added.filter((id): id is number => typeof id === 'number')
      : [];
    const swordsBack = Array.isArray(saved.swordsBack) ? parseSwordBag({ swords: saved.swordsBack }).swords : [];
    const relicsBack = Array.isArray(saved.relicsBack) ? parseSwordBag({ relics: saved.relicsBack }).relics : [];
    const present = added.length > 0 && added.every((uid) => swords.some((s) => s.uid === uid) || relics.some((r) => r.uid === uid));
    const free = present && added.every((uid) => uid !== equipped);
    if (free) undo = { swordsBack, relicsBack, added };
  }
  const claimed = Array.isArray(src.claimed)
    ? src.claimed.filter((key): key is string => typeof key === 'string' && key.length > 0).slice(-CONFIG.drops.claimRing)
    : [];
  return {
    swords,
    relics,
    equipped,
    undo,
    nextUid,
    dropSeq: clampInt(src.dropSeq, 1, 1_000_000_000),
    claimed,
    winStreak: clampInt(src.winStreak, 0, 99),
    streakYmd: typeof src.streakYmd === 'string' ? src.streakYmd : null,
  };
}

function mint(bag: SwordBag): { bag: SwordBag; uid: number } {
  return { bag: { ...bag, nextUid: bag.nextUid + 1 }, uid: bag.nextUid };
}

function withoutUids(bag: SwordBag, uids: readonly number[]): SwordBag {
  const drop = new Set(uids);
  return {
    ...bag,
    swords: bag.swords.filter((s) => !drop.has(s.uid)),
    relics: bag.relics.filter((r) => !drop.has(r.uid)),
    equipped: bag.equipped != null && drop.has(bag.equipped) ? null : bag.equipped,
  };
}

function takeSwords(bag: SwordBag, element: string, tier: SwordTier, count: number): SwordInst[] | null {
  const pool = bag.swords
    .filter((s) => s.element === element && s.tier === tier && s.uid !== bag.equipped)
    .slice()
    .sort((a, b) => a.uid - b.uid);
  if (pool.length < count) return null;
  return pool.slice(0, count);
}

function takeRelics(bag: SwordBag, element: string, count: number): RelicInst[] | null {
  const pool = bag.relics.filter((r) => r.element === element).slice().sort((a, b) => a.uid - b.uid);
  if (pool.length < count) return null;
  return pool.slice(0, count);
}

export type SwordOpResult =
  | { ok: true; bag: SwordBag; detail: string }
  | { ok: false; bag: SwordBag; reason: string };

function fail(bag: SwordBag, reason: string): SwordOpResult {
  return { ok: false, bag, reason };
}

function commitMerge(bag: SwordBag, removedSwords: SwordInst[], removedRelics: RelicInst[], created: SwordInst[]): SwordOpResult {
  const consumed = [...removedSwords.map((s) => s.uid), ...removedRelics.map((r) => r.uid)];
  let next = withoutUids(bag, consumed);
  next = { ...next, swords: [...next.swords, ...created] };
  next = {
    ...next,
    undo: { swordsBack: removedSwords, relicsBack: removedRelics, added: created.map((s) => s.uid) },
  };
  const names = created.map((s) => swordName(s.element, s.tier)).join(' and ');
  return { ok: true, bag: next, detail: names };
}

export function mergeThree(bag: SwordBag, element: string, tier: SwordTier): SwordOpResult {
  if (!CONFIG.upgradeFrom.includes(tier)) {
    return fail(bag, 'That tier does not merge in threes. Epic needs a Relic.');
  }
  const nextTier = SWORD_TIERS[SWORD_TIERS.indexOf(tier) + 1];
  if (!nextTier || nextTier === 'legendary' || nextTier === 'divine') {
    return fail(bag, 'That tier does not merge in threes.');
  }
  const taken = takeSwords(bag, element, tier, 3);
  if (!taken) return fail(bag, 'Need 3 unequipped copies of that sword.');
  const minted = mint(bag);
  const created = [{ uid: minted.uid, element, tier: nextTier }];
  return commitMerge(minted.bag, taken, [], created);
}

export function mergeFive(bag: SwordBag, element: string, tier: SwordTier): SwordOpResult {
  if (!CONFIG.upgradeFrom.includes(tier)) {
    return fail(bag, 'That tier does not merge in fives. Epic needs a Relic.');
  }
  const nextTier = SWORD_TIERS[SWORD_TIERS.indexOf(tier) + 1];
  if (!nextTier || nextTier === 'legendary' || nextTier === 'divine') {
    return fail(bag, 'That tier does not merge in fives.');
  }
  const taken = takeSwords(bag, element, tier, 5);
  if (!taken) return fail(bag, 'Need 5 unequipped copies of that sword.');
  let cursor = bag;
  const created: SwordInst[] = [];
  const first = mint(cursor);
  cursor = first.bag;
  created.push({ uid: first.uid, element, tier: nextTier });
  const bonus = mint(cursor);
  cursor = bonus.bag;
  created.push({ uid: bonus.uid, element, tier: 'common' });
  return commitMerge(cursor, taken, [], created);
}

/** Two base swords, same tier → one mixed sword of that tier. */
export function mixSwords(bag: SwordBag, elementA: string, elementB: string, tier: SwordTier): SwordOpResult {
  if (!CONFIG.mixTiers.includes(tier)) return fail(bag, 'Only Common, Rare, and Epic swords can be mixed.');
  const a = BY_ID.get(elementA);
  const b = BY_ID.get(elementB);
  if (!a || !b || a.kind !== 'base' || b.kind !== 'base') {
    return fail(bag, 'Mix two different base swords. Mixed swords upgrade on their own.');
  }
  if (elementA === elementB) return fail(bag, 'Pick two different elements.');
  const mixed = MIX_BY_PAIR.get(pairKey(elementA, elementB));
  if (!mixed) return fail(bag, 'Those two elements do not mix.');
  const left = takeSwords(bag, elementA, tier, 1);
  const right = takeSwords(bag, elementB, tier, 1);
  if (!left || !right) return fail(bag, 'Need one unequipped copy of each, at the same tier.');
  const minted = mint(bag);
  return commitMerge(minted.bag, [...left, ...right], [], [{ uid: minted.uid, element: mixed, tier }]);
}

export function forgeLegendary(bag: SwordBag, element: string): SwordOpResult {
  const row = BY_ID.get(element);
  if (!row) return fail(bag, 'Unknown element.');
  if (CONFIG.legendary.mixedOnly && row.kind !== 'mix') {
    return fail(bag, 'Legendary swords are mixed elements only. Mix two bases first.');
  }
  const epic = takeSwords(bag, element, CONFIG.legendary.from, 1);
  const relics = takeRelics(bag, element, CONFIG.legendary.relics);
  if (!epic || !relics) {
    return fail(bag, `Need 1 unequipped ${tierWord(CONFIG.legendary.from)} ${row.title} and ${CONFIG.legendary.relics} matching Relic.`);
  }
  const minted = mint(bag);
  const consumed = withoutUids(minted.bag, [...epic.map((s) => s.uid), ...relics.map((r) => r.uid)]);
  const created = { uid: minted.uid, element, tier: 'legendary' as const };
  return {
    ok: true,
    bag: {
      ...consumed,
      swords: [...consumed.swords, created],
      undo: { swordsBack: epic, relicsBack: relics, added: [created.uid] },
    },
    detail: swordName(element, 'legendary'),
  };
}

export function forgeDivine(bag: SwordBag, element: string): SwordOpResult {
  const row = BY_ID.get(element);
  if (!row) return fail(bag, 'Unknown element.');
  const legend = takeSwords(bag, element, CONFIG.divine.from, 1);
  const relics = takeRelics(bag, element, CONFIG.divine.relics);
  if (!legend || !relics) {
    return fail(bag, `Need 1 unequipped Legendary ${row.title} and ${CONFIG.divine.relics} matching Relics.`);
  }
  const minted = mint(bag);
  const consumed = withoutUids(minted.bag, [...legend.map((s) => s.uid), ...relics.map((r) => r.uid)]);
  const created = { uid: minted.uid, element, tier: 'divine' as const };
  return {
    ok: true,
    bag: {
      ...consumed,
      swords: [...consumed.swords, created],
      undo: { swordsBack: legend, relicsBack: relics, added: [created.uid] },
    },
    detail: swordName(element, 'divine'),
  };
}

export function undoMerge(bag: SwordBag): SwordOpResult {
  const undo = bag.undo;
  if (!undo) return fail(bag, 'Nothing to undo.');
  const stillThere = undo.added.every(
    (uid) => bag.swords.some((s) => s.uid === uid) || bag.relics.some((r) => r.uid === uid),
  );
  if (!stillThere || undo.added.some((uid) => uid === bag.equipped)) {
    return fail(bag, 'Undo is closed — that sword was equipped or used in another merge.');
  }
  const stripped = withoutUids(bag, undo.added);
  return {
    ok: true,
    bag: {
      ...stripped,
      swords: [...stripped.swords, ...undo.swordsBack],
      relics: [...stripped.relics, ...undo.relicsBack],
      undo: null,
    },
    detail: 'Last merge undone.',
  };
}

export function equipSword(bag: SwordBag, uid: number): SwordOpResult {
  const sword = bag.swords.find((s) => s.uid === uid);
  if (!sword) return fail(bag, 'That sword is not in the bag.');
  return { ok: true, bag: { ...bag, equipped: uid }, detail: swordName(sword.element, sword.tier) };
}

export function unequipSword(bag: SwordBag): SwordOpResult {
  return { ok: true, bag: { ...bag, equipped: null }, detail: 'Unequipped.' };
}

/** Dev kit only: add one sword and equip it. Bypasses the bag cap on purpose. */
export function devGrantSword(bag: SwordBag, element: string, tier: SwordTier): SwordOpResult {
  if (!BY_ID.has(element) || !isSwordTier(tier)) return fail(bag, 'Unknown sword.');
  const minted = mint(bag);
  const created = { uid: minted.uid, element, tier };
  return {
    ok: true,
    bag: { ...minted.bag, swords: [...minted.bag.swords, created], equipped: created.uid },
    detail: swordName(element, tier),
  };
}

export type DropSource = 'defend' | 'minigame' | 'dive';

export type DropContext = {
  source: DropSource;
  boss: boolean;
  highWave: boolean;
  deep: boolean;
  /** Streak counting this win, already day-gated by the caller. */
  streak: number;
};

export type SwordGrant = {
  kind: 'sword' | 'relic';
  name: string;
  element: string;
  tier: SwordTier | null;
  bagFull: boolean;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T extends string>(rng: () => number, rows: { id: T; weight: number }[]): T | null {
  let total = 0;
  for (const row of rows) total += row.weight;
  if (total <= 0) return null;
  let cursor = rng() * total;
  for (const row of rows) {
    cursor -= row.weight;
    if (cursor < 0) return row.id;
  }
  return rows[rows.length - 1]?.id ?? null;
}

function dropTable(ctx: DropContext): { common: number; rare: number; relic: number; divine: number } {
  const d = CONFIG.drops;
  if (ctx.source === 'defend' && ctx.boss) return d.weights.defendBoss;
  if (ctx.source === 'defend' && (ctx.highWave || ctx.streak >= d.streakAt)) return d.weights.defendRareEvent;
  if (ctx.source === 'defend') return d.weights.defend;
  if (ctx.source === 'minigame' && ctx.streak >= d.minigameStreakAt) return d.weights.minigameStreak;
  if (ctx.source === 'minigame') return d.weights.minigame;
  if (ctx.source === 'dive' && ctx.deep) return d.weights.diveDeep;
  return d.weights.dive;
}

export type RolledDrop =
  | { kind: 'none' }
  | { kind: 'sword'; element: string; tier: SwordTier }
  | { kind: 'relic'; element: string };

/** One drop from the config weights. Divine is a sword tier, relics are not. */
export function rollSwordDrop(rng: () => number, ctx: DropContext): RolledDrop {
  const table = dropTable(ctx);
  const kind = weightedPick(rng, [
    { id: 'common' as const, weight: table.common },
    { id: 'rare' as const, weight: table.rare },
    { id: 'relic' as const, weight: table.relic },
    { id: 'divine' as const, weight: table.divine },
  ]);
  if (!kind) return { kind: 'none' };
  if (kind === 'relic') {
    const mixes = mixElementIds();
    return { kind: 'relic', element: mixes[Math.floor(rng() * mixes.length)] ?? mixes[0] };
  }
  const tier: SwordTier = kind === 'divine' ? 'divine' : kind;
  const element = kind === 'divine' ? pickDivineElement(rng) : pickBaseElement(rng);
  return { kind: 'sword', element, tier };
}

function pickBaseElement(rng: () => number): string {
  const bases = baseElementIds();
  return bases[Math.floor(rng() * bases.length)] ?? bases[0];
}

function pickDivineElement(rng: () => number): string {
  const rows = [
    ...baseElementIds().map((id) => ({ id, weight: CONFIG.drops.baseWeight })),
    ...mixElementIds().map((id) => ({ id, weight: CONFIG.drops.mixWeight })),
  ];
  return weightedPick(rng, rows) ?? baseElementIds()[0];
}

function streakFor(bag: SwordBag, ymd: string): number {
  return bag.streakYmd === ymd ? bag.winStreak : 0;
}

export function breakSwordStreak(bag: SwordBag): SwordBag {
  if (bag.winStreak === 0) return bag;
  return { ...bag, winStreak: 0 };
}

/**
 * Grant one drop. The same claim key on the same bag does nothing (a double
 * tap, a retried request, or a second tick of the same win). The roll is
 * seeded by `dropSeq`, so a save that never landed replays the same item.
 */
export function grantSwordDrop(
  bag: SwordBag,
  claimKey: string,
  ctx: Omit<DropContext, 'streak'> & { ymd: string },
): { bag: SwordBag; grant: SwordGrant | null; duplicate: boolean } {
  if (claimKey.length === 0 || bag.claimed.includes(claimKey)) {
    return { bag, grant: null, duplicate: true };
  }
  const streak = streakFor(bag, ctx.ymd) + 1;
  const rng = mulberry32(bag.dropSeq);
  const rolled = rollSwordDrop(rng, { ...ctx, streak });
  let next: SwordBag = {
    ...bag,
    dropSeq: bag.dropSeq + 1,
    claimed: [...bag.claimed, claimKey].slice(-CONFIG.drops.claimRing),
    winStreak: streak,
    streakYmd: ctx.ymd,
  };
  if (rolled.kind === 'none') return { bag: next, grant: null, duplicate: false };
  if (rolled.kind === 'relic') {
    if (next.relics.length >= CONFIG.drops.bag.relics) {
      return {
        bag: next,
        grant: { kind: 'relic', name: relicName(rolled.element), element: rolled.element, tier: null, bagFull: true },
        duplicate: false,
      };
    }
    const minted = mint(next);
    next = { ...minted.bag, relics: [...minted.bag.relics, { uid: minted.uid, element: rolled.element }] };
    return {
      bag: next,
      grant: { kind: 'relic', name: relicName(rolled.element), element: rolled.element, tier: null, bagFull: false },
      duplicate: false,
    };
  }
  if (next.swords.length >= CONFIG.drops.bag.swords) {
    return {
      bag: next,
      grant: {
        kind: 'sword',
        name: swordName(rolled.element, rolled.tier),
        element: rolled.element,
        tier: rolled.tier,
        bagFull: true,
      },
      duplicate: false,
    };
  }
  const minted = mint(next);
  const created = { uid: minted.uid, element: rolled.element, tier: rolled.tier };
  next = { ...minted.bag, swords: [...minted.bag.swords, created] };
  return {
    bag: next,
    grant: { kind: 'sword', name: swordName(rolled.element, rolled.tier), element: rolled.element, tier: rolled.tier, bagFull: false },
    duplicate: false,
  };
}

export type SwordRuntime = {
  element: string;
  tier: SwordTier;
  name: string;
  color: string;
  label: string;
  auraLabel: string;
  cooldownMult: number;
  strikeMult: number;
  bossMult: number;
  burnDpsShare: number;
  burnMs: number;
  slowFactor: number;
  slowMs: number;
  knockFrac: number;
  scrapOnHit: number;
  chain: number;
  chainShare: number;
  chainRange: number;
  splashRadius: number;
  splashShare: number;
  shredMs: number;
  status: KitElement;
  divine: boolean;
  superRadius: number;
  superMult: number;
  auraRadius: number;
  auraSpeed: number;
  auraDamage: number;
  auraBoss: number;
  auraSlow: number;
  auraSlowMs: number;
  auraBurn: number;
  auraKnock: number;
  auraChain: number;
  auraChainShare: number;
  auraScrap: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Effect numbers for one equipped sword, already run through the caps. */
export function swordRuntime(element: string, tier: SwordTier): SwordRuntime | null {
  const row = BY_ID.get(element);
  if (!row || !isSwordTier(tier)) return null;
  const scale = CONFIG.tierScale[tier];
  const bumped = tier === 'legendary' || tier === 'divine' ? 1 + CONFIG.legendaryBump : 1;
  const mag = scale * bumped;
  const c = CONFIG.caps;
  const combat = row.combat;
  const aura = row.aura;
  return {
    element,
    tier,
    name: swordName(element, tier),
    color: row.color,
    label: row.label,
    auraLabel: row.auraLabel,
    cooldownMult: clamp(1 - combat.haste * mag, c.cooldownMultMin, 1),
    strikeMult: clamp(1 + (tier === 'legendary' || tier === 'divine' ? CONFIG.legendaryDamage : 0), 1, c.strikeMultMax),
    bossMult: clamp(1 + combat.boss * mag, 1, c.bossMultMax),
    burnDpsShare: clamp(combat.burn * mag, 0, c.burnDpsShareMax),
    burnMs: clamp(combat.burnMs * (combat.burn > 0 ? mag : 0), 0, c.burnMsMax),
    slowFactor: clamp(1 - combat.slow * mag, c.slowFactorMin, 1),
    slowMs: clamp(combat.slowMs * (combat.slow > 0 ? mag : 0), 0, c.slowMsMax),
    knockFrac: clamp(combat.knock * mag, 0, c.knockFracMax),
    scrapOnHit: combat.scrap > 0 ? c.scrapOnHitMax : 0,
    chain: clamp(Math.round(combat.chain), 0, c.chainMax),
    chainShare: clamp(combat.chainShare * mag, 0, c.chainShareMax),
    chainRange: CONFIG.chainRange,
    splashRadius: clamp(combat.splash * mag, 0, c.splashRadiusMax),
    splashShare: clamp(combat.splashShare * mag, 0, c.splashShareMax),
    shredMs: clamp(combat.shredMs * (combat.shredMs > 0 ? mag : 0), 0, c.shredMsMax),
    status: row.status,
    divine: tier === 'divine',
    superRadius: tier === 'divine' ? CONFIG.super.radius : 0,
    superMult: tier === 'divine' ? CONFIG.super.damageMult : 0,
    auraRadius: c.auraRadius,
    auraSpeed: clamp(1 + aura.speed * mag, 1, c.auraSpeedMax),
    auraDamage: clamp(1 + aura.damage * mag, 1, c.auraDamageMax),
    auraBoss: clamp(1 + aura.boss * mag, 1, c.auraBossMax),
    auraSlow: clamp(1 - aura.slow * mag, c.auraSlowMin, 1),
    auraSlowMs: clamp(aura.slowMs * (aura.slow > 0 ? mag : 0), 0, c.auraSlowMsMax),
    auraBurn: clamp(aura.burn * mag, 0, c.auraBurnMax),
    auraKnock: clamp(aura.knock * mag, 0, c.auraKnockMax),
    auraChain: clamp(Math.round(aura.chain), 0, c.auraChainMax),
    auraChainShare: aura.chain > 0 ? c.auraChainShare : 0,
    auraScrap: aura.scrap > 0 ? Math.min(c.auraScrapMax, 1) : 0,
  };
}

export type AuraNumbers = {
  speed: number;
  damage: number;
  boss: number;
  slow: number;
  slowMs: number;
  burn: number;
  knock: number;
  chain: number;
  scrap: number;
};

/** Combine several auras and clamp. Combat passes a single aura; the cap is
 * what stops a future stack from becoming unbeatable. */
export function stackAuras(parts: readonly AuraNumbers[]): AuraNumbers {
  let speed = 1;
  let damage = 1;
  let boss = 1;
  let slow = 1;
  let slowMs = 0;
  let burn = 0;
  let knock = 0;
  let chain = 0;
  let scrap = 0;
  for (const part of parts) {
    speed *= part.speed;
    damage *= part.damage;
    boss *= part.boss;
    if (part.slow < slow) slow = part.slow;
    slowMs = Math.max(slowMs, part.slowMs);
    burn = Math.max(burn, part.burn);
    knock = Math.max(knock, part.knock);
    chain = Math.max(chain, part.chain);
    scrap += part.scrap;
  }
  const c = CONFIG.caps;
  return {
    speed: clamp(speed, 1, c.auraSpeedMax),
    damage: clamp(damage, 1, c.auraDamageMax),
    boss: clamp(boss, 1, c.auraBossMax),
    slow: clamp(slow, c.auraSlowMin, 1),
    slowMs: clamp(slowMs, 0, c.auraSlowMsMax),
    burn: clamp(burn, 0, c.auraBurnMax),
    knock: clamp(knock, 0, c.auraKnockMax),
    chain: clamp(Math.floor(chain), 0, c.auraChainMax),
    scrap: clamp(Math.floor(scrap), 0, c.auraScrapMax),
  };
}

export function auraOfRuntime(sword: SwordRuntime): AuraNumbers {
  return {
    speed: sword.auraSpeed,
    damage: sword.auraDamage,
    boss: sword.auraBoss,
    slow: sword.auraSlow,
    slowMs: sword.auraSlowMs,
    burn: sword.auraBurn,
    knock: sword.auraKnock,
    chain: sword.auraChain,
    scrap: sword.auraScrap,
  };
}

export type SwordGroup = {
  element: string;
  tier: SwordTier;
  name: string;
  color: string;
  count: number;
  sampleUid: number;
  canUpgrade3: boolean;
  canUpgrade5: boolean;
  canLegendary: boolean;
  canDivine: boolean;
  relics: number;
};

export type SwordPanel = {
  equipped: {
    uid: number;
    element: string;
    tier: SwordTier;
    name: string;
    color: string;
    label: string;
    auraLabel: string;
  } | null;
  groups: SwordGroup[];
  relics: { element: string; name: string; count: number }[];
  canUndo: boolean;
  swords: number;
  swordCap: number;
  relicCount: number;
  relicCap: number;
};

export function swordPanel(bag: SwordBag): SwordPanel {
  const equipped = bag.swords.find((s) => s.uid === bag.equipped) ?? null;
  const groups: SwordGroup[] = [];
  for (const row of CONFIG.elements) {
    for (const tier of SWORD_TIERS) {
      const copies = bag.swords.filter((s) => s.element === row.id && s.tier === tier);
      if (copies.length === 0) continue;
      const free = copies.filter((s) => s.uid !== bag.equipped).length;
      const relics = bag.relics.filter((r) => r.element === row.id).length;
      groups.push({
        element: row.id,
        tier,
        name: swordName(row.id, tier),
        color: row.color,
        count: copies.length,
        sampleUid: copies[0].uid,
        canUpgrade3: CONFIG.upgradeFrom.includes(tier) && free >= 3,
        canUpgrade5: CONFIG.upgradeFrom.includes(tier) && free >= 5,
        canLegendary: tier === 'epic' && row.kind === 'mix' && free >= 1 && relics >= CONFIG.legendary.relics,
        canDivine: tier === 'legendary' && free >= 1 && relics >= CONFIG.divine.relics,
        relics,
      });
    }
  }
  const relicMap = new Map<string, number>();
  for (const relic of bag.relics) relicMap.set(relic.element, (relicMap.get(relic.element) ?? 0) + 1);
  return {
    equipped: equipped
      ? {
          uid: equipped.uid,
          element: equipped.element,
          tier: equipped.tier,
          name: swordName(equipped.element, equipped.tier),
          color: BY_ID.get(equipped.element)?.color ?? '#FFFFFF',
          label: BY_ID.get(equipped.element)?.label ?? '',
          auraLabel: BY_ID.get(equipped.element)?.auraLabel ?? '',
        }
      : null,
    groups,
    relics: [...relicMap.entries()].map(([element, count]) => ({ element, name: relicName(element), count })),
    canUndo: bag.undo != null,
    swords: bag.swords.length,
    swordCap: CONFIG.drops.bag.swords,
    relicCount: bag.relics.length,
    relicCap: CONFIG.drops.bag.relics,
  };
}

export type SwordCatalogRow = {
  element: string;
  kind: SwordElementKind;
  tier: SwordTier;
  name: string;
  color: string;
  label: string;
  auraLabel: string;
};

/** Every element × tier, for the dev list. */
export function swordCatalog(): SwordCatalogRow[] {
  const rows: SwordCatalogRow[] = [];
  for (const row of CONFIG.elements) {
    for (const tier of SWORD_TIERS) {
      rows.push({
        element: row.id,
        kind: row.kind,
        tier,
        name: swordName(row.id, tier),
        color: row.color,
        label: row.label,
        auraLabel: row.auraLabel,
      });
    }
  }
  return rows;
}

export type DropSimResult = {
  trials: number;
  rareMedianDays: number;
  relicMedianDays: number;
  divineMedianDays: number;
  divineWithinYear: number;
};

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/**
 * Seeded "regular player" sim. One day is the config's defend wins, mini-game
 * wins, and dives. Streak resets each morning, matching the bag's day rule.
 */
export function simulateDropDays(): DropSimResult {
  const sim = CONFIG.sim;
  const rareDays: number[] = [];
  const relicDays: number[] = [];
  const divineDays: number[] = [];
  let divineWithinYear = 0;
  for (let trial = 0; trial < sim.trials; trial += 1) {
    const rng = mulberry32((sim.seed + trial * 9973) >>> 0);
    let rare = 0;
    let relic = 0;
    let divine = 0;
    for (let day = 1; day <= sim.maxDays && (rare === 0 || relic === 0 || divine === 0); day += 1) {
      let streak = 0;
      const steps: DropSource[] = [];
      for (let i = 0; i < sim.defendWinsPerDay; i += 1) steps.push('defend');
      for (let i = 0; i < sim.minigameWinsPerDay; i += 1) steps.push('minigame');
      for (let i = 0; i < sim.divesPerDay; i += 1) steps.push('dive');
      for (const source of steps) {
        streak += 1;
        const boss = source === 'defend' && rng() < sim.bossChance;
        const highWave = source === 'defend' && !boss && rng() < sim.highWaveChance;
        const deep = source === 'dive' && rng() < sim.deepChance;
        const drop = rollSwordDrop(rng, { source, boss, highWave, deep, streak });
        if (rare === 0 && drop.kind === 'sword' && drop.tier === 'rare') rare = day;
        if (relic === 0 && drop.kind === 'relic') relic = day;
        if (divine === 0 && drop.kind === 'sword' && drop.tier === 'divine') divine = day;
      }
    }
    rareDays.push(rare || sim.maxDays);
    relicDays.push(relic || sim.maxDays);
    divineDays.push(divine || sim.maxDays);
    if (divine > 0 && divine <= 365) divineWithinYear += 1;
  }
  return {
    trials: sim.trials,
    rareMedianDays: median(rareDays),
    relicMedianDays: median(relicDays),
    divineMedianDays: median(divineDays),
    divineWithinYear,
  };
}

/** Chance of each kind on one roll, for the check's printed line. */
export function dropChance(ctx: DropContext): { rare: number; relic: number; divine: number } {
  const table = dropTable(ctx);
  const total = table.common + table.rare + table.relic + table.divine;
  if (total <= 0) return { rare: 0, relic: 0, divine: 0 };
  return { rare: table.rare / total, relic: table.relic / total, divine: table.divine / total };
}
