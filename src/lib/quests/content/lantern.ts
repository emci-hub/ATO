import type { Approach, AxisTag, QuestCampaign, QuestChoice, QuestScene, StatDelta, StoryLine } from '@/lib/quests/types';
import type { TraitAxis } from '@/lib/traits';

/**
 * The Drowned Lantern (ATO-BUILD PHASE-18). Written to docs/quests-style-guide.md.
 * Shape: 12 positions, every one a primary scene (3 per target axis), so every
 * path is exactly 12 scenes. Four scenes are twins at a position (three check
 * fails and the secret scene's ordinary twin). Copy lives only in this file.
 *
 *   ch1  1 gate (autonomy)  2 fork (openness)  3 ladder (self-efficacy, check)
 *   ch2  4 toll | 4b toll_wet (assertiveness)  5 lake (openness, check)
 *        6 signal | 6b cold_shore (autonomy)
 *   ch3  7 hum (secret) | 7b ledge (self-efficacy)  8 dispute (assertiveness, check)
 *        9 gantry | 9b gantry_slick (autonomy)
 *   ch4  10 winch (self-efficacy)  11 vey (assertiveness)  12 way (openness)
 */
const nar = (text: string, ...keywords: string[]): StoryLine => ({ kind: 'narrator', text, ...(keywords.length ? { keywords } : {}) });
const say = (speaker: string, text: string, ...keywords: string[]): StoryLine => ({
  kind: 'dialogue',
  speaker,
  text,
  ...(keywords.length ? { keywords } : {}),
});
const tag = (axis: TraitAxis, pole: 1 | -1, w: 1 | 0.4 = 1): AxisTag => ({ axis, pole, w });

interface ChoiceInit {
  label: string;
  approach: Approach;
  result: StoryLine[];
  tags?: AxisTag[];
  stats?: StatDelta;
  hint?: string;
  flags?: string[];
  next?: string;
  check?: QuestChoice['check'];
}
const choice = (id: string, c: ChoiceInit): QuestChoice => ({
  id,
  label: c.label,
  approach: c.approach,
  ...(c.hint ? { hint: c.hint } : {}),
  result: c.result,
  tags: c.tags ?? [],
  ...(c.stats ? { stats: c.stats } : {}),
  ...(c.flags ? { setFlags: c.flags } : {}),
  ...(c.next ? { next: c.next } : {}),
  ...(c.check ? { check: c.check } : {}),
});

const SCENES: QuestScene[] = [
  // ---- chapter 1 ---------------------------------------------------------------
  {
    id: 'lantern_s1_gate',
    chapter: 1,
    primaryAxis: 'autonomy',
    lines: [
      nar("Hollowmere's mine is half underwater, and the lantern you came for is somewhere below.", 'lantern'),
      say('The Elder', "Stick to the marked route. Every crew that didn't came back with less."),
      nar('Rook is already wading in, boots held high.', 'Rook'),
    ],
    choices: [
      choice('follow_map', {
        label: "We follow the elder's map, step by step.",
        approach: 'steady',
        result: [nar('The crew falls into line. The map is good, and the water stays shallow.')],
        tags: [tag('autonomy', -1)],
        stats: { morale: 1 },
      }),
      choice('own_way', {
        label: "Thanks. We'll find our own way down.",
        approach: 'act',
        result: [nar('The Elder shrugs. You wade past the marked posts and into the dark.')],
        tags: [tag('autonomy', 1)],
        stats: { renown: 1 },
      }),
      choice('rook_leads', {
        label: "Rook, you've been down there. You lead.",
        approach: 'talk',
        result: [say('Rook', 'Finally, someone sensible. Stay close and mind the drip.')],
        tags: [tag('autonomy', -1, 0.4)],
        stats: { morale: 1 },
        flags: ['trusted_rook'],
      }),
      choice('check_depth', {
        label: 'Drop a pebble first and count the splash.',
        approach: 'wait',
        result: [nar('Two seconds before the plink. Deep enough to matter, shallow enough to start.')],
      }),
    ],
    next: 'lantern_s2_fork',
    art: { location: 'lantern.flooded-gate', props: [{ id: 'lantern', x: 150 }], tint: '#2a4a6b', cast: ['rook', 'elder'] },
  },
  {
    id: 'lantern_s2_fork',
    chapter: 1,
    primaryAxis: 'openness',
    lines: [
      nar("The tunnel splits. Left is the dry miners' road. Right glows a blue no map mentions.", 'blue'),
      say('Rook', 'Your call, captain.'),
    ],
    choices: [
      choice('blue_glow', {
        label: 'Follow the blue glow.',
        approach: 'explore',
        hint: 'costs supplies',
        result: [nar('The glow hums as you near it. Your pack feels lighter than it should.')],
        tags: [tag('openness', 1)],
        stats: { supplies: -1, renown: 1 },
        flags: ['saw_glow'],
      }),
      choice('miners_road', {
        label: "Take the miners' road.",
        approach: 'steady',
        result: [nar('Dry boards, old lamp hooks, and a quiet you can lean on.')],
        tags: [tag('openness', -1)],
        stats: { supplies: 1 },
      }),
      choice('ask_rook', {
        label: 'Ask Rook what she thinks.',
        approach: 'talk',
        result: [say('Rook', 'Honestly? The blue. But I would say that.')],
        tags: [tag('autonomy', -1, 0.4)],
        stats: { morale: 1 },
        flags: ['saw_glow'],
      }),
      choice('flip_coin', {
        label: 'Flip a coin and let the cave decide.',
        approach: 'wait',
        result: [nar('Heads. You all stare at the coin, then at the glow, and nobody says a word.')],
      }),
    ],
    next: 'lantern_s3_ladder',
    art: { location: 'lantern.tunnel-fork', props: [{ id: 'glow-crystal', x: 140 }], tint: '#1f5f7a', cast: ['rook'] },
  },
  {
    id: 'lantern_s3_ladder',
    chapter: 1,
    primaryAxis: 'self_efficacy',
    lines: [
      nar('A rope ladder hangs over the gap. Three rungs are missing and one is groaning.', 'ladder'),
      say('Rook', 'It held the last crew. Probably.'),
    ],
    choices: [
      choice('fix_ladder', {
        label: 'I can fix this ladder myself.',
        approach: 'act',
        result: [nar('Spare cord, a knot you half remember, and one very steady breath.')],
        tags: [tag('self_efficacy', 1)],
        check: { stat: 'supplies', dc: 8, success: 'lantern_s4_toll', fail: 'lantern_s4b_toll_wet' },
      }),
      choice('wait_ladder', {
        label: "Let's wait for someone who's done this.",
        approach: 'wait',
        hint: 'costs supplies',
        result: [nar('An hour later a line of lamp-bearers passes, and you learn the knot by watching.')],
        tags: [tag('self_efficacy', -1)],
        stats: { supplies: -1, morale: 1 },
      }),
      choice('press_rungs', {
        label: 'Press each rung before we trust it.',
        approach: 'steady',
        result: [nar('Two rungs say no. The rest say maybe, which is enough for a careful crew.')],
      }),
      choice('look_around', {
        label: 'Look for a way around the gap.',
        approach: 'explore',
        result: [nar('Behind a fallen beam you find a ledge as wide as a bookshelf. Rook calls it "a path".')],
        stats: { morale: -1 },
      }),
    ],
    next: 'lantern_s4_toll',
    art: { location: 'lantern.tunnel-fork', props: [{ id: 'mine-cart', x: 60 }], tint: '#244f63', cast: ['rook'] },
  },

  // ---- chapter 2 ---------------------------------------------------------------
  {
    id: 'lantern_s4_toll',
    chapter: 2,
    primaryAxis: 'conflict_assertiveness',
    lines: [
      nar('Vey has strung a rope across the only bridge and sits on it like a cat.', 'Vey'),
      say('Vey', "Toll's two rations each. Or swim."),
    ],
    choices: [
      choice('drop_rope', {
        label: "No. That's a robbery. Drop the rope.",
        approach: 'act',
        result: [nar('Vey blinks, then grins. The rope drops, and so does the price.')],
        tags: [tag('conflict_assertiveness', 1)],
        stats: { renown: 1 },
      }),
      choice('pay_toll', {
        label: 'Pay it. Not worth the fight.',
        approach: 'steady',
        hint: 'costs supplies',
        result: [nar('Four rations change hands. Vey salutes you with one of them.')],
        tags: [tag('conflict_assertiveness', -1)],
        stats: { supplies: -2, morale: 1 },
      }),
      choice('offer_map', {
        label: 'Offer the map for passage.',
        approach: 'talk',
        result: [say('Vey', 'A map nobody else has? Now that is a toll I can respect.')],
        tags: [tag('conflict_cooperativeness', 1, 0.4), tag('openness', 1, 0.4)],
        flags: ['gave_map'],
      }),
      choice('ask_toll', {
        label: 'Ask what the toll actually pays for.',
        approach: 'talk',
        result: [say('Vey', 'Bridge repairs. Rope. Mostly snacks.')],
      }),
    ],
    next: 'lantern_s5_lake',
    art: { location: 'lantern.toll-bridge', props: [{ id: 'rope-bridge', x: 98 }], tint: '#31485e', cast: ['vey'] },
  },
  {
    id: 'lantern_s4b_toll_wet',
    chapter: 2,
    primaryAxis: 'conflict_assertiveness',
    lines: [
      nar('You reach the bridge dripping, one boot squelching. Vey looks you over and keeps the rope up.', 'Vey'),
      say('Vey', "Toll's two rations each. Or swim again."),
    ],
    choices: [
      choice('drop_rope', {
        label: "We're soaked already. Drop the rope.",
        approach: 'act',
        result: [nar('Vey laughs so hard the rope sags. It drops, and the price drops with it.')],
        tags: [tag('conflict_assertiveness', 1)],
        stats: { renown: 1 },
      }),
      choice('pay_toll', {
        label: 'Pay it. We just want to get dry.',
        approach: 'steady',
        hint: 'costs supplies',
        result: [nar('Vey takes four rations and throws in a dry sock. One sock.')],
        tags: [tag('conflict_assertiveness', -1)],
        stats: { supplies: -2, morale: 1 },
      }),
      choice('offer_map', {
        label: 'Offer the map for passage.',
        approach: 'talk',
        result: [say('Vey', 'A map nobody else has? Now that is a toll I can respect.')],
        tags: [tag('conflict_cooperativeness', 1, 0.4), tag('openness', 1, 0.4)],
        flags: ['gave_map'],
      }),
      choice('ask_fire', {
        label: 'Ask if there is a fire on the other side.',
        approach: 'talk',
        result: [say('Vey', 'There is. It has a very strict no-wet-boots policy.')],
      }),
    ],
    next: 'lantern_s5_lake',
    art: { location: 'lantern.toll-bridge', props: [{ id: 'rope-bridge', x: 98 }], tint: '#2c4258', cast: ['vey'] },
  },
  {
    id: 'lantern_s5_lake',
    chapter: 2,
    primaryAxis: 'openness',
    lines: [nar('Something glints on the lake bed, deep under the glowing water.', 'glints')],
    variants: [
      {
        requires: { flags: ['saw_glow'] },
        lines: [nar('The glint is the same blue you saw in the tunnel, and the lake bed hums back at you.', 'blue')],
      },
    ],
    choices: [
      choice('dive_in', {
        label: 'Dive in and look.',
        approach: 'explore',
        result: [nar('The cold bites. Your lungs burn. Then you see it.')],
        tags: [tag('openness', 1)],
        stats: { renown: 1, morale: -1 },
        check: { stat: 'morale', dc: 9, success: 'lantern_s6_signal', fail: 'lantern_s6b_cold_shore' },
      }),
      choice('rig_hook', {
        label: 'Rig a hook and pull it up safely.',
        approach: 'steady',
        hint: 'costs supplies',
        result: [nar('Rope, a bent spoon, and patience. The thing rises slowly.')],
        tags: [tag('openness', -1)],
        stats: { supplies: -1 },
      }),
      choice('make_camp', {
        label: 'Make camp; decide in the morning.',
        approach: 'wait',
        result: [nar('A warm fire, a shared pot, and the lake singing you to sleep.')],
        stats: { morale: 2 },
      }),
      choice('call_out', {
        label: 'Call across the water and listen.',
        approach: 'talk',
        result: [nar('Your voice comes back as three notes. Rook hums the fourth, and the water stills.')],
      }),
    ],
    next: 'lantern_s6_signal',
    art: { location: 'lantern.singing-lake', props: [{ id: 'raft', x: 120 }], tint: '#1b6d86' },
  },
  {
    id: 'lantern_s6_signal',
    chapter: 2,
    primaryAxis: 'autonomy',
    lines: [
      nar('Old miners painted a red line along the wall. It is still bright under the glow.', 'red line'),
      say('Rook', "Follow it and you won't get lost. Or chalk your own and see where it goes."),
    ],
    choices: [
      choice('follow_line', {
        label: "We follow the miners' red line.",
        approach: 'steady',
        result: [nar('The line leads through a dry pass. Easy going, and nobody minds.')],
        tags: [tag('autonomy', -1)],
        stats: { morale: 1 },
      }),
      choice('own_line', {
        label: "We chalk our own mark and go our way.",
        approach: 'act',
        result: [nar('Steeper, wetter, and entirely yours. Rook chalks a tiny lantern next to your mark.')],
        tags: [tag('autonomy', 1)],
        stats: { renown: 1 },
      }),
      choice('eat_first', {
        label: "Eat first. Maps are better on a full stomach.",
        approach: 'wait',
        result: [nar('Cheese, crackers, and a long look at the wall. The line starts to look friendlier.')],
        stats: { morale: 1, supplies: -1 },
      }),
      choice('read_signs', {
        label: 'Read the painted warnings out loud.',
        approach: 'talk',
        result: [say('Rook', '"Mind the step." "Mind the other step." Somebody really cared about steps.')],
      }),
    ],
    next: 'lantern_s7_hum',
    art: { location: 'lantern.tunnel-fork', props: [{ id: 'lantern', x: 40 }], tint: '#3a4f6e', cast: ['rook'] },
  },
  {
    id: 'lantern_s6b_cold_shore',
    chapter: 2,
    primaryAxis: 'autonomy',
    lines: [
      nar('The current drags you to a cold shore of black pebbles. Rook hauls you out by the collar.', 'shore'),
      say('Rook', 'Chalk marks up the rocks. Old ones. Or we climb it ourselves.'),
    ],
    choices: [
      choice('follow_chalk', {
        label: "We follow the old crews' chalk marks.",
        approach: 'steady',
        result: [nar('The marks wind up a dry slope. Whoever drew them knew every loose stone.')],
        tags: [tag('autonomy', -1)],
        stats: { morale: 1 },
      }),
      choice('own_climb', {
        label: 'I pick my own way up the rocks.',
        approach: 'act',
        result: [nar('Handhold by handhold, soaked and slipping. The crew follows your boots.')],
        tags: [tag('autonomy', 1)],
        stats: { renown: 1 },
      }),
      choice('wring_socks', {
        label: 'Wring out the socks, then decide.',
        approach: 'wait',
        result: [nar('Ten minutes, six socks, and one very proud sock-wringing speech from Rook.')],
        stats: { morale: 1 },
      }),
      choice('share_blanket', {
        label: 'Share the last dry blanket around.',
        approach: 'talk',
        result: [nar('Four people, one blanket, and a long silence that somehow feels like a pep talk.')],
        stats: { morale: 1 },
      }),
    ],
    next: 'lantern_s7_hum',
    art: { location: 'lantern.singing-lake', props: [{ id: 'ration-crate', x: 60 }], tint: '#26394f', cast: ['rook'] },
  },

  // ---- chapter 3 ---------------------------------------------------------------
  {
    // Secret: only with the glow flag. Closed gate skips to the ordinary twin below.
    id: 'lantern_s7_hum',
    chapter: 3,
    primaryAxis: 'self_efficacy',
    requires: { flags: ['saw_glow'] },
    lines: [
      nar('The blue glow has followed you. In a crack in the wall, a small door hums, rusted shut.', 'door'),
      say('Rook', 'Never seen that before. Never seen anyone brag about it, either.'),
    ],
    choices: [
      choice('pry_door', {
        label: 'I can pry this open myself.',
        approach: 'act',
        result: [nar('Bar, shoulder, one bad word. The door gives. Behind it: a shelf of old lamps, all humming.')],
        tags: [tag('self_efficacy', 1)],
        stats: { renown: 1 },
        next: 'lantern_s8_dispute',
      }),
      choice('wait_door', {
        label: "Let's wait for someone who knows doors like this.",
        approach: 'wait',
        result: [say('Rook', 'Mark it on the map. Later, with the right people, this becomes a very good story.')],
        tags: [tag('self_efficacy', -1)],
        stats: { morale: 1 },
        next: 'lantern_s8_dispute',
      }),
      choice('press_ear', {
        label: 'Press an ear to the hum.',
        approach: 'explore',
        result: [nar('It is not a hum. It is a lullaby, very slow, and slightly out of tune.')],
        next: 'lantern_s8_dispute',
      }),
      choice('leave_coin', {
        label: 'Leave a coin and keep walking.',
        approach: 'steady',
        result: [nar('The coin clinks once. The hum drops half a note, as if it said thank you.')],
        stats: { renown: 1 },
        next: 'lantern_s8_dispute',
      }),
    ],
    next: 'lantern_s7b_ledge',
    art: { location: 'lantern.singing-lake', props: [{ id: 'glow-crystal', x: 110 }], tint: '#2a88a8', cast: ['rook'] },
  },
  {
    id: 'lantern_s7b_ledge',
    chapter: 3,
    primaryAxis: 'self_efficacy',
    lines: [
      nar('A narrow ledge leads on. Its iron anchor wobbles when you touch it.', 'anchor'),
      say('Rook', 'Somebody set that in a hurry. I respect the optimism.'),
    ],
    choices: [
      choice('reset_anchor', {
        label: 'I can reset this anchor myself.',
        approach: 'act',
        result: [nar('Hammer, wedge, and a deep breath. The anchor settles with a satisfying clunk.')],
        tags: [tag('self_efficacy', 1)],
        stats: { renown: 1 },
      }),
      choice('wait_anchor', {
        label: "Let's wait for the next crew and borrow their know-how.",
        approach: 'wait',
        result: [nar('Two crews pass. The second shows you the trick and a cup of tea.')],
        tags: [tag('self_efficacy', -1)],
        stats: { morale: 1, supplies: -1 },
      }),
      choice('crawl_ledge', {
        label: 'Cross on hands and knees, one at a time.',
        approach: 'steady',
        result: [nar('Slow, undignified, and perfectly safe. Rook is already planning the story.')],
      }),
      choice('tie_off', {
        label: 'Tie everyone together and go slow.',
        approach: 'talk',
        result: [nar('The rope hums between you like a very serious bracelet.')],
        stats: { morale: 1 },
      }),
    ],
    next: 'lantern_s8_dispute',
    art: { location: 'lantern.ceiling-crack', props: [{ id: 'mine-cart', x: 150 }], tint: '#324a63', cast: ['rook'] },
  },
  {
    id: 'lantern_s8_dispute',
    chapter: 3,
    primaryAxis: 'conflict_assertiveness',
    lines: [
      nar('A crew from Dunmarsh blocks the narrow pass, lanterns high, arms folded.', 'Dunmarsh'),
      say('Dunmarsh Captain', 'We were here first. You can wait.'),
    ],
    choices: [
      choice('hold_pass', {
        label: 'We were here first, actually. Step aside, please.',
        approach: 'act',
        result: [nar('You say it calmly and keep your boots planted. The Dunmarsh captain looks at the lantern and shifts.')],
        tags: [tag('conflict_assertiveness', 1)],
        check: { stat: 'renown', dc: 9, success: 'lantern_s9_gantry', fail: 'lantern_s9b_gantry_slick' },
      }),
      choice('let_pass', {
        label: "Go ahead. We'll wait our turn.",
        approach: 'steady',
        result: [nar('They nod, surprised. Ten minutes later they are gone and the pass is yours, quiet and wide.')],
        tags: [tag('conflict_assertiveness', -1)],
        stats: { morale: 1 },
      }),
      choice('swap_turns', {
        label: 'Suggest we trade turns, three at a time.',
        approach: 'talk',
        result: [say('Dunmarsh Captain', "Three and three. Fine. You count, I'll watch your count.")],
        tags: [tag('conflict_cooperativeness', 1, 0.4)],
        stats: { morale: 1 },
      }),
      choice('share_tea', {
        label: 'Offer a hot drink and ask about the route ahead.',
        approach: 'talk',
        result: [nar('The captain thaws by half a degree and mutters something about a slippery gantry.')],
        stats: { supplies: -1 },
      }),
    ],
    next: 'lantern_s9_gantry',
    art: { location: 'lantern.tunnel-fork', props: [{ id: 'lantern', x: 70 }], tint: '#3b4a60', cast: ['rook'] },
  },
  {
    id: 'lantern_s9_gantry',
    chapter: 3,
    primaryAxis: 'autonomy',
    lines: [
      nar('A cart rail runs downhill toward daylight. A painted sign reads RIDE AT OWN RISK.', 'RISK'),
      nar('Underneath, someone has added in smaller letters: please do not.'),
    ],
    choices: [
      choice('ride_cart', {
        label: "It's our risk. We ride.",
        approach: 'act',
        result: [nar('The wheels scream, the lantern swings, and Rook laughs the whole way down.')],
        tags: [tag('autonomy', 1)],
        stats: { renown: 1 },
      }),
      choice('follow_sign', {
        label: 'We take the sign at its word and walk.',
        approach: 'steady',
        result: [nar('The path is long and the floor is dry. The sign seems pleased with you.')],
        tags: [tag('autonomy', -1)],
        stats: { supplies: 1 },
      }),
      choice('push_empty', {
        label: 'Send the empty cart down first and watch.',
        approach: 'wait',
        result: [nar('It rattles away, hits a bump, and sails into the dark. You all nod, very seriously.')],
      }),
      choice('hang_lantern', {
        label: 'Hang our spare lamp on the cart and follow its light.',
        approach: 'explore',
        result: [nar('The light bobs ahead like a polite ghost, and you chase it down the slope.')],
      }),
    ],
    next: 'lantern_s10_winch',
    art: { location: 'lantern.ceiling-crack', props: [{ id: 'mine-cart', x: 90 }], tint: '#4a5a6e', cast: ['rook'] },
  },
  {
    id: 'lantern_s9b_gantry_slick',
    chapter: 3,
    primaryAxis: 'autonomy',
    lines: [
      nar('The Dunmarsh crew pushes ahead. The gantry they leave you is slick and dripping.', 'gantry'),
      say('Rook', 'We could follow my lead across. Or you could pick your own footing.'),
    ],
    choices: [
      choice('follow_rook', {
        label: "We follow Rook's footing, step for step.",
        approach: 'steady',
        result: [nar('Rook counts out loud. The gantry shudders and holds, one plank at a time.')],
        tags: [tag('autonomy', -1)],
        stats: { morale: 1 },
      }),
      choice('own_footing', {
        label: 'I pick my own footing and go first.',
        approach: 'act',
        result: [nar('One hand on the wall, one boot at a time. The others copy your route.')],
        tags: [tag('autonomy', 1)],
        stats: { renown: 1 },
      }),
      choice('dry_planks', {
        label: 'Dry the planks with our scarves first.',
        approach: 'wait',
        result: [nar('Four scarves, a lot of squeaking, and the gantry looks almost respectable.')],
        stats: { supplies: -1 },
      }),
      choice('sing_across', {
        label: 'Hum a marching tune to keep the pace.',
        approach: 'talk',
        result: [nar('The tune is bad. The pace is perfect. Nobody slips.')],
        stats: { morale: 1 },
      }),
    ],
    next: 'lantern_s10_winch',
    art: { location: 'lantern.ceiling-crack', props: [{ id: 'rope-bridge', x: 100 }], tint: '#3a4a5e', cast: ['rook'] },
  },

  // ---- chapter 4 (finale) -------------------------------------------------------
  {
    id: 'lantern_s10_winch',
    chapter: 4,
    primaryAxis: 'self_efficacy',
    lines: [nar('A winch lifts the last stretch to the surface. Its gear is jammed, and the bell beside it says RING FOR HELP.', 'winch')],
    variants: [
      {
        requires: { flags: ['trusted_rook'] },
        lines: [
          nar('A winch lifts the last stretch. Its gear is jammed, and a bell hangs beside it.', 'winch'),
          say('Rook', "I'd say fix it. But you know what I'd say, and you picked me for a reason."),
        ],
      },
    ],
    choices: [
      choice('free_gear', {
        label: 'I can free the gear myself.',
        approach: 'act',
        result: [nar('A little oil, a lot of leaning. The gear clicks free and everyone cheers like it was easy.')],
        tags: [tag('self_efficacy', 1)],
        stats: { renown: 1 },
      }),
      choice('ring_bell', {
        label: "Let's ring the bell for the winch keeper.",
        approach: 'wait',
        result: [nar('The keeper arrives, grumbling, and fixes it in four seconds. You learn the trick by watching.')],
        tags: [tag('self_efficacy', -1)],
        stats: { morale: 1 },
      }),
      choice('check_rope', {
        label: 'Look the rope over for wear first.',
        approach: 'steady',
        result: [nar('Frayed in one place, fine in the rest. You mark the frayed place with a bit of red thread.')],
      }),
      choice('haul_together', {
        label: 'Everyone takes the rope and we haul together.',
        approach: 'talk',
        result: [nar('One, two, heave. It is not elegant, and it works.')],
        stats: { morale: 1, supplies: -1 },
      }),
    ],
    next: 'lantern_s11_vey',
    art: { location: 'lantern.ceiling-crack', props: [{ id: 'mine-cart', x: 130 }], tint: '#6a7a8a', cast: ['rook'] },
  },
  {
    id: 'lantern_s11_vey',
    chapter: 4,
    primaryAxis: 'conflict_assertiveness',
    lines: [
      nar('Vey waits at the last gate with a smaller rope and a larger grin.', 'Vey'),
      say('Vey', "Exit's a ration a head. Family discount if you promise not to tell anyone."),
    ],
    variants: [
      {
        requires: { flags: ['gave_map'] },
        lines: [
          nar('Vey waits at the last gate, holding a copy of your map like a menu.', 'map'),
          say('Vey', "Three crews have used it already. You get the friends rate: one ration, no stories."),
        ],
      },
    ],
    choices: [
      choice('free_exit', {
        label: 'The exit stays free. The rope goes.',
        approach: 'act',
        result: [nar('Vey tilts their head, then unhooks the rope and pockets it with a shrug.')],
        tags: [tag('conflict_assertiveness', 1)],
        stats: { renown: 1 },
      }),
      choice('pay_exit', {
        label: "Fair enough. We'll pay the small fee.",
        approach: 'steady',
        hint: 'costs supplies',
        result: [nar('One ration each. Vey bows and holds the gate open like a very small king.')],
        tags: [tag('conflict_assertiveness', -1)],
        stats: { supplies: -1, morale: 1 },
      }),
      choice('trade_stories', {
        label: 'Trade stories for passage.',
        approach: 'talk',
        result: [say('Vey', 'A real story? With a dragon? No? Fine. A goose. Go on.')],
        stats: { morale: 1 },
      }),
      choice('hold_lantern', {
        label: 'Ask Vey to hold our spare lamp while we climb.',
        approach: 'talk',
        result: [nar('Vey holds it, solemn as a statue, and does not charge for the privilege.')],
      }),
    ],
    next: 'lantern_s12_way',
    art: { location: 'lantern.ceiling-crack', props: [{ id: 'rope-bridge', x: 60 }], tint: '#7a8a9a', cast: ['vey'] },
  },
  {
    id: 'lantern_s12_way',
    chapter: 4,
    primaryAxis: 'openness',
    lines: [
      nar("Somewhere along the way, the lantern ended up in your pack. Rook says that's how it always goes."),
      nar('Two ways out: the long known road, or a ceiling crack with daylight.', 'daylight'),
    ],
    choices: [
      choice('climb_daylight', {
        label: 'Climb toward the daylight.',
        approach: 'explore',
        result: [nar('Wet rock, then dry air, then the whole sky.')],
        tags: [tag('openness', 1), tag('autonomy', 1, 0.4)],
        flags: ['daylight'],
      }),
      choice('long_road', {
        label: 'Take the long road.',
        approach: 'steady',
        result: [nar('You know every bend of it, and it knows you back.')],
        tags: [tag('openness', -1)],
        flags: ['long_road'],
      }),
      choice('crew_vote', {
        label: 'Let the crew vote.',
        approach: 'talk',
        result: [nar('The crew chose, and the crew was right.')],
        tags: [tag('autonomy', -1)],
        flags: ['daylight'],
      }),
    ],
    next: null,
    art: { location: 'lantern.ceiling-crack', props: [{ id: 'lantern', x: 100 }], tint: '#e8d9a8', cast: ['rook'] },
  },
];

export const LANTERN: QuestCampaign = {
  id: 'lantern',
  title: 'The Drowned Lantern',
  setting: 'fantasy',
  minutes: 7,
  contentVersion: 1,
  sceneIdsFrozen: SCENES.map((s) => s.id),
  targetAxes: ['openness', 'autonomy', 'conflict_assertiveness', 'self_efficacy'],
  startStats: { supplies: 3, morale: 2, renown: 0 },
  firstScene: 'lantern_s1_gate',
  scenes: SCENES,
  endings: [
    {
      id: 'end_rooks_lantern',
      title: "Rook's Lantern",
      when: { flags: ['trusted_rook', 'daylight'] },
      lines: [nar("Rook hangs the lantern by the crack where the daylight leaks in. It's still lit when you leave town.")],
      art: 'lantern.ending-rooks-lantern',
    },
    {
      id: 'end_toll_forward',
      title: 'The Toll Paid Forward',
      when: { flags: ['gave_map', 'long_road'] },
      lines: [nar('Vey copies your map and charges no one. The bridge stays open, and the long road gets busy.')],
      art: 'lantern.ending-toll-forward',
    },
    {
      id: 'end_singing_deep',
      title: 'The Singing Deep',
      when: { flags: ['daylight'] },
      lines: [nar('You found the lantern under the singing lake, where no map said to look. The village will tell this one for years.')],
      art: 'lantern.ending-singing-deep',
    },
    {
      id: 'end_long_way_home',
      title: 'The Long Way Home',
      when: {},
      lines: [nar('You brought it back the way it left. Steady hands. The lantern is lit in the square tonight.')],
      art: 'lantern.ending-long-way-home',
    },
  ],
};
