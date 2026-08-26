import { Platform, type ViewStyle } from 'react-native';

import type { AppearanceTokens } from '@/constants/appearance';

export function surfaceShadow(theme: AppearanceTokens, reduceMotion: boolean): ViewStyle {
  if (theme.id === 'soft') {
    return Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
      default: {
        boxShadow: '0 8px 24px rgba(79, 70, 229, 0.12)',
      } as ViewStyle,
    }) as ViewStyle;
  }

  if (theme.id === 'quest') {
    return Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.55,
        shadowRadius: 0,
      },
      android: { elevation: 2 },
      default: {
        boxShadow: 'inset 0 1px 0 rgba(148, 163, 184, 0.25), inset 0 -2px 0 rgba(2, 6, 23, 0.55)',
      } as ViewStyle,
    }) as ViewStyle;
  }

  if (theme.id === 'neon') {
    const glow = reduceMotion
      ? '0 0 8px rgba(0, 255, 255, 0.18)'
      : '0 0 8px rgba(0, 255, 255, 0.35), 0 0 22px rgba(0, 255, 255, 0.16)';
    return Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#00FFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: reduceMotion ? 0.25 : 0.45,
        shadowRadius: reduceMotion ? 6 : 12,
      },
      android: { elevation: 6 },
      default: { boxShadow: glow } as ViewStyle,
    }) as ViewStyle;
  }

  if (theme.id === 'anime') {
    const glow = reduceMotion
      ? '0 0 10px rgba(124, 58, 237, 0.28)'
      : '0 0 6px rgba(124, 58, 237, 0.55), 0 0 16px rgba(6, 214, 160, 0.22), 0 0 28px rgba(124, 58, 237, 0.18)';
    return Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: reduceMotion ? 0.3 : 0.55,
        shadowRadius: reduceMotion ? 8 : 14,
      },
      android: { elevation: 8 },
      default: { boxShadow: glow } as ViewStyle,
    }) as ViewStyle;
  }

  return {};
}

export function surfaceChrome(theme: AppearanceTokens, reduceMotion: boolean): ViewStyle {
  return {
    borderRadius: theme.cutCorners ? 0 : theme.radius,
    borderWidth: theme.cardBorderWidth,
    borderColor: theme.border,
    overflow: theme.scanlines || theme.hudFrames !== 'none' || theme.cutCorners ? 'hidden' : 'visible',
    ...surfaceShadow(theme, reduceMotion),
  };
}
