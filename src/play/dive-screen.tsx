/**
 * Dive — push-your-luck (Play step 3, GAME_SPEC §7, §11 screen 2).
 *
 * Overhaul (2026-09-29): the scene IS the screen (`dive-scene.tsx`) — its top
 * bar shows the zone, a depth meter, charges and shells; the haul is one row
 * of item icons along the bottom of the scene with a rarity glow. Under it,
 * one compact control strip: Deeper (Safer / Richer, each with its exact %)
 * and Surface, or Dive / Free dive. The buddy explanation and the odds text
 * live in the Info sheet, the gear shop in the Gear sheet. No stacked cards.
 * Dive opens from the Pet room; back closes a sheet, then returns there.
 *
 * Unchanged rules: every mutation goes through the callbacks (store truth);
 * actions are paced by `usePacedAction` (beat → resolve → cooldown); Deeper
 * sends the % on screen so the store refuses a roll whose odds moved. The
 * scene only reads the SHOWN % and never delays an action.
 *
 * Copy never uses gamble / casino / jackpot / bet — Dive / Surface / Deeper /
 * bust only (GAME_SPEC §7).
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { usePacedAction } from '@/play/action-pacing';
import {
  DIVE_GEAR,
  DIVE_GEAR_BLURB,
  DIVE_GEAR_COST,
  DIVE_GEAR_LABEL,
  POWER_OVERFLOW_SHELLS,
  findName,
  type DiveGear,
  type DivePath,
} from '@/play/dive-loot';
import { diveButtons, type DiveButton } from '@/play/dive-buttons';
import { useDiveFxLevel } from '@/play/dive-fx-level';
import { findGlow } from '@/play/dive-fx-model';
import { DiveTopBar } from '@/play/dive-hud';
import { DiveScene, diveZone, type DiveReveal, type DiveSceneEvent } from '@/play/dive-scene';
import { diveBackStep, type InnerBack } from '@/play/edge-back';
import { ELEMENT_COLOR } from '@/play/kits';
import { NeonLabel } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { PET_BRANCH_LABEL, PET_STAGE_LABEL } from '@/play/pet';
import { petRecolor } from '@/play/pet-looks';
import { PlaySheet } from '@/play/play-sheet';
import { DIVE_CHARGE_CAP, buyDiveGear, type PlayView } from '@/play/playStore';
import { todayPlan } from '@/play/today-plan';
import { GuideView } from '@/play/guide-sheet';
import { stagePowerLine } from '@/play/guide-content';
import { BUFF_ICON, SNACK_BUST_PP } from '@/play/play-buffs';
import type { PlayTransition } from '@/play/use-play-store';

/** The pet dive buddy, in one honest line (v20; away + Dive care in v21). */
export function diveBuddyLine(view: PlayView): string {
  const pet = view.pet;
  const st = pet.state;
  if (view.diveRun.active && view.diveRun.free && !pet.away) {
    return 'Free dive: your pet comes along for the fun (+2 mood on a surface, +1 on a bust) — there is nothing to rescue, and it never counts toward the Deep form.';
  }
  if (pet.away) {
    return 'Dive buddy: away on expedition — no bust cut or rescue until it’s back, and these dives don’t count as its care.';
  }
  const form =
    st.stage === 'egg' || st.stage === 'baby'
      ? PET_STAGE_LABEL[st.stage]
      : `${PET_STAGE_LABEL[st.stage]} · ${PET_BRANCH_LABEL[st.branch]}`;
  if (st.stage === 'egg') {
    return `Dive buddy: your pet (${form}) — once it hatches, surfacing gives it +2 mood; from Teen it lowers every bust chance.`;
  }
  const care = 'Surfacing gives it +2 mood, a bust +1.';
  if (pet.bustCutPp <= 0) {
    return `Dive buddy: your pet (${form}). ${care} From Teen it lowers every bust chance.`;
  }
  const rescue =
    pet.rescueKeep > 0
      ? ` · on a bust it saves your best ${pet.rescueKeep === 1 ? 'find' : `${pet.rescueKeep} finds`}`
      : ' · from Adult it saves your best find on a bust';
  const points = `${pet.bustCutPp} ${pet.bustCutPp === 1 ? 'point' : 'points'}`;
  return `Dive buddy: your pet (${form}) · ${points} off every bust chance (already in the odds; never below half the table)${rescue}. ${care} It is never lost.`;
}

export type DiveSurfaceSummary = { finds: number; shells: number; ids: readonly string[] };
/** A Deeper's result — `rescued` = the finds the pet saved on a bust. */
export type DiveDeeperResult = { outcome: 'bust' | 'safe' | 'changed'; rescued: readonly string[] } | null;

/** The haul minus the saved finds (one each, duplicates respected). */
function lostFinds(haul: readonly string[], saved: readonly string[]): string[] {
  const left = [...saved];
  return haul.filter((id) => {
    const i = left.indexOf(id);
    if (i < 0) return true;
    left.splice(i, 1);
    return false;
  });
}

type SheetId = 'info' | 'gear';

export function DiveScreen({
  view,
  skipDelays,
  reduceMotion,
  onSpendCharge,
  onFreeDive,
  onSurface,
  onDeeper,
  onBack,
  registerBack,
  commit,
}: {
  view: PlayView;
  /** Dev kit only — resolve every action instantly (no beat, no cooldown). */
  skipDelays: boolean;
  reduceMotion: boolean;
  onSpendCharge: () => Promise<boolean>;
  /** v22 — a free dive (no charges left). */
  onFreeDive: () => Promise<boolean>;
  onSurface: () => Promise<DiveSurfaceSummary | null>;
  /** `shownPct` = the bust % on screen for that path when Deeper was pressed. */
  onDeeper: (path: DivePath, shownPct: number | null) => Promise<DiveDeeperResult>;
  /** Back to the Pet room. */
  onBack: () => void;
  /** Back one level (edge-back.ts): an open sheet closes first. */
  registerBack?: (inner: InnerBack | null) => void;
  /** v22 — Dive-gear purchases go straight through the store. */
  commit: (transition: PlayTransition) => boolean;
}) {
  const charges = view.dive.current;
  const run = view.diveRun;
  const canSpend = !run.active && charges >= 1;
  const today = todayPlan(view);
  const fxLevel = useDiveFxLevel();
  const [sheet, setSheet] = useState<SheetId | null>(null);

  useEffect(() => {
    if (!registerBack) return;
    registerBack({
      edgeSwipe: true,
      back: () => {
        if (diveBackStep(sheet != null) === 'room') return false;
        setSheet(null);
        return true;
      },
    });
    return () => registerBack(null);
  }, [registerBack, sheet]);

  // -- Pacing (shared with Merge: beat → resolve → cooldown; skip in dev) ----
  const { act, busy, splashCopy, showSplash } = usePacedAction(skipDelays);

  // -- Scene events: surface / bust play once, straight from the result.
  const [sceneEvent, setSceneEvent] = useState<DiveSceneEvent>(null);
  // Keys only ever go up (a new dive clears the event), so the scene replays
  // every surface / bust, not just the first.
  const eventSeq = useRef(0);
  const bump = (event: Omit<NonNullable<DiveSceneEvent>, 'key'>) => {
    eventSeq.current += 1;
    setSceneEvent({ ...event, key: eventSeq.current });
  };

  // -- A find joined the haul → reveal it (rises from the pet into its slot).
  const [reveal, setReveal] = useState<DiveReveal>(null);
  const prevLen = useRef(run.haul.length);
  useEffect(() => {
    const len = run.active ? run.haul.length : 0;
    if (len > prevLen.current && len > 0) {
      const id = run.haul[len - 1];
      setReveal((prev) => ({ id, key: (prev?.key ?? 0) + 1, glow: findGlow(id), slot: len - 1 }));
    }
    prevLen.current = len;
  }, [run.active, run.haul]);

  const startWith = (label: string, start: () => Promise<boolean>) =>
    act(label, async () => {
      const ok = await start();
      if (ok) setSceneEvent(null);
      return ok;
    });
  const pressDeeper = (path: DivePath) => {
    const shown = run.bustPct ? run.bustPct[path] : null;
    const before = [...run.haul];
    act('Going deeper…', async () => {
      const result = await onDeeper(path, shown);
      if (result?.outcome === 'bust') {
        bump({
          kind: 'bust',
          finds: 0,
          shells: 0,
          ids: [],
          saved: result.rescued,
          lost: lostFinds(before, result.rescued),
        });
      }
      return result != null;
    });
  };
  const pressSurface = () => {
    act('Heading up…', async () => {
      const summary = await onSurface();
      if (summary) {
        bump({ kind: 'surface', finds: summary.finds, shells: summary.shells, ids: summary.ids, saved: [], lost: [] });
      }
      return summary != null;
    });
  };
  const [gearNote, setGearNote] = useState<string | null>(null);
  const buyGear = (gear: DiveGear) => {
    let note = '';
    commit((doc) => {
      const res = buyDiveGear(doc, gear);
      note = res.result.ok
        ? `${DIVE_GEAR_LABEL[gear]} is yours — for good.`
        : res.result.reason === 'shells'
          ? `Not enough shells yet (${DIVE_GEAR_COST[gear]} needed).`
          : res.result.reason === 'diving'
            ? 'Finish this dive first — new gear starts on your next dive.'
            : 'Already owned.';
      return res.result.ok ? res.doc : null;
    });
    setGearNote(note);
  };

  const depth = run.active ? run.deepers : 0;
  // The control strip, from one pure model (every state has a real label —
  // check:dive-fx holds it). The % is run.bustPct exactly.
  const buttons = diveButtons({
    active: run.active,
    canDeeper: run.canDeeper,
    bustPct: run.bustPct,
    charges,
    nextChargeInMs: view.dive.nextChargeAt != null ? view.dive.nextChargeAt - Date.now() : null,
  });
  const buttonRows = [...new Set(buttons.map((b) => b.row))].map((r) => buttons.filter((b) => b.row === r));
  const pressButton = (b: DiveButton) => {
    if (b.id === 'dive') startWith('Searching…', onSpendCharge);
    else if (b.id === 'free') startWith('Searching…', onFreeDive);
    else if (b.id === 'deeper_safe') pressDeeper('safe');
    else if (b.id === 'deeper_rich') pressDeeper('rich');
    else if (b.id === 'surface') pressSurface();
  };
  const hint = run.active
    ? run.free
      ? `Free dive — finds are Logbook sightings; surfacing now pays ${run.freeShellsNow ?? 0} shells.`
      : run.canDeeper
        ? '% = the chance to lose this haul. Safer finds come from one level up, Richer from one level down.'
        : 'Max depth — this haul has reached its last Deeper. Surface to keep it.'
    : canSpend
      ? 'One charge, one find to start. Each Deeper adds a find and a chance to lose the haul — Surface any time to keep it.'
      : `Out of charges — a free dive keeps only shells (the first 10 a day pay full; ${view.freeDivesToday} so far) and mood.`;
  const st = view.pet.state;
  const revealed = st.hero != null && st.stage !== 'egg' && st.stage !== 'baby';
  const maxDepth = run.active ? run.maxDeepers : view.diveGear.oxygen ? 5 : 4;

  return (
    <View style={styles.screen}>
      <DiveScene
        pet={view.pet.state}
        wear={view.pet.wear}
        eggColor={ELEMENT_COLOR[view.legendElement]}
        depth={depth}
        maxDepth={maxDepth}
        bustPct={run.active ? run.bustPctNext : null}
        away={view.pet.away}
        haul={run.active ? run.haul : []}
        reveal={reveal}
        event={sceneEvent}
        reduceMotion={reduceMotion}
        fxLevel={fxLevel}
        grade={revealed ? view.pet.state.grade : null}
        shiny={revealed && view.pet.state.shiny}
        recolor={revealed ? petRecolor(view.pet.state.hero, view.pet.state.shiny, view.pet.dyeOn, view.pet.state.shiny_style) : null}
        auraElement={view.swords.equipped?.element ?? null}
        atSurface={!run.active}>
        <DiveTopBar
          zone={diveZone(depth)}
          depth={depth}
          maxDepth={maxDepth}
          charges={chargeText(view)}
          shells={view.shells}
          onBack={onBack}
          onInfo={() => setSheet('info')}
          onGear={() => setSheet('gear')}
        />
      </DiveScene>

      <View style={styles.controls}>
        {showSplash ? (
          <View style={styles.splashRow}>
            {!reduceMotion ? <ActivityIndicator size="small" color={NEON.cyan} /> : null}
            <Text style={styles.strong}>{splashCopy ?? 'Searching…'}</Text>
          </View>
        ) : (
          <>
            {buttonRows.map((row, i) => (
              <View key={i} style={styles.buttonRow}>
                {row.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => pressButton(b)}
                    disabled={busy || !b.enabled}
                    accessibilityRole="button"
                    accessibilityLabel={b.label.toLowerCase()}
                    accessibilityState={{ disabled: busy || !b.enabled }}
                    style={({ pressed }) => [
                      styles.button,
                      b.tone === 'primary' ? styles.primary : b.tone === 'secondary' ? styles.deeper : styles.muted,
                      pressed && !busy && b.enabled && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <Text
                      style={b.tone === 'primary' ? styles.primaryText : b.tone === 'muted' ? styles.mutedText : styles.strong}
                      numberOfLines={2}>
                      {b.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
            <Text style={styles.note}>{hint}</Text>
            {run.active && run.preview ? (
              <Text style={styles.note}>
                Lamp: Safer holds {findName(run.preview.safe)} · Richer holds {findName(run.preview.rich)}.
              </Text>
            ) : null}
            {run.active && run.netOn && !run.free ? <Text style={styles.note}>Net: surfacing now adds one more find.</Text> : null}
            {/* v26: today's Power ceiling, and the buffs riding this dive. */}
            <Text style={styles.note}>
              Powers today: {run.powersToday}/{run.powersCap}
              {run.snack ? ` · ${BUFF_ICON.snack} Snack: −${SNACK_BUST_PP} in every %` : ''}
              {run.hearty > 0 && !run.free ? ` · ${BUFF_ICON.hearty} +1 find on surface (×${run.hearty})` : ''}
            </Text>
          </>
        )}
      </View>

      <PlaySheet open={sheet === 'info'} title="Dive · info" onClose={() => setSheet(null)} reduceMotion={reduceMotion}>
        <Text style={styles.body}>{diveBuddyLine(view)}</Text>
        {view.pet.state.stage !== 'egg' ? <Text style={styles.body}>{stagePowerLine(view.pet.stagePower)}</Text> : null}
        <Text style={styles.body}>
          Charges: {chargeText(view)} · Powers today: {run.powersToday}/{run.powersCap} (each one past that becomes{' '}
          {POWER_OVERFLOW_SHELLS} shells).
        </Text>
        <NeonLabel>Today · one minute</NeonLabel>
        {[today.td, today.pet, today.both, today.goal].map((line) => (
          <Text key={line} style={styles.body}>
            {line}
          </Text>
        ))}
        <GuideView initial="dive" />
      </PlaySheet>

      <PlaySheet open={sheet === 'gear'} title="Dive gear" onClose={() => setSheet(null)} reduceMotion={reduceMotion}>
        <Text style={styles.body}>Bought with shells, yours for good. You have {view.shells} shells.</Text>
        {DIVE_GEAR.map((gear) => {
          const owned = view.diveGear[gear];
          const cost = DIVE_GEAR_COST[gear];
          const affordable = view.shells >= cost;
          return (
            <View key={gear} style={styles.gearRow}>
              <View style={styles.flex}>
                <Text style={styles.strong}>{DIVE_GEAR_LABEL[gear]}</Text>
                <Text style={styles.body}>{DIVE_GEAR_BLURB[gear]}</Text>
              </View>
              {owned ? (
                <Text style={styles.owned}>Owned</Text>
              ) : run.active ? (
                <Text style={styles.body}>After this dive</Text>
              ) : (
                <Pressable
                  onPress={() => buyGear(gear)}
                  disabled={!affordable}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !affordable }}
                  style={({ pressed }) => [
                    styles.buyButton,
                    affordable ? styles.primary : styles.deeper,
                    pressed && affordable && styles.pressed,
                  ]}>
                  <Text style={affordable ? styles.primaryText : styles.strong}>{cost} shells</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        {gearNote ? <Text style={styles.body}>{gearNote}</Text> : null}
      </PlaySheet>
    </View>
  );
}

/** "7/10" or "7/10 · +1 ~12m" — same charge line the Grove row shows. */
function chargeText(view: PlayView): string {
  const dive = view.dive;
  const base = `${dive.current}/${DIVE_CHARGE_CAP}`;
  if (dive.full || dive.nextChargeAt == null) return base;
  const minutes = Math.max(1, Math.ceil((dive.nextChargeAt - Date.now()) / 60_000));
  return `${base} · +1 ~${minutes}m`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NEON.ink },
  controls: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: NEON.cyanDim,
    backgroundColor: NEON.panel,
  },
  // Each row is a real row; the buttons share its width. (Before: a flex:1
  // button placed straight in the column strip could collapse and hide its
  // label.) Explicit min height so the text always has room.
  buttonRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  button: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  muted: { backgroundColor: '#161C2A', borderWidth: 1, borderColor: 'rgba(143, 163, 191, 0.35)' },
  mutedText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#8FA3BF', textAlign: 'center' },
  primary: { backgroundColor: '#0E7490' },
  deeper: { backgroundColor: '#121A2B', borderWidth: 1, borderColor: NEON.cyanBorder },
  primaryText: { fontFamily: Fonts.monoBold, fontSize: 14, letterSpacing: 0.5, color: '#FFFFFF', textAlign: 'center' },
  strong: { fontFamily: Fonts.monoBold, fontSize: 13, letterSpacing: 0.3, color: NEON.textPrimary, textAlign: 'center' },
  note: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 19, color: '#C9D6E6', textAlign: 'center' },
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
  owned: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.cyan },
  gearRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buyButton: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  splashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
