/**
 * Street shell (emci 2026-10-11, plan https://claude.ai/artifact/5EPWjvoveBA7iTWmQaZEAv).
 *
 * Only drawn while the Streetwear art style is on; Classic keeps its shell.
 * Paint and layout only: every action calls the same handlers the Classic
 * screens use, so no rule, odds or economy changes.
 *
 *  - StreetResourceBar: Caps · Subway Tokens · Shine/Prism stones · Claim · ⚙, pinned on top.
 *  - StreetTabBar: Hideout · Turf War · Locker · Store (Store only while the shop is
 *    unlocked), pinned at the bottom. Hideout is home (Phase 3 removed the Block).
 *  - StreetLockerTabs: Fits / Blades on top of Dress and the sword forge.
 *  - Dock + HUD slots: Turf War hands its live controls to the shell
 *    (`StreetDockFill` / `StreetHudFill`, the same pattern as dev-slot.tsx) so they
 *    stay pinned while the board fills the screen.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

import { uiDrawable, type UiPiece } from '@/art/art';
import { ClipImage } from '@/play/sheet-sprite';
import { STREET_MOTION, STREET_SIZE, tapHaptic } from '@/play/street-feel';
import { NeonButton } from '@/play/neon-ui';
import { tipAnchorRef } from '@/play/ftue/tip-anchors';
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
  claim,
  onSettings,
}: {
  caps: number;
  tokens: number;
  tokensMax: number;
  shine: number;
  prism: number;
  reduceMotion: boolean;
  /** Basecore research: "Claim" when ready, else the wait ("~42m"). Phase 3: lives here, not on a Block. */
  claim?: { ready: boolean; label: string; onPress: () => void };
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
      {claim ? (
        <Pressable
          disabled={!claim.ready}
          onPress={() => {
            tapHaptic();
            claim.onPress();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={claim.ready ? 'Claim Basecore research' : `Basecore research, next find in ${claim.label}`}
          accessibilityState={{ disabled: !claim.ready }}
          style={({ pressed }) => [styles.claim, claim.ready && styles.claimReady, pressed && claim.ready && styles.squash]}>
          <Text style={[styles.claimText, claim.ready && styles.claimTextReady]} numberOfLines={1}>
            {claim.ready ? 'CLAIM' : claim.label}
          </Text>
        </Pressable>
      ) : null}
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

export type StreetTab = 'hideout' | 'turf' | 'locker' | 'store';

const TAB_DEF: Record<StreetTab, { label: string; icon: UiPiece }> = {
  hideout: { label: 'Hideout', icon: 'nav-tab-hideout' },
  turf: { label: 'Turf War', icon: 'nav-tab-turf' },
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
      ref={tab === 'turf' ? tipAnchorRef('turf') : undefined}
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
  const tabs: StreetTab[] = showStore ? ['hideout', 'turf', 'locker', 'store'] : ['hideout', 'turf', 'locker'];
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
  gear: { marginLeft: 6, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  claim: { marginLeft: 'auto', paddingHorizontal: 8, height: 28, justifyContent: 'center', borderWidth: 2, borderColor: '#000', backgroundColor: '#2a2a33' },
  claimReady: { backgroundColor: STREET.mustard },
  claimText: { fontFamily: STREET_FONT.bold, fontSize: 12, color: STREET.muted, letterSpacing: 0.4 },
  claimTextReady: { color: '#111' },
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
});
