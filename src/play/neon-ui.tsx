/**
 * Neon Viper UI — shared chrome for the Play sub-screens (Shop / Dress / More).
 *
 * View-only primitives (no state, no store, no logic) built from the same NEON
 * palette + Rajdhani / Space Mono faces the Command Hub uses, so the sub-screens
 * read as Hub siblings. Cards delegate to `PlayFrame` so the cyan glow has one
 * source; call sites only pass layout (padding / gap) through `style`.
 *
 * With the Streetwear art style on, every primitive here draws the street UI
 * kit + Pixelify Sans instead (`street-ui.tsx`). Same props, same layout, so
 * no screen changes; Classic is untouched.
 */
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Fonts } from '@/constants/theme';
import { NEON, NEON_VIPER_TOKENS } from '@/play/neon-viper';
import { PlayFrame } from '@/play/play-frame';
import {
  STREET,
  STREET_FONT,
  StreetBackdrop,
  StreetFrame,
  streetButtonPiece,
  streetButtonText,
  streetPieceSize,
  streetUiOn,
  useStreetFonts,
} from '@/play/street-ui';
import { tapHaptic } from '@/play/street-feel';

/** Hub tile-icon border/fill (rgba, kept local — the token set has no pair). */
const ICON_BORDER = 'rgba(0, 234, 255, 0.1)';
const ICON_FILL = 'rgba(0, 234, 255, 0.03)';
/** Dim hairline between list rows. */
export const NEON_ROW_LINE = 'rgba(0, 234, 255, 0.1)';
/** Hub controls are near-square; the panel radius (8) comes from the tokens. */
const RADIUS = 2;

/** `‹ Hideout` — mono cyan back link (Hideout is home since Phase 3). */
export function NeonBackLink({
  label = 'Hideout',
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  useStreetFonts();
  if (streetUiOn()) {
    const size = streetPieceSize('back');
    return (
      <Pressable
        onPress={onPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Back to ${label}`}
        style={({ pressed }) => [styles.backRow, styles.streetBackRow, pressed && styles.pressed]}>
        <View style={{ width: size.width * 0.6, height: size.height * 0.6 }}>
          <StreetBackdrop piece="back" />
        </View>
        <Text style={styles.streetBackText}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}>
      <Text style={styles.backText}>{`‹ ${label}`}</Text>
    </Pressable>
  );
}

/** Hub lockup — mono cyan eyebrow + Rajdhani uppercase title (+ optional lede). */
export function NeonHeader({
  eyebrow = 'NEON VIPER',
  title,
  lede,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  useStreetFonts();
  if (streetUiOn()) {
    return (
      <View style={styles.header}>
        <StreetFrame piece="header" style={styles.streetPlate}>
          <Text style={styles.streetEyebrow}>{eyebrow === 'NEON VIPER' ? 'DIVECORE' : eyebrow}</Text>
          <Text style={styles.streetTitle}>{title}</Text>
        </StreetFrame>
        {lede ? <Text style={styles.lede}>{lede}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {lede ? <Text style={styles.lede}>{lede}</Text> : null}
    </View>
  );
}

/** Card section heading — mono cyan uppercase (Hub HUD-label treatment). */
export function NeonLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  useStreetFonts();
  return <Text style={[styles.label, streetUiOn() && styles.streetLabel, style]}>{children}</Text>;
}

/** Neon card surface — PlayFrame with tight radius + standard padding. */
export function NeonPanel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // The street panel's tape corners need a little more room than the ink card.
  return <PlayFrame style={[styles.panel, streetUiOn() && styles.streetPanel, style]}>{children}</PlayFrame>;
}

/** Square neon icon frame (replaces the old circular Kenney-style chips). */
export function NeonIconFrame({
  children,
  size = 40,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.iconFrame, { width: size, height: size }, style]}>{children}</View>;
}

/** Filter / segmented chip — cyan outline, cyan-soft when selected. */
export function NeonChip({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  useStreetFonts();
  if (streetUiOn()) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.streetChip, pressed && styles.pressed]}>
        <StreetBackdrop piece={selected ? 'chip-on' : 'chip-off'} />
        <Text style={[styles.streetChipText, selected && styles.streetChipTextSelected]}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Small badge pill (×2 / Spare / Soon / caught-up). */
export function NeonPill({
  label,
  tone = 'muted',
  style,
}: {
  label: string;
  tone?: 'muted' | 'emphasis';
  style?: StyleProp<ViewStyle>;
}) {
  useStreetFonts();
  const street = streetUiOn();
  const emphasis = tone === 'emphasis';
  return (
    <View
      style={[
        styles.pill,
        emphasis && styles.pillEmphasis,
        street && styles.streetPill,
        street && emphasis && styles.streetPillEmphasis,
        style,
      ]}>
      <Text
        style={[
          styles.pillText,
          emphasis && styles.pillTextEmphasis,
          street && styles.streetPillText,
          street && emphasis && styles.streetPillTextEmphasis,
        ]}>
        {label}
      </Text>
    </View>
  );
}

type NeonButtonVariant = 'primary' | 'secondary' | 'danger';

/** Neon action button — mono label, near-square, cyan/pink outline. */
export function NeonButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: NeonButtonVariant;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  useStreetFonts();
  if (streetUiOn()) {
    const art = disabled ? 'secondary' : variant;
    return (
      <Pressable
        onPress={() => {
          tapHaptic();
          onPress();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.button,
          styles.streetButton,
          disabled && styles.streetDisabled,
          style,
          pressed && !disabled && styles.streetSquash,
        ]}>
        {({ pressed }) => (
          <>
            <StreetBackdrop piece={streetButtonPiece(art, pressed && !disabled)} />
            <Text
              style={[
                styles.streetButtonText,
                { color: streetButtonText(art) },
                pressed && !disabled && styles.streetButtonTextPressed,
              ]}>
              {label}
            </Text>
          </>
        )}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonTextPrimary,
          variant === 'secondary' && styles.buttonTextSecondary,
          variant === 'danger' && styles.buttonTextDanger,
          disabled && styles.buttonTextDisabled,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backRow: {
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    letterSpacing: 1,
    color: NEON.cyan,
  },
  header: {
    gap: 2,
  },
  eyebrow: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: NEON.cyan,
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 28,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: NEON.textPrimary,
    textShadowColor: 'rgba(0, 234, 255, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  lede: {
    marginTop: 4,
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: NEON.textMuted,
  },
  label: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: NEON.cyan,
  },
  panel: {
    borderRadius: NEON_VIPER_TOKENS.radius,
    padding: 16,
    gap: 16,
    alignItems: 'stretch',
  },
  iconFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ICON_BORDER,
    backgroundColor: ICON_FILL,
  },
  chip: {
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    borderColor: NEON.cyanBorder,
    backgroundColor: NEON.cyanSoft,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: NEON.textMuted,
  },
  chipTextSelected: {
    color: NEON.cyan,
  },
  pill: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: RADIUS,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  pillEmphasis: {
    borderColor: NEON.cyanBorder,
    backgroundColor: NEON.cyanSoft,
  },
  pillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: NEON.textMuted,
  },
  pillTextEmphasis: {
    color: NEON.cyan,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 34,
  },
  buttonPrimary: {
    backgroundColor: NEON_VIPER_TOKENS.accentFill,
    borderColor: NEON.cyanBorder,
  },
  buttonSecondary: {
    backgroundColor: NEON.panel,
    borderColor: NEON.cyanDim,
  },
  buttonDanger: {
    backgroundColor: 'rgba(255, 35, 201, 0.08)',
    borderColor: 'rgba(255, 35, 201, 0.55)',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(9, 15, 28, 0.6)',
    borderColor: NEON.cyanDim,
  },
  buttonText: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  buttonTextPrimary: {
    color: NEON_VIPER_TOKENS.onAccent,
  },
  buttonTextSecondary: {
    color: NEON.textPrimary,
  },
  buttonTextDanger: {
    color: NEON.pink,
  },
  buttonTextDisabled: {
    color: NEON.textMuted,
  },
  pressed: {
    opacity: 0.75,
  },
  // Streetwear art style (street-ui.tsx).
  streetBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streetBackText: {
    fontFamily: STREET_FONT.bold,
    fontSize: 15,
    color: STREET.paper,
  },
  streetPlate: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    alignItems: 'center',
  },
  streetEyebrow: {
    fontFamily: STREET_FONT.regular,
    fontSize: 11,
    letterSpacing: 1.6,
    color: STREET.mustard,
  },
  streetTitle: {
    fontFamily: STREET_FONT.bold,
    fontSize: 26,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: STREET.paper,
    textAlign: 'center',
  },
  streetLabel: {
    fontFamily: STREET_FONT.bold,
    fontSize: 13,
    letterSpacing: 1,
    color: STREET.mustard,
  },
  streetPanel: {
    padding: 22,
  },
  streetChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 56,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Readable on the plain asphalt chip (the striped ends are gone).
  streetChipText: {
    fontFamily: STREET_FONT.bold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: STREET.paper,
  },
  streetChipTextSelected: {
    color: STREET.ink,
  },
  streetPill: {
    borderColor: STREET.muted,
    borderRadius: 0,
  },
  streetPillEmphasis: {
    borderColor: STREET.mustard,
    backgroundColor: 'rgba(224, 165, 38, 0.15)',
  },
  streetPillText: {
    fontFamily: STREET_FONT.regular,
    fontSize: 11,
    color: STREET.muted,
  },
  streetPillTextEmphasis: {
    color: STREET.mustard,
  },
  // Every street control is at least 48pt tall (plan: sizing system).
  streetButton: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  streetDisabled: {
    opacity: 0.45,
  },
  // Press squash (plan: 0.95, under 100ms) — the art also swaps to its pressed bevel.
  streetSquash: {
    transform: [{ scaleX: 0.96 }, { scaleY: 0.93 }],
  },
  streetButtonText: {
    fontFamily: STREET_FONT.bold,
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: -2,
  },
  streetButtonTextPressed: {
    marginTop: 1,
  },
});
