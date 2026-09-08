# Grove — data defs (parked)

Copy the **idle-engine pattern**: everything is a JSON def with a stable `id`. Code only reads ids. New content = new rows, not new systems.

Refs we stole the shape from (not dependencies): OpenIdle-Engine modules, Idle Forge resource/item forges, IdleKit currency glossary.

## Files (when we build)

```
data/
  currencies.json
  characters.json      # avatars + towers (actors)
  items.json
  loot_tables.json
  research.json
  waves.json
  enemies.json
```


## Roles (hammered)

| Role | What it is | How it gets stronger | Art |
|---|---|---|---|
| **Avatar** | You. Always on. Dress + commander on Defend. | Equip items (Core+mults). Tiny level from wave clears. | SakPix skin (scaled) |
| **Hero** | Optional ally, **max 1** on board. Paid/unlock later. | Own level + own equipped mults. | SakPix Elite character |
| **Tower** | Path defense, **3 types** max. Small sprites. | In-wave scrap levels 1–3. Shares Avatar `wave_power` / `tower_speed` board-wide. | Small pixel, not full Elite 256 as default |
| **Item** | Gear in Avatar (or Hero) slots. Look or Power. | Dropped from Research / Dive. Not “leveled” — swap for better Core/mults. | Icons / cape pieces |

### Power loop (what makes them stronger)

1. **Dive / Research** → items with mults → equip on Avatar (and later Hero) → board hits harder.
2. **Clear waves** → tokens + tiny XP into Avatar (and active Hero / placed towers).
3. **Spend tokens** → bump a tower level or refresh Dive — not a new system.

Bloons-style wave math is the *enemy* loop. Our *player* loop is items + small levels + tokens. No 12-path upgrade trees.

### SakPix scale on phone

256×256 Elite sheets **scale down fine**. Use nearest-neighbor (or pixel-perfect) so they stay crisp, not blurry. On the TD board use `board_scale` ~0.35–0.5 (one Hero + Avatar). Towers stay smaller assets. Full-res 256 for Grove dress / portrait.

## Engine (fits ATO)

ATO is **Expo / iPhone**. Prefer **same app**: Grove + Defend as a Play screen inside Expo (2D canvas / Pixi or Skia). One TestFlight. Shared token wallet later if we want.

Do **not** start Unity/Godot for v0 unless this becomes a **separate** App Store game. Separate engine = second pipe, second review, second update.

Need from ATO only: Expo already, Play room opens **after ATO gate**, tokens can stay game-local at first.

## Currency

Soft vs hard is the industry split. We start soft-only.

```json
{
  "id": "tokens",
  "kind": "soft",
  "display": "KMB",
  "cap": null,
  "sources": ["tend", "daily_tend_bonus", "dive_surface", "wave_clear"]
}
{
  "id": "dive_charge",
  "kind": "energy",
  "cap": 10,
  "refill_seconds": 600,
  "sources": ["timer", "research_claim"]
}
```

Later hard currency (gems) only if we monetize. Don’t invent it now.

## Character (Avatar + towers)

One player avatar. Towers are separate actors with the same small stat keys.

```json
{
  "id": "avatar_canopy_warden",
  "role": "avatar",
  "slots": ["weapon", "armor", "cloak", "trinket"],
  "base": { "wave_power": 1, "tower_speed": 1 },
  "look_default": "canopy_warden_v1"
}
{
  "id": "tower_archer",
  "role": "tower",
  "base": { "wave_power": 0.6, "tower_speed": 1.1 },
  "unlock_wave": 1
}
```

Stat keys must match the multiplier span: `wave_power`, `tower_speed`, `token_earn`, `dive_luck`, `research_yield`.

## Item (Core + Mult A + Mult B)

```json
{
  "id": "item_leaf_cape_01",
  "core": {
    "slot": "cloak",
    "rarity": "rare",
    "kind": "look",
    "name": "Leaf Cape",
    "art": "cape_leaf_01",
    "type_tag": "bloom"
  },
  "mult_a": null,
  "mult_b": null
}
{
  "id": "item_tide_blade_01",
  "core": {
    "slot": "weapon",
    "rarity": "rare",
    "kind": "power",
    "name": "Tide Blade",
    "art": "blade_tide_01",
    "type_tag": "steel"
  },
  "mult_a": { "stat": "wave_power", "value": 0.08 },
  "mult_b": { "stat": "dive_luck", "value": 0.03 }
}
```

`kind: look` → both mults null. `kind: power` → at least mult_a. Rarity gates whether mult_b can roll.

## Loot table

```json
{
  "id": "loot_dive_step",
  "rolls": [
    { "item": "item_leaf_cape_01", "weight": 40 },
    { "item": "item_tide_blade_01", "weight": 10 },
    { "upgrade_rarity": true, "weight": 25 },
    { "bust": true, "weight": 0 }
  ]
}
```

Live Dive swaps weights each Deeper (bust weight climbs). Research uses a different table with more scrap / fewer power cores.

## Research / timers

```json
{
  "id": "research_default",
  "duration_seconds": 1800,
  "offline_cap_seconds": 36000,
  "loot_table": "loot_research_bag",
  "dive_charge_chance": 0.35
}
```

## Wave / enemy

```json
{
  "id": "wave_3",
  "enemy": "puff_pink",
  "count": 12,
  "hp_mult": 1.4,
  "token_reward": 120,
  "type_tint": "bloom"
}
```

## Equipped save (player)

```json
{
  "avatar_id": "avatar_canopy_warden",
  "equipped": {
    "weapon": "item_tide_blade_01",
    "armor": null,
    "cloak": "item_leaf_cape_01",
    "trinket": null
  },
  "inventory": ["item_tide_blade_01", "item_leaf_cape_01"],
  "currencies": { "tokens": 12400, "dive_charge": 7 }
}
```

Runtime power = avatar.base × tower.base × product of buckets from equipped mults (same stat adds, different stats multiply). Soft-cap ~×2 per bucket.

## Authoring rule

One new cape = one JSON row. No code change. Validate ids on load (dangling refs = fail).


## SakPix Elite mapping

Pack traits: 256×256, 8 directions, transparent PNG, commercial.

```json
{
  "id": "hero_evergrove_01",
  "role": "hero",
  "art_pack": "sakpix_evergrove",
  "art_folder": "character_01",
  "dirs": 8,
  "size": 256,
  "board_scale": 0.45,
  "base": { "wave_power": 1.2, "tower_speed": 1 },
  "unlock": "iap_hero_evergrove_01"
}
```

Avatar skins reference the same art fields with `"role": "avatar_skin"`. Towers never point at Elite 256 sheets.


## Tower upgrade (in-wave)

```json
{
  "id": "tower_archer",
  "max_level": 3,
  "level_cost_scrap": [0, 40, 90],
  "level_mult_wave_power": [1.0, 1.25, 1.55]
}
```

Place cost also scrap. Meta permanent bump (optional, tokens) is a separate small table — skip until v1.


## Engine note

**Locked:** Expo Play tab inside ATO. Not Godot/Unity for this product. Hero drag + scrap upgrades = Kingdom Rush patterns as defs above.


## Skills (closed primitives)

```json
{
  "id": "avatar_canopy_warden",
  "skill": {
    "skill_id": "slow_pulse",
    "name": "Root Veil",
    "description": "Vines slow nearby foes for a short breath.",
    "slow_pct": 0.35,
    "duration": 2.0,
    "radius": 90,
    "cooldown": 12
  }
}
```

Towers keep role fields only (`role_job`: chip | stall | chunk). No skill_id on towers v0 — passive is enough.


## Light retention (locked)

```json
{
  "research_offline_cap_seconds": 36000,
  "research_duration_seconds": 1800,
  "daily_tend_bonus_tokens": 10,
  "daily_tend_bonus_triggers": ["claim", "dress", "decor"],
  "daily_tend_bonus_max_per_local_day": 1,
  "streak_punish": false,
  "defend_share_glow_on_win": true,
  "tower_show_range_ring_on_place": true,
  "rewarded_ad": {
    "enabled_after_soft_launch": true,
    "max_per_local_day": 1,
    "choices": ["plus_one_dive_charge", "double_next_research_claim"],
    "never_grants": ["wave_power", "skill_power", "tower_damage"]
  }
}
```

`play_profile` fields: `last_tend_bonus_ymd`, `research_started_at`, `research_accrued_seconds` (clamp to cap), `last_rewarded_ad_ymd`.


## Defend run defaults

```json
{
  "start_scrap": 80,
  "highest_wave_cleared": 0,
  "inventory_soft_cap": 80,
  "look_sell_tokens": 3,
  "dive_refresh_token_cost": 40,
  "pause_freezes_wave": true
}
```


## Dive odds + XP + content floor

```json
{
  "dive_deeper_max": 4,
  "dive_bust_table": [0.18, 0.28, 0.40, 0.55],
  "dive_refresh": { "base_cost_tokens": 40, "max_per_day": 3 },
  "xp_clear": "10 + wave * 2",
  "xp_to_next": "50 + level * 25",
  "level_wave_power_bonus": 0.02,
  "claim_guarantees_common_power_if_power_count_lt": 2,
  "content_floor": { "looks": 24, "powers": 12, "decor": 8, "avatars_free": 1, "maps": 1 },
  "shelf_bonus": { "decor_placed": 5, "tokens": 50 },
  "banned_copy": ["gamble", "casino", "jackpot", "bet"]
}
```
