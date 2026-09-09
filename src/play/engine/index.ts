/**
 * Forever-engine pure helpers (GAME_SPEC §9l). The math homes the runtime reads
 * from: StarTable (merge/star scaling), DropTable (weighted drops + uniques),
 * SoftCap (diminishing soft caps), CycleScaler (Conquered power climb), and —
 * since Phase C — TypeTag (soft type match) + BossBand (Main 9/10/19/20).
 * Each is backed by a JSON stub under `src/play/data/`.
 */
export { CycleScaler, cyclePower, cyclePowerStep, defaultCyclePower } from './cycle';
export {
  DropTable,
  DropRoll,
  DropPreviewRow,
  getDropTable,
  isUniqueDrop,
  previewDropTable,
  rollDropById,
  rollDropTable,
} from './drop-table';
export {
  DEFAULT_SOFT_CAP,
  SoftCap,
  applySoftCap,
  diminishAdd,
  softCapMultiplier,
} from './soft-cap';
export {
  STAR_TABLE,
  StarRow,
  maxStar,
  starMergeSuccess,
  starMultScale,
  starRow,
} from './star-table';
export {
  TYPE_MATCH_CYCLE,
  TYPE_TAGS,
  TAG_COLOR,
  TAG_ICON,
  TAG_LABEL,
  TypeTag,
  isTypeTag,
  typeMatchBonus,
} from './type-match';
export {
  BossBand,
  BossBandKind,
  BossBurst,
  allBossBands,
  bossBandFor,
} from './bands';
export {
  GEAR_SCORE_LEVEL_STEP,
  GEAR_SCORE_STAR_STEP,
  RECOMMENDED_WAVE_ONE,
  gearScore,
  recommendedBase,
  recommendedGs,
} from './gear-score';
export {
  BOUND_BOSS_MAX_STAR,
  BoundBossDef,
  BoundBossSkill,
  BoundBossSkillId,
  allBoundBossDefs,
  boundBossFragmentCost,
  boundBossStarDamage,
  boundBossStarSkillCdScale,
  defaultBoundBossId,
  getBoundBossDef,
} from './bound-boss';
