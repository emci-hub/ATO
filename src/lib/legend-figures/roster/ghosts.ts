import type { LegendFigure } from '../types';
import { angle, fact, moment, src, tag, wiki } from './define';

const DUTCHMAN = wiki('Flying_Dutchman');
const BROWNIE = wiki('Brownie_(folklore)');
const TANUKI = wiki('Bake-danuki');

export const GHOST_LEGENDS: readonly LegendFigure[] = [
  {
    id: 'lf_flying_dutchman',
    name: 'The Flying Dutchman',
    kind: 'story',
    hall: 'ghosts',
    region: 'europe',
    place: 'Sailors’ legend, Dutch seas',
    era: 'Told since the 1600s',
    gender: 'none',
    field: 'Ghost ship',
    essence: 'A ship that never makes port and never stops sailing.',
    whoTheyWere: 'A legendary ghost ship, said to be unable to make port and doomed to sail the sea forever.',
    famousFor: 'Sailors’ sightings near the Cape of Good Hope, and an opera by Richard Wagner.',
    facts: [
      fact('f1', 'The ship is said never to make port and to sail the sea forever.', src(DUTCHMAN, 'never able to make port and doomed to sail the sea forever')),
      fact('f2', 'The stories probably began in the age of the Dutch East India Company in the 1600s.', src(DUTCHMAN, 'Dutch East India Company')),
      fact('f3', 'Richard Wagner wrote an opera, The Flying Dutchman, in 1843.', src(DUTCHMAN, 'The Flying Dutchman (1843)')),
    ],
    moments: [
      moment(
        'm1',
        'A 1795 account tells of sailors who saw what they took for the lost ship in a storm, until it turned out to be a dark thick cloud. The story spread anyway.',
        src(DUTCHMAN, '1795', 'a dark thick cloud', 'spread like wild-fire'),
      ),
      moment('m2', 'Some tellings model its captain on a Dutch captain famous for the speed of his voyages.', src(DUTCHMAN, 'renowned for the speed of his trips')),
    ],
    angles: [
      angle('a1', 'the endless voyage', 'What does a ship that never stops sailing have in common with you?', 'Keeping a steady course is strong. Knowing when to come into port is too.'),
      angle('a2', 'the same route', 'What happens when you refuse to change course, no matter what?', 'Being stubborn can carry you far, and sometimes it’s worth asking where.'),
      angle('a3', 'the cloud', 'Why does a story spread even after the ship turns out to be a cloud?', 'What people think they saw can travel faster than what happened.'),
      angle('a4', 'the fast captain', 'What legend grows around someone who keeps arriving too fast?', 'Being known for one thing can turn into a story bigger than you.'),
    ],
    tags: [
      tag('openness', 'low', 'the same route, forever', 'It sails the same seas and never changes course.'),
      tag('growth_mindset', 'low', 'never changes course', 'The ghost ship keeps doing the same thing forever.'),
      tag('conflict_cooperativeness', 'low', 'won’t bend for anyone', 'In the legend it never gives in to the sea.'),
      tag('relatedness', 'low', 'sails alone', 'It roams the oceans with no port and no company.'),
    ],
    vetting: 'Sailors’ ghost legend; no real person named as the captain in the entry; no harm to children.',
  },
  {
    id: 'lf_brownie',
    name: 'The Brownie',
    kind: 'story',
    hall: 'ghosts',
    region: 'europe',
    place: 'Scottish folklore',
    era: 'Told since at least the 1500s',
    gender: 'none',
    field: 'Household spirit',
    essence: 'Does the chores at night and leaves if you make a fuss about it.',
    whoTheyWere: 'A household spirit from Scottish folklore that comes out at night, while everyone sleeps, to do the chores.',
    famousFor: 'Quietly helping a household, and leaving forever if given clothes.',
    facts: [
      fact('f1', 'A brownie is said to come out at night while the owners sleep, doing chores and farm tasks.', src(BROWNIE, 'come out at night while the owners of the house are asleep')),
      fact('f2', 'Families left a bowl of cream or porridge by the hearth for it.', src(BROWNIE, 'bowl of cream or porridge')),
      fact('f3', 'If given a gift of clothing, a brownie leaves forever.', src(BROWNIE, 'gift of clothing, he will leave forever')),
    ],
    moments: [
      moment('m1', 'The first English mention of a brownie disappearing after being given clothes is from a book published in 1584.', src(BROWNIE, '1584')),
      moment('m2', 'Brownies were said to be easily offended, leaving if they felt insulted or taken advantage of.', src(BROWNIE, 'easily offended')),
    ],
    angles: [
      angle('a1', 'the night shift', 'What does a spirit who cleans while everyone sleeps have in common with you?', 'Helping without needing credit is a quiet kind of strength.'),
      angle('a2', 'no thanks needed', 'Why would a gift make a helper leave?', 'Some people help best when nobody turns it into a big deal.'),
      angle('a3', 'a bowl of cream', 'What’s the smallest thanks that still counts?', 'Small, steady appreciation can matter more than a grand gesture.'),
      angle('a4', 'knowing your worth', 'When is it time to walk away?', 'Leaving when you’re taken for granted is allowed.'),
    ],
    tags: [
      tag('conflict_assertiveness', 'low', 'works without a word', 'It helps silently while the house sleeps.'),
      tag('attachment_avoidance', 'high', 'helps from a distance', 'It never shows itself to the family it helps.'),
      tag('extraversion', 'low', 'only comes out at night', 'It works only when everyone else is asleep.'),
      tag('openness', 'low', 'one house, one routine', 'It stays with one household, doing the same chores.'),
      tag('relatedness', 'low', 'happy on its own', 'It keeps to itself and needs no company.'),
    ],
    vetting: 'Folklore household spirit; no religious figure; no harm to children.',
  },
  {
    id: 'lf_tanuki',
    name: 'The Tanuki',
    kind: 'story',
    hall: 'ghosts',
    region: 'east_asia',
    place: 'Japanese folklore',
    era: 'Told for centuries',
    gender: 'none',
    field: 'Shapeshifter',
    essence: 'A shapeshifter with eight disguises, one more than the fox.',
    whoTheyWere: 'A shapeshifting raccoon dog from Japanese folklore, often a comical trickster.',
    famousFor: 'Changing shape for the fun of it, and the tea kettle that never ran dry.',
    facts: [
      fact('f1', 'A saying goes that the fox has seven disguises, and the tanuki has eight.', src(TANUKI, 'the tanuki has eight')),
      fact('f2', 'Some tellings say tanuki simply like to change their form.', src(TANUKI, 'simply like to change their form')),
      fact('f3', 'Tanuki statues are seen all over Japan, made in Shigaraki ware.', src(TANUKI, 'Shigaraki ware')),
    ],
    moments: [
      moment(
        'm1',
        'In the tale of Bunbuku Chagama, a tanuki disguised as a monk’s tea kettle boiled tea that never ran out.',
        src(TANUKI, 'disguised as a teapot', 'never run out'),
      ),
      moment('m2', 'Tanuki are said to drum on their bellies to make a pom-pom sound.', src(TANUKI, 'drum on their bellies')),
    ],
    angles: [
      angle('a1', 'eight disguises', 'What does a shapeshifter with one more trick than the fox have in common with you?', 'Being able to show up in different ways is a skill, not a fake.'),
      angle('a2', 'for the fun of it', 'Why change shape just because you can?', 'Doing something for fun is a good enough reason.'),
      angle('a3', 'the bottomless kettle', 'What happens when a trickster becomes the most useful thing in the room?', 'Your playful side can also be your most generous one.'),
      angle('a4', 'the belly drum', 'Who makes music with whatever they’ve got?', 'You can make a good time out of very little.'),
    ],
    tags: [
      tag('playfulness', 'high', 'changes shape for fun', 'Tellings say tanuki change form just because they like it.'),
      tag('conscientiousness', 'low', 'makes it up as it goes', 'It improvises one disguise after another.'),
      tag('extraversion', 'high', 'loves an audience', 'It plays tricks to get a reaction from people.'),
      tag('openness', 'high', 'tries every shape', 'It has more disguises than the fox.'),
    ],
    hidden: {
      needs: [
        { axis: 'playfulness', lean: 'high' },
        { axis: 'conscientiousness', lean: 'low' },
      ],
    },
    vetting: 'Folklore animal trickster; entry avoids the ribald imagery; no harm to children.',
  },
];
