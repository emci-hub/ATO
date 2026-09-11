import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Scale: 12 code - 14 small - 16 default - 20 subheading - 24 heading -
 * 32 subtitle - 48 title. The 20/24 steps exist so a section head or a card
 * title has somewhere to sit other than 14px bold.
 */
export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subheading'
    | 'heading'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'codeBold';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const isHeading =
    type === 'title' || type === 'subtitle' || type === 'heading' || type === 'subheading';
  // Display / headings ride Rajdhani (500 / 600 / 700); Zen keeps its serif.
  const headingFontFamily = theme.useSerifHeadings
    ? Fonts.serif
    : theme.headingWeight === '700'
      ? Fonts.displayBold
      : theme.headingWeight === '300' || theme.headingWeight === '400'
        ? Fonts.display
        : Fonts.displaySemiBold;
  const heading: TextStyle | null = isHeading
    ? {
        fontFamily: headingFontFamily,
        // The Rajdhani families encode their weight; only the serif fallback
        // needs an explicit weight (a numeric one alongside a loaded family
        // can force a synthetic or system fallback face).
        fontWeight: theme.useSerifHeadings ? theme.headingWeight : 'normal',
        letterSpacing: theme.headingLetterSpacing,
        textTransform: theme.headingTransform,
        color: theme.id === 'quest' ? theme.emphasis : theme[themeColor ?? 'text'],
        textShadowColor: theme.id === 'neon' ? 'rgba(0, 234, 255, 0.45)' : undefined,
        textShadowOffset: theme.id === 'neon' ? { width: 0, height: 0 } : undefined,
        textShadowRadius: theme.id === 'neon' ? 8 : undefined,
      }
    : null;

  // Mono / HUD numbers ride Space Mono (400, or 700 for `codeBold`).
  const mono =
    (type === 'code' || type === 'codeBold') && theme.useMono
      ? { fontFamily: type === 'codeBold' ? Fonts.monoBold : Fonts.mono, fontWeight: 'normal' as const }
      : null;

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subheading' && styles.subheading,
        type === 'heading' && styles.heading,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.accent }],
        (type === 'code' || type === 'codeBold') && [
          styles.code,
          !theme.useMono && { fontFamily: Fonts.sans },
        ],
        heading,
        mono,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  heading: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 600,
  },
  subheading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 600,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
