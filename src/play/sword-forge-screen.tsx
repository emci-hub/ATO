/**
 * Element swords — bag, mix, merge, undo. Opened from Defend.
 * The rules live in `swords.ts`; this screen only sends an action up.
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { NeonBackLink, NeonHeader, NeonPanel } from '@/play/neon-ui';
import type { SwordAction } from '@/play/playStore';
import { tierWord, type SwordPanel, type SwordTier } from '@/play/swords';

export function SwordForgeScreen({
  swords,
  notice,
  onAction,
  onBack,
}: {
  swords: SwordPanel;
  notice: string | null;
  onAction: (action: SwordAction) => void;
  onBack: () => void;
}) {
  const equipped = swords.equipped;
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <NeonBackLink onPress={onBack} />
      <NeonHeader
        title="Swords"
        lede="Mix two base swords of the same tier. Merge 3 to climb, or 5 to climb and keep a Common. Epic mixes with a Relic become Legendary. Divine needs a Legendary and 3 Relics."
      />
      <NeonPanel>
        <ThemedText type="smallBold">{equipped ? equipped.name : 'No sword equipped'}</ThemedText>
        {equipped ? (
          <ThemedText type="small" themeColor="textSecondary">
            {tierWord(equipped.tier)} · {equipped.label}. Aura: {equipped.auraLabel}.
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Equip a sword and stand next to a tower. The ring shows which towers it helps.
          </ThemedText>
        )}
        {equipped ? (
          <Pressable onPress={() => onAction({ op: 'unequip' })} accessibilityRole="button">
            <ThemedText type="smallBold">Unequip</ThemedText>
          </Pressable>
        ) : null}
        {swords.canUndo ? (
          <Pressable onPress={() => onAction({ op: 'undo' })} accessibilityRole="button">
            <ThemedText type="smallBold">Undo last merge</ThemedText>
          </Pressable>
        ) : null}
        {notice ? (
          <ThemedText type="small" themeColor="textSecondary">
            {notice}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {swords.swords}/{swords.swordCap} swords · {swords.relicCount}/{swords.relicCap} relics
        </ThemedText>
      </NeonPanel>
      {swords.relics.map((relic) => (
        <ThemedText key={relic.element} type="small" themeColor="textSecondary">
          {relic.name} ×{relic.count}
        </ThemedText>
      ))}
      {swords.groups.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Win a Defend wave, a mini-game, or a Dive to find a Common sword.
        </ThemedText>
      ) : (
        swords.groups.map((group) => (
          <View key={`${group.element}-${group.tier}`} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: group.color }]} />
            <View style={styles.copy}>
              <ThemedText type="smallBold">
                {group.name} ×{group.count}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {tierWord(group.tier)}
                {group.relics > 0 ? ` · Relics ${group.relics}` : ''}
              </ThemedText>
              <View style={styles.actions}>
                <Action label="Equip" onPress={() => onAction({ op: 'equip', uid: group.sampleUid })} />
                {group.canUpgrade3 ? (
                  <Action
                    label="Merge 3"
                    onPress={() => onAction({ op: 'upgrade3', element: group.element, tier: group.tier })}
                  />
                ) : null}
                {group.canUpgrade5 ? (
                  <Action
                    label="Merge 5"
                    onPress={() => onAction({ op: 'upgrade5', element: group.element, tier: group.tier })}
                  />
                ) : null}
                {group.canLegendary ? (
                  <Action label="Legendary" onPress={() => onAction({ op: 'legendary', element: group.element })} />
                ) : null}
                {group.canDivine ? (
                  <Action label="Divine" onPress={() => onAction({ op: 'divine', element: group.element })} />
                ) : null}
                <MixHints group={group} swords={swords} onAction={onAction} />
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function MixHints({
  group,
  swords,
  onAction,
}: {
  group: SwordPanel['groups'][number];
  swords: SwordPanel;
  onAction: (action: SwordAction) => void;
}) {
  if (group.tier === 'legendary' || group.tier === 'divine') return null;
  const partners = swords.groups.filter(
    (other) =>
      other.tier === group.tier &&
      other.element !== group.element &&
      other.element < group.element &&
      other.count > 0 &&
      group.count > 0,
  );
  return (
    <>
      {partners.map((other) => (
        <Action
          key={other.element}
          label={`Mix ${other.name}`}
          onPress={() => onAction({ op: 'mix', a: group.element, b: other.element, tier: group.tier as SwordTier })}
        />
      ))}
    </>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.action}>
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  swatch: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  copy: { flex: 1, gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { paddingVertical: 4, paddingHorizontal: 8 },
});
