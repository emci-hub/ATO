# Grove — full game spec (ATO Play module)

**Status:** DESIGN **10/10** (emci locked Wayne picks 2026-09-08). Do **not** build until ATO Wave 1 Home exists (or emci parks ATO). Build readiness **unlocked by emci 2026-09-08** (ATO spine done; questions polish can continue in parallel). Still never on Home.  
**Where it lives:** Inside ATO as a **Play** room — never on Home, never replaces Sage.
**Public Play name:** **Divecore** (hub/room title + More row + play icon). Chill base flavor copy = **Basecore** (“your Basecore”) — do not use “Grove” in player-facing chrome.  
**Engine:** **Expo** (same app). Lightweight 2D on a dedicated screen (Skia or Gesture-Handler + Reanimated canvas). Not Unity. Not Godot.  
**Tone:** Cozy first, spicy optional. Fun, a bit grindy, engaging. Chill players can earn without Defend.

Companion files: `GAME_LOOP.md` (feel), `GAME_DATA.md` (JSON shapes). **This file wins on conflicts.**

---

## 1. Product fit in ATO

| ATO room | Job |
|---|---|
| Home / Sage / You / Circle | Unchanged spine |
| **Play** | Grove + Dive + Defend. Hidden until **ATO gate** (real week after stage 8), then one tab or You → Play |

Shared later (optional v1): ATO **tokens** wallet can credit Play clears. v0: Play has its own `tokens` in Supabase `play_*` tables. Do not paywall Home/Check/crisis with Play.

---

## 2. Expo can handle this (limits)

**Yes if light:**
- One path map, ≤20 enemies on screen, 3 tower types, 1 movable hero
- 60–90s waves, 30 fps target, pause when backgrounded
- Sprites scaled from SakPix 256 (nearest-neighbor) + small tower sheets
- Shared VFX pool (slash, hit spark, muzzle) — not per-hero cutscenes

**No:** particle spam, 50 units, Bloons immunity matrix, physics ragdolls, online PvP v0.

If a build drops under 30 fps on a mid iPhone, cut enemy count before adding features.

---

## 3. Core session (always)

1. Open **Play** → land on **Grove**.
2. If Research ready → **Claim** (bag + chance +1 Dive charge + tend tokens; may trigger **daily tend bonus** if not yet today).
3. Optional **Dive** (push-your-luck) until charges empty or they stop.
4. Optional **Dress** / place one decor (may trigger daily tend bonus if Claim didn’t).
5. Optional **Defend** → one wave → tokens + XP; on **win**, offer **share glow card**.
6. Leave. Research timer fills offline to **10h cap**; Dive charges refill to 10.

Grove alone is a valid day. Defend is the grind burst.

---

## 4. Roles (no gaps)

| Role | Definition | Stronger how | Art |
|---|---|---|---|
| **Avatar** | Player identity. Grove dress + Defend commander if no ally Hero | Items + tiny meta level | SakPix Elite skin, scaled |
| **Hero** | Optional ally, **max 1**. Movable on Defend | Own items/level; IAP later | SakPix Elite or 1 animated hero |
| **Tower** | Path defense, **exactly 3 types** (archer, vine, crystal) | In-wave scrap levels 1–3 | Small pixel (not Elite 256) |
| **Item** | Slot gear: Core + Mult A + Mult B | Drop only; swap better | Icon + optional cape overlay |
| **Decor** | Grove props (Look only) | Place for chill progress + tiny daily token | Small props |

**Movable commander:** On Defend, Avatar (or unlocked Hero) **drags anywhere**. Auto-attacks nearest in radius. Skill = move to the leak (Kingdom Rush). Towers do not move.

---

## 5. Economy (no gaps)

### Wallets

| Id | Kind | Earn | Spend | Reset |
|---|---|---|---|---|
| `tokens` | soft meta | tend, daily tend bonus, Dive bank, wave clear, sell Looks | **v0 sinks:** Dive refresh (+1 charge, cost scales, still soft-capped at 10); discard/sell Look for tiny tokens | never |
| `dive_charge` | energy | timer (~10 min/charge), Research claim chance | start Dive | refill to cap 10 |
| `scrap` | run | enemy kills in Defend | place tower, tower lvl 1→3 | each Defend start |

### Token amounts (starting balance — tune in soft launch)

- Tend claim: 15–40 tokens (scales lightly with research_yield mult)
- Dive Surface bank: 5–25 by rarity
- Wave clear: `50 + wave_number * 8` tokens
- **Daily tend bonus (once per local day):** first Claim **or** first Dress **or** first Decor — whichever comes first — grants **+10 tokens** once. No streak punish if they miss a day. Track `last_tend_bonus_ymd` in `play_profile` (user timezone from ATO profile).
- **Dive refresh (v0 token sink):** spend `40 × (1 + refreshes_today)` tokens for +1 charge, max **3 refreshes/day**, still cannot exceed cap 10. Never sells permanent power.

Numbers show **K / M / B**. Soft-cap gear mult buckets ~×2.

---

## 6. Items (Core + Mult A + Mult B)

**Look:** Core only.  
**Power:** Core + Mult A (+ Mult B if Rare+).

**Fixed mult span (never expand without a version bump):**  
`wave_power` | `tower_speed` | `token_earn` | `dive_luck` | `research_yield`

Same stat **adds** in bucket; different stats **multiply** across. 4 slots: weapon, armor, cloak, trinket.

JSON shape: see `GAME_DATA.md`.

---


### Inventory stacks & merge (locked direction)

**Now (Dress polish):** inventory is **stacked by item id** (`{id, count}`). UI tabs by slot (weapon/armor/cloak/trinket) + **Junk** (Looks / extras to sell). Sort by rarity. **Equip holds 1** — does not consume the whole stack; stack count stays (≥1 while worn, or worn is separate and count excludes equipped — pick one and stay consistent).

**Merge (Dive-style risk — ship after stacks):**
- Need **main** copy + **1 fuel** copy of the **same item id** (same star). Main can be worn or in bag; fuel always from bag spares.
- Show honest odds (like Dive). Buttons: **Merge** / cancel. Short searching beat (reuse Dive pacing).
- **Success:** main gains **+1 star** (soft-cap e.g. ★5). Fuel copy consumed. Mults scale lightly per star (e.g. +15% of base mults per star — Tune later).
- **Fail:** main **untouched**; **lose 1 fuel** only (broken attempt). Charge/grind again — same emotional loop as Dive bust.
- Default fail climb optional: first merge of a session softer; keep v0 **flat table** e.g. ★0→1 success 70%, ★1→2 55%, ★2→3 40%, ★3→4 28%, ★4→5 18% (Tune).
- **Not** “merge 10 at once.” Not destroy equipped main on fail.
- Legendary / higher rarity = separate drop band later (bigger base mults in JSON), not required for merge v0.
- Dev kit: Force merge success · Force merge fail · Grant 3× same Power.

## 7. Dive (push-your-luck)

1. Spend 1 `dive_charge`.
2. Delay → show current find + rarity.
3. Show odds: Surface keeps it; Deeper → upgrade/add % and **bust %** (bust climbs each Deeper).
4. Soft cap **4 Deepers** per charge.
5. Bust = lose this haul only (charge already spent). Never strip equipped gear / Grove.

**Default odds (Tune later):**
| Deeper # | Bust % | Upgrade Rare | Golden | Add 2nd find |
|---|---|---|---|---|
| 1 | 18% | 28% | 4% | 12% |
| 2 | 28% | 24% | 5% | 14% |
| 3 | 40% | 20% | 6% | 14% |
| 4 | 55% | 16% | 7% | 12% |

Remainder = “same rarity keep / small shuffle” weight so rows sum to 100% in code. `dive_luck` mult: bust % × `(1 - 0.15 * (luck_bucket-1))` floored at 50% of table bust; never hidden.

Always show chances. **No pity v0** (honest risk). Copy never says “gamble / casino / jackpot” — use **Dive / Surface / Deeper / bust** only.

**Optics (ATO coach app):** Dive is optional spicy; Grove claim works with 0 charges. No push that shames skipping Dive. Age rating target same as ATO (no 17+ gore). IAP never required to Claim or Check.

---

## 8. Research (idle)

- Duration: 30 min base cycle. Each completed cycle adds rolls into a **pending bag** while offline/online.
- **Offline / fill cap: 10 hours** (`offline_cap_seconds: 36000` ≈ 20 cycles max). After the cap, Research **stops accruing** until Claim. AFK Arena chest pattern.
- Cap tuneable 8–12h; ship default **10h**. Never uncapped offline.
- UI: one fill meter (empty → full), not 20 separate timers.
- **Claim** dumps the whole pending bag once (Look **finds** + Power) + `dive_charge_chance` 35% once per Claim (not per cycle).
- **Chill-path guarantee:** every Claim bag includes **≥1 common Power** find if the player has <2 Power items equipped/inventory (so Grove-only players still get board strength without Dive).
- Naming: Research drops are **finds** — never call them `scrap` (scrap = Defend in-wave currency only).
- Uses `research_yield` mult for bag size only.
- After Claim, accrued resets to 0; timer restarts.

---

## 9. Defend — map (no gaps)

### One map for v0 (“Grove Path”)

- Portrait board, safe for thumb.
- **One path:** spawn left/top → 2 bends → exit right/bottom (leak).
- **6 tower pads** only (not free place). Place costs scrap.
- Grass / stone path / tree border — matches Grove art.
- No fog, no multiple lanes, no flying-only path v0.

### Wave formula (Bloons math, not Bloons features)

```
count = floor(6 + wave * 1.2)
hp_mult = 1 + (wave - 1) * 0.12
speed_mult = 1 + max(0, wave - 10) * 0.02
```

Same enemy type `puff_pink` (and later 1–2 reskins with same stats). **No** camo/lead/immune matrix.

### In-wave flow

1. Spend scrap to place up to 6 towers on pads (3 types). While placing / selecting a pad: show a **range ring** (soft circle at tower `range`) so chip vs stall vs chunk is readable. Hide ring when idle.
2. Start wave → enemies spawn on path.
3. Drag Hero/Avatar to thickest cluster / near leak.
4. Kills → scrap; clear → tokens + meta XP; leak 1 enemy → fail wave (retry free, no scrap refund needed if fail before spend—or keep scrap mid-run).
5. Tower upgrade: tap tower → spend scrap → level 2/3 (mult table in GAME_DATA). Range ring updates if level bumps range.

### Fail / win

- Win: all enemies dead, leak count 0.
- Fail: enemy reaches exit. Show “Surface / Retry”. No rage quit loop — Retry keeps tower layout.

### Wave ladder (no gaps)

- Track `highest_wave_cleared` (start 0).
- Enter Defend → fight **wave = highest_wave_cleared + 1** (or pick any cleared wave to farm at half tokens after daily soft cap — v0 can skip pick: only next wave + Retry same).
- Win → `highest_wave_cleared = max(...)`; milestone Looks at 5 / 10 / 25.
- Retry after fail = **same** wave, layout kept.

### Starting scrap (no gaps)

- Each Defend run starts with **`start_scrap = 80`** (Tune-able). Enough for ~2 towers before first kills.
- Kills add scrap; leftover scrap discarded on leave (already). Never start at 0 scrap (unplayable first wave).

Daily soft cap: after **5 clears**, token reward halves until next local midnight (grind brake). Still playable.

---


## 9b. Combat interactions (no gaps)

Everything that can touch everything else. If it is not listed, it does not happen.

### Who is on the board

| Unit | Count | Moves? | Targets | Dies? |
|---|---|---|---|---|
| **Avatar** | 1 if no ally Hero; else Grove-only that run | Drag anywhere | Nearest enemy in `avatar_range` | No — cannot be killed v0 |
| **Hero** | 0 or 1 (unlock/IAP) | Drag anywhere | Nearest enemy in `hero_range` | No — cannot be killed v0 |
| **Tower** | 0–6 on pads | Never | Prefer first / strongest in range (fixed per type) | No |
| **Enemy** | per wave formula | Along path only | Never attacks towers/hero (leak = damage to base) | Yes at 0 HP |

v0: enemies do **not** fight back. Fail condition is **leak** only (enemy reaches exit). Keeps phone-light and chill-safe.

### Damage formula

```
hit = base_attack × unit_wave_power_bucket × (1 + type_match_bonus)
```

- `base_attack` from unit def (avatar / hero / tower level).
- `wave_power` bucket = Avatar equipped mults (+ Hero equipped if present). Board-wide for towers too.
- `tower_speed` shortens that tower’s cooldown only.
- `type_match_bonus` = 0.1 if equipped Core `type_tag` == wave `type_tint`, else 0. (Off until we ship tints — default 0.)

No crit matrix v0. Show floating K/M numbers on hit.

### Targeting rules

| Attacker | Rule |
|---|---|
| Avatar / Hero | Nearest enemy inside radius. If none, idle. Retarget every 0.25s. |
| Tower archer | First enemy in range (closest to exit among in-range). |
| Tower vine | Slow: applies `speed * 0.7` for 1s on hit; same first-in-range. |
| Tower crystal | Highest current HP in range (chunky hits). |

One projectile or instant hit per cooldown. No piercing v0.

### Cooldowns (base, before tower_speed)

| Unit | Cooldown |
|---|---|
| Avatar | 0.7s |
| Hero | 0.55s |
| Archer | 0.9s |
| Vine | 1.1s |
| Crystal | 1.4s |

`cooldown_effective = cooldown / tower_speed_bucket` for towers only. Avatar/Hero ignore tower_speed; they use their own base.

### Avatar vs Hero together

- If ally **Hero** unlocked and selected: Hero is the movable fighter; Avatar stays as **portrait buff only** that run (equipped mults still apply board-wide).
- If no Hero: **Avatar is the movable fighter**.
- Never two draggable units. Never Hero without Avatar mults.

### Towers vs Hero

- No buff aura trading between them v0.
- Both damage the same enemy pool independently.
- Placing a tower does not block Hero path — Hero flies/walks above pads (no collision).
- Hero cannot sit on exit to “block” without dealing damage — leak is geometric on path; Hero must kill, not body-block (no collision with enemies either). **DPS only.**

### Wave lifecycle interactions

1. **Setup:** place/upgrade towers with scrap; Hero/Avatar parked where player left them.
2. **Start:** spawn enemies on path with `count`, `hp = base_hp * hp_mult`, `speed = base_speed * speed_mult`.
3. **Live:** towers auto-fire; player drags fighter; kills grant scrap; HP bars on enemies.
4. **Leak:** enemy hits exit → `leaks += 1` → **fail** immediately (v0 one leak = fail). Clear layout kept for Retry.
5. **Clear:** all spawned dead and leaks 0 → win → tokens + meta XP to Avatar (and Hero if present) + scrap discarded at end.

### XP / level interaction

- Avatar meta level +1 every N XP from clears only (not from Dive).
- Hero meta level same if present that clear.
- Tower levels are **run scrap only** — reset next Defend. Do not confuse with meta level.

### XP numbers (v0)

- Clear wave W → `10 + W * 2` XP to Avatar (and Hero if present).
- Level curve: XP to next = `50 + level * 25` (level 1→2 needs 75, etc.).
- Each Avatar/Hero level: **+2%** base `wave_power` (tiny). Soft-feel, not the main power path (items still win).


### Inventory (no gaps)

- Soft cap **80** item rows. Over cap → Claim/Dive still works but must **discard or sell** one Look (2–5 tokens) before equipping new Power.
- Power duplicates: keep higher mult sum; junk auto-sell for tokens (tiny).
- No crafting / merge.

### Pause / background (Defend)

- App background or Pause → **freeze** wave. No kill credit / no leak while frozen. Resume continues. Prevents AFK clear exploit.

### What does not interact (explicit)

- Grove decor does not affect Defend.
- Dive luck does not change in-wave targeting.
- Look items never change damage.
- Enemies never target or destroy towers/heroes.
- Tokens cannot be spent mid-wave (scrap only).


## 9c. Item functions + balance (no gaps)

### What each mult actually does

| Stat | Function | Applies to | Default soft-cap |
|---|---|---|---|
| `wave_power` | Multiplies damage of Avatar/Hero hits **and** all towers | Whole board | ×2.0 from gear |
| `tower_speed` | Divides tower cooldowns only | Towers | ×1.75 |
| `token_earn` | Multiplies tend / Dive bank / clear token payouts | Meta wallet | ×1.5 |
| `dive_luck` | Slightly better Surface rarity; slows bust % climb on Deeper | Dive only | ×1.5 |
| `research_yield` | More rolls / fatter bag on Claim | Research only | ×1.5 |

Look items: **zero** combat or economy effect.

### Why defaults are not OP

1. **Soft-caps** — past the cap, extra rolls add at 25% strength (diminishing).
2. **One item per slot** — no wearing five weapons.
3. **Same-stat adds, cross-stat multiplies** — stacking only wave_power hits a wall; you want mixed knobs.
4. **Enemy wave formula outpaces linear gear** — hp_mult climbs every wave; gear alone won’t trivialise forever.
5. **Scrap tower levels reset** — run power ≠ permanent print.
6. **Daily clear token half-cap after 5** — brakes same-day grind.

### Dev Tune panel (you / TestFlight internal)

Hidden behind You → Play → **Tune** (only if `play_tune_enabled` on the account, or `__DEV__`). Not in App Store build for normals.

Sliders / fields (live, restart wave to apply):

| Knob | Default | Range | Why |
|---|---|---|---|
| `gear_softcap_wave_power` | 2.0 | 1–10 | Push OP damage |
| `gear_softcap_other` | 1.5 | 1–10 | Economy / luck |
| `diminishing_after_cap` | 0.25 | 0–1 | 0 = hard cap, 1 = no brake |
| `wave_hp_per_level` | 0.12 | 0.02–0.5 | Enemy tankiness |
| `wave_count_per_level` | 1.2 | 0.2–4 | Banner size |
| `avatar_cooldown` | 0.7 | 0.1–2 | Hero feel |
| `tower_*_cooldown` | per type | 0.2–3 | Tower feel |
| `token_clear_base` | 50 | 0–500 | Reward juice |
| `dive_bust_per_deeper` | +8% | 0–25% | Risk spice |
| `scrap_kill` | 3 | 1–20 | Upgrade speed |
| `daily_clear_half_after` | 5 | 1–99 | Grind brake |
| `type_match_bonus` | 0.1 | 0–1 | Element on/off |
| `god_mode` | off | on/off | No fail on leak; infinite scrap |

**Presets:** `Sane` (ship defaults) · `Juicy` (higher tokens, softer bust) · `Brutal` (fat HP, low gear cap) · `BrokenOP` (caps 8+, god scrap) for “is this still fun?”

Tune writes to local overrides only (or `play_tune` row for your user_id). Never sync Tune to other players. Ship build strips the menu unless internal TestFlight flag.


### Dev kit lock (internal)
Dev kit + Tune stay in builds behind `PRE_LAUNCH_DEV` **and** a local password gate (v0 string `Calgary1!`). Wrong password = kit stays hidden. Not real security (client-side); just keeps friends/TestFlight from poking. Production App Store: `PRE_LAUNCH_DEV` false strips the kit entirely.

### Playtest rule

Change **one** preset at a time. If BrokenOP stops being fun in 3 waves, the loop is content-thin — add Looks/milestones, don’t only nerf. If Sane feels weak at wave 5, bump scrap or lower hp_per_level before raising gear caps.


## 9d. Skills & tower roles (closed kit — balanceable)

Best practice (Kingdom Rush family): **few tower jobs** + **heroes with 1 signature skill** from a **closed list of primitives**. Flavor/text/numbers change; code paths do not. That stops OP creep and keeps Expo light.

### Tower differences (always 3)

| Tower | Job | Auto attack | Passive (always on) | Level-up feel |
|---|---|---|---|---|
| **Archer** | Chip / first | Fast single-target, first-toward-exit | +range per level | More shots |
| **Vine** | Stall | Slow on hit | Hits apply stackable slow cap 1 | Longer slow / slightly more damage |
| **Crystal** | Chunk | Slow heavy hit, highest-HP in range | None v0 | Bigger chunks |

No fourth tower v0. No branching L4 paths (that’s Bloons/KR weight).

### Skill primitives (code only understands these)

| `skill_id` | Effect | Balance knobs |
|---|---|---|
| `burst` | Instant damage in small radius at Hero feet | `power`, `radius`, `cooldown` |
| `slow_pulse` | Slow all enemies in radius | `slow_pct`, `duration`, `radius`, `cooldown` |
| `focus_beam` | Big single-target nuke on current target | `power`, `cooldown` |
| `token_bloom` | After clear, bonus tokens (meta, not in-wave DPS) | `bonus_tokens`, once per clear |
| `scrap_bloom` | Bonus scrap on next 5 kills | `bonus_scrap`, `cooldown` |

No new primitive without a Tune + version bump. Unique heroes = **which** primitive + **numbers** + **description string** + VFX tint — not new code.

### Avatar skills

Every Avatar skin has **one** active skill (tap button on Defend, cooldown). Starter Canopy Warden:

```json
{
  "skill_id": "slow_pulse",
  "name": "Root Veil",
  "description": "Vines slow nearby foes for a short breath.",
  "slow_pct": 0.35,
  "duration": 2.0,
  "radius": 90,
  "cooldown": 12
}
```

Other skins swap primitive/numbers/copy. Avatar skill uses Avatar gear `wave_power` for `burst`/`focus_beam` power.

### Hero skills

Ally Hero: **one** active skill, usually stronger / different job than Avatar so they feel worth IAP.

Example:

```json
{
  "id": "hero_elowen",
  "skill_id": "burst",
  "name": "Moonlit Bloom",
  "description": "A soft blast that clears a knot of pufflings.",
  "power": 1.8,
  "radius": 70,
  "cooldown": 14
}
```

If Hero is the movable fighter, **only Hero skill button** shows (Avatar skill hidden that run). If no Hero, Avatar skill shows. Never two skill buttons.

### Descriptions (UI)

Every skill/tower shows:
- **Name**
- **One sentence** what it does (plain English)
- **Cooldown** and key number (damage / slow %)

No lore walls. Same pattern as Dive odds — honest.

### Balance rules for skills

1. Active skill DPS budget ≤ ~20% of board DPS at Sane (feel impactful, not carry).
2. Cooldown ≥ 10s so drag positioning stays the main skill.
3. `token_bloom` / `scrap_bloom` cannot crit or scale with wave_power unbounded — flat or soft-capped.
4. IAP Hero skill may be ~15% stronger than free Avatar skill — not 2×.
5. Tune panel adds: `skill_power_mult`, `skill_cooldown_mult`, per-`skill_id` enable.

### What we are not doing

Per-hero unique code. Ultimate cutscenes. 4-skill talent trees. Barracks-style blocker units v0 (enemies don’t melee).


## 9e. Campaign stages (no rewrite — extends wave math)

**Loop (industry: act → finale → prestige cycle):**

| Phase | Map | Waves (display resets) | Role |
|---|---|---|---|
| **Trial** | Newbie (current Grove Path) | **1–5** | Teach place / drag / skill |
| **ATO Main** | Divecore Main (longer S-curve + chokes) | **1–20** | Real deal |
| Waves **9–10** | Main | **Training arc / preview** | Teach the cycle’s bosses |
| Wave **9** | Main | **Scout mini-boss** — same silhouette/tag as end mini-boss, ~40–50% HP, smaller scale | “You’ve met them” |
| Wave **10** | Main | **Scout boss** — same family as final, ~50–60% HP, shows **tags** (not full elements) | Expectation set |
| Waves **11–18** | Main | Normal climb + runners | Pressure |
| Wave **19** | Main | Semi-final — full mini-boss (+ pack) | Revenge heat |
| Wave **20** | Main | **Final form** boss (+ runners) | Clear = Conquered +1 |

**Story (light):** one toast/banner lines only — e.g. w9 “A scout slips the path…”, w10 “They’ll remember this.”, w19 “They’re back.”, w20 “Final form.” No cutscenes, no dialogue trees.

**“Elements” here = tags** (Runner / Marked / Boss family id) + tint/size — **not** fire/ice immunity matrix. Same engine flags as planned.

On clear of Main wave 20:
1. `conquered_cycles += 1` (UI: **Conquered Waves** = cycles finished — or name it Conquered Cycles; show big number)
2. Apply `cycle_power = 1 + conquered_cycles * 0.12` (Tune) to enemy HP/count on the **next** run
3. Reset display wave to Trial 1 (or skip Trial after first clear — player choice / default skip Trial once Conquered ≥ 1)
4. Tokens/XP milestone bonus for cycle clear

**Does not require starting from scratch:** keep `stepDefendLive`, scrap, towers, Avatar. Add `maps/*.json` (waypoints + pads), `campaign.phase`, `campaign.wave_in_phase`, `conquered_cycles`, `cycle_power` on playStore. Enemy tags Runner + mini-boss later plug into same engine.

**Not doing:** map geometry morph every 25 waves; elemental immunity matrix; 10 maps.


## 9f. Elements (Divecore — soft match, not immunities)

Learn from mobile RPGs: **advantage ≈ +20–25%**, not 0-damage walls (RO-style immunities kill clarity on phone TD).

**Our take (ATO colors, already on item `type_tag`):**

| Tag | Feel | Soft edge |
|---|---|---|
| **Tide** | water / dive | vs Ember |
| **Ember** | fire / spark | vs Root |
| **Root** | growth / wood | vs Spark |
| **Spark** | storm / metal-bright | vs Tide |

(Old ATO Ink/Paper/Steel/Bloom map 1:1 → Tide/Ember/Root/Spark in Play JSON; ATO coach colors stay elsewhere.)

Cycle / boss family carries one `type_tint`. Equipped Power Cores with matching `type_tag` get **`type_match_bonus` = +0.20** vs that tint (locked balanced default). Mismatch = **neutral** (no −%). Chart shows edges; play still required because cycle_power + soft-caps outpace a single match.

**Scout w10 / Final w20:** same tint family so Dress “equip for the fight” is teachable mid-act.

**OP elemental uniques:** fridge — after soft match feels good. No new towers per element. No camo/lead matrix.


## 9g. More light steals (worth it / skip)

**Worth (map onto what we have):**
1. **Wave preview** before Start — icons for puff / Runner / mini-boss / boss tint (Renz-style). Dress becomes a loadout decision.
2. **Soft type match** — Tide/Ember/Root/Spark +15–25% (Dress matters).
3. **Scout → Final** boss family (already §9e).
4. **Perfect-clear juice** — optional tiny token bonus if you never paused-panic / cleared under scrap waste — or skip; we already fail on 1 leak.
5. **Boss mark** — Root Veil / Avatar hits apply a short “exposed” mult on mini-boss only (teaches drag).
6. **Conquered cycle** power climb (already §9e).

**Skip (heavy):** dynamic path mazes, roguelike card drafts between every wave, 7+ tower types, hard immunities, procedural maps every 25.



### Dive vs Defend drop roles (even the economy)

| Source | Role | Adjustment |
|---|---|---|
| **Dive** | **Volume** — commons/rares, merge fuel, Looks | Lower Power weight ~15–25% vs early stubs; bust table stays (skill). Not the unique lane. |
| **Research Claim** | Steady scraps + small Power chance | Keep chill; guarantee common Power if undergeared (already) |
| **Defend farm** | **Uniques + tint gear + Avatar star** | Previewable; uniques once; farmables repeat |

Dive stays exciting push-your-luck; Defend is where “chase the named piece” lives. Don’t gut Dive — **re-role** it.

## 9h. Progression balance (grind fair — not trivial)

**Pillars of power** (all soft-capped; none carries alone):
1. Gear mults (already ×~2 soft-cap) + stars (merge ★0–5, +10%/star — already)
2. Soft **type match +20%** (Dress matters; never immunity)
3. Avatar level (+2%/level from clears)
4. **Avatar stars** (meta, slow) — see below
5. Towers / scrap skill (run only)
6. `cycle_power` from Conquered (enemies scale ~+12%/cycle)

**Why OP loot doesn’t end the game:** cycle_power and wave math climb faster than one god roll; soft-caps + diminishing after cap; daily token half-cap; Dive bust risk.

### Farm / rerun (no new mode)
- After unlocking Main, player may **replay** any cleared wave band: Trial, Main normal, **Scout (9–10)**, **Semi (19)**, **Final (20)**.
- Replay pays **reduced tokens** (e.g. 50%) but full drop tables for that band.
- **Scout mini-boss (9):** chance at tagged Look / common–rare Power of the cycle tint.
- **Scout boss (10):** better Power of tint; small star-fuel chance.
- **Semi (19):** armor/cloak tint piece.
- **Final (20):** weapon tint piece + **Avatar star roll**.

### Avatar star (slow prestige drip)
- Max ★5 on Avatar (same soft feel as gear).
- Final boss clear: **25%** to drop `avatar_star_token` **once per Conquered cycle** (flag `avatar_star_rolled_cycle`).
- If miss: pity — guaranteed on **3rd** Final clear of that cycle (still once per cycle).
- Spending token: +1 Avatar star → +3% base wave_power (Tune). Not 2× hero.

### Hero ally IAP
Unchanged — later. Free Avatar is the star path.

### Dive vs Defend evenness
- Dive = best **raw Power / Look volume** + merge fuel.
- Defend clears = **XP, tokens, milestones, boss uniques, Avatar stars**.
- Neither alone maxes all pillars — intentional.

### Element chart UX (locked)
Defend **setup card** + live **`?` overlay** (user choice). Shows Tide→Ember→Root→Spark cycle + “match = +20%”.


## 9i. Drop preview + shops

### Drop preview (honest UI)
On Defend setup (and Scout/Semi/Final band select): show **What can drop** list for this wave/band.
- Each row: name/rarity/slot + **Farmable** or **Unique**
- If Unique and already owned: **"Owned — won't drop again"**
- If Farmable: **"Can grind — still drops"**
- Avatar star token: show 25% / pity 3rd Final this cycle + owned state for this cycle

### Shops (open design — build after loop)

**Token shop** (soft `tokens`):
- Dive refresh (already), Look cosmetics, decor, maybe merge-fuel crate (small, soft-capped/day)
- Never sells permanent wave_power uncapped
- Never sells cycle_power skips that break Conquered

**Paid shop** (Apple IAP / real money):
- **Unique OP rows** only available here (labeled Paid Unique)
- Stronger mult bands but still soft-capped by same gear caps
- Optional Hero ally (already planned)
- Must not paywall Trial/Claim/crisis; Play remains optional in ATO

Both shops: empty shelves OK in v0 — **wire UI stubs + JSON catalog**, fill OP rows later.

### Where numbers are adjusted
| Knob | Home |
|---|---|
| Dive Power weights / bust | `loot_tables` + Tune `dive_bust_*` |
| Type match +20% | `type_match_bonus` / Tune |
| Cycle enemy climb | `cycle_power` per Conquered |
| Daily token half | `DAILY_CLEAR_HALF_AFTER` |
| Boss drop rates / unique flags | `drops/*.json` per band |
| Avatar star 25% + pity | playStore finals |
| Shop prices | `shops/token.json`, `shops/paid.json` |
| Live playtest | Tune presets Sane/Juicy/Brutal/BrokenOP |


## 9j. Gear Score + Skip (QoL — don't print uniques)

**Gear Score (GS)** = readable number from equipped Powers (mult buckets after soft-cap) + Avatar level + Avatar stars + type-match vs **this wave’s tint** (small). Shown on Defend setup vs **Recommended GS** for the wave/band.

### Skip when overpowered
If `GS >= recommended * 1.25` (Tune), offer **Skip to even**:
- Fast-forward **campaign progress** through trivial normal waves until GS ≈ recommended (stop before Scout 9–10 / Semi 19 / Final 20 unless player confirms “skip into boss preview”).
- Default: **never auto-skip boss bands** — player must tap into 9/10/19/20 (teach + farm).

### What skip pays (critical)
| Reward | On skipped normal waves |
|---|---|
| Tokens / XP | **Reduced** (~40–50% of a real clear, Tune) |
| Merge fuel / common Looks | Small **skip crate** once per skip batch (not per wave×N uncapped) |
| **Uniques / tint boss gear / Avatar star** | **Never** from skip |
| Milestone Looks 5/10/25 | Only if that wave number is crossed — grant once if not claimed (OK) |

**Why:** “Full drops per skipped wave” breaks uniques, shops, and Dive’s role. Industry skip/sweep is **time QoL**, not a second loot printer.

### Farm still open
After skip, player can still open **Scout / Semi / Final** bands anytime for previewed drops (half tokens on replay). GS does not lock you out of grinding down.

### UI
- “Your GS 1240 · Wave wants ~800 — Skip ahead?”
- Drop preview still lists what **playing** that band can drop; skip crate contents listed separately as commons-only.


## 9k. Bound Boss towers (Final → ally tower grind)

**Fits:** yes — classic “beat them → recruit them” (Pit People capture, Team Building recruit, TD fragment evolves). Perfect **Conquered** grind when `cycle_power` climbs: harder Final still pays progress you *want*.

### Unlock
- **Final (w20)** clear can drop **`boss_fragment`** for that cycle’s boss family (`boss_id`).
- **3 fragments** → unlock that boss as a **Bound Boss** tower (Dress/Defend roster).
- **Scout / Semi:** optional **low** fragment chance (e.g. Scout 5%, Semi 10%, Final **35%** — Tune). Never guaranteed. **No pity** (honest grind; optional power fantasy, not Avatar-star prestige).
- Drop preview: “Boss fragment · 1/3 · Owned”.

### Board rules
| Rule | Value |
|---|---|
| Slot type | **Tower pad** (unmovable) — not a second Avatar/Hero |
| Max Bound Bosses on board | **2** (of 6 pads) |
| Remaining pads | 4 for Archer / Vine / Crystal |
| Drag | Never — Avatar/Hero stays the only movable |
| Place cost | Scrap like towers (or slightly higher Tune) |
| Levels | Use Bound Boss **stars** instead of 1→3 scrap upgrades (or stars + light scrap — pick one: **stars only** for v0 clarity) |

### Stars ★1–★5
- Unlock at ★1 with 3 fragments.
- Extra fragments → star up (e.g. +2 / +3 / +4 / +5 fragments per star — Tune table in GAME_DATA). Cap ★5.
- Each star: +damage / shorter skill CD / slightly bigger skill numbers — soft, not 2× board.
- Fragments for **this** `boss_id` only (cycle family). New Conquered cycle may rotate boss family → new Bound Boss to collect (fridge: keep prior Bound Bosses forever once unlocked).

### Skill = fight echo (closed kit)
When you fought them they used a tagged skill; as a tower they keep **the same primitive + flavor**, not new code:
- Boss fight skill → Bound Boss **auto or tap skill** mapped to existing `skill_id` (`burst` / `slow_pulse` / `focus_beam` / …) + numbers + VFX tint.
- One skill button for Bound Boss if active-type; if passive aura, show always-on line only.
- Budget: Bound Boss skill DPS ≤ Avatar skill budget; **two** Bound Bosses together ≤ ~1.5× one Avatar skill (Tune) so they help the climb without deleting Avatar.

### Economy vs other lanes
| Lane | Owns |
|---|---|
| Avatar star | Final 25% + pity 3rd — **prestige wave_power** |
| Bound Boss fragments | Final (main) — **board tower fantasy**, **no pity** |
| Tint uniques | Final / Semi — gear |
| Skip crate | Commons only — **never** fragments |

So farming Final when the game gets hard still helps: fragments → Bound Bosses that push the next harder cycle.

### What we are not doing
- Capturing mid-fight / nets.
- Bound Boss as movable Hero (breaks “one drag”).
- Per-boss unique code paths.
- Pity on fragments.
- More than 2 Bound Bosses on pads.
- Fragments from skip.


## 9l. Forever engine (data-driven core — ship once, content forever)

**Goal:** one combat + economy **runtime**. Future seasons = **JSON + art**, not new systems. Player save stays tiny. Overgrind allowed; returns soft-cap so the loop never breaks.

### Three layers (do not mix)

| Layer | Lives where | What it is |
|---|---|---|
| **Engine** | TypeScript once | Defend sim, Dive rolls, merge, GS skip, Conquered reset, star-up, fragment unlock, soft-caps |
| **Content packs** | `data/*.json` (+ SakPix sheets) | Boss families, wave bands, loot tables, star costs, skill numbers, map waypoints |
| **Player save** | AsyncStorage (`playStore`) → later optional cloud blob | IDs + counts + flags only — never full item defs |

Industry pattern: idle/TD forever loops + offline-first single-player (client sim, soft caps, prestige). Backend is backup/IAP, not the grind brain.

### Generic engines (reuse for everything)

1. **`StarTable`** — `{ from, to, cost_currency, cost_amount, success_pct? }`  
   Powers (merge), Avatar stars (token), Bound Boss stars (fragments) all call the **same** star-up resolver. New star lane = new table row, not new code.

2. **`DropTable`** — weighted rows + `once_per_cycle` / `unique` / `farmable` flags + preview labels.  
   Final / Scout / Dive / skip-crate / Bound fragments all use one roller.

3. **`SoftCap`** — `(stat, soft, hard?)` diminishing after soft. Gear mults, tokens/day, Research hours, Bound Boss skill budget. Overgrind past soft is **approved** but flat.

4. **`CycleScaler`** — `cycle_power = f(conquered_cycles)` applied to enemy HP/count/recommended GS. One knob climbs the forever wall.

5. **`SkillPrimitive`** — closed set only; content picks `skill_id` + knobs + VFX tint.

6. **`ContentPack`** — `{ pack_id, boss_family[], maps[], loot_refs[], art_atlas }`. Season 2 = new pack + sprites. Engine unchanged.

### Tiny save (minimize storage)

Store **references**, not definitions:

```json
{
  "v": 1,
  "conquered_cycles": 3,
  "campaign": { "phase": "main", "wave": 12 },
  "tokens": 420,
  "inventory": [{ "def_id": "pwr_tide_core", "stars": 2, "qty": 1 }],
  "bound_bosses": [{ "boss_id": "ember_warden", "stars": 2, "frags": 1 }],
  "flags": { "avatar_star_rolled_cycle": true, "uniques": ["u_ember_blade"] },
  "tune_local": {}
}
```

- Item **stats** live in `data/items.json` keyed by `def_id`.
- Changing balance = ship new JSON; old saves still resolve.
- Cap inventory rows (stack commons; unique once). No history log of every wave.

**Backend (later, thin):** one JSONB blob per user (account sync + IAP receipts). No per-wave rows, no server combat. Client remains truth for solo grind; server optional mirror.

### Forever loop (no new content required to keep playing)

```
Dress → Defend (or Skip if GS high) → clear / farm boss band
  → drops (tables) → merge / Bound frags / Avatar star
  → Conquered on Final → cycle_power↑ → harder wall
  → farm Bound Bosses + soft-capped tokens → push again
```

Dive = volume between Defends. Research = idle drip. **Loop never needs a new map** to stay valid; packs only add *flavor* walls.

### Overgrind policy (approve + cap)

| Activity | Approve overgrind? | Cap |
|---|---|---|
| Farm Scout/Semi/Final | Yes | Half tokens on replay; uniques once; fragments no pity but ★5 hard |
| Dive / merge | Yes | Charge cap 10; merge ★5; Dive Power weight soft |
| Research / tend | Yes | **10h** Research accrual; daily tend once |
| Skip ahead | Yes | Reduced pay; no uniques/frags |
| Token wallet | Soft | Soft-cap spend sinks; daily clear half-cap after N |

Feeling: “I can grind all night” + “numbers stop exploding.” Soft-cap after soft; hard only on stars / charges / unique flags.

### What live ops actually ships

1. New **boss family** pack (silhouette + tint + skill knobs + fragment table)  
2. Optional new **Looks** / atlas frames  
3. Tune number pass (or remote config later)  
4. **Not** new combat systems, new pad rules, or new skill primitives without a version bump

### Build rule for DeepSeek / Claude

- Feature asks → “which engine + which JSON?” before new modules.  
- If it needs a 4th tower job or new `skill_id`, that is a **version bump**, not a content pack.  
- Fridge seasonal maps until the forever loop feels good on **two** maps + rotating packs.


## 9m. Wave beat + skill loadout (post-E locks)

### Boss-band spawn order (locked)
On Scout/Semi/Final bands:
1. **Minion phase** — puffs/runners first; light **within-wave ramp** (later spawns slightly fatter HP, Tune)
2. **Breath** — ~**2.0s** pause after last minion dies (or after minion spawn budget ends + board clear of minions). Banner: “They’re coming…”
3. **Boss phase** — mini/final spawns **last**. Optional enrage still mid-boss.

Normal waves: same light within-wave ramp only — **no** 2s boss breath (keeps pace). Across the campaign, `cycle_power` + wave # already escalate; within-wave ramp is the “unique feel” without a second mode.

### Frags (= boss fragments)
Currency toward **Bound Boss** unlock/stars. Not Avatar stars. Drop from Scout/Semi/Final clears. 3 → unlock ★1.

### Avatar skill button + bottom HUD (locked)
Defend **live** bottom bar (left→right, with spacing):
1. **Pause**
2. gap
3. **Skill: &lt;name&gt;** (e.g. `Skill: Root Veil`) — one button only
Bound Bosses auto — never steal this button. Setup screen = no skill cast.

### Boss / Mini-boss alert (locked)
After the ~2s breath, big toast/banner before boss spawns:
- Scout mini (9) → **Mini-boss alert**
- Scout boss (10) / Semi (19) / Final (20) → **Boss alert**
(Optional second line with boss name.) Then boss spawns.

### Boss move speed (locked)
Mini-boss + boss units move at **`bossSpeedMult` ≈ 0.33** of normal puff speed (Tune; ~3× slower). Runners/minions keep normal speed. Fat + slow = readable threat after the alert.


### Skill Orbs + merge (planned — after smoke; not blocking forever loop)
Industry light steal: one equipped skill, orbs star it — **not** a full gem grid.

| Piece | Rule |
|---|---|
| Skill bank | Max **4** unique Avatar skills (closed primitives + flavor). Starter **Root Veil** is skill #1. |
| Stars | Each skill ★0–★5 via rare **Skill Orb** (StarTable). |
| Orb drops | Rare: Final ~8%, Semi ~4%, Scout ~2%, Dive step tiny — Tune. Never from skip. |
| Equip | **One** active: either a single skill **or** one **merged** pair |
| Merge | Exactly **2** owned skills → merge → one button fires **both** in sequence (shared CD ~1.25× longest). Button label = short **fusion name** per pair (e.g. `Skill: Twin Veil`), not “A + B”. Still **one** button. |
| Unmerge | Free, anytime in Dress/You — refund both skills, lose merge-only bonus if any |
| Orb spend | Dress (or skill sheet): tap Orb onto a skill → +1★. Soft-cap ★5. |

**Not doing:** 9 hotkeys, PoE support-gem grid, 4 skill buttons, Bound Boss using Avatar skill slot, orbs from skip.

## 10. Graphics pipeline (no gaps)

| Layer | Source | Notes |
|---|---|---|
| Avatar / Hero body | SakPix Elite 256, 8-dir | Scale ~0.4 board, nearest-neighbor; full size Grove portrait |
| Attack “action” | Shared VFX pack | Slash / bolt / hit — play on attack frame; no need Founders pack for v0 |
| Towers | Small Kenney or custom 32–64 | 3 types × 3 levels tint |
| Enemies | One puff + tints | Scale HP bar only |
| Grove room | Simple interior + decor props | Static BG + placeable props |
| UI | ATO-adjacent (Ink/Paper/Steel/Bloom) | Big K/M numbers, few buttons |

**Founders Animated bundle:** optional later for 1–2 IAP Heroes with real attack anims (prefer grove-fit like Elowen). Not required to ship.

Credits: SakPix + Kenney on Play → About.

---

## 11. Screens (wireframe)

1. **Grove** — Avatar, tokens, Research Ready, buttons: Claim / Dive / Dress / Defend  
2. **Dive** — underwater pool, find card, odds bar, Surface / Deeper, charges 7/10  
3. **Dress** — 4 slots + inventory grid  
4. **Defend setup** — map, pads, scrap, Start  
5. **Defend live** — drag Hero, pause, scrap, wave #, skill button, range ring on place  
6. **Results** — win/fail, tokens, XP, **Share glow card** (win only), Continue  

No seventh menu. No ranking / guild / chat inside Play.

---

## 12. Progression & grind curve

| Horizon | Hook |
|---|---|
| 30 sec | Claim Research waiting |
| 2 min | One Dive bank or one wave |
| Session | Clear wave N+1 with new cape mult |
| Day | Dive charges empty → come back; Research timer |
| Week | Higher wave banner; rare Look chase |

Forever loop = timers + next wave number + Look collection. Soft caps stop infinite same-day token print.

---

## 13. Rewards & notifications

### Rewards

- Always: tokens + items as above.
- First clear of wave milestone (5, 10, 25): one guaranteed Rare Look.
- **Defend clear → share glow card:** on win Results, one **Share** action (reuse ATO hold-to-share / glow-card pattern). Card shows Avatar skin + wave # + short line (“cleared Wave 12”). Optional; never required to collect tokens. Fail = no share card.
- IAP (after free loop): Hero unlock rows only — never paywall Grove claim or crisis.

### Daily tend bonus

See §5. One +10 tokens / local day for first Claim|Dress|Decor. No flame streak UI. Miss a day = no punish, just no bonus.

### Notifications (Play-specific, opt-in, reuse ATO push)

| Ping | When | Copy vibe |
|---|---|---|
| Research ready | Timer done | “Your grove found something.” |
| Dive full | Charges hit 10 | “Dives are full.” |
| Daily soft reset | Local morning if they play | Optional — default **off** |

Max 1 Play ping/day unless they enable both. Quiet hours = ATO settings. Never ping during Home coach quiet hours conflict — share one quiet window.

---

## 14. Data & save

Supabase `play_profile`, `play_inventory`, `play_equipment`, `play_timers` keyed by ATO `user_id`.  
Offline: cache last Grove state; Defend requires online only if we need anti-cheat later — v0 can run Defend local and sync rewards on end.

JSON content packs in app bundle: `data/*.json` from GAME_DATA.md. Hot-add items = OTA or app update.

---

## 15. Build order (after ATO gate only)

1. Play entry (You→Play) + Grove shell + fake Claim (placeholders)  
2. Local `playStore` timers + tokens (**10h Research cap** + daily tend)  
2b. Stub `items.json` (10 rows) **before** Dive  
3. Dive push-your-luck  
4. Dress / equip mult buckets  
5a. Defend path + leak/Retry + wave ladder + start_scrap  
5b. Towers + scrap + range rings  
5c. Drag Avatar + one skill  
6. Share glow + milestones (optional on $ budget)  
7. Tune presets (optional)  
8. IAP Hero (later)  
9. Optional ads (later)  

**Minimum finished addon** = steps 1–4. Defend 5a–5c is target, not required to call Play “shipped.” See `PLAY_DEEPSEEK_HANDOFF.md`.

One box at a time. Same ATO rule: if two stages in one turn, undo the second.

---

## 16. Explicit non-goals (v0)

Godot/Unity. Multi-lane maps. Element immunities. PvP. Guilds. **Angry streak flames.** Live who-is-playing. Putting Play on Home. Building Play before ATO Home.

Also stay out (looks cool, kills light): merge heroes, gacha hero roster, full wipe prestige/rebirth (Conquered soft-cycle is OK), barracks blockers, Bloons immunity matrix, daily challenge maps, side modes (match-3 etc.), second currency maze, uncapped offline Research.

## 16b. Light retention locks (v0)

| Rule | Spec |
|---|---|
| Research fill cap | **10h** default (tune 8–12). Stops accruing until Claim. |
| Daily tend bonus | +10 tokens once/local day on first Claim **or** Dress **or** Decor. No punish streak. |
| Share glow card | Win Defend Results only. Reuse ATO share pattern. |
| Range ring | Show on tower place/select; hide when idle. |
| Rewarded ad (post soft-launch) | Max **1/day**. Choice: +1 Dive charge **or** 2× next Research claim. Never buys wave_power / skill power. Opt-in; Grove works with ads off. |

---


## 16c. Plan review (2026-09-08) — gaps closed + fridge

**Closed this pass:** wave ladder; start_scrap 80; Research finds naming + one Claim dump; inventory soft cap + sell Looks; Defend pause freeze; token sink = Dive refresh.

**Promoted to §16d:** shelf goal, mute/haptics, reduce-motion, content floor, first-run, XP numbers, Dive odds table, chill Power guarantee, Dive refresh sink, optics copy. **Still fridge:** type_tint week; second map; pity.

**Do not add from red-team:** hearts/lives (changes fail feel), second map, pity Dive, hard gems, merge, prestige.

---

## 16d. Design 10/10 locks (ship checklist)

**Emci lock:** 2026-09-08 — all Wayne picks accepted. Design readiness = **10/10**. **Build unlocked** 2026-09-08 (ATO done per emci; need GitHub repo).

### Content floor (before soft launch)

| Pack | Minimum |
|---|---|
| Look items | **24** (6 per slot) |
| Power items | **12** (mix of mult knobs) |
| Decor props | **8** |
| Avatar skins | **1** free Canopy Warden |
| Enemy | **1** puff + 2 color tints (same stats) |
| Maps | **1** Grove Path |
| Towers | **3** (archer / vine / crystal) |

IAP Hero only after this floor exists in TestFlight.

### First-run (≤90s, skippable)

1. Grove → tap Claim (scripted full bag once).
2. Finger → Dress equip one piece.
3. Optional: “Try Defend” → wave 1 with start_scrap 80 + ghost drag hint.
4. Never force Dive on first open.

### Grove shelf goal (light)

- Place **5** decor → one-time **+50 tokens** + tiny Grove sparkle. No daily punish. Tracks `shelf_bonus_claimed`.

### Accessibility / device

- Mute music + mute SFX toggles (ATO settings reuse if present).
- Haptics off toggle.
- **Reduce motion:** skip screen shake / bust flash; keep odds text.
- Pause when backgrounded (already). Target **30 fps**; if drop, cut enemy count first.
- One-handed: primary buttons in bottom 40% of portrait.

### Optics / trust copy

- Dive labels: Surface / Deeper / bust only — no casino words.
- Share card: wave # + Avatar look — no revenue or “pay to win” flex.
- Play About: SakPix + Kenney credits + “Play is optional; Home/Sage never gated.”

### Dual wallet

- v0: `play_tokens` separate. Document migration path: optional later credit into ATO tokens 1:1 — never reverse-drain Home.
- Never spend Play tokens on crisis / Check / Sage.

### Build readiness (process, not missing docs)

| Score | Meaning |
|---|---|
| **0** | ATO Home not shipped **and** ATO not parked → **no Grove code** (current lock). |
| **1** | ATO parked explicitly **or** Home live → Play shell allowed. |
| **2** | Timers + Claim + tokens. |
| **3** | Dive live. |
| **4** | Dress + content floor JSON. |
| **5** | Defend wave 3 clearable on device ≥30 fps. |
| **10** | Soft launch: pings, share, milestones, Tune Sane passes friend test (§17). |

Design 10/10 ≠ permission to build. Raising build readiness requires **Home shipped** or **emci parks ATO**.

---

## 16e. Red-team fixes (locked)

| Risk | Fix in plan |
|---|---|
| Play before ATO Home | Stay build-readiness 0 until Home or explicit park (§16d). |
| Dive gambling optics | Odds table + banned casino words + optional Dive (§7, §16d). |
| Expo FPS | ≤20 enemies; cut count before features (§2). |
| Chill path weak | Claim guarantees ≥1 common Power if undergeared (§8). |
| One leak vs cozy | Keep one leak; Retry keeps layout — no hearts (§9). |
| Token pile / dual wallet | Dive refresh sink; play_tokens separate; no drain Home (§5, §16d). |
| IAP Hero early | After content floor + soft launch (§15, §16d). |
| Spec drift | GAME_SPEC wins; Loop/Data must match. |

---
## 17. Done when

A friend opens Play, claims Research (gets ≥1 Power if undergeared), banks one Dive with visible odds, clears wave 3 by dragging the Hero, shares optional glow card, and can leave Grove-only the next day without feeling stuck. Content floor met. 30 fps on mid iPhone. Fun + light grind + clear next goal. **Design 10/10** when §16d checklist is true in the docs; **build 10/10** only after §16d build ladder completes post-ATO-gate.


---

## 18. Red-team + final plan (2026-09-09) — GO for DeepSeek

### Verdict
**Design is implementable.** No fatal holes. A few ambiguities are **locked below**. Do **not** build all of §9e–9l in one chat — phase it.

### Gaps found → locked picks (Wayne)

| Gap | Risk | Lock |
|---|---|---|
| §9 “one map” vs §9e Trial+Main | Confuse agent | **Two maps:** Trial = current Grove Path; Main = new `maps/divecore_main.json`. No third map v0. |
| Bound Boss tap skill vs “one skill button” | UI fight | Bound Boss = **auto/passive only** v0. Avatar skill button stays alone. Boss echo skill = auto pulse on CD (primitive). |
| Boss fight skills undefined | Scope creep | Final/Scout bosses v0 = **fat HP + tint + size + Runner pack**. Optional HP-threshold `burst` from JSON. Bound Boss skill numbers live in `bound_bosses.json`, not unique code. |
| Boss family rotation | Save/content mess | **One** boss family until ContentPack 2. Conquered only bumps `cycle_power`, does not swap boss yet. |
| GS formula missing | Skip broken | `GS = floor(100 * wave_power_eff * (1 + 0.02*avatar_level) * (1 + 0.03*avatar_stars))` after soft-caps. Type match is **combat only**, not GS. `recommended_GS(wave) = base[wave] * cycle_power` from JSON. |
| Skip algorithm missing | Infinite skip | While next wave is **normal** (not 9/10/19/20) and `GS >= 1.25 * recommended(next)`, advance + accumulate reduced pay; stop at boss band or when GS check fails. One skip-crate at end of batch. |
| Milestones 5/10/25 vs Main ends 20 | Orphan 25 | Milestones use **`lifetime_waves_cleared`** (never resets on Conquered). 25 still reachable. |
| Inventory “cap rows” | Bloat | Soft warn at **40** stacks; hard refuse new commons at **60** (uniques always keep). Sell/discard sink. |
| §14 Supabase vs handoff local | Agent wires DB early | **Local AsyncStorage wins** until optional sync step. Spec §14 = later. |
| Shops open design | Distraction | **Fridge** until Phase E done. Stub shelf OK only after forever loop playable. |
| §16 “no prestige” vs Conquered | Doc fight | Conquered = soft cycle (wave display reset + cycle_power). Full wipe rebirth stays banned. |
| Dive Power re-weight vs Defend uniques | Economy | Do in Phase C with DropTable — not a separate rewrite. |
| SakPix | Art block | Placeholders until after Phase E smoke. Push branch anytime; merge when art ready. |

### Still fridge (do not DeepSeek yet)
- Hero IAP, paid OP shop rows, ads, cloud JSONB sync  
- Boss family rotation / Season packs  
- Dynamic mazes, immunities, 4th tower, pity on Bound frags  
- Perfect-clear juice, OP elemental uniques  

### Already built (do not redo)
Grove hub, Claim/Research, Dive, Dress+merge, Defend path/towers/Avatar/skill, coach, half-cap, floaters, milestones stub, Dev kit, Tune — on `play/grove-v0`.

### DeepSeek phases (one chat = one phase; Flash unless noted)

| Phase | Model | Ship | Cite |
|---|---|---|---|
| **A0** | Flash | Divecore **copy/UX polish** (rename, blurbs, scrap hint) — product feel | SPEC naming + hub |
| **A** | Flash | Forever **engine stubs**: `StarTable`, `DropTable`, `SoftCap`, `CycleScaler` helpers + `data/*.json` shapes; playStore `v` migrate (`campaign`, `conquered_cycles`, `lifetime_waves_cleared`, `bound_bosses[]`) | §9l, GAME_DATA |
| **B** | Flash→Pro if stuck | **Campaign**: Trial 1–5 → Main 1–20; Conquered; `cycle_power`; band picker (farm cleared bands @ half tokens) | §9e, §9h farm |
| **C** | Pro for combat bits | Boss bands (Scout/Semi/Final fat HP); Tide/Ember/Root/Spark +20%; wave preview; drop preview; Avatar star roll+pity; Dive Power weight trim | §9f–9i |
| **D** | Flash | Gear Score + Skip-to-even (no unique/frag from skip) | §9j |
| **E** | Pro | Bound Boss: fragments, unlock ★1, star via StarTable, max 2 pads, auto skill | §9k |
| **F** | Flash | Shop **stubs** + Dev kit buttons for A–E; Expo smoke checklist | §9i stubs |
| **G** | — | SakPix swap (Canva/you); one PR when smoke+desired art | §10 |

**Abort rules:** If B fails twice → ship A0+A only (engines ready). If E fails → forever loop without Bound Boss still valid (farm uniques + Avatar star). Bound Boss is stretch fantasy, not required for “full loop.”

### Full loop definition (done enough to grind forever)
Campaign Conquered works + farm Final + soft-caps + type match + drop preview. GS skip and Bound Boss are **QoL / fantasy** on top — great, not blockers.

### Go / no-go
**GO** for DeepSeek starting **A0 → A → B**. Do not start E before C. Do not invent new systems mid-phase.

