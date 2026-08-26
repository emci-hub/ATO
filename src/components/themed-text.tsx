import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const heading =
    type === 'title' || type === 'subtitle'
      ? {
          fontFamily: theme.useSerifHeadings ? Fonts.serif : undefined,
          fontWeight: theme.headingWeight,
          letterSpacing: theme.headingLetterSpacing,
          textTransform: theme.headingTransform,
          color: theme.id === 'quest' ? theme.emphasis : theme[themeColor ?? 'text'],
          textShadowColor: theme.id === 'neon' ? 'rgba(0, 255, 255, 0.45)' : undefined,
          textShadowOffset: theme.id === 'neon' ? { width: 0, height: 0 } : undefined,
          textShadowRadius: theme.id === 'neon' ? 8 : undefined,
        }
      : null;

  const mono = type === 'code' && theme.useMono ? { fontFamily: Fonts.mono } : null;

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.accent }],
        type === 'code' && [styles.code, !theme.useMono && { fontFamily: Fonts.sans }],
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
