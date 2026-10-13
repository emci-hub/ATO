import type { CategoryId } from '@/lib/categories';
import type { TraitLean } from '@/lib/traits';

import type { GrammarEntry, StoryGrammar } from './types';

/** Home object-revolt grammar (rulebook demo, original words). */
export const OBJECT_REVOLT_GRAMMAR: StoryGrammar = {
  objectVillain: [
    {
      text: '[v:the toaster][room:Kitchen][quirk:burns only the left side of every slice][trigger:You drop in two slices.][grudge:It fires both slices at the ceiling.][win:The next slice comes up golden.][vLine:It is doing this on purpose.]',
      tags: { rooms: ['Kitchen'], settings: ['home'] },
    },
    {
      text: '[v:the kettle][room:Kitchen][quirk:clicks off one degree before the boil][trigger:You need one cup of hot water.][grudge:It clicks off four times, counting.][win:The water boils with a sulky hiss.][vLine:That click was sarcastic.]',
      tags: { rooms: ['Kitchen'], settings: ['home'] },
    },
    {
      text: '[v:the washing machine][room:Laundry room][quirk:eats exactly one sock per load][trigger:You need the matching pair, fast.][grudge:It keeps every sock it takes.][win:It spits out both socks, matching.][vLine:It is building something in there.]',
      tags: { rooms: ['Laundry room'], settings: ['home'] },
    },
    {
      text: '[v:the Wi-Fi router][room:Living room][quirk:drops the net if anyone says episode][trigger:You need one calm song.][grudge:Its light stays red, like a glare.][win:The song starts, soft and calm.][vLine:Do not say episode. It hears you.]',
      tags: { rooms: ['Living room', 'Home office'], settings: ['home'] },
    },
  ],
  guestBundle: [
    {
      text: '[guest:your aunt][deadline:Your aunt is coming for tea in twenty minutes.][guestPayoff:Your aunt sips tea and calls it lived-in.]',
      tags: { settings: ['home'] },
    },
    {
      text: '[guest:your landlord][deadline:Your landlord is due to inspect in fifteen minutes.][guestPayoff:Your landlord ticks every box on a clipboard.]',
      tags: { settings: ['home'] },
    },
    {
      text: '[guest:your new neighbour][deadline:Your new neighbour wants a ladder in ten minutes.][guestPayoff:Your new neighbour takes the ladder and smiles.]',
      tags: { settings: ['home'] },
    },
  ],
  sideCharacter: [
    { text: '[p:Sam][rel:roommate]', tags: { settings: ['home'] } },
    { text: '[p:Rowan][rel:sibling]', tags: { settings: ['home'] } },
    { text: '[p:Ari][rel:roommate]', tags: { settings: ['home'] } },
  ],
  panicLine: [
    'Please tell me you have a plan.',
    'We have minutes left.',
    'Should I hide behind something?',
  ],
  time: ['7:40 PM', '8:15 PM', '9:05 PM', '6:50 PM'],
  day: ['Sunday', 'Wednesday', 'Saturday', 'Thursday'],
  next: [
    'a fitted sheet that will not fold',
    'a jar lid nobody has opened',
    'a doorbell with nobody there',
  ],
  punchline: [
    '#guestPayoff#\n#v.cap# stays quiet the whole visit.',
    '#guestPayoff#\nNobody mentions #v# once.',
    '#guestPayoff#\n#v.cap# waits until the door closes.',
  ],
  hook: '#deadline#\n#v.cap# #quirk#.\n#trigger#',
  twist: 'Your #rel# #p# watches #v#.\n**#p#:** "#vLine#"\n**#p#:** "#panicLine#"\n#grudge#',
  move__cat_structure__high:
    'You open the binder to page four.\nYou follow the steps for #v#.\n#win#',
  move__cat_structure__low:
    'You give #v# two firm taps.\n#win#\nYou take a small bow for #p#.',
  move__cat_resilience__high:
    'You try again, then a third time.\n#p.cap# hums a tiny montage song.\n#win#',
  move__cat_resilience__low:
    'You let #v# win this round.\nYou drape a tea towel over it.',
  move__cat_agency__high:
    'You treat #v# as a job you can finish.\nYou try one careful fix, then a silly one.\n#win#',
  move__cat_agency__low:
    'You let #v# have this round.\nYou set out cups anyway.\nYou take a small bow for #p#.',
  reveal__cat_structure__high: 'Your systems aren\'t fussy. They\'re armour.',
  reveal__cat_structure__low: 'No system, yet somehow everything works. That\'s your system.',
  reveal__cat_resilience__high: 'You don\'t win first. You win last.',
  reveal__cat_resilience__low: 'You pick your battles, yet you never lose the match.',
  reveal__cat_agency__high: 'You treat the outcome as yours to shape.',
  reveal__cat_agency__low: 'You roll with what the day deals.',
  title__cat_structure__high: 'Chief of House Rules',
  title__cat_structure__low: 'Captain Two Taps',
  title__cat_resilience__high: 'Saint of Round Four',
  title__cat_resilience__low: 'Professor Tea Towel',
  title__cat_agency__high: 'Captain Of The Fix',
  title__cat_agency__low: 'Professor Side Door',
};

export const OBJECT_REVOLT_CATEGORIES: readonly CategoryId[] = [
  'cat_structure',
  'cat_resilience',
  'cat_agency',
];

export const KEYED_EVIDENCE: Record<string, string> = {
  'cat_structure|high': 'you followed the binder and finished the job',
  'cat_structure|low': 'you gave it two taps and it worked',
  'cat_resilience|high': 'you tried again until it worked',
  'cat_resilience|low': 'you draped a tea towel and changed the plan',
  'cat_agency|high': 'you treated the fix as yours to finish',
  'cat_agency|low': 'you set out cups and still hosted',
};

export const KEYED_TIPS: Record<string, string> = {
  'cat_steadiness|high': 'Tip: keep one small ritual when the day wobbles.',
  'cat_steadiness|low': 'Watch out: riding the wobble still needs a landing.',
  'cat_openness|high': 'Tip: one new path is enough. Write the rest later.',
  'cat_openness|low': 'Watch out: the known path still needs a first step.',
  'cat_drive|high': 'Tip: hand out jobs before you speed up.',
  'cat_drive|low': 'Watch out: a closet fix works once. Empty it later.',
  'cat_agency|high': 'Tip: pick the part you can still shape.',
  'cat_agency|low': 'Watch out: rolling with the day is not the same as disappearing.',
  'cat_social|high': 'Tip: leave one quiet person a turn to talk.',
  'cat_social|low': 'Watch out: a smaller room is fine. A disappearing act is not.',
  'cat_communication|high': 'Tip: the kind version of the hard thing is still the thing.',
  'cat_communication|low': 'Watch out: stepping back still needs one clear line.',
  'cat_love|high': 'Tip: close is good. A little air is also love.',
  'cat_love|low': 'Watch out: room is kind. Silence can look like leaving.',
  'cat_independence|high': 'Tip: your way works. Tell people the plan out loud.',
  'cat_independence|low': 'Watch out: sharing a path is not the same as losing yours.',
  'cat_levity|high': 'Tip: one joke is a gift. Explaining it is a tax.',
  'cat_levity|low': 'Watch out: a straight face still needs one kind word.',
  'cat_structure|high': 'Tip: a plan is armour. Leave one box blank.',
  'cat_structure|low': 'Watch out: loose plans still need a time.',
  'cat_resilience|high': 'Tip: try again, then take the snack break.',
  'cat_resilience|low': 'Watch out: picking your battles is not quitting the match.',
};

export function keyedTip(categoryId: CategoryId, lean: TraitLean): string {
  return KEYED_TIPS[`${categoryId}|${lean}`] ?? 'Tip: keep it kind, and keep it small.';
}

function asEntryList(symbol: StoryGrammar[string]): GrammarEntry[] {
  if (typeof symbol === 'string') return [{ text: symbol }];
  return [...symbol].map((row) => (typeof row === 'string' ? { text: row } : row));
}

export function revoltGrammarSlice(object: number, guest: number, side: number): StoryGrammar {
  const objects = asEntryList(OBJECT_REVOLT_GRAMMAR.objectVillain);
  const guests = asEntryList(OBJECT_REVOLT_GRAMMAR.guestBundle);
  const sides = asEntryList(OBJECT_REVOLT_GRAMMAR.sideCharacter);
  return {
    ...OBJECT_REVOLT_GRAMMAR,
    objectVillain: [objects[object % objects.length]!],
    guestBundle: [guests[guest % guests.length]!],
    sideCharacter: [sides[side % sides.length]!],
  };
}

export const OBJECT_REVOLT_OBJECT_COUNT = 4;
export const OBJECT_REVOLT_GUEST_COUNT = 3;
export const OBJECT_REVOLT_SIDE_COUNT = 3;
