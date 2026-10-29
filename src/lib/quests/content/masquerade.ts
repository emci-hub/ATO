import type { Approach, AxisTag, QuestCampaign, QuestChoice, QuestScene, StatDelta, StoryLine } from '@/lib/quests/types';
import type { TraitAxis } from '@/lib/traits';

/**
 * The Masquerade (ATO-BUILD PHASE-19). Written to docs/quests-style-guide.md, same shape as the Lantern:
 * 12 positions, every one a primary scene (3 per target axis), so every path is exactly 12 scenes.
 * Four scenes are twins at a position (three check fails and the secret scene's ordinary twin).
 * Copy lives only in this file. Cast pronouns: Lady Ines she, Corvin they, Pell he.
 *
 *   ch1  1 ballroom (extraversion)  2 swap (playfulness)  3 ines (agreeableness, check)
 *   ch2  4 stair | 4b stair_crowd (cooperativeness)  5 wine (extraversion, check)
 *        6 maze | 6b maze_dark (playfulness)
 *   ch3  7 note (secret) | 7b pell_alone (agreeableness)  8 ribbon (cooperativeness, check)
 *        9 floor | 9b floor_loud (extraversion)
 *   ch4  10 sibling (playfulness)  11 confession (agreeableness)  12 midnight (cooperativeness)
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
    id: 'masquerade_s1_ballroom',
    chapter: 1,
    primaryAxis: 'extraversion',
    lines: [
      nar("Lady Ines's midnight ball glitters. Candles, masks, and a band that has already played one song too many.", 'Candles'),
      say('Lady Ines', 'Welcome, dear guest. Dance, drink, and mind the cake. It is older than some of the guests.'),
      nar('The clock by the wall says ten to midnight.', 'clock'),
    ],
    choices: [
      choice('join_floor', {
        label: 'I join the dance floor and ask around.',
        approach: 'talk',
        result: [nar('One reel later you have four names, three dance partners, and a rumor: the Moonlit Mask is on show tonight.')],
        tags: [tag('extraversion', 1)],
        stats: { renown: 1 },
        flags: ['danced'],
      }),
      choice('watch_balcony', {
        label: 'I watch from the balcony and listen.',
        approach: 'wait',
        result: [nar('From up there the ballroom is a music box. You catch half a secret and a lot of opinions about hats.')],
        tags: [tag('extraversion', -1)],
        stats: { supplies: 1 },
      }),
      choice('admire_room', {
        label: 'I admire the room, one candelabra at a time.',
        approach: 'explore',
        result: [nar('Forty candles to a stand. The wax on the floor has dripped into something like a map.')],
      }),
      choice('pour_glass', {
        label: 'I pour a glass at the wine table and wait.',
        approach: 'steady',
        result: [nar('The wine is sweet. The tall stranger beside you hums along with the band, and hums it better.')],
      }),
    ],
    next: 'masquerade_s2_swap',
    art: { location: 'masquerade.ballroom', props: [{ id: 'candelabra', x: 40 }, { id: 'clock', x: 150 }], tint: '#3a2350', cast: ['ines'] },
  },
  {
    id: 'masquerade_s2_swap',
    chapter: 1,
    primaryAxis: 'playfulness',
    lines: [
      nar('On the balcony, a stranger in a silver fox mask leans on the rail, humming along with the band.', 'fox mask'),
      say('Corvin', 'Evening. Fancy swapping masks? Nobody will know who is who, which I hear is the whole point.'),
    ],
    choices: [
      choice('swap_masks', {
        label: 'I swap masks with a stranger, just for fun.',
        approach: 'explore',
        result: [nar("The fox is a little tight. The stranger's grin under your mask is a lot bigger. Corvin bows.")],
        tags: [tag('playfulness', 1)],
        stats: { morale: 1 },
        flags: ['swapped'],
      }),
      choice('keep_mask', {
        label: 'I keep my mask on and stay focused.',
        approach: 'steady',
        result: [say('Corvin', "Fair enough. Focus suits you.")],
        tags: [tag('playfulness', -1)],
        stats: { supplies: 1 },
      }),
      choice('ask_name', {
        label: 'I ask who is under the fox.',
        approach: 'talk',
        result: [say('Corvin', "Nobody important. That's the dress code.")],
      }),
      choice('count_guests', {
        label: 'I count the guests below and say nothing.',
        approach: 'wait',
        result: [nar('Ninety-one guests, one band, and four people near the library door who keep looking at their shoes.')],
      }),
    ],
    next: 'masquerade_s3_ines',
    art: { location: 'masquerade.balcony', props: [{ id: 'mask', x: 120 }], tint: '#2c2a5a', cast: ['corvin'] },
  },
  {
    id: 'masquerade_s3_ines',
    chapter: 1,
    primaryAxis: 'agreeableness',
    lines: [
      nar('In the library, Lady Ines stares at an empty velvet stand where the Moonlit Mask should be.', 'Moonlit Mask'),
      say('Lady Ines', 'It was here at ten. I wear it for the Last Waltz, in ten minutes. It was my grandmother\'s.'),
    ],
    choices: [
      choice('hold_hands', {
        label: "I take her hands and say we'll find it together.",
        approach: 'talk',
        result: [nar("Her hands are cold and steady in yours. 'Together,' she says, trying the word out.")],
        tags: [tag('agreeableness', 1)],
        check: { stat: 'morale', dc: 9, success: 'masquerade_s4_stair', fail: 'masquerade_s4b_stair_crowd' },
      }),
      choice('ask_names', {
        label: 'I ask who stood near the stand, and I want names.',
        approach: 'act',
        result: [say('Lady Ines', 'Names? Footmen, cousins, half the county. Rude question. Good one.')],
        tags: [tag('agreeableness', -1)],
        stats: { renown: 1 },
      }),
      choice('read_letter', {
        label: 'I read the folded letter on the desk.',
        approach: 'explore',
        result: [nar("A neat hand: 'Wear it once more, for me. Midnight.' No name, but the writer knew the stand.")],
        flags: ['read_letter'],
      }),
      choice('study_stand', {
        label: 'I look the empty stand over for clues.',
        approach: 'steady',
        result: [nar('Two small scratches on the velvet and a smear of wax. Someone was in a hurry, or very careful.')],
      }),
    ],
    next: 'masquerade_s4_stair',
    art: { location: 'masquerade.library', props: [{ id: 'letter', x: 60 }], tint: '#4a2f38', cast: ['ines'] },
  },

  // ---- chapter 2 ---------------------------------------------------------------
  {
    id: 'masquerade_s4_stair',
    chapter: 2,
    primaryAxis: 'conflict_cooperativeness',
    lines: [
      nar('On the servants\' stair, Pell is wedged between two guests with a full tray. They are arguing about whose fault this is.', 'Pell'),
      nar('One blames a cousin. The other blames a hat. Both blame the band.'),
    ],
    choices: [
      choice('search_together', {
        label: 'I suggest they search the house side by side.',
        approach: 'talk',
        result: [nar('The guests stop mid-sentence, look at each other, and split the east wing like grown-ups. Pell exhales.')],
        tags: [tag('conflict_cooperativeness', 1)],
        stats: { morale: 1 },
      }),
      choice('race_first', {
        label: "I say I'll find it first, and bet on it.",
        approach: 'act',
        result: [nar("'A bet!' says one. 'A race!' says the other. Both run opposite ways. Pell watches you, then smiles.")],
        tags: [tag('conflict_cooperativeness', -1)],
        stats: { renown: 1 },
      }),
      choice('hold_tray', {
        label: "I take Pell's tray so he can breathe.",
        approach: 'steady',
        result: [say('Pell', "Thank you. Nobody ever asks the tray how it's doing.")],
        flags: ['pell_trust'],
      }),
      choice('slip_past', {
        label: 'I squeeze past on the narrow step.',
        approach: 'wait',
        result: [nar('You slide past two elbows and one pie. Behind you the argument picks up, and so does the pie.')],
      }),
    ],
    next: 'masquerade_s5_wine',
    art: { location: 'masquerade.servants-stair', props: [{ id: 'candelabra', x: 150 }], tint: '#3b2b3f', cast: ['pell'] },
  },
  {
    id: 'masquerade_s4b_stair_crowd',
    chapter: 2,
    primaryAxis: 'conflict_cooperativeness',
    lines: [
      nar('Word got out faster than you did. The servants\' stair is jammed with guests, and Pell holds his tray over his head.', 'Pell'),
      say('Pell', 'Excuse me. Hot soup. Very hot. Please.'),
    ],
    choices: [
      choice('search_together', {
        label: 'I suggest we all search the house in pairs.',
        approach: 'talk',
        result: [nar('Pairs form like magic. People who came to dance now carry candles and purpose.')],
        tags: [tag('conflict_cooperativeness', 1)],
        stats: { morale: 1 },
      }),
      choice('race_first', {
        label: 'I say whoever finds it first names the hero.',
        approach: 'act',
        result: [nar('The crowd cheers, and then stampedes. Pell, flattened to the rail, gives you a thumbs up.')],
        tags: [tag('conflict_cooperativeness', -1)],
        stats: { renown: 1 },
      }),
      choice('hold_tray', {
        label: "I take Pell's tray and clear us a way.",
        approach: 'steady',
        result: [say('Pell', 'You carried the soup. I will remember that for a long time.')],
        flags: ['pell_trust'],
      }),
      choice('wait_thin', {
        label: 'I wait on the landing for the crowd to thin.',
        approach: 'wait',
        result: [nar('Five minutes, three apologies, and one hat on the wrong head. Then the stair is almost yours.')],
      }),
    ],
    next: 'masquerade_s5_wine',
    art: { location: 'masquerade.servants-stair', props: [{ id: 'candelabra', x: 150 }], tint: '#352739', cast: ['pell'] },
  },
  {
    id: 'masquerade_s5_wine',
    chapter: 2,
    primaryAxis: 'extraversion',
    lines: [
      nar('Back in the ballroom the music has stopped, and the wine table is now the center of everything. Guests cluster, whisper, and top up.', 'wine table'),
    ],
    variants: [
      {
        requires: { flags: ['danced'] },
        lines: [nar('Back in the ballroom the music has stopped. Guests you danced with wave you over to the wine table. Everyone is whispering.', 'wine table')],
      },
    ],
    choices: [
      choice('buy_round', {
        label: 'I buy a round and ask who saw the stand.',
        approach: 'talk',
        hint: 'costs supplies',
        result: [nar('You stand on a chair. Forty faces turn. Somewhere a glass drops, which is one way to get quiet.')],
        tags: [tag('extraversion', 1)],
        stats: { supplies: -1 },
        check: { stat: 'supplies', dc: 8, success: 'masquerade_s6_maze', fail: 'masquerade_s6b_maze_dark' },
      }),
      choice('listen_table', {
        label: 'I stand by the table and listen quietly.',
        approach: 'wait',
        result: [nar('People tell a lot to someone holding a glass. You learn about a cousin, a limp, and a debt.')],
        tags: [tag('extraversion', -1)],
        stats: { morale: 1 },
      }),
      choice('pour_nervous', {
        label: 'I pour a glass for a nervous guest.',
        approach: 'steady',
        result: [nar("She whispers that the mask looked wrong at nine. Then she drinks and forgets she said it.")],
      }),
      choice('check_clock', {
        label: 'I check the clock and count down.',
        approach: 'explore',
        result: [nar('Seven minutes. The clock ticks like it is counting them out loud.')],
      }),
    ],
    next: 'masquerade_s6_maze',
    art: { location: 'masquerade.ballroom', props: [{ id: 'wine-table', x: 90 }, { id: 'clock', x: 160 }], tint: '#47285a', cast: [] },
  },
  {
    id: 'masquerade_s6_maze',
    chapter: 2,
    primaryAxis: 'playfulness',
    lines: [
      nar('The garden maze is lit by lanterns on poles. A guest in a gold mask is already sprinting down the path.', 'maze'),
      say('Gold Mask', 'Last one to the middle buys the next round!'),
    ],
    choices: [
      choice('race_maze', {
        label: 'I race into the maze for the fun of it.',
        approach: 'act',
        result: [nar('You take a wrong turn on purpose, then a right one by accident. At the center: a bench, a smug peacock, and a bent silver pin.')],
        tags: [tag('playfulness', 1)],
        stats: { morale: 1 },
      }),
      choice('follow_hedge', {
        label: 'I follow the hedge in order, no detours.',
        approach: 'steady',
        result: [nar('Left, left, right, right. Slower, and it works. At the center: a bench, a patient peacock, and a silver thread on a thorn.')],
        tags: [tag('playfulness', -1)],
        stats: { supplies: 1 },
      }),
      choice('ask_peacock', {
        label: 'I ask the peacock what it saw.',
        approach: 'talk',
        result: [nar('The peacock looks at you the way a judge looks at a hat.')],
      }),
      choice('borrow_lantern', {
        label: 'I borrow a lantern and check the ground.',
        approach: 'explore',
        result: [nar('Small boot prints toward the house, and wax drops beside them. Someone carried a candle and a secret.')],
      }),
    ],
    next: 'masquerade_s7_note',
    art: { location: 'masquerade.garden-maze', props: [{ id: 'mask', x: 70 }], tint: '#1f3a4a', cast: [] },
  },
  {
    id: 'masquerade_s6b_maze_dark',
    chapter: 2,
    primaryAxis: 'playfulness',
    lines: [
      nar('A cloud takes the moon and the wind blows out half the lanterns. The maze is dark, and someone inside is laughing.', 'maze'),
      say('Gold Mask', "Over here! Or there! I honestly don't know!"),
    ],
    choices: [
      choice('race_maze', {
        label: 'I dive in after the laugh, whatever happens.',
        approach: 'act',
        result: [nar('Three dead ends and one hedge in the face later, you find the bench, the peacock, and a bent silver pin.')],
        tags: [tag('playfulness', 1)],
        stats: { morale: 1 },
      }),
      choice('follow_hedge', {
        label: 'I relight a lantern and take the maze in order.',
        approach: 'steady',
        result: [nar('Slow, careful, and warm. At the center: a bench, a calm peacock, and a silver thread on a thorn.')],
        tags: [tag('playfulness', -1)],
        stats: { supplies: 1 },
      }),
      choice('call_out', {
        label: 'I call out and let the laugh guide me.',
        approach: 'talk',
        result: [nar('The laugh answers, wrong each time, until you are both lost and fairly pleased about it.')],
      }),
      choice('feel_hedge', {
        label: 'I keep one hand on the hedge and walk.',
        approach: 'wait',
        result: [nar('Prickly, damp, and dependable. You come out with a leaf in your mask and no clue at all.')],
      }),
    ],
    next: 'masquerade_s7_note',
    art: { location: 'masquerade.garden-maze', props: [{ id: 'mask', x: 70 }], tint: '#16293a', cast: [] },
  },

  // ---- chapter 3 ---------------------------------------------------------------
  {
    // Secret: only if you swapped masks. Closed gate skips to the ordinary twin below.
    id: 'masquerade_s7_note',
    chapter: 3,
    primaryAxis: 'agreeableness',
    requires: { flags: ['swapped'] },
    lines: [
      nar('Inside the fox mask you swapped, a folded note rubs your cheek. Corvin wrote it in a hurry.', 'note'),
      nar("It says: The mask isn't stolen. Ask Pell about the clock. Don't tell Ines yet.", 'clock'),
    ],
    choices: [
      choice('trust_note', {
        label: 'I trust Corvin and keep the note quiet.',
        approach: 'steady',
        result: [nar('A small leap, and you take it. The note goes up your sleeve like a held breath.')],
        tags: [tag('agreeableness', 1)],
        stats: { morale: 1 },
        next: 'masquerade_s8_ribbon',
      }),
      choice('doubt_note', {
        label: 'I check the clock myself before trusting a note.',
        approach: 'act',
        result: [nar("Strangers' notes cost nothing to write. You turn it over twice, find a candle stain, and decide to look for yourself.")],
        tags: [tag('agreeableness', -1)],
        stats: { renown: 1 },
        next: 'masquerade_s8_ribbon',
      }),
      choice('fold_note', {
        label: 'I put the note away and wait for midnight.',
        approach: 'wait',
        result: [nar('Six minutes. The note sits in your sleeve, getting heavier.')],
        next: 'masquerade_s8_ribbon',
      }),
      choice('sniff_note', {
        label: 'I sniff the paper like a bloodhound.',
        approach: 'explore',
        result: [nar('Lemon and candle smoke. Somebody writes by the kitchen fire, or near enough.')],
        next: 'masquerade_s8_ribbon',
      }),
    ],
    next: 'masquerade_s7b_pell_alone',
    art: { location: 'masquerade.balcony', props: [{ id: 'mask', x: 100 }], tint: '#2b2f66', cast: ['corvin'] },
  },
  {
    id: 'masquerade_s7b_pell_alone',
    chapter: 3,
    primaryAxis: 'agreeableness',
    lines: [
      nar('Pell catches your sleeve at the foot of the stair, tray empty, eyes wide.', 'Pell'),
      say('Pell', "You seem sensible. I need to tell someone something, and I'd rather it wasn't Lady Ines. Not yet."),
    ],
    choices: [
      choice('gentle_pell', {
        label: "I tell Pell it's all right, whatever it is.",
        approach: 'talk',
        result: [nar("His shoulders drop an inch. 'It's about the clock,' he whispers, and leaves it there.")],
        tags: [tag('agreeableness', 1)],
        stats: { morale: 1 },
      }),
      choice('press_pell', {
        label: 'I tell Pell to speak plainly, and fast.',
        approach: 'act',
        result: [nar("He flinches, then straightens. 'The clock,' he says. 'Fine. The clock.'")],
        tags: [tag('agreeableness', -1)],
        stats: { renown: 1 },
      }),
      choice('offer_water', {
        label: 'I hand Pell a glass of water.',
        approach: 'steady',
        result: [nar("He drinks like it's the first sip of the night. It might be.")],
      }),
      choice('wait_pell', {
        label: 'I wait and let Pell choose his words.',
        approach: 'wait',
        result: [nar('Ten seconds of the big clock ticking in the next room. Then he starts anyway.')],
      }),
    ],
    next: 'masquerade_s8_ribbon',
    art: { location: 'masquerade.servants-stair', props: [{ id: 'candelabra', x: 40 }], tint: '#3a2c40', cast: ['pell'] },
  },
  {
    id: 'masquerade_s8_ribbon',
    chapter: 3,
    primaryAxis: 'conflict_cooperativeness',
    lines: [
      nar('In the library, Lady Ines has found a silver ribbon in Corvin\'s sleeve. It matches the empty stand. The room goes very quiet.', 'ribbon'),
      say('Lady Ines', 'Explain the ribbon, stranger. Quickly. The band is warming up.'),
    ],
    choices: [
      choice('speak_in_turns', {
        label: 'I ask them both to speak one at a time.',
        approach: 'talk',
        result: [nar('Ines opens her mouth, shuts it, and nods. Corvin lets out a breath. The room remembers how to breathe.')],
        tags: [tag('conflict_cooperativeness', 1)],
        stats: { morale: 1 },
      }),
      choice('step_between', {
        label: 'I step between them and take the ribbon myself.',
        approach: 'act',
        result: [nar('Both pairs of eyes land on you. The ribbon is light. The silence is not.')],
        tags: [tag('conflict_cooperativeness', -1)],
        check: { stat: 'renown', dc: 8, success: 'masquerade_s9_floor', fail: 'masquerade_s9b_floor_loud' },
      }),
      choice('study_ribbon', {
        label: 'I look closer at the ribbon.',
        approach: 'explore',
        result: [nar('Silver silk, frayed at one end, as if it was pulled hard through a small clasp.')],
      }),
      choice('offer_chairs', {
        label: 'I offer them both a chair and a moment.',
        approach: 'wait',
        result: [nar('Two chairs, one candle, and nobody sits. The ribbon rests on the desk like a third guest.')],
      }),
    ],
    next: 'masquerade_s9_floor',
    art: { location: 'masquerade.library', props: [{ id: 'letter', x: 110 }], tint: '#52303a', cast: ['ines', 'corvin'] },
  },
  {
    id: 'masquerade_s9_floor',
    chapter: 3,
    primaryAxis: 'extraversion',
    lines: [
      nar('Five minutes to midnight. The ballroom is full of masks, whispers, and one very bored cellist.', 'cellist'),
    ],
    choices: [
      choice('work_room', {
        label: 'I work the room, one chat at a time.',
        approach: 'talk',
        result: [nar('Eleven chats later you know who owes whom, and that the mask looked wrong at nine.')],
        tags: [tag('extraversion', 1)],
        stats: { renown: 1 },
      }),
      choice('quiet_corner', {
        label: 'I find a quiet corner and think it over.',
        approach: 'wait',
        result: [nar('From the corner you see a servant slip toward the clock, then slip away. Two different kinds of nervous.')],
        tags: [tag('extraversion', -1)],
        stats: { morale: 1 },
      }),
      choice('fix_strap', {
        label: 'I fix my mask strap.',
        approach: 'steady',
        result: [nar('The strap holds, which is more than you can say for the evening.')],
      }),
      choice('ask_cellist', {
        label: 'I ask the cellist for the time.',
        approach: 'explore',
        result: [say('Cellist', "Four minutes. And I'd like to go home.")],
      }),
    ],
    next: 'masquerade_s10_sibling',
    art: { location: 'masquerade.ballroom', props: [{ id: 'clock', x: 150 }], tint: '#4a2a62', cast: [] },
  },
  {
    id: 'masquerade_s9b_floor_loud',
    chapter: 3,
    primaryAxis: 'extraversion',
    lines: [
      nar('The ballroom has gone loud. The band struck up a jig to cover the nerves, and everyone is shouting over it.', 'jig'),
    ],
    choices: [
      choice('work_room', {
        label: 'I shout my questions over the jig.',
        approach: 'talk',
        result: [nar('Half the answers are lost in the fiddles. The other half agree that the mask looked wrong at nine.')],
        tags: [tag('extraversion', 1)],
        stats: { renown: 1 },
      }),
      choice('quiet_corner', {
        label: 'I step behind a pillar where I can hear myself think.',
        approach: 'wait',
        result: [nar('From the pillar you see a servant slip toward the clock, then slip away. Two different kinds of nervous.')],
        tags: [tag('extraversion', -1)],
        stats: { morale: 1 },
      }),
      choice('dance_one', {
        label: 'I take one turn of the jig and catch my breath.',
        approach: 'act',
        result: [nar('You are bad at it, and a stranger kindly lies and says you are not.')],
      }),
      choice('ask_fiddler', {
        label: 'I ask the fiddler to play a bit quieter.',
        approach: 'explore',
        result: [say('Fiddler', "Quieter? I've been trying to play slower since nine.")],
      }),
    ],
    next: 'masquerade_s10_sibling',
    art: { location: 'masquerade.ballroom', props: [{ id: 'clock', x: 150 }], tint: '#552d6e', cast: [] },
  },

  // ---- chapter 4 (finale) -------------------------------------------------------
  {
    id: 'masquerade_s10_sibling',
    chapter: 4,
    primaryAxis: 'playfulness',
    lines: [
      nar('In the garden, Corvin takes off their mask. The face underneath looks a great deal like Lady Ines.', 'face'),
      say('Corvin', 'Her sibling. Away eleven years. I saw the clasp snap and kept the ribbon. Now the surprise has a hole in it.'),
    ],
    variants: [
      {
        requires: { flags: ['read_letter'] },
        lines: [
          nar('In the garden, Corvin takes off their mask. You know the neat hand from the library letter. The face looks like Lady Ines.', 'letter'),
          say('Corvin', 'Her sibling. Away eleven years. I wrote the letter, saw the clasp snap, and kept the ribbon.'),
        ],
      },
    ],
    choices: [
      choice('bigger_surprise', {
        label: "I say we make the surprise even bigger.",
        approach: 'explore',
        result: [nar("Corvin's grin breaks through the sadness. 'A bigger surprise. Yes. I like you.'")],
        tags: [tag('playfulness', 1)],
        stats: { morale: 1 },
      }),
      choice('fix_first', {
        label: 'I say we stay serious and fix the problem first.',
        approach: 'steady',
        result: [nar("'Right,' Corvin says, straightening. 'Fix first, feelings after. Very sensible.'")],
        tags: [tag('playfulness', -1)],
        stats: { supplies: 1 },
      }),
      choice('sit_bench', {
        label: 'I sit with Corvin on the bench for a moment.',
        approach: 'wait',
        result: [nar('Eleven years is a long way to walk. The peacock settles nearby, as if it was invited.')],
      }),
      choice('ask_why', {
        label: 'I ask what Corvin really wants tonight.',
        approach: 'talk',
        result: [say('Corvin', "To keep a promise to a sister. I'm very bad at it.")],
      }),
    ],
    next: 'masquerade_s11_confession',
    art: { location: 'masquerade.garden-maze', props: [{ id: 'mask', x: 60 }], tint: '#26405a', cast: ['corvin'] },
  },
  {
    id: 'masquerade_s11_confession',
    chapter: 4,
    primaryAxis: 'agreeableness',
    lines: [
      nar("The big clock's back panel opens onto the servants' stair. Pell stands beside it, wringing his apron.", 'Pell'),
      nar('Inside the case, on a hook, hangs the Moonlit Mask. Its clasp is snapped.', 'clasp'),
    ],
    variants: [
      {
        requires: { flags: ['pell_trust'] },
        lines: [
          nar("The big clock's back panel opens onto the servants' stair. Pell waits beside it."),
          say('Pell', "You carried my tray. So you hear it first. The clasp snapped at ten. I hid the mask in the clock to fix it."),
          nar('Inside the case, on a hook, hangs the Moonlit Mask. Its clasp is snapped.', 'clasp'),
        ],
      },
    ],
    choices: [
      choice('forgive_pell', {
        label: 'I tell Pell anyone would have panicked.',
        approach: 'talk',
        result: [nar("He laughs, which sounds like crying. 'Anyone. But it was me.' He hands you the mask.")],
        tags: [tag('agreeableness', 1)],
        stats: { morale: 1 },
      }),
      choice('lay_it_out', {
        label: 'I tell Pell he should have said so at ten.',
        approach: 'act',
        result: [nar("Pell nods, grim. 'Yes. All of it.' It is blunt, and he looks relieved to hear it said.")],
        tags: [tag('agreeableness', -1)],
        stats: { renown: 1 },
      }),
      choice('hold_mask', {
        label: 'I take the mask and look at the bent clasp.',
        approach: 'steady',
        result: [nar('One hinge, one pin. A hairpin and some luck would fix it, and you have one of those.')],
      }),
      choice('watch_clock', {
        label: 'I check the clock face. Two minutes to go.',
        approach: 'wait',
        result: [nar('Two minutes. Pell stops breathing. The clock does not.')],
      }),
    ],
    next: 'masquerade_s12_midnight',
    art: { location: 'masquerade.servants-stair', props: [{ id: 'clock', x: 100 }], tint: '#3c2a48', cast: ['pell'] },
  },
  {
    id: 'masquerade_s12_midnight',
    chapter: 4,
    primaryAxis: 'conflict_cooperativeness',
    lines: [
      nar('Midnight begins to strike. Lady Ines waits at the center of the floor. In your hands is the Moonlit Mask, its clasp pinned back together.', 'Midnight'),
    ],
    variants: [
      {
        requires: { flags: ['swapped'] },
        lines: [
          nar('Midnight begins to strike. Lady Ines waits at the center of the floor. You are still wearing the fox mask, and she has noticed.', 'fox mask'),
          nar('In your hands is the Moonlit Mask, its clasp pinned back together.'),
        ],
      },
    ],
    choices: [
      choice('unmask_all', {
        label: 'I invite everyone to unmask and share the truth.',
        approach: 'talk',
        result: [nar('One by one the masks come off. Lady Ines and Corvin see each other at last, and the room forgets to whisper.')],
        tags: [tag('conflict_cooperativeness', 1)],
        stats: { morale: 1 },
        flags: ['unmask_all'],
      }),
      choice('quick_return', {
        label: 'I settle it my way, before anyone argues.',
        approach: 'act',
        result: [nar("You cross the floor and set the mask on her face, quick as a card trick, before a single question forms.")],
        tags: [tag('conflict_cooperativeness', -1)],
        stats: { renown: 1 },
      }),
      choice('ask_dance', {
        label: 'I hold out my hand and ask Lady Ines to dance.',
        approach: 'explore',
        result: [nar('The band takes the hint. Ines puts on the mask, takes your hand, and the Last Waltz starts a little late and a little loud.')],
        flags: ['waltz'],
      }),
      choice('slip_out', {
        label: 'I hand the mask to Pell and slip out to the garden.',
        approach: 'wait',
        result: [nar('Pell carries it to Ines like an egg. You are already in the garden, hearing the music through the hedge.')],
        flags: ['slip_out'],
      }),
    ],
    next: null,
    art: { location: 'masquerade.ballroom', props: [{ id: 'clock', x: 150 }, { id: 'candelabra', x: 40 }], tint: '#e0c37a', cast: ['ines'] },
  },
];

export const MASQUERADE: QuestCampaign = {
  id: 'masquerade',
  title: 'The Masquerade',
  setting: 'fantasy',
  minutes: 7,
  contentVersion: 1,
  sceneIdsFrozen: SCENES.map((s) => s.id),
  targetAxes: ['extraversion', 'agreeableness', 'conflict_cooperativeness', 'playfulness'],
  startStats: { supplies: 2, morale: 3, renown: 1 },
  firstScene: 'masquerade_s1_ballroom',
  scenes: SCENES,
  endings: [
    {
      id: 'end_unmasked_together',
      title: 'Unmasked Together',
      when: { flags: ['unmask_all'] },
      lines: [
        nar('Lady Ines hugs Corvin hard enough to bend the mask. Pell gets an apology and a better hook for the clock. Nobody leaves before dawn.'),
      ],
      art: 'masquerade.ending-unmasked-together',
    },
    {
      id: 'end_last_waltz',
      title: 'The Last Waltz',
      when: { flags: ['waltz'] },
      lines: [
        nar('The mask holds for the whole waltz. When the music ends, Lady Ines laughs, bows to the room, and does not let go of your hand.'),
      ],
      art: 'masquerade.ending-last-waltz',
    },
    {
      id: 'end_quiet_exit',
      title: 'Quiet Exit',
      when: { flags: ['slip_out'] },
      lines: [
        nar('You leave before the toasts. A note under your door says: Thank you for the garden. The mask is back, and the clock is fixed.'),
      ],
      art: 'masquerade.ending-quiet-exit',
    },
    {
      id: 'end_clock_strikes_twice',
      title: 'The Clock Strikes Twice',
      when: {},
      lines: [
        nar('The clock strikes twelve, then, a little embarrassed, twelve again. Pell swears it has never done that. The ball laughs and starts over.'),
      ],
      art: 'masquerade.ending-clock-twice',
    },
  ],
};
