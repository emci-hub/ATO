import type { LegendFigure } from '../types';
import { angle, fact, moment, src, tag, wiki } from './define';

const OWENS = wiki('Jesse_Owens');
const FANNY = wiki('Fanny_Blankers-Koen');
const DUKE = wiki('Duke_Kahanamoku');

export const SPORT_LEGENDS: readonly LegendFigure[] = [
  {
    id: 'lf_jesse_owens',
    name: 'Jesse Owens',
    kind: 'real',
    hall: 'sport',
    region: 'americas',
    place: 'United States',
    era: '1913–1980',
    died: 1980,
    birthday: { md: '09-12', source: src(OWENS, 'September 12, 1913') },
    gender: 'man',
    field: 'Track and field',
    essence: 'Got his name from a teacher who misheard him, then made it famous.',
    whoTheyWere: 'An American track and field athlete who grew up in Cleveland and took small jobs in his spare time.',
    famousFor: 'Four gold medals at the 1936 Olympic Games.',
    facts: [
      fact('f1', 'He won four gold medals at the 1936 Olympic Games.', src(OWENS, '1936 Olympic Games by winning four gold medals')),
      fact('f2', 'He set individual Olympic records in each of his events.', src(OWENS, 'setting individual Olympic records')),
      fact('f3', 'He is widely regarded as one of the greatest athletes in track and field.', src(OWENS, 'one of the greatest athletes in track and field')),
    ],
    moments: [
      moment(
        'm1',
        'When a new teacher asked his name, he said “J. C.”, and because of his accent she heard “Jesse”. The name stuck.',
        src(OWENS, 'she thought he said "Jesse"', 'The name stuck'),
      ),
      moment('m2', 'He won the 100 m dash by one tenth of a second over his college friend Ralph Metcalfe.', src(OWENS, 'college friend Ralph Metcalfe')),
    ],
    angles: [
      angle('a1', 'the misheard name', 'What does an athlete named by a teacher’s mistake have in common with you?', 'A label you didn’t choose can still become something you’re proud of.'),
      angle('a2', 'one tenth of a second', 'What separates first and second when both are friends?', 'You can race someone hard and still be on their side.'),
      angle('a3', 'four for four', 'How do you stay steady through four finals?', 'Doing your thing calmly, one event at a time, adds up.'),
      angle('a4', 'spare-time jobs', 'Why would a future champion deliver groceries after school?', 'The ordinary work around your dream is part of the dream.'),
    ],
    tags: [
      tag('steadiness', 'high', 'calm through four finals', 'He won four events at the same Games.'),
      tag('competence', 'high', 'record after record', 'He set Olympic records in each of his events.'),
      tag('agreeableness', 'high', 'raced a friend, stayed friends', 'He beat his college friend by a tenth of a second.'),
      tag('relatedness', 'high', 'ran with his teammates', 'His friends and teammates were part of his story.'),
    ],
    vetting: 'Athlete, died 1980; no office; broadly admired.',
  },
  {
    id: 'lf_fanny_blankers_koen',
    name: 'Fanny Blankers-Koen',
    kind: 'real',
    hall: 'sport',
    region: 'europe',
    place: 'Netherlands',
    era: '1918–2004',
    died: 2004,
    birthday: { md: '04-26', source: src(FANNY, '26 April 1918') },
    gender: 'woman',
    field: 'Track and field',
    essence: 'Called too old at thirty, then won four golds.',
    whoTheyWere: 'A Dutch track and field athlete who competed at the 1948 London Olympics as a mother of two.',
    famousFor: 'Four gold medals in 1948, earning the nickname “the Flying Housewife”.',
    facts: [
      fact('f1', 'She won four gold medals at the 1948 Summer Olympics in London.', src(FANNY, 'four gold medals at the 1948 Summer Olympics')),
      fact('f2', 'She competed as a 30-year-old mother of two and was nicknamed “the Flying Housewife”.', src(FANNY, '30-year-old mother of two', 'Flying Housewife')),
      fact('f3', 'Before the Games, a British team manager said she was “too old to make the grade”.', src(FANNY, 'too old to make the grade')),
    ],
    moments: [
      moment(
        'm1',
        'Shortly before the 200 m semi-final she broke down from homesickness. After a long talk with her husband, she decided to run anyway.',
        src(FANNY, 'broke down because of homesickness', 'decided to run anyway'),
      ),
      moment('m2', 'Two months before the Games she broke her own world record in the 80 m hurdles.', src(FANNY, 'beating her own 80 m hurdles world record')),
    ],
    angles: [
      angle('a1', 'too old', 'What does a sprinter told she was too old have in common with you?', 'Someone else’s timeline for your life is only a guess.'),
      angle('a2', 'the homesick semi-final', 'What happens when a champion wants to go home the day before the race?', 'Doubting yourself right before the big moment doesn’t mean you’re not ready.'),
      angle('a3', 'the talk', 'Who do you call when you nearly quit?', 'Talking it through with someone close can turn a no into a yes.'),
      angle('a4', 'both lives', 'Can you be a parent and the fastest person there?', 'You don’t have to shrink one part of your life to grow another.'),
    ],
    tags: [
      tag('self_efficacy', 'low', 'nearly didn’t run', 'Homesick and overwhelmed, she almost skipped the semi-final.'),
      tag('steadiness', 'low', 'felt it all before the race', 'She broke down shortly before running.'),
      tag('attachment_avoidance', 'low', 'leaned on her husband', 'A long talk with her husband got her to the start line.'),
      tag('locus_of_control', 'high', 'answered critics on the track', 'Told she was too old, she won four golds.'),
    ],
    vetting: 'Athlete, died 2004; no office; broadly admired.',
  },
  {
    id: 'lf_duke_kahanamoku',
    name: 'Duke Kahanamoku',
    kind: 'real',
    hall: 'sport',
    region: 'oceania',
    place: 'Hawaiʻi',
    era: '1890–1968',
    died: 1968,
    birthday: { md: '08-24', source: src(DUKE, 'August 24, 1890') },
    gender: 'man',
    field: 'Swimming and surfing',
    essence: 'Won Olympic gold, then taught the world to surf.',
    whoTheyWere: 'A Native Hawaiian swimmer and lifeguard who spread surfing far beyond Hawaiʻi.',
    famousFor: 'Olympic swimming golds, and the surfing exhibition that helped start surfing in Australia.',
    facts: [
      fact('f1', 'He won a gold medal in the 100-meter freestyle at the 1912 Olympics in Stockholm.', src(DUKE, '1912 Summer Olympics in Stockholm', 'gold medal in the 100-meter freestyle')),
      fact('f2', 'His 1914 surfing exhibition at Freshwater Beach in Sydney is seen as a turning point for surfing in Australia.', src(DUKE, 'Freshwater Beach', 'seminal event')),
      fact('f3', 'He trained and loaned equipment to new surfers.', src(DUKE, 'loaned equipment to new surfers')),
    ],
    moments: [
      moment(
        'm1',
        'In 1925 at Newport Beach, he used his surfboard to rescue eight men from a capsized fishing boat, making repeated trips through heavy surf.',
        src(DUKE, 'rescued eight men', 'Using his surfboard'),
      ),
      moment('m2', 'He built a surfboard in Australia from a piece of local pine.', src(DUKE, 'piece of pine')),
    ],
    angles: [
      angle('a1', 'sharing the waves', 'What does a champion who lent his boards to beginners have in common with you?', 'Teaching what you love is a way of keeping it alive.'),
      angle('a2', 'the rescue', 'What do you do when the surf is heavy and people need help?', 'Using your everyday skill when it counts is a kind of courage.'),
      angle('a3', 'gold and play', 'Can the same person be an Olympic champion and a beach show-off?', 'Taking something seriously and having fun with it can go together.'),
      angle('a4', 'build your own board', 'Why build a surfboard out of whatever wood is nearby?', 'Making do with what’s around you can start something big.'),
    ],
    tags: [
      tag('playfulness', 'high', 'made the waves fun', 'He spread surfing through exhibitions people loved.'),
      tag('agreeableness', 'high', 'lent out his boards', 'He trained and loaned equipment to new surfers.'),
      tag('relatedness', 'high', 'brought surfing to new shores', 'He shared surfing with people in other countries.'),
      tag('attachment_anxiety', 'low', 'trusted strangers on his board', 'He shared his gear and skills freely with beginners.'),
    ],
    vetting: 'Athlete and lifeguard, died 1968; no office; broadly beloved.',
  },
];
