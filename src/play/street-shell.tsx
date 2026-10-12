/**
 * Street shell (emci 2026-10-11, plan https://claude.ai/artifact/5EPWjvoveBA7iTWmQaZEAv).
 *
 * Only drawn while the Streetwear art style is on; Classic keeps its shell.
 * Paint and layout only: every action calls the same handlers the Classic
 * screens use, so no rule, odds or economy changes.
 *
 *  - StreetResourceBar: Caps · Subway Tokens · Shine/Prism stones · ⚙, pinned on top.
 *  - StreetTabBar: Block · Turf War · Hideout · Locker · Corner Store (Store only
 *    while the shop is unlocked), pinned at the bottom.
 *  - StreetBlock: the home screen (replaces the Command Hub tile wall; same props).
 *  - StreetLockerTabs: Fits / Blades on top of Dress and the sword forge.
 *  - Dock + HUD slots: Turf War hands its live controls to the shell
 *    (`StreetDockFill` / `StreetHudFill`, the same pattern as dev-slot.tsx) so they
 *    stay pinned while the board fills the screen.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

import { PET_METER_MAX, type PetState } from '@/play/pet';
import { PetFigure } from '@/play/pet-figure';
import { uiDrawable, type UiPiece } from '@/art/art';
import { ClipImage } from '@/play/sheet-sprite';
import { STREET_MOTION, STREET_SIZE, tapHaptic } from '@/play/street-feel';
import { NeonButton } from '@/play/neon-ui';
import { STREET, STREET_FONT, StreetBackdrop, StreetFrame, useStreetFonts } from '@/play/street-ui';

/* ------------------------------------------------------------- slots --- */

function makeSlot() {
  let slot: ReactNode = null;
  const listeners = new Set<() => void>();
  const set = (next: ReactNode) => {
    slot = next;
    for (const l of listeners) l();
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const get = () => slot;
  function Fill({ children }: { children: ReactNode }) {
    // No dependency list on purpose: every render carries fresh handlers.
    useEffect(() => {
      set(children);
    });
    useEffect(() => () => set(null), []);
    return null;
  }
  function Outlet() {
    return <>{useSyncExternalStore(subscribe, get, get)}</>;
  }
  // A boolean snapshot: the shell (an ANCESTOR of the filling screen) must only
  // re-render when the slot empties or fills, never on each re-send of the
  // children — that would re-render the screen, re-fill, and loop forever.
  const isFilled = () => slot != null;
  function useFilled() {
    return useSyncExternalStore(subscribe, isFilled, isFilled);
  }
  return { Fill, Outlet, useFilled };
}

const dock = makeSlot();
const hud = makeSlot();
/** Turf War's live controls (Skill · Pounce · Pause · Speed · Leave). */
export const StreetDockFill = dock.Fill;
export const StreetDockOutlet = dock.Outlet;
export const useStreetDockFilled = dock.useFilled;
/** Turf War's pinned top line (wave · run caps). */
export const StreetHudFill = hud.Fill;
export const StreetHudOutlet = hud.Outlet;

/* ------------------------------------------------------------ pieces --- */

function KitIcon({ name, size }: { name: UiPiece; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <ClipImage drawable={uiDrawable(name)} />
    </View>
  );
}

/** A number that rolls to its new value (400ms ease-out); still under Reduce Motion. */
function useCountUp(value: number, still: boolean): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (still || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / STREET_MOTION.countUp);
      setShown(Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, still]);
  return shown;
}

function Resource({ icon, label, value, a11y }: { icon: UiPiece; label: string; value: string; a11y: string }) {
  return (
    <View style={styles.res} accessible accessibilityLabel={a11y}>
      <KitIcon name={icon} size={22} />
      <Text style={styles.resText} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.resLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------ resource bar --- */

export function StreetResourceBar({
  caps,
  tokens,
  tokensMax,
  shine,
  prism,
  reduceMotion,
  onSettings,
}: {
  caps: number;
  tokens: number;
  tokensMax: number;
  shine: number;
  prism: number;
  reduceMotion: boolean;
  onSettings: () => void;
}) {
  useStreetFonts();
  const { width } = useWindowDimensions();
  const compact = width < STREET_SIZE.compactWidth;
  const shownCaps = useCountUp(caps, reduceMotion);
  return (
    <StreetFrame piece="resbar" style={styles.resbar}>
      <Resource icon="nav-cur-caps" label={compact ? '' : 'Caps'} value={shownCaps.toLocaleString('en-US')} a11y={`${caps} Caps`} />
      <Resource
        icon="nav-cur-token"
        label=""
        value={`${tokens}/${tokensMax}`}
        a11y={`${tokens} of ${tokensMax} Subway Tokens`}
      />
      {shine > 0 ? <Resource icon="nav-cur-shine" label="" value={String(shine)} a11y={`${shine} Shine Stones`} /> : null}
      {prism > 0 ? <Resource icon="nav-cur-prism" label="" value={String(prism)} a11y={`${prism} Prism Stones`} /> : null}
      <Pressable
        onPress={() => {
          tapHaptic();
          onSettings();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={({ pressed }) => [styles.gear, pressed && styles.squash]}>
        <KitIcon name="nav-settings" size={26} />
      </Pressable>
    </StreetFrame>
  );
}

/* ----------------------------------------------------------- tab bar --- */

export type StreetTab = 'block' | 'turf' | 'hideout' | 'locker' | 'store';

const TAB_DEF: Record<StreetTab, { label: string; icon: UiPiece }> = {
  block: { label: 'Block', icon: 'nav-tab-block' },
  turf: { label: 'Turf War', icon: 'nav-tab-turf' },
  hideout: { label: 'Hideout', icon: 'nav-tab-hideout' },
  locker: { label: 'Locker', icon: 'nav-tab-locker' },
  store: { label: 'Store', icon: 'nav-tab-store' },
};

function TabButton({
  tab,
  active,
  compact,
  reduceMotion,
  onPress,
}: {
  tab: StreetTab;
  active: boolean;
  compact: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const lift = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    lift.value = reduceMotion
      ? active
        ? 1
        : 0
      : withTiming(active ? 1 : 0, { duration: STREET_MOTION.tab, easing: Easing.out(Easing.cubic) });
  }, [active, lift, reduceMotion]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * lift.value }, { scale: 1 + 0.12 * lift.value }],
  }));
  const def = TAB_DEF[tab];
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={def.label}
      style={({ pressed }) => [styles.tab, pressed && styles.squash]}>
      <Animated.View style={iconStyle}>
        <KitIcon name={def.icon} size={30} />
      </Animated.View>
      {compact ? null : (
        <Text style={[styles.tabLabel, active && styles.tabLabelOn]} numberOfLines={1}>
          {def.label}
        </Text>
      )}
      <View style={[styles.tabUnder, active && styles.tabUnderOn]} />
    </Pressable>
  );
}

export function StreetTabBar({
  active,
  showStore,
  reduceMotion,
  bottomInset,
  onTab,
}: {
  active: StreetTab | null;
  showStore: boolean;
  reduceMotion: boolean;
  bottomInset: number;
  onTab: (tab: StreetTab) => void;
}) {
  useStreetFonts();
  const { width } = useWindowDimensions();
  const compact = width < STREET_SIZE.compactWidth;
  const tabs: StreetTab[] = showStore ? ['block', 'turf', 'hideout', 'locker', 'store'] : ['block', 'turf', 'hideout', 'locker'];
  return (
    <View style={[styles.tabWrap, { paddingBottom: Math.max(bottomInset, 6) }]} accessibilityRole="tablist">
      <StreetBackdrop piece="tabbar" />
      {tabs.map((tab) => (
        <TabButton
          key={tab}
          tab={tab}
          active={active === tab}
          compact={compact}
          reduceMotion={reduceMotion}
          onPress={() => onTab(tab)}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------ locker --- */

export function StreetLockerTabs({ active, onFits, onBlades }: { active: 'fits' | 'blades'; onFits: () => void; onBlades: () => void }) {
  return (
    <View style={styles.lockerTabs}>
      <View style={styles.lockerTab}>
        <NeonButton label="Fits" variant={active === 'fits' ? 'primary' : 'secondary'} onPress={onFits} />
      </View>
      <View style={styles.lockerTab}>
        <NeonButton label="Blades" variant={active === 'blades' ? 'primary' : 'secondary'} onPress={onBlades} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- block --- */

function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'mustard' | 'red' }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View style={styles.meterRow} accessible accessibilityLabel={`${label} ${value} of ${max}`}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.meter}>
        <View style={[styles.meterFill, { width: `${pct * 100}%`, backgroundColor: tone === 'red' ? STREET.red : STREET.mustard }]} />
      </View>
    </View>
  );
}

/** Staggered rise-in for The Block's panels (40ms apart); still under Reduce Motion. */
function Rise({ index, still, children }: { index: number; still: boolean; children: ReactNode }) {
  const t = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      t.value = 1;
      return;
    }
    t.value = 0;
    const id = setTimeout(() => {
      t.value = withTiming(1, { duration: STREET_MOTION.push, easing: Easing.out(Easing.cubic) });
    }, index * STREET_MOTION.stagger);
    return () => clearTimeout(id);
  }, [index, still, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * 12 }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function StreetBlock({
  pet,
  wave,
  diveActive,
  charges,
  chargesMax,
  reduceMotion,
  onHideout,
  onTurf,
  onUnderground,
  children,
}: {
  pet: PetState | null;
  wave: number | null;
  diveActive: boolean;
  charges: number;
  chargesMax: number;
  reduceMotion: boolean;
  onHideout: () => void;
  onTurf: () => void;
  onUnderground: () => void;
  children?: ReactNode;
}) {
  useStreetFonts();
  const hungry = pet != null && pet.stage !== 'egg' && pet.hunger <= 1;
  return (
    <View style={styles.block}>
      <Rise index={0} still={reduceMotion}>
        <StreetFrame piece="header" style={styles.plate}>
          <Text style={styles.eyebrow}>DIVECORE</Text>
          <Text style={styles.title}>The Block</Text>
        </StreetFrame>
      </Rise>
      {pet ? (
        <Rise index={1} still={reduceMotion}>
          <StreetFrame piece="panel" style={styles.petCard}>
            <View style={styles.petFigure}>
              <PetFigure pet={pet} baseBox={72} eggColor={STREET.mustard} reduceMotion={reduceMotion} />
            </View>
            <View style={styles.petInfo}>
              <Text style={styles.cardTitle}>{pet.stage === 'egg' ? 'Your egg' : 'Your pet'}</Text>
              {pet.stage === 'egg' ? null : (
                <>
                  <Meter label="Hunger" value={pet.hunger} max={PET_METER_MAX} tone={hungry ? 'red' : 'mustard'} />
                  <Meter label="Mood" value={pet.mood} max={PET_METER_MAX} tone="mustard" />
                </>
              )}
            </View>
          </StreetFrame>
        </Rise>
      ) : null}
      <Rise index={2} still={reduceMotion}>
        <NeonButton label={hungry ? 'Feed in the Hideout' : 'Go to the Hideout'} onPress={onHideout} />
      </Rise>
      <Rise index={3} still={reduceMotion}>
        <View style={styles.tiles}>
          <Pressable
            onPress={() => {
              tapHaptic();
              onTurf();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Turf War, wave ${wave ?? 1} next`}
            style={({ pressed }) => [styles.tileWrap, pressed && styles.squash]}>
            <StreetFrame piece="panel" style={styles.tile}>
              <KitIcon name="nav-tab-turf" size={40} />
              <Text style={styles.tileTitle}>Turf War</Text>
              <Text style={styles.tileSub}>Wave {wave ?? 1} next</Text>
            </StreetFrame>
          </Pressable>
          <Pressable
            onPress={() => {
              tapHaptic();
              onUnderground();
            }}
            accessibilityRole="button"
            accessibilityLabel={diveActive ? 'Underground, dive in progress' : `Underground, ${charges} of ${chargesMax} Subway Tokens`}
            style={({ pressed }) => [styles.tileWrap, pressed && styles.squash]}>
            <View style={styles.roomTile}>
              {/* Cover-fit the portrait room art: full width, centred, top and bottom cropped. */}
              <View style={styles.roomArt}>
                <ClipImage drawable={uiDrawable('room-underground')} />
              </View>
              <View style={styles.roomShade}>
                <Text style={styles.tileTitle}>Underground</Text>
                <Text style={styles.tileSub}>{diveActive ? 'Dive in progress' : `${charges}/${chargesMax} tokens`}</Text>
              </View>
            </View>
          </Pressable>
        </View>
      </Rise>
      {children}
    </View>
  );
}

/* ----------------------------------------------------------- styles --- */

const styles = StyleSheet.create({
  squash: { transform: [{ scaleX: 0.96 }, { scaleY: 0.93 }] },
  resbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: STREET_SIZE.resourceBar,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginHorizontal: 8,
    marginTop: 4,
  },
  res: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  resText: { fontFamily: STREET_FONT.bold, fontSize: 15, color: STREET.paper, fontVariant: ['tabular-nums'] },
  resLabel: { fontFamily: STREET_FONT.regular, fontSize: 11, color: STREET.muted },
  gear: { marginLeft: 'auto', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: 10,
    paddingHorizontal: 10,
    minHeight: STREET_SIZE.tabBar,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, minHeight: STREET_SIZE.tap },
  tabLabel: { fontFamily: STREET_FONT.bold, fontSize: 11, color: STREET.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tabLabelOn: { color: STREET.mustard },
  tabUnder: { height: 3, width: 22, marginTop: 2, backgroundColor: 'transparent' },
  tabUnderOn: { backgroundColor: STREET.mustard },
  lockerTabs: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  lockerTab: { flex: 1 },
  block: { gap: 12 },
  plate: { paddingHorizontal: 36, paddingVertical: 12, alignItems: 'center' },
  eyebrow: { fontFamily: STREET_FONT.regular, fontSize: 11, letterSpacing: 1.8, color: STREET.mustard },
  title: { fontFamily: STREET_FONT.bold, fontSize: STREET_SIZE.type.title, color: STREET.paper, textTransform: 'uppercase' },
  petCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 22 },
  petFigure: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  petInfo: { flex: 1, gap: 6, minWidth: 0 },
  cardTitle: { fontFamily: STREET_FONT.bold, fontSize: STREET_SIZE.type.heading, color: STREET.paper },
  meterRow: { gap: 2 },
  meterLabel: { fontFamily: STREET_FONT.regular, fontSize: 11, color: STREET.muted, textTransform: 'uppercase', letterSpacing: 1 },
  meter: { height: 10, backgroundColor: '#000', borderWidth: 2, borderColor: '#000' },
  meterFill: { height: '100%' },
  tiles: { flexDirection: 'row', gap: 10 },
  tileWrap: { flex: 1 },
  tile: { alignItems: 'center', gap: 4, padding: 20, minHeight: 132, justifyContent: 'center' },
  tileTitle: { fontFamily: STREET_FONT.bold, fontSize: 15, color: STREET.paper, textTransform: 'uppercase' },
  tileSub: { fontFamily: STREET_FONT.regular, fontSize: 12, color: STREET.muted },
  roomTile: { height: 132, borderWidth: 3, borderColor: '#000', overflow: 'hidden', justifyContent: 'center' },
  roomArt: { width: '100%', aspectRatio: 256 / 320 },
  roomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(12, 12, 14, 0.78)',
  },
});
