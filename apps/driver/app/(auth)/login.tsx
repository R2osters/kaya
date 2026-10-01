import { toApiFailure } from "@kaya/core";
import { KayaScreenHeader, KayaButton, KayaTextField, colors, radii, spacing, typography } from "@kaya/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useGoBack } from "../../src/navigation/useGoBack";
import { useSignIn } from "../../src/queries/auth";

/**
 * Development sign-in, phase 2A.
 *
 * One field and one button, because that is all the mock verifier needs: it
 * accepts `dev:<phone>` and there is no code to type. A code field here would
 * be theatre -- it would collect a value nothing checks, and the first person
 * to read the screen would reasonably assume an SMS had been sent.
 *
 * The notice at the top says what this is, on screen rather than only in a
 * comment, so it cannot be mistaken for the real thing during a demo. Slice C
 * replaces the whole screen with the Firebase Phone Auth flow.
 *
 * On success nothing here navigates: the auth store flips to `authenticated`
 * and the route guard in app/_layout.tsx moves the app to /home. Screens do
 * not route around the guard.
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const signIn = useSignIn();

  const submit = () => {
    if (phone.trim() === "") {
      setValidationError(t("loginPhoneRequired"));
      return;
    }
    setValidationError(null);
    signIn.mutate(phone);
  };

  // Server-side failures come back through toApiFailure, which turns a
  // transport error, a 4xx body and a schema mismatch into the same shape --
  // never a raw exception on screen.
  const serverError =
    signIn.error === null || signIn.error === undefined
      ? null
      : toApiFailure(signIn.error).message;
  const error = validationError ?? serverError;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="login-screen"
      keyboardShouldPersistTaps="handled"
    >
      <KayaScreenHeader title={t("screenLogin")} onBack={goBack} testID="login-screen" />

      <View style={styles.notice}>
        <Text style={typography.caption} testID="login-dev-notice">
          {t("loginDevNotice")}
        </Text>
      </View>

      <KayaTextField
        label={t("loginPhoneLabel")}
        hint={t("loginPhonePlaceholder")}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        testID="login-phone"
      />

      {error !== null && (
        <Text style={styles.error} testID="login-error">
          {error}
        </Text>
      )}

      <KayaButton
        label={t("loginSubmit")}
        onPress={submit}
        loading={signIn.isPending}
        expand
        testID="login-submit"
      />

      {/* Without these the screen is a dead end. A phone with no account gets
          "Invalid credentials" -- deliberately uniform, so the backend does not
          leak which numbers exist -- and there was nothing here to act on it
          with: no way to create the account, no way to recover a password.
          Reported from a device by someone stuck on exactly that. */}
      <KayaButton
        label={t("authRegister")}
        variant="secondary"
        onPress={() => router.push("/register")}
        expand
        testID="login-to-register"
      />
      <KayaButton
        label={t("authForgotPassword")}
        variant="secondary"
        onPress={() => router.push("/password-reset")}
        expand
        testID="login-to-reset"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  notice: {
    backgroundColor: colors.amberTint,
    borderRadius: radii.cardTight,
    padding: spacing.md,
  },
  error: { ...typography.caption, color: colors.danger },
});
