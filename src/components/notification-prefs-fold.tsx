import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMeContext } from '@/lib/me-context';
import { resyncPushForUser } from '@/lib/push';
import { getPushPrefs, setPushPref, type PushKindPref } from '@/lib/push-prefs';

const ROWS: { kind: PushKindPref; label: string }[] = [
  { kind: 'morning', label: "Morning · today's Read" },
  { kind: 'evening', label: 'Evening · Check reminder' },
  { kind: 'insight', label: 'Insight · a category read' },
  { kind: 'sunday', label: 'Sunday · week recap' },
];

export function NotificationPrefsFold() {
  const { me } = useMeContext();
  const [prefs, setPrefs] = useState<Record<PushKindPref, boolean> | null>(null);

  useEffect(() => {
    let active = true;
    getPushPrefs().then((next) => {
      if (active) setPrefs(next);
    });
    return () => {
      active = false;
    };
  }, []);

  async function toggle(kind: PushKindPref) {
    if (!prefs) return;
    const next = await setPushPref(kind, !prefs[kind]);
    setPrefs(next);
    // Resync immediately so turning a kind off actually cancels it now,
    // rather than waiting for the next unrelated sync trigger.
    if (me) resyncPushForUser(me).catch(() => {});
  }

  return (
    <SettingsFold title="Notifications">
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Turn any of these off on their own — the iOS setting only controls all of them at once.
      </ThemedText>
      {ROWS.map((row) => (
        <Pressable
          key={row.kind}
          onPress={() => void toggle(row.kind)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.rowText}>
            <ThemedText type="smallBold">{row.label}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {prefs ? (prefs[row.kind] ? 'On' : 'Off') : '…'}
          </ThemedText>
        </Pressable>
      ))}
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
  hint: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
