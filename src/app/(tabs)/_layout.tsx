import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { NavPixel } from '@/components/nav-pixel';
import { CircleProvider } from '@/lib/circle-context';

export default function TabLayout() {
  return (
    <CircleProvider>
      <View style={{ flex: 1, overflow: 'visible' }}>
        <AppTabs />
        {/* One always-mounted live face, fixed top-right over every tab. */}
        <NavPixel />
      </View>
    </CircleProvider>
  );
}
