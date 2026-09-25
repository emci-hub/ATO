# Attack effects system — plan of record

Status: **design approved by emci 2026-09-24, nothing built yet.** Replaces the single
Kenney `fx.shot` sprite with a composable kit system. Read this cold — nothing here
depends on chat history.

## Ground truth (verified in code, 2026-09-24, master `25c64b1`)

- Renderer: `react-native-svg` 15.12 board (`<Svg viewBox="0 0 100 100">` in
  `src/play/defend-screen.tsx`), redrawn via React state. Avatar draws outside it with
  `expo-image` + Reanimated. **No Skia.** 16×16 grid → 1 tile ≈ 6.25 board units.
- Damage is applied by the sim (`src/play/defend.ts`) before any FX draws — FX are
  display-only. Keep it that way.
- Shots today: one `Shot` type, `SHOT_SPEED_UNITS_PER_SEC = 95`, `SHOT_DRAW_SCALE = 2.5`,
  `FX_TICK_MS = 33`.
- Range ring: one dashed `<Circle>` in `theme.accent` @ 0.5, selected pad only.
  Ranges: Avatar 15, vine 16, archer 18, crystal / hero tower / bound boss 20.
- Heroes: 16, all sharing `HERO_TOWER_STATS` and one skill shape (slow "Veil" pulse,
  `src/play/data/skills.json`) — only the copy differs.
- Enemies: `Puff` has a single `slowMs`/`slowFactor`; roles swarm/runner/tank/boss;
  ≤11 per wave today (cycle power scales count).
- Elements: `src/play/engine/type-match.ts` — 4 locked tags (Tide/Ember/Root/Spark),
  soft match +20%, no penalty, no immunity.
- Asset count 815 / 1000 per platform. One packed sheet = one asset.
- `skinFootAt` Sentry errors are stale; the sheet-origin bug was placement, not perf.
  Neither sets a perf ceiling.

## Decisions (emci, 2026-09-24 — all recommendations accepted)

1. **Void is a 5th tag OUTSIDE the match cycle** — never gets the match bonus, is never
   weak to anything; its identity is reliable control. Cycle stays Tide → Ember → Root →
   Spark → Tide.
2. **Recolour:** Spark → electric yellow (`#FACC15`), Void takes violet (`#A78BFA`).
   Changes existing Spark chips.
3. **Weakness bonus only** (+25% damage, +50% status duration). No resistance penalty,
   no immunity.
4. **SVG first.** Build an FPS readout + stress preset in Dev Lab before any effect;
   Skia only if SVG fails that test (Skia = new native dep → needs emci's ok + a build).

## Elements

| Element | Tag | Colour | Rider (secondary effect) |
|---|---|---|---|
| Fire | Ember | `#FB923C` | Burn — small DoT |
| Ice | Tide | `#38BDF8` | Chill — slow |
| Lightning | Spark | `#FACC15` | Arc — hops to 1 nearby enemy for 30% |
| Nature | Root | `#34D399` | Snare — brief root; +25% vs tank |
| Gravity | Void | `#A78BFA` | Shred — +15% damage taken 3s; path knockback |

## Behaviors × elements

| Behavior (base range) | Ember | Tide | Spark | Root | Void |
|---|---|---|---|---|---|
| Burst (20) | Flame lance | Ice spike | Rail bolt (+1 arc) | Thorn shot | Execution (shred) |
| Splash (16, r 6) | Firebomb (burning ground 2s) | Frost nova | Thunderclap (stun centre) | Bramble burst | Implosion (pull in) |
| DoT (18) | Ignite (fast ticks) | Frostbite | Static (ticks arc) | Venom (stacks once) | Soul drain |
| Slow (17) | Tar | Deep freeze | EMP (brief stun) | Root veil | Stasis field |
| Chain (22, bounce 9) | Wildfire | Frost chain (bounce 6, chills) | Chain lightning (+1 bounce) | Vine lash | Void chain |
| Pull (14) | Solar flare | Undertow | Magnet | Grasping roots | Black hole (+DoT tick) |

- **Ultimate = own behavior + a second element at 50% rider strength** (e.g. Morwen
  Pull/Tide + Void = "Frosted Gravity"). Derived from data, no per-hero code.
- **Delivery skin** (bullet / beam / orb / slash) is cosmetic only — covers "guns".

## Roster kits

| Behavior | Heroes |
|---|---|
| Burst | archangel (Ember), oni (Spark), raven (Void) |
| Splash | aurex (Ember), frost-lich (Tide), sak (Root) |
| DoT | kitsune (Ember), neon-viper (Root), maldrath (Void) |
| Slow | corvus (Root), elowen (Tide), kael (Spark) |
| Chain | cyber-shinobi (Spark), velkhar (Void) |
| Pull | morwen (Tide), void-raven (Void) |

Plain towers: archer = Burst/none, vine = Slow/Root, crystal = Burst/Spark.

## Rules

**Weakness:** each wave group may carry a tint (ring on the enemy + wave preview).
Matching the enemy's weakness = +25% damage, +50% status duration. Void never matches.

**Targeting**
- Burst: First by default; toggle Strongest / Weakest.
- Splash: most enemies within splash radius; tie → furthest along.
- DoT: an enemy without this tower's DoT (or soonest to expire); tie → First.
- Slow: fastest un-slowed enemy; tie → First.
- Chain: First, then nearest un-hit enemy within bounce radius; −15% per bounce.
- Pull: furthest-along non-boss. Pull = move back along the path (`dist −= k`) or hold
  at a path point — never free 2D movement.

**Stacking (independent channels)**
- Speed: strongest slow wins, longest duration; floor 30% speed (boss 50%).
- DoT: same element refreshes; different elements coexist, max 2 per enemy (oldest out).
- Displacement: repeat within 3s is 50% as strong; bosses 25%.
- Stun/snare: 1s immunity after it ends.
- Reactions: a fixed table of 4 max (e.g. Chill + Ember hit = Shatter).

**Level scaling (TOWER_MAX_LEVEL 3)**
- Burst: damage ×1.0 / 1.35 / 1.8.
- Splash: radius +15%/level + damage.
- DoT: tick damage + duration; 2nd stack at L3.
- Slow: 30 → 40 → 50% + duration.
- Chain: bounces 3 → 4 → 6.
- Pull: distance + cooldown; hold at L3.
- Range +0/+1/+2 except Splash and Pull. Element rider + visual step up at L3.

**Range ring:** keep the dashed style, stroke = element colour, show while placing as
well as selected; Pull adds a faint filled core. Check on device: towers draw ~21 units
vs ranges 16–20 — consider expressing ranges in tiles.

## Performance budget (estimate — confirm with the FPS test)

- ≤12 live effects, ≤~70 extra SVG primitives total; oldest cosmetic dropped first.
- Chain ≤4 bounces, 2 paths (glow + core), 150ms life. Pull/black hole 3 primitives.
- Particles ≤16 board-wide. Status (burn/slow) = tint the creep's existing ring, no
  new elements.
- Biggest lever: merge the ~5 display `setInterval`s into one render tick.

## Visual technique (SVG)

Glow = 3 stacked strokes (wide faint, mid, thin white core) — no blur filters.
3 tones per element from its tag colour. Lightning = jagged polyline re-randomised per
frame. Void = dark core, bright rim, counter-rotating dashed rings. Hit = 1–2 frame
white flash + small scale punch. 100–200ms charge-up on Burst and ultimates. Screen
shake ultimates only. Fire is the one element that looks cheap as vectors → one
flame/explosion sprite sheet (+1 asset; optional leaf sheet +1).

## Build order

1. Dev Lab FPS readout + stress preset (full wave + 12 effects). Set real caps on device.
2. Merge display tickers into one render tick.
3. Kit data (`behavior` + `element` per hero/tower in JSON) + Void tag + Spark recolour.
4. Sim: status channels, targeting per behavior, weakness.
5. FX layer: one renderer per behavior, element palette/rider on top, global cap.
6. Element range rings. 7. Fire sprite sheet. 8. Ultimates.
