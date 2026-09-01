# Sage copy — Pass 2 source (current wording)

Gathered for review only. No rewrites. No app edits. Not committed as part of this gather (file may exist locally uncommitted).

---

## 1. Does Sage know you?

### Surface

Home and Sage. Never inside a Talk reply. Banked lines only — no model call for this card.

### Kicker / header

`Does Sage know you?`

- Defined: `src/lib/sage-copy.ts:51` — `export const SAGE_KNOWS_LABEL = 'Does Sage know you?';`
- Rendered: `src/components/sage-knows-card.tsx:80–82` as the card kicker.

### Body line on the card

The body is `prompt.line` (`sage-knows-card.tsx:83`). That string is **not** the bank line as stored. `resolveSageKnows` (`src/lib/sage-knows.ts:395–411`) takes a high/low bank line, then `composeSageKnowsLine` (`src/lib/sage-knows.ts:315–326`) does:

1. Replace `\bThey\b` / `\bthey\b` with `You` / `you` (`secondPerson`, `src/lib/sage-knows.ts:288–290`).
2. Strip the trailing period.
3. Wrap with one of two endings:

No signal (kind `check-in`):

```
${clause}. Still in the neighborhood?
```

With a Nudge signal (kind `signal`):

```
${signalLead(signal)} — ${clause…}. Still how it works?
```

Signal leads (`src/lib/sage-knows.ts:309–312`):

- skip-pattern: `A few skips this week`
- knock, by chip: see table below
- fact: `Something you told Sage is still in play this week`

Knock leads (`src/lib/sage-knows.ts:292–306`):

| Chip id | Lead |
|---|---|
| `sleep` | `Sleep showed up this week` |
| `workload` | `Workload showed up this week` |
| `people/conflict` | `People / conflict showed up this week` |
| `health` | `Health showed up this week` |
| `money` | `Money showed up this week` |
| (anything else) | `Something you named as a knock-off showed up this week` |

Mid-band axes never appear on this card. Only `TRAIT_POLE_LINES` high/low.

### Buttons and editor chrome

From `src/components/sage-knows-card.tsx`:

| Copy | File:line |
|---|---|
| `Still fits` | `112` (`Saving…` while busy) |
| `Not quite` | `124` |
| `Not this week` | `132` (`Saving…` while busy) |
| `Keep the note` | `100` (shown after Not quite, while the axis editor is open) |

Not quite opens `AxisTaps` with `AXIS_EDITOR_COPY[prompt.axis]` label + hint (`sage-knows-card.tsx:61, 86–88`). Those labels/hints live in `src/lib/sage-knows.ts:62–123` (also used by the You-tab ranking card — listed here because they appear on this feature when editing).

### Bank: `TRAIT_POLE_LINES` (verbatim)

Source: `src/lib/traits.ts:443–504`. Comment at `438–441`: used by Sage prompts **and** Does-Sage-know-you.

#### extraversion (`443–447`)

- high: `They tend to get energy from being around people.`
- low: `They tend to get energy from quieter time.`

#### openness (`448–451`)

- high: `They tend to like new ideas and untried paths.`
- low: `They tend to prefer the known path over a new one.`

#### conscientiousness (`452–455`)

- high: `They tend to follow a plan through.`
- low: `They tend to keep plans loose and change them as they go.`

#### agreeableness (`456–459`)

- high: `They tend to go along when it keeps things easy.`
- low: `They tend to hold their own view even when it rubs.`

#### steadiness (`460–463`)

- high: `They tend to stay even when things wobble.`
- low: `They tend to feel it strongly when things wobble.`

#### attachment_anxiety (`464–467`)

- high: `They tend to worry people will pull away.`
- low: `They tend not to spend much time worrying people will leave.`

#### attachment_avoidance (`468–471`)

- high: `They tend to keep some distance even with people they like.`
- low: `They tend to stay close once they are in.`

#### conflict_assertiveness (`472–475`)

- high: `In a disagreement they tend to put their own point on the table.`
- low: `In a disagreement they tend to step back rather than push.`

#### conflict_cooperativeness (`476–479`)

- high: `In a disagreement they tend to look for something the other person can live with.`
- low: `In a disagreement they tend to protect their own outcome first.`

#### autonomy (`480–483`)

- high: `They tend to want to do things their own way.`
- low: `They tend to be fine following a path someone else already set.`

#### competence (`484–487`)

- high: `They tend to feel they can handle a hard thing.`
- low: `They tend to doubt they can pull a hard thing off.`

#### relatedness (`488–491`)

- high: `They tend to need a real connection with people for a day to land.`
- low: `They tend to feel a day landed without needing much connection.`

#### growth_mindset (`492–495`)

- high: `After a miss they tend to look for what went wrong so they can try again.`
- low: `After a miss they tend to treat it as a sign they are not good at that thing.`

#### locus_of_control (`496–499`)

- high: `When something falls apart, first thought tends to go to what they might have done differently.`
- low: `When something falls apart, first thought tends to go to how it was bound to happen.`

#### self_efficacy (`500–503`)

- high: `Facing a big task they tend to feel they can pull it off.`
- low: `Facing a big task they tend to feel unsure they can pull it off.`

### Related bank: `TRAIT_MID_LINES` (prompt only, not on the card)

Source: `src/lib/traits.ts:506–524`. Private const. `traitPromptLines` (`537–547`) includes these when an axis is mid-band. The check-in card skips mid.

- extraversion (`507`): `They sit somewhere in the middle on people-time versus quiet time.`
- openness (`508`): `They mix familiar routines with the occasional new idea.`
- conscientiousness (`509`): `They plan some things and leave others open.`
- agreeableness (`510`): `They weigh going along against holding their ground.`
- steadiness (`511`): `Some wobble lands, some they shake off.`
- attachment_anxiety (`512`): `Closeness sometimes brings a worry that people will pull away.`
- attachment_avoidance (`513`): `They mix closeness with a bit of distance.`
- conflict_assertiveness (`514`): `In a disagreement they sometimes push and sometimes wait.`
- conflict_cooperativeness (`515–516`): `In a disagreement they split attention between their outcome and the other person.`
- autonomy (`517`): `They mix doing it their way with following a path that is already there.`
- competence (`518`): `Some hard things they feel they can handle, some they do not.`
- relatedness (`519`): `Some days they want connection, some they do not need it.`
- growth_mindset (`520`): `After a miss they sometimes look for what to change and sometimes take it as closed.`
- locus_of_control (`521–522`): `When something falls apart they sometimes look at what they might change and sometimes at what was out of their hands.`
- self_efficacy (`523`): `Facing a big task they sometimes feel they can pull it off and sometimes do not.`

`traitPromptLines` then appends (`547`):

`- Treat the lines above as self-report about how they tend to move, never as a type or a diagnosis.`

That block is concatenated into both the card generate prompt and the Talk prompt via `intakeContext` (`src/lib/voice/providers/prompt.ts:66–68`).

---

## 2. Raw chip ids in Sage’s model prompt

All definitions: `src/lib/intake.ts`. Interpolation: `src/lib/voice/providers/prompt.ts` unless noted.

Stored `value` is interpolated with **no** `chipLabel()` lookup. If the field is set, the model sees the id (or the stored phrase, which *is* the chip value).

`intakeContext` is used by `buildPrompt` (card, line 99) and `buildTalkPrompt` (Talk, line 175). `signalPool` is card-only (`buildPrompt` line 103). Talk also interpolates `show_up` and `knocks_you_off` directly (lines 172–173).

### current_focus

Defined `src/lib/intake.ts:17` (type) and `117–122` (chips).

| id | UI label |
|---|---|
| `habit` | Build a habit |
| `through_it` | Get through something hard |
| `like_yourself` | Feel more like myself |
| `show_up` | Just show up |

Interpolated:

- `src/lib/voice/providers/prompt.ts:42` — `- Current focus chip: ${me.current_focus}` (`signalPool`, card prompt)
- `src/lib/voice/providers/prompt.ts:65` — `- What they're mostly trying to do right now: ${me.current_focus}` (`intakeContext`, card + Talk)

Also placed in an internal match pool (not pasted as prompt copy): `src/lib/voice/library.ts:102` (`signalPoolFor`).

### energy_pattern

Defined `src/lib/intake.ts:16` and `95–100`.

| id | UI label |
|---|---|
| `morning` | Morning |
| `afternoon` | Afternoon |
| `evening` | Evening |
| `night_owl` | Night owl |

Interpolated: `src/lib/voice/providers/prompt.ts:62` — `- When they say they have the most in the tank: ${me.energy_pattern}` (`intakeContext`, card + Talk).

### recovery_style

Defined `src/lib/intake.ts:18` and `102–108`.

| id | UI label |
|---|---|
| `movement` | Movement |
| `sleep` | Sleep |
| `talking` | Talking to someone |
| `alone_time` | Alone time |
| `music` | Music |

Interpolated:

- `src/lib/voice/providers/prompt.ts:44` — `- What they say pulls them back: ${me.recovery_style}` (`signalPool`, card)
- `src/lib/voice/providers/prompt.ts:63` — same sentence (`intakeContext`, card + Talk)

Also in `library.ts:102` match pool.

### support_style

Defined `src/lib/intake.ts:19` and `110–115`.

| id | UI label |
|---|---|
| `nudge` | A nudge to keep going |
| `space` | Space to sit with it |
| `listen` | Someone to listen |
| `plan` | A plan to fix it |

Interpolated: `src/lib/voice/providers/prompt.ts:64` — `- What they say helps: ${me.support_style}` (`intakeContext`, card + Talk).

### knocks_you_off

Defined `src/lib/intake.ts:20–26` and `63–70`. Stored as a joined string (`sleep, workload`, delimiter `', '` at line 45). Split on interpolate in `signalPool`; Talk passes the raw joined string.

| id | UI label |
|---|---|
| `sleep` | Sleep |
| `workload` | Workload |
| `people/conflict` | People / conflict |
| `health` | Health |
| `money` | Money |
| `something else` | Something else |

Interpolated:

- `src/lib/voice/providers/prompt.ts:30–37` — `- Knocks they named (rotate; do not default to the first one every day): ${knocks.join('; ')}` (`signalPool`, card)
- `src/lib/voice/providers/prompt.ts:173` — `- What knocks them off: ${me.knocks_you_off}` (`buildTalkPrompt`)

Also split in `library.ts:97–100` for matching.

### show_up

Defined `src/lib/intake.ts:54–61`. Chip `value` equals the lowercase label.

| id (stored value) | UI label |
|---|---|
| `building something` | Building something |
| `getting through it` | Getting through it |
| `finding my feet` | Finding my feet |
| `showing up anyway` | Showing up anyway |
| `clearing space` | Clearing space |
| `running hot` | Running hot |

Interpolated:

- `src/lib/voice/providers/prompt.ts:43` — `- How this week feels: ${me.show_up}` (`signalPool`, card)
- `src/lib/voice/providers/prompt.ts:172` — `- How this week feels (self-report): ${me.show_up}` (`buildTalkPrompt`)

Also in `library.ts:102` match pool.

### evening_wind_down

Defined `src/lib/intake.ts:86–93`. Stored value is the infinitive phrase (not the “When I …” label).

| id (stored value) | UI label |
|---|---|
| `put my phone down` | When I put my phone down |
| `shut off the lights` | When I shut off the lights |
| `get in bed` | When I get in bed |
| `wash up` | When I wash up |
| `stretch` | When I stretch |
| `watch one thing` | When I watch one thing |

Interpolated: `src/lib/voice/providers/prompt.ts:61` — `- Evening wind-down they named: ${me.evening_wind_down}` (`intakeContext`, card + Talk).

### morning_cue

Defined `src/lib/intake.ts:76–84`. Stored value is the infinitive (not the “After I …” label).

| id (stored value) | UI label |
|---|---|
| `make coffee` | After I make coffee |
| `brush my teeth` | After I brush my teeth |
| `check my phone` | After I check my phone |
| `get out of bed` | After I get out of bed |
| `pour water` | After I pour water |
| `put on music` | After I put on music |
| `take a shower` | After I take a shower |

Interpolated:

- `src/lib/voice/providers/prompt.ts:98` — `- Morning cue (anchor the Do to this): ${me.morning_cue}` (`buildPrompt`)
- `src/lib/voice/providers/prompt.ts:174` — `- Morning cue: ${me.morning_cue}` (`buildTalkPrompt`)
- `src/lib/voice/providers/prompt.ts:111` — example in RULES: `"After you ${cueAfterYou(me.morning_cue)}, <specific concrete action>."`

### talk_style

Defined `src/lib/intake.ts:14` and `47–51`: `quiet` | `even` | `loud`.

Not interpolated as a bare id. Mapped through `TALK_STYLE_GUIDE` (`src/lib/voice/providers/types.ts:43–47`):

- `quiet`: `quiet: understated, 1–3 short sentences, no exclamation.`
- `even`: `even: plain, measured, matter-of-fact.`
- `loud`: `loud: short, punchy, a little energy, exclamation allowed.`

Inserted at `prompt.ts:91` (card) and `prompt.ts:171` (Talk) as `- Talk style: ${styleGuide[me.talk_style]}`. The id is the first token of that sentence.

### Full id list (closed enums that can appear as-is)

`habit`, `through_it`, `like_yourself`, `show_up` (focus), `morning`, `afternoon`, `evening`, `night_owl`, `movement`, `sleep` (recovery and/or knocks), `talking`, `alone_time`, `music`, `nudge`, `space`, `listen`, `plan`, `workload`, `people/conflict`, `health`, `money`, `something else`, plus show_up phrases, evening-wind-down phrases, morning-cue phrases, and `quiet` / `even` / `loud` as the Talk-style guide prefix.

---

## 3. “never as a diagnosis” (audit line)

The line the Pass 1 audit pointed at:

**File:** `src/lib/voice/providers/prompt.ts`  
**Line:** `67`

```58:69:src/lib/voice/providers/prompt.ts
/** Self-report intake lines. Not a diagnosis — they tapped these. */
function intakeContext(me: VoiceMe): string {
  const lines: string[] = [];
  if (me.evening_wind_down) lines.push(`- Evening wind-down they named: ${me.evening_wind_down}`);
  if (me.energy_pattern) lines.push(`- When they say they have the most in the tank: ${me.energy_pattern}`);
  if (me.recovery_style) lines.push(`- What they say pulls them back: ${me.recovery_style}`);
  if (me.support_style) lines.push(`- What they say helps: ${me.support_style}`);
  if (me.current_focus) lines.push(`- What they're mostly trying to do right now: ${me.current_focus}`);
  const traits = traitPromptLines(me);
  const intake = lines.length === 0 ? '' : `${lines.join('\n')}\n- Treat the lines above as self-report, never as a diagnosis.\n`;
  return `${intake}${traits}`;
}
```

Quoted string on line 67 (the instruction the model receives, when any of those five intake fields is set):

`- Treat the lines above as self-report, never as a diagnosis.`

That function is inlined into:

- Card generate: `buildPrompt` at `prompt.ts:99` (`${intakeContext(me)}- Recent checks:`)
- Talk generate: `buildTalkPrompt` at `prompt.ts:175`

Same wording family elsewhere (not the audit’s cited line; listed so the review set is complete):

- `src/lib/traits.ts:547` — `- Treat the lines above as self-report about how they tend to move, never as a type or a diagnosis.` (appended after pole/mid trait lines inside `traitPromptLines`, which `intakeContext` concatenates after the line above)
- `src/lib/voice/providers/prompt.ts:113` — card RULES item 4: `Describe how they tend to move, never label them. No type codes, no scores-as-identity, no diagnosis.`
- `src/lib/voice/providers/prompt.ts:183` — Talk retry hint: `Describe how they tend to move — never a type, score, or diagnosis.`
- `src/lib/voice/providers/prompt.ts:189` — Talk closer: `Never a diagnosis, never judgment of the person, never a type label.`
- `src/lib/voice/providers/prompt.ts:58` — comment on `intakeContext`: `Self-report intake lines. Not a diagnosis — they tapped these.` (comment only; not sent to the model)
- `src/lib/intake.ts:3–5` — file comment: `Self-report only. These are tappable answers the person chose, never a diagnosis or assessment.` (comment only)
