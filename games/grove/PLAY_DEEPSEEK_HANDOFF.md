# Play / Grove — DeepSeek build handoff (token-cheap, red-teamed)

**Design:** 10/10 locked in `GAME_SPEC.md` (wins), `GAME_LOOP.md`, `GAME_DATA.md`.  
**Repo:** https://github.com/emci-hub/ATO  
**Art v0:** placeholders only (`// TODO: SakPix swap`).  
**Supabase:** wired — **local/AsyncStorage first**; `play_*` tables only in an optional sync step after Grove loop works.  
**Never:** Play on Home; rewrite questions/Home/Sage; Godot/Unity; SakPix this week; invent new combat systems.

## Red-team verdict (2026-09-08)

Handoff was **not** finish-safe as first written. Fixed below.

| Kill risk | Fix in this file |
|---|---|
| Dive before item defs → empty loot loop | **Step 2b** ships stub `items.json` (6 Looks + 4 Power) **before** Dive |
| Defend too big for one chat → half-game forever | Defend split **5a / 5b / 5c** |
| Questions polish vs Play both edit tabs → merge hell | Play lives under `src/play/**` (or `app/play/**`); entry = **You → Play** button first (no new tab until loop works) |
| Persistence unclear → agent breaks Supabase | Steps 1–5 = **local store only** (`playStore`); sync later |
| Content floor 24 Looks burns tokens | v0 content = **10 stub items** total; floor is soft-launch later |
| $10 dies on Pro spam / long threads | Flash default; Pro only 5b–5c; new chat each step |
| “Addon never ships” if TD fails | **Shippable bar = Steps 1–4** (Grove+Claim+Dive+Dress). Defend is stretch. Chill path is valid. |

**Best we can do on $10:** finish **1–4 always**; finish **5a–5c** if budget allows. Steps 6–7 optional. 8–9 skip.

---

## Model picker

| Step | Model |
|---|---|
| 1, 2, 2b, 3, 4, 5a, 6, 7 | **Flash** |
| 5b towers+scrap, 5c drag+skill | **Pro** |
| Any step fails twice on Flash | one **Pro** retry, then cut scope |


## Dev kit (standing — every step)

Grove/Divecore screen has a **Dev kit** block, visible when `PRE_LAUNCH_DEV` **and** unlocked with local password `Calgary1!` (client soft-gate). Wrong/locked = hidden. App Store strips via `PRE_LAUNCH_DEV` false.

- Each new Play feature that is time/RNG gated must add a **dev button** here to force the ready state / grant / reset for that feature.
- Never use Dev kit in production (`PRE_LAUNCH_DEV` false = hidden).
- Prefer calling `playStore` helpers; no duplicate fake state.

Starter buttons (step 2.5): Fill research · Fill research full · +10 tokens · Fill dive 10 · Reset play store.

Later examples: grant Dive find · force Surface bank · start Defend wave 1 with scrap · clear inventory · unlock skill CD.

## Token rules

1. One step = **one new Composer chat**.  
2. `@PLAY_DEEPSEEK_HANDOFF.md` + only the cited `GAME_SPEC` sections — never whole spec.  
3. Commit these 4 md files into ATO once on the Play branch.  
4. No mock PNGs after step 1.  
5. “Touch only `src/play/**` (or `app/play/**`) + one You-screen link. Diff only.”  
6. Expo Go check before next step.  
7. Prefer off-peak DeepSeek hours when easy.

## Branch

Single branch: `play/grove-v0`. Commit after each step. **One PR** at the end (or when 1–4 done). Do not merge until Expo Go smoke passes.

## Shared store (required from step 2)

One module e.g. `src/play/playStore.ts`:
- `tokens`, `dive_charge`, `research_accrued`, `last_tend_bonus_ymd`, `inventory[]`, `equipped`, `highest_wave_cleared`
- persist AsyncStorage
- no Supabase until optional sync

---

## Paste prompts (one per chat)

### Step 1 — Flash — shell
```
@PLAY_DEEPSEEK_HANDOFF.md @GAME_SPEC.md (§3 §11 only)

Branch play/grove-v0. ONE job.

Add Play behind You → “Play” button (NOT a new main tab yet, NOT on Home).
Create play folder isolation. Grove screen: placeholder avatar, fake tokens, Claim fake bag toast, Dive/Dress/Defend “soon” disabled.
Do not edit Home/Sage/questions/Circle except the single You link.
Diff only. Stop. List files touched.
```

### Step 2 — Flash — local economy
```
@PLAY_DEEPSEEK_HANDOFF.md @GAME_SPEC.md (§5 §8 §16b)

ONE job. Implement playStore (AsyncStorage): tokens, dive_charge 0–10 (~10min refill), Research 30m cycles / 10h cap / one Claim dump, daily tend +10 once/device-local-day.
Claim uses stub loot (can be hardcoded array for now). No Dive UI. No Supabase. Diff only in play/**. Stop.
```

### Step 2b — Flash — stub items (BEFORE Dive)
```
@GAME_DATA.md (item shape only)

ONE job. Add data/play/items.json with exactly 10 stubs: 6 Look, 4 Power (mix wave_power/tower_speed/token_earn/dive_luck/research_yield). Wire Claim to roll from this table. No Dress UI yet. Diff only. Stop.
```

### Step 3 — Flash — Dive
```
@GAME_SPEC.md §7 (odds table)

ONE job. Dive screen: spend charge → find card → Surface/Deeper → bust climbs → max 4 Deepers → bank to inventory on Surface. Show odds. Ban words: gamble/casino/jackpot/bet. Uses items.json. No Defend. Diff only. Stop.
```

### Step 4 — Flash — Dress
```
@GAME_DATA.md item + equipped shape

ONE job. Dress: 4 slots, inventory list, equip/unequip, compute mult buckets into playStore. Inventory soft-cap 80 simple. No Defend. Diff only. Stop.
```

### Step 5a — Flash — Defend board only
```
@GAME_SPEC.md §9 map + fail/win + wave ladder + start_scrap

ONE job. Defend setup+live skeleton: one path, spawn puff placeholders along path, leak at exit = fail, Retry keeps empty pads, wave = highest+1, start_scrap 80 shown, pause freezes.
NO towers yet, NO hero skill yet. Diff only. Stop when wave can leak/fail and Retry works.
```

### Step 5b — Pro — towers
```
@GAME_SPEC.md §9 §9b tower targeting + GAME_DATA tower upgrade

ONE job. 6 pads, 3 types (archer/vine/crystal), place/upgrade with scrap, range ring on select, auto-fire, kills → scrap. Use equipped wave_power/tower_speed from playStore. No drag hero skill yet (hero can be static placeholder DPS optional). Diff only. Stop when wave 1 clearable with towers only.
```

### Step 5c — Pro — drag + skill
```
@GAME_SPEC.md §9b §9d

ONE job. Draggable Avatar (or Hero later), one skill button (starter slow_pulse), skill cooldown, win → tokens+XP+highest_wave update. ≤20 enemies, 30fps or cut count. Diff only. Stop.
```

### Step 6 — Flash — optional
```
ONE job. Win Results share stub (Share API / existing ATO share if easy) + milestones 5/10/25 grant one Look id. Skip push pings if not trivial. Diff only. Stop.
```

### Step 7 — Flash — optional
```
ONE job. __DEV__ Tune presets Sane/Juicy/Brutal/BrokenOP writing overrides into playStore. Diff only. Stop.
```

### Optional later — Flash — Supabase sync
```
ONE job. play_* tables + RLS keyed by ATO user_id; sync tokens/inventory on foreground. Do not touch non-play tables. Only after 1–4 feel good.
```

---

## Acceptance (don’t advance without)

| After | Expo Go must show |
|---|---|
| 1 | You→Play→Grove; Claim bumps fake tokens |
| 2 | Kill app; tokens/charges still there |
| 2b | Claim can grant named stub item |
| 3 | Full Dive Surface/Deeper/bust once |
| 4 | Equip Power; bucket numbers visible |
| 5a | Enemy reaches exit → fail → Retry |
| 5b | Clear wave 1 with towers |
| 5c | Clear wave 3 with drag+skill |

## Abort / save-the-addon rules

- If **5a** fails twice → ship **1–4** as Play v0 (Grove+Dive+Dress). Defend stays “soon”. Still a finished addon.
- If money &lt; ~$2 left before 5b → stop at 5a or 1–4. Don’t start Pro mid-broke.
- If merge conflicts on You screen → keep Play link; never resolve by editing Home.
- SakPix = separate later Flash chat: replace assets only, no logic.

## Done when (realistic)

**Minimum ship:** Claim → Dive bank → Dress equip → persist.  
**Target ship:** + Defend wave 3 clear.  
**Not required for “addon finished”:** SakPix, IAP, ads, push, Supabase sync, 24 Looks.


---

## Phase 2 — Forever loop (post 1–7) — red-team 2026-09-09

**GO.** Cite `GAME_SPEC.md` §18 + only the section for that phase. Full loop = A0→C; D/E stretch.

### Order
A0 copy polish → A engines+JSON → B campaign/Conquered → C bosses/type/drops → D GS skip → E Bound Boss → F shop stubs → G SakPix/PR

### Phase prompts (paste one per chat)

### A0 — Flash — Divecore copy
```
@PLAY_DEEPSEEK_HANDOFF.md @GAME_SPEC.md (§18 A0 + naming)

Branch play/grove-v0. ONE job: Divecore product copy/UX only.
Rename Grove chrome → Divecore / Basecore where user-facing.
Add newbie blurbs: play icon feel, token/charge one-liners, Dress bonus categories, Defend wave bands + scrap hint.
No new systems. Touch only play UI strings + hub. Commit. Expo smoke.
```

### A — Flash — engines
```
@PLAY_DEEPSEEK_HANDOFF.md @GAME_SPEC.md (§9l §18 A + Dev kit lock) @GAME_DATA.md

Branch play/grove-v0. ONE job: forever engine stubs + data shapes + Dev kit password lock.
Keep Dev kit (do NOT remove). Gate it: PRE_LAUNCH_DEV AND unlock with password Calgary1! (local soft-gate; hide until unlocked).
Add helpers: StarTable, DropTable, SoftCap, CycleScaler (pure TS).
Add data/*.json stubs (drops, stars, waves, bound_bosses empty).
Migrate playStore v: campaign, conquered_cycles, cycle_power, lifetime_waves_cleared, bound_bosses[].
Dev kit: Dump save v + keep existing force buttons. Commit.
```

### B — Flash — campaign
```
@PLAY_DEEPSEEK_HANDOFF.md @GAME_SPEC.md (§9e §9h farm §18 B)

Branch play/grove-v0. ONE job: Trial 1–5 then Main 1–20, Conquered on Main 20, cycle_power apply to enemy HP/count.
Band picker: replay cleared bands at half tokens. lifetime_waves_cleared milestones.
Main map JSON (waypoints+pads) — Trial reuses current path.
Pro only if Flash fails twice. Commit. Smoke Trial→Main→Conquered once.
```

### C — Pro — bosses + type + drops
```
@PLAY_DEEPSEEK_HANDOFF.md @GAME_SPEC.md (§9f §9g §9h §9i §18 C)

Branch play/grove-v0. ONE job: Scout 9–10 / Semi 19 / Final 20 fat bosses; soft type match +20%; setup chart+?; wave+drop preview; Avatar star 25%+pity 3rd; trim Dive Power weights.
Use DropTable. No Bound Boss yet. Commit.
```

### D — Flash — GS skip
```
@PLAY_DEEPSEEK_HANDOFF.md @GAME_SPEC.md (§9j §18 D)

ONE job: Gear Score + Skip-to-even. No uniques/frags/Avatar star from skip. One skip crate/batch. Stop before boss bands. Commit.
```

### E — Pro — Bound Boss
```
@PLAY_DEEPSEEK_HANDOFF.md @GAME_SPEC.md (§9k §18 E)

ONE job: boss fragments → unlock Bound Boss tower; StarTable stars; max 2 pads; auto skill only (no extra skill button). No pity. Commit.
```

