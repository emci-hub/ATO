# Most me / Gut call — source (current wording)

Gathered for review only. No rewrites. No app edits. Not committed.

---

## 1. Most me (forced ranking)

Surface: Home and You (`RankingCard`). One trait axis per week. Statements come from `RANKING_ROUNDS`; chrome from `sage-copy.ts` plus `AXIS_EDITOR_COPY.label`. Drag handle a11y strings are also user-facing.

Live rounds are the first nine axes (extra six go to Gut call). The bank still defines 15 rounds; all 15 statement sets are listed below.

### Chrome

| Copy | Defined | Rendered |
|---|---|---|
| `Most me` | `src/lib/sage-copy.ts:60` `RANKING_LABEL` | `src/components/ranking-card.tsx:91–93` (kicker) |
| `Drag into order. Most you at the top.` | `src/lib/sage-copy.ts:62` `RANKING_LEDE` | `ranking-card.tsx:95–97` |
| `Most you` | inline | `ranking-card.tsx:98–100` (above the list) |
| `Least you` | inline | `ranking-card.tsx:102–104` (below the list) |
| `That's me` | `src/lib/sage-copy.ts:64` `RANKING_SAVE` | `ranking-card.tsx:114–116` (busy: `Saving…`) |
| `Not this week` | `src/lib/sage-copy.ts:66` `RANKING_SKIP` | `ranking-card.tsx:126–128` (busy: `Saving…`) |

Axis title on the card is `AXIS_EDITOR_COPY[prompt.axis].label` (`ranking-card.tsx:70, 94`). Hints in that same record are **not** shown on Most me (they are for the Does-Sage-know-you editor). Labels as currently stored:

| Axis | Label | File:line |
|---|---|---|
| openness | `New ideas` | `src/lib/sage-knows.ts:64` |
| conscientiousness | `Follow-through` | `67` |
| extraversion | `People time` | `72` |
| agreeableness | `Going along` | `76` |
| steadiness | `How rattled a bad day gets you` | `80` |
| attachment_anxiety | `How you handle getting close to people` | `84` |
| attachment_avoidance | `A bit of distance` | `88` |
| conflict_assertiveness | `In a disagreement` | `92` |
| conflict_cooperativeness | `Room for the other person` | `96` |
| autonomy | `My own way` | `100` |
| competence | `Hard things` | `104` |
| relatedness | `Connection` | `108` |
| growth_mindset | `After a miss` | `112` |
| locus_of_control | `When it falls apart` | `116` |
| self_efficacy | `A big task` | `120` |

Accessibility (drag handle, `ranking-card.tsx:243–244`):

- label: `Move: ${text}` (the statement)
- hint: `Drag to change order, most you at the top`

### Ranking statements

Source: `src/lib/ranking.ts` `RANKING_ROUNDS` (`60–166`). Each round is 5 lines, high pole → low pole. Order on screen is shuffled per week; the list below is bank order.

#### openness (`61–67`)

- `I like trying a path nobody around me has used yet` (`62`)
- `A new idea is usually worth a look` (`63`)
- `I mix the familiar with the occasional new thing` (`64`)
- `I tend to stick with what already works` (`65`)
- `I stick with the known path unless I have to change` (`66`)

#### conscientiousness (`68–74`)

- `I see a plan through even when it gets dull` (`69`)
- `I like having a plan and mostly follow it` (`70`)
- `I plan some things and leave others open` (`71`)
- `I keep plans loose and change them as I go` (`72`)
- `I keep it loose and decide in the moment` (`73`)

#### extraversion (`75–81`)

- `I get going when I am around people` (`76`)
- `A full room is usually fine with me` (`77`)
- `I can go either way on people time` (`78`)
- `I like a smaller circle most days` (`79`)
- `Quiet time is how I reset` (`80`)

#### agreeableness (`82–88`)

- `I go along when it keeps things easy` (`83`)
- `I will bend if it keeps the peace` (`84`)
- `I weigh going along against holding my ground` (`85`)
- `I hold my view even when it rubs a bit` (`86`)
- `I hold my ground even when it would be easier not to` (`87`)

#### steadiness (`89–95`)

- `I stay even when things wobble` (`90`)
- `Most wobble I can shake off` (`91`)
- `Some wobble lands, some I shake off` (`92`)
- `I feel it when things start to wobble` (`93`)
- `I feel it strongly when things wobble` (`94`)

#### attachment_anxiety (`96–102`)

- `I worry people will pull away` (`97`)
- `Closeness sometimes brings a worry they will leave` (`98`)
- `Sometimes I worry about that, sometimes I do not` (`99`)
- `I do not spend much time on whether people will leave` (`100`)
- `I do not spend time worrying people will pull away` (`101`)

#### attachment_avoidance (`103–109`)

- `I keep some distance even with people I like` (`104`)
- `I like a bit of space once things get close` (`105`)
- `I mix closeness with a bit of distance` (`106`)
- `I stay close once I am in, with a little room` (`107`)
- `I stay close once I am in` (`108`)

#### conflict_assertiveness (`110–116`)

- `In a disagreement I put my own point on the table` (`111`)
- `I say what I need, even if it is a bit sharp` (`112`)
- `I sometimes push and sometimes wait` (`113`)
- `I wait to see if it blows over` (`114`)
- `I step back rather than push` (`115`)

#### conflict_cooperativeness (`117–123`)

- `I look for something the other person can live with` (`118`)
- `I try to leave them a way through` (`119`)
- `I split attention between my outcome and theirs` (`120`)
- `I protect my outcome first, then see what is left` (`121`)
- `I protect my own outcome first` (`122`)

#### autonomy (`124–130`)

- `I want to do it my own way` (`125`)
- `I would rather pick the path than be handed one` (`126`)
- `I mix doing it my way with a path that is already there` (`127`)
- `A path someone else set is usually fine` (`128`)
- `A path already set is fine with me` (`129`)

#### competence (`131–137`)

- `I feel I can handle a hard thing` (`132`)
- `Hard things are usually in reach` (`133`)
- `Some hard things I can handle, some I cannot` (`134`)
- `A hard thing makes me pause` (`135`)
- `I doubt I can pull a hard thing off` (`136`)

#### relatedness (`138–144`)

- `A day needs a real connection with someone to land` (`139`)
- `I want a real check-in with someone most days` (`140`)
- `Some days I want connection, some I do not need it` (`141`)
- `A day can land without much of it` (`142`)
- `A day can land without needing much connection` (`143`)

#### growth_mindset (`145–151`)

- `After a miss I look for what to change so I can try again` (`146`)
- `A miss is usually a chance to look at what went wrong` (`147`)
- `After a miss I sometimes look for what to change and sometimes take it as closed` (`148`)
- `A miss often feels like the end of that path` (`149`)
- `After a miss I treat it as a sign I am not good at that` (`150`)

#### locus_of_control (`152–158`)

- `When it falls apart I look at what I might have done differently` (`153`)
- `I look first at what was in my hands` (`154`)
- `I sometimes look at what I might change and sometimes at what was out of my hands` (`155`)
- `I often figure it was mostly out of my hands` (`156`)
- `When it falls apart I figure it was bound to happen` (`157`)

#### self_efficacy (`159–165`)

- `Facing a big task I feel I can pull it off` (`160`)
- `A big task is usually something I can do` (`161`)
- `Facing a big task I sometimes feel I can pull it off and sometimes do not` (`162`)
- `A big task makes me unsure` (`163`)
- `Facing a big task I feel unsure I can pull it off` (`164`)

---

## 2. Gut call (scenario swipe-deck)

Surface: Home, Sage, You (`ScenarioCard`). One extra axis per week when Most me is not claiming the slot. Two forced choices. Swipe right = high pole, swipe left = low pole (`scenario-card.tsx:110–111`); both poles are also tappable.

There is **no timer** and no timer copy. Swipe threshold is `SWIPE_COMMIT = 72` pixels (`scenario-card.tsx:23`) — not shown in the UI.

### Chrome

| Copy | Defined | Rendered |
|---|---|---|
| `Gut call` | `src/lib/sage-copy.ts:69` `SCENARIO_LABEL` | `src/components/scenario-card.tsx:120–122` (kicker) |
| `Swipe or tap. One pick.` | `src/lib/sage-copy.ts:71` `SCENARIO_LEDE` | `scenario-card.tsx:123` |
| `Not this week` | `src/lib/sage-copy.ts:66` `RANKING_SKIP` (shared with Most me) | `scenario-card.tsx:160–162` (busy: `Saving…`) |

Choice buttons show `prompt.def.high.label` / `prompt.def.low.label` (`scenario-card.tsx:138, 149`). Stem is `prompt.def.setup` (`127`).

### Deck

Source: `src/lib/scenario.ts` `SCENARIO_DECK` (`63–100`).

#### locus_of_control (`64–69`)

- Stem: `A project falls apart. First thought:` (`66`)
- High: `I could've done something differently` (`67`)
- Low: `That was bound to happen` (`68`)

#### growth_mindset (`70–75`)

- Stem: `You bomb a presentation. Gut reaction:` (`72`)
- High: `Let me figure out what went wrong` (`73`)
- Low: `Guess I'm not good at this` (`74`)

#### self_efficacy (`76–81`)

- Stem: `Big task, tight deadline. You feel:` (`78`)
- High: `I've got this` (`79`)
- Low: `Not sure I can pull this off` (`80`)

#### autonomy (`82–87`)

- Stem: `Best day at work is one where:` (`84`)
- High: `I did it my way` (`85`)
- Low: `I followed a plan that worked` (`86`)

#### competence (`88–93`)

- Stem: `Best day at work is one where:` (`90`)
- High: `I nailed something hard` (`91`)
- Low: `I got through the day fine` (`92`)

#### relatedness (`94–99`)

- Stem: `Best day at work is one where:` (`96`)
- High: `I connected with people` (`97`)
- Low: `I got a lot done on my own` (`98`)
