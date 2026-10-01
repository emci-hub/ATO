/**
 * Floating dev button — a draggable "DEV" bubble layered over every screen
 * (mounted once in the root layout). Tap it and a panel opens ON TOP of
 * whatever you are testing: where you are, the update that is running, today's
 * AI usage, and your dev access. Nothing navigates away. The full Dev Tools
 * Hub and AI lab are one tap from the panel.
 *
 * Replaces digging through More / the Home dev box / 5 taps on You. Visibility
 * is the same gate as the Hub (`devFabVisible` → `canSeeDevLab`). JS-only: a
 * shake gesture would need a native sensor module, which an OTA cannot ship.
 */
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { RunningUpdateLine } from '@/components/running-update-line';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import {
  DEV_FAB_SIZE,
  clampFab,
  defaultFabPosition,
  devFabVisible,
  snapFabX,
} from '@/lib/dev-fab-model';
import { useDevAccessUnlocked } from '@/lib/dev-access-unlock';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { useMeContext } from '@/lib/me-context';
import type { SageUsageSnapshot } from '@/lib/voice/quota';
import { fetchSageUsage } from '@/lib/voice/quota-server';

export function DevFab() {
  const { me, devAccess, devAccessLoading } = useMeContext();
  const { session } = useSession();
  const devUnlocked = useDevAccessUnlocked();
  const visible = devFabVisible({
    isAuthed: !!session,
    hasMe: !!me,
    devAccessLoading,
    isDev: PRE_LAUNCH_DEV || devUnlocked,
    isRoot: devAccess.isRoot,
    capabilities: devAccess.capabilities,
  });
  if (!visible) return null;
  return <DevFabButton />;
}

function DevFabButton() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const bounds = useMemo(
    () => ({ width, height, top: insets.top, bottom: insets.bottom }),
    [width, height, insets.top, insets.bottom],
  );
  const start = useMemo(() => defaultFabPosition(bounds), [bounds]);
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  // Rotating the phone or a new safe area must not strand the button off screen.
  useEffect(() => {
    const c = clampFab({ x: x.value, y: y.value }, bounds);
    x.value = c.x;
    y.value = c.y;
  }, [bounds, x, y]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(6)
      .onStart(() => {
        sx.value = x.value;
        sy.value = y.value;
      })
      .onUpdate((e) => {
        const c = clampFab({ x: sx.value + e.translationX, y: sy.value + e.translationY }, bounds);
        x.value = c.x;
        y.value = c.y;
      })
      .onEnd(() => {
        x.value = withSpring(snapFabX(x.value, bounds.width), { damping: 18, stiffness: 220 });
      });
    const tap = Gesture.Tap()
      .maxDistance(6)
      .onEnd((_e, success) => {
        if (success) scheduleOnRN(setOpen, true);
      });
    return Gesture.Exclusive(pan, tap);
  }, [bounds, sx, sy, x, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <GestureDetector gesture={gesture}>
          <Animated.View
            accessible
            accessibilityRole="button"
            accessibilityLabel="Dev tools"
            style={[styles.fab, style]}>
            <Text style={styles.fabText}>DEV</Text>
          </Animated.View>
        </GestureDetector>
      </View>
      <DevPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function DevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { me, devAccess } = useMeContext();
  const { session } = useSession();
  const [snap, setSnap] = useState<SageUsageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !session?.user.id) return;
    let cancelled = false;
    setError(null);
    fetchSageUsage()
      .then((next) => {
        if (!cancelled) setSnap(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not read usage.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, session?.user.id]);

  const go = (href: '/dev-lab' | '/ai-lab') => {
    onClose();
    router.push(href);
  };

  const dim = { color: theme.textSecondary };
  const line = (label: string, value: string) => (
    <View style={styles.row}>
      <Text style={[styles.label, dim]}>{label}</Text>
      <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
    </View>
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dev tools" />
        <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.textSecondary }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: theme.text }]}>Dev tools</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={[styles.close, { color: theme.text }]}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={[styles.section, dim]}>WHERE YOU ARE</Text>
            {line('screen', pathname)}
            {line('account', me?.handle ? `@${me.handle}` : '—')}
            {line('access', `${devAccess.isRoot ? 'root' : 'dev'}${PRE_LAUNCH_DEV ? ' · pre-launch' : ''}`)}
            {line('AI consent', String(me?.ai_consent ?? 'unknown'))}
            <RunningUpdateLine />

            <Text style={[styles.section, dim]}>AI USAGE TODAY</Text>
            {error ? <Text style={{ color: theme.text }}>{error}</Text> : null}
            {snap ? (
              <>
                {line('today', `${snap.daily} / ${snap.dailyCap}`)}
                {line('this month', `${snap.monthly} / ${snap.monthlyCap}`)}
                {line('questions today', `${snap.questionsDaily} / ${snap.questionsCap}`)}
              </>
            ) : error ? null : (
              <Text style={dim}>Loading…</Text>
            )}

            <Text style={[styles.section, dim]}>OPEN</Text>
            <View style={styles.buttons}>
              <Pressable style={[styles.button, { borderColor: theme.textSecondary }]} onPress={() => go('/dev-lab')} accessibilityRole="button">
                <Text style={[styles.buttonText, { color: theme.text }]}>Dev Tools Hub</Text>
              </Pressable>
              <Pressable style={[styles.button, { borderColor: theme.textSecondary }]} onPress={() => go('/ai-lab')} accessibilityRole="button">
                <Text style={[styles.buttonText, { color: theme.text }]}>AI lab</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DEV_FAB_SIZE,
    height: DEV_FAB_SIZE,
    borderRadius: DEV_FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E7490',
    borderWidth: 2,
    borderColor: '#4FFFD2',
    opacity: 0.8,
    elevation: 8,
    zIndex: 1000,
  },
  fabText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    maxHeight: '75%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 24,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  close: { fontSize: 18 },
  body: { paddingHorizontal: 16, gap: 6 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  button: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: 14, fontWeight: '600' },
});
