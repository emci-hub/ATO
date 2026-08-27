import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { CircleProvider } from '@/lib/circle-context';

export default function TabLayout() {
  return (
    <CircleProvider>
      <View style={{ flex: 1 }}>
        <AppTabs />
      </View>
    </CircleProvider>
  );
}
