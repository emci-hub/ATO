import type { LegendFigure } from '../types';
import { angle, fact, moment, src, tag, wiki } from './define';

const CURIE = wiki('Marie_Curie');
const HAYTHAM = wiki('Ibn_al-Haytham');
const LOVELACE = wiki('Ada_Lovelace');
const RAMANUJAN = wiki('Srinivasa_Ramanujan');

export const SCIENCE_LEGENDS: readonly LegendFigure[] = [
  {
    id: 'lf_marie_curie',
    name: 'Marie Curie',
    kind: 'real',
    hall: 'science',
    region: 'europe',
    place: 'Poland and France',
    era: '1867–1934',
    died: 1934,
    birthday: { md: '11-07', source: src(CURIE, '7 November 1867') },
    gender: 'woman',
    field: 'Physics and chemistry',
    essence: 'Found two new elements and named one after home.',
    whoTheyWere:
      'A Polish-born physicist and chemist who did her work in France and studied radioactivity, a word she coined.',
    famousFor: 'The first person to win a Nobel Prize twice, in two different sciences.',
    facts: [
      fact('f1', 'With Pierre Curie she discovered the elements polonium and radium.', src(CURIE, 'polonium', 'radium')),
      fact('f2', 'She was the first woman to win a Nobel Prize.', src(CURIE, 'first woman to win a Nobel Prize')),
      fact('f3', 'She coined the term radioactivity.', src(CURIE, 'radioactivity—a term she coined')),
    ],
    moments: [
      moment(
        'm1',
        'During the First World War she developed mobile X-ray units for field hospitals.',
        src(CURIE, 'First World War', 'mobile radiography units', 'field hospitals'),
      ),
      moment(
        'm2',
        'After Pierre died in a Paris street accident in 1906, she kept the research going.',
        src(CURIE, 'Pierre died in 1906 in a Paris street accident'),
      ),
    ],
    angles: [
      angle('a1', 'the patient tester', 'What does a scientist who named an element after home have in common with you?', 'The slow, careful part of a project can be exactly where the discovery hides.'),
      angle('a2', 'the one who kept going', 'Who keeps the work alive when the person beside you is suddenly gone?', 'Carrying something forward after a loss can be its own kind of strength.'),
      angle('a3', 'the practical genius', 'What does a physicist building X-ray vans for a war tell you about your skills?', 'The thing you know deeply can help in places nobody planned for.'),
      angle('a4', 'twice, in two fields', 'How does one person win twice, in two different sciences?', 'Going deep on one question can open doors in more than one direction.'),
    ],
    tags: [
      tag('openness', 'high', 'chased an unknown glow', 'She studied a new kind of radiation that nobody understood yet.'),
      tag('conscientiousness', 'high', 'measured everything, twice', 'Her discoveries came from systematic, repeated measurement.'),
      tag('extraversion', 'low', 'at home in the lab', 'Her life’s work happened in the quiet of a laboratory.'),
      tag('growth_mindset', 'high', 'learned a new field', 'She moved from physics into chemistry and won in both.'),
      tag('playfulness', 'low', 'serious about the work', 'She treated research as work that mattered, not a game.'),
    ],
    vetting: 'Scientist, died 1934; no political office; broadly admired worldwide.',
  },
  {
    id: 'lf_ibn_al_haytham',
    name: 'Ibn al-Haytham',
    kind: 'real',
    hall: 'science',
    region: 'middle_east',
    place: 'Basra and Cairo',
    era: 'c. 965–c. 1040',
    died: 1040,
    gender: 'man',
    field: 'Optics and mathematics',
    essence: 'Said a good idea has to survive an experiment.',
    whoTheyWere: 'A scholar born in Basra who did most of his work in Cairo, writing on light, vision and mathematics.',
    famousFor: 'His Book of Optics, and an early version of the scientific method.',
    facts: [
      fact('f1', 'He argued that a hypothesis must be supported by experiments or mathematical reasoning.', src(HAYTHAM, 'hypothesis must be supported by experiments')),
      fact('f2', 'He is sometimes described as the world’s first true scientist.', src(HAYTHAM, 'first true scientist')),
      fact('f3', 'He wrote Doubts Concerning Ptolemy, questioning the most respected astronomer of his time.', src(HAYTHAM, 'Doubts Concerning Ptolemy')),
    ],
    moments: [
      moment(
        'm1',
        'The story goes that he pretended to be mad to escape a task for the caliph, and was kept under house arrest.',
        src(HAYTHAM, 'feigned madness', 'house arrest'),
      ),
      moment('m2', 'During that time he wrote his Book of Optics.', src(HAYTHAM, 'During this time, he wrote his influential Book of Optics')),
    ],
    angles: [
      angle('a1', 'prove it', 'What does a thinker who doubted the greatest astronomer have in common with you?', 'Asking “how do we know?” is not rude. It is how good ideas get better.'),
      angle('a2', 'the locked room', 'What can someone build while stuck in one room?', 'A stretch of time you didn’t choose can still hold your best work.'),
      angle('a3', 'the first scientist', 'Why would a scholar from a thousand years ago care how you test your plans?', 'Trying something small before trusting it fully is a habit worth keeping.'),
      angle('a4', 'light and sight', 'What does a man who studied how eyes see have to say about how you see things?', 'Checking what you actually saw, not what you expected, changes a lot.'),
    ],
    tags: [
      tag('openness', 'high', 'questioned how sight works', 'He studied light and vision when little was known about them.'),
      tag('agreeableness', 'low', 'doubted the great Ptolemy', 'He wrote a whole book questioning the most trusted astronomer.'),
      tag('autonomy', 'high', 'followed his own method', 'He set his own standard: ideas must survive experiments.'),
      tag('relatedness', 'low', 'worked alone in confinement', 'His most famous book was written while he was kept apart.'),
      tag('growth_mindset', 'high', 'tested, then revised', 'He treated ideas as things to test, not to defend.'),
    ],
    vetting: 'Scholar, died c. 1040; no political or religious office; admired across cultures.',
  },
  {
    id: 'lf_ada_lovelace',
    name: 'Ada Lovelace',
    kind: 'real',
    hall: 'science',
    region: 'europe',
    place: 'England',
    era: '1815–1852',
    died: 1852,
    birthday: { md: '12-10', source: src(LOVELACE, '10 December 1815') },
    gender: 'woman',
    field: 'Mathematics',
    essence: 'Saw a computer’s future before the computer existed.',
    whoTheyWere: 'An English mathematician and writer who worked with Charles Babbage on his planned Analytical Engine.',
    famousFor: 'Notes often called the first published computer program.',
    facts: [
      fact('f1', 'Her Note G described a method for the Analytical Engine to calculate Bernoulli numbers.', src(LOVELACE, 'Note G', 'Bernoulli numbers')),
      fact('f2', 'She was the first to recognise the machine had uses beyond pure calculation.', src(LOVELACE, 'first to recognise the machine had applications beyond pure calculation')),
      fact('f3', 'She called her approach “poetical science”.', src(LOVELACE, 'poetical science')),
    ],
    moments: [
      moment(
        'm1',
        'Translating an article about the engine, she added seven long notes of her own that ran longer than the article.',
        src(LOVELACE, 'seven long explanatory notes'),
      ),
      moment('m2', 'She described herself as an “Analyst (& Metaphysician)”.', src(LOVELACE, 'Analyst (& Metaphysician)')),
    ],
    angles: [
      angle('a1', 'the footnote that won', 'What do a translator’s notes from the 1840s have in common with you?', 'The extra thing you add because you care can become the part people remember.'),
      angle('a2', 'poetical science', 'What happens when someone mixes poetry and mathematics?', 'You don’t have to choose between the careful side of you and the imaginative one.'),
      angle('a3', 'beyond the brief', 'Who looks at a calculator and sees music and art?', 'Seeing what something could become is a skill, even before anyone agrees.'),
      angle('a4', 'the early idea', 'What does it feel like to be a hundred years early?', 'An idea can be right long before the world is ready to use it.'),
    ],
    tags: [
      tag('openness', 'high', 'imagined machines making music', 'She saw uses for the engine far beyond arithmetic.'),
      tag('playfulness', 'high', 'mixed poetry with maths', 'She called her own method poetical science.'),
      tag('self_efficacy', 'high', 'wrote more than asked', 'She added notes longer than the article she was translating.'),
      tag('autonomy', 'high', 'named her own role', 'She described herself in her own terms, as an Analyst.'),
    ],
    vetting: 'Mathematician, died 1852; no political office; broadly admired.',
  },
  {
    id: 'lf_srinivasa_ramanujan',
    name: 'Srinivasa Ramanujan',
    kind: 'real',
    hall: 'science',
    region: 'south_asia',
    place: 'India and England',
    era: '1887–1920',
    died: 1920,
    birthday: { md: '12-22', source: src(RAMANUJAN, '22 December 1887') },
    gender: 'man',
    field: 'Mathematics',
    essence: 'Mailed his notebooks to a stranger and changed mathematics.',
    whoTheyWere: 'An Indian mathematician who first developed his research in isolation, then worked with G. H. Hardy in Cambridge.',
    famousFor: 'Thousands of results in number theory, and the number 1729.',
    facts: [
      fact('f1', 'At 16 he borrowed a library copy of a book of 5,000 theorems and studied it in detail.', src(RAMANUJAN, 'collection of 5,000 theorems')),
      fact('f2', 'He was elected a Fellow of the Royal Society in 1918.', src(RAMANUJAN, 'Fellow of the Royal Society', '1918')),
      fact('f3', 'The number 1729 is called the Hardy–Ramanujan number.', src(RAMANUJAN, 'Hardy–Ramanujan number')),
      fact('f4', 'He first developed his own mathematical research in isolation.', src(RAMANUJAN, 'developed his own mathematical research in isolation')),
    ],
    moments: [
      moment('m1', 'He wrote to the Cambridge mathematician G. H. Hardy, sending pages of his own results.', src(RAMANUJAN, 'Hardy', 'letter')),
      moment(
        'm2',
        'Visiting him in hospital, Hardy mentioned his taxi number, 1729, as dull, and Ramanujan replied that it was a very interesting number.',
        src(RAMANUJAN, '1729', 'hospital', 'interesting'),
      ),
    ],
    angles: [
      angle('a1', 'the letter', 'What does a self-taught mathematician who wrote to a stranger in Cambridge have in common with you?', 'Sending your work to someone who might get it is a risk worth taking.'),
      angle('a2', 'self-taught', 'How far can someone get learning mostly on their own?', 'The way you learned something matters less than how far you take it.'),
      angle('a3', 'interesting numbers', 'Who looks at a taxi number and sees something beautiful?', 'Noticing what others call dull is its own kind of talent.'),
      angle('a4', 'the stubborn path', 'What if the thing you love is the only subject you want to study?', 'Going all in on one thing has costs, and sometimes it’s still the right call.'),
    ],
    tags: [
      tag('openness', 'high', 'saw patterns everywhere', 'He found something interesting in a number others called dull.'),
      tag('conscientiousness', 'low', 'skipped the usual steps', 'He reached results by his own route, working in isolation.'),
      tag('extraversion', 'low', 'worked in isolation', 'He first developed his research alone, before anyone saw it.'),
      tag('self_efficacy', 'high', 'wrote to a stranger', 'He sent his results to a famous mathematician he had never met.'),
    ],
    hidden: {
      needs: [
        { axis: 'openness', lean: 'high' },
        { axis: 'conscientiousness', lean: 'low' },
        { axis: 'extraversion', lean: 'low' },
      ],
    },
    vetting: 'Mathematician, died 1920; no political office; broadly admired.',
  },
];
