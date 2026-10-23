/**
 * Thin wrapper — `art:pack` is the packer. Kept for one release so existing
 * `npx tsx scripts/play-art-pack.ts --skin streetwear` commands keep working.
 *
 * SW_WALK_ORDER = ['north', 'east', 'south', 'west']
 * group === 'heroes' && clip.name === 'Walk'
 */
import './art-pack';
