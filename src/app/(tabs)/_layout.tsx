import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { BuddyBubble } from '@/components/buddy-bubble';
import { NavPixel } from '@/components/nav-pixel';
import { CircleProvider } from '@/lib/circle-context';
import { NavOrderProvider } from '@/lib/nav/nav-context';
import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const theme = useTheme();

  return (
    <NavOrderProvider>
      <CircleProvider>
        <View style={{ flex: 1, overflow: 'visible', backgroundColor: theme.background }}>
          <AppTabs />
          {/* One always-mounted live face, fixed top-right over every tab. */}
          <NavPixel />
          {/* What he says: his speech bubble and the waiting dot. */}
          <BuddyBubble />
        </View>
      </CircleProvider>
    </NavOrderProvider>
  );
}
