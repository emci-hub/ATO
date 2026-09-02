import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useAppearance } from '@/lib/theme/context';
import { useTheme } from '@/hooks/use-theme';

type ThemedPressableProps = PressableProps & {
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared press/focus/hover chrome so every interactive control gets a visible
 * focus ring and a reduced-motion-safe press state.
 */
export function ThemedPressable({
  filled = false,
  style,
  children,
  ...rest
}: ThemedPressableProps) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();

  return (
    <Pressable
      {...rest}
      style={(state) => {
        const pressed = state.pressed;
        const focused = Boolean((state as { focused?: boolean }).focused);
        const hovered = Boolean((state as { hovered?: boolean }).hovered);
        const lift = !reduceMotion && theme.liftOnHover && hovered && !pressed ? -2 : 0;
        const scale = pressed && !reduceMotion ? theme.pressScale : 1;
        const extra = typeof style === 'function' ? style(state) : style;
        const focusRing = Platform.select<ViewStyle | undefined>({
          web: focused
            ? {
                outlineStyle: 'solid',
                outlineWidth: 2,
                outlineColor: theme.accent,
                outlineOffset: 2,
              }
            : undefined,
          default: focused ? { borderWidth: 2, borderColor: theme.accent } : undefined,
        });

        return [
          {
            backgroundColor: filled ? theme.accentFill : undefined,
            transform: [{ translateY: lift }, { scale }],
          },
          focusRing,
          extra,
        ];
      }}>
      {children}
    </Pressable>
  );
}
