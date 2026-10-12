/**
 * 3/4 top-down Hideout pathing — 12px collision grid, A* (8-neighbour, no
 * corner cutting), string-pull / line-of-sight smoothing.
 *
 * Collision and depth sort use each prop's floor footprint (guide rule 9).
 * The pet's feet never cross a blocked tile. Clearance is the current
 * stage's floor-contact disk; room/prop footprints stay fixed.
 */
export type Pt = readonly [number, number];

export type CollisionGrid = {
  tile: number;
  cols: number;
  rows: number;
  /** row-major, `rows` strings of `cols` `'1'` (walk) / `'0'` (block). */
  walkable: readonly string[];
};

const SQRT2 = Math.SQRT2;
const N8: readonly (readonly [number, number, number])[] = [
  [0, -1, 1],
  [1, 0, 1],
  [0, 1, 1],
  [-1, 0, 1],
  [1, -1, SQRT2],
  [1, 1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

export function tileCol(x: number, tile: number): number {
  return Math.floor(x / Math.max(1, tile));
}
export function tileRow(y: number, tile: number): number {
  return Math.floor(y / Math.max(1, tile));
}
export function tileCenter(col: number, row: number, tile: number): Pt {
  return [(col + 0.5) * tile, (row + 0.5) * tile];
}

export function isWalkableCell(grid: CollisionGrid, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
  return (grid.walkable[row]?.[col] ?? '0') === '1';
}

export function isWalkableArt(grid: CollisionGrid, x: number, y: number): boolean {
  return isWalkableCell(grid, tileCol(x, grid.tile), tileRow(y, grid.tile));
}

/**
 * Shrink walkable cells so a disk of radius `clearancePx` around the feet
 * never overlaps a blocked tile. Room/prop footprints stay fixed; only the
 * current pet stage's floor contact changes this inset.
 */
export function withClearance(grid: CollisionGrid, clearancePx: number): CollisionGrid {
  const r = Math.max(0, clearancePx);
  if (r <= 0) return grid;
  const r2 = r * r;
  const rows: string[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    let s = '';
    for (let col = 0; col < grid.cols; col += 1) {
      if (!isWalkableCell(grid, col, row)) {
        s += '0';
        continue;
      }
      const [cx, cy] = tileCenter(col, row, grid.tile);
      const c0 = tileCol(cx - r, grid.tile);
      const c1 = tileCol(cx + r, grid.tile);
      const r0 = tileRow(cy - r, grid.tile);
      const r1 = tileRow(cy + r, grid.tile);
      let ok = true;
      outer: for (let rr = r0; rr <= r1; rr += 1) {
        for (let cc = c0; cc <= c1; cc += 1) {
          if (isWalkableCell(grid, cc, rr)) continue;
          const x0 = cc * grid.tile;
          const y0 = rr * grid.tile;
          const x1 = x0 + grid.tile;
          const y1 = y0 + grid.tile;
          const nx = Math.max(x0, Math.min(cx, x1));
          const ny = Math.max(y0, Math.min(cy, y1));
          const dx = cx - nx;
          const dy = cy - ny;
          if (dx * dx + dy * dy <= r2) {
            ok = false;
            break outer;
          }
        }
      }
      s += ok ? '1' : '0';
    }
    rows.push(s);
  }
  return { tile: grid.tile, cols: grid.cols, rows: grid.rows, walkable: rows };
}

/** Nearest walkable tile centre. */
export function clampToGrid(grid: CollisionGrid, x: number, y: number): Pt {
  if (isWalkableArt(grid, x, y)) return [x, y];
  const c0 = tileCol(x, grid.tile);
  const r0 = tileRow(y, grid.tile);
  let best: Pt | null = null;
  let bestD = Infinity;
  const reach = Math.max(grid.cols, grid.rows);
  for (let rad = 0; rad <= reach; rad += 1) {
    for (let dc = -rad; dc <= rad; dc += 1) {
      for (let dr = -rad; dr <= rad; dr += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (!isWalkableCell(grid, c, r)) continue;
        const p = tileCenter(c, r, grid.tile);
        const d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
        if (d < bestD) {
          best = p;
          bestD = d;
        }
      }
    }
    if (best) return best;
  }
  return [x, y];
}

function allowSet(allow?: readonly Pt[], tile = 12): Set<string> {
  const s = new Set<string>();
  for (const p of allow ?? []) s.add(`${tileCol(p[0], tile)}:${tileRow(p[1], tile)}`);
  return s;
}

function cellOk(grid: CollisionGrid, c: number, r: number, extra?: Set<string>): boolean {
  return isWalkableCell(grid, c, r) || extra?.has(`${c}:${r}`) === true;
}

function canStep(
  grid: CollisionGrid,
  c: number,
  r: number,
  nc: number,
  nr: number,
  extra?: Set<string>,
): boolean {
  if (!cellOk(grid, nc, nr, extra)) return false;
  const dc = nc - c;
  const dr = nr - r;
  if (dc !== 0 && dr !== 0) {
    // No corner cutting: both adjacent cardinals must be open.
    if (!cellOk(grid, c + dc, r, extra) || !cellOk(grid, c, r + dr, extra)) return false;
  }
  return true;
}

/**
 * Supercover-ish LOS on the grid. The segment between two art-px points is
 * clear iff every tile it crosses is walkable and no diagonal step cuts a corner.
 */
export function lineOfSight(grid: CollisionGrid, a: Pt, b: Pt, opts?: { allow?: readonly Pt[] }): boolean {
  const tile = grid.tile;
  const extra = allowSet(opts?.allow, tile);
  const c0 = tileCol(a[0], tile);
  const r0 = tileRow(a[1], tile);
  const c1 = tileCol(b[0], tile);
  const r1 = tileRow(b[1], tile);
  if (!cellOk(grid, c0, r0, extra) || !cellOk(grid, c1, r1, extra)) return false;
  const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0), 1) * 2;
  const x0 = a[0] / tile;
  const y0 = a[1] / tile;
  const dx = b[0] / tile - x0;
  const dy = b[1] / tile - y0;
  let pc = c0;
  let pr = r0;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const c = Math.floor(x0 + dx * t);
    const r = Math.floor(y0 + dy * t);
    if (!cellOk(grid, c, r, extra)) return false;
    if (!canStep(grid, pc, pr, c, r, extra) && (c !== pc || r !== pr)) return false;
    pc = c;
    pr = r;
  }
  return true;
}

/** True when every sample along the polyline sits on a walkable (or allow) tile. */
export function pathClear(
  grid: CollisionGrid,
  path: readonly Pt[],
  stepPx = 2,
  opts?: { allow?: readonly Pt[] },
): boolean {
  if (path.length === 0) return false;
  const extra = allowSet(opts?.allow, grid.tile);
  const artOk = (x: number, y: number) =>
    cellOk(grid, tileCol(x, grid.tile), tileRow(y, grid.tile), extra);
  for (let i = 0; i < path.length; i += 1) {
    if (!artOk(path[i][0], path[i][1])) return false;
  }
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(dist / Math.max(1, stepPx)));
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      if (!artOk(x, y)) return false;
    }
    if (!lineOfSight(grid, a, b, opts)) return false;
  }
  return true;
}

type Node = { c: number; r: number; g: number; f: number; i: number };

/**
 * A* on the collision grid. `allow` tiles (e.g. a sleep-on-bed cell) may be
 * entered as the goal even when they are blocked for roam.
 */
export function astar(
  grid: CollisionGrid,
  from: Pt,
  to: Pt,
  opts?: { allow?: readonly Pt[] },
): Pt[] | null {
  const tile = grid.tile;
  const startC = tileCol(from[0], tile);
  const startR = tileRow(from[1], tile);
  const goalC = tileCol(to[0], tile);
  const goalR = tileRow(to[1], tile);
  const extra = allowSet(opts?.allow, tile);
  const ok = (c: number, r: number) => cellOk(grid, c, r, extra);
  if (!ok(startC, startR) || !ok(goalC, goalR)) return null;

  const key = (c: number, r: number) => r * grid.cols + c;
  const open: Node[] = [{ c: startC, r: startR, g: 0, f: 0, i: -1 }];
  const came = new Int32Array(grid.cols * grid.rows).fill(-1);
  const bestG = new Float64Array(grid.cols * grid.rows).fill(Infinity);
  bestG[key(startC, startR)] = 0;
  const heur = (c: number, r: number) => {
    const dc = Math.abs(c - goalC);
    const dr = Math.abs(r - goalR);
    return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr);
  };
  open[0].f = heur(startC, startR);

  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i].f < open[best].f) best = i;
    const cur = open[best]!;
    open[best] = open[open.length - 1]!;
    open.pop();
    if (cur.c === goalC && cur.r === goalR) {
      const cells: [number, number][] = [[cur.c, cur.r]];
      let i = cur.i;
      while (i >= 0) {
        const cc = i % grid.cols;
        const rr = (i / grid.cols) | 0;
        cells.push([cc, rr]);
        i = came[i]!;
      }
      cells.reverse();
      const pts: Pt[] = cells.map(([c, r]) => tileCenter(c, r, tile));
      if (pts.length > 0) {
        pts[0] = [from[0], from[1]];
        pts[pts.length - 1] = [to[0], to[1]];
      }
      return pts;
    }
    const ci = key(cur.c, cur.r);
    for (const [dc, dr, cost] of N8) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (!ok(nc, nr)) continue;
      if (dc !== 0 && dr !== 0) {
        if (!ok(cur.c + dc, cur.r) || !ok(cur.c, cur.r + dr)) continue;
      }
      const ni = key(nc, nr);
      const g = cur.g + cost;
      if (g >= bestG[ni]!) continue;
      bestG[ni] = g;
      came[ni] = ci;
      open.push({ c: nc, r: nr, g, f: g + heur(nc, nr), i: ci });
    }
  }
  return null;
}

/** Funnel / string-pull: skip waypoints that have a clear line of sight. */
export function stringPull(grid: CollisionGrid, path: readonly Pt[], opts?: { allow?: readonly Pt[] }): Pt[] {
  if (path.length <= 2) return path.map((p) => [p[0], p[1]] as Pt);
  const out: Pt[] = [[path[0][0], path[0][1]]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !lineOfSight(grid, path[i], path[j], opts)) j -= 1;
    out.push([path[j][0], path[j][1]]);
    i = j;
  }
  return out;
}

export function route(
  grid: CollisionGrid,
  from: Pt,
  to: Pt,
  opts?: { allow?: readonly Pt[] },
): Pt[] | null {
  const raw = astar(grid, from, to, opts);
  if (!raw || raw.length < 2) return raw;
  const pulled = stringPull(grid, raw, opts);
  return pulled;
}

export function randomWalkable(grid: CollisionGrid, rng: () => number): Pt | null {
  const cells: [number, number][] = [];
  for (let r = 0; r < grid.rows; r += 1) {
    for (let c = 0; c < grid.cols; c += 1) {
      if (isWalkableCell(grid, c, r)) cells.push([c, r]);
    }
  }
  if (cells.length === 0) return null;
  const pick = cells[Math.floor(rng() * cells.length)] ?? cells[0];
  return tileCenter(pick[0], pick[1], grid.tile);
}

export function walkableCount(grid: CollisionGrid): number {
  let n = 0;
  for (let r = 0; r < grid.rows; r += 1) {
    for (let c = 0; c < grid.cols; c += 1) if (isWalkableCell(grid, c, r)) n += 1;
  }
  return n;
}
