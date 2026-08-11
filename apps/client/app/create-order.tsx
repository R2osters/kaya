import { formatMoney, toApiFailure, type AddressSuggestion, type GeoPoint } from "@kaya/core";
import {
  KayaButton,
  KayaCard,
  KayaScreenHeader,
  KayaSkeleton,
  KayaTextField,
  colors,
  radii,
  spacing,
  typography,
  KayaPressable,
} from "@kaya/ui";
import { useFocusEffect, useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {ScrollView, StyleSheet, Text, View} from "react-native";
import { useGoBack } from "../src/navigation/useGoBack";
import { useCreateOrder } from "../src/queries/orders";
import { usePriceQuote } from "../src/queries/pricing";
import {
  useAddressSelectionStore,
  type AddressField,
} from "../src/state/addressSelectionStore";

const SIZES = [
  { value: "S", key: "orderSizeSmall" },
  { value: "M", key: "orderSizeMedium" },
  { value: "L", key: "orderSizeLarge" },
] as const;

function pointOf(suggestion: AddressSuggestion | null): GeoPoint | null {
  return suggestion === null ? null : { lat: suggestion.lat, lng: suggestion.lng };
}

/**
 * Create an order, phase 2A. Ported from
 * legacy/flutter/client/lib/features/order/create_order_screen.dart.
 *
 * **The photo picker is not ported, on purpose.** The Dart screen compresses a
 * photo into `_photoPath` and then only reads it to change a button label:
 * `packagePhoto` is in no request it sends, and the backend has no endpoint to
 * upload one against (only `auth/upload-id` and `auth/upload-license` exist).
 * Porting it would ship a control that discards what the user gives it. It
 * lands with the upload endpoint.
 *
 * **Scheduling is not ported either** -- see the slice's design doc. This
 * screen therefore always publishes immediately.
 */
export default function CreateOrderScreen() {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const router = useRouter();

  const [pickup, setPickup] = useState<AddressSuggestion | null>(null);
  const [dropoff, setDropoff] = useState<AddressSuggestion | null>(null);
  const [description, setDescription] = useState("");
  const [size, setSize] = useState<string>("M");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { target, selection, open, consume } = useAddressSelectionStore();
  const quote = usePriceQuote(pointOf(pickup), pointOf(dropoff));
  const createOrder = useCreateOrder();

  // Runs when the screen comes back into focus, which is when /address-search
  // has popped. The store is the only way a result can travel back: Expo
  // Router navigation returns nothing. See addressSelectionStore.
  useFocusEffect(
    useCallback(() => {
      if (selection === null || target === null) return;
      if (target === "pickup") setPickup(selection);
      else setDropoff(selection);
      consume();
    }, [selection, target, consume]),
  );

  const openSearch = (field: AddressField) => {
    open(field);
    router.push("/address-search");
  };

  const submit = () => {
    if (pickup === null || dropoff === null) {
      setValidationError(t("orderAddressMissing"));
      return;
    }
    setValidationError(null);
    createOrder.mutate(
      { pickup, dropoff, description, size },
      // Routing on success only: an order that failed to publish must not send
      // the user to an offers screen for an order nobody can bid on.
      { onSuccess: (order) => router.replace(`/offers/${order.id}`) },
    );
  };

  const serverError =
    createOrder.error === null || createOrder.error === undefined
      ? null
      : toApiFailure(createOrder.error).message;
  const error = validationError ?? serverError;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="create-order-screen"
      keyboardShouldPersistTaps="handled"
    >
      <KayaScreenHeader title={t("screenCreateOrder")} onBack={goBack} testID="create-order-screen" />

      <AddressField
        label={t("orderPickup")}
        value={pickup}
        onPress={() => openSearch("pickup")}
        testID="create-order-pickup"
      />
      <AddressField
        label={t("orderDropoff")}
        value={dropoff}
        onPress={() => openSearch("dropoff")}
        testID="create-order-dropoff"
      />

      <View style={styles.sizes} testID="create-order-sizes">
        <Text style={typography.bodyStrong}>{t("orderSize")}</Text>
        <View style={styles.sizeRow}>
          {SIZES.map((option) => (
            <KayaPressable
              key={option.value}
              onPress={() => setSize(option.value)}
              style={[styles.sizeChip, size === option.value && styles.sizeChipSelected]}
              testID={`create-order-size-${option.value}`}
            >
              <Text
                style={[
                  typography.body,
                  size === option.value && styles.sizeChipSelectedLabel,
                ]}
              >
                {t(option.key)}
              </Text>
            </KayaPressable>
          ))}
        </View>
      </View>

      <KayaTextField
        label={t("orderDescription")}
        hint={t("orderDescriptionHint")}
        value={description}
        onChangeText={setDescription}
        multiline
        testID="create-order-description"
      />

      <QuoteCard quote={quote} />

      {error !== null && (
        <Text style={styles.error} testID="create-order-error">
          {error}
        </Text>
      )}

      <KayaButton
        label={t("orderSubmit")}
        onPress={submit}
        loading={createOrder.isPending}
        expand
        testID="create-order-submit"
      />
    </ScrollView>
  );
}

function AddressField({
  label,
  value,
  onPress,
  testID,
}: {
  label: string;
  value: AddressSuggestion | null;
  onPress: () => void;
  testID: string;
}) {
  return (
    <KayaPressable onPress={onPress} testID={testID}>
      <KayaCard>
        <View style={styles.addressRow}>
          <MapPin size={18} color={colors.inkTertiary} />
          <View style={styles.addressText}>
            <Text style={typography.caption}>{label}</Text>
            <Text
              style={value === null ? styles.addressEmpty : typography.bodyStrong}
              testID={`${testID}-value`}
            >
              {value?.label ?? "—"}
            </Text>
          </View>
        </View>
      </KayaCard>
    </KayaPressable>
  );
}

function QuoteCard({ quote }: { quote: ReturnType<typeof usePriceQuote> }) {
  const { t } = useTranslation();

  if (quote.fetchStatus === "idle" && quote.data === undefined) {
    return (
      <Text style={typography.caption} testID="create-order-quote-pending">
        {t("orderQuotePending")}
      </Text>
    );
  }

  if (quote.data === undefined) {
    return <KayaSkeleton height={72} testID="create-order-quote-loading" />;
  }

  return (
    <KayaCard testID="create-order-quote">
      <Text style={typography.caption}>{t("orderQuoteTitle")}</Text>
      {/* formatMoney renders the currency's own decimals: whole francs for
          XOF, pesewas for GHS. See @kaya/core's currencyDecimals. */}
      <Text style={typography.screenTitle} testID="create-order-quote-amount">
        {formatMoney(quote.data.minPrice, quote.data.currency)}
      </Text>
      <Text style={typography.caption} testID="create-order-quote-distance">
        {t("orderQuoteDistance", { km: quote.data.distanceKm })}
      </Text>
    </KayaCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  addressRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  addressText: { flex: 1 },
  addressEmpty: { ...typography.bodyStrong, color: colors.inkTertiary },
  sizes: { gap: spacing.sm },
  sizeRow: { flexDirection: "row", gap: spacing.sm },
  sizeChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  sizeChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  sizeChipSelectedLabel: { color: colors.primary },
  error: { ...typography.caption, color: colors.danger },
});
