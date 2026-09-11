/**
 * PlayThemeProvider — forces Neon Viper inside Divecore Play.
 *
 * Wrap the whole Play tree once (in `src/app/play.tsx`); every `useTheme()`
 * under it reads `NEON_VIPER_TOKENS` instead of the viewer's app-wide mode, so
 * Shop / Dress / Dive / About all inherit Command Hub chrome for free. The
 * app-wide appearance is never mutated.
 */
import type { ReactNode } from 'react';

import { ThemeOverrideProvider } from '@/lib/theme/override';
import { NEON_VIPER_TOKENS } from '@/play/neon-viper';

export function PlayThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeOverrideProvider tokens={NEON_VIPER_TOKENS}>{children}</ThemeOverrideProvider>;
}
