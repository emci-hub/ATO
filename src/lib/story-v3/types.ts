import type { CategoryId } from '@/lib/categories';
import type { StoryAngle } from '@/lib/ai-library/story';
import type { TraitLean } from '@/lib/traits';

export type StoryBeatKey = 'hook' | 'twist' | 'move' | 'punchline';

export type StoryNarratorLine = { kind: 'narrator'; text: string };
export type StoryDialogueLine = { kind: 'dialogue'; speaker: string; text: string };
export type StoryLine = StoryNarratorLine | StoryDialogueLine;

export interface JokePointer {
  beat: StoryBeatKey;
  line: number;
}

export interface StoryCard6 {
  categoryName: string;
  leanPhrase: string;
  scoreLine?: string;
  evidence: string;
  tip: string;
}

/** A fully rendered v3 script (what the swipe cards show). */
export interface StoryScript {
  id: string;
  topicId: string;
  categoryId: CategoryId;
  setting: StoryAngle;
  lean: TraitLean;
  title: string;
  settingTag: string;
  hook: StoryLine[];
  twist: StoryLine[];
  move: StoryLine[];
  punchline: StoryLine[];
  next: string;
  reveal: string;
  otherWay?: string;
  card6: StoryCard6;
  jokeLight: JokePointer;
  jokeDark: JokePointer;
  jokeDarkSecondary?: JokePointer;
  romance: boolean;
  source: 'template' | 'reference';
}

export interface StorySlotTags {
  rooms?: readonly string[];
  settings?: readonly StoryAngle[];
  romance?: boolean;
}

export interface StorySlotKeys {
  categoryId?: CategoryId;
  setting?: StoryAngle;
  lean?: TraitLean;
}

export interface GrammarEntry {
  text: string;
  gram?: { article?: 'a' | 'an' | 'the' | 'none'; plural?: boolean; pronoun?: 'it' | 'they' };
  keys?: StorySlotKeys;
  tags?: StorySlotTags;
}

export type GrammarSymbol = string | readonly string[] | readonly GrammarEntry[];

export type StoryGrammar = Record<string, GrammarSymbol>;
