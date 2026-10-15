/**
 * Fixed regions — the layout rule every game screen follows (emci 2026-10-13).
 *
 * A game screen is a stack of REGIONS (top bar · viewport · bottom panel) plus a
 * floating OVERLAY layer. Content may change inside a region; it may never change
 * the region's size, or the viewport next to it rescales ("things go big and small").
 *
 *   1. The viewport has one size per screen: it fills what the fixed regions leave.
 *   2. Bars and panels reserve their TALLEST state: `ReservedRegion` grows to the
 *      tallest content it has shown and never shrinks back; `Reserve` keeps a hidden
 *      row's space (invisible, untouchable, hidden from VoiceOver).
 *   3. Announcements (found, busted, results, errors) are `notify()` notices in the fixed
 *      NoticeLane (src/play/notify/); speech and tips float on the overlay — never an in-flow row.
 *   4. Text sits in a set-width box with `numberOfLines` (+ a min height for the lines
 *      it may use), padded inside frame art.
 *   5. Loading keeps the final size (a placeholder of the same height), never a
 *      smaller spinner row; flags that decide what shows are read before first paint.
 *
 * Exception — a SCREEN SWITCH: a deliberate change of what the screen is (Turf War setup →
 * wave) may re-lay out once, at that moment. Mark it with a `fixed-regions: screen switch`
 * comment on the line above; never re-lay out WITHIN a state (pause, a find, a hint).
 *
 * `check:fixed-regions` pins the shell, Dive, Turf War, Hideout strip and pet games
 * to these; docs/GOTCHAS.md (UI) carries the same rule for every new screen.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

/** Grow-only height: the region takes the tallest height it has laid out at. */
export function useGrowOnlyHeight(initial = 0): { minHeight: number; onLayout: (e: LayoutChangeEvent) => void } {
  const [minHeight, setMinHeight] = useState(initial);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    setMinHeight((m) => (h > m ? h : m));
  }, []);
  return { minHeight, onLayout };
}

/** A bar / panel region that never shrinks when its content swaps (rule 2). */
export function ReservedRegion({
  children,
  style,
  initialHeight = 0,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** A known minimum (e.g. the tab bar's height) so even the first swap can't shrink it. */
  initialHeight?: number;
}) {
  const grow = useGrowOnlyHeight(initialHeight);
  return (
    <View style={[style, { minHeight: grow.minHeight }]} onLayout={grow.onLayout}>
      {children}
    </View>
  );
}

/** Keeps `children`'s space in the layout while hidden (rule 2) — no unmount, no jump. */
export function Reserve({
  show,
  children,
  style,
}: {
  show: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[style, !show && { opacity: 0 }]}
      pointerEvents={show ? 'auto' : 'none'}
      accessibilityElementsHidden={!show}
      importantForAccessibility={show ? 'auto' : 'no-hide-descendants'}>
      {children}
    </View>
  );
}
