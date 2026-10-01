/**
 * Mini-game score sim (v26, Part C · T-C3) — plays the REAL rules
 * (`pet-game-rules.ts`) with simple players and prints score percentiles per
 * game × level × skill, the pass rate, and the medal thresholds it suggests:
 *   Bronze ≈ a casual player's median (skill 0.60)
 *   Silver ≈ a good player's median   (skill 0.75)
 *   Gold   ≈ a great player's median  (skill 0.88); Insane Gold ≈ an expert's
 *            median (0.95) — really hard, but reachable.
 * It also checks the saved MEDAL_SCORES rise level by level (a harder level
 * never has a lower bar than the one below it).
 *
 * Player model (stated): Catch — each food is caught with p = skill + level
 * shift − 0.12 × (share of the round gone); a bomb is tapped by mistake with
 * 0.12 × (1 − skill) + 0.01. Train — a tap hits with p = skill × zone/0.30 ×
 * √(0.9 / speed) (max 0.98); a hit is perfect with 0.35 × skill.
 *
 * Run: npm run sim:games
 */
import { DIFFICULTIES, CATCH, EMPTY_CATCH, catchFood, catchOutcome, catchScore, catchSpawnGapMs, catchSpawnKind, missFood, seededRng, startTrain, tapBomb, trainOutcome, trainScore, trainTap, type Difficulty } from '../src/play/pet-game-rules';
import { MEDAL_SCORES } from '../src/play/game-records';

const LEVEL_SHIFT: Record<Difficulty, number> = { easy: 0.04, normal: 0, hard: -0.05, insane: -0.1 };
const SKILLS = [0.6, 0.75, 0.88, 0.95] as const;
const N = 3000;

function catchRound(level: Difficulty, skill: number, rng: () => number) {
  let t = EMPTY_CATCH;
  let elapsed = 0;
  while (elapsed < CATCH.roundMs - 800 && !t.over) {
    const kind = catchSpawnKind(elapsed, rng(), level);
    if (kind === 'bomb') {
      if (rng() < 0.12 * (1 - skill) + 0.01) t = tapBomb(t);
    } else {
      const p = Math.max(0.05, Math.min(0.99, skill + LEVEL_SHIFT[level] - 0.12 * (elapsed / CATCH.roundMs)));
      t = rng() < p ? catchFood(t, elapsed, kind === 'golden') : missFood(t);
    }
    elapsed += catchSpawnGapMs(elapsed, level);
  }
  return { score: catchScore(t, level), pass: catchOutcome(t).pass };
}

function trainRound(level: Difficulty, skill: number, rng: () => number) {
  let t = startTrain(level);
  while (!t.over) {
    const p = Math.min(0.98, skill * (t.zone / 0.3) * Math.sqrt(0.9 / t.speed));
    const hit = rng() < p;
    t = trainTap(t, hit, level, hit && rng() < 0.35 * skill);
  }
  return { score: trainScore(t, level), pass: trainOutcome(t).pass };
}

const pct = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor(q * (a.length - 1))];
const r5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);

let ok = true;
for (const game of ['catch', 'train'] as const) {
  console.log(`\n## ${game}`);
  for (const level of DIFFICULTIES) {
    const med: number[] = [];
    const cells: string[] = [];
    for (const skill of SKILLS) {
      const rng = seededRng(`sim:${game}:${level}:${skill}`);
      const scores: number[] = [];
      let passes = 0;
      for (let i = 0; i < N; i += 1) {
        const r = game === 'catch' ? catchRound(level, skill, rng) : trainRound(level, skill, rng);
        if (r.pass) {
          scores.push(r.score);
          passes += 1;
        }
      }
      const p50 = scores.length ? pct(scores, 0.5) : 0;
      med.push(p50);
      cells.push(`sk${skill}: pass ${Math.round((100 * passes) / N)}% p50 ${p50} p90 ${scores.length ? pct(scores, 0.9) : 0}`);
    }
    const gold = level === 'insane' ? med[3] : med[2];
    console.log(`${level.padEnd(6)} ${cells.join(' | ')}`);
    console.log(`       suggested B/S/G ${r5(med[0])}/${r5(med[1])}/${r5(gold)} · saved ${MEDAL_SCORES[game][level].join('/')}`);
  }
  for (let i = 1; i < DIFFICULTIES.length; i += 1) {
    const lo = MEDAL_SCORES[game][DIFFICULTIES[i - 1]];
    const hi = MEDAL_SCORES[game][DIFFICULTIES[i]];
    for (let m = 0; m < 3; m += 1) {
      if (hi[m] < lo[m]) {
        ok = false;
        console.log(`!! ${game}: ${DIFFICULTIES[i]} medal ${m} (${hi[m]}) is below ${DIFFICULTIES[i - 1]} (${lo[m]})`);
      }
    }
  }
}
console.log(ok ? '\nsaved medal bars rise level by level ✓' : '\nFIX: a harder level has a lower bar');
