/**
 * Quests strings (PHASE-12): every fixed sentence lives here, whole, with
 * {placeholders}. Sentences are never built by concatenation.
 */
import type { Approach, Stat } from '@/lib/quests/types';

export const STAT_LABEL: Record<Stat, string> = {
  supplies: 'Supplies',
  morale: 'Morale',
  renown: 'Renown',
};

export const APPROACH_LABEL: Record<Approach, string> = {
  explore: 'Explore',
  steady: 'Hold steady',
  talk: 'Talk it out',
  act: 'Act',
  wait: 'Wait and watch',
};

/** "What your choices said" lines that score.ts verdicts map to (PHASE-13; PHASE-16 shows them). */
export const SAID_COPY = {
  contradiction: "Your story self went the other way. Fun, but we'll trust your answers.",
} as const;

/** Quests screen sentences (PHASE-16). Whole sentences with {placeholders}; the screens never join pieces. */
export const UI_COPY = {
  selectTitle: 'Quests',
  selectLead: 'Short stories where your choices do the talking.',
  modeMe: 'As me',
  modeFun: 'For fun',
  modeMeNote: 'Your choices can add a small note to your profile.',
  modeFunNote: 'Not saved. Nothing changes on your profile.',
  campaignMeta: '{minutes} min · {found} of {total} endings found',
  continueRun: 'Continue your story',
  continueMeta: 'Chapter {chapter} of {chapters}',
  startRun: 'Start',
  emptyTitle: 'No quests yet',
  emptyBody: 'New stories are on the way.',
  loading: 'Loading your story…',
  errorTitle: 'This story could not load',
  errorBody: 'Pick another quest, or come back later.',
  contentInvalid: 'Content check failed (dev only): {first}',
  close: 'Close',
  closeHint: 'Leaves the story. Your place is saved.',
  chapterOf: 'Chapter {n} of {total}',
  chapterTitle: 'Chapter {n}',
  rewindLabel: 'Rewind',
  rewindCount: 'Rewind {n}',
  rewindHint: 'Undo your last choice. One per chapter.',
  rewindNone: 'No rewind left in this chapter',
  funPill: 'For fun · not saved',
  placeholderPlate: 'PLACEHOLDER',
  tapToFinish: 'Tap to read it all',
  chooseHint: 'Double-tap and hold to choose',
  chooseAction: 'Choose',
  tapToSelect: 'Tap to pick, hold to choose',
  holdToChoose: 'Hold to choose',
  checkBadge: 'CHECK: {stat} ≥ {dc} · {odds}%',
  checkBadgeA11y: 'Check: {stat} of at least {dc}, {odds} percent',
  youChose: 'You chose',
  continue: 'Continue',
  statChange: '{stat} {dir} {n}',
  statUp: 'up',
  statDown: 'down',
  statValue: '{stat} {n} of {max}',
  d20Roll: 'You rolled {roll}',
  d20Sum: '{roll} + {stat} = {total} against {dc}',
  d20Win: 'It worked.',
  d20Lose: 'It went another way.',
  noticeRestarted: 'The story changed a little, so this chapter starts again.',
  noticeGotIt: 'Got it',
  endingOf: 'Ending {n} of {total}',
  endingFound: 'Ending found',
  saidTitle: 'What your choices said',
  saidEthics: 'This is a story, not a test. There are no wrong choices.',
  saidEvidence: '{scenes} scenes · {same} the same way',
  saidQuote: 'You kept picking “{phrase}”',
  saidConsistency: 'How steady',
  saidApply: 'Apply',
  saidNotMe: 'Not me',
  saidNotMeUndo: 'Put it back',
  saidTickFirst: 'Tick what sounds like you',
  saidSave: 'Save',
  saidDone: 'Done',
  saidNotEnough: 'Not enough to say',
  saidNotEnoughBody: 'Too little to go on: {axes}.',
  saidFunRun: 'This one was just for fun, so nothing is saved.',
  saidEvidenceWindow: 'You played this as yourself recently, so this run counts as for fun.',
  saidNothing: 'Nothing stood out enough to save this time.',
  saidMessing: 'I was messing around',
  messingTitle: 'Throw this run away?',
  messingBody: 'Nothing from it will be kept.',
  messingConfirm: 'Throw it away',
  messingKeep: 'Keep it',
  saidSaveStub: 'Saving arrives in the next update.',
} as const;

/** Limits the validator enforces (numbers, not copy). */
export const LIMITS = {
  beatWords: 45,
  labelChars: 60,
  hintChars: 30,
  maxPathScenes: 12,
  minPrimaryPerAxis: 3,
  minChaptersPerAxis: 2,
  choicesMin: 2,
  choicesMax: 4,
  targetAxesMin: 3,
  targetAxesMax: 4,
  endingsMin: 3,
  endingsMax: 4,
  statMax: 6,
  dcMin: 1,
  dcMax: 30,
} as const;

/** Validator messages (developer-facing). */
export const MSG = {
  dupScene: 'Scene id "{id}" is used twice.',
  dupChoice: 'Scene "{scene}" has two choices with id "{id}".',
  dupEnding: 'Ending id "{id}" is used twice.',
  missingFirst: 'firstScene "{id}" does not exist.',
  badRef: '{where} points to "{id}", which is not a scene.',
  badEndingArt: 'Ending "{id}" uses art "{art}", which is not in art-keys.ts.',
  badLocation: 'Scene "{scene}" uses location "{loc}", which is not in art-keys.ts.',
  badAxis: '{where} uses axis "{axis}", which is not a trait axis.',
  excludedAxis: '{where} uses axis "{axis}", which Quests may not tag.',
  targetAxesCount: 'targetAxes needs {min} to {max} axes; this has {n}.',
  startStat: 'startStats.{stat} is {n}; it must be a whole number from 0 to {max}.',
  choicesCount: 'Scene "{scene}" has {n} choices; it needs {min} to {max}.',
  tagsCount: 'Choice "{scene}/{id}" has {n} tags; it needs 0 to 2.',
  beatLong: '{where} has a beat of {n} words; the limit is {max}.',
  labelLong: 'Choice "{scene}/{id}" has a label of {n} characters; the limit is {max}.',
  hintLong: 'Choice "{scene}/{id}" has a hint of {n} characters; the limit is {max}.',
  copyBanned: '{where} contains "{hit}", which Quests copy may not use.',
  checkDc: 'Choice "{scene}/{id}" has a check difficulty of {n}; it must be {min} to {max}.',
  endingsCount: 'The campaign has {n} endings; it needs {min} to {max}.',
  endingFallback: 'The last ending "{id}" must have no conditions: it is the fallback.',
  frozenMissing: 'Frozen scene id "{id}" no longer exists.',
  retiredNoRedirect: 'Retired scene "{id}" needs a redirect to a live scene.',
  retiredBadRedirect: 'Retired scene "{id}" redirects to "{target}", which is missing or also retired.',
  primaryNoPoles: 'Primary scene "{scene}" (axis {axis}) must offer both poles; it offers only {pole}.',
  pathTooLong: 'A path reaches {n} scenes (limit {max}): {path}.',
  pathLoop: 'A path loops back to "{id}": {path}.',
  flagNeverSet: '{where} reads the flag "{flag}", which no choice ever sets.',
  tooManyPaths: 'The story has more than {max} paths; make the branches rejoin sooner.',
  keywordsMany: '{where} tints more than 2 keywords.',
  keywordMiss: '{where} tints "{kw}", which is not in the line.',
  axisCoverage: 'Axis {axis} has only {n} primary scene(s) on the path {path}; it needs {min}.',
  axisChapters: 'Axis {axis} spans {n} chapter(s) on the path {path}; it needs {min}.',
  noSkipTarget: 'Scene "{scene}" has an entry gate but no next scene to skip to.',
  ok: 'Campaign "{id}" is valid: {scenes} scenes, {paths} paths, longest {longest}.',
} as const;

export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => String(values[key] ?? `{${key}}`));
}
