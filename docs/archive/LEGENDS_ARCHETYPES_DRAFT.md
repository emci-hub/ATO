# Legends archetype redesign — DRAFT, not implemented

Status: conversational design only. Nothing in this file has been built, migrated, or
signed off as final copy. Captured here so it isn't lost, not as a spec to build from
without another pass together first.

## Structure

64 archetypes = 2^6, built from the 6 axes the existing 12-archetype catalog already
leaned on most (ranked by frequency across the old `arch_the_*` defs):
conscientiousness, extraversion, openness, agreeableness, conflict_assertiveness,
relatedness.

- **Core** (8) = Conscientiousness x Extraversion x Openness (high/low each)
- **Modifier** (8) = Agreeableness x conflict_assertiveness x Relatedness (high/low each)
- Full archetype = Modifier + Core, no articles.

Code key: uppercase = high, lowercase = low, order C-E-O-A-S-R
(Conscientiousness, Extraversion, Openness, Agreeableness, aSsertiveness, Relatedness).

## Cores (C x E x O)

| Code | Meaning |
|---|---|
| CEO | driven, social, exploratory |
| CEo | driven, social, practical |
| CeO | driven, solitary, exploratory |
| Ceo | driven, solitary, practical |
| cEO | loose plans, social, exploratory |
| cEo | loose plans, social, practical |
| ceO | loose plans, solitary, exploratory |
| ceo | loose plans, solitary, practical |

## Modifiers (A x S x R)

| Code | Meaning |
|---|---|
| ASR | warm, assertive, connection-seeking |
| ASr | warm, assertive, independent |
| AsR | warm, yielding, connection-seeking |
| Asr | warm, yielding, independent |
| aSR | firm, assertive, connection-seeking |
| aSr | firm, assertive, independent |
| asR | firm, yielding, connection-seeking |
| asr | firm, yielding, independent |

## The 6 naming themes (user-selectable skin over the same match)

### Cores

| Code | Gaming | God-type | Anime | Real title | Funny | Dark |
|---|---|---|---|---|---|---|
| CEO | Vanguard | Herald | Hot-Blooded Hero | Founder | Main Character | Conqueror |
| CEo | Warlord | Sovereign | Class President | Executive | Group Chat CEO | Usurper |
| CeO | Artificer | Forgemaster | Genius Loner | Inventor | Mad Scientist | Necromancer |
| Ceo | Engineer | Artisan | Silent Ace | Specialist | Spreadsheet Goblin | Gravekeeper |
| cEO | Bard | Reveler | Wildcard Sidekick | Creative Director | Feral Party Gremlin | Trickster Fiend |
| cEo | Ranger | Hearthkeeper | Senpai | Account Manager | Group Mom Friend | Cult Leader |
| ceO | Mystic | Oracle | Dreaming Outsider | Consultant | 3AM Thoughts Poster | Wandering Ghost |
| ceo | Wanderer | Wildkeeper | Ronin | Freelancer | Airplane Mode Icon | Reaper |

### Modifiers

| Code | Gaming | God-type | Anime | Real title | Funny | Dark |
|---|---|---|---|---|---|---|
| ASR | Healer | Devoted | Tsundere | People-First | Rizzler | Beloved |
| ASr | Paladin | Radiant | Genki | Self-Made | Unbothered | Fatale |
| AsR | Support | Gentle | Dandere | Team-Oriented | Soft | Sympathetic |
| Asr | Druid | Serene | Kuudere | Independent | Cozy | Elegant |
| aSR | Warrior | Vengeful | Onee | Results-Driven | Petty | Ruthless |
| aSr | Berserker | Unbending | Kakkoii | Self-Reliant | Villain-Arc | Unrepentant |
| asR | Sentinel | Veiled | Senpai | Behind-the-Scenes | Judgy | Silent |
| asr | Rogue | Solitary | Mysterious | Low-Key | Ghosting | Shadow |

Example (code `CEO-ASR`, all 6 themes): Healer Vanguard / Devoted Herald / Tsundere
Hot-Blooded Hero / People-First Founder / Rizzler Main Character / Beloved Conqueror.

## Known open items (not yet decided)

- This replaces the existing 12 `arch_the_*` archetypes entirely — old catalog is meant
  to be retired, not kept alongside.
- Matching math still needs the earlier-agreed fixes before this ships: percentage-based
  scoring (not binary hit/miss) and full 16-axis weighting per archetype (only 6 axes
  are used for the archetype *label*, but the earlier agreement was to still weight all
  16 for the match score itself — this file only covers the label/naming layer).
- "Dark" theme was deliberately kept to a gothic/antihero aesthetic (not grim/heavy) per
  this app's crisis-sensitivity constraints — revisit only if explicitly asked for
  something edgier.
- No schema/migration work has been done. Building this for real needs its own
  approval pass, same as any other schema change in this repo.
