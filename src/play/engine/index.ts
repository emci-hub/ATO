/**
 * Forever-engine pure helpers (GAME_SPEC forever-engine stubs) — data shapes
 * only. No combat, campaign, or Bound-Boss systems are wired: these are the
 * math homes the future engine reads from (StarTable, DropTable, SoftCap,
 * CycleScaler), each backed by a JSON stub under `src/play/data/`.
 *
 * `cycle.ts` is already read by `playStore.ts` (cycle_power defaults); the
 * other three are exported here ready for when their systems land.
 */
export { CycleScaler, cyclePower, cyclePowerStep, defaultCyclePower } from './cycle';
export {
  DropTable,
  DropRoll,
  getDropTable,
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
