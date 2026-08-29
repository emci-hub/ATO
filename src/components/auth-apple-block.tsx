import * as AppleAuthentication from 'expo-apple-authentication';
import { View } from 'react-native';

import { authStyles } from '@/components/auth-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AuthAppleBlock({
  buttonType,
  onPress,
}: {
  buttonType: AppleAuthentication.AppleAuthenticationButtonType;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <>
      <View style={authStyles.dividerRow}>
        <View
          style={[authStyles.dividerLine, { backgroundColor: theme.backgroundSelected }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          or
        </ThemedText>
        <View
          style={[authStyles.dividerLine, { backgroundColor: theme.backgroundSelected }]}
        />
      </View>

      {/* Apple requires their own button component, not a custom one. */}
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={buttonType}
        buttonStyle={
          theme.scheme === 'light'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
        }
        cornerRadius={Spacing.three}
        style={authStyles.appleButton}
        onPress={onPress}
      />

      <ThemedText type="small" themeColor="textSecondary" style={authStyles.appleNote}>
        You can hide your email — ATO works the same either way.
      </ThemedText>
    </>
  );
}
