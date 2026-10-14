/**
 * Stage frame math — pure, no React Native (so check:stage-bounds can run it in Node).
 * The renderer is src/play/stage-layout.tsx (GameScreen, useStageFrame). Spec:
 * docs/divecore-layout-spec.md. Region heights are fixed per screen; the stage gets what is left
 * of the window ONCE — never what content leaves.
 */
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

