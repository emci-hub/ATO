import type { CategoryId } from '@/lib/categories';
import type { StoryAngle } from '@/lib/ai-library/story';
import type { TraitLean } from '@/lib/traits';
import { fnv1a } from '@/lib/daily-line/bank';
import { bankIdsToSkip } from '@/lib/story-bank/history';
import type { StoryCard } from '@/lib/story-card';

import { categoryCatalogName, leanPhraseFor } from './lean-phrases';
import { dialogue, narrator } from './lines';
import { referenceFor, STORY_REFERENCES } from './references';
import {
  KEYED_EVIDENCE,
  KEYED_OTHER_WAY,
  keyedTip,
  OBJECT_REVOLT_CATEGORIES,
  OBJECT_REVOLT_GRAMMAR,
  OBJECT_REVOLT_GUEST_COUNT,
  OBJECT_REVOLT_OBJECT_COUNT,
  OBJECT_REVOLT_SIDE_COUNT,
  revoltGrammarSlice,
} from './slots';
import type { StoryGrammar } from './types';
import { expandGrammar } from './tracery';
import { renderTopic, STORY_STAR_TOPICS } from './topics';
import type { StoryLine, StoryScript } from './types';

export function scriptToCard(script: StoryScript, traitScore?: number | null): StoryCard {
  const card6 = {
    ...script.card6,
    ...(typeof traitScore === 'number' ? { scoreLine: `How strongly you lean here: ${traitScore}%.` } : script.card6.scoreLine ? {} : {}),
  };
  if (typeof traitScore !== 'number') delete (card6 as { scoreLine?: string }).scoreLine;
  const join = (lines: readonly StoryLine[]) =>
    lines.map((line) => (line.kind === 'dialogue' ? `**${line.speaker}:** "${line.text}"` : line.text)).join('\n');
  return {
    v: 3,
    title: script.title,
    settingTag: script.settingTag,
    hook: join(script.hook),
    twist: join(script.twist),
    move: join(script.move),
    punchline: join(script.punchline),
    reveal: script.reveal,
    next: script.next.startsWith('Next:') ? script.next.replace(/^Next:\s*/, '') : script.next,
    otherWay: script.otherWay,
    source: script.source === 'reference' ? 'template' : 'template',
    bankId: script.id,
    lines: {
      hook: script.hook,
      twist: script.twist,
      move: script.move,
      punchline: script.punchline,
    },
    card6,
    romance: script.romance,
    topicId: script.topicId,
    jokeLight: script.jokeLight,
    jokeDark: script.jokeDark,
    jokeDarkSecondary: script.jokeDarkSecondary,
  };
}

function parseDialogueBlock(text: string): StoryLine[] {
  return text
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const talk = /^\*\*([^*]+):\*\*\s*"([^"]+)"$/.exec(row);
      if (talk) return dialogue(talk[1]!.trim(), talk[2]!.trim());
      return narrator(row);
    });
}

export function renderObjectRevolt(opts: {
  categoryId: CategoryId;
  lean: TraitLean;
  seed: string;
  grammar?: StoryGrammar;
}): StoryScript {
  const ctx = { categoryId: opts.categoryId, setting: 'home' as const, lean: opts.lean, seed: opts.seed };
  const template = `#objectVillain#\n#guestBundle#\n#sideCharacter#\n📍 *#room#. #time#. #day#.*\n---HOOK---\n#hook#\n---TWIST---\n#twist#\n---MOVE---\n#move#\n---PUNCH---\n#punchline#\n---NEXT---\n#next#\n---REVEAL---\n#reveal#\n---TITLE---\n#title#`;
  const { text, state } = expandGrammar(opts.grammar ?? OBJECT_REVOLT_GRAMMAR, template, ctx);
  const part = (name: string) => {
    const re = new RegExp(`---${name}---\\n([\\s\\S]*?)(?=\\n---|$)`);
    return (re.exec(text)?.[1] ?? '').trim();
  };
  const setting = /📍 \*(.+?)\*/.exec(text)?.[1] ?? 'Kitchen. 7:40 PM. Sunday.';
  const move = parseDialogueBlock(part('MOVE'));
  return {
    id: `revolt_${opts.categoryId}_${opts.lean}_${(state.v ?? 'object').replace(/\s+/g, '_')}`,
    topicId: 'object-revolt',
    categoryId: opts.categoryId,
    setting: 'home',
    lean: opts.lean,
    title: part('TITLE') || 'Captain Two Taps',
    settingTag: setting.replace(/\.$/, ''),
    hook: parseDialogueBlock(part('HOOK')),
    twist: parseDialogueBlock(part('TWIST')),
    move,
    punchline: parseDialogueBlock(part('PUNCH')),
    next: part('NEXT').replace(/^Next:\s*/, ''),
    reveal: part('REVEAL'),
    otherWay:
      KEYED_OTHER_WAY[`${opts.categoryId}|${opts.lean}`] ??
      (opts.lean === 'high' ? 'The other way, you would have given it two taps and a bow.' : 'The other way, you would have opened the binder and followed page four.'),
    card6: {
      categoryName: categoryCatalogName(opts.categoryId),
      leanPhrase: leanPhraseFor(opts.categoryId, opts.lean),
      evidence: KEYED_EVIDENCE[`${opts.categoryId}|${opts.lean}`] ?? 'you handled the object and hosted anyway',
      tip: keyedTip(opts.categoryId, opts.lean),
    },
    jokeLight: { beat: 'move', line: Math.min(2, Math.max(0, move.length - 1)) },
    jokeDark: { beat: 'twist', line: 3 },
    jokeDarkSecondary: { beat: 'punchline', line: 2 },
    romance: false,
    source: 'template',
  };
}

export function allTemplateScripts(): StoryScript[] {
  const out: StoryScript[] = [...STORY_REFERENCES];
  for (const topic of STORY_STAR_TOPICS) {
    for (const lean of ['high', 'low'] as const) {
      const ref = referenceFor({ topicId: topic.id, categoryId: topic.categoryId, setting: topic.setting, lean });
      if (ref) continue;
      out.push(renderTopic(topic, lean));
    }
  }
  return out;
}

export function pickStoryTemplate(opts: {
  categoryId: CategoryId;
  setting: StoryAngle;
  lean: TraitLean;
  seenIds?: readonly string[];
  seed?: string;
  traitScore?: number | null;
}): StoryScript | null {
  const seen = opts.seenIds ?? [];
  const seed = opts.seed ?? `${opts.categoryId}|${opts.setting}|${opts.lean}`;
  const skip = new Set(bankIdsToSkip(seen, 80));

  const ref = referenceFor({ categoryId: opts.categoryId, setting: opts.setting, lean: opts.lean });
  if (ref && !skip.has(ref.id)) return ref;

  const topics = STORY_STAR_TOPICS.filter((row) => row.categoryId === opts.categoryId && row.setting === opts.setting);
  const wider = topics.length > 0 ? topics : STORY_STAR_TOPICS.filter((row) => row.setting === opts.setting);
  const pool = (wider.length > 0 ? wider : [...STORY_STAR_TOPICS]).filter((row) => {
    const id = `topic_${row.id}_${opts.lean}`;
    const refId = referenceFor({ topicId: row.id, categoryId: row.categoryId, setting: row.setting, lean: opts.lean })?.id;
    return !skip.has(id) && (!refId || !skip.has(refId));
  });
  if (pool.length > 0) {
    const topic = pool[fnv1a(seed) % pool.length]!;
    const exact = referenceFor({ topicId: topic.id, categoryId: topic.categoryId, setting: topic.setting, lean: opts.lean });
    if (exact) return exact;
    if (topic.categoryId === opts.categoryId) return renderTopic(topic, opts.lean);
    // Setting match but other category: still tell the topic, swap card6 to the reader's category.
    const script = renderTopic(topic, opts.lean);
    return {
      ...script,
      categoryId: opts.categoryId,
      card6: {
        categoryName: categoryCatalogName(opts.categoryId),
        leanPhrase: leanPhraseFor(opts.categoryId, opts.lean),
        evidence: script.card6.evidence,
        tip: keyedTip(opts.categoryId, opts.lean),
      },
    };
  }
  if (opts.setting === 'home' && OBJECT_REVOLT_CATEGORIES.includes(opts.categoryId)) {
    return renderObjectRevolt({ categoryId: opts.categoryId, lean: opts.lean, seed });
  }
  if (OBJECT_REVOLT_CATEGORIES.includes(opts.categoryId)) {
    return renderObjectRevolt({ categoryId: opts.categoryId, lean: opts.lean, seed });
  }
  const fallback = STORY_STAR_TOPICS[fnv1a(`${seed}|any`) % STORY_STAR_TOPICS.length]!;
  return renderTopic(fallback, opts.lean);
}

export function renderEveryCompatibleCombo(): StoryScript[] {
  const out: StoryScript[] = [...allTemplateScripts()];
  for (const categoryId of OBJECT_REVOLT_CATEGORIES) {
    for (const lean of ['high', 'low'] as const) {
      for (let object = 0; object < OBJECT_REVOLT_OBJECT_COUNT; object += 1) {
        for (let guest = 0; guest < OBJECT_REVOLT_GUEST_COUNT; guest += 1) {
          for (let side = 0; side < OBJECT_REVOLT_SIDE_COUNT; side += 1) {
            out.push(
              renderObjectRevolt({
                categoryId,
                lean,
                seed: `ci|${categoryId}|${lean}|${object}|${guest}|${side}`,
                grammar: revoltGrammarSlice(object, guest, side),
              }),
            );
          }
        }
      }
    }
  }
  return out;
}
