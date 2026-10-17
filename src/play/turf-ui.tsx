/**
 * Turf War UI kit (step T2, 2026-10-16) — presentational pieces on the sheet-kit language
 * (border 2, radius 6 / 4, spacing 4 / 8 / 12 / 16, taps ≥ 44, type 18 / 16 / 14 / 12).
 * No state, no store, no game rules: `defend-screen.tsx` hands in strings, numbers and callbacks.
 *
 *   TurfButton      icon · label · state (ready / cooling sweep / not affordable / used), ≥ 44 pt
 *   TurfCard        the card surface (sheetCard) every Turf float card uses
 *   TurfResultCard  won / lost: title, lines, ONE primary button low on the card, quiet secondary buttons
 *   TurfPips        tower level pips (HTML side — the board draws its own SVG pips)
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SHEET, sheetCard, sheetText } from '@/play/sheet-kit';
import { STREET, STREET_FONT } from '@/play/street-ui';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Red used for a cost the player cannot pay. */
export const TURF_COST_RED = STREET.red;

export type TurfButtonState = 'ready' | 'cooling' | 'unaffordable' | 'used' | 'selected';

export function TurfButton({
  label,
  icon,
  detail,
  state = 'ready',
  progress,
  primary,
  onPress,
  accessibilityLabel,
  style,
}: {
  label: string;
  icon?: IconName;
  /** Second line: a cost ("40 scrap") or a timer ("9s"). Red when the state is `unaffordable`. */
  detail?: string;
  state?: TurfButtonState;
  /** 0–1 share of the cooldown still to go; draws the sweep while `cooling`. */
  progress?: number;
  primary?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const disabled = state === 'cooling' || state === 'unaffordable' || state === 'used';
  const dim = state === 'unaffordable' || state === 'used';
  const fill = primary ? STREET.mustard : STREET.asphalt;
  const textColor = primary ? STREET.ink : STREET.paper;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill },
        state === 'selected' && styles.buttonOn,
        dim && styles.dim,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {state === 'cooling' && progress != null ? (
        <View
          pointerEvents="none"
          style={[styles.sweep, { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }]}
        />
      ) : null}
      <View style={styles.buttonRow}>
        {icon ? <MaterialCommunityIcons name={icon} size={20} color={dim ? STREET.muted : textColor} /> : null}
        <View style={styles.buttonText}>
          <Text style={[styles.buttonLabel, { color: dim ? STREET.muted : textColor }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {label}
          </Text>
          {detail ? (
            <Text
              style={[sheetText.caption, styles.buttonDetail, { color: state === 'unaffordable' ? TURF_COST_RED : dim ? STREET.muted : textColor }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** The card surface for every Turf float card (build card, results). */
export function TurfCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[sheetCard, styles.card, style]}>{children}</View>;
}

/** Level pips: `level` filled dots out of `max`. */
export function TurfPips({ level, max }: { level: number; max: number }) {
  return (
    <View style={styles.pips} accessibilityLabel={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[styles.pip, i < level && styles.pipOn]} />
      ))}
    </View>
  );
}

export type TurfResultAction = { label: string; onPress: () => void; accessibilityLabel?: string };

/** Won / lost card: one primary button low on the card, the rest quiet. Copy comes in as strings. */
export function TurfResultCard({
  title,
  lines,
  badge,
  primary,
  actions = [],
}: {
  title: string;
  lines: string[];
  /** A small tag under the lines (the Trial catch-up ×2.5 EXP). */
  badge?: string;
  primary: TurfResultAction;
  actions?: TurfResultAction[];
}) {
  return (
    <TurfCard style={styles.result}>
      <Text style={sheetText.heading} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} style={sheetText.caption} maxFontSizeMultiplier={1.2}>
          {line}
        </Text>
      ))}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {actions.map((action) => (
        <TurfButton key={action.label} label={action.label} onPress={action.onPress} accessibilityLabel={action.accessibilityLabel} />
      ))}
      <TurfButton
        label={primary.label}
        primary
        onPress={primary.onPress}
        accessibilityLabel={primary.accessibilityLabel}
        style={styles.primary}
      />
    </TurfCard>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: SHEET.tap + 4,
    borderRadius: SHEET.radiusSmall,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    paddingHorizontal: SHEET.gap,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonOn: { borderColor: STREET.mustard },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  buttonText: { flexShrink: 1, alignItems: 'center' },
  buttonLabel: {
    fontFamily: STREET_FONT.bold,
    fontSize: SHEET.type.body,
    lineHeight: SHEET.type.bodyLh,
    textTransform: 'uppercase',
  },
  buttonDetail: { textAlign: 'center' },
  sweep: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(224,165,38,0.28)' },
  card: { padding: SHEET.pad, gap: SHEET.gap },
  result: { alignItems: 'stretch' },
  primary: { marginTop: SHEET.gap },
  pips: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: SHEET.edge,
    backgroundColor: STREET.asphalt,
  },
  pipOn: { backgroundColor: STREET.mustard },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: SHEET.radiusSmall,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    backgroundColor: STREET.asphalt,
    paddingHorizontal: SHEET.gap,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: STREET_FONT.bold, fontSize: SHEET.type.caption, color: STREET.mustard },
});
