import { colors, spacing, typography } from "@kaya/ui";
import Constants from "expo-constants";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/**
 * Splash. The route guard holds every fresh launch here while the session is
 * restored from the keychain, so this is the first screen of every cold start
 * -- and until now it was a placeholder rendering the dev route explorer.
 *
 * The name comes from the build config (expo-constants), not a literal: the
 * product's final name is not chosen and the no-hardcoded-branding rule
 * applies here more than anywhere, since this screen IS the brand moment.
 *
 * No i18n string on purpose: the locale is being read from storage at exactly
 * this moment, and a French word flashing to English mid-splash is worse than
 * a wordmark and a spinner.
 */
export default function SplashScreen() {
  return (
    <View style={styles.screen} testID="splash-screen">
      <Text style={styles.wordmark} testID="splash-screen-title">
        {Constants.expoConfig?.name ?? ""}
      </Text>
      <ActivityIndicator color={colors.surface} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The one drenched surface in the app: the brand carries the whole frame
  // for the second it is on screen.
  screen: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  wordmark: {
    ...typography.screenTitle,
    color: colors.surface,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
  },
});
