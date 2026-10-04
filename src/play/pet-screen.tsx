/**
 * Pet screen — the Digimon-style virtual pet (v20), as a ROOM since the
 * overhaul (2026-09-29): the pet lives in `PetRoom` covering most of the
 * screen, with one row of icons under it — Feed, Play, Dive, Expedition,
 * Info. Each icon opens a sheet (`pet-sheets.tsx`); Dive opens full screen
 * and its back returns here. Nothing stacks on the main screen.
 *
 * This screen owns: the sheet + mini-game state (back closes a game, then a
 * sheet, then goes to the hub — `petBackStep`), the status and coach tip,
 * and the talk manager (lines from `pet-talk.ts`: on tap, on events handed in
 * by the Play shell, now and then while idle, never the same line twice).
 *
 * Rules are unchanged: pure view over `view.pet` + transitions via `commit`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ART_PT, PIXEL } from '@/play/pixel-theme';
import { PixelBody, PixelFrame, PixelLabel, usePixelFonts } from '@/play/pixel-ui';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { PET_COACH_ICON, petCoachTip, type PetCoachIcon } from '@/play/coach';
import { usePlayDevUnlocked } from '@/play/dev-lock';
import { PetDevPanel } from '@/play/pet-dev-panel';
import { usePetDevRoom } from '@/play/pet-dev-state';
import { petBackStep, type InnerBack } from '@/play/edge-back';
import { ELEMENT_COLOR } from '@/play/kits';
import { NEON } from '@/play/neon-viper';
import { PET_BRANCH_LABEL, PET_STAGE_LABEL } from '@/play/pet';
import { syncPlayNotices } from '@/play/pet-reminder';
import { heroName } from '@/play/heroes-data';
import { petPose } from '@/play/pet-actor';
import { PetAnimSprite, usePetArt } from '@/play/pet-anim-sprite';
import { PetCard, type PetCardInfo } from '@/play/pet-card';
import { DivecoreSettingsSheet } from '@/play/divecore-settings';
import { EggPickerBody, JournalTab, OddsPanel } from '@/play/pet-egg-sheets';
import { PetMenuBody } from '@/play/pet-menu';
import { DenSheetBody } from '@/play/den-sheet';
import { finishWornLabel } from '@/play/finishes';
import { FinishPicker } from '@/play/finish-picker';
import { StoneSheetBody } from '@/play/stone-sheet';
import { DIFFICULTY_LABEL, type RoundOutcome } from '@/play/pet-game-rules';
import type { GamePet } from '@/play/pet-games';
import { BUFF_HOW, BUFF_ICON, BUFF_LABEL } from '@/play/play-buffs';
import { useFxQuality } from '@/play/fx-quality';
import { isStrongResult } from '@/play/score-burst-model';
import type { GuideSection } from '@/play/guide-content';
import { GuideLink } from '@/play/guide-sheet';
import { idleTalkDelayMs, isBedtime } from '@/play/play-settings';
import { tripLabel } from '@/play/expedition-ladder';
import {
  EGG_COLOR,
  EGG_LABEL,
  EGG_LINE,
  GRADES,
  GRADE_COLOR,
  GRADE_LABEL,
  SHARDS_PER_TICKET,
  SHINY_STYLE_LABEL,
  gradedName,
  heroStars,
  ownsAllStyles,
  petShownName,
  type EggType,
} from '@/play/pet-eggs';
import { PetFigure } from '@/play/pet-figure';
import { petRecolor } from '@/play/pet-looks';
import { PetReveal } from '@/play/pet-reveal';
import { PetRoom, type RoomSpeech } from '@/play/pet-room';
import { loadSeenStage, saveSeenStage } from '@/play/pet-seen';
import {
  BookTab,
  ExpeditionSheetBody,
  FeedSheetBody,
  HallTab,
  HelpTab,
  PlaySheetBody,
  type GameRun,
  StatusTab,
  StyleTab,
  durationLabel,
  infoTabs,
  roundResultLine,
  type InfoTab,
} from '@/play/pet-sheets';
import { justEvolved, petStatus } from '@/play/pet-status';
import {
  PET_IDLE_TALK_MAX_MS,
  PET_IDLE_TALK_MIN_MS,
  pickEggLine,
  pickEggTalk,
  pickPetLine,
  pickRoundTalk,
  talkSituationForStatus,
  timeOfDaySituation,
  type PetEggTalk,
  type PetTalkSituation,
} from '@/play/pet-talk';
import { PlaySheet, SheetTabs } from '@/play/play-sheet';
import {
  ackPetRevealsDoc,
  warmEggDoc,
  finishPetRound,
  type PetRoundKind,
  type PetRoundResult,
  type PlayView,
} from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

/** A pet-worthy moment the Play shell hands to the room (dive, TD, finds). */
export type PetTalkEvent = { situation: PetTalkSituation; key: number } | null;

type SheetId = 'feed' | 'play' | 'expedition' | 'info' | 'eggs' | 'card' | 'menu' | 'den' | 'stone' | 'prism';

const ICONS: { id: PetCoachIcon; emoji: string; label: string }[] = [
  { id: 'feed', emoji: '🍖', label: 'Feed' },
  { id: 'play', emoji: '🎾', label: 'Play' },
  { id: 'dive', emoji: '🤿', label: 'Dive' },
  { id: 'expedition', emoji: '🧭', label: 'Expedition' },
  { id: 'info', emoji: 'ℹ️', label: 'Info' },
];


const SHEET_TITLE: Record<SheetId, string> = {
  feed: 'Feed',
  play: 'Play',
  expedition: 'Expedition',
  info: 'Info',
  eggs: 'Choose an egg',
  card: 'Card',
  menu: 'Your pet',
  den: 'The Den',
  stone: 'Shine Stone',
  prism: 'Prism Stone',
};

/** Keep every Divecore notice (hunger, egg, expedition, charges) in step with
 * the save — call once from the Play shell so a TD feed or a dive moves them
 * too, not only this screen. Re-plans when anything they depend on changes. */
export function usePlayNoticesSync(view: PlayView | null): void {
  const viewRef = useRef(view);
  viewRef.current = view;
  const pet = view?.pet.state;
  const key = view
    ? [
        JSON.stringify(view.settings.notif),
        JSON.stringify(view.settings.quiet),
        pet?.stage,
        pet?.hunger,
        pet?.egg,
        pet?.hero,
        pet?.name,
        view.pet.away,
        view.pet.expeditionStepMs,
        view.chargesArmed,
        view.chargesFullAt,
        view.pet.tide.active,
        view.pet.tide.daysHeld,
        view.pet.eggDay.nextPrice,
        view.pet.state.egg,
      ].join('|')
    : '';
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    void syncPlayNotices({
      settings: v.settings,
      pet: v.pet.state,
      name: petShownName(v.pet.state),
      expeditionBackInMs: v.pet.away ? v.pet.expeditionBackInMs : null,
      // v26: the notice follows the ladder step (a Teen's 27m "30m trip"
      // still gets its notice), not the stage-shortened length.
      expeditionTripMs: v.pet.expeditionStepMs,
      chargesFullAt: v.chargesFullAt,
      chargesArmed: v.chargesArmed,
      now: Date.now(),
      tideActive: v.pet.tide.active,
      tideDaysHeld: v.pet.tide.daysHeld,
      freeEggsReady: v.pet.state.stage === 'egg' && v.pet.state.egg == null && v.pet.eggDay.nextPrice === 0,
    });
  }, [key]);
}

/** The phone's clock hour, refreshed every minute. */
function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

/** One room icon. A suggested action fills cyan — colour only, so Reduce Motion stays still. */
function RoomIcon({
  emoji,
  label,
  pulse,
  badge,
  onPress,
}: {
  emoji: string;
  label: string;
  pulse: boolean;
  badge: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${emoji} ${label}${badge ? ', dive in progress' : ''}${pulse ? ', suggested' : ''}`}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
      <PixelFrame fill={pulse ? PIXEL.cyan : PIXEL.ink} border={PIXEL.cyan} minHeight={48} style={styles.iconFrame}>
        <PixelLabel color={pulse ? PIXEL.onFill : PIXEL.cyan} numberOfLines={1}>
          {label}
        </PixelLabel>
      </PixelFrame>
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

export function PetScreen({
  view,
  commit,
  commitSaved,
  registerBack,
  reduceMotion,
  onBack,
  onGoDive,
  talkEvent = null,
  onTalkConsumed,
  onReplayTutorial,
  openJournal = false,
  onJournalOpened,
  onBanner,
  openGuide: openGuideReq = false,
  onGuideOpened,
}: {
  view: PlayView;
  commit: (transition: PlayTransition) => boolean;
  /** Stone sheet: show the result only after the save lands. */
  commitSaved: (transition: PlayTransition) => Promise<boolean>;
  /** Back one level (edge-back.ts): a mini-game, then a sheet, then the hub. */
  registerBack?: (inner: InnerBack | null) => void;
  reduceMotion: boolean;
  onBack: () => void;
  /** Opens Dive full screen; its back returns here. */
  onGoDive: () => void;
  /** The last dive / TD / find moment, to talk about once. */
  talkEvent?: PetTalkEvent;
  /** Called once the room has said the event, so it is never replayed. */
  onTalkConsumed?: () => void;
  /** v24 — Settings → Replay the tutorial. */
  onReplayTutorial?: () => void;
  /** v25 — a "Milestone ready" banner was tapped: open Info → Journal once,
   * then `onJournalOpened` clears the request. */
  openJournal?: boolean;
  onJournalOpened?: () => void;
  /** v26 — open Info → Guide (from the hub ⚙ or the tutorial). */
  openGuide?: boolean;
  onGuideOpened?: () => void;
  /** v26 — post a floating banner (NEW RECORD!, unlocks, buffs). */
  onBanner?: (b: { title: string; body: string }) => void;
}) {
  usePixelFonts();
  const devUnlocked = usePlayDevUnlocked();
  const dev = PRE_LAUNCH_DEV && devUnlocked;
  const pv = view.pet;
  const pet = pv.state;

  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [stoneUid, setStoneUid] = useState<number | null>(null);
  const openStone = (uid: number | null) => {
    setStoneUid(uid);
    setSheet('stone');
  };
  const [infoTab, setInfoTab] = useState<InfoTab>('status');
  useEffect(() => {
    if (!openJournal) return;
    setGame(null);
    setInfoTab('journal');
    setSheet('info');
    onJournalOpened?.();
  }, [openJournal, onJournalOpened]);
  const [game, setGame] = useState<GameRun | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastRound, setLastRound] = useState<{ key: string; score: number; strong: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Dev-only room hooks (Info → Dev).
  // Dev room toggles live in a store so the floating DEV kit can drive them too.
  const { status: devStatus, night: devNight, say: devSay } = usePetDevRoom();
  const [revealStep, setRevealStep] = useState(0);
  const [focusEgg, setFocusEgg] = useState<EggType | null>(null);
  const art = usePetArt(pet);
  const fxQuality = useFxQuality();
  // v26 Guide: "?" buttons open Info → Guide at a section.
  const [guideSection, setGuideSection] = useState<GuideSection | null>(null);
  // Bumped on every "?" tap so the same section re-opens after you browsed away.
  const [guideNonce, setGuideNonce] = useState(0);
  const openGuide = (section: GuideSection) => {
    setGame(null);
    setGuideSection(section);
    setGuideNonce((n) => n + 1);
    setInfoTab('guide');
    setSheet('info');
  };
  useEffect(() => {
    if (!openGuideReq) return;
    setGame(null);
    setGuideSection('pet');
    setInfoTab('guide');
    setSheet('info');
    onGuideOpened?.();
  }, [openGuideReq, onGuideOpened]);

  const hour = useHour();
  const night = devNight === 'auto' ? isBedtime(new Date(), view.settings.bedtime) : devNight === 'on';
  const realStatus = petStatus({
    stage: pet.stage,
    hunger: pet.hunger,
    mood: pet.mood,
    away: pv.away,
    night,
    stageLeftMs: pv.stageLeftMs,
    eggChosen: pet.egg != null,
    warmth: pet.warmth,
  });
  const status = dev && devStatus ? devStatus : realStatus;
  const coach = petCoachTip({
    status,
    hunger: pet.hunger,
    pantryTotal: pv.pantryTotal,
    expeditionReady: pv.expedition === 'ready',
    nextTrip: pv.nextTripMs != null ? tripLabel(pv.nextTripMs) : null,
    diveCharges: view.dive.current,
    tokensLeftToday: pv.tokensLeftToday,
    backIn: pv.expeditionBackInMs != null ? durationLabel(pv.expeditionBackInMs) : null,
  });
  const pulseIcon = coach.action ? PET_COACH_ICON[coach.action] : null;

  /* ------------------------------------------------------------ talk --- */

  const [speech, setSpeech] = useState<RoomSpeech>(null);
  const lastLineRef = useRef<string | null>(null);
  const speechKeyRef = useRef(0);
  const sayText = useCallback((text: string) => {
    lastLineRef.current = text;
    speechKeyRef.current += 1;
    setSpeech({ text, key: speechKeyRef.current });
  }, []);
  const branchRef = useRef(pet.branch);
  branchRef.current = pet.branch;
  const eggRef = useRef(pet.stage === 'egg');
  eggRef.current = pet.stage === 'egg';
  const awayRef = useRef(pv.away);
  awayRef.current = pv.away;
  const say = useCallback(
    (situation: PetTalkSituation) => {
      if (awayRef.current) return;
      if (eggRef.current) {
        sayText(pickEggLine(lastLineRef.current));
        return;
      }
      sayText(pickPetLine(branchRef.current, situation, lastLineRef.current));
    },
    [sayText],
  );
  // A "say this" press from the dev panel (wherever it is shown).
  const devSayNonce = devSay?.nonce ?? 0;
  const devSaySeen = useRef(devSayNonce);
  useEffect(() => {
    if (!devSay || devSaySeen.current === devSay.nonce) return;
    devSaySeen.current = devSay.nonce;
    say(devSay.situation);
  }, [devSay, say]);
  const sayEgg = useCallback(
    (moment: PetEggTalk) => {
      if (awayRef.current) return;
      sayText(pickEggTalk(moment, lastLineRef.current));
    },
    [sayText],
  );
  const statusRef = useRef(status);
  statusRef.current = status;
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const hourRef = useRef(hour);
  hourRef.current = hour;

  // Arrival: "I grew!" once after an evolution, else the handed-in event,
  // else a time-of-day hello. Also remembers the stage for next time.
  const greetedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void loadSeenStage().then((seen) => {
      if (cancelled) return;
      if (justEvolved(seen, pet.stage)) say('evolved');
      else if (!greetedRef.current) {
        const hello = timeOfDaySituation(hourRef.current);
        if (!talkEvent) say(hello ?? talkSituationForStatus(statusRef.current));
      }
      greetedRef.current = true;
      void saveSeenStage(pet.stage);
    });
    return () => {
      cancelled = true;
    };
    // Re-run only when the stage changes (an evolution while on screen).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.stage]);

  // A dive / TD / find moment from the Play shell — once per event.
  const seenEventRef = useRef(0);
  useEffect(() => {
    if (!talkEvent || talkEvent.key === seenEventRef.current) return;
    seenEventRef.current = talkEvent.key;
    say(talkEvent.situation);
    onTalkConsumed?.();
  }, [talkEvent, say, onTalkConsumed]);

  // Expedition back: once per returned find.
  const saidNoteRef = useRef<string | null>(null);
  useEffect(() => {
    const note = pv.expeditionNote;
    if (!note || saidNoteRef.current === note) return;
    saidNoteRef.current = note;
    say('expedition_back');
  }, [pv.expeditionNote, say]);

  // Now and then while idle: its mood, the time of day, or chatter — as
  // often as the Chatter setting says (Off: never on its own).
  const chatter = view.settings.chatter;
  useEffect(() => {
    const range = idleTalkDelayMs(chatter, PET_IDLE_TALK_MIN_MS, PET_IDLE_TALK_MAX_MS);
    if (!range) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const wait = range.min + Math.random() * (range.max - range.min);
      timer = setTimeout(() => {
        if (sheetRef.current == null && statusRef.current === 'chilly') {
          sayEgg('keep_warm');
        } else if (sheetRef.current == null && statusRef.current !== 'sleepy' && statusRef.current !== 'choose_egg') {
          const roll = Math.random();
          const tod = timeOfDaySituation(hourRef.current);
          say(roll < 0.5 ? talkSituationForStatus(statusRef.current) : roll < 0.7 && tod ? tod : 'chatter');
        }
        schedule();
      }, wait);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [say, sayEgg, chatter]);

  // Shards ready to trade up: say so once per visit.
  const tradeSaidRef = useRef(false);
  useEffect(() => {
    if (tradeSaidRef.current) return;
    if (GRADES.some((g) => g !== 'legendary' && pv.shards[g] >= SHARDS_PER_TICKET)) {
      tradeSaidRef.current = true;
      sayEgg('trade_ready');
    }
  }, [pv.shards, sayEgg]);

  // Tap: it always talks — the coach tip out loud, then its mood, in turn.
  const [tapKey, setTapKey] = useState(0);
  const tipNextRef = useRef(true);
  const tapPet = () => {
    setTapKey((k) => k + 1);
    if (eggRef.current) {
      if (pet.egg == null) {
        setSheet('eggs');
        return;
      }
      commit((doc, now) => warmEggDoc(doc, now));
      const left = pv.stageLeftMs ?? 0;
      if (pet.warmth <= 1) sayEgg('keep_warm');
      else if (left < 60_000) sayEgg('hatching_soon');
      else say('chatter');
      return;
    }
    if (coach.action && tipNextRef.current) sayText(coach.tip);
    else say(talkSituationForStatus(status));
    tipNextRef.current = !tipNextRef.current;
  };

  /* ---------------------------------------------------------- sheets --- */

  const openIcon = (id: PetCoachIcon) => {
    if (id === 'dive') {
      setSheet(null);
      onGoDive();
      return;
    }
    if (id === 'info') setInfoTab('status');
    setSheet(id);
  };
  const pressCoach = () => {
    if (!coach.action) return;
    if (coach.action === 'hatch') {
      setSheet('eggs');
      return;
    }
    if (coach.action === 'warm') {
      tapPet();
      return;
    }
    if (coach.action === 'catch') {
      setSheet('play');
      setGame({ kind: 'catch', level: 'normal', daily: false });
      return;
    }
    const icon = PET_COACH_ICON[coach.action];
    if (icon) openIcon(icon);
  };
  const closeSheet = () => {
    setGame(null); // an unfinished round does not count
    setSheet(null);
  };

  useEffect(() => {
    if (!registerBack) return;
    registerBack({
      edgeSwipe: true,
      back: () => {
        if (settingsOpen) {
          setSettingsOpen(false);
          return true;
        }
        const step = petBackStep(sheet != null, game != null);
        if (step === 'hub') return false;
        if (step === 'close-game') setGame(null);
        else setSheet(null);
        return true;
      },
    });
    return () => registerBack(null);
  }, [registerBack, sheet, game, settingsOpen]);

  const roundClaim = useRef<{ run: GameRun | null; key: string }>({ run: null, key: '' });
  const finishRound = (run: GameRun) => (outcome: RoundOutcome, score: number) => {
    if (roundClaim.current.run !== run) {
      roundClaim.current = { run, key: `pet:${run.kind}:${run.level}:${run.daily ? 'daily' : 'free'}:${Date.now()}` };
    }
    const kind: PetRoundKind = run.kind;
    let result: PetRoundResult | null = null;
    commit((doc, now) => {
      const next = finishPetRound(doc, now, kind, outcome, { level: run.level, score, daily: run.daily }, roundClaim.current.key);
      result = next.result;
      return next.doc;
    });
    setGame(null);
    if (result) {
      const r: PetRoundResult = result;
      // A replay of the same round (background retry) comes back uncounted
      // and must not wipe the line the real win already showed.
      if (r.counted) {
        setLastResult(roundResultLine(kind, outcome, r));
        setLastRound({ key: roundClaim.current.key, score: r.score, strong: isStrongResult(r) });
      }
      // v26: a new record / unlock / buff gets the floating banner, and the
      // pet cheers (the tap hop + heart).
      if (r.newRecord) {
        onBanner?.({ title: 'NEW RECORD!', body: `${r.score} pts on ${DIFFICULTY_LABEL[r.level]} (was ${r.prevBest}).` });
        tapPet();
      }
      if (r.unlocked) onBanner?.({ title: `${DIFFICULTY_LABEL[r.unlocked]} unlocked`, body: 'A harder level is open in Play.' });
      if (r.buff) onBanner?.({ title: `${BUFF_ICON[r.buff]} ${BUFF_LABEL[r.buff]}`, body: BUFF_HOW[r.buff] });
      if (r.dailyBonusShells > 0) onBanner?.({ title: 'Daily best!', body: `+${r.dailyBonusShells} shells — come back tomorrow for a new pattern.` });
      if (r.dailyEgg) onBanner?.({ title: '🥚 Daily egg', body: 'Daily challenge passed — one more free egg today.' });
      if (r.dailyStone) onBanner?.({ title: '💎 Shine Stone', body: 'Your first daily Gold today — a Shine Stone is yours.' });
      // v25: it reacts to a pass, a skilled pass, a fail, or a bomb-out.
      const talk = !outcome.pass
        ? (outcome.bombs ?? 0) >= 3
          ? 'bombs'
          : 'fail'
        : outcome.quality >= 0.7
          ? 'skilled'
          : 'pass';
      if (!awayRef.current) sayText(pickRoundTalk(talk, lastLineRef.current));
    }
  };

  const eggColor = pet.egg ? EGG_COLOR[pet.egg] : ELEMENT_COLOR[view.legendElement];
  const revealed = pet.hero != null && pet.stage !== 'egg' && pet.stage !== 'baby';
  // v26: the pet as the mini-games draw it (existing clips only).
  const gamePet: GamePet = {
    pet,
    art,
    wear: pv.wear,
    eggColor,
    recolor: revealed ? petRecolor(pet.hero, pet.shiny, pv.dyeOn, pet.shiny_style) : null,
    glow: revealed && pet.grade ? GRADE_COLOR[pet.grade] : ELEMENT_COLOR[view.legendElement],
  };
  const shownName = petShownName(pet);
  const heroLabel = revealed && pet.hero ? gradedName(pet.grade, pet.name ?? heroName(pet.hero)) : null;
  const title =
    pet.stage === 'egg'
      ? pet.egg
        ? pet.name ?? `${EGG_LABEL[pet.egg]} egg`
        : 'Choose an egg'
      : pet.stage === 'baby'
        ? `${pet.name ?? 'Baby'}${pet.egg ? ` · ${EGG_LABEL[pet.egg]}` : ''}`
        : `${heroLabel ?? PET_STAGE_LABEL[pet.stage]} · ${PET_STAGE_LABEL[pet.stage]}${
            pet.stage === 'child' ? '' : ` · ${PET_BRANCH_LABEL[pet.branch]}`
          }`;
  const recolor = revealed ? petRecolor(pet.hero, pet.shiny, pv.dyeOn, pet.shiny_style) : null;
  const cardInfo: PetCardInfo | null =
    revealed && pet.hero
      ? {
          name: pet.name ?? heroName(pet.hero),
          hero: pet.name ? heroName(pet.hero) : null,
          ribbons: view.ribbons,
          grade: pet.grade,
          shiny: pet.shiny,
          stars: heroStars(pv.heroes[pet.hero]?.copies ?? 0),
          egg: pet.egg,
          forms: pet.forms,
          band: pet.band,
          days: Math.round((pet.total_age_ms / 86_400_000) * 10) / 10,
          dye: pv.dyeOn,
          ranks: pv.ranks,
          allStyles: ownsAllStyles(pv.heroes[pet.hero]),
          styleLabel: pet.shiny && pet.shiny_style ? SHINY_STYLE_LABEL[pet.shiny_style] : null,
          tide: pv.tide.active,
          finishKind: pet.finish_kind,
          finishColor: pet.finish_color,
          finishLabel: finishWornLabel(pet.finish_kind, pet.finish_color),
        }
      : null;
  // v26: the active medal buffs for the room corner (uses left, or Maxed aura).
  const roomBuffs = [
    pv.buffs.hearty > 0 ? { key: 'hearty', text: `${BUFF_ICON.hearty} ×${pv.buffs.hearty}`, a11y: `${BUFF_LABEL.hearty}: ${pv.buffs.hearty} dive surfaces left` } : null,
    pv.buffs.snack > 0 ? { key: 'snack', text: `${BUFF_ICON.snack} next dive`, a11y: `${BUFF_LABEL.snack}: on your next dive` } : null,
    pv.buffs.pumped > 0
      ? pv.pumped.maxed
        ? { key: 'pumped', text: `${BUFF_ICON.pumped} Maxed aura`, a11y: 'Maxed aura: Pumped adds nothing at this pounce, so it glows instead' }
        : { key: 'pumped', text: `${BUFF_ICON.pumped} ×${pv.buffs.pumped}`, a11y: `${BUFF_LABEL.pumped}: ${pv.buffs.pumped} TD waves left` }
      : null,
    pv.buffs.focused > 0 ? { key: 'focused', text: `${BUFF_ICON.focused} next trip`, a11y: `${BUFF_LABEL.focused}: on your next expedition` } : null,
  ].filter((b): b is { key: string; text: string; a11y: string } => b != null);
  const cardSprite = (
    <PetAnimSprite
      pet={pet}
      art={art}
      wear={pv.wear}
      eggColor={eggColor}
      pose={petPose(art.kit, 'idle')}
      face="e"
      startedAt={0}
      loop
      box={120}
      animate={!reduceMotion}
      recolor={recolor}
      lockColour={pet.shiny}
      foilMotion="sweep"
      reduceMotion={reduceMotion}
      reverseHost
    />
  );
  const babyLook = { ...pet, stage: 'baby' as const, line: pet.egg ? EGG_LINE[pet.egg] : pet.line };

  /* ---------------------------------------------------------- reveals --- */

  // Hatch / Child reveals queue in aging (even offline) and play here once.
  const pendingReveal = pet.reveals[revealStep] ?? null;
  const finishReveal = () => {
    const kind = pendingReveal;
    if (revealStep + 1 < pet.reveals.length) {
      setRevealStep(revealStep + 1);
    } else {
      setRevealStep(0);
      commit((doc, now) => ackPetRevealsDoc(doc, now));
    }
    if (kind === 'hatch') sayEgg('hatched');
    if (kind === 'child' && pet.grade) sayEgg(pet.shiny ? 'shiny' : (`reveal_${pet.grade}` as PetEggTalk));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to Command Hub" style={styles.backHit}>
          <PixelLabel color={PIXEL.cyan}>‹ Hub</PixelLabel>
        </Pressable>
        <PixelLabel numberOfLines={1} style={styles.title}>
          {title}
        </PixelLabel>
        <View style={styles.topActions}>
          <Pressable
            onPress={() => setSheet('den')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`The Den, ${pv.den.used} of ${pv.den.slots} slots`}
            style={styles.topButton}>
            <Text style={styles.topButtonText}>🏠</Text>
          </Pressable>
          <Pressable
            onPress={() => setSheet('menu')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Pet menu"
            style={styles.topButton}>
            <Text style={styles.topButtonText}>⋯</Text>
          </Pressable>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Divecore settings"
            style={styles.topButton}>
            <Text style={styles.topButtonText}>⚙</Text>
          </Pressable>
        </View>
      </View>

      <PetRoom
        pet={pet}
        wear={pv.wear}
        aura={pv.aura ?? view.legendElement}
        eggColor={eggColor}
        status={status}
        coach={coach}
        night={night}
        pantry={pv.pantryTotal}
        stageLeftMs={pv.stageLeftMs}
        speech={speech}
        name={shownName}
        tapKey={tapKey}
        reduceMotion={reduceMotion}
        onTapPet={tapPet}
        onCoach={pressCoach}
        recolor={recolor}
        onBadge={() => setSheet('card')}
        buffs={roomBuffs}
        maxedAura={pv.pumped.maxed}
        onPickEgg={(e) => {
          setFocusEgg(e);
          setSheet('eggs');
        }}
        tide={pv.tide.active}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
        {ICONS.map((icon) => (
          <RoomIcon
            key={icon.id}
            emoji={icon.emoji}
            label={icon.label}
            pulse={pulseIcon === icon.id}
            badge={icon.id === 'dive' && view.diveRun.active}
            onPress={() => openIcon(icon.id)}
          />
        ))}
      </ScrollView>

      <PlaySheet open={sheet === 'feed'} title={SHEET_TITLE.feed} onClose={closeSheet} reduceMotion={reduceMotion}>
        {pet.stage === 'egg' ? (
          <PixelBody>It hatches first — then it eats.</PixelBody>
        ) : (
          <FeedSheetBody view={view} commit={commit} />
        )}
        <GuideLink section="pet" onOpen={openGuide} />
      </PlaySheet>
      <PlaySheet open={sheet === 'play'} title={SHEET_TITLE.play} onClose={closeSheet} reduceMotion={reduceMotion}>
        <PlaySheetBody
          view={view}
          game={game}
          onStart={setGame}
          onRoundDone={finishRound}
          lastResult={lastResult}
          lastRound={lastRound}
          gamePet={gamePet}
          still={reduceMotion || fxQuality !== 'full'}
          onGuide={() => openGuide('games')}
        />
      </PlaySheet>
      <PlaySheet
        open={sheet === 'expedition'}
        title={SHEET_TITLE.expedition}
        onClose={closeSheet}
        reduceMotion={reduceMotion}>
        <ExpeditionSheetBody view={view} commit={commit} onGuide={openGuide} />
      </PlaySheet>
      <PlaySheet open={sheet === 'eggs'} title={SHEET_TITLE.eggs} onClose={closeSheet} reduceMotion={reduceMotion}>
        {pet.egg == null ? (
          <EggPickerBody
            view={view}
            commit={commit}
            first={focusEgg}
            onChosen={() => {
              setSheet(null);
              sayEgg('keep_warm');
            }}
          />
        ) : (
          <OddsPanel view={view} />
        )}
        <GuideLink section="eggs" onOpen={openGuide} />
      </PlaySheet>
      <PlaySheet open={sheet === 'card'} title={heroLabel ?? SHEET_TITLE.card} onClose={closeSheet} reduceMotion={reduceMotion}>
        {cardInfo ? (
          <View style={styles.cardCenter}>
            <PetCard info={cardInfo} sprite={cardSprite} width={220} animate={!reduceMotion} />
          </View>
        ) : null}
        <FinishPicker view={view} commit={commit} pet={pet} dyeOn={pv.dyeOn} reduceMotion={reduceMotion} />
        <OddsPanel view={view} />
      </PlaySheet>
      <PlaySheet open={sheet === 'menu'} title={shownName} onClose={closeSheet} reduceMotion={reduceMotion}>
        <PetMenuBody
          view={view}
          commit={commit}
          onViewCard={() => setSheet('card')}
          onOpenDen={() => setSheet('den')}
          onOpenStone={() => openStone(pet.uid > 0 ? pet.uid : null)}
          onOpenPrism={() => {
            setStoneUid(pet.uid > 0 ? pet.uid : null);
            setSheet('prism');
          }}
        />
      </PlaySheet>
      <PlaySheet open={sheet === 'den'} title={SHEET_TITLE.den} onClose={closeSheet} reduceMotion={reduceMotion}>
        <DenSheetBody
          view={view}
          commit={commit}
          gameOpen={game != null}
          reduceMotion={reduceMotion}
          onNewEgg={() => {
            setFocusEgg(null);
            setSheet('eggs');
          }}
          onOpenStone={(uid) => openStone(uid)}
          onOpenPrism={(uid) => {
            setStoneUid(uid);
            setSheet('prism');
          }}
          onViewActiveCard={() => setSheet('card')}
        />
        <GuideLink section="den" onOpen={openGuide} />
      </PlaySheet>
      <PlaySheet open={sheet === 'stone'} title={SHEET_TITLE.stone} onClose={closeSheet} reduceMotion={reduceMotion}>
        <StoneSheetBody view={view} commitSaved={commitSaved} initialUid={stoneUid} />
        <GuideLink section="stones" onOpen={openGuide} />
      </PlaySheet>
      <PlaySheet open={sheet === 'prism'} title={SHEET_TITLE.prism} onClose={closeSheet} reduceMotion={reduceMotion}>
        <StoneSheetBody view={view} commitSaved={commitSaved} initialUid={stoneUid} mode="prism" />
        <GuideLink section="tide" onOpen={openGuide} />
      </PlaySheet>
      <DivecoreSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        view={view}
        commit={commit}
        reduceMotion={reduceMotion}
        onReplayTutorial={() => onReplayTutorial?.()}
        onOpenGuide={() => openGuide('pet')}
      />
      <PlaySheet
        open={sheet === 'info'}
        title={SHEET_TITLE.info}
        onClose={closeSheet}
        reduceMotion={reduceMotion}
        header={<SheetTabs tabs={infoTabs(dev)} value={infoTab} onChange={setInfoTab} />}>
        {infoTab === 'status' ? (
          <StatusTab view={view} onGuide={openGuide} />
        ) : infoTab === 'journal' ? (
          <>
            <JournalTab view={view} commit={commit} />
            <GuideLink section="collection" onOpen={openGuide} />
          </>
        ) : infoTab === 'book' ? (
          <>
            <BookTab view={view} commit={commit} eggColor={eggColor} />
            <GuideLink section="collection" onOpen={openGuide} />
          </>
        ) : infoTab === 'hall' ? (
          <>
            <HallTab view={view} eggColor={eggColor} />
            <GuideLink section="collection" onOpen={openGuide} />
          </>
        ) : infoTab === 'style' ? (
          <StyleTab view={view} commit={commit} />
        ) : infoTab === 'guide' ? (
          <HelpTab key={guideNonce} section={guideSection} />
        ) : dev ? (
          <PetDevPanel pet={pet} commit={commit} startOpen={['pet', 'eggs']} />
        ) : null}
      </PlaySheet>
      {pendingReveal ? (
        <PetReveal
          key={`${pendingReveal}-${revealStep}`}
          kind={pendingReveal}
          lightColor={pendingReveal === 'child' ? GRADE_COLOR[pet.grade ?? 'common'] : eggColor}
          eggColor={eggColor}
          subject={<PetFigure pet={babyLook} baseBox={110} eggColor={eggColor} />}
          card={
            pendingReveal === 'child' && cardInfo ? (
              <PetCard info={cardInfo} sprite={cardSprite} width={220} animate={!reduceMotion} />
            ) : (
              <PetCard
                info={{
                  name: `${pet.egg ? EGG_LABEL[pet.egg] : ''} Baby`,
                  grade: null,
                  shiny: false,
                  stars: 0,
                  egg: pet.egg,
                  forms: [],
                  band: null,
                  days: null,
                  dye: false,
                }}
                sprite={<PetFigure pet={babyLook} baseBox={110} eggColor={eggColor} />}
                width={200}
                animate={false}
              />
            )
          }
          caption={
            pendingReveal === 'child' && cardInfo
              ? `${gradedName(pet.grade, cardInfo.name)} — ${GRADE_LABEL[pet.grade ?? 'common']}${pet.shiny ? ' ✨ shiny!' : ''}`
              : 'It hatched! Care for your Baby — its hero is revealed at 15 min.'
          }
          reduceMotion={reduceMotion}
          skip={view.settings.skipReveals}
          onDone={finishReveal}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NEON.ink },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 8,
    borderBottomWidth: ART_PT,
    borderBottomColor: PIXEL.cyan,
    backgroundColor: PIXEL.ink,
  },
  backHit: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  title: { flex: 1, textAlign: 'center' },
  topActions: { flexDirection: 'row', gap: 4 },
  topButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: ART_PT, borderColor: PIXEL.cyan },
  topButtonText: { fontSize: 18, color: PIXEL.cyan },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
    borderTopWidth: ART_PT,
    borderTopColor: PIXEL.cyan,
    backgroundColor: PIXEL.ink,
  },
  icon: { minHeight: 48 },
  iconFrame: { flexGrow: 1 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    backgroundColor: NEON.pink,
  },
  pressed: { opacity: 0.82 },
  cardCenter: { alignItems: 'center', paddingVertical: 8 },
});
