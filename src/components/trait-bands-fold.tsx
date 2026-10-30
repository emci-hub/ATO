import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  TRAIT_BANDS_LABEL,
  TRAIT_BANDS_LEDE,
  filledTraitBands,
  type FilledTraitBand,
} from '@/lib/trait-bands';
import type { Me } from '@/lib/me';
import { useIncludeQuests } from '@/lib/quests/include-store';
import { effectiveValue, type TraitTrack } from '@/lib/trait-stability';

export const BAND_PROVENANCE = 'This came from a question you answered. It can change.';
export const BAND_QUEST_NOTE =
  'The open dot adds what your Quests showed. It is only a view on this phone; your questions stay as they were.';
export const BAND_QUEST_LEGEND = 'Filled: your questions. Open: with Quests.';

/**
 * Where a dot sits, in words (positions-not-numbers rule): VoiceOver never hears a number.
 */
export function bandPositionWords(value: number): string {
  if (value < 0.35) return 'toward the first end';
  if (value > 0.65) return 'toward the second end';
  return 'near the middle';
}

/** Spoken label for one band. Two dots say both positions; one dot keeps the original label. */
export function bandAccessibilityLabel(band: FilledTraitBand): string {
  const base = `${band.low}. ${band.high}.`;
  if (band.questValue == null) return base;
  const first = bandPositionWords(band.value);
  let second = bandPositionWords(band.questValue);
  // The cap keeps the two dots close: say which way the open dot moved when the words match.
  if (second === first) second = `${band.questValue > band.value ? 'a little further toward the second end' : 'a little further toward the first end'}`;
  return `${base} Questions: ${first}. With Quests: ${second}.`;
}

/**
 * Adds the second dot when "Include Quests" is on AND a Quest row moved this axis
 * (`effectiveValue(...).blended`). Profile screens only: this is the one place a band
 * reads the blend, and it never returns a `TraitTrack`.
 */
export function withQuestDot(
  band: FilledTraitBand,
  tracks: readonly TraitTrack[],
  includeQuests: boolean,
): FilledTraitBand {
  if (!includeQuests) return band;
  const effective = effectiveValue(tracks, band.axis, true, band.value);
  if (!effective.blended || effective.value == null) return band;
  return { ...band, questValue: effective.value };
}

/**
 * Collapsed-by-default spectrum. Marker position only — no number, no trait
 * name, no midpoint label. Hidden entirely when every axis is null. Reads the
 * same report-track value as Full Profile so the two folds never disagree.
 * With "Include Quests" on, an axis a Quest moved gets a second (open) dot.
 */
export function TraitBandsFold({ me, tracks }: { me: Me; tracks: readonly TraitTrack[] }) {
  const [includeQuests] = useIncludeQuests(me.id);
  const bands = filledTraitBands(me, tracks).map((band) => withQuestDot(band, tracks, includeQuests));
  const [detail, setDetail] = useState<FilledTraitBand | null>(null);
  if (bands.length === 0) return null;

  return (
    <>
      <SettingsFold title={TRAIT_BANDS_LABEL}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
          {TRAIT_BANDS_LEDE}
        </ThemedText>
        <View style={styles.list}>
          {bands.map((band) => (
            <Pressable
              key={`${band.low}:${band.high}`}
              accessibilityRole="button"
              accessibilityLabel={bandAccessibilityLabel(band)}
              onPress={() => setDetail(band)}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <TraitBandVisual band={band} />
            </Pressable>
          ))}
        </View>
      </SettingsFold>
      <Modal
        visible={detail != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <ThemedView type="backgroundElement" style={styles.sheet}>
              {detail ? <TraitBandDetail band={detail} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setDetail(null)}
                style={({ pressed }) => [styles.closeRow, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Close
                </ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function TraitBandVisual({ band }: { band: FilledTraitBand }) {
  const theme = useTheme();
  const t = Math.min(1, Math.max(0, band.value));
  const q = band.questValue == null ? null : Math.min(1, Math.max(0, band.questValue));
  const filledDot = (
    <View
      style={[styles.marker, { backgroundColor: theme.accentFill, borderColor: theme.backgroundElement }]}
    />
  );
  // The open dot is a ring, so the two read apart without colour.
  const openDot = (
    <View style={[styles.marker, { backgroundColor: theme.backgroundElement, borderColor: theme.accentFill }]} />
  );

  return (
    <View
      style={styles.row}
      accessible={q != null ? true : undefined}
      accessibilityLabel={q != null ? bandAccessibilityLabel(band) : undefined}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
        {q == null ? (
          <>
            <View style={{ flex: Math.max(t, 0.001) }} />
            {filledDot}
            <View style={{ flex: Math.max(1 - t, 0.001) }} />
          </>
        ) : (
          <>
            <View style={{ flex: Math.max(Math.min(t, q), 0.001) }} />
            {t <= q ? filledDot : openDot}
            <View style={{ flex: Math.max(Math.abs(q - t), 0.001) }} />
            {t <= q ? openDot : filledDot}
            <View style={{ flex: Math.max(1 - Math.max(t, q), 0.001) }} />
          </>
        )}
      </View>
      <View style={styles.ends}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.endLow}>
          {band.low}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.endHigh}>
          {band.high}
        </ThemedText>
      </View>
      {q != null ? (
        <ThemedText type="code" themeColor="textSecondary">
          {BAND_QUEST_LEGEND}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** One filled band plus the fixed provenance line. No axis name, no number, no source token. */
export function TraitBandDetail({ band }: { band: FilledTraitBand }) {
  return (
    <View style={styles.detail}>
      <TraitBandVisual band={band} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.provenance}>
        {BAND_PROVENANCE}
      </ThemedText>
      {band.questValue != null ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.provenance}>
          {BAND_QUEST_NOTE}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lede: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  list: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  row: {
    gap: Spacing.two,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    overflow: 'visible',
  },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginHorizontal: -1,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  endLow: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  endHigh: {
    flex: 1,
    textAlign: 'right',
    paddingLeft: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrap: {
    padding: Spacing.four,
  },
  sheet: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  detail: {
    gap: Spacing.three,
  },
  provenance: {
    paddingHorizontal: Spacing.half,
  },
  closeRow: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
