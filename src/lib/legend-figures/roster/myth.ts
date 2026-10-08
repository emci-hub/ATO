import type { LegendFigure } from '../types';
import { angle, fact, moment, src, tag, wiki } from './define';

const ANANSI = wiki('Anansi');
const MULAN = wiki('Hua_Mulan');
const MOMO = wiki('Momotarō');
const ROBIN = wiki('Robin_Hood');

export const MYTH_LEGENDS: readonly LegendFigure[] = [
  {
    id: 'lf_anansi',
    name: 'Anansi',
    kind: 'story',
    hall: 'myth',
    region: 'africa',
    place: 'Akan folktales, West Africa',
    era: 'Told for centuries',
    gender: 'none',
    field: 'Trickster tales',
    essence: 'A spider who wanted every story in the world, and got them.',
    whoTheyWere: 'A trickster spider from Akan folklore, linked with stories, wisdom, wit and mischief.',
    famousFor: 'Winning all the world’s stories from the sky god, and giving his name to the spider tales.',
    facts: [
      fact('f1', 'Anansi is most often shown as a spider, and is linked with stories, wisdom and cunning.', src(ANANSI, 'most commonly depicted as a spider', 'stories, wisdom')),
      fact('f2', 'The whole tradition of tales is named after him: anansesem, or spider tales.', src(ANANSI, 'anansesem')),
      fact('f3', 'His tales spread to the Caribbean and the Americas.', src(ANANSI, 'Caribbean')),
    ],
    moments: [
      moment(
        'm1',
        'In the tale, the sky god Nyame kept all the stories, and set Anansi four tasks for them: catch a python, hornets, a leopard and a dwarf spirit.',
        src(ANANSI, 'sky god Nyame', 'python Onini', 'leopard Osebo'),
      ),
      moment('m2', 'Through cunning, and advice from his wife Aso, Anansi tricked each one into capture.', src(ANANSI, 'consultation of his wife Aso')),
    ],
    angles: [
      angle('a1', 'all the stories', 'What does a spider who bargained for every story have in common with you?', 'Wanting something big enough to ask the sky for it is a good start.'),
      angle('a2', 'brains over size', 'How does the smallest creature catch a leopard?', 'You don’t need to be the strongest in the room if you’re the cleverest.'),
      angle('a3', 'asking your partner', 'Who does the trickster ask when he gets stuck?', 'Even the cleverest plan gets better with one good outside opinion.'),
      angle('a4', 'the name on the tales', 'What does it take to have a whole tradition named after you?', 'Being the one who keeps the stories going is its own kind of legacy.'),
    ],
    tags: [
      tag('playfulness', 'high', 'won by playing tricks', 'He solves every task with a trick, not force.'),
      tag('openness', 'high', 'wanted every story', 'He set out to own all the stories in the world.'),
      tag('agreeableness', 'low', 'no rule-follower', 'He bargains, bends rules and outwits everyone.'),
      tag('conflict_cooperativeness', 'low', 'wanted them all for himself', 'He wanted the stories that the sky god held.'),
    ],
    hidden: {
      needs: [
        { axis: 'playfulness', lean: 'high' },
        { axis: 'agreeableness', lean: 'low' },
      ],
    },
    vetting: 'Folktale trickster (not a worshipped deity in the tales used); Akan source; no harm to children.',
  },
  {
    id: 'lf_hua_mulan',
    name: 'Hua Mulan',
    kind: 'story',
    hall: 'myth',
    region: 'east_asia',
    place: 'Chinese folk ballad',
    era: 'Ballad from c. 400–500s',
    gender: 'woman',
    field: 'Folk heroine',
    essence: 'Took her father’s place, and nobody noticed for twelve years.',
    whoTheyWere: 'The heroine of the Ballad of Mulan, a Chinese folk song first written down over a thousand years ago.',
    famousFor: 'Disguising herself to take her aged father’s place in the army.',
    facts: [
      fact('f1', 'The first known written record of Mulan is the Ballad of Mulan, a folk song.', src(MULAN, 'first known written record of Mulan is the Ballad of Mulan')),
      fact('f2', 'In the story she takes her aged father’s place because there is no other grown man in the family.', src(MULAN, 'took her aged father\'s place')),
      fact('f3', 'Offered high office at the end, she asks only for a horse to ride home.', src(MULAN, 'asking only for a horse')),
    ],
    moments: [
      moment('m1', 'The ballad opens with Mulan sighing at her loom, after her father is named in the call-up notices.', src(MULAN, 'Mulan sighs at her loom')),
      moment('m2', 'Back home in her old clothes, she meets her comrades, who are shocked: in twelve years they never knew she was a woman.', src(MULAN, 'For twelve years of their enlistment together')),
    ],
    angles: [
      angle('a1', 'in his place', 'What does a daughter who stepped up for her father have in common with you?', 'Stepping in for someone you love can show you what you’re capable of.'),
      angle('a2', 'just a horse', 'Why would a hero turn down high office for a ride home?', 'Knowing what you actually want is worth more than the biggest prize.'),
      angle('a3', 'the loom', 'What goes through your head the moment before you decide?', 'A sigh can come right before your bravest choice.'),
      angle('a4', 'twelve years unseen', 'How do you do the job so well that nobody questions you?', 'Doing the work well can speak louder than who people expect you to be.'),
    ],
    tags: [
      tag('self_efficacy', 'high', 'went to war for her family', 'She takes her father’s place in the army.'),
      tag('attachment_avoidance', 'low', 'did it for her father', 'Her whole story starts from wanting to protect him.'),
      tag('relatedness', 'high', 'came home to her family', 'She turns down office to go back to her family.'),
      tag('autonomy', 'low', 'answered the call-up', 'She acts from duty to the summons her father received.'),
    ],
    vetting: 'Folk ballad heroine (legendary, not a real commander); widely loved; no harm to children.',
  },
  {
    id: 'lf_momotaro',
    name: 'Momotarō',
    kind: 'story',
    hall: 'myth',
    region: 'east_asia',
    place: 'Japanese folklore',
    era: 'Told for centuries',
    gender: 'man',
    field: 'Folk hero',
    essence: 'Shared his dumplings and gained a dog, a monkey and a pheasant.',
    whoTheyWere: 'The Peach Boy, a popular hero of Japanese folklore.',
    famousFor: 'Setting out for Demon Island with three animal friends he won over with dumplings.',
    facts: [
      fact('f1', 'His name means Peach Boy.', src(MOMO, 'Peach Boy')),
      fact('f2', 'He sets out for Onigashima, Demon Island, to stop a band of oni raiding the land.', src(MOMO, 'Onigashima')),
      fact('f3', 'The standard version of the story spread through school textbooks.', src(MOMO, 'school textbooks')),
    ],
    moments: [
      moment(
        'm1',
        'On the way he befriends a talking dog, monkey and pheasant, who help him in exchange for some of his millet dumplings.',
        src(MOMO, 'dog, monkey and pheasant', 'kibi dango'),
      ),
      moment('m2', 'He and his new friends return home with the treasure the oni had taken.', src(MOMO, 'plundered treasure')),
    ],
    angles: [
      angle('a1', 'the dumpling deal', 'What does a boy who recruited friends with snacks have in common with you?', 'Sharing what you have is often how a team starts.'),
      angle('a2', 'unlikely friends', 'Why would a dog, a monkey and a pheasant work together?', 'People who don’t seem to match can make the best team.'),
      angle('a3', 'setting out', 'What does it take to leave home for an island full of trouble?', 'Going toward the hard thing is easier with friends beside you.'),
      angle('a4', 'bringing it home', 'What do you do with the win?', 'A win means more when it goes back to the people it was for.'),
    ],
    tags: [
      tag('conflict_cooperativeness', 'high', 'shared his dumplings', 'He wins helpers by sharing his food.'),
      tag('attachment_anxiety', 'low', 'trusted strangers on the road', 'He welcomes three animals he’s only just met.'),
      tag('self_efficacy', 'high', 'headed for Demon Island', 'He sets out to face the oni himself.'),
      tag('relatedness', 'high', 'built a team', 'His whole quest depends on the friends he makes.'),
    ],
    vetting: 'Folk hero tale; no religious figure; no harm to children.',
  },
  {
    id: 'lf_robin_hood',
    name: 'Robin Hood',
    kind: 'story',
    hall: 'myth',
    region: 'europe',
    place: 'English folklore',
    era: 'Ballads from the 1400s',
    gender: 'man',
    field: 'Folk outlaw',
    essence: 'An outlaw whose men followed him more gladly than the king’s.',
    whoTheyWere: 'A legendary outlaw of English folklore, a skilled archer, first found in ballads from the 1400s.',
    famousFor: '“Robbing the rich to give to the poor.”',
    facts: [
      fact('f1', 'In the legend he is a highly skilled archer and swordsman.', src(ROBIN, 'highly skilled archer and swordsman')),
      fact('f2', 'The earliest known ballads about him date from the 15th century.', src(ROBIN, 'earliest known ballads about him date from the 15th century')),
      fact('f3', 'He is most closely linked with robbing the rich to give to the poor.', src(ROBIN, 'robbing the rich to give to the poor')),
    ],
    moments: [
      moment('m1', 'In an early ballad, a king notices that Robin’s men follow him more willingly than the king’s own men follow the king.', src(ROBIN, 'His men are more at his byddynge')),
      moment('m2', 'Over the centuries the story gathered a whole band around him, including Maid Marian and Little John.', src(ROBIN, 'Maid Marian', 'Little John')),
    ],
    angles: [
      angle('a1', 'the loyal band', 'What does an outlaw whose friends followed him gladly have in common with you?', 'People follow the person who treats them well, title or not.'),
      angle('a2', 'rich and poor', 'Who decides what’s fair when the rules aren’t?', 'Caring about fairness can mean questioning how things are set up.'),
      angle('a3', 'the archer', 'What happens when your best skill is also your calling card?', 'Getting really good at one thing can open every other door.'),
      angle('a4', 'the growing legend', 'How does one ballad turn into a whole band of friends?', 'Your story gets richer with every person you add to it.'),
    ],
    tags: [
      tag('conflict_assertiveness', 'high', 'stood up to the sheriff', 'He openly defies the people in power.'),
      tag('playfulness', 'high', 'merry men, merry life', 'His band is known for adventure and fun.'),
      tag('conflict_cooperativeness', 'high', 'gave to the poor', 'He is known for giving to people in need.'),
      tag('autonomy', 'high', 'lived by his own rules', 'He lives outside the law, in the greenwood.'),
    ],
    vetting: 'Folk legend; not a real figure or religious figure; no harm to children.',
  },
];
