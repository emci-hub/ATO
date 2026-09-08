/**
 * Dive — push-your-luck (Play step 3, GAME_SPEC §7, §11 screen 2).
 *
 * Renders the whole Dive decision surface off `view.diveRun`:
 * - no run → "Dive · 1 charge" CTA (disabled at 0 charges with an honest note);
 * - run active → the haul as find cards + a "next move" card showing the exact
 *   bust % of the next Deeper (18 → 28 → 40 → 55%, max 4 Deepers) with Surface
 *   and Deeper buttons.
 *
 * All mutations go through the callbacks (which live in `play.tsx` and commit
 * through the shared playStore), so this stays a read-only view of store
 * truth. Copy never uses gamble / casino / jackpot / bet — Dive / Surface /
 * Deeper / bust only (GAME_SPEC §7).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMult, getItemDef, type ItemDef, type ItemSlot } from '@/play/items';
import { DIVE_CHARGE_CAP, DIVE_DEEPER_MAX, type PlayView } from '@/play/playStore';

const SLOT_ICONS: Record<ItemSlot, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  weapon: 'sword',
  armor: 'shield-outline',
  cloak: 'hanger',
  trinket: 'star-four-points',
};

export function DiveScreen({
  view,
  onSpendCharge,
  onSurface,
  onDeeper,
  onBackToGrove,
}: {
  view: PlayView;
  onSpendCharge: () => Promise<boolean>;
  onSurface: () => Promise<boolean>;
  onDeeper: () => Promise<boolean>;
  onBackToGrove: () => void;
}) {
  const theme = useTheme();
  const charges = view.dive.current;
  const run = view.diveRun;
  const canSpend = !run.active && charges >= 1;

  return (
    <>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBackToGrove}
          hitSlop={12}
          style={({ pressed }) => [pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ‹ Grove
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText type="subtitle">Dive</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.lede}>
        Push your luck for finds. Surface banks the haul — Deeper risks it.
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.statRow}>
          <ThemedText type="smallBold">Dive charges</ThemedText>
          <ThemedText type="subheading" themeColor="emphasis">
            {chargeText(view)}
          </ThemedText>
        </View>
      </ThemedView>

      {run.active ? (
        <>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              Haul so far {run.deepers > 0 ? `· ${run.deepers}/${DIVE_DEEPER_MAX} deep` : '· first find'}
            </ThemedText>
            {run.haul.map((id, index) => (
              <FindRow key={`${id}-${index}`} id={id} index={index} />
            ))}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Next move</ThemedText>
            {run.canDeeper && run.bustPctNext != null ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Deeper adds another find to this haul — {run.bustPctNext}% to lose it all.
                  Surface keeps every find and banks it to your bag.
                </ThemedText>
                <View style={styles.buttonRow}>
                  <Pressable
                    onPress={() => void onDeeper()}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.button,
                      styles.rowButton,
                      { backgroundColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">Deeper</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => void onSurface()}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.button,
                      styles.rowButtonPrimary,
                      { backgroundColor: theme.accentFill },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                      Surface
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Max depth — this haul has reached its last Deeper. Surface to keep it.
                </ThemedText>
                <Pressable
                  onPress={() => void onSurface()}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.accentFill },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                    Surface
                  </ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>
        </>
      ) : (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">One charge, one find</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A dive starts with a single find. Each Deeper adds another, and the
            bust chance climbs with it — 18%, then 28%, 40%, up to 55%. Surface
            any time to keep what you have.
          </ThemedText>
          {canSpend ? (
            <Pressable
              onPress={() => void onSpendCharge()}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.accentFill },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Dive · 1 charge
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              disabled
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                No dive charges
              </ThemedText>
            </Pressable>
          )}
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Charges refill every ~10 minutes, and a Research claim can grant one too.
          </ThemedText>
        </ThemedView>
      )}
    </>
  );
}

/** One find in the haul: icon, name, kind/rarity, and Power mult lines. */
function FindRow({ id, index }: { id: string; index: number }) {
  const theme = useTheme();
  const def = getItemDef(id);
  if (!def) {
    return (
      <View style={styles.findRow}>
        <ThemedText type="code" themeColor="textSecondary">
          #{index + 1}
        </ThemedText>
        <View style={styles.findText}>
          <ThemedText type="smallBold">Unknown find</ThemedText>
        </View>
      </View>
    );
  }
  const mults = [def.mult_a, def.mult_b].filter(
    (mult): mult is NonNullable<ItemDef['mult_a']> => mult != null,
  );
  return (
    <View style={styles.findRow}>
      <View style={[styles.findIcon, { backgroundColor: theme.backgroundSelected }]}>
        <MaterialCommunityIcons name={SLOT_ICONS[def.core.slot]} size={18} color={theme.accent} />
      </View>
      <View style={styles.findText}>
        <ThemedText type="smallBold">{def.core.name}</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {capitalize(def.core.rarity)} {capitalize(def.core.kind)}
          {mults.length > 0 ? ` · ${mults.map(formatMult).join(' · ')}` : ''}
        </ThemedText>
      </View>
    </View>
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** "7/10" or "7/10 · +1 ~12m" — same charge line the Grove row shows. */
function chargeText(view: PlayView): string {
  const dive = view.dive;
  const base = `${dive.current}/${DIVE_CHARGE_CAP}`;
  if (dive.full || dive.nextChargeAt == null) return base;
  const minutes = Math.max(1, Math.ceil((dive.nextChargeAt - Date.now()) / 60_000));
  return `${base} · +1 ~${minutes}m`;
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lede: {
    marginTop: -Spacing.one,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  findRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  findIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findText: {
    flex: 1,
    gap: Spacing.half,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowButton: {
    flex: 1,
  },
  rowButtonPrimary: {
    flex: 2,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
