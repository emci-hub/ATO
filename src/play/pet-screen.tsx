/**
 * Pet screen (v20, 2026-09-29) — the Digimon-style virtual pet.
 *
 * Pure view over `view.pet` + pure transitions through `commit` (the rules
 * are in `pet.ts` / `playStore.ts`). Visuals reuse existing art only: the
 * stage's creep or hero sprite, enlarged smoothly per stage; a tinted copy at
 * low opacity + a coloured ring for the care branch; a vector egg in the
 * Legend's colour; and a God aura drawn by the attack-effects layer in the
 * most-used Legend element (a static glow when Effects Quality is Off).
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { usePlayDevUnlocked } from '@/play/dev-lock';
import { diveBuddyLine } from '@/play/dive-screen';
import { petBackStep, type InnerBack } from '@/play/edge-back';
import { FxLayer, FX_ULTIMATE_LIFE_MS, type FxEvent } from '@/play/fx-layer';
import { useFxQuality } from '@/play/fx-quality';
import { HeartIcon } from '@/play/icons';
import { ELEMENT_COLOR, ELEMENT_LABEL, type Element } from '@/play/kits';
import {
  NeonBackLink,
  NeonButton,
  NeonChip,
  NeonHeader,
  NeonLabel,
  NeonPanel,
} from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import {
  PET_BRANCH_LABEL,
  PET_BRANCH_TINT,
  PET_METER_MAX,
  PET_MIN_ROUND_SCORE,
  PET_REBIRTH_CAP,
  PET_STAGE_LABEL,
  PET_STAGE_SCALE,
  PET_TOKENS_DAILY_CAP,
  PET_TOKENS_PER_ROUND,
  branchFor,
  petLineById,
  petLines,
  petLookFor,
  type PetLook,
  type PetState,
} from '@/play/pet';
import { CatchFoodGame, TapTrainGame, TRAIN_REPS } from '@/play/pet-games';
import { askPetReminderPermission, syncPetReminder } from '@/play/pet-reminder';
import {
  devPetFinishStage,
  devPetNewEgg,
  devPetSetStage,
  devPetStarve,
  finishPetRound,
  rebirthPetDoc,
  setPetLine,
  setPetRemind,
  type PetRoundKind,
  type PetRoundResult,
  type PetView,
  type PlayView,
} from '@/play/playStore';
import { ClipImage } from '@/play/sheet-sprite';
import { getSkinRole, heroAvatarRole, roleArtDrawable, roleFaceArtIndex } from '@/play/skin';
import type { PlayTransition } from '@/play/use-play-store';

const FRAME = 240;
const BASE_BOX = 150;
const AURA_EVERY_MS = 1400;
const ARM_LAPSE_MS = 3500;

/* ------------------------------------------------------------- sprite --- */

function lookDrawable(look: PetLook | null) {
  if (!look) return undefined;
  const role = look.kind === 'hero' ? heroAvatarRole(look.heroId) : getSkinRole(look.role);
  return roleArtDrawable(role, roleFaceArtIndex(role, 'e'));
}

function EggShape({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50 8 C30 8 18 38 18 58 C18 78 32 92 50 92 C68 92 82 78 82 58 C82 38 70 8 50 8 Z"
        fill={color}
        fillOpacity={0.85}
        stroke="#FFFFFF"
        strokeOpacity={0.5}
        strokeWidth={2}
      />
      <Circle cx="38" cy="44" r="6" fill="#FFFFFF" fillOpacity={0.35} />
      <Circle cx="62" cy="62" r="8" fill="#FFFFFF" fillOpacity={0.25} />
      <Circle cx="44" cy="74" r="4" fill="#FFFFFF" fillOpacity={0.3} />
      <Ellipse cx="40" cy="26" rx="6" ry="10" fill="#FFFFFF" fillOpacity={0.3} />
    </Svg>
  );
}

/** God aura: a soft static glow, plus a slow pulse from the effects layer
 * every ~1.4s (skipped when Effects Quality is Off or motion is reduced). */
function GodAura({ element, reduceMotion }: { element: Element; reduceMotion: boolean }) {
  const quality = useFxQuality();
  const color = ELEMENT_COLOR[element];
  const animate = quality !== 'off' && !reduceMotion;
  const [now, setNow] = useState(() => Date.now());
  const eventsRef = useRef<FxEvent[]>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!animate) return;
    let last = 0;
    const id = setInterval(() => {
      const t = Date.now();
      if (t - last >= AURA_EVERY_MS) {
        last = t;
        eventsRef.current = [
          ...eventsRef.current.filter((fx) => t - fx.bornAt < fx.lifeMs),
          {
            id: ++seqRef.current,
            bornAt: t,
            lifeMs: FX_ULTIMATE_LIFE_MS * 2,
            behavior: 'slow',
            element,
            secondary: null,
            ultimate: true,
            from: { x: 50, y: 50 },
            points: [{ x: 50, y: 50 }],
            arc: null,
            radius: 44,
            center: { x: 50, y: 50 },
            centredOnSource: true,
          },
        ];
      }
      setNow(t);
    }, 60);
    return () => clearInterval(id);
  }, [animate, element]);

  return (
    <Svg width={FRAME} height={FRAME} viewBox="0 0 100 100" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx="50" cy="50" r="46" fill={color} fillOpacity={0.06} />
      <Circle cx="50" cy="50" r="40" fill={color} fillOpacity={0.08} />
      <Circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={0.8} />
      {animate ? <FxLayer events={eventsRef.current} now={now} quality={quality} /> : null}
    </Svg>
  );
}

function PetSprite({
  pet,
  aura,
  eggColor,
  reduceMotion,
}: {
  pet: PetState;
  aura: Element | null;
  eggColor: string;
  reduceMotion: boolean;
}) {
  const box = Math.round(BASE_BOX * PET_STAGE_SCALE[pet.stage]);
  const tint = PET_BRANCH_TINT[pet.branch];
  const drawable = lookDrawable(petLookFor(pet.line, pet.stage));
  const ring = Math.min(FRAME - 8, Math.round(box * 1.12));
  return (
    <View style={styles.frame}>
      {pet.stage === 'god' && aura ? <GodAura element={aura} reduceMotion={reduceMotion} /> : null}
      <View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderColor: tint ?? NEON.cyanBorder,
          },
        ]}
      />
      {pet.stage === 'egg' ? (
        <EggShape size={box} color={eggColor} />
      ) : (
        <View style={{ width: box, height: box }}>
          <ClipImage drawable={drawable} />
          {tint ? (
            <View style={[StyleSheet.absoluteFill, styles.wash]} pointerEvents="none">
              <ClipImage drawable={drawable} tintColor={tint} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------ helpers --- */

function durationLabel(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  const d = Math.floor(mins / (60 * 24));
  const h = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.meterRow}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.hearts}>
        {Array.from({ length: PET_METER_MAX }, (_, i) => (
          <HeartIcon key={i} filled={i < value} size={16} />
        ))}
      </View>
    </View>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function roundResultLine(kind: PetRoundKind, score: number, result: PetRoundResult): string {
  if (!result.counted) {
    return `Scored ${score} — a round needs ${PET_MIN_ROUND_SCORE} to count. Try again!`;
  }
  const care =
    kind === 'catch' ? `Caught ${score} — +2 hunger` : `${score}/${TRAIN_REPS} hits — +1 training, +2 mood`;
  const pay =
    result.tokensGranted > 0 ? ` · +${result.tokensGranted} tokens` : ' · daily token cap reached';
  return care + pay;
}

/** Keep the opt-in hunger reminder in step with the pet (call once from the
 * Play shell so a TD feed moves it too, not only this screen). */
export function usePetReminderSync(pet: PetView | null): void {
  const on = pet?.remind ?? false;
  const stage = pet?.state.stage;
  const hunger = pet?.state.hunger;
  const state = pet?.state;
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const current = stateRef.current;
    if (!current) return;
    void syncPetReminder(on, current, Date.now());
  }, [on, stage, hunger]);
}

/* ------------------------------------------------------------- screen --- */

export function PetScreen({
  view,
  commit,
  registerBack,
  reduceMotion,
  onBack,
}: {
  view: PlayView;
  commit: (transition: PlayTransition) => boolean;
  /** Back one level (edge-back.ts): a running mini-game closes first. */
  registerBack?: (inner: InnerBack | null) => void;
  reduceMotion: boolean;
  onBack: () => void;
}) {
  const devUnlocked = usePlayDevUnlocked();
  const pv = view.pet;
  const pet = pv.state;
  const [game, setGame] = useState<PetRoundKind | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [rebirthArmed, setRebirthArmed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hallOpen, setHallOpen] = useState(false);
  const [remindNote, setRemindNote] = useState<string | null>(null);

  useEffect(() => {
    if (!registerBack) return;
    registerBack({
      edgeSwipe: true,
      back: () => {
        if (petBackStep(game != null) === 'hub') return false;
        setGame(null); // the unfinished round does not count
        return true;
      },
    });
    return () => registerBack(null);
  }, [registerBack, game]);

  useEffect(() => {
    if (!rebirthArmed) return;
    const id = setTimeout(() => setRebirthArmed(false), ARM_LAPSE_MS);
    return () => clearTimeout(id);
  }, [rebirthArmed]);

  const finishRound = (kind: PetRoundKind) => (score: number) => {
    let result: PetRoundResult | null = null;
    commit((doc, now) => {
      const next = finishPetRound(doc, now, kind, score);
      result = next.result;
      return next.doc;
    });
    setGame(null);
    if (result) setLastResult(roundResultLine(kind, score, result));
  };

  const pressRebirth = () => {
    if (!rebirthArmed) {
      setRebirthArmed(true);
      return;
    }
    setRebirthArmed(false);
    commit((doc, now) => rebirthPetDoc(doc, now));
  };

  const toggleRemind = async () => {
    if (pv.remind) {
      commit((doc) => setPetRemind(doc, false));
      setRemindNote(null);
      return;
    }
    const granted = await askPetReminderPermission();
    if (!granted) {
      setRemindNote('Notifications are off for ATO — turn them on in your phone’s Settings to get the reminder.');
      return;
    }
    commit((doc) => setPetRemind(doc, true));
    setRemindNote('On — one gentle nudge when your pet gets hungry, at most once a day.');
  };

  const line = petLineById(pet.line);
  const stageName = PET_STAGE_LABEL[pet.stage];
  const showBranch = pet.stage !== 'egg' && pet.stage !== 'baby';
  const title = showBranch ? `${stageName} · ${PET_BRANCH_LABEL[pet.branch]}` : stageName;
  const timer =
    pv.stageLeftMs == null
      ? 'Final form — you can rebirth it into a new egg.'
      : pet.stage === 'egg'
        ? `Hatches in ${durationLabel(pv.stageLeftMs)}`
        : `Evolves in ${durationLabel(pv.stageLeftMs)}`;
  const onTrack =
    pet.stage !== 'egg' && pet.stage !== 'god' ? PET_BRANCH_LABEL[branchFor(pet.stage, pet)] : null;
  const rebirthPct = Math.round(view.petRebirthBonus * 100);

  return (
    <View style={styles.screen}>
      <NeonBackLink onPress={onBack} />
      <NeonHeader
        title="Pet"
        lede="Raise one buddy from an egg to a God. Care decides its form — it never dies."
      />

      <NeonPanel style={styles.stageCard}>
        <PetSprite
          pet={pet}
          aura={pv.aura ?? view.legendElement}
          eggColor={ELEMENT_COLOR[view.legendElement]}
          reduceMotion={reduceMotion}
        />
        <Text style={styles.stageTitle}>{title}</Text>
        <Text style={styles.subtle}>{pet.stage === 'egg' ? `Will hatch as: ${line.label}` : line.label}</Text>
        <Text style={styles.timer}>{timer}</Text>
        {pet.stage !== 'egg' ? (
          <View style={styles.meters}>
            <Meter label="Hunger" value={pet.hunger} />
            <Meter label="Mood" value={pet.mood} />
          </View>
        ) : null}
        {onTrack ? (
          <Text style={styles.subtle}>
            This stage: {plural(pet.mistakes, 'care mistake')} · {pet.training} training ·{' '}
            {plural(pet.waves, 'wave')} → on track for {onTrack}
          </Text>
        ) : null}
      </NeonPanel>

      {pet.stage === 'egg' ? (
        <NeonPanel>
          <NeonLabel>Choose what hatches</NeonLabel>
          <Text style={styles.body}>
            You can change it until the egg hatches. The three minion lines grow into a hero at Teen.
          </Text>
          <View style={styles.chips}>
            {petLines().map((option) => (
              <NeonChip
                key={option.id}
                label={option.label}
                selected={option.id === pet.line}
                onPress={() => commit((doc, now) => setPetLine(doc, now, option.id))}
              />
            ))}
          </View>
        </NeonPanel>
      ) : (
        <NeonPanel>
          <NeonLabel>Play</NeonLabel>
          {game === 'catch' ? (
            <CatchFoodGame onDone={finishRound('catch')} />
          ) : game === 'train' ? (
            <TapTrainGame onDone={finishRound('train')} />
          ) : (
            <>
              <Text style={styles.body}>
                +{PET_TOKENS_PER_ROUND} tokens a round · {pv.tokensLeftToday}/{PET_TOKENS_DAILY_CAP} left
                today. TD stays the main way to earn.
              </Text>
              <View style={styles.buttons}>
                <NeonButton label="Catch the food" onPress={() => setGame('catch')} style={styles.flex} />
                <NeonButton
                  label="Tap to train"
                  variant="secondary"
                  onPress={() => setGame('train')}
                  style={styles.flex}
                />
              </View>
              {lastResult ? <Text style={styles.result}>{lastResult}</Text> : null}
            </>
          )}
        </NeonPanel>
      )}

      <NeonPanel>
        <NeonLabel>What your pet does</NeonLabel>
        <Text style={styles.body}>
          {pv.pounceBase > 0
            ? `TD: Pet pounce — once per wave, hits foes near your Avatar (${Number(pv.pounceBase.toFixed(1))} damage at wave 1, growing with the wave).`
            : 'TD: from Child, your pet can pounce once per wave.'}{' '}
          {pet.stage === 'egg'
            ? 'Once it hatches, every cleared wave feeds it one heart.'
            : 'Every cleared wave feeds it one heart.'}
        </Text>
        <Text style={styles.body}>{diveBuddyLine(view)}</Text>
        <Text style={styles.body}>
          Rebirth bonus: +{rebirthPct}% damage in TD ({plural(pv.rebirths, 'rebirth')}, max +
          {Math.round(PET_REBIRTH_CAP * 100)}%).
        </Text>
      </NeonPanel>

      {pet.stage === 'god' ? (
        <NeonPanel>
          <NeonLabel>Rebirth</NeonLabel>
          <Text style={styles.body}>
            Retire this God to the Hall of pets and start a new egg. Each rebirth adds +2% damage
            for good (up to +10%). Optional — your God can stay as long as you like.
          </Text>
          <NeonButton
            label={rebirthArmed ? 'Tap again · retire to the Hall' : 'Rebirth into a new egg'}
            variant={rebirthArmed ? 'danger' : 'primary'}
            onPress={pressRebirth}
          />
        </NeonPanel>
      ) : null}

      <NeonPanel>
        <NeonChip
          label={`Hall of pets · ${pv.hall.length}`}
          selected={hallOpen}
          onPress={() => setHallOpen((open) => !open)}
        />
        {hallOpen ? (
          pv.hall.length === 0 ? (
            <Text style={styles.body}>Empty for now — a pet joins after its rebirth.</Text>
          ) : (
            [...pv.hall].reverse().map((entry, i) => (
              <Text key={`${entry.rebirth}-${i}`} style={styles.body}>
                #{entry.rebirth} {petLineById(entry.line).label} · {PET_BRANCH_LABEL[entry.branch]}
                {entry.aura ? ` · ${ELEMENT_LABEL[entry.aura]} aura` : ''} · {entry.days}d
              </Text>
            ))
          )
        ) : null}
      </NeonPanel>

      <NeonPanel>
        <NeonChip
          label={`Hunger reminder · ${pv.remind ? 'On' : 'Off'}`}
          selected={pv.remind}
          onPress={() => void toggleRemind()}
        />
        {remindNote ? <Text style={styles.body}>{remindNote}</Text> : null}
      </NeonPanel>

      <NeonPanel>
        <NeonChip label="How it works" selected={guideOpen} onPress={() => setGuideOpen((o) => !o)} />
        {guideOpen ? (
          <View style={styles.guide}>
            <Text style={styles.body}>
              • It grows on real time: Egg (1h) → Baby (12h) → Child (1.5 days) → Teen (3 days) →
              Adult (5 days) → God. About 10 days in all, even if you only play TD.
            </Text>
            <Text style={styles.body}>
              • Hunger drops a heart every 3h, mood every 4h. Leaving one empty for over 2h is a
              care mistake. Feed it with Catch the food or by clearing TD waves; cheer it up with Tap
              to train.
            </Text>
            <Text style={styles.body}>
              • At each evolution this stage’s care picks the form: lots of mistakes → Scruffy; lots
              of TD waves → Battle (stronger pounce); good care + training → Bright; otherwise
              Standard. Counters reset every stage.
            </Text>
            <Text style={styles.body}>
              • TD: from Child it pounces once per wave. Dive: from Teen it lowers bust chance, from
              Adult it saves your best find on a bust. It is never lost.
            </Text>
            <Text style={styles.body}>
              • The God form glows in the Legend element you played TD with most. Rebirth is optional
              and adds +2% damage for good (max +10%).
            </Text>
            <Text style={styles.body}>
              • Time only counts forward: changing the phone’s clock back does nothing, and at most 2
              days count between visits.
            </Text>
          </View>
        ) : null}
      </NeonPanel>

      {PRE_LAUNCH_DEV && devUnlocked ? (
        <NeonPanel>
          <NeonLabel>Dev · pet</NeonLabel>
          <View style={styles.chips}>
            <NeonChip label="Finish stage" onPress={() => commit((doc, now) => devPetFinishStage(doc, now))} />
            <NeonChip label="Starve" onPress={() => commit((doc, now) => devPetStarve(doc, now))} />
            <NeonChip label="Set Adult" onPress={() => commit((doc, now) => devPetSetStage(doc, now, 'adult'))} />
            <NeonChip label="Set God" onPress={() => commit((doc, now) => devPetSetStage(doc, now, 'god'))} />
            <NeonChip label="New egg" onPress={() => commit((doc, now) => devPetNewEgg(doc, now))} />
          </View>
        </NeonPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  stageCard: { alignItems: 'center', gap: 6 },
  frame: {
    width: FRAME,
    height: FRAME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  wash: { opacity: 0.35 },
  stageTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: NEON.textPrimary,
  },
  timer: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: NEON.cyan,
  },
  subtle: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: NEON.textMuted,
    textAlign: 'center',
  },
  meters: { alignSelf: 'stretch', gap: 6, marginTop: 4 },
  meterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterLabel: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: NEON.textPrimary,
  },
  hearts: { flexDirection: 'row', gap: 6 },
  body: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: NEON.textMuted,
    marginTop: 6,
  },
  result: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: NEON.cyan,
    marginTop: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  flex: { flex: 1 },
  guide: { marginTop: 4 },
});
