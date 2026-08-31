import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SLIDER_STOPS } from '@/lib/traits';
import { TRAIT_UNDO_LABEL, TRAIT_UNDO_MS } from '@/lib/trait-history';
import { UNDO_SAME_AXIS_REPEAT_CAP } from '@/lib/trait-stability';

/** Unset until the first tap. An untouched row stays null — never a midpoint default.
 *  Mis-tap safety: 8s undo window. onChange does not fire if undone in-window. */
export function AxisTaps({
  label,
  hint,
  value,
  disabled,
  undoBlocked = false,
  onChange,
  onUndo,
}: {
  label: string;
  hint: string;
  value: number | null;
  disabled: boolean;
  /** After one undo on this axis, the next pending tap cannot be undone. */
  undoBlocked?: boolean;
  onChange: (next: number) => void;
  onUndo?: () => void;
}) {
  const theme = useTheme();
  const [pending, setPending] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function arm(next: number) {
    clearTimer();
    pendingRef.current = next;
    setPending(next);
    timerRef.current = setTimeout(() => {
      const commit = pendingRef.current;
      pendingRef.current = null;
      setPending(null);
      timerRef.current = null;
      if (commit != null) onChangeRef.current(commit);
    }, TRAIT_UNDO_MS);
  }

  function undo() {
    if (undoBlocked) return;
    if (UNDO_SAME_AXIS_REPEAT_CAP < 1) return;
    clearTimer();
    pendingRef.current = null;
    setPending(null);
    onUndo?.();
  }

  useEffect(() => {
    return () => {
      clearTimer();
      pendingRef.current = null;
    };
  }, []);

  const shown = pending ?? value;

  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {hint}
      </ThemedText>
      <View style={styles.row}>
        {SLIDER_STOPS.map((stop) => {
          const on = shown === stop;
          return (
            <Pressable
              key={String(stop)}
              onPress={() => {
                if (disabled) return;
                if (stop === value && pending == null) return;
                arm(stop);
              }}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              style={({ pressed }) => [
                styles.stop,
                {
                  backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                  borderColor: on ? theme.text : theme.backgroundElement,
                },
                pressed && styles.pressed,
                disabled && styles.disabled,
              ]}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: on ? theme.text : theme.textSecondary },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      {pending != null && !undoBlocked ? (
        <Pressable
          onPress={undo}
          accessibilityRole="button"
          accessibilityLabel={TRAIT_UNDO_LABEL}
          style={({ pressed }) => [styles.undo, pressed && styles.pressed]}>
          <ThemedText type="smallBold">{TRAIT_UNDO_LABEL}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  undo: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
});
