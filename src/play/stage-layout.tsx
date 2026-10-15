/**
 * Stage layout — the one frame every Divecore game screen uses (Phase 1, emci 2026-10-14).
 * Spec: docs/divecore-layout-spec.md · rule: .cursor/rules/stage-bounds.mdc · gate: check:stage-bounds.
 *
 *   safe top · TopBar · NoticeLane · STAGE · ActionDock · TabBar (or bottom pad)
 *   + FloatLayer (tips, sheets, toasts) + ModalLayer (confirms, reveals)
 *
 * The STAGE (room, board, picture, playfield) gets a size computed ONCE from the window size and
 * the safe area — before first paint, never from content. A notice, a tip, pause or loading can
 * not change it; only a rotation or a window-size change recomputes it (`useStageFrame`).
 * Region heights live in REGIONS below; Phase 1 uses today's bar heights ("interim"), the spec's
 * target heights land with the content trims of later phases.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoachTipLayer } from '@/play/ftue/coach-tip-layer';
import type { CoachTipDef } from '@/play/ftue/coach-tips';
import { HELP_COLUMN, HelpButton, HelpSheet } from '@/play/help/help-sheet';
import type { HelpId } from '@/play/help/help-content';
import { NoticeLane } from '@/play/notify/notice-lane';
import type { CoachTipId } from '@/play/play-settings';
import {
  SPACE,
  computeStageFrame,
  layoutRegions,
  type GameScreenId,
  type Insets,
  type StageFrame,
} from '@/play/stage-frame';

export {
  REGIONS,
  SPACE,
  TAP_MIN,
  TAP_PRIMARY,
  computeStageFrame,
  layoutRegions,
  tabBarHeight,
  type GameScreenId,
  type Insets,
  type Rect,
  type ScreenContentState,
  type StageFrame,
} from '@/play/stage-frame';

/**
 * The stage frame for a screen, computed during render (so it exists before first paint) and
 * frozen: the safe area is read once and kept until the window size changes (rotation, split
 * view). Entering immersive mode, a notice, pause or loading never recomputes it.
 */
export function useStageFrame(id: GameScreenId): StageFrame {
  const window = useWindowDimensions();
  const liveInsets = useSafeAreaInsets();
  const key = `${id}:${window.width}x${window.height}`;
  const [held, setHeld] = useState(() => ({
    key,
    frame: computeStageFrame(id, window, pickInsets(liveInsets)),
  }));
  if (held.key !== key) {
    // A new screen id or a new window size (rotation, split view): the only recompute.
    const next = { key, frame: computeStageFrame(id, window, pickInsets(liveInsets)) };
    setHeld(next);
    return next.frame;
  }
  return held.frame;
}

function pickInsets(i: Insets): Insets {
  return { top: i.top, bottom: i.bottom, left: i.left, right: i.right };
}

/**
 * A game screen: fixed regions from `frame`. Content changes inside a region; a region never
 * changes size. `notice` is the screen's idle line in the NoticeLane (a queued `notify()` notice
 * replaces it for its few seconds). `float` sits over the stage + dock (tips, sheets); `modal` over everything.
 * Nothing but stage content goes in `stage` (check:stage-bounds).
 */
export function GameScreen({
  frame,
  topBar,
  notice,
  stage,
  dock,
  tabBar,
  float,
  modal,
  fadeKey,
  reduceMotion = false,
  background,
  stageStyle,
  help,
  tip,
  onTipSeen,
}: {
  frame: StageFrame;
  topBar?: ReactNode;
  notice?: ReactNode;
  stage: ReactNode;
  dock?: ReactNode;
  tabBar?: ReactNode;
  float?: ReactNode;
  modal?: ReactNode;
  /** Fade the notice + stage + dock in when this changes (tab switch); bars stay put. */
  fadeKey?: string;
  reduceMotion?: boolean;
  background?: string;
  stageStyle?: StyleProp<ViewStyle>;
  /** Phase 4: the one "?" for this screen (right end of the NoticeLane) and its help entry. */
  help?: HelpId;
  /** Phase 4: the coach tip showing now (ring + words, never blocks input). Any touch calls `onTipSeen`. */
  tip?: CoachTipDef | null;
  onTipSeen?: (id: CoachTipId) => void;
}) {
  const r = layoutRegions(frame);
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  // A different help entry (Locker → Blades) starts closed.
  useEffect(() => setHelpOpen(false), [help]);
  const [tipShown, setTipShown] = useState(false);
  const middle = (
    <>
      <View style={[styles.region, { height: r.notice.height }]}>
        {/* Phase 2: the NoticeLane shows a queued notice, else this screen's idle line. */}
        <NoticeLane height={r.notice.height} idle={notice} reserveRight={help ? HELP_COLUMN : 0} />
        {help ? (
          <HelpButton laneHeight={r.notice.height} open={helpOpen} onPress={() => setHelpOpen((v) => !v)} />
        ) : null}
      </View>
      <View style={[styles.region, styles.stage, { width: r.stage.width, height: r.stage.height }, stageStyle]}>
        {stage}
      </View>
      <View style={[styles.region, { height: r.dock.height }]}>{dock}</View>
    </>
  );
  return (
    <View
      style={[styles.screen, background ? { backgroundColor: background } : null]}
      // A coach tip is dismissed by any touch; the touch itself still reaches what was tapped.
      onTouchStart={tip && tipShown && onTipSeen ?() => onTipSeen(tip.id) : undefined}>
      <View style={{ height: frame.insets.top }} />
      <View style={[styles.region, { height: r.topBar.height }]}>{topBar}</View>
      {fadeKey != null ? (
        <Animated.View key={fadeKey} entering={FadeIn.duration(reduceMotion ? 120 : 180).reduceMotion(ReduceMotion.Never)}>
          {middle}
        </Animated.View>
      ) : (
        middle
      )}
      <View style={[styles.region, { height: r.bottom.height }]}>{tabBar}</View>
      {float != null ? (
        <View pointerEvents="box-none" style={[styles.float, { top: r.notice.y, height: r.notice.height + r.stage.height + r.dock.height }]}>
          {float}
        </View>
      ) : null}
      {help && helpOpen ? (
        <View pointerEvents="box-none" style={[styles.float, { top: r.notice.y + r.notice.height, height: r.stage.height + r.dock.height }]}>
          <HelpSheet id={help} top={SPACE.s} onClose={closeHelp} />
        </View>
      ) : null}
      {tip ? <CoachTipLayer key={tip.id} tip={tip} onShown={setTipShown} /> : null}
      {modal != null ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {modal}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  region: { flexGrow: 0, flexShrink: 0, overflow: 'hidden' },
  stage: { position: 'relative' },
  float: { position: 'absolute', left: 0, right: 0 },
});
