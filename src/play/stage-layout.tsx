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
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type GameScreenId = 'hideout' | 'turf-setup' | 'turf-wave' | 'dive' | 'pet-game' | 'list';

export type Insets = { top: number; bottom: number; left: number; right: number };

/** Spacing scale (pt) — the only spacing values game screens use. */
export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;
/** Minimum tap target (Apple HIG 44×44 pt); primary buttons are 48. */
export const TAP_MIN = 44;
export const TAP_PRIMARY = 48;

/** Street tab bar: 60 pt of content + the home-indicator inset (at least 6). */
export function tabBarHeight(bottomInset: number): number {
  return 60 + Math.max(bottomInset, 6);
}

type RegionSpec = {
  topBar: number;
  notice: number;
  /** ActionDock height; a function when it depends on the bottom inset. */
  dock: number | ((bottomInset: number) => number);
  /** true: a TabBar closes the screen (it carries the bottom inset). */
  tabBar: boolean;
  /** No tab bar: the bottom inset is a pad under the dock (0 when the dock carries it itself). */
  bottomPad: 'inset' | 'none';
};

/**
 * Region heights per screen (pt). Interim Phase 1 values = today's bars, measured at 430×932 and
 * 375×667 (docs/divecore-audit/measured.md). Turf War keeps ONE stage for setup and wave: the wave
 * dock takes the setup dock + tab bar height, so the board never moves at the screen switch.
 */
export const REGIONS: Record<GameScreenId, RegionSpec> = {
  hideout: { topBar: 56, notice: 40, dock: 120, tabBar: true, bottomPad: 'none' },
  'turf-setup': { topBar: 56, notice: 40, dock: 64, tabBar: true, bottomPad: 'none' },
  'turf-wave': { topBar: 56, notice: 40, dock: (b) => 64 + tabBarHeight(b), tabBar: false, bottomPad: 'none' },
  dive: { topBar: 109, notice: 28, dock: 258, tabBar: false, bottomPad: 'inset' },
  'pet-game': { topBar: 88, notice: 28, dock: 208, tabBar: false, bottomPad: 'inset' },
  list: { topBar: 56, notice: 40, dock: 0, tabBar: true, bottomPad: 'none' },
};

export type Rect = { x: number; y: number; width: number; height: number };

export type StageFrame = {
  id: GameScreenId;
  window: { width: number; height: number };
  insets: Insets;
  topBar: Rect;
  notice: Rect;
  stage: Rect;
  dock: Rect;
  /** TabBar region, or the bottom pad on fullscreen screens (height may be 0). */
  bottom: Rect;
};

/** Pure: every region's rect for a screen at a window size + safe area. */
export function computeStageFrame(
  id: GameScreenId,
  window: { width: number; height: number },
  insets: Insets,
): StageFrame {
  const spec = REGIONS[id];
  const w = Math.max(0, window.width - insets.left - insets.right);
  const x = insets.left;
  const dockH = typeof spec.dock === 'function' ? spec.dock(insets.bottom) : spec.dock;
  const bottomH = spec.tabBar ? tabBarHeight(insets.bottom) : spec.bottomPad === 'inset' ? insets.bottom : 0;
  const topBarY = insets.top;
  const noticeY = topBarY + spec.topBar;
  const stageY = noticeY + spec.notice;
  const stageH = Math.max(0, window.height - stageY - dockH - bottomH);
  const dockY = stageY + stageH;
  return {
    id,
    window: { width: window.width, height: window.height },
    insets,
    topBar: { x, y: topBarY, width: w, height: spec.topBar },
    notice: { x, y: noticeY, width: w, height: spec.notice },
    stage: { x, y: stageY, width: w, height: stageH },
    dock: { x, y: dockY, width: w, height: dockH },
    bottom: { x, y: dockY + dockH, width: w, height: bottomH },
  };
}

/** What a screen may be showing. None of it is an input to the frame — that is the point. */
export type ScreenContentState = { notice?: boolean; tip?: boolean; paused?: boolean; loading?: boolean };

/**
 * The rects GameScreen draws. Takes the content state only so the gate can prove it is ignored:
 * the stage is identical with or without a notice, a tip, pause or loading.
 */
export function layoutRegions(frame: StageFrame, _content: ScreenContentState = {}): StageFrame {
  return frame;
}

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
 * changes size. `float` sits over the stage + dock (tips, sheets, toasts); `modal` over everything.
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
}) {
  const r = layoutRegions(frame);
  const middle = (
    <>
      <View style={[styles.region, { height: r.notice.height }]} accessibilityLiveRegion="polite">
        {notice}
      </View>
      <View style={[styles.region, styles.stage, { width: r.stage.width, height: r.stage.height }, stageStyle]}>
        {stage}
      </View>
      <View style={[styles.region, { height: r.dock.height }]}>{dock}</View>
    </>
  );
  return (
    <View style={[styles.screen, background ? { backgroundColor: background } : null]}>
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
