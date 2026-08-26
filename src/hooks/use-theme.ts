import type { AppearanceTokens } from '@/constants/appearance';
import { useAppearance } from '@/lib/theme/context';

export function useTheme(): AppearanceTokens {
  return useAppearance().tokens;
}
