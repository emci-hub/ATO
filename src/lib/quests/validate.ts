import { QUEST_ENDING_ART_KEYS, QUEST_LOCATION_KEYS } from '@/lib/quests/art-keys';
import { questCopyHits } from '@/lib/quests/banned';
import { fmt, LIMITS, MSG } from '@/lib/quests/strings';
import { EXCLUDED_QUEST_AXES, QUEST_AXES, STATS } from '@/lib/quests/types';
import type { FlagGate, QuestCampaign, QuestScene, StoryLine } from '@/lib/quests/types';
import { TRAIT_AXES } from '@/lib/traits';

/**
 * Quests validator (PHASE-12). Pure: returns every problem found, in plain
 * sentences from strings.ts. `check:quests` runs it on the real content and on
 * the broken fixtures.
 */
export interface ValidationReport {
  errors: string[];
  paths: number;
  longest: number;
}

const MAX_PATHS = 50_000;
const TRAIT_SET: readonly string[] = TRAIT_AXES;
const QUEST_SET: readonly string[] = QUEST_AXES;
const EXCLUDED_SET: readonly string[] = EXCLUDED_QUEST_AXES;

/** The server refuses a run that carries any other id (campaign, scene, choice, ending, flag). */
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const gateOpen = (gate: FlagGate | undefined, flags: ReadonlySet<string>): boolean =>
  !gate || ((gate.flags ?? []).every((f) => flags.has(f)) && !(gate.notFlags ?? []).some((f) => flags.has(f)));

const wordsOf = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

export function validateCampaign(c: QuestCampaign): ValidationReport {
  const errors: string[] = [];
  const say = (template: string, values: Record<string, string | number> = {}) => {
    const line = fmt(template, values);
    if (!errors.includes(line)) errors.push(line);
  };

  const idCheck = (kind: string, id: string) => {
    if (!ID_PATTERN.test(id)) say(MSG.badId, { kind, id });
  };
  idCheck('campaign', c.id);

  const byId = new Map<string, QuestScene>();
  for (const s of c.scenes) {
    idCheck('scene', s.id);
    if (byId.has(s.id)) say(MSG.dupScene, { id: s.id });
    byId.set(s.id, s);
  }

  // --- axes -----------------------------------------------------------------
  const checkAxis = (axis: string, where: string) => {
    if (!TRAIT_SET.includes(axis)) say(MSG.badAxis, { where, axis });
    else if (EXCLUDED_SET.includes(axis) || !QUEST_SET.includes(axis)) say(MSG.excludedAxis, { where, axis });
  };
  if (c.targetAxes.length < LIMITS.targetAxesMin || c.targetAxes.length > LIMITS.targetAxesMax) {
    say(MSG.targetAxesCount, { min: LIMITS.targetAxesMin, max: LIMITS.targetAxesMax, n: c.targetAxes.length });
  }
  c.targetAxes.forEach((a) => checkAxis(a, 'targetAxes'));
  for (const stat of STATS) {
    const n = c.startStats[stat];
    if (!Number.isInteger(n) || n < 0 || n > LIMITS.statMax) say(MSG.startStat, { stat, n, max: LIMITS.statMax });
  }

  // --- references -----------------------------------------------------------
  const ref = (id: string | null | undefined, where: string) => {
    if (id && !byId.has(id)) say(MSG.badRef, { where, id });
  };
  if (!byId.has(c.firstScene)) say(MSG.missingFirst, { id: c.firstScene });
  for (const id of c.sceneIdsFrozen) if (!byId.has(id)) say(MSG.frozenMissing, { id });

  // --- text -----------------------------------------------------------------
  const lineCheck = (lines: StoryLine[], where: string) => {
    for (const line of lines) {
      const n = wordsOf(line.text);
      if (n > LIMITS.beatWords) say(MSG.beatLong, { where, n, max: LIMITS.beatWords });
      for (const hit of questCopyHits(line.text)) say(MSG.copyBanned, { where, hit });
      if ((line.keywords?.length ?? 0) > 2) say(MSG.keywordsMany, { where });
      for (const kw of line.keywords ?? []) {
        if (!line.text.toLowerCase().includes(kw.toLowerCase())) say(MSG.keywordMiss, { where, kw });
      }
    }
  };
  for (const hit of questCopyHits(c.title)) say(MSG.copyBanned, { where: 'the campaign title', hit });

  for (const s of c.scenes) {
    if (s.retired) {
      const target = s.redirect ? byId.get(s.redirect) : undefined;
      if (!s.redirect) say(MSG.retiredNoRedirect, { id: s.id });
      else if (!target || target.retired) say(MSG.retiredBadRedirect, { id: s.id, target: s.redirect });
      continue;
    }
    if (!QUEST_LOCATION_KEYS.includes(s.art.location)) say(MSG.badLocation, { scene: s.id, loc: s.art.location });
    ref(s.next, `Scene "${s.id}" next`);
    if (s.requires && s.next === null) say(MSG.noSkipTarget, { scene: s.id });
    lineCheck(s.lines, `Scene "${s.id}"`);
    s.variants?.forEach((v, i) => lineCheck(v.lines, `Scene "${s.id}" variant ${i + 1}`));
    if (s.primaryAxis) checkAxis(s.primaryAxis, `Scene "${s.id}" primaryAxis`);

    if (s.choices.length < LIMITS.choicesMin || s.choices.length > LIMITS.choicesMax) {
      say(MSG.choicesCount, { scene: s.id, n: s.choices.length, min: LIMITS.choicesMin, max: LIMITS.choicesMax });
    }
    const seen = new Set<string>();
    for (const ch of s.choices) {
      const where = `Choice "${s.id}/${ch.id}"`;
      idCheck('choice', ch.id);
      if (seen.has(ch.id)) say(MSG.dupChoice, { scene: s.id, id: ch.id });
      seen.add(ch.id);
      if (ch.label.length > LIMITS.labelChars) say(MSG.labelLong, { scene: s.id, id: ch.id, n: ch.label.length, max: LIMITS.labelChars });
      for (const hit of questCopyHits(ch.label)) say(MSG.copyBanned, { where: `${where} label`, hit });
      if (ch.hint) {
        if (ch.hint.length > LIMITS.hintChars) say(MSG.hintLong, { scene: s.id, id: ch.id, n: ch.hint.length, max: LIMITS.hintChars });
        for (const hit of questCopyHits(ch.hint)) say(MSG.copyBanned, { where: `${where} hint`, hit });
      }
      lineCheck(ch.result, where);
      if (ch.tags.length > 2) say(MSG.tagsCount, { scene: s.id, id: ch.id, n: ch.tags.length });
      ch.tags.forEach((t) => checkAxis(t.axis, where));
      ref(ch.next, `${where} next`);
      if (ch.check) {
        ref(ch.check.success, `${where} success`);
        ref(ch.check.fail, `${where} fail`);
        const { dc } = ch.check;
        if (!Number.isInteger(dc) || dc < LIMITS.dcMin || dc > LIMITS.dcMax) {
          say(MSG.checkDc, { scene: s.id, id: ch.id, n: dc, min: LIMITS.dcMin, max: LIMITS.dcMax });
        }
      }
    }

    if (s.primaryAxis) {
      const poles = new Set(s.choices.flatMap((ch) => ch.tags.filter((t) => t.axis === s.primaryAxis).map((t) => t.pole)));
      if (poles.size < 2) say(MSG.primaryNoPoles, { scene: s.id, axis: s.primaryAxis, pole: poles.has(1) ? '+1' : poles.has(-1) ? '-1' : 'neither' });
    }
  }

  // --- endings --------------------------------------------------------------
  if (c.endings.length < LIMITS.endingsMin || c.endings.length > LIMITS.endingsMax) {
    say(MSG.endingsCount, { n: c.endings.length, min: LIMITS.endingsMin, max: LIMITS.endingsMax });
  }
  const endingIds = new Set<string>();
  for (const e of c.endings) {
    if (endingIds.has(e.id)) say(MSG.dupEnding, { id: e.id });
    endingIds.add(e.id);
    idCheck('ending', e.id);
    if (!QUEST_ENDING_ART_KEYS.includes(e.art)) say(MSG.badEndingArt, { id: e.id, art: e.art });
    lineCheck(e.lines, `Ending "${e.id}"`);
    for (const hit of questCopyHits(e.title)) say(MSG.copyBanned, { where: `Ending "${e.id}" title`, hit });
  }
  const last = c.endings[c.endings.length - 1];
  if (last) {
    const w = last.when;
    if ((w.flags?.length ?? 0) > 0 || (w.notFlags?.length ?? 0) > 0 || Object.keys(w.minStat ?? {}).length > 0) {
      say(MSG.endingFallback, { id: last.id });
    }
  }

  // --- flags: every flag that is read must be set by some choice ---------------
  const setFlags = new Set(c.scenes.flatMap((s) => s.choices.flatMap((ch) => ch.setFlags ?? [])));
  setFlags.forEach((f) => idCheck('flag', f));
  const readFlag = (flag: string, where: string) => {
    if (!setFlags.has(flag)) say(MSG.flagNeverSet, { where, flag });
  };
  const readGate = (gate: FlagGate | undefined, where: string) => {
    gate?.flags?.forEach((f) => readFlag(f, where));
    gate?.notFlags?.forEach((f) => readFlag(f, where));
  };
  for (const s of c.scenes) {
    if (s.retired) continue;
    readGate(s.requires, `Scene "${s.id}"`);
    s.variants?.forEach((v, i) => readGate(v.requires, `Scene "${s.id}" variant ${i + 1}`));
  }
  for (const e of c.endings) readGate(e.when, `Ending "${e.id}"`);

  // --- paths (both branches of every check; flags decide gates) --------------
  let paths = 0;
  let longest = 0;
  const resolve = (id: string): QuestScene | undefined => {
    let s = byId.get(id);
    for (let hops = 0; s?.retired && s.redirect && hops < 5; hops += 1) s = byId.get(s.redirect);
    return s?.retired ? undefined : s;
  };
  const flagged = new Set<string>();
  const walk = (id: string | null, flags: ReadonlySet<string>, trail: string[], skipped: string[] = []): void => {
    if (paths > MAX_PATHS) return;
    if (id === null) {
      paths += 1;
      longest = Math.max(longest, trail.length);
      for (const axis of c.targetAxes) {
        const prim = trail.map((t) => byId.get(t)).filter((s): s is QuestScene => !!s && s.primaryAxis === axis);
        const key = `${axis}`;
        if (c.isSample || flagged.has(key)) continue;
        if (prim.length < LIMITS.minPrimaryPerAxis) {
          flagged.add(key);
          say(MSG.axisCoverage, { axis, n: prim.length, min: LIMITS.minPrimaryPerAxis, path: trail.join(' > ') });
        } else if (new Set(prim.map((s) => s.chapter)).size < LIMITS.minChaptersPerAxis) {
          flagged.add(key);
          say(MSG.axisChapters, { axis, n: new Set(prim.map((s) => s.chapter)).size, min: LIMITS.minChaptersPerAxis, path: trail.join(' > ') });
        }
      }
      return;
    }
    const scene = resolve(id);
    if (!scene) return; // a missing id is reported by the reference check
    if (trail.includes(scene.id)) {
      say(MSG.pathLoop, { id: scene.id, path: [...trail, scene.id].join(' > ') });
      return;
    }
    if (!gateOpen(scene.requires, flags)) {
      if (skipped.includes(scene.id)) {
        say(MSG.pathLoop, { id: scene.id, path: [...trail, ...skipped, scene.id].join(' > ') });
        return;
      }
      walk(scene.next, flags, trail, [...skipped, scene.id]);
      return;
    }
    const next = [...trail, scene.id];
    if (next.length > LIMITS.maxPathScenes) {
      say(MSG.pathTooLong, { n: next.length, max: LIMITS.maxPathScenes, path: next.join(' > ') });
      return;
    }
    // Choices that lead to the same scene with the same flags make identical paths: walk each once.
    const branches = new Map<string, { target: string | null; after: Set<string> }>();
    for (const ch of scene.choices) {
      const after = new Set(flags);
      ch.setFlags?.forEach((f) => after.add(f));
      const targets = ch.check ? [ch.check.success, ch.check.fail] : [ch.next ?? scene.next];
      for (const target of targets) branches.set(`${target}|${[...after].sort().join(',')}`, { target, after });
    }
    for (const { target, after } of branches.values()) walk(target, after, next);
  };
  if (byId.has(c.firstScene)) walk(c.firstScene, new Set(), []);
  if (paths > MAX_PATHS) say(MSG.tooManyPaths, { max: MAX_PATHS });

  return { errors, paths, longest };
}
