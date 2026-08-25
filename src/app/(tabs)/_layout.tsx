import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { HeaderAvatar } from '@/components/header-avatar';
import { CircleProvider } from '@/lib/circle-context';

export default function TabLayout() {
  return (
    <CircleProvider>
      <View style={{ flex: 1 }}>
        <AppTabs />
        {/* One always-mounted gesture face, floating top-right over every tab. */}
        <HeaderAvatar />
      </View>
    </CircleProvider>
  );
}
