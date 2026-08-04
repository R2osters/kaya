import { KayaButton, typography } from "@kaya/ui";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

/**
 * Placeholder first screen. Its only job in this task is proving the
 * workspace resolves: a KayaButton and a Text styled from @kaya/ui's
 * typography tokens, with copy pulled from @kaya/core's i18n resources
 * rather than hardcoded. The real splash/welcome/auth-guard flow is task 3;
 * the full route tree is task 5.
 */
export default function IndexScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container} testID="index-screen">
      <Text style={typography.screenTitle}>{t("authWelcomeTitle")}</Text>
      <Text style={typography.bodySecondary}>{t("authWelcomeSubtitle")}</Text>
      <KayaButton label={t("actionContinue")} onPress={() => {}} testID="continue-button" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
});
