/**
 * Hideout rails (feature/hideout-rails, 2026-10-14) — two floating rails over the room's edges.
 *
 *   LEFT  : the room's actions as icon buttons (Play · Stash · Underground · Explore; Sleep · Light · Back;
 *           Back · Up). They replace the in-room tap spots, their labels and tap rects.
 *   RIGHT : the room switcher (+ Call / Away). The selected room is yellow; locked rooms are dimmed with a lock.
 *           Scrolls when there are more than 5 items; a rail never grows the layout (absolute, capped height).
 *
 * Press effect = the button's own pressed piece + a small squash, nothing else. The coach pulse lives on
 * the rail button (a gentle breathe under Reduce Motion, never a still ring unless in-game Motion is Off).
 * What each rail shows lives in `hideout-rails-model.ts` (pure, pinned by `check:hideout-rails`).
 */
import { useEffect } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BAR_ART, BAR_MARKER_ART, CALL_ICON_ART, LOCK_ICON_ART, RAIL_ICON_ART } from '@/play/hideout-art';
import {
  RAIL_BUTTON_PT,
  RAIL_EDGE_PT,
  RAIL_GAP_PT,
  leftRailActions,
  railLabelPt,
  railMaxHeight,
  railRooms,
  railScrolls,
  type RailAction,
  type RailSpot,
} from '@/play/hideout-rails-model';
import { roomDef, type HideoutRoomId, type HideoutState } from '@/play/hideout-progress';
import { PIXEL, pixelRenderStyle } from '@/play/pixel-theme';
import { tapHaptic } from '@/play/street-feel';
import { tipAnchorRef } from '@/play/ftue/tip-anchors';
import { countOnce } from '@/play/play-counters';
import { STREET_FONT, StreetFrame, streetButtonPiece, streetButtonText } from '@/play/street-ui';

/** The coach pulse, on the button itself. */
function RailPulse({ still, gentle }: { still: boolean; gentle: boolean }) {
  const t = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(t);
    if (still) {
      t.value = 1;
      return;
    }
    const low = gentle ? 0.6 : 0.35;
    const ms = gentle ? 1400 : 700;
    t.value = withRepeat(
      withSequence(
        withTiming(low, { duration: ms, reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: ms, reduceMotion: ReduceMotion.Never }),
      ),
      -1,
    );
    return () => cancelAnimation(t);
  }, [still, gentle, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pulse, style]} />;
}

function RailButton({
  icon,
  label,
  selected = false,
  dim = false,
  lock = false,
  marker = false,
  pulse = false,
  still,
  gentle,
  role,
  a11yLabel,
  a11yHint,
  onPress,
  anchor,
}: {
  icon: unknown;
  label: string;
  selected?: boolean;
  dim?: boolean;
  lock?: boolean;
  marker?: boolean;
  pulse?: boolean;
  still: boolean;
  gentle: boolean;
  role: 'tab' | 'button';
  a11yLabel: string;
  a11yHint?: string;
  onPress: () => void;
  anchor?: (node: View | null) => void;
}) {
  const variant = selected || pulse ? 'primary' : 'secondary';
  return (
    <Pressable
      ref={anchor}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      accessibilityRole={role}
      accessibilityState={role === 'tab' ? { selected } : { disabled: dim }}
      accessibilityLabel={a11yLabel}
      accessibilityHint={a11yHint}
      hitSlop={{ left: 2, right: 2 }}
      style={({ pressed }) => [styles.btn, pressed && styles.squash]}>
      {({ pressed }) => (
        <StreetFrame piece={streetButtonPiece(variant, pressed)} style={[styles.face, dim && styles.dim]}>
          {pulse ? <RailPulse still={still} gentle={gentle} /> : null}
          <Image source={icon as number} style={styles.icon} contentFit="contain" transition={0} />
          <Text style={[styles.label, { color: streetButtonText(variant), fontSize: railLabelPt(label), lineHeight: railLabelPt(label) + 2 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.1}>
            {label}
          </Text>
          {marker ? (
            <View style={styles.marker}>
              <Image source={BAR_MARKER_ART} style={styles.badge16} contentFit="contain" transition={0} />
            </View>
          ) : null}
          {lock ? (
            <View style={styles.lock}>
              <Image source={LOCK_ICON_ART} style={styles.badge14} contentFit="contain" transition={0} />
            </View>
          ) : null}
        </StreetFrame>
      )}
    </Pressable>
  );
}

export type HideoutRailsProps = {
  hideout: HideoutState;
  /** The room on screen. */
  viewed: HideoutRoomId;
  /** Where the pet is (its marker shows on that room's button). */
  petRoom: HideoutRoomId;
  /** The stage height: caps how tall a rail may be. */
  stageH: number;
  /** Spot pressed (Play / Stash / Underground / Explore). */
  onSpot: (spot: RailSpot) => void;
  onLamp: () => void;
  onView: (room: HideoutRoomId) => void;
  /** A locked room / action was tapped: open its build sheet (the only way to it once the rail covers the tease). */
  onTease: () => void;
  onCall: () => void;
  away: boolean;
  callA11y: string;
  /** Coach pulse: which action should breathe. */
  pulse: RailSpot | null;
  /** Short status per action (read by VoiceOver): "Ride in progress", "Away". */
  notes: Partial<Record<RailSpot, string>>;
  nightLamp: { night: boolean; on: boolean };
  still: boolean;
  gentle: boolean;
  /** Circle visits (roadmap step 6): when set, the Hideout room's rail ends with Circle. */
  onCircle?: () => void;
  /** In a friend's Hideout (step 6): nothing on the rails (their rooms are not yours). The room keeps its rail
   * clearance, so the pet's walk bounds never jump when a visit starts or ends. */
  hidden?: boolean;
};

export function HideoutRails(props: HideoutRailsProps) {
  const { hideout, viewed, petRoom, stageH, onSpot, onLamp, onView, onTease, onCall, away, callA11y, pulse, notes, nightLamp, still, gentle, onCircle } = props;
  const actions = leftRailActions(viewed, hideout, { circle: onCircle != null });
  const rooms = railRooms(hideout, viewed, petRoom, (id) => roomDef(id).label);
  const scrolls = railScrolls(rooms.length);
  const maxH = railMaxHeight(stageH);
  const petLabel = `Pet is in ${roomDef(petRoom).label}`;
  // The pet visits only a built room: Call is dimmed in one still being built (it opens that room's build sheet).
  const callable = hideout.rooms_unlocked[viewed] === true;
  if (props.hidden) return null;

  const press = (a: RailAction) => {
    // A dimmed action never runs; a dimmed way out of a room (Up to a locked room) opens that room's build sheet.
    if (a.dim) {
      if (a.kind === 'view') onTease();
      return;
    }
    countOnce('rail_action');
    if (a.kind === 'spot') onSpot(a.spot);
    else if (a.kind === 'lamp') onLamp();
    else if (a.kind === 'circle') onCircle?.();
    else onView(a.room);
  };
  const actionLabel = (a: RailAction): string => {
    if (a.kind === 'spot') {
      const note = notes[a.spot];
      return `${a.label}${note ? `, ${note}` : ''}`;
    }
    if (a.kind === 'lamp') return nightLamp.night ? (nightLamp.on ? 'Light, on, tap to dim' : 'Light, off, tap to light') : 'Light';
    if (a.kind === 'circle') return 'Circle visits';
    return a.dim ? `${a.label}, locked` : a.label;
  };

  const roomButtons = (
    <>
      {rooms.map((r) => (
        <RailButton
          key={r.id}
          icon={BAR_ART[r.id]}
          label={r.label}
          selected={r.selected}
          dim={r.locked}
          lock={r.locked}
          marker={r.petHere}
          still={still}
          gentle={gentle}
          role="tab"
          a11yLabel={`${r.label}${r.petHere ? ', pet is here' : ''}${r.locked ? ', locked' : ''}`}
          onPress={() => (r.locked ? onTease() : onView(r.id))}
        />
      ))}
      <RailButton
        icon={CALL_ICON_ART}
        label={away ? 'Away' : 'Call'}
        still={still}
        gentle={gentle}
        role="button"
        dim={!away && !callable}
        a11yLabel={callA11y}
        onPress={callable || away ? onCall : onTease}
      />
    </>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.rail, styles.left, { maxHeight: maxH }]} pointerEvents="box-none" accessibilityLabel="Room actions">
        {actions.map((a) => (
          <RailButton
            key={a.id}
            icon={RAIL_ICON_ART[a.icon]}
            label={a.label}
            dim={a.dim}
            lock={a.dim}
            pulse={a.kind === 'spot' && pulse === a.spot}
            still={still}
            gentle={gentle}
            role="button"
            a11yLabel={actionLabel(a)}
            a11yHint={a.dim ? 'Locked' : undefined}
            onPress={() => press(a)}
            anchor={a.kind === 'spot' && a.spot === 'dive' ? tipAnchorRef('hatch') : undefined}
          />
        ))}
      </View>
      <View style={[styles.rail, styles.right, { maxHeight: maxH }]} pointerEvents="box-none" accessibilityRole="tablist" accessibilityLabel={`Rooms. ${petLabel}`}>
        <Text accessibilityLiveRegion="polite" style={styles.live}>
          {petLabel}
        </Text>
        {scrolls ? (
          <ScrollView
            style={{ maxHeight: maxH }}
            contentContainerStyle={styles.column}
            showsVerticalScrollIndicator={false}
            scrollEnabled>
            {roomButtons}
          </ScrollView>
        ) : (
          <View style={styles.column}>{roomButtons}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', top: RAIL_EDGE_PT, width: RAIL_BUTTON_PT, gap: RAIL_GAP_PT },
  left: { left: RAIL_EDGE_PT },
  right: { right: RAIL_EDGE_PT },
  column: { gap: RAIL_GAP_PT },
  btn: { width: RAIL_BUTTON_PT, height: RAIL_BUTTON_PT },
  squash: { transform: [{ scale: 0.95 }] },
  face: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 3 },
  dim: { opacity: 0.55 },
  icon: { width: 24, height: 24, ...pixelRenderStyle },
  label: { fontFamily: STREET_FONT.bold, fontSize: 10, lineHeight: 12, marginTop: 1, maxWidth: RAIL_BUTTON_PT - 6 },
  pulse: { borderWidth: 2, borderColor: PIXEL.cyan, borderStyle: 'dashed' },
  marker: { position: 'absolute', right: -4, top: -6, width: 16, height: 16 },
  lock: { position: 'absolute', left: -4, top: -6, width: 14, height: 14 },
  badge16: { width: 16, height: 16, ...pixelRenderStyle },
  badge14: { width: 14, height: 14, ...pixelRenderStyle },
  live: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
