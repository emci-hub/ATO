/**
 * Dive — push-your-luck (Play step 3, GAME_SPEC §7, §11 screen 2).
 *
 * Overhaul (2026-09-29): the scene IS the screen (`dive-scene.tsx`) — its top
 * bar shows the zone, a depth meter, charges and shells; the haul is one row
 * of item icons along the bottom of the scene with a rarity glow. Under it,
 * one compact control strip: Deeper (Safer / Richer, each with its exact %)
 * and Surface, or Dive / Free dive. The buddy explanation and the odds text
 * live in the Info sheet, the gear shop in the Gear sheet. No stacked cards.
 * Dive opens from the Hub; back closes a sheet, then returns there.
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
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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
import { PIXEL } from '@/play/pixel-theme';
import { DiamondWipe, takeWipe } from '@/play/pixel-fx';
import { PixelBody, PixelButton, PixelLabel, usePixelFonts, type PixelButtonVariant } from '@/play/pixel-ui';
import { PET_BRANCH_LABEL, PET_STAGE_LABEL } from '@/play/pet';
import { petRecolor } from '@/play/pet-looks';
import { PlaySheet } from '@/play/play-sheet';
import { DIVE_CHARGE_CAP, buyDiveGear, type PlayView } from '@/play/playStore';
import { todayPlan } from '@/play/today-plan';
import { DiveLaterSheets, diveLaterBack, type DiveLaterId } from '@/play/dive-later';
import { GuideView } from '@/play/guide-sheet';
import { stagePowerLine, type GuideSection } from '@/play/guide-content';
import { SNACK_BUST_PP } from '@/play/play-buffs';
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

type SheetId = 'info' | 'gear' | DiveLaterId;

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
  commitSaved,
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
  /** Back to the Hub. */
  onBack: () => void;
  /** Back one level (edge-back.ts): an open sheet closes first. */
  registerBack?: (inner: InnerBack | null) => void;
  /** v22 — Dive-gear purchases go straight through the store. */
  commit: (transition: PlayTransition) => boolean;
  /** Stone sheet: show the result only after the save lands. */
  commitSaved: (transition: PlayTransition) => Promise<boolean>;
}) {
  const fontsReady = usePixelFonts();
  const charges = view.dive.current;
  const run = view.diveRun;
  const today = todayPlan(view);
  const fxLevel = useDiveFxLevel();
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [guideAt, setGuideAt] = useState<GuideSection>('dive');
  const laterOpen = view.stats.surfaces > 0;
  const [wipe, setWipe] = useState<'off' | 'cover' | 'reveal'>('off');
  const leaveRef = useRef<() => void>(() => onBack());

  useEffect(() => {
    if (fxLevel === 'full' && !reduceMotion && takeWipe('dive')) setWipe('reveal');
  }, [fxLevel, reduceMotion]);

  useEffect(() => {
    if (!registerBack) return;
    registerBack({
      edgeSwipe: true,
      back: () => {
        const later = diveLaterBack(sheet === 'info' || sheet === 'gear' ? null : sheet);
        if (later === 'den') {
          setSheet('den');
          return true;
        }
        if (diveBackStep(sheet != null) === 'hub') {
          leaveRef.current();
          return true;
        }
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
  // One or two lines under the haul. The long rules live in the Info sheet
  // so they cannot push DIVE / DEEPER / SURFACE below the screen.
  const st = view.pet.state;
  const revealed = st.hero != null && st.stage !== 'egg' && st.stage !== 'baby';
  const maxDepth = run.active ? run.maxDeepers : view.diveGear.oxygen ? 5 : 4;

  const motionOn = fxLevel === 'full' && !reduceMotion;
  const leave = () => {
    if (!motionOn) {
      onBack();
      return;
    }
    setWipe('cover');
  };
  leaveRef.current = leave;

  if (!fontsReady) return <View style={styles.screen} />;

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
        atSurface={!run.active}
        dock={
          showSplash ? (
            <View style={styles.splashRow}>
              {!reduceMotion ? <ActivityIndicator size="small" color={PIXEL.cyan} /> : null}
              <PixelLabel numberOfLines={1}>{splashCopy ?? 'Searching…'}</PixelLabel>
            </View>
          ) : (
            <View style={styles.dockButtons}>
              <PixelBody size="sm" numberOfLines={2} style={styles.note}>
                {dockStatus(run, charges)}
              </PixelBody>
              {laterOpen && !run.active ? (
                <View style={styles.laterRow}>
                  <PixelButton
                    label="Expedition"
                    variant="muted"
                    onPress={() => setSheet('expedition')}
                    accessibilityLabel="Expedition"
                    style={styles.laterButton}
                  />
                  <PixelButton
                    label="Den"
                    variant="muted"
                    onPress={() => setSheet('den')}
                    accessibilityLabel="The Den"
                    style={styles.laterButton}
                  />
                </View>
              ) : null}
              <View style={styles.actions}>
                {buttonRows.map((row, i) => (
                  <View key={i} style={styles.buttonRow}>
                    {row.map((b) => (
                      <PixelButton
                        key={b.id}
                        label={b.label}
                        variant={diveButtonVariant(b)}
                        disabled={busy || !b.enabled}
                        onPress={() => pressButton(b)}
                        accessibilityLabel={b.label.toLowerCase()}
                        style={styles.button}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )
        }>
        <DiveTopBar
          zone={diveZone(depth)}
          depth={depth}
          maxDepth={maxDepth}
          charges={chargeText(view)}
          shells={view.shells}
          onBack={leave}
          onInfo={() => {
            setGuideAt('dive');
            setSheet('info');
          }}
          onGear={() => setSheet('gear')}
          showGear={laterOpen}
        />
      </DiveScene>

      <PlaySheet open={sheet === 'info'} title="Dive · info" onClose={() => setSheet(null)} reduceMotion={reduceMotion}>
        <PixelBody>{diveBuddyLine(view)}</PixelBody>
        {view.pet.state.stage !== 'egg' ? <PixelBody>{stagePowerLine(view.pet.stagePower)}</PixelBody> : null}
        <PixelBody>
          Charges: {chargeText(view)} · Powers today: {run.powersToday}/{run.powersCap} (each one past that becomes{' '}
          {POWER_OVERFLOW_SHELLS} shells).
        </PixelBody>
        <PixelLabel>How a dive goes</PixelLabel>
        <PixelBody>
          One charge starts you with one find. Each Deeper adds a find and a chance to lose the haul. Surface any time
          to keep it. Safer comes from one level up, Richer from one level down. The % on Deeper is that chance.
        </PixelBody>
        <PixelBody>
          With no charges, a free dive keeps shells (the first 10 a day pay full) and mood. Those finds are Logbook
          sightings. A lamp shows the next Safer and Richer finds. A net adds one more find when you surface.
        </PixelBody>
        <PixelLabel>Today · one minute</PixelLabel>
        {[today.td, today.pet, today.both, today.goal].map((line) => (
          <PixelBody key={line}>{line}</PixelBody>
        ))}
        <GuideView key={guideAt} initial={guideAt} />
      </PlaySheet>

      <DiveLaterSheets
        sheet={sheet === 'info' || sheet === 'gear' ? null : sheet}
        view={view}
        commit={commit}
        commitSaved={commitSaved}
        reduceMotion={reduceMotion}
        onClose={() => setSheet(null)}
        onSheet={setSheet}
        onGuide={(section) => {
          setGuideAt(section);
          setSheet('info');
        }}
      />

      {laterOpen ? (
      <PlaySheet open={sheet === 'gear'} title="Dive gear" onClose={() => setSheet(null)} reduceMotion={reduceMotion}>
        <PixelBody>Bought with shells, yours for good. You have {view.shells} shells.</PixelBody>
        {DIVE_GEAR.map((gear) => {
          const owned = view.diveGear[gear];
          const cost = DIVE_GEAR_COST[gear];
          const affordable = view.shells >= cost;
          return (
            <View key={gear} style={styles.gearRow}>
              <View style={styles.flex}>
                <PixelLabel numberOfLines={2}>{DIVE_GEAR_LABEL[gear]}</PixelLabel>
                <PixelBody>{DIVE_GEAR_BLURB[gear]}</PixelBody>
              </View>
              {owned ? (
                <PixelLabel color={PIXEL.cyan}>Owned</PixelLabel>
              ) : run.active ? (
                <PixelBody>After this dive</PixelBody>
              ) : (
                <PixelButton
                  label={`${cost} shells`}
                  onPress={() => buyGear(gear)}
                  disabled={!affordable}
                  variant={affordable ? 'cyan' : 'muted'}
                  style={styles.buyButton}
                />
              )}
            </View>
          );
        })}
        {gearNote ? <PixelBody>{gearNote}</PixelBody> : null}
      </PlaySheet>
      ) : null}
      <DiamondWipe
        mode={wipe}
        onDone={
          wipe === 'cover'
            ? () => {
                onBack();
              }
            : () => setWipe('off')
        }
      />
    </View>
  );
}

/** Surface is the amber action. Deeper and Dive stay cyan. A dead control is muted. */
function diveButtonVariant(b: DiveButton): PixelButtonVariant {
  if (!b.enabled || b.tone === 'muted') return 'muted';
  if (b.id === 'surface') return 'amber';
  return 'cyan';
}

/** Live dock line. Rules stay in the Info sheet. */
function dockStatus(run: PlayView['diveRun'], charges: number): string {
  const bits = [`Powers ${run.powersToday}/${run.powersCap}`];
  if (run.snack) bits.push(`Snack −${SNACK_BUST_PP}`);
  if (run.hearty > 0 && !run.free) bits.push(run.hearty > 1 ? `+1 find ×${run.hearty}` : '+1 find');
  if (run.active && run.preview) {
    bits.push(`Lamp ${findName(run.preview.safe)} · ${findName(run.preview.rich)}`);
  }
  if (run.active && run.netOn && !run.free) bits.push('Net adds a find');
  if (run.active && run.free) bits.push(`Free dive · ${run.freeShellsNow ?? 0} shells up`);
  if (!run.active && charges < 1) bits.push('Free dive keeps shells and mood');
  if (run.active && !run.canDeeper) bits.push('Surface keeps this haul');
  return bits.join(' · ');
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
  screen: { flex: 1, minHeight: 0, backgroundColor: PIXEL.ink },
  dockButtons: { width: '100%', gap: 8 },
  // flexShrink 0 so a short phone clips the scene, not the actions.
  actions: { width: '100%', gap: 8, flexShrink: 0 },
  // Two DEEPER buttons share the row; SURFACE is its own full-width row.
  // flexBasis is a percent, and minWidth is a real floor. flexBasis 0 with
  // minWidth 0 collapses this row to ~0 width on iOS (empty ink gap).
  buttonRow: { flexDirection: 'row', width: '100%', gap: 8, alignItems: 'stretch' },
  button: { flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 96, minHeight: 50 },
  note: { textAlign: 'center' },
  laterRow: { flexDirection: 'row', width: '100%', gap: 8 },
  laterButton: { flexGrow: 1, flexBasis: '0%', minHeight: 44 },
  gearRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buyButton: { flexGrow: 0 },
  splashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  flex: { flex: 1, gap: 4 },
});
