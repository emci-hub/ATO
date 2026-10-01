/**
 * Dev-only sword list. Every element × tier, and a tap equips that sword in
 * Defend. Gated the same way as the rest of the Play dev kit: this file is
 * mounted only while `PRE_LAUNCH_DEV` is on and the dev kit is unlocked, and
 * it renders nothing if that flag is off.
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { NeonBackLink, NeonHeader } from '@/play/neon-ui';
import { swordCatalog, tierWord, type SwordTier } from '@/play/swords';

export function SwordLabScreen({
  onEquip,
  onBack,
}: {
  onEquip: (element: string, tier: SwordTier) => void;
  onBack: () => void;
}) {
  if (!PRE_LAUNCH_DEV) return null;
  const rows = swordCatalog();
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <NeonBackLink onPress={onBack} />
      <NeonHeader
        title="Sword lab"
        lede="Dev only. Tap a row to put that sword in the bag and equip it for Defend."
      />
      <ThemedText type="small" themeColor="textSecondary">
        {rows.length} swords
      </ThemedText>
      {rows.map((row) => (
        <Pressable
          key={`${row.element}-${row.tier}`}
          onPress={() => onEquip(row.element, row.tier)}
          accessibilityRole="button"
          style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: row.color }]} />
          <View style={styles.copy}>
            <ThemedText type="smallBold">
              {row.name} · {tierWord(row.tier)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {row.label}. {row.auraLabel}.
            </ThemedText>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 8, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 4 },
  swatch: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  copy: { flex: 1 },
});
