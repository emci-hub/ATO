import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { useCircleContext } from '@/lib/circle-context';
import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const { hasCircle } = useCircleContext();

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

      {/* Circle does not exist until a scan. The Trigger stays statically in
          the layout (expo-router rejects dynamically added/removed triggers);
          `hidden` excludes the route from the navigator until a connection
          exists — functionally "not present, not hidden-in-the-bar". */}
      <NativeTabs.Trigger name="circle" hidden={!hasCircle}>
        <Label>Circle</Label>
        <Icon src={<VectorIcon family={MaterialCommunityIcons} name="account-group" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="you">
        <Label>You</Label>
        <Icon src={<VectorIcon family={MaterialCommunityIcons} name="account" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
