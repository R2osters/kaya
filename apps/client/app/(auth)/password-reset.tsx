import { toApiFailure } from "@kaya/core";
import { KayaButton, KayaTextField, colors, spacing, typography } from "@kaya/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useResetPassword, useSendVerificationCode } from "../../src/queries/authFlows";

/**
 * Password reset, phase 2 slice C. Ported from
 * legacy/flutter/client/lib/features/onboarding/password_reset_screen.dart.
 *
 * Two steps on one screen: request a code for the phone, then send the code
 * and the new password together. The backend does not hold a reset session --
 * `resetPassword` takes the phone, the proof and the new password in one call
 * -- so there is nothing to lose by staying on one screen, and a user who
 * mistypes the number can fix it without starting over.
 *
 * The proof comes from src/auth/phoneVerification.ts, which is the mock today
 * and Firebase later; this screen does not know which.
 */
export default function PasswordResetScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const sendCode = useSendVerificationCode();
  const reset = useResetPassword();

  const submitPhone = () => {
    if (phone.trim() === "") {
      setValidationError(t("loginPhoneRequired"));
      return;
    }
    setValidationError(null);
    sendCode.mutate(phone);
  };

  const submitReset = () => {
    if (code.trim() === "" || password === "") {
      setValidationError(t("authResetFieldsRequired"));
      return;
    }
    setValidationError(null);
    reset.mutate({ phone, code, newPassword: password });
  };

  const failure = sendCode.error ?? reset.error;
  const error =
    validationError ??
    (failure === null || failure === undefined ? null : toApiFailure(failure).message);

  if (reset.isSuccess) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        testID="password-reset-screen"
      >
        <Text style={typography.screenTitle} testID="password-reset-screen-title">
          {t("authResetPasswordTitle")}
        </Text>
        <Text style={typography.bodyStrong} testID="password-reset-success">
          {t("authResetPasswordSuccess")}
        </Text>
        <KayaButton
          label={t("authLogin")}
          onPress={() => router.replace("/login")}
          expand
          testID="password-reset-to-login"
        />
      </ScrollView>
    );
  }

  const codeSent = sendCode.isSuccess;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="password-reset-screen"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={typography.screenTitle} testID="password-reset-screen-title">
        {t("authResetPasswordTitle")}
      </Text>

      <KayaTextField
        label={t("authPhone")}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        // Locked once a code is out: changing it here would leave the code
        // proving one number while the request carried another, and the
        // backend would reject it with nothing on screen to explain why.
        editable={!codeSent}
        testID="password-reset-phone"
      />

      {!codeSent ? (
        <KayaButton
          label={t("authSendCode")}
          onPress={submitPhone}
          loading={sendCode.isPending}
          expand
          testID="password-reset-send"
        />
      ) : (
        <>
          <KayaTextField
            label={t("authCode")}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            testID="password-reset-code"
          />
          <KayaTextField
            label={t("authNewPassword")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="password-reset-password"
          />
          <KayaButton
            label={t("authResetPasswordTitle")}
            onPress={submitReset}
            loading={reset.isPending}
            expand
            testID="password-reset-submit"
          />
        </>
      )}

      {error !== null && (
        <Text style={styles.error} testID="password-reset-error">
          {error}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  error: { ...typography.caption, color: colors.danger },
});
