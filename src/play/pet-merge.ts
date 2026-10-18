/**
 * One of each hero (pet team roadmap P1, emci 2026-10-18). Pure rules.
 *
 *   - A revealed pet (Child and up) whose hero you already keep merges into
 *     it: the copy goes into the Collection (so stars count it, exactly as
 *     before), and the kept pet takes the better grade and a shiny if either
 *     was shiny. No Hall entry, no shard — nothing left, it joined up.
 *   - Kept = the highest stage; tie → the active pet; tie → the higher grade;
 *     tie → the older (lower uid). So a new Child never replaces a grown pet.
 *   - The merged-away pet's looks are not lost: a finish moves over if the
 *     kept pet has none, worn auras are added, a name, a favourite and a
 *     glimmer carry over, and forms reached are joined.
 *   - Stage, age, meters and branch stay the kept pet's own (no mixing of
 *     clocks — the expedition and the Den freeze rules read those).
 */
import { PET_STAGES, type PetState } from '@/play/pet';
import { GRADES, gradeRank, type Grade } from '@/play/pet-eggs';
import { petRevealed } from '@/play/den';

/** "Kael joined up": shown once by the pet after an egg's duplicate merges. */
export type PetMergeNote = {
  hero: string;
  stars_from: number;
  stars_to: number;
  /** The kept pet's new grade, when the merge raised it. */
  grade_up: Grade | null;
  /** The kept pet became shiny through the merge. */
  shiny_up: boolean;
};

/** Which of two same-hero pets is kept. `activeUid` = the active pet's uid. */
export function keepFirst(a: PetState, b: PetState, activeUid: number): boolean {
  const sa = PET_STAGES.indexOf(a.stage);
  const sb = PET_STAGES.indexOf(b.stage);
  if (sa !== sb) return sa > sb;
  if ((a.uid === activeUid) !== (b.uid === activeUid)) return a.uid === activeUid;
  const ga = a.grade ? gradeRank(a.grade) : -1;
  const gb = b.grade ? gradeRank(b.grade) : -1;
  if (ga !== gb) return ga > gb;
  return a.uid <= b.uid;
}

/** The kept pet after `dropped` joins it. */
export function mergeInto(kept: PetState, dropped: PetState): PetState {
  const grade = betterGrade(kept.grade, dropped.grade);
  const shiny = kept.shiny || dropped.shiny;
  const takeFinish = kept.finish_kind === 'none' && dropped.finish_kind !== 'none';
  const auras = [...kept.auras];
  for (const a of dropped.auras) {
    if (!auras.some((k) => k.style === a.style)) auras.push(a);
  }
  return {
    ...kept,
    grade,
    shiny,
    shiny_style: kept.shiny ? kept.shiny_style : dropped.shiny ? (dropped.shiny_style ?? 'classic') : null,
    forms: [...new Set([...kept.forms, ...dropped.forms])],
    name: kept.name ?? dropped.name,
    fav: kept.fav || dropped.fav,
    glimmer: kept.glimmer || dropped.glimmer,
    finish_kind: takeFinish ? dropped.finish_kind : kept.finish_kind,
    finish_color: takeFinish ? dropped.finish_color : kept.finish_color,
    finish_sweep: takeFinish ? dropped.finish_sweep : kept.finish_sweep,
    finish_glint: takeFinish ? dropped.finish_glint : kept.finish_glint,
    auras,
  };
}

function betterGrade(a: Grade | null, b: Grade | null): Grade | null {
  if (a == null) return b;
  if (b == null) return a;
  return gradeRank(b) > gradeRank(a) ? b : a;
}

export type MergePlan = {
  /** The kept pet, merged. */
  kept: PetState;
  /** Every pet that joined it (into the Collection). */
  dropped: PetState[];
};

/** Group the revealed pets by hero; one plan per hero kept more than once.
 * Pets before Child (no hero yet) and blank slots are never touched. */
export function planMerges(pets: readonly PetState[], activeUid: number): MergePlan[] {
  const byHero = new Map<string, PetState[]>();
  for (const p of pets) {
    if (!petRevealed(p) || p.hero == null) continue;
    const list = byHero.get(p.hero) ?? [];
    list.push(p);
    byHero.set(p.hero, list);
  }
  const plans: MergePlan[] = [];
  for (const list of byHero.values()) {
    if (list.length < 2) continue;
    let keep = list[0];
    for (const p of list.slice(1)) if (keepFirst(p, keep, activeUid)) keep = p;
    const dropped = list.filter((p) => p !== keep);
    plans.push({ kept: dropped.reduce(mergeInto, keep), dropped });
  }
  return plans;
}

const GRADE_WORD: Record<Grade, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

/** What the pet says once: "Kael joined up! ★★ → ★★★ Now Epic!" */
export function mergeLine(note: PetMergeNote, name: string): string {
  let line = `${name} joined up!`;
  if (note.stars_to > note.stars_from) line += ` ${'★'.repeat(note.stars_from)} → ${'★'.repeat(note.stars_to)}`;
  if (note.grade_up && note.shiny_up) line += ` Now ${GRADE_WORD[note.grade_up]} and shiny!`;
  else if (note.grade_up) line += ` Now ${GRADE_WORD[note.grade_up]}!`;
  else if (note.shiny_up) line += ' Now shiny!';
  return line;
}

/** A stored note, or null when it is missing or not whole. */
export function parseMergeNote(raw: unknown, validHero: (id: string) => boolean): PetMergeNote | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const r = raw as Record<string, unknown>;
  const star = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(5, Math.floor(v))) : null);
  const from = star(r.stars_from);
  const to = star(r.stars_to);
  if (typeof r.hero !== 'string' || !validHero(r.hero) || from == null || to == null) return null;
  const grade = (GRADES as readonly unknown[]).includes(r.grade_up) ? (r.grade_up as Grade) : null;
  return { hero: r.hero, stars_from: from, stars_to: to, grade_up: grade, shiny_up: r.shiny_up === true };
}
