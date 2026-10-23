# Per-hero Locker — balance (pet team P6, 2026-10-18)

Gear used to sit on the five elemental Legend records. It now sits on **heroes** (`hero_gear`, four slots each:
weapon, armor, cloak, trinket). Same items, same bag, same star scaling. What changed is who wears them.

## The table

| Thing | Rule | Number |
|---|---|---|
| Slots per hero | weapon, armor, cloak, trinket | 4 |
| Wearers per item copy | a worn copy leaves the bag, so one hero at a time | 1 |
| Item stats | unchanged: `mult_a` / `mult_b` × (1 + 10% per star) | — |
| Gear match | an item whose element matches the **active Legend's** element is raised | +100% (Sane `gearMatchBonus` 1.0) |
| Soft cap (wave_power) | one bucket per wearer, same formula for leader and helper | ×2.0, then +25% strength past it |
| Leader's gear | feeds the whole board, exactly as before (towers, bound bosses, hero towers, the leader's hits) | unchanged |
| Helper's gear | its own wave_power bucket, multiplied onto the helper's hits and its skill damage only | ×1.0 with no gear, up to the ×2.0 soft cap (+ the tail) |
| Helper with no gear | still gets the board multiplier (the leader's gear) and its stars, like P5b | no nerf |
| Towers / bound bosses | never read the helper's gear | — |
| Dive luck, Gear Score | read the **leader's** gear | — |
| Swords | untouched: still tint the aura, still their own bag | — |

So a fully geared helper hits at most about **×2.0 harder than an ungeared one** (before the tail), on top of the
board multiplier and its stars (+6%/★). A fully geared leader already gave that to the entire board, so the helper
gear is the smaller lever on purpose: it never beats the leader's gear and cannot stack with itself.

## Migration (no gear lost)

Runs once on load (`gear_moved`), additive on the v33 save. It waits for P4's leader fold (`leader_folded`), so the
gear lands on the hero that really leads; until then the gear stays on the Legend records (still counted, nothing lost)
and the move retries on the next load.

1. The **active Legend's** worn gear goes to the Turf leader's hero.
2. Every **other** Legend's worn gear goes back to the **bag**. A Legend has no hero, so any mapping would be a guess;
   the player re-dresses.
3. A slot the hero already wears keeps its item; the older one goes to the bag.
4. The Legend records end with empty `equipped`. Total owned (bag + worn) is unchanged, so the 80-item soft cap
   behaves the same.

Edge: an item whose id no longer exists in the item data is dropped by the move (same rule `unequipItem` already
has for a corrupt id); ordinary items are never dropped. Gear stuck on a hero the save no longer owns (only a dev
tool can do this) still shows that hero in the Locker and can be taken off.

Known edge: a phone still on the P5b bundle that opens and re-saves a migrated save drops the unknown `hero_gear`
field, and those worn items would vanish. Every phone gets this OTA on reopen, so this was accepted (emci, 2026-10-18).

## P5b notes looked at (tune in P6)

- **Neon Maze follow spots:** in a few road knots there is no off-road point within the leash, so the helper stands up to
  ~25 from the leader (24 of 3042 grid spots; none on the ato board). Lanes win over the leash. Left as is.
- **Boss re-daze every ~10 s:** a helper parked beside a boss is dazed again about 10 s after it stands (6 s proof + the
  5 s swing timer restarting). Left as is: a boss that long next to a helper is already a long fight. Revisit if the
  phone check says the helper is down too often.

## What the player sees

- Locker: a **Dress which hero?** row (leader and helper first, each chip shows `worn/4`); the Worn and bonus panels
  are titled with that hero. The Legend cards no longer show worn slots.
- Hideout: a small **GEAR n/4** chip on the name tag from 1 worn slot up, inside the one 36 px row.
