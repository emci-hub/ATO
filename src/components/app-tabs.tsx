import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon src={<VectorIcon family={MaterialCommunityIcons} name="home" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="sage">
        <Label>Sage</Label>
        <Icon src={<VectorIcon family={MaterialCommunityIcons} name="creation" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="you">
        <Label>You</Label>
        <Icon src={<VectorIcon family={MaterialCommunityIcons} name="account" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
