import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';
import { COMPARE_UI, type CircleCompareCard } from '@/play/circle-compare';
import { fetchCompareCard, fetchCompareList, setCompareShare } from '@/play/circle-compare-store';
import { CIRCLE_REPORT_REASON_IDS, CIRCLE_UI, type CircleReportReason } from '@/play/circle-visits';
import { type CircleCall } from '@/play/circle-visits-store';

/** A first tap arms a block / remove / unblock; it disarms by itself after this long. */
const ARM_MS = 3000;

/**
 * Two taps before a write (same idea as `useTwoTap` in dev-lab.tsx). `confirm(id)` is false on the
 * first tap (it arms that id) and true on the second.
 */
export function useTwoTap(): { armed: string | null; confirm: (id: string) => boolean; disarm: () => void } {
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const disarm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setArmed(null);
  }, []);
  const confirm = useCallback(
    (id: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (armed === id) {
        setArmed(null);
        return true;
      }
      setArmed(id);
      timer.current = setTimeout(() => setArmed((cur) => (cur === id ? null : cur)), ARM_MS);
      return false;
    },
    [armed],
  );
  return { armed, confirm, disarm };
}

export function failLine(res: CircleCall<unknown>): string {
  return res.kind === 'off' ? CIRCLE_UI.off : res.kind === 'signed_out' ? CIRCLE_UI.signedOut : CIRCLE_UI.error;
}

/** A 44pt-tall text button. */
export function CircleButton({
  label,
  onPress,
  accessibilityLabel,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { borderColor: danger ? '#ff5d6c' : controlBorderColor(theme) },
        disabled && styles.dim,
        pressed && styles.pressed,
      ]}>
      <ThemedText style={danger ? styles.danger : undefined}>{label}</ThemedText>
    </Pressable>
  );
}

/** The "⋯" button: a 44 × 44 hit area. */
export function MoreButton({ handle, onPress }: { handle: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={CIRCLE_UI.more(handle)}
      style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
      <ThemedText style={styles.moreText}>{CIRCLE_UI.moreGlyph}</ThemedText>
    </Pressable>
  );
}

export type MenuTarget = { peer: string; handle: string; canRemove: boolean };

/** Report: the six fixed reasons. */
export function ReportPanel({
  working,
  note,
  onReason,
  onBack,
}: {
  working: boolean;
  note: string | null;
  onReason: (reason: CircleReportReason) => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.stack}>
      <ThemedText type="subtitle">{CIRCLE_UI.reportTitle}</ThemedText>
      {CIRCLE_REPORT_REASON_IDS.map((reason) => (
        <CircleButton key={reason} label={CIRCLE_UI.reportReasons[reason]} disabled={working} onPress={() => onReason(reason)} />
      ))}
      {note ? <ThemedText themeColor="textSecondary">{note}</ThemedText> : null}
      <CircleButton label={CIRCLE_UI.back} onPress={onBack} />
    </View>
  );
}

type CompareState =
  | { status: 'loading' }
  | { status: 'error'; msg: string }
  | { status: 'ready'; mine: boolean; allowed: boolean; preview: string[]; card: CircleCompareCard | null };

/** Compare strengths: shareable strengths only, both switches on (wave105). */
export function ComparePanel({ peer, handle, onBack }: { peer: string; handle: string; onBack: () => void }) {
  const theme = useTheme();
  const [cmp, setCmp] = useState<CompareState>({ status: 'loading' });
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const list = await fetchCompareList();
    if (!alive.current) return;
    if (list.kind !== 'ok') {
      setCmp({ status: 'error', msg: failLine(list) });
      return;
    }
    const f = list.value.friends.find((x) => x.peer === peer);
    let card: CircleCompareCard | null = null;
    if (f?.allowed) {
      const c = await fetchCompareCard(peer);
      if (!alive.current) return;
      if (c.kind !== 'ok') {
        setCmp({ status: 'error', msg: failLine(c) });
        return;
      }
      if (c.value !== 'not_allowed') card = c.value;
    }
    setCmp({ status: 'ready', mine: f?.mine === true, allowed: f?.allowed === true && card != null, preview: list.value.preview, card });
  }, [peer]);
  useEffect(() => {
    void load();
  }, [load]);

  const flip = async (on: boolean) => {
    setWorking(true);
    setNote(null);
    const res = await setCompareShare(peer, on);
    if (!alive.current) return;
    setWorking(false);
    if (res.kind !== 'ok') {
      setNote(failLine(res));
      return;
    }
    void load();
  };

  return (
    <View style={styles.stack}>
      <ThemedText type="subtitle">{COMPARE_UI.title(handle)}</ThemedText>
      <ThemedText themeColor="textSecondary">{COMPARE_UI.consent}</ThemedText>
      {cmp.status === 'loading' ? (
        <ThemedText themeColor="textSecondary">{COMPARE_UI.loading}</ThemedText>
      ) : cmp.status === 'error' ? (
        <ThemedText themeColor="textSecondary">{cmp.msg}</ThemedText>
      ) : (
        <>
          <ThemedText type="smallBold">{COMPARE_UI.previewFor(handle)}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {cmp.preview.length > 0 ? cmp.preview.map((p) => `· ${p}`).join('\n') : COMPARE_UI.previewNone}
          </ThemedText>
          <ThemedView type="backgroundElement" style={[styles.switchRow, { borderColor: controlBorderColor(theme) }]}>
            <View style={styles.grow}>
              <ThemedText>{cmp.mine ? COMPARE_UI.switchOn : COMPARE_UI.switchOff}</ThemedText>
              {cmp.mine && !cmp.allowed ? <ThemedText themeColor="textSecondary">{COMPARE_UI.waiting(handle)}</ThemedText> : null}
            </View>
            <Switch
              value={cmp.mine}
              disabled={working}
              onValueChange={(on) => void flip(on)}
              accessibilityLabel={COMPARE_UI.switchLabel(handle, cmp.mine)}
            />
          </ThemedView>
          {cmp.allowed && cmp.card ? (
            <>
              <ThemedText type="smallBold">{COMPARE_UI.sharedTitle}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {cmp.card.shared.length > 0 ? cmp.card.shared.map((p) => `· ${p}`).join('\n') : COMPARE_UI.sharedNone}
              </ThemedText>
              <ThemedText type="smallBold">{COMPARE_UI.theirsTitle(handle)}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {cmp.card.theirs.length > 0 ? cmp.card.theirs.map((p) => `· ${p}`).join('\n') : COMPARE_UI.theirsNone}
              </ThemedText>
            </>
          ) : null}
        </>
      )}
      {note ? <ThemedText themeColor="textSecondary">{note}</ThemedText> : null}
      <CircleButton label={CIRCLE_UI.back} onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  danger: { color: '#ff5d6c' },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 22, lineHeight: 26 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
  },
  grow: { flex: 1 },
  dim: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
