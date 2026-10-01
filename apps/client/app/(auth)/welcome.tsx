import { KayaButton, colors, spacing, typography } from "@kaya/ui";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

/**
 * The screen a signed-out user lands on, phase 2 slice C. Ported from
 * legacy/flutter/client/lib/features/onboarding/welcome_screen.dart.
 *
 * The route guard sends every anonymous session here, so it is the only screen
 * most people see before deciding whether to use the product at all. It offers
 * exactly two doors and nothing else.
 */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.screen} testID="welcome-screen">
      <View style={styles.copy}>
        <Text style={typography.screenTitle} testID="welcome-screen-title">
          {t("authWelcomeTitle")}
        </Text>
        <Text style={typography.bodySecondary} testID="welcome-subtitle">
          {t("authWelcomeSubtitle")}
        </Text>
      </View>

      <View style={styles.actions}>
        <KayaButton
          label={t("authLogin")}
          onPress={() => router.push("/login")}
          expand
          testID="welcome-login"
        />
        <KayaButton
          label={t("authRegister")}
          variant="secondary"
          onPress={() => router.push("/register")}
          expand
          testID="welcome-register"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  copy: { flex: 1, justifyContent: "center", gap: spacing.md },
  actions: { gap: spacing.md, paddingBottom: spacing.xxl },
});
