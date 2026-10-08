import type { LegendFigure } from '../types';
import { angle, fact, moment, src, tag, wiki } from './define';

const BATTUTA = wiki('Ibn_Battuta');
const EARHART = wiki('Amelia_Earhart');
const TENZING = wiki('Tenzing_Norgay');

export const EXPLORER_LEGENDS: readonly LegendFigure[] = [
  {
    id: 'lf_ibn_battuta',
    name: 'Ibn Battuta',
    kind: 'real',
    hall: 'explorers',
    region: 'africa',
    place: 'Morocco',
    era: '1304–c. 1369',
    died: 1369,
    gender: 'man',
    field: 'Travel and writing',
    essence: 'Left for a sixteen-month trip and came home twenty-four years later.',
    whoTheyWere: 'A traveller and scholar from Tangier who spent about thirty years crossing Africa, Asia and Iberia.',
    famousFor: 'The Rihla, the account of his journeys, and travelling farther than any explorer before modern times.',
    facts: [
      fact('f1', 'He set out from Tangier at 21 on a trip that would usually take sixteen months.', src(BATTUTA, 'at the age of 21', 'sixteen months')),
      fact('f2', 'He did not return to Morocco for 24 years.', src(BATTUTA, 'would not return to Morocco again for 24 years')),
      fact('f3', 'He travelled around 117,000 km, more than any other explorer in pre-modern history.', src(BATTUTA, '117,000 km')),
    ],
    moments: [
      moment(
        'm1',
        'He wrote that he set out alone, with no travelling companion and no caravan, swayed by an overmastering impulse.',
        src(BATTUTA, 'I set out alone', 'overmastering impulse'),
      ),
      moment('m2', 'Near the end of his life he dictated the story of his journeys, known as the Rihla.', src(BATTUTA, 'dictated an account of his journeys')),
    ],
    angles: [
      angle('a1', 'the long way home', 'What does a man whose trip ran twenty-two years late have in common with you?', 'Plans that stretch far past their schedule can still be the best thing you did.'),
      angle('a2', 'setting out alone', 'Who leaves home with no companion and no caravan?', 'Going first, without company, is scary and sometimes the only way to start.'),
      angle('a3', 'telling it later', 'Why tell the story decades after the trip?', 'Some experiences only make sense once you look back and put them in words.'),
      angle('a4', 'the farthest traveller', 'How far can curiosity carry one person?', 'Following your curiosity one city at a time adds up to a life.'),
    ],
    tags: [
      tag('openness', 'high', 'kept going to the next city', 'His sixteen-month trip became twenty-four years of travel.'),
      tag('extraversion', 'high', 'met the whole known world', 'He travelled among people across three continents.'),
      tag('conscientiousness', 'low', 'let the plan stretch', 'He kept changing course far beyond his original trip.'),
      tag('relatedness', 'high', 'told everyone the story', 'He shared his travels in a book still read today.'),
    ],
    vetting: 'Traveller and writer, died c. 1369; no office; broadly admired.',
  },
  {
    id: 'lf_amelia_earhart',
    name: 'Amelia Earhart',
    kind: 'real',
    hall: 'explorers',
    region: 'americas',
    place: 'United States',
    era: '1897–1937',
    died: 1937,
    birthday: { md: '07-24', source: src(EARHART, 'July 24, 1897') },
    gender: 'woman',
    field: 'Aviation',
    essence: 'Flew the Atlantic alone because nobody said she couldn’t.',
    whoTheyWere: 'An American aviator who became one of the most celebrated figures of early flight.',
    famousFor: 'The first woman to fly solo and nonstop across the Atlantic, in 1932.',
    facts: [
      fact('f1', 'In 1932 she became the first woman to make a nonstop solo transatlantic flight.', src(EARHART, 'first woman to make a nonstop solo transatlantic flight')),
      fact('f2', 'She helped found the Ninety-Nines, an organization for women pilots.', src(EARHART, 'Ninety-Nines')),
      fact('f3', 'In 1937 she disappeared over the Pacific while trying to fly around the world.', src(EARHART, 'disappeared over the Pacific Ocean')),
    ],
    moments: [
      moment('m1', 'In 1928 she crossed the Atlantic as a passenger, the first woman to do so by plane.', src(EARHART, 'first female passenger to cross the Atlantic')),
      moment('m2', 'She called her marriage a “partnership” with “dual control”.', src(EARHART, 'dual control')),
    ],
    angles: [
      angle('a1', 'from passenger to pilot', 'What does a woman who rode across the Atlantic, then flew it herself, have in common with you?', 'Watching something done once can be the start of doing it yourself.'),
      angle('a2', 'dual control', 'What does a partnership look like when both people keep their own wings?', 'Being close to someone and staying yourself can go together.'),
      angle('a3', 'making room', 'Why would a famous pilot help start a club for other women pilots?', 'Making space for others like you is part of going first.'),
      angle('a4', 'the open sky', 'What makes someone keep reaching for the next, bigger flight?', 'Wanting the next challenge is a strength. So is knowing why you want it.'),
    ],
    tags: [
      tag('self_efficacy', 'high', 'flew it herself', 'After crossing as a passenger, she flew the Atlantic solo.'),
      tag('openness', 'high', 'chased the next horizon', 'She kept attempting bigger flights, up to a world flight.'),
      tag('autonomy', 'high', 'kept her own controls', 'She described her marriage as dual control.'),
      tag('attachment_avoidance', 'high', 'needed her own space', 'She insisted on independence even within her marriage.'),
    ],
    vetting: 'Aviator, died 1937; no office; broadly admired.',
  },
  {
    id: 'lf_tenzing_norgay',
    name: 'Tenzing Norgay',
    kind: 'real',
    hall: 'explorers',
    region: 'south_asia',
    place: 'Nepal and India',
    era: '1914–1986',
    died: 1986,
    gender: 'man',
    field: 'Mountaineering',
    essence: 'Climbed toward Everest for twenty years before standing on top.',
    whoTheyWere: 'A Nepalese-Indian Sherpa mountaineer who worked on British Everest expeditions from the 1930s.',
    famousFor: 'With Edmund Hillary, the first people confirmed on the summit of Mount Everest, in 1953.',
    facts: [
      fact('f1', 'On 29 May 1953 he and Edmund Hillary were the first people confirmed on Everest’s summit.', src(TENZING, '29 May 1953', 'first people confirmed to have reached the summit')),
      fact('f2', 'In the 1930s he worked as a high-altitude porter on three British attempts on Everest.', src(TENZING, 'high-altitude porter in three official British attempts')),
      fact('f3', 'Time named him one of the 100 most influential people of the 20th century.', src(TENZING, '100 most influential people')),
    ],
    moments: [
      moment('m1', 'As a teenager he ran away from home twice, first to Kathmandu, then to Darjeeling.', src(TENZING, 'ran away from home twice')),
      moment('m2', 'His mother lived to see him climb Everest.', src(TENZING, 'She lived to see him climb Everest')),
    ],
    angles: [
      angle('a1', 'twenty years of climbing', 'What does a man who carried loads up Everest for years have in common with you?', 'Years of unseen work can be exactly what gets you to the top.'),
      angle('a2', 'the rope team', 'Who stands on top of the world as half of a pair?', 'Reaching something big with a partner doesn’t make it less yours.'),
      angle('a3', 'running toward the mountains', 'Why would a teenager run away to where the expeditions start?', 'Going where your thing happens is a first step anyone can take.'),
      angle('a4', 'seen by home', 'What does it mean when the people who raised you get to see you make it?', 'Sharing the big moment with the people from the start makes it land.'),
    ],
    tags: [
      tag('conflict_cooperativeness', 'high', 'made it a two-person summit', 'He reached the top as a partner, roped together with Hillary.'),
      tag('steadiness', 'high', 'calm at extreme altitude', 'He worked high on the mountain through many expeditions.'),
      tag('conflict_assertiveness', 'low', 'did the work, quietly', 'For years he carried loads on other people’s expeditions.'),
      tag('attachment_anxiety', 'low', 'trusted the rope team', 'Climbing roped together means trusting your partner with your life.'),
      tag('autonomy', 'low', 'worked within the team plan', 'He climbed for years inside expeditions led by others.'),
    ],
    vetting: 'Mountaineer, died 1986; no office; broadly admired.',
  },
];
