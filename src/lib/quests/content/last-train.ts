import type { Approach, AxisTag, QuestCampaign, QuestChoice, QuestScene, StatDelta, StoryLine } from '@/lib/quests/types';
import type { TraitAxis } from '@/lib/traits';

/**
 * Last Train Home (ATO-BUILD PHASE-20). Written to docs/quests-style-guide.md, same shape as the Lantern and
 * the Masquerade: 12 positions, every one a primary scene, so every path is exactly 12 scenes. Three target
 * axes cannot fill 12 positions evenly at 3 each, so each axis gets 4 primaries (4 + 4 + 4).
 * Four scenes are twins at a position (three check fails and the secret scene's ordinary twin).
 * Copy lives only in this file. Cast pronouns: Mara she, Theo he, Dee they.
 *
 *   ch1  1 board (locus_of_control)  2 vending (conscientiousness)  3 busker (extraversion, check)
 *   ch2  4 umbrella | 4b downpour (conscientiousness)  5 cab (locus_of_control, check)
 *        6 cart | 6b cart_closing (extraversion)
 *   ch3  7 roof (secret) | 7b stop_map (locus_of_control)  8 diner (conscientiousness, check)
 *        9 booth | 9b rush (extraversion)
 *   ch4  10 stop (locus_of_control)  11 battery (conscientiousness)  12 first_light (extraversion)
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
    id: 'last_train_s1_board',
    chapter: 1,
    primaryAxis: 'locus_of_control',
    lines: [
      nar('The departure board flickers and shows one word: CANCELLED. It is 00:40, and the last train home is not coming.', 'CANCELLED'),
      nar('Around you, a dozen people hold up their phones like small lanterns.'),
    ],
    choices: [
      choice('plan_route', {
        label: 'I work out my own way home.',
        approach: 'explore',
        result: [nar('Night bus, one change, a twelve minute walk. It is not pretty, but it is yours.')],
        tags: [tag('locus_of_control', 1)],
        stats: { renown: 1 },
      }),
      choice('trust_luck', {
        label: "It's late. Something will turn up.",
        approach: 'wait',
        result: [nar('You lean on a pillar and give the night room to sort things out. A man with a cello case sighs the same sigh.')],
        tags: [tag('locus_of_control', -1)],
        stats: { morale: 1 },
      }),
      choice('ask_guard', {
        label: 'I ask the station guard what the plan is.',
        approach: 'talk',
        result: [say('Guard', 'The plan is the sign. The sign is the plan.')],
      }),
      choice('read_board', {
        label: 'I read the board twice, in case it changes its mind.',
        approach: 'steady',
        result: [nar('It does not. But the second time, you spot the night buses listed small at the bottom.')],
      }),
    ],
    next: 'last_train_s2_vending',
    art: { location: 'city.cancelled-platform', props: [{ id: 'departure-board', x: 70 }], tint: '#2a2060', cast: [] },
  },
  {
    id: 'last_train_s2_vending',
    chapter: 1,
    primaryAxis: 'conscientiousness',
    lines: [
      nar('A vending machine hums by the stairs. Your phone says 9 percent, and the machine has one working charge cable.', 'vending machine'),
      nar('A woman in scrubs sits beside it, eyes closed, one hand on the cable.'),
    ],
    choices: [
      choice('charge_map', {
        label: 'I plug in and map every stop before I leave.',
        approach: 'steady',
        hint: 'costs supplies',
        result: [nar('Eleven minutes, one bar of battery, and a route with two backups. The machine swallows your coins without comment.')],
        tags: [tag('conscientiousness', 1)],
        stats: { supplies: -1 },
      }),
      choice('wing_it', {
        label: 'I wing it and see what the city shows me.',
        approach: 'explore',
        result: [nar('Nine percent and a head full of ideas. You pocket the phone and walk like a person with options.')],
        tags: [tag('conscientiousness', -1)],
        stats: { morale: 1 },
      }),
      choice('ask_cable', {
        label: "I ask the woman if she's nearly done.",
        approach: 'talk',
        result: [
          say('Mara', "Nearly. I'm Mara. Night shift. Take it when I go."),
          nar('She leaves the cable plugged in for you, which is its own small kindness.'),
        ],
        flags: ['mara_cable'],
      }),
      choice('buy_crisps', {
        label: 'I buy chips and think it over.',
        approach: 'act',
        result: [nar('The machine drops two bags. Salt and vinegar, and a small, unearned win.')],
      }),
    ],
    next: 'last_train_s3_busker',
    art: { location: 'city.cancelled-platform', props: [{ id: 'vending-machine', x: 130 }, { id: 'phone', x: 50 }], tint: '#262a5c', cast: ['mara'] },
  },
  {
    id: 'last_train_s3_busker',
    chapter: 1,
    primaryAxis: 'extraversion',
    lines: [
      nar('Outside the station, a busker called Theo plays to nobody under a streetlight. His case holds three coins and half a granola bar.', 'busker'),
      say('Theo', 'Last train gone? Sit. I have a song for that.'),
    ],
    choices: [
      choice('join_song', {
        label: 'I sit down and sing along, badly.',
        approach: 'talk',
        result: [
          nar('Four bars in, you lose the key. A cab at the curb honks in time. Theo points at you like you meant it.'),
          say('Theo', 'Parking garage roof on Aldous Street. Best view in town, bad lock.'),
        ],
        tags: [tag('extraversion', 1)],
        stats: { renown: 1 },
        flags: ['sang', 'heard_roof'],
        check: { stat: 'morale', dc: 9, success: 'last_train_s4_umbrella', fail: 'last_train_s4b_downpour' },
      }),
      choice('keep_walking', {
        label: 'I nod to Theo and keep walking.',
        approach: 'steady',
        result: [nar('He lifts two fingers off the strings. You hear the song for a full block, getting smaller.')],
        tags: [tag('extraversion', -1)],
        stats: { morale: 1 },
      }),
      choice('tip_theo', {
        label: 'I drop a coin in the case and listen.',
        approach: 'act',
        hint: 'costs supplies',
        result: [nar('Theo plays the next one a little better. The coin is the smallest part of why.')],
        stats: { supplies: -1 },
      }),
      choice('ask_roof', {
        label: 'I ask Theo where a person can see the city.',
        approach: 'explore',
        result: [say('Theo', 'Parking garage roof on Aldous Street. Best view in town, bad lock.')],
        flags: ['heard_roof'],
      }),
    ],
    next: 'last_train_s4_umbrella',
    art: { location: 'city.night-street', props: [{ id: 'bike', x: 150 }], tint: '#1f2a5a', cast: ['theo'] },
  },

  // ---- chapter 2 ---------------------------------------------------------------
  {
    id: 'last_train_s4_umbrella',
    chapter: 2,
    primaryAxis: 'conscientiousness',
    lines: [
      nar('Rain starts as you reach the corner, thin and polite. A man by the bus map sells umbrellas from a shopping cart.', 'umbrellas'),
    ],
    choices: [
      choice('check_times', {
        label: 'I stop and check the bus times on my phone.',
        approach: 'steady',
        result: [nar('Night bus 91 at 01:25. The app agrees with you, and the rain is only decoration.')],
        tags: [tag('conscientiousness', 1)],
        stats: { morale: 1 },
      }),
      choice('run_for_it', {
        label: 'I run for the cab rank and sort it out there.',
        approach: 'act',
        result: [nar('You splash on to the cab rank, wet and early. Plans are for people with dry socks.')],
        tags: [tag('conscientiousness', -1)],
        stats: { renown: 1 },
      }),
      choice('buy_umbrella', {
        label: 'I buy an umbrella from the trolley.',
        approach: 'talk',
        hint: 'costs supplies',
        result: [nar('It is purple and enormous. The man throws in a lecture on the weather for free.')],
        stats: { supplies: -1 },
      }),
      choice('shelter_awning', {
        label: 'I wait under a shop awning for it to ease.',
        approach: 'wait',
        result: [nar('Three minutes of rain on tin. Then the sky shrugs and gives up.')],
      }),
    ],
    next: 'last_train_s5_cab',
    art: { location: 'city.night-street', props: [{ id: 'umbrella', x: 70 }], tint: '#243a5e', cast: [] },
  },
  {
    id: 'last_train_s4b_downpour',
    chapter: 2,
    primaryAxis: 'conscientiousness',
    lines: [
      nar('The sky opens. The street becomes a stream, and the man who sells umbrellas has vanished with his cart.', 'cart'),
      nar('A bus shelter stands thirty steps away. So does the bus map.'),
    ],
    choices: [
      choice('check_times', {
        label: 'I duck into the shelter and check the bus times.',
        approach: 'steady',
        result: [nar('Dry and slightly smug: night bus 91 at 01:25. The shelter smells of old rain.')],
        tags: [tag('conscientiousness', 1)],
        stats: { morale: 1 },
      }),
      choice('run_for_it', {
        label: 'I splash on to the cab rank and sort it out there.',
        approach: 'act',
        result: [nar('You arrive soaked and laughing. A cab driver hands you a towel and a look.')],
        tags: [tag('conscientiousness', -1)],
        stats: { renown: 1 },
      }),
      choice('call_out', {
        label: 'I shout for the man with the umbrellas.',
        approach: 'talk',
        hint: 'costs supplies',
        result: [nar('He pops out of a doorway, delighted. Two coins later, you are the best-covered person on the street.')],
        stats: { supplies: -1 },
      }),
      choice('wait_it_out', {
        label: 'I wait in a doorway until the sky calms.',
        approach: 'wait',
        result: [nar('Five minutes, one pigeon, and a last gurgle from the drain. Then it is only drizzle.')],
      }),
    ],
    next: 'last_train_s5_cab',
    art: { location: 'city.night-street', props: [{ id: 'umbrella', x: 70 }], tint: '#1c2f50', cast: [] },
  },
  {
    id: 'last_train_s5_cab',
    chapter: 2,
    primaryAxis: 'locus_of_control',
    lines: [
      nar('A cab idles at the rank with its light on. The driver, Dee, leans out of the window, one arm on the door.', 'Dee'),
      say('Dee', "Across town? Fare's double tonight, and I'm not fussy about the route."),
    ],
    choices: [
      choice('name_route', {
        label: 'I give Dee my route and agree a price.',
        approach: 'act',
        result: [nar("Dee raises an eyebrow. 'You've done this before.' You have not. It still works, mostly.")],
        tags: [tag('locus_of_control', 1)],
        stats: { renown: 1 },
        check: { stat: 'supplies', dc: 9, success: 'last_train_s6_cart', fail: 'last_train_s6b_cart_closing' },
      }),
      choice('leave_to_dee', {
        label: 'I tell Dee to take me wherever the night goes.',
        approach: 'wait',
        result: [say('Dee', 'My favorite kind of fare.'), nar('The meter ticks. So does the radio.')],
        tags: [tag('locus_of_control', -1)],
        stats: { morale: 1 },
      }),
      choice('ask_night', {
        label: "I ask Dee how the night's been.",
        approach: 'talk',
        result: [say('Dee', "Three bachelorette parties, one wedding, and a man with a goose. You're the first normal one.")],
      }),
      choice('look_dash', {
        label: 'I look over the dashboard, crowded with sticky notes.',
        approach: 'explore',
        result: [nar("One note says: Mom's birthday. Another says: Ask about the goose.")],
      }),
    ],
    next: 'last_train_s6_cart',
    art: { location: 'city.night-street', props: [{ id: 'bike', x: 40 }], tint: '#33305f', cast: ['dee'] },
  },
  {
    id: 'last_train_s6_cart',
    chapter: 2,
    primaryAxis: 'extraversion',
    lines: [
      nar('Dee pulls up at a food cart under a flickering sign. A line of night-shift people steams in the cold.', 'food cart'),
      say('Dee', "Best noodles in town. Go. I'll keep the engine warm."),
    ],
    choices: [
      choice('chat_queue', {
        label: 'I chat to the people in line.',
        approach: 'talk',
        result: [nar('A cleaner, two bakers, and a bouncer on his break. By the front you have a nickname and a tip about the 91.')],
        tags: [tag('extraversion', 1)],
        stats: { renown: 1 },
      }),
      choice('curb_eat', {
        label: 'I eat on the curb by myself and enjoy the quiet.',
        approach: 'wait',
        result: [nar('Noodles, steam, and a street that has finally stopped asking anything of you.')],
        tags: [tag('extraversion', -1)],
        stats: { morale: 1 },
      }),
      choice('order_double', {
        label: 'I order two bowls, one for Dee.',
        approach: 'act',
        hint: 'costs supplies',
        result: [say('Dee', "Nobody ever brings the driver a bowl. You're hired.")],
        stats: { supplies: -1 },
      }),
      choice('read_menu', {
        label: 'I read the whole menu board, twice.',
        approach: 'explore',
        result: [nar('There is a dish called Regret and Rice. You do not ask what is in it.')],
      }),
    ],
    next: 'last_train_s7_roof',
    art: { location: 'city.night-street', props: [{ id: 'food-cart', x: 110 }], tint: '#3a2c58', cast: ['dee'] },
  },
  {
    id: 'last_train_s6b_cart_closing',
    chapter: 2,
    primaryAxis: 'extraversion',
    lines: [
      nar('The meter and your coins disagree, so Dee drops you early with a shrug and a wave. The food cart is closing, one last bowl steaming.', 'food cart'),
    ],
    choices: [
      choice('chat_queue', {
        label: 'I chat to the cook while he packs up.',
        approach: 'talk',
        result: [nar('He gives you the last bowl and the story of how he came to own a cart. It is a good story.')],
        tags: [tag('extraversion', 1)],
        stats: { renown: 1 },
      }),
      choice('curb_eat', {
        label: 'I take the last bowl to the curb and eat alone.',
        approach: 'wait',
        result: [nar('Cold curb, warm hands, and nobody asking where you are going. You are quietly delighted.')],
        tags: [tag('extraversion', -1)],
        stats: { morale: 1 },
      }),
      choice('share_last', {
        label: 'I split the last bowl with a stranger.',
        approach: 'act',
        hint: 'costs supplies',
        result: [nar('The stranger accepts with the dignity of someone who is very hungry.')],
        stats: { supplies: -1 },
      }),
      choice('read_sign', {
        label: 'I read the sign on the cart, half packed away.',
        approach: 'explore',
        result: [nar('Open until the noodles run out. Today, that was now.')],
      }),
    ],
    next: 'last_train_s7_roof',
    art: { location: 'city.night-street', props: [{ id: 'food-cart', x: 110 }], tint: '#2f2850', cast: [] },
  },

  // ---- chapter 3 ---------------------------------------------------------------
  {
    // Secret: only if Theo told you about the roof. A closed gate skips to the ordinary twin below.
    id: 'last_train_s7_roof',
    chapter: 3,
    primaryAxis: 'locus_of_control',
    requires: { flags: ['heard_roof'] },
    lines: [
      nar('The parking garage roof has a bad lock and a very good view. The city lies below, a map of small lights.', 'bad lock'),
      nar('Somewhere in all that glow is your street.'),
    ],
    choices: [
      choice('plan_last_mile', {
        label: 'I pick out my street and plan the last mile.',
        approach: 'explore',
        result: [nar('Left at the tower, along the canal, over the bridge. From up here it looks easy. You file it away.')],
        tags: [tag('locus_of_control', 1)],
        stats: { renown: 1 },
        next: 'last_train_s8_diner',
      }),
      choice('watch_lights', {
        label: 'I watch the lights and let the night decide.',
        approach: 'wait',
        result: [nar('The city blinks at you. For once nothing needs deciding, and it feels like a gift.')],
        tags: [tag('locus_of_control', -1)],
        stats: { morale: 1 },
        next: 'last_train_s8_diner',
      }),
      choice('take_photo', {
        label: 'I take a photo of the whole city.',
        approach: 'act',
        result: [nar('It comes out blurry and perfect. The phone drops a percent in protest.')],
        next: 'last_train_s8_diner',
      }),
      choice('count_windows', {
        label: 'I count the lit windows in the tallest tower.',
        approach: 'steady',
        result: [nar('Forty-one lit. Forty-one other people awake, for reasons of their own.')],
        next: 'last_train_s8_diner',
      }),
    ],
    next: 'last_train_s7b_stop_map',
    art: { location: 'city.rooftop', props: [{ id: 'phone', x: 100 }], tint: '#1e2f5a', cast: [] },
  },
  {
    id: 'last_train_s7b_stop_map',
    chapter: 3,
    primaryAxis: 'locus_of_control',
    lines: [
      nar('A cracked route map is bolted to a shelter wall. Someone has drawn a small house on it in marker, with an arrow.', 'route map'),
      nar('It is not your house, but it feels close.'),
    ],
    choices: [
      choice('plan_last_mile', {
        label: 'I trace my own route on the map with a finger.',
        approach: 'explore',
        result: [nar('Two changes and one long walk. Not elegant, but it is a plan, and you made it.')],
        tags: [tag('locus_of_control', 1)],
        stats: { renown: 1 },
      }),
      choice('let_it_ride', {
        label: 'I sit on the bench and let the night decide.',
        approach: 'wait',
        result: [nar('The bench is cold and the street is quiet. You are nowhere in particular, and fine with it.')],
        tags: [tag('locus_of_control', -1)],
        stats: { morale: 1 },
      }),
      choice('photo_house', {
        label: 'I take a photo of the little marker house.',
        approach: 'act',
        result: [nar('It is a good photo of a bad drawing. You keep it anyway.')],
      }),
      choice('read_notes', {
        label: 'I read the notes scribbled on the shelter.',
        approach: 'steady',
        result: [nar('Most are rude. One says: it gets better after the 91. You choose to believe it.')],
      }),
    ],
    next: 'last_train_s8_diner',
    art: { location: 'city.last-bus-stop', props: [{ id: 'phone', x: 100 }], tint: '#2a2f5c', cast: [] },
  },
  {
    id: 'last_train_s8_diner',
    chapter: 3,
    primaryAxis: 'conscientiousness',
    lines: [
      nar('The 24h diner glows like a ship in the dark. A woman in scrubs waves from a booth. Her badge says Mara.', '24h diner'),
      say('Mara', 'Pancakes at two a.m. are medicine. Sit. Figure out your way home with me.'),
    ],
    variants: [
      {
        requires: { flags: ['mara_cable'] },
        lines: [
          nar('The 24h diner glows like a ship in the dark. Mara, who lent you the cable, waves from a booth.', '24h diner'),
          say('Mara', 'Pancakes at two a.m. are medicine. Sit. You have a plan, I assume?'),
        ],
      },
    ],
    choices: [
      choice('napkin_plan', {
        label: 'I draw the route on a napkin and split the bill.',
        approach: 'steady',
        result: [nar('Stops, times, backups, and who owes what, in one neat blue line. Mara frames it with her thumb and nods.')],
        tags: [tag('conscientiousness', 1)],
        check: { stat: 'renown', dc: 8, success: 'last_train_s9_booth', fail: 'last_train_s9b_rush' },
      }),
      choice('order_first', {
        label: 'I order first and sort the bill out later.',
        approach: 'act',
        result: [nar('Pancakes, eggs, and a milkshake the size of a flowerpot. The bill is tomorrow\'s problem.')],
        tags: [tag('conscientiousness', -1)],
        stats: { morale: 1 },
      }),
      choice('ask_mara', {
        label: 'I ask Mara about her shift.',
        approach: 'talk',
        result: [say('Mara', 'Four hours, two codes, and one man who swore he was a pilot. All fine now.')],
      }),
      choice('watch_window', {
        label: 'I stir my coffee and watch the window.',
        approach: 'wait',
        result: [nar('Rain on the glass. A cab drifts past with its light off. It might have been Dee.')],
      }),
    ],
    next: 'last_train_s9_booth',
    art: { location: 'city.diner', props: [{ id: 'phone', x: 60 }], tint: '#4a2c3a', cast: ['mara'] },
  },
  {
    id: 'last_train_s9_booth',
    chapter: 3,
    primaryAxis: 'extraversion',
    lines: [
      nar('The booth fills up. Theo shakes rain off his guitar case and nods at you like you owe him a verse.', 'Theo'),
      nar('Mara slides over. There is room for everyone, if everyone is willing.'),
    ],
    choices: [
      choice('join_table', {
        label: 'I lean in and talk with everyone at the table.',
        approach: 'talk',
        result: [nar("Within ten minutes you know Mara's worst patient, Theo's best song, and the diner's secret menu.")],
        tags: [tag('extraversion', 1)],
        stats: { renown: 1 },
      }),
      choice('window_booth', {
        label: 'I take the empty booth by the window and watch.',
        approach: 'wait',
        result: [nar('From there you see the whole room and none of its worries. Someone slides a coffee over without a word.')],
        tags: [tag('extraversion', -1)],
        stats: { morale: 1 },
      }),
      choice('split_fries', {
        label: 'I put a plate of fries in the middle of the table.',
        approach: 'act',
        hint: 'costs supplies',
        result: [nar('Fries unite people in a way that speeches never do.')],
        stats: { supplies: -1 },
      }),
      choice('ask_song', {
        label: 'I ask Theo to play something quiet.',
        approach: 'explore',
        result: [nar("He picks out four soft chords on the table's edge. The whole diner pretends not to listen.")],
      }),
    ],
    next: 'last_train_s10_stop',
    art: { location: 'city.diner', props: [{ id: 'phone', x: 60 }], tint: '#4f2f3f', cast: ['mara', 'theo'] },
  },
  {
    id: 'last_train_s9b_rush',
    chapter: 3,
    primaryAxis: 'extraversion',
    lines: [
      nar('A busload of people in matching hats bursts through the door. The diner goes from quiet to loud in one second.', 'matching hats'),
      nar("Mara slides along the booth. 'Welcome to the night shift,' she says."),
    ],
    choices: [
      choice('join_table', {
        label: 'I jump in and chat with the hats.',
        approach: 'talk',
        result: [nar('They are on a work trip and very sorry about it. One has a spare seat on the morning bus.')],
        tags: [tag('extraversion', 1)],
        stats: { renown: 1 },
      }),
      choice('window_booth', {
        label: 'I slip to a quiet corner away from the noise.',
        approach: 'wait',
        result: [nar('The corner has a plant and a view. The plant is doing better than the party.')],
        tags: [tag('extraversion', -1)],
        stats: { morale: 1 },
      }),
      choice('split_fries', {
        label: 'I order fries for the table and let them argue.',
        approach: 'act',
        hint: 'costs supplies',
        result: [nar('The fries vanish in under a minute. A hat salutes you.')],
        stats: { supplies: -1 },
      }),
      choice('count_hats', {
        label: 'I count the hats and guess where they are from.',
        approach: 'explore',
        result: [nar('Eleven hats. Four say Sales. Two say Sales Support. One just says Sorry.')],
      }),
    ],
    next: 'last_train_s10_stop',
    art: { location: 'city.diner', props: [{ id: 'phone', x: 60 }], tint: '#5a3345', cast: ['mara'] },
  },

  // ---- chapter 4 (finale) -------------------------------------------------------
  {
    id: 'last_train_s10_stop',
    chapter: 4,
    primaryAxis: 'locus_of_control',
    lines: [
      nar('The last bus stop is a pole, a bench, and a timetable that says 06:10. It is 05:55, and your phone is at 6 percent.', 'last bus stop'),
    ],
    choices: [
      choice('check_app', {
        label: 'I check the app and plan my change.',
        approach: 'explore',
        result: [nar('Bus 14 to the canal, then a walk. The app says six minutes late. You trust the numbers over the sky.')],
        tags: [tag('locus_of_control', 1)],
        stats: { renown: 1 },
      }),
      choice('let_it_come', {
        label: "I sit down. It'll come when it comes.",
        approach: 'wait',
        result: [nar('The bench is cold and the street is quiet. Somewhere a bus is thinking about you.')],
        tags: [tag('locus_of_control', -1)],
        stats: { morale: 1 },
      }),
      choice('read_pole', {
        label: 'I read the notices stuck to the pole.',
        approach: 'steady',
        result: [nar('Lost cat. Lost keys. A flyer for a rooftop gig next Friday, with a very small drawing of a guitar.')],
      }),
      choice('ask_bench', {
        label: 'I ask the man on the bench if the 14 runs.',
        approach: 'talk',
        result: [say('Man on the bench', "Every night. Some nights it's an act of faith.")],
      }),
    ],
    next: 'last_train_s11_battery',
    art: { location: 'city.last-bus-stop', props: [{ id: 'phone', x: 70 }], tint: '#2b3a68', cast: [] },
  },
  {
    id: 'last_train_s11_battery',
    chapter: 4,
    primaryAxis: 'conscientiousness',
    lines: [
      nar('Your phone drops to 3 percent and the screen dims to a polite gray.', '3 percent'),
      nar('Theo wanders up the road with his guitar case on his back, holding two paper cups.', 'Theo'),
      say('Theo', 'I bought two by mistake. Tea?'),
    ],
    variants: [
      {
        requires: { flags: ['sang'] },
        lines: [
          nar('Your phone drops to 3 percent and the screen dims to a polite gray.', '3 percent'),
          nar('Theo wanders up the road with his guitar case on his back, holding two paper cups.', 'Theo'),
          say('Theo', 'There is my backing singer. Tea?'),
        ],
      },
    ],
    choices: [
      choice('write_route', {
        label: 'I write the route on my hand before the phone dies.',
        approach: 'steady',
        result: [nar('Blue ink on your palm: 14, canal, bridge, left. It smears a little, but it is yours.')],
        tags: [tag('conscientiousness', 1)],
        stats: { morale: 1 },
      }),
      choice('let_it_die', {
        label: 'I let the phone die and look up.',
        approach: 'explore',
        result: [nar('The sky is a pale, strange orange. You had forgotten it did that.')],
        tags: [tag('conscientiousness', -1)],
        stats: { renown: 1 },
      }),
      choice('take_tea', {
        label: 'I take the tea and say thanks.',
        approach: 'talk',
        result: [nar('Sweet, strong, and scalding. Theo grins at your face.')],
      }),
      choice('ask_charger', {
        label: 'I ask Theo if he has a charger in that case.',
        approach: 'act',
        result: [nar('He has a tuner, a harmonica, and one very old cable. It almost fits.')],
      }),
    ],
    next: 'last_train_s12_first_light',
    art: { location: 'city.last-bus-stop', props: [{ id: 'phone', x: 70 }], tint: '#33305f', cast: ['theo'] },
  },
  {
    id: 'last_train_s12_first_light',
    chapter: 4,
    primaryAxis: 'extraversion',
    lines: [
      nar('The first gray light shows over the parking garage. The 14 pulls up, doors sighing, warm and nearly empty.', 'first gray light'),
      nar('Mara and Dee wander over from different directions, as if the night had arranged it. Theo is already here, tea in hand.'),
    ],
    choices: [
      choice('board_with_crew', {
        label: 'I wave everyone onto the bus.',
        approach: 'talk',
        result: [nar('You hold the door like a host. By the first stop they are all aboard, and the driver has been introduced twice.')],
        tags: [tag('extraversion', 1)],
        stats: { renown: 1 },
        flags: ['night_bus'],
      }),
      choice('walk_alone', {
        label: 'I wave goodbye and walk the last mile alone.',
        approach: 'wait',
        result: [nar('Hands up, thanks said. You take the long way by the canal, with the sky doing its slow trick.')],
        tags: [tag('extraversion', -1)],
        stats: { morale: 1 },
        flags: ['sunrise_walk'],
      }),
      choice('eggs_for_all', {
        label: 'I say breakfast is on me and point at the diner.',
        approach: 'act',
        hint: 'costs supplies',
        result: [nar('Mara claps once. Dee is already crossing the road. Theo says he knows a song about eggs.')],
        stats: { supplies: -1 },
        flags: ['diner_dawn'],
      }),
      choice('wait_it_out', {
        label: 'I stay on the bench and watch the sky change.',
        approach: 'steady',
        result: [nar('The bus sighs and pulls away without you. You do not mind. The first train will come, and so will the day.')],
      }),
    ],
    next: null,
    art: { location: 'city.last-bus-stop', props: [{ id: 'bike', x: 150 }], tint: '#e8b36a', cast: ['mara', 'theo', 'dee'] },
  },
];

export const LAST_TRAIN: QuestCampaign = {
  id: 'last_train',
  title: 'Last Train Home',
  setting: 'city',
  minutes: 7,
  contentVersion: 1,
  sceneIdsFrozen: SCENES.map((s) => s.id),
  targetAxes: ['conscientiousness', 'locus_of_control', 'extraversion'],
  startStats: { supplies: 2, morale: 2, renown: 0 },
  firstScene: 'last_train_s1_board',
  scenes: SCENES,
  endings: [
    {
      id: 'end_night_bus_crew',
      title: 'The Night Bus Crew',
      when: { flags: ['night_bus'] },
      lines: [
        nar('By the third stop Dee has swapped numbers, Theo has swapped a song, and Mara has swapped her seat for a stranger\'s. You all get off at the same corner, and nobody wants to leave it.'),
      ],
      art: 'city.ending-night-bus-crew',
    },
    {
      id: 'end_sunrise_walk',
      title: 'Sunrise Walk',
      when: { flags: ['sunrise_walk'] },
      lines: [
        nar('The sky goes gray, then pink, then gold. Your phone is dead and your feet hurt. You reach home with the best view of the night, and no one to tell yet.'),
      ],
      art: 'city.ending-sunrise-walk',
    },
    {
      id: 'end_diner_dawn',
      title: 'Diner Till Dawn',
      when: { flags: ['diner_dawn'] },
      lines: [
        nar('The eggs keep coming. By five, Mara is asleep on your shoulder, Theo has written a song about the vending machine, and Dee is on pancakes. The first train is a rumor you forget to chase.'),
      ],
      art: 'city.ending-diner-dawn',
    },
    {
      id: 'end_first_train',
      title: 'The First Train',
      when: {},
      lines: [
        nar('You wander back to the station as it opens. The first train rolls in at 06:40, almost on time, which is its own small miracle. You take a window seat and watch the sun come up. Home is eleven minutes away.'),
      ],
      art: 'city.ending-first-train',
    },
  ],
};
