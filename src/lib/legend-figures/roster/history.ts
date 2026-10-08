import type { LegendFigure } from '../types';
import { angle, fact, moment, src, tag, wiki } from './define';

const NIGHTINGALE = wiki('Florence_Nightingale');
const TUBMAN = wiki('Harriet_Tubman');
const GUTENBERG = wiki('Johannes_Gutenberg');

export const HISTORY_LEGENDS: readonly LegendFigure[] = [
  {
    id: 'lf_florence_nightingale',
    name: 'Florence Nightingale',
    kind: 'real',
    hall: 'history',
    region: 'europe',
    place: 'England',
    era: '1820–1910',
    died: 1910,
    birthday: { md: '05-12', source: src(NIGHTINGALE, '12 May 1820') },
    gender: 'woman',
    field: 'Nursing and statistics',
    essence: 'Fought for hospital reform with a lamp and a chart.',
    whoTheyWere: 'An English social reformer and statistician, known as the founder of modern nursing.',
    famousFor: '“The Lady with the Lamp”, and the first secular nursing school in the world.',
    facts: [
      fact('f1', 'She founded a nursing school at St Thomas’ Hospital in London in 1860, the first secular nursing school in the world.', src(NIGHTINGALE, 'first secular nursing school in the world', '1860')),
      fact('f2', 'She is famous for the polar area diagram, also called the Nightingale rose diagram.', src(NIGHTINGALE, 'polar area diagram', 'Nightingale rose diagram')),
      fact('f3', 'She was an innovator in statistics who used graphics to make data easier to act on.', src(NIGHTINGALE, 'innovator in statistics')),
    ],
    moments: [
      moment('m1', 'She became known as “The Lady with the Lamp” for making ward rounds for wounded soldiers at night.', src(NIGHTINGALE, 'The Lady with the Lamp', 'ward rounds')),
      moment('m2', 'She turned hospital data into diagrams so people could see what needed to change.', src(NIGHTINGALE, 'graphical forms')),
    ],
    angles: [
      angle('a1', 'the chart', 'What does a nurse who argued with diagrams have in common with you?', 'Showing the evidence clearly can change minds that arguments can’t.'),
      angle('a2', 'night rounds', 'Who walks the wards at night when everyone else is asleep?', 'Care that happens when nobody’s watching still counts.'),
      angle('a3', 'building the school', 'Why build a school instead of just doing the job?', 'Making a way for others to do what you do multiplies it.'),
      angle('a4', 'the reformer', 'What does it take to fix a system everyone else has accepted?', 'Being stubborn about the right thing is useful.'),
    ],
    tags: [
      tag('conscientiousness', 'high', 'kept the numbers', 'She collected data and turned it into clear charts.'),
      tag('locus_of_control', 'high', 'changed the system', 'She set out to fix how hospitals and nursing worked.'),
      tag('conflict_assertiveness', 'high', 'pushed for reform', 'She argued openly for changes to hospital care.'),
      tag('playfulness', 'low', 'all business', 'Her work was serious, careful and practical.'),
    ],
    vetting: 'Reformer and statistician, died 1910; no political office; broadly admired.',
  },
  {
    id: 'lf_harriet_tubman',
    name: 'Harriet Tubman',
    kind: 'real',
    hall: 'history',
    region: 'americas',
    place: 'United States',
    era: 'c. 1822–1913',
    died: 1913,
    gender: 'woman',
    field: 'Abolition and rescue',
    essence: 'Went back, again and again, and never lost a passenger.',
    whoTheyWere: 'An American abolitionist who escaped slavery and then returned to guide others to freedom.',
    famousFor: 'About 13 missions on the Underground Railroad, rescuing about 70 people.',
    facts: [
      fact('f1', 'After escaping slavery she made some 13 missions to rescue about 70 enslaved people.', src(TUBMAN, 'some 13 missions to rescue approximately 70 enslaved people')),
      fact('f2', 'People called her “Moses”.', src(TUBMAN, '"Moses", as she was called')),
      fact('f3', 'She travelled by night and in extreme secrecy.', src(TUBMAN, 'traveled by night and in extreme secrecy')),
    ],
    moments: [
      moment('m1', 'She later said she “never lost a passenger”.', src(TUBMAN, 'never lost a passenger')),
      moment('m2', 'After the Fugitive Slave Act of 1850, she guided people farther north, into Canada, and helped them find work.', src(TUBMAN, 'Fugitive Slave Act of 1850', 'find work')),
    ],
    angles: [
      angle('a1', 'going back', 'What does a woman who kept returning for others have in common with you?', 'Getting free is one thing. Going back for your people is another kind of brave.'),
      angle('a2', 'never lost a passenger', 'How do you keep everyone safe on the hardest trip there is?', 'Being responsible for others can make you sharper, not smaller.'),
      angle('a3', 'by night', 'What can you do quietly that others never see?', 'Not every important thing needs an audience.'),
      angle('a4', 'one group at a time', 'How do you free seventy people?', 'Big things get done in small, repeated trips.'),
    ],
    tags: [
      tag('self_efficacy', 'high', 'went back, again and again', 'She returned on mission after mission.'),
      tag('conflict_cooperativeness', 'high', 'risked everything for others', 'She guided others to freedom at great personal risk.'),
      tag('steadiness', 'high', 'calm under pressure', 'She never lost a passenger on dangerous night journeys.'),
      tag('competence', 'high', 'knew every route', 'She led about 13 successful missions.'),
    ],
    vetting: 'Abolitionist, died 1913; no political office; broadly admired. Entry focuses on rescue, not war.',
  },
  {
    id: 'lf_johannes_gutenberg',
    name: 'Johannes Gutenberg',
    kind: 'real',
    hall: 'history',
    region: 'europe',
    place: 'Germany',
    era: 'c. 1400–1468',
    died: 1468,
    gender: 'man',
    field: 'Printing',
    essence: 'Failed at selling mirrors, then changed how the world reads.',
    whoTheyWere: 'A German inventor and craftsman whose printing press made printing far faster.',
    famousFor: 'The movable-type printing press and the Gutenberg Bible.',
    facts: [
      fact('f1', 'He invented the movable-type printing press.', src(GUTENBERG, 'invented the movable-type printing press')),
      fact('f2', 'In 1455 he completed the 42-line Bible, known as the Gutenberg Bible.', src(GUTENBERG, '42-line Bible')),
      fact('f3', 'About 180 copies of that Bible were printed.', src(GUTENBERG, 'About 180 copies were printed')),
    ],
    moments: [
      moment('m1', 'Around 1439 he was caught up in a failed business making polished metal mirrors for pilgrims.', src(GUTENBERG, 'financial misadventure', 'polished metal mirrors')),
      moment('m2', 'He convinced the moneylender Johann Fust to lend him 800 guilders for the press.', src(GUTENBERG, 'Johann Fust', '800 guilders')),
    ],
    angles: [
      angle('a1', 'after the mirrors', 'What does an inventor whose first business failed have in common with you?', 'A flop can be the training for the thing that works.'),
      angle('a2', 'the loan', 'Who do you convince when your idea needs money first?', 'Asking for backing is part of building something new.'),
      angle('a3', 'faster', 'What changes when you make an old thing a hundred times faster?', 'Improving how something is done can matter as much as inventing it.'),
      angle('a4', 'the long project', 'How many years go into one perfect book?', 'Some work only shows its value once it’s finished.'),
    ],
    tags: [
      tag('openness', 'high', 'imagined a faster way', 'He built a press that printed much faster than before.'),
      tag('autonomy', 'high', 'ran his own workshop', 'He built and ran his own printing enterprise.'),
      tag('growth_mindset', 'high', 'tried again after a flop', 'After the mirror business failed, he turned to printing.'),
      tag('conscientiousness', 'high', 'set every line by hand', 'His Bible was a long, exact piece of work.'),
    ],
    vetting: 'Inventor, died 1468; no office; broadly admired.',
  },
];
