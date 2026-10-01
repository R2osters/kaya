import { currencyDecimals, formatMoney, toApiFailure } from "@kaya/core";
import {
  KayaButton,
  KayaCard,
  KayaPressable,
  KayaScreenHeader,
  KayaTextField,
  colors,
  radii,
  spacing,
  typography,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Info } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useGoBack } from "../src/navigation/useGoBack";
import { useCountryConfig } from "../src/queries/countryConfig";
import { useDriverBalance } from "../src/queries/driver";
import { useRequestWithdrawal } from "../src/queries/withdrawals";

type Method = "momo" | "bank_transfer";

/**
 * Withdraw, phase 3. Ported from
 * legacy/flutter/driver/lib/features/earnings/withdrawal_screen.dart.
 *
 * The methods offered are the country's own (`withdrawalMethods` on the
 * tariff card), not a fixed pair. Offering a driver in Lomé a Ghanaian bank
 * transfer produces a 400 they cannot act on -- the backend checks the same
 * list, so reading it here is what makes the screen agree with the rule.
 *
 * The account fields are method-specific because the backend validates them
 * that way: MoMo needs `{ phone, provider }`, a bank needs
 * `{ account_name, account_number }`. The Dart original sent
 * `{'account': ...}` for a bank, which fails that check every time -- a bug
 * the port does not carry over.
 *
 * Nothing is submitted twice. The mutation never retries (a replay is a second
 * debit, taken immediately by the backend), and the button is disabled while
 * it is in flight and once it has succeeded.
 */
export default function WithdrawScreen() {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const router = useRouter();

  const balance = useDriverBalance();
  const config = useCountryConfig();
  const withdraw = useRequestWithdrawal();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const currency = balance.data?.currency ?? config.data?.currency ?? "GHS";
  const available = balance.data?.balance ?? 0;
  const methods = (config.data?.withdrawalMethods ?? []).filter(isMethod);
  // Whichever the country offers first, until the driver chooses. A screen
  // that opens with nothing selected makes the first tap a formality.
  const selected = method ?? methods[0] ?? null;
  const providers = config.data?.momoProviders ?? [];
  const selectedProvider = provider ?? providers[0] ?? null;

  const parsed = Number(amount.replace(",", "."));
  const amountValid = Number.isFinite(parsed) && parsed > 0 && parsed <= available;
  const detailsValid =
    selected === "momo"
      ? phone.trim() !== "" && selectedProvider !== null
      : accountName.trim() !== "" && accountNumber.trim() !== "";

  const failure = withdraw.error;
  const error = failure === null || failure === undefined ? null : toApiFailure(failure).message;

  const submit = () => {
    if (selected === null || !amountValid || !detailsValid) return;

    withdraw.mutate(
      {
        // Rounded to the currency's own unit: a request for 12.50 XOF is a
        // request the CFA zone cannot pay, and the backend writes this
        // straight into an append-only ledger.
        amount: Number(parsed.toFixed(currencyDecimals(currency))),
        method: selected,
        accountDetails:
          selected === "momo"
            ? { phone: phone.trim(), provider: selectedProvider ?? "" }
            : { account_name: accountName.trim(), account_number: accountNumber.trim() },
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="withdraw-screen"
      keyboardShouldPersistTaps="handled"
    >
      <KayaScreenHeader title={t("driverWithdraw")} onBack={goBack} testID="withdraw-screen" />

      <KayaCard color={colors.amberTint} border={false} shadow={false} testID="withdraw-notice">
        <View style={styles.noticeRow}>
          <Info size={18} color={colors.amber} />
          <Text style={[typography.caption, styles.noticeText]}>{t("driverWithdrawNotice")}</Text>
        </View>
      </KayaCard>

      {/* The balance is what the whole screen is about, so it takes the
          largest style available rather than sitting at the same weight as a
          form label above it. */}
      <KayaCard testID="withdraw-available">
        <Text style={typography.overline}>{t("driverAvailableBalance")}</Text>
        <Text style={typography.priceLarge} testID="withdraw-available-amount">
          {formatMoney(available, currency)}
        </Text>
      </KayaCard>

      <KayaTextField
        value={amount}
        onChangeText={setAmount}
        label={t("driverAmountToWithdraw")}
        keyboardType="numeric"
        testID="withdraw-amount"
      />

      {methods.length > 1 && (
        <View style={styles.methods} testID="withdraw-methods">
          {methods.map((value) => (
            <KayaPressable
              key={value}
              onPress={() => setMethod(value)}
              style={[styles.method, selected === value && styles.methodSelected]}
              testID={`withdraw-method-${value}`}
            >
              <Text style={[typography.body, selected === value && styles.methodSelectedLabel]}>
                {value === "momo" ? t("payMomo") : t("driverBank")}
              </Text>
            </KayaPressable>
          ))}
        </View>
      )}

      {selected === "momo" ? (
        <>
          <KayaTextField
            value={phone}
            onChangeText={setPhone}
            label={t("driverMomoPhone")}
            keyboardType="phone-pad"
            testID="withdraw-phone"
          />
          {providers.length > 0 && (
            <View style={styles.methods} testID="withdraw-providers">
              {providers.map((value) => (
                <KayaPressable
                  key={value}
                  onPress={() => setProvider(value)}
                  style={[styles.method, selectedProvider === value && styles.methodSelected]}
                  testID={`withdraw-provider-${value}`}
                >
                  <Text
                    style={[
                      typography.body,
                      selectedProvider === value && styles.methodSelectedLabel,
                    ]}
                  >
                    {value.toUpperCase()}
                  </Text>
                </KayaPressable>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <KayaTextField
            value={accountName}
            onChangeText={setAccountName}
            label={t("driverBankAccountName")}
            testID="withdraw-account-name"
          />
          <KayaTextField
            value={accountNumber}
            onChangeText={setAccountNumber}
            label={t("driverBankAccountNumber")}
            testID="withdraw-account-number"
          />
        </>
      )}

      {error !== null && (
        <Text style={styles.error} testID="withdraw-error">
          {error}
        </Text>
      )}

      <KayaButton
        label={t("actionConfirm")}
        onPress={submit}
        loading={withdraw.isPending}
        // A disabled button says "not yet" before the tap; an error message
        // says it after the money question has already been asked.
        disabled={
          selected === null || !amountValid || !detailsValid || withdraw.isSuccess
        }
        expand
        testID="withdraw-submit"
      />
    </ScrollView>
  );
}

function isMethod(value: string): value is Method {
  return value === "momo" || value === "bank_transfer";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  noticeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  noticeText: { flex: 1, color: colors.ink },
  methods: { flexDirection: "row", gap: spacing.sm },
  method: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  methodSelectedLabel: { color: colors.primary, fontWeight: "700" },
  error: { ...typography.caption, color: colors.danger },
});
