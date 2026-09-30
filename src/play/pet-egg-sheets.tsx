/**
 * Egg sheets (2026-09-30) — the egg picker, the live / final odds, Release,
 * the Collection (16 heroes × 4 grades) with shards + Trade up, the Hall as
 * cards, the 3★ dye, and "How eggs work". Every odds number here comes from
 * `gradeOdds` / `heroOdds` — the same functions the roll uses.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { heroName } from '@/play/heroes-data';
import { NeonButton, NeonChip, NeonLabel } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { newPet, type PetState } from '@/play/pet';
import { PetCard } from '@/play/pet-card';
import {
  CARE_BANDS,
  CARE_BAND_LABEL,
  CARE_BAND_MIN,
  CARE_SKILL_SHARE,
  DYE_STARS,
  EGG_BLURB,
  EGG_COLOR,
  EGG_EMOJI,
  EGG_LABEL,
  EGG_POOLS,
  EGG_TYPES,
  GRADES,
  GRADE_COLOR,
  GRADE_LABEL,
  SHARDS_PER_TICKET,
  bestGrade,
  gradeOdds,
  gradeTag,
  gradedName,
  heroOdds,
  heroStars,
  nextGrade,
  type EggType,
  type Grade,
} from '@/play/pet-eggs';
import { EggShape, PetFigure } from '@/play/pet-figure';
import {
  chooseEggDoc,
  claimMilestone,
  releasePetDoc,
  setHeroDye,
  tradeUpShards,
  type PlayView,
} from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

type Commit = (transition: PlayTransition) => boolean;

const ARM_LAPSE_MS = 3500;

function pct(n: number): string {
  if (n === 0) return '0%';
  return `${Number(n.toFixed(n < 10 ? 1 : 0))}%`;
}

/** One row of the grade table (Common … Legendary with their %). */
export function GradeRow({ odds, label }: { odds: Record<Grade, number>; label?: string }) {
  return (
    <View style={styles.gradeRow}>
      {label ? <Text style={styles.rowLabel}>{label}</Text> : null}
      {GRADES.map((g) => (
        <View key={g} style={[styles.gradeChip, { borderColor: GRADE_COLOR[g], opacity: odds[g] > 0 ? 1 : 0.35 }]}>
          <Text style={[styles.gradeChipText, { color: GRADE_COLOR[g] }]}>
            {gradeTag(g)} {pct(odds[g])}
          </Text>
        </View>
      ))}
    </View>
  );
}

function HeroOddsLine({ egg }: { egg: EggType }) {
  const odds = heroOdds(egg);
  return (
    <Text style={styles.body}>
      Hero — even chance among {odds.length} ({pct(odds[0].pct)} each):{' '}
      {odds.map((o) => heroName(o.hero)).join(', ')}.
    </Text>
  );
}

/* ---------------------------------------------------------- the picker --- */

/** Choose an egg: its hero pool, the grade table at every care band, and
 * an optional trade-up ticket. */
export function EggPickerBody({
  view,
  commit,
  onChosen,
  first = null,
}: {
  view: PlayView;
  commit: Commit;
  onChosen: () => void;
  /** The egg tapped in the room, shown first. */
  first?: EggType | null;
}) {
  const [ticket, setTicket] = useState<Grade | null>(null);
  const tickets = GRADES.filter((g) => g !== 'common' && view.pet.tickets[g] > 0);
  const choose = (egg: EggType) => {
    const ok = commit((doc, now) => chooseEggDoc(doc, now, egg, ticket));
    if (ok) onChosen();
  };
  return (
    <>
      <Text style={styles.body}>
        Pick an egg. Its hero is an even chance from that egg’s pool; its grade is rolled when it becomes a
        Child (15 min) — keep the egg warm and care for the Baby to raise the odds.
      </Text>
      {tickets.length > 0 ? (
        <>
          <NeonLabel>Trade-up tickets</NeonLabel>
          <View style={styles.chips}>
            <NeonChip label="No ticket" selected={ticket == null} onPress={() => setTicket(null)} />
            {tickets.map((g) => (
              <NeonChip
                key={g}
                label={`${gradeTag(g)}+ ticket ×${view.pet.tickets[g]}`}
                selected={ticket === g}
                onPress={() => setTicket(g)}
              />
            ))}
          </View>
        </>
      ) : null}
      {[...EGG_TYPES].sort((a, b) => (a === first ? -1 : b === first ? 1 : 0)).map((egg) => (
        <View key={egg} style={styles.eggPanel}>
          <View style={styles.eggHead}>
            <EggShape size={44} color={EGG_COLOR[egg]} />
            <View style={styles.flex}>
              <Text style={styles.eggTitle}>
                {EGG_EMOJI[egg]} {EGG_LABEL[egg]} egg
              </Text>
              <Text style={styles.body}>{EGG_BLURB[egg]}</Text>
            </View>
          </View>
          <HeroOddsLine egg={egg} />
          <Text style={styles.body}>Grade by care{ticket ? ` (with a ${GRADE_LABEL[ticket]}+ ticket)` : ''}:</Text>
          {CARE_BANDS.map((band) => (
            <GradeRow key={band} label={CARE_BAND_LABEL[band]} odds={gradeOdds(band, ticket)} />
          ))}
          <NeonButton label={`Choose the ${EGG_LABEL[egg]} egg`} onPress={() => choose(egg)} />
        </View>
      ))}
    </>
  );
}

/* ------------------------------------------------------------ the odds --- */

/** "Your odds right now" during Egg/Baby; "Final odds" from Child. */
export function OddsPanel({ view }: { view: PlayView }) {
  const pv = view.pet;
  const pet = pv.state;
  if (pet.egg == null && pet.hero == null) return null;
  if (pv.oddsOpen && pet.egg) {
    return (
      <>
        <NeonLabel>Your odds right now</NeonLabel>
        <Text style={styles.body}>
          Care {CARE_BAND_LABEL[pv.careBand]} · {pv.careScore}/100. Warm egg (up to 50) + a skilled Baby round
          (25) + feeding, training and diving (5 each). Locks at Child.
        </Text>
        <HeroOddsLine egg={pet.egg} />
        <GradeRow odds={pv.gradeOdds} />
        {pet.ticket ? <Text style={styles.body}>Ticket: {GRADE_LABEL[pet.ticket]} or better, guaranteed.</Text> : null}
      </>
    );
  }
  if (pet.hero) {
    return (
      <>
        <NeonLabel>Final odds</NeonLabel>
        {pet.band && pet.egg ? (
          <>
            <Text style={styles.body}>Care {CARE_BAND_LABEL[pet.band]} — locked at Child.</Text>
            <HeroOddsLine egg={pet.egg} />
            <GradeRow odds={pv.gradeOdds} />
          </>
        ) : (
          <Text style={styles.body}>This pet is from before eggs — it counts as Common.</Text>
        )}
        <Text style={[styles.result, { color: GRADE_COLOR[pet.grade ?? 'common'] }]}>
          Rolled: {gradedName(pet.grade, pet.name ?? heroName(pet.hero))} · {gradeTag(pet.grade ?? 'common')}
          {pet.shiny ? ' · ✨ shiny' : ''}
        </Text>
      </>
    );
  }
  return null;
}

/* ------------------------------------------------------------- release --- */

export function ReleasePanel({ view, commit }: { view: PlayView; commit: Commit }) {
  const pv = view.pet;
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), ARM_LAPSE_MS);
    return () => clearTimeout(id);
  }, [armed]);
  if (pv.state.stage === 'egg' || pv.state.stage === 'baby') return null;
  const grade = pv.state.grade ?? 'common';
  return (
    <>
      <NeonLabel>Release</NeonLabel>
      <Text style={styles.body}>
        Sends it to the Hall and the Collection, leaves 1 {GRADE_LABEL[grade]} shard, gives no rebirth bonus,
        and you pick a new egg.{pv.state.stage === 'god' ? ' At God, Rebirth gives +2% TD damage instead.' : ''}
      </Text>
      {pv.away ? (
        <Text style={styles.body}>It’s away on an expedition — release once it’s back.</Text>
      ) : (
        <NeonButton
          label={armed ? `Tap again · release (1 ${GRADE_LABEL[grade]} shard)` : 'Release to the Hall'}
          variant={armed ? 'danger' : 'secondary'}
          onPress={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            commit((doc, now) => releasePetDoc(doc, now));
          }}
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------- collection --- */

function heroSample(hero: string, grade: Grade): PetState {
  return { ...newPet(0), stage: 'teen', line: `solo_${hero}`, hero, grade };
}

export function CollectionPanel({
  view,
  commit,
  eggColor,
}: {
  view: PlayView;
  commit: Commit;
  eggColor: string;
}) {
  const book = view.pet.heroes;
  const shards = view.pet.shards;
  const found = GRADES.reduce((n, g) => n + EGG_TYPES.flatMap((e) => EGG_POOLS[e]).filter((h) => book[h]?.grades.includes(g)).length, 0);
  return (
    <>
      <NeonLabel>Shards · trade up</NeonLabel>
      <Text style={styles.body}>
        Released and reborn pets leave a shard of their grade. {SHARDS_PER_TICKET} of a grade trade for a ticket
        that guarantees the next grade or better on your next egg.
      </Text>
      {GRADES.map((g) => {
        const up = nextGrade(g);
        return (
          <View key={g} style={styles.shardRow}>
            <Text style={[styles.shardText, { color: GRADE_COLOR[g] }]}>
              {gradeTag(g)} {shards[g]}/{SHARDS_PER_TICKET}
            </Text>
            {up ? (
              <NeonChip
                label={`Trade up → ${GRADE_LABEL[up]}+`}
                selected={shards[g] >= SHARDS_PER_TICKET}
                onPress={() => commit((doc) => tradeUpShards(doc, g))}
              />
            ) : (
              <Text style={styles.body}>Top grade</Text>
            )}
          </View>
        );
      })}
      <NeonLabel>
        Collection · {found}/{EGG_TYPES.flatMap((e) => EGG_POOLS[e]).length * GRADES.length}
      </NeonLabel>
      <Text style={styles.body}>
        Every hero in every grade. Stars = copies (max 5, the dye at 3★). Missing cards are silhouettes.
      </Text>
      {EGG_TYPES.flatMap((egg) =>
        EGG_POOLS[egg].map((hero) => {
          const rec = book[hero];
          const stars = heroStars(rec?.copies ?? 0);
          const best = bestGrade(rec);
          return (
            <View key={hero} style={styles.heroBlock}>
              <Text style={styles.heroTitle}>
                {EGG_EMOJI[egg]} {heroName(hero)} · {'★'.repeat(stars)}
                {'☆'.repeat(5 - stars)}
                {rec?.shinies ? ` · ✨×${rec.shinies}` : ''}
                {best ? ` · best ${gradeTag(best)}` : ''}
              </Text>
              {rec?.forms.length ? (
                <Text style={styles.body}>Forms: {rec.forms.map((f) => f.charAt(0).toUpperCase() + f.slice(1)).join(' · ')}</Text>
              ) : null}
              <View style={styles.cardRow}>
                {GRADES.map((g) => {
                  const has = rec?.grades.includes(g) ?? false;
                  return (
                    <PetCard
                      key={g}
                      width={70}
                      animate={false}
                      silhouette={!has}
                      info={{ name: heroName(hero), grade: g, shiny: false, stars, egg, forms: [], band: null, days: null, dye: false }}
                      sprite={<PetFigure pet={heroSample(hero, g)} baseBox={44} eggColor={eggColor} silhouette={!has} />}
                    />
                  );
                })}
              </View>
            </View>
          );
        }),
      )}
    </>
  );
}

/* ---------------------------------------------------------------- hall --- */

export function HallCards({ view, eggColor }: { view: PlayView; eggColor: string }) {
  const hall = view.pet.hall;
  if (hall.length === 0) return <Text style={styles.body}>Empty for now — pets join after a release or a rebirth.</Text>;
  return (
    <>
      <Text style={styles.body}>
        Up to 60. When full, the oldest Common goes first, then Rare, then Epic — Legendary and shiny pets are
        pinned 📌 and never leave.
      </Text>
      <View style={styles.hallGrid}>
        {[...hall].reverse().map((entry, i) => {
          const hero = entry.hero;
          const name = entry.name ?? (hero ? heroName(hero) : 'Pet');
          const pinned = entry.grade === 'legendary' || entry.shiny;
          return (
            <View key={`${entry.rebirth}-${i}`}>
              <PetCard
                width={96}
                animate={false}
                info={{
                  name,
                  grade: entry.grade,
                  shiny: entry.shiny,
                  stars: heroStars(view.pet.heroes[hero ?? '']?.copies ?? 0),
                  egg: entry.egg,
                  forms: [entry.branch],
                  band: null,
                  days: entry.days,
                  dye: false,
                }}
                sprite={
                  hero ? (
                    <PetFigure pet={{ ...heroSample(hero, entry.grade), branch: entry.branch }} baseBox={56} eggColor={eggColor} />
                  ) : null
                }
              />
              <Text style={styles.hallMeta}>
                {pinned ? '📌 ' : ''}
                {entry.released ? 'Released' : `Rebirth #${entry.rebirth}`} · {entry.days}d
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

/* ----------------------------------------------------------------- dye --- */

export function DyePanel({ view, commit }: { view: PlayView; commit: Commit }) {
  const pet = view.pet.state;
  const hero = pet.hero;
  if (!hero || pet.stage === 'egg' || pet.stage === 'baby') return null;
  const rec = view.pet.heroes[hero];
  const stars = heroStars(rec?.copies ?? 0);
  return (
    <>
      <NeonLabel>{heroName(hero)}’s dye</NeonLabel>
      {pet.shiny ? (
        <Text style={styles.body}>✨ Shiny pets keep their own colour — no dye or tint shows on them.</Text>
      ) : stars >= DYE_STARS ? (
        <NeonChip
          label={rec?.dye ? 'Dye on · tap to take off' : `Wear ${heroName(hero)}’s dye`}
          selected={rec?.dye ?? false}
          onPress={() => commit((doc, now) => setHeroDye(doc, now, hero, !(rec?.dye ?? false)))}
        />
      ) : (
        <Text style={styles.body}>
          Unlocks at {DYE_STARS}★ — hatch {heroName(hero)} again to add stars ({stars}/{DYE_STARS}).
        </Text>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- help --- */

export function EggHelp() {
  return (
    <>
      <NeonLabel>How eggs work</NeonLabel>
      {EGG_TYPES.map((egg) => (
        <Text key={egg} style={styles.body}>
          • {EGG_EMOJI[egg]} {EGG_LABEL[egg]} egg: {EGG_POOLS[egg].map((h) => heroName(h)).join(', ')} — an even
          chance each.
        </Text>
      ))}
      <Text style={styles.body}>
        • Timeline: the egg hatches in 5 min, the Baby (its egg’s creep) reveals its hero at 15 min. Then Child
        36h → Teen 72h → Adult 120h → God, as before.
      </Text>
      <Text style={styles.body}>
        • Grade (looks only — never a stat): Common grey ★, Rare blue ★★, Epic purple ★★★, Legendary gold ★★★★.
        It’s rolled for each pet at Child, from the care band:
      </Text>
      {CARE_BANDS.map((band) => (
        <GradeRow key={band} label={`${CARE_BAND_LABEL[band]} ${CARE_BAND_MIN[band]}+`} odds={gradeOdds(band)} />
      ))}
      <Text style={styles.body}>
        • Care score (0-100): the egg’s warmth up to 50 (it loses a pip every 90s — tap to warm it; time away
        counts, so leaving the app lets it go cold), a skilled Baby round 25 (a mini-game passed with
        {Math.round(CARE_SKILL_SHARE * 100)}%+; any other pass 12, a fail 0), and 5 each for feeding, training and diving.
        Perfect needs warmth AND skill — tapping alone tops out at Great.
      </Text>
      <Text style={styles.body}>
        • The roll is fixed: a seed is saved when you pick the egg, and the hero, grade and shiny are decided once
        at Child. Reopening the app or changing the clock never changes them. The odds shown are the real ones.
      </Text>
      <Text style={styles.body}>• Shiny: 1 in 50, any hero, any grade — its own colours, sparkles and a gold ring.</Text>
      <Text style={styles.body}>
        • Stars: every copy of a hero adds a star to its Collection card, up to 5★. 3★ unlocks that hero’s dye
        (Style); 5★ gets a special frame. Stars are looks only.
      </Text>
      <Text style={styles.body}>
        • Shards: Release (Child and up) or Rebirth (God) leaves 1 shard of the pet’s grade. {SHARDS_PER_TICKET} of a
        grade → a ticket for the next grade or better on your next egg (the hero is still an even chance). Worst
        case to a Legendary ticket: 125 Commons.
      </Text>
      <Text style={styles.body}>
        • Release vs Rebirth: Release sends the pet to the Hall with no bonus; Rebirth at God adds +2% TD damage
        for good (max +10%). Both go back to the egg picker. An Egg or Baby can’t be released.
      </Text>
      <Text style={styles.body}>
        • Hall: up to 60 pets; when full the oldest Common goes first, then Rare, then Epic. Legendary and shiny
        pets are pinned and never leave.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
  result: { fontFamily: Fonts.monoBold, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flex: 1 },
  gradeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  rowLabel: { fontFamily: Fonts.monoBold, fontSize: 11, color: NEON.textPrimary, width: 76 },
  gradeChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  gradeChipText: { fontFamily: Fonts.monoBold, fontSize: 10 },
  eggPanel: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    backgroundColor: 'rgba(5, 7, 13, 0.6)',
  },
  eggHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eggTitle: { fontFamily: Fonts.displayBold, fontSize: 16, color: NEON.textPrimary, textTransform: 'uppercase' },
  shardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shardText: { fontFamily: Fonts.monoBold, fontSize: 13 },
  heroBlock: { gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: NEON.cyanDim },
  heroTitle: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.textPrimary },
  cardRow: { flexDirection: 'row', gap: 6 },
  hallGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statValue: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.textPrimary, flexShrink: 1, textAlign: 'right' },
  hallMeta: { fontFamily: Fonts.mono, fontSize: 9, color: NEON.textMuted, textAlign: 'center', marginTop: 2, width: 96 },
});

/* ------------------------------------------------------------- journal --- */

/** Info → Journal: lifetime numbers and milestones (with Claim). Counted
 * from v24 on, except TD waves and rebirths, which were always kept. */
export function JournalTab({ view, commit }: { view: PlayView; commit: Commit }) {
  const st = view.stats;
  const legends = st.pulled.legendary;
  const rows: [string, string | number][] = [
    ['Eggs hatched', st.eggs_hatched],
    ['Grades pulled', GRADES.map((g) => `${gradeTag(g)} ${st.pulled[g]}`).join(' · ')],
    ['Legendaries', legends],
    ['Shinies', st.shinies],
    ['Dives', st.dives],
    ['Surfaced · busts', `${st.surfaces} · ${st.busts}`],
    ['Best depth', st.best_depth],
    ['Expeditions', st.expeditions],
    ['Released · reborn', `${st.releases} · ${view.pet.rebirths}`],
    ['TD waves cleared', view.lifetimeWavesCleared],
    ['Days played', st.days_played],
  ];
  return (
    <>
      <Text style={styles.body}>Counted from this update on (TD waves and rebirths include everything before).</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.statRow}>
          <Text style={styles.body}>{label}</Text>
          <Text style={styles.statValue}>{value}</Text>
        </View>
      ))}
      <NeonLabel>Milestones</NeonLabel>
      <Text style={styles.body}>Small rewards for your Collection — looks and egg tickets only, never TD power.</Text>
      {view.milestones.map(({ def, done, claimed }) => (
        <View key={def.id} style={styles.statRow}>
          <View style={styles.flex}>
            <Text style={styles.heroTitle}>
              {claimed ? '✅ ' : done ? '🎁 ' : '▫️ '}
              {def.label}
            </Text>
            <Text style={styles.body}>{def.rewardLabel}</Text>
          </View>
          {done && !claimed ? (
            <NeonChip label="Claim" selected onPress={() => commit((doc, now) => claimMilestone(doc, now, def.id))} />
          ) : null}
        </View>
      ))}
      {view.ribbons.length > 0 ? (
        <Text style={styles.body}>Ribbons: {view.ribbons.map((r) => (r === 'collector' ? '🎖 Collector' : '🏅 Legend')).join(' · ')}</Text>
      ) : null}
    </>
  );
}
