import { COUNTRIES, COUNTRY_CODES, toApiFailure } from "@kaya/core";
import {
  KayaButton,
  KayaCard,
  KayaScreenHeader,
  KayaTextField,
  colors,
  radii,
  spacing,
  typography,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useGoBack } from "../../src/navigation/useGoBack";
import { useRegister } from "../../src/queries/authFlows";

const STEPS = ["authStepContact", "authStepIdentity", "authStepSecurity"] as const;

/**
 * Sign-up, phase 2 slice C. Ported from the Dart wizard in
 * legacy/flutter/client/lib/features/onboarding/wizard/.
 *
 * Three steps, in the order the backend cares about them: contact (the phone
 * that will be verified, and the country that decides the currency), identity,
 * then security. The draft lives in this component rather than in a store --
 * the Dart original used a `RegisterDraft` notifier, but nothing outside the
 * wizard reads a half-filled sign-up, and a store would keep it alive after
 * the user walks away.
 *
 * The country is chosen here and not inferred. It selects `country_configs`,
 * which decides the currency someone is billed in and the documents a driver
 * must supply -- guessing it from a dialling code would be a guess about
 * money.
 *
 * Only the client role signs up here. Drivers need a licence number in a
 * country-specific format plus a QR code (backend/src/auth/driver-validation.ts),
 * which is the driver app's sign-up in phase 3.
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState<string>("GHA");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const register = useRegister();

  const stepIsComplete = (index: number): boolean => {
    if (index === 0) return phone.trim() !== "";
    if (index === 1) return fullName.trim() !== "" && email.trim() !== "";
    return password !== "" && code.trim() !== "";
  };

  const next = () => {
    if (!stepIsComplete(step)) {
      setValidationError(t("authRegisterFieldsRequired"));
      return;
    }
    setValidationError(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    register.mutate(
      { fullName, email, phone, password, countryCode, code },
      { onSuccess: () => router.replace("/login") },
    );
  };

  const error =
    validationError ??
    (register.error === null || register.error === undefined
      ? null
      : toApiFailure(register.error).message);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="register-screen"
      keyboardShouldPersistTaps="handled"
    >
      <KayaScreenHeader title={t("authRegister")} onBack={goBack} testID="register-screen" />

      <View style={styles.steps} testID="register-steps">
        {STEPS.map((label, index) => (
          <View
            key={label}
            style={[styles.stepBar, index <= step && styles.stepBarDone]}
            testID={`register-step-${index}${index <= step ? "-done" : ""}`}
          />
        ))}
      </View>
      <Text style={typography.bodyStrong} testID="register-step-label">
        {t(STEPS[step] ?? STEPS[0])}
      </Text>

      {step === 0 && (
        <>
          <KayaTextField
            label={t("authPhone")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            testID="register-phone"
          />
          <View style={styles.countries} testID="register-countries">
            <Text style={typography.caption}>{t("authCountry")}</Text>
            <View style={styles.countryRow}>
              {COUNTRY_CODES.map((code) => (
                <Pressable
                  key={code}
                  onPress={() => setCountryCode(code)}
                  style={[styles.country, countryCode === code && styles.countrySelected]}
                  testID={`register-country-${code}`}
                >
                  <Text
                    style={[
                      typography.body,
                      countryCode === code && styles.countrySelectedLabel,
                    ]}
                  >
                    {`${COUNTRIES[code].flag} ${COUNTRIES[code].displayName}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}

      {step === 1 && (
        <>
          <KayaTextField
            label={t("authFullName")}
            value={fullName}
            onChangeText={setFullName}
            testID="register-full-name"
          />
          <KayaTextField
            label={t("authEmail")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            testID="register-email"
          />
        </>
      )}

      {step === 2 && (
        <>
          <KayaTextField
            label={t("authPassword")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="register-password"
          />
          <KayaCard testID="register-code-card">
            {/* The screen used to say "enter the code sent to your phone"
                while nothing sent one and no button asked for one. Under the
                development verifier no SMS exists at all, so the screen says
                that instead of asking for something the app cannot provide.
                Slice C's Firebase work replaces this notice with a real send. */}
            <Text style={typography.caption} testID="register-dev-notice">
              {t("authDevCodeNotice")}
            </Text>
            <KayaTextField
              label={t("authCode")}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              testID="register-code"
            />
          </KayaCard>
        </>
      )}

      {error !== null && (
        <Text style={styles.error} testID="register-error">
          {error}
        </Text>
      )}

      <KayaButton
        label={step === STEPS.length - 1 ? t("authRegister") : t("authNext")}
        onPress={next}
        loading={register.isPending}
        expand
        testID="register-next"
      />

      {step > 0 && (
        <KayaButton
          label={t("authBack")}
          variant="secondary"
          onPress={() => {
            setValidationError(null);
            setStep(step - 1);
          }}
          expand
          testID="register-back"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.md },
  steps: { flexDirection: "row", gap: spacing.sm },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderSoft },
  stepBarDone: { backgroundColor: colors.primary },
  countries: { gap: spacing.sm },
  countryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  country: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  countrySelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  countrySelectedLabel: { color: colors.primary },
  error: { ...typography.caption, color: colors.danger },
});
